import { onlyDigits, uid } from '../lib/business'
import { sendCodeEmail } from '../lib/email'
import { OtpStore, normalizeEmail } from '../lib/otp'
import { availableSlots, isFree, pickPro } from '../lib/scheduling'
import type { Appointment, Client, ClientAccount, DB, Professional, Service, StaffUser } from '../lib/types'
import { BookingConflictError, LoginRequiredError, type BookingInput, type LoginRequest, type NewUserInput, type Repo } from './repo'
import { SEED_USERS, buildSeed } from './seed'

const DB_KEY = 'cereja.db.v1'
const AUTH_KEY = 'cereja.auth.v1'
const SESSION_KEY = 'cereja.session.v1'
const CLIENT_KEY = 'cereja.client.v1' // a cliente continua logada entre visitas

type Creds = Record<string, { salt: string; hash: string }> // por id de usuário

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}
function safeSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    /* modo privado ou armazenamento bloqueado: segue em memória */
  }
}

async function hash(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Implementação que roda inteira no navegador (localStorage).
 * Serve para demonstração e para validar o produto antes de ligar o Firebase.
 */
export class LocalRepo implements Repo {
  readonly kind = 'local' as const
  private db!: DB
  private creds: Creds = {}
  private listeners = new Set<() => void>()
  private sessionUserId: string | null = null
  private clientId: string | null = null
  private otp = new OtpStore()
  private accountCache: { src: Client; acc: ClientAccount } | null = null

  async init() {
    const raw = safeGet(() => localStorage, DB_KEY)
    const rawCreds = safeGet(() => localStorage, AUTH_KEY)
    if (raw && rawCreds) {
      try {
        this.db = JSON.parse(raw)
        this.creds = JSON.parse(rawCreds)
      } catch {
        await this.seed()
      }
    } else {
      await this.seed()
    }
    this.sessionUserId = safeGet(() => sessionStorage, SESSION_KEY)
    this.clientId = safeGet(() => localStorage, CLIENT_KEY)
    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEY && e.newValue) {
        this.db = JSON.parse(e.newValue)
        this.emit()
      }
    })
  }

  private async seed() {
    this.db = buildSeed()
    this.creds = {}
    for (const u of SEED_USERS) {
      const salt = uid()
      this.creds[u.id] = { salt, hash: await hash(u.password, salt) }
    }
    this.persist()
  }

  private persist() {
    safeSet(() => localStorage, DB_KEY, JSON.stringify(this.db))
    safeSet(() => localStorage, AUTH_KEY, JSON.stringify(this.creds))
  }

  private commit(mutator: (db: DB) => DB) {
    this.db = mutator(this.db)
    this.persist()
    this.emit()
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

  // ---------- Conta da cliente ----------

  currentClient(): ClientAccount | null {
    const c = this.db.clients.find((x) => x.id === this.clientId)
    if (!c || !c.email) return null
    if (this.accountCache?.src !== c) {
      this.accountCache = {
        src: c,
        acc: { id: c.id, email: c.email, name: c.name, phone: c.phone, verifiedAt: c.emailVerifiedAt ?? c.createdAt },
      }
    }
    return this.accountCache.acc
  }

  async requestClientLogin(email: string): Promise<LoginRequest> {
    const code = await this.otp.issue(email)
    const sent = await sendCodeEmail(normalizeEmail(email), code)
    return { method: 'code', sent, demoCode: sent ? undefined : code }
  }

  async verifyClientCode(email: string, code: string): Promise<ClientAccount> {
    await this.otp.verify(email, code)
    const key = normalizeEmail(email)
    const now = new Date().toISOString()
    let c = this.db.clients.find((x) => x.email === key)
    if (c) {
      const verified = { ...c, emailVerifiedAt: now }
      this.commit((db) => ({ ...db, clients: db.clients.map((x) => (x.id === verified.id ? verified : x)) }))
      c = verified
    } else {
      c = { id: uid('c'), name: '', phone: '', email: key, emailVerifiedAt: now, createdAt: now }
      const created = c
      this.commit((db) => ({ ...db, clients: [...db.clients, created] }))
    }
    this.setClientSession(c.id)
    return this.currentClient()!
  }

  pendingEmailLink() {
    return false
  }

  async completeEmailLink(): Promise<ClientAccount> {
    throw new Error('No modo local o login é feito por código.')
  }

  async saveClientProfile(profile: { name: string; phone: string }): Promise<ClientAccount> {
    const me = this.currentClient()
    if (!me) throw new LoginRequiredError()
    const name = profile.name.trim()
    const phone = onlyDigits(profile.phone)
    if (name.length < 2) throw new Error('Informe seu nome.')
    if (phone.length < 10) throw new Error('Informe um WhatsApp válido com DDD.')

    // Se esse WhatsApp já tem histórico no salão (cadastro feito no balcão), une as duas fichas.
    const history = this.db.clients.find((c) => c.id !== me.id && !c.email && onlyDigits(c.phone) === phone)
    const mineHasAppts = this.db.appointments.some((a) => a.clientId === me.id)
    if (history && !mineHasAppts) {
      const merged: Client = { ...history, name, email: me.email, emailVerifiedAt: me.verifiedAt }
      this.commit((db) => ({
        ...db,
        clients: db.clients.filter((c) => c.id !== me.id).map((c) => (c.id === history.id ? merged : c)),
      }))
      this.setClientSession(history.id)
    } else {
      this.commit((db) => ({ ...db, clients: db.clients.map((c) => (c.id === me.id ? { ...c, name, phone } : c)) }))
    }
    return this.currentClient()!
  }

  async logoutClient() {
    this.setClientSession(null)
  }

  private setClientSession(id: string | null) {
    this.clientId = id
    safeSet(() => localStorage, CLIENT_KEY, id)
    this.emit()
  }

  // ---------- Agendamento ----------

  async book(input: BookingInput): Promise<Appointment> {
    const account = this.currentClient()
    if (input.source === 'site' && !account) throw new LoginRequiredError()
    const service = this.db.services.find((s) => s.id === input.serviceId && s.active)
    if (!service) throw new Error('Serviço indisponível.')
    const phone = onlyDigits(input.phone)
    if (phone.length < 10) throw new Error('Informe um WhatsApp válido com DDD.')
    if (input.name.trim().length < 2) throw new Error('Informe seu nome.')

    // Revalida no momento de gravar: protege contra duas pessoas no mesmo horário.
    const slot = availableSlots({
      date: input.date,
      service,
      pros: this.db.pros,
      proId: input.proId,
      appointments: this.db.appointments,
    }).find((s) => s.start === input.start)
    if (!slot) throw new BookingConflictError()
    const proId = input.proId === 'any' ? pickPro(slot.proIds, this.db.appointments, input.date) : input.proId
    if (!isFree(this.db.appointments, proId, input.date, slot.start, slot.end)) throw new BookingConflictError()

    const now = new Date().toISOString()
    let client: Client | undefined
    let newClient: Client | null = null
    if (input.source === 'site' && account) {
      client = this.db.clients.find((c) => c.id === account.id)!
    } else {
      // agendamento feito pela equipe: procura a ficha pelo WhatsApp
      client = this.db.clients.find((c) => onlyDigits(c.phone) === phone)
      if (!client) client = newClient = { id: uid('c'), name: input.name.trim(), phone, createdAt: now }
    }

    const appt: Appointment = {
      id: uid('a'),
      clientId: client.id,
      clientName: input.name.trim(),
      clientPhone: phone,
      ...(input.source === 'site' && account ? { clientEmail: account.email, clientUid: account.id } : {}),
      serviceId: service.id,
      proId,
      date: input.date,
      start: slot.start,
      end: slot.end,
      price: service.price,
      status: input.source === 'admin' ? 'confirmado' : 'agendado',
      payment: {
        method: input.paymentMethod,
        status: 'pendente',
      },
      source: input.source,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
    }
    this.commit((db) => ({
      ...db,
      clients: newClient ? [...db.clients, newClient] : db.clients,
      appointments: [...db.appointments, appt],
    }))
    return appt
  }

  async myAppointments() {
    const me = this.currentClient()
    if (!me) return []
    return this.db.appointments.filter((a) => a.clientId === me.id)
  }

  async cancelMine(id: string) {
    const me = this.currentClient()
    const a = this.db.appointments.find((x) => x.id === id)
    if (!me || !a || a.clientId !== me.id) throw new Error('Agendamento não encontrado.')
    await this.updateAppointment(id, { status: 'cancelado' })
  }

  async confirmPixSent(id: string) {
    const a = this.db.appointments.find((x) => x.id === id)
    if (!a) return
    await this.updateAppointment(id, { payment: { ...a.payment, status: 'em_analise' } })
  }

  async updateAppointment(id: string, patch: Partial<Appointment>) {
    const cur = this.db.appointments.find((a) => a.id === id)
    if (!cur) throw new Error('Agendamento não encontrado.')
    const next = { ...cur, ...patch }
    const timeChanged =
      patch.date !== undefined || patch.start !== undefined || patch.end !== undefined || patch.proId !== undefined
    if (timeChanged && !isFree(this.db.appointments, next.proId, next.date, next.start, next.end, id)) {
      throw new BookingConflictError()
    }
    this.commit((db) => ({ ...db, appointments: db.appointments.map((a) => (a.id === id ? next : a)) }))
  }

  async saveService(service: Service) {
    this.commit((db) => ({
      ...db,
      services: db.services.some((s) => s.id === service.id)
        ? db.services.map((s) => (s.id === service.id ? service : s))
        : [...db.services, service],
    }))
  }

  async savePro(pro: Professional) {
    this.commit((db) => ({ ...db, pros: db.pros.map((p) => (p.id === pro.id ? pro : p)) }))
  }

  async markClientContacted(clientId: string) {
    const at = new Date().toISOString()
    this.commit((db) => ({
      ...db,
      clients: db.clients.map((c) => (c.id === clientId ? { ...c, lastContactAt: at } : c)),
    }))
  }

  currentUser(): StaffUser | null {
    const u = this.db.users.find((x) => x.id === this.sessionUserId)
    return u && u.active ? u : null
  }

  async login(email: string, password: string) {
    const u = this.db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    const c = u && this.creds[u.id]
    if (!u || !c || (await hash(password, c.salt)) !== c.hash) throw new Error('E-mail ou senha incorretos.')
    if (!u.active) throw new Error('Usuário desativado. Fale com a administradora.')
    this.sessionUserId = u.id
    safeSet(() => sessionStorage, SESSION_KEY, u.id)
    await this.updateUser(u.id, { lastLoginAt: new Date().toISOString() })
    return this.currentUser()!
  }

  async logout() {
    this.sessionUserId = null
    safeSet(() => sessionStorage, SESSION_KEY, null)
    this.emit()
  }

  async createUser(input: NewUserInput) {
    const email = input.email.trim().toLowerCase()
    if (this.db.users.some((u) => u.email.toLowerCase() === email)) throw new Error('Já existe um usuário com esse e-mail.')
    if (input.password.length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.')
    const user: StaffUser = {
      id: uid('u'),
      name: input.name.trim(),
      email,
      role: input.role,
      proId: input.role === 'profissional' ? input.proId : undefined,
      active: true,
      createdAt: new Date().toISOString(),
    }
    const salt = uid()
    this.creds[user.id] = { salt, hash: await hash(input.password, salt) }
    this.commit((db) => ({ ...db, users: [...db.users, user] }))
    return user
  }

  async updateUser(id: string, patch: Partial<Omit<StaffUser, 'id'>>) {
    this.guardLastAdmin(id, patch)
    this.commit((db) => ({ ...db, users: db.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
  }

  async setPassword(id: string, password: string) {
    if (password.length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.')
    const salt = uid()
    this.creds[id] = { salt, hash: await hash(password, salt) }
    this.persist()
  }

  async deleteUser(id: string) {
    if (id === this.sessionUserId) throw new Error('Você não pode excluir o próprio usuário.')
    this.guardLastAdmin(id, { active: false })
    delete this.creds[id]
    this.commit((db) => ({ ...db, users: db.users.filter((u) => u.id !== id) }))
  }

  private guardLastAdmin(id: string, patch: Partial<StaffUser>) {
    const target = this.db.users.find((u) => u.id === id)
    if (!target || target.role !== 'admin') return
    const losesAdmin = patch.active === false || (patch.role && patch.role !== 'admin')
    const otherAdmins = this.db.users.filter((u) => u.id !== id && u.role === 'admin' && u.active)
    if (losesAdmin && otherAdmins.length === 0) throw new Error('É preciso manter ao menos uma administradora ativa.')
  }

  async resetDemo() {
    this.clientId = null
    safeSet(() => localStorage, CLIENT_KEY, null)
    await this.seed()
    this.emit()
  }
}
