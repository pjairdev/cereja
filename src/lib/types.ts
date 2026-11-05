export type Role = 'admin' | 'recepcao' | 'profissional'

export interface Service {
  id: string
  name: string
  duration: number // minutos
  price: number // reais
  description: string
  active: boolean
}

export interface Professional {
  id: string
  name: string
  role: string
  tone: string
  bio: string
  serviceIds: string[]
  active: boolean
}

export interface Client {
  id: string
  name: string
  phone: string // só dígitos, com DDD
  createdAt: string
  lastContactAt?: string
}

export type AppointmentStatus = 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
export type PaymentMethod = 'pix' | 'cartao' | 'local'
export type PaymentStatus = 'pendente' | 'em_analise' | 'pago' | 'reembolsado'

export interface Appointment {
  id: string
  clientId: string
  clientName: string
  clientPhone: string
  serviceId: string
  proId: string
  date: string // YYYY-MM-DD no fuso do salão
  start: number // minutos desde 00:00
  end: number
  price: number
  status: AppointmentStatus
  payment: { method: PaymentMethod; status: PaymentStatus; paidAt?: string }
  source: 'site' | 'admin'
  notes?: string
  createdAt: string
}

export interface StaffUser {
  id: string
  name: string
  email: string
  role: Role
  proId?: string
  active: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface DB {
  services: Service[]
  pros: Professional[]
  clients: Client[]
  appointments: Appointment[]
  users: StaffUser[]
  /** Resumo público (modo Firebase): o site lê contagens sem acessar dados de clientes. */
  publicStats?: { serviceCounts: Record<string, number>; doneLast30: number; updatedAt: string }
}

export type NewAppointment = Omit<Appointment, 'id' | 'createdAt' | 'clientId' | 'end' | 'price'> & {
  clientId?: string
}
