import type { Appointment, ClientAccount, DB, PaymentMethod, Professional, Role, Service, StaffUser } from '../lib/types'

export interface BookingInput {
  serviceId: string
  proId: string | 'any'
  date: string
  start: number
  name: string
  phone: string
  paymentMethod: PaymentMethod
  notes?: string
  source: 'site' | 'admin'
}

export interface NewUserInput {
  name: string
  email: string
  role: Role
  proId?: string
  password: string
}

/** Resultado do pedido de login da cliente. */
export interface LoginRequest {
  /** 'code' = digitar o código de 6 dígitos; 'link' = abrir o link recebido no e-mail */
  method: 'code' | 'link'
  /** true quando um e-mail de verdade foi enviado */
  sent: boolean
  /** Só no modo demonstração (sem envio configurado): o código, para mostrar na tela */
  demoCode?: string
}

/** Contrato único de dados. A interface não sabe se está falando com o navegador ou com o Firebase. */
export interface Repo {
  readonly kind: 'local' | 'firebase'
  init(): Promise<void>
  getDB(): DB
  subscribe(fn: () => void): () => void

  // Conta da cliente (login por e-mail verificado)
  currentClient(): ClientAccount | null
  requestClientLogin(email: string): Promise<LoginRequest>
  verifyClientCode(email: string, code: string): Promise<ClientAccount>
  /** Firebase: quando o link foi aberto em outro aparelho e o e-mail precisa ser confirmado */
  pendingEmailLink(): boolean
  completeEmailLink(email: string): Promise<ClientAccount>
  saveClientProfile(profile: { name: string; phone: string }): Promise<ClientAccount>
  logoutClient(): Promise<void>

  // Agendamento (exige cliente logada, ou equipe com source 'admin')
  book(input: BookingInput): Promise<Appointment>
  myAppointments(): Promise<Appointment[]>
  cancelMine(id: string): Promise<void>
  confirmPixSent(id: string): Promise<void>

  // Equipe
  updateAppointment(id: string, patch: Partial<Appointment>): Promise<void>
  saveService(service: Service): Promise<void>
  savePro(pro: Professional): Promise<void>
  markClientContacted(clientId: string): Promise<void>

  // Autenticação e usuários da equipe
  currentUser(): StaffUser | null
  login(email: string, password: string): Promise<StaffUser>
  logout(): Promise<void>
  createUser(input: NewUserInput): Promise<StaffUser>
  updateUser(id: string, patch: Partial<Omit<StaffUser, 'id'>>): Promise<void>
  setPassword(id: string, password: string): Promise<void>
  deleteUser(id: string): Promise<void>
  resetDemo?(): Promise<void>
}

export class BookingConflictError extends Error {
  constructor() {
    super('Esse horário acabou de ser reservado. Escolha outro, por favor.')
  }
}

export class LoginRequiredError extends Error {
  constructor() {
    super('Entre com seu e-mail para agendar.')
  }
}
