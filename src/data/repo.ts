import type { Appointment, DB, PaymentMethod, Professional, Role, Service, StaffUser } from '../lib/types'

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

/** Contrato único de dados. A interface não sabe se está falando com o navegador ou com o Firebase. */
export interface Repo {
  readonly kind: 'local' | 'firebase'
  init(): Promise<void>
  getDB(): DB
  subscribe(fn: () => void): () => void

  // Público
  book(input: BookingInput): Promise<Appointment>
  findByPhone(phone: string): Promise<Appointment[]>
  cancelByClient(id: string, phone: string): Promise<void>
  confirmPixSent(id: string): Promise<void>

  // Equipe
  updateAppointment(id: string, patch: Partial<Appointment>): Promise<void>
  saveService(service: Service): Promise<void>
  savePro(pro: Professional): Promise<void>
  markClientContacted(clientId: string): Promise<void>

  // Autenticação e usuários
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
