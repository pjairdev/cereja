// Implementação com Firebase (Auth + Firestore). Ative com VITE_DATA_PROVIDER=firebase.
// Estrutura:
//   services/{id}, pros/{id}              leitura pública, escrita da equipe
//   slots/{proId_date_min}                blocos de 15 min ocupados (sem dados pessoais) — impede reserva dupla
//   appointments/{id}                     criação pela cliente logada; leitura da própria cliente e da equipe
//   clients/{uid}                         ficha da cliente (uid do login por link de e-mail); equipe lê todas
//   users/{uid}                           perfil e papel da equipe
//   stats/public                          contagem de serviços exibida no site
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  type Auth,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { BUSINESS, addDays, nowInBusiness, onlyDigits, uid } from '../lib/business'
import { isValidEmail, normalizeEmail } from '../lib/otp'
import { analyticsForStats } from './statsHelper'
import { availableSlots, pickPro } from '../lib/scheduling'
import type { Appointment, Client, ClientAccount, DB, Professional, Service, StaffUser } from '../lib/types'
import { BookingConflictError, LoginRequiredError, type BookingInput, type LoginRequest, type NewUserInput, type Repo } from './repo'

const EMAIL_FOR_SIGNIN = 'cereja.emailForSignIn'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

interface SlotDoc {
  apptId: string
  proId: string
  date: string
  start: number
  end: number
}

const slotId = (proId: string, date: string, min: number) => `${proId}_${date}_${min}`
function chunks(start: number, end: number) {
  const out: number[] = []
  for (let m = start; m < end; m += BUSINESS.slotStep) out.push(m)
  return out
}

export class FirebaseRepo implements Repo {
  readonly kind = 'firebase' as const
  private app!: FirebaseApp
  private auth!: Auth
  private fs!: Firestore
  private db: DB = { services: [], pros: [], clients: [], appointments: [], users: [] }
  private busy: Appointment[] = []
  private listeners = new Set<() => void>()
  private staffSubs: Unsubscribe[] = []
  private user: StaffUser | null = null
  private client: ClientAccount | null = null
  private linkHref: string | null = null

  async init() {
    if (!config.apiKey || !config.projectId) {
      throw new Error('Configure as variáveis VITE_FIREBASE_* no arquivo .env')
    }
    this.app = initializeApp(config)
    this.auth = getAuth(this.app)
    this.fs = getFirestore(this.app)

    const firstLoad = Promise.all([
      this.listen<Service>('services', (list) => (this.db = { ...this.db, services: list })),
      this.listen<Professional>('pros', (list) => (this.db = { ...this.db, pros: list })),
    ])

    onSnapshot(doc(this.fs, 'stats', 'public'), (snap) => {
      this.db = { ...this.db, publicStats: snap.exists() ? (snap.data() as DB['publicStats']) : undefined }
      this.emit()
    })

    // Ocupação pública dos próximos dias, sem nomes nem telefones
    const today = nowInBusiness().date
    const q = query(
      collection(this.fs, 'slots'),
      where('date', '>=', today),
      where('date', '<=', addDays(today, BUSINESS.bookingWindowDays)),
    )
    onSnapshot(q, (snap) => {
      const byAppt = new Map<string, SlotDoc>()
      snap.forEach((d) => {
        const s = d.data() as SlotDoc
        byAppt.set(s.apptId, s)
      })
      this.busy = [...byAppt.values()].map((s) => ({
        id: s.apptId,
        clientId: '',
        clientName: '',
        clientPhone: '',
        serviceId: '',
        proId: s.proId,
        date: s.date,
        start: s.start,
        end: s.end,
        price: 0,
        status: 'agendado',
        payment: { method: 'local', status: 'pendente' },
        source: 'site',
        createdAt: '',
      }))
      if (!this.user) this.db = { ...this.db, appointments: this.busy }
      this.emit()
    })

    // Volta do link de login enviado ao e-mail da cliente
    if (isSignInWithEmailLink(this.auth, window.location.href)) {
      this.linkHref = window.location.href
      const saved = safeLocal(EMAIL_FOR_SIGNIN)
      if (saved) await this.completeEmailLink(saved).catch(() => undefined)
    }

    await new Promise<void>((resolve) => {
      onAuthStateChanged(this.auth, async (fbUser) => {
        this.staffSubs.forEach((u) => u())
        this.staffSubs = []
        this.user = null
        this.client = null
        if (fbUser) {
          const snap = await getDoc(doc(this.fs, 'users', fbUser.uid))
          const profile = snap.exists() ? ({ id: snap.id, ...snap.data() } as StaffUser) : null
          if (profile?.active) {
            this.user = profile
            this.subscribeStaff()
          } else if (fbUser.email && fbUser.emailVerified) {
            // Cliente: login por link de e-mail (o próprio link comprova que o e-mail é dela)
            const c = await getDoc(doc(this.fs, 'clients', fbUser.uid)).catch(() => null)
            const data = (c?.exists() ? c.data() : {}) as Partial<Client>
            this.client = {
              id: fbUser.uid,
              email: normalizeEmail(fbUser.email),
              name: data.name ?? '',
              phone: data.phone ?? '',
              verifiedAt: data.emailVerifiedAt ?? new Date().toISOString(),
            }
          }
        }
        if (!this.user) this.db = { ...this.db, appointments: this.busy, clients: [], users: [] }
        this.emit()
        resolve()
      })
    })
    await firstLoad
  }

  private listen<T>(name: string, apply: (list: T[]) => void): Promise<void> {
    return new Promise((resolve) => {
      const unsub = onSnapshot(collection(this.fs, name), (snap) => {
        apply(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))
        this.emit()
        resolve()
      })
      if (name !== 'services' && name !== 'pros') this.staffSubs.push(unsub)
    })
  }

  private subscribeStaff() {
    this.listen<Appointment>('appointments', (list) => (this.db = { ...this.db, appointments: list }))
    this.listen<Client>('clients', (list) => (this.db = { ...this.db, clients: list }))
    if (this.user?.role === 'admin') this.listen<StaffUser>('users', (list) => (this.db = { ...this.db, users: list }))
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  getDB() {
    return this.db
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  // ---------- Conta da cliente (link de login no e-mail) ----------

  currentClient() {
    return this.client
  }

  async requestClientLogin(email: string): Promise<LoginRequest> {
    const key = normalizeEmail(email)
    if (!isValidEmail(key)) throw new Error('Digite um e-mail válido.')
    await sendSignInLinkToEmail(this.auth, key, {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    })
    safeLocal(EMAIL_FOR_SIGNIN, key)
    return { method: 'link', sent: true }
  }

  async verifyClientCode(): Promise<ClientAccount> {
    throw new Error('No Firebase a verificação é feita pelo link enviado ao e-mail.')
  }

  pendingEmailLink() {
    return !!this.linkHref && !this.client
  }

  async completeEmailLink(email: string): Promise<ClientAccount> {
    if (!this.linkHref) throw new Error('Abra o link que enviamos para o seu e-mail.')
    try {
      const cred = await signInWithEmailLink(this.auth, normalizeEmail(email), this.linkHref)
      safeLocal(EMAIL_FOR_SIGNIN, null)
      this.linkHref = null
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      const now = new Date().toISOString()
      await setDoc(doc(this.fs, 'clients', cred.user.uid), { email: normalizeEmail(email), emailVerifiedAt: now }, { merge: true })
      const c = await getDoc(doc(this.fs, 'clients', cred.user.uid))
      const data = (c.data() ?? {}) as Partial<Client>
      this.client = { id: cred.user.uid, email: normalizeEmail(email), name: data.name ?? '', phone: data.phone ?? '', verifiedAt: now }
      this.emit()
      return this.client
    } catch {
      throw new Error('Link inválido ou expirado. Peça um novo link.')
    }
  }

  async saveClientProfile(profile: { name: string; phone: string }): Promise<ClientAccount> {
    if (!this.client) throw new LoginRequiredError()
    const name = profile.name.trim()
    const phone = onlyDigits(profile.phone)
    if (name.length < 2) throw new Error('Informe seu nome.')
    if (phone.length < 10) throw new Error('Informe um WhatsApp válido com DDD.')
    await setDoc(
      doc(this.fs, 'clients', this.client.id),
      { name, phone, email: this.client.email, createdAt: this.client.verifiedAt },
      { merge: true },
    )
    this.client = { ...this.client, name, phone }
    this.emit()
    return this.client
  }

  async logoutClient() {
    await signOut(this.auth)
  }

  // ---------- Agendamento ----------

  async book(input: BookingInput): Promise<Appointment> {
    if (input.source === 'site' && !this.client) throw new LoginRequiredError()
    const service = this.db.services.find((s) => s.id === input.serviceId && s.active)
    if (!service) throw new Error('Serviço indisponível.')
    const phone = onlyDigits(input.phone)
    if (phone.length < 10) throw new Error('Informe um WhatsApp válido com DDD.')

    const slot = availableSlots({
      date: input.date,
      service,
      pros: this.db.pros,
      proId: input.proId,
      appointments: this.busy,
    }).find((s) => s.start === input.start)
    if (!slot) throw new BookingConflictError()
    const proId = input.proId === 'any' ? pickPro(slot.proIds, this.busy, input.date) : input.proId

    const apptId = uid('a') + uid()
    const mine = input.source === 'site' && this.client
    const clientId = mine ? this.client!.id : 'c' + phone
    const appt: Appointment = {
      id: apptId,
      clientId,
      clientName: input.name.trim(),
      clientPhone: phone,
      ...(mine ? { clientEmail: this.client!.email, clientUid: this.client!.id } : {}),
      serviceId: service.id,
      proId,
      date: input.date,
      start: slot.start,
      end: slot.end,
      price: service.price,
      status: input.source === 'admin' ? 'confirmado' : 'agendado',
      payment: { method: input.paymentMethod, status: 'pendente' },
      source: input.source,
      createdAt: new Date().toISOString(),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    }

    // Transação: se qualquer bloco de 15 min já existir, ninguém grava nada.
    await runTransaction(this.fs, async (tx) => {
      const refs = chunks(slot.start, slot.end).map((m) => doc(this.fs, 'slots', slotId(proId, input.date, m)))
      const snaps = await Promise.all(refs.map((r) => tx.get(r)))
      if (snaps.some((s) => s.exists())) throw new BookingConflictError()
      const slotData: SlotDoc = { apptId, proId, date: input.date, start: slot.start, end: slot.end }
      refs.forEach((r) => tx.set(r, slotData))
      const { id: _id, ...data } = appt
      tx.set(doc(this.fs, 'appointments', apptId), data)
    })
    if (!mine) {
      // agendamento feito pela equipe: ficha pelo WhatsApp
      await setDoc(doc(this.fs, 'clients', clientId), { name: appt.clientName, phone, createdAt: appt.createdAt }, { merge: true })
    }
    return appt
  }

  async myAppointments() {
    if (!this.client) return []
    const snap = await getDocs(query(collection(this.fs, 'appointments'), where('clientUid', '==', this.client.id)))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment)
  }

  async cancelMine(id: string) {
    const snap = await getDoc(doc(this.fs, 'appointments', id))
    const a = snap.data() as Appointment | undefined
    if (!a || !this.client || a.clientUid !== this.client.id) throw new Error('Agendamento não encontrado.')
    await this.releaseAndSet(id, a, { status: 'cancelado' })
  }

  async confirmPixSent(id: string) {
    await updateDoc(doc(this.fs, 'appointments', id), { 'payment.status': 'em_analise' })
  }

  private async releaseAndSet(id: string, cur: Appointment, patch: Partial<Appointment>) {
    const batch = writeBatch(this.fs)
    chunks(cur.start, cur.end).forEach((m) => batch.delete(doc(this.fs, 'slots', slotId(cur.proId, cur.date, m))))
    batch.update(doc(this.fs, 'appointments', id), patch as Record<string, unknown>)
    await batch.commit()
  }

  async updateAppointment(id: string, patch: Partial<Appointment>) {
    const cur = this.db.appointments.find((a) => a.id === id)
    if (!cur) throw new Error('Agendamento não encontrado.')
    const freeing = patch.status === 'cancelado' || patch.status === 'faltou'
    const moving = patch.date !== undefined || patch.start !== undefined || patch.proId !== undefined
    if (freeing) return this.releaseAndSet(id, cur, patch)
    if (moving) {
      const next = { ...cur, ...patch }
      await runTransaction(this.fs, async (tx) => {
        const newRefs = chunks(next.start, next.end).map((m) => doc(this.fs, 'slots', slotId(next.proId, next.date, m)))
        const snaps = await Promise.all(newRefs.map((r) => tx.get(r)))
        if (snaps.some((s) => s.exists() && (s.data() as SlotDoc).apptId !== id)) throw new BookingConflictError()
        chunks(cur.start, cur.end).forEach((m) => tx.delete(doc(this.fs, 'slots', slotId(cur.proId, cur.date, m))))
        const slotData: SlotDoc = { apptId: id, proId: next.proId, date: next.date, start: next.start, end: next.end }
        newRefs.forEach((r) => tx.set(r, slotData))
        tx.update(doc(this.fs, 'appointments', id), patch as Record<string, unknown>)
      })
      return
    }
    await updateDoc(doc(this.fs, 'appointments', id), patch as Record<string, unknown>)
    this.refreshPublicStats()
  }

  /** Atualiza o resumo exibido no site (chamado pela equipe ao concluir atendimentos). */
  async refreshPublicStats() {
    const stats = analyticsForStats(this.db)
    await setDoc(doc(this.fs, 'stats', 'public'), stats).catch(() => undefined)
  }

  async saveService(service: Service) {
    const { id, ...data } = service
    await setDoc(doc(this.fs, 'services', id), data)
  }

  async savePro(pro: Professional) {
    const { id, ...data } = pro
    await setDoc(doc(this.fs, 'pros', id), data)
  }

  async markClientContacted(clientId: string) {
    await updateDoc(doc(this.fs, 'clients', clientId), { lastContactAt: new Date().toISOString() })
  }

  currentUser() {
    return this.user
  }

  async login(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password)
      const snap = await getDoc(doc(this.fs, 'users', cred.user.uid))
      if (!snap.exists() || !(snap.data() as StaffUser).active) {
        await signOut(this.auth)
        throw new Error('Usuário sem acesso ao painel.')
      }
      await updateDoc(doc(this.fs, 'users', cred.user.uid), { lastLoginAt: new Date().toISOString() })
      this.user = { id: snap.id, ...snap.data() } as StaffUser
      return this.user
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Usuário')) throw e
      throw new Error('E-mail ou senha incorretos.')
    }
  }

  async logout() {
    await signOut(this.auth)
  }

  async createUser(input: NewUserInput) {
    // App secundário: cria a conta sem derrubar a sessão da administradora
    const secondary = initializeApp(config, 'secondary-' + uid())
    const secAuth = getAuth(secondary)
    const cred = await createUserWithEmailAndPassword(secAuth, input.email.trim(), input.password)
    await signOut(secAuth)
    const user: StaffUser = {
      id: cred.user.uid,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      active: true,
      createdAt: new Date().toISOString(),
      ...(input.role === 'profissional' && input.proId ? { proId: input.proId } : {}),
    }
    const { id, ...data } = user
    await setDoc(doc(this.fs, 'users', id), data)
    return user
  }

  async updateUser(id: string, patch: Partial<Omit<StaffUser, 'id'>>) {
    await updateDoc(doc(this.fs, 'users', id), patch as Record<string, unknown>)
  }

  /** No Firebase a troca de senha de outra pessoa é feita por e-mail de redefinição. */
  async setPassword(id: string) {
    const u = this.db.users.find((x) => x.id === id)
    if (!u) throw new Error('Usuário não encontrado.')
    await sendPasswordResetEmail(this.auth, u.email)
  }

  /** Remove o acesso (o perfil é apagado; a conta de login fica sem permissão alguma). */
  async deleteUser(id: string) {
    if (id === this.user?.id) throw new Error('Você não pode excluir o próprio usuário.')
    const batch = writeBatch(this.fs)
    batch.delete(doc(this.fs, 'users', id))
    await batch.commit()
  }
}

function safeLocal(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key)
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* armazenamento bloqueado */
  }
  return null
}
