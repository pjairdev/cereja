import { BUSINESS, addDays, nowInBusiness, weekdayOf } from '../lib/business'
import type { Appointment, Client, DB, PaymentMethod, Professional, Service, StaffUser } from '../lib/types'

export const SERVICES: Service[] = [
  { id: 'mao', name: 'Mão', duration: 40, price: 25, description: 'Cutilagem e esmaltação', active: true },
  { id: 'pe', name: 'Pé', duration: 45, price: 30, description: 'Cutilagem, lixa e esmaltação', active: true },
  { id: 'pe-mao', name: 'Pé e mão', duration: 80, price: 50, description: 'Os dois, com desconto', active: true },
  { id: 'gel', name: 'Esmaltação em gel', duration: 60, price: 70, description: 'Brilho que dura até 21 dias', active: true },
  { id: 'alongamento', name: 'Alongamento em fibra', duration: 150, price: 180, description: 'Formato e tamanho à sua escolha', active: true },
  { id: 'manutencao', name: 'Manutenção do alongamento', duration: 90, price: 100, description: 'A cada 20 a 25 dias', active: true },
  { id: 'nail-art', name: 'Nail art', duration: 30, price: 35, description: 'Marmorizado, francesinha, foil dourado', active: true },
  { id: 'spa-pes', name: 'Spa dos pés', duration: 50, price: 60, description: 'Esfoliação, hidratação e massagem', active: true },
]

export const PROS: Professional[] = [
  {
    id: 'p1',
    name: 'Jéssica',
    role: 'Manicure',
    tone: '#d8304a',
    bio: 'Cutilagem impecável e esmaltação que não descasca.',
    serviceIds: ['mao', 'pe', 'pe-mao', 'gel', 'nail-art'],
    active: true,
  },
  {
    id: 'p2',
    name: 'Priscila',
    role: 'Nail designer',
    tone: '#8a3ffc',
    bio: 'Alongamento, marmorizado e arte com foil.',
    serviceIds: ['mao', 'gel', 'alongamento', 'manutencao', 'nail-art'],
    active: true,
  },
  {
    id: 'p3',
    name: 'Dani',
    role: 'Manicure e pedicure',
    tone: '#0f8b8d',
    bio: 'Especialista em pés e no spa relaxante.',
    serviceIds: ['mao', 'pe', 'pe-mao', 'spa-pes', 'gel'],
    active: true,
  },
]

export const SEED_USERS: (StaffUser & { password: string })[] = [
  { id: 'u-admin', name: 'Renata Lima', email: 'admin@cereja.com', role: 'admin', active: true, createdAt: '', password: 'cereja123' },
  { id: 'u-rec', name: 'Bia Santos', email: 'recepcao@cereja.com', role: 'recepcao', active: true, createdAt: '', password: 'cereja123' },
  { id: 'u-p1', name: 'Jéssica', email: 'jessica@cereja.com', role: 'profissional', proId: 'p1', active: true, createdAt: '', password: 'cereja123' },
  { id: 'u-p2', name: 'Priscila', email: 'priscila@cereja.com', role: 'profissional', proId: 'p2', active: true, createdAt: '', password: 'cereja123' },
  { id: 'u-p3', name: 'Dani', email: 'dani@cereja.com', role: 'profissional', proId: 'p3', active: true, createdAt: '', password: 'cereja123' },
]

const FIRST = ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Joana', 'Karina', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Rafaela', 'Sabrina', 'Tatiane', 'Vanessa', 'Yasmin', 'Aline', 'Bruna', 'Carla', 'Débora', 'Elaine', 'Flávia', 'Giovana', 'Ingrid', 'Jaqueline', 'Luana', 'Michele', 'Nayara', 'Priscila', 'Roberta', 'Simone', 'Thaís', 'Viviane', 'Adriana', 'Cristiane', 'Juliana', 'Letícia', 'Manuela', 'Paula', 'Renata', 'Sueli', 'Taís', 'Lívia', 'Clara', 'Lorena', 'Maísa', 'Raquel', 'Sônia', 'Cíntia', 'Jamile', 'Kelly', 'Lúcia', 'Mirela', 'Rosana', 'Valéria', 'Iara']
const LAST = ['Souza', 'Oliveira', 'Santos', 'Lima', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Barbosa', 'Rocha', 'Pereira', 'Costa', 'Nascimento', 'Moreira', 'Cardoso', 'Teixeira', 'Araújo', 'Freitas', 'Pinto', 'Bispo']

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SERVICE_WEIGHT: Record<string, number> = {
  mao: 26, 'pe-mao': 22, gel: 17, pe: 11, manutencao: 9, alongamento: 5, 'nail-art': 6, 'spa-pes': 4,
}

export function buildSeed(): DB {
  const r = rng(20261105)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const now = nowInBusiness()
  const today = now.date
  const iso = new Date().toISOString()

  // Clientes: a maioria frequente, ~30% "sumidas" (pararam de vir há 50-110 dias)
  const clients: (Client & { from: number; until: number; weight: number })[] = FIRST.map((f, i) => {
    const gone = r() < 0.3
    const from = -120 + Math.floor(r() * 40)
    return {
      id: `c${i + 1}`,
      name: `${f} ${LAST[(i * 7) % LAST.length]}`,
      phone: `759${String(91000000 + Math.floor(r() * 8999999)).slice(0, 8)}`,
      createdAt: addDays(today, from) + 'T12:00:00.000Z',
      from,
      until: gone ? -50 - Math.floor(r() * 60) : 14,
      weight: 0.4 + r() * 1.6,
    }
  })

  const weightedService = (ids: string[]) => {
    const total = ids.reduce((s, id) => s + SERVICE_WEIGHT[id], 0)
    let x = r() * total
    for (const id of ids) {
      x -= SERVICE_WEIGHT[id]
      if (x <= 0) return id
    }
    return ids[0]
  }
  const pickClient = (offset: number) => {
    const pool = clients.filter((c) => offset >= c.from && offset <= c.until)
    const total = pool.reduce((s, c) => s + c.weight, 0)
    let x = r() * total
    for (const c of pool) {
      x -= c.weight
      if (x <= 0) return c
    }
    return pool[0]
  }
  const method = (): PaymentMethod => {
    const x = r()
    return x < 0.47 ? 'pix' : x < 0.8 ? 'cartao' : 'local'
  }

  const appointments: Appointment[] = []
  let n = 0
  for (let offset = -120; offset <= 12; offset++) {
    const date = addDays(today, offset)
    const hours = BUSINESS.hours[weekdayOf(date)]
    if (!hours) continue
    // movimento cresce levemente ao longo do tempo e é maior sexta/sábado
    const wd = weekdayOf(date)
    // futuro: agenda ainda enchendo (amanhã ~50%, daqui a 10 dias quase vazia)
    const base = (wd >= 5 ? 0.82 : 0.62) + offset * 0.0012
    const busy = offset > 0 ? base * 0.65 - offset * 0.05 : base
    for (const pro of PROS) {
      let t = hours[0] + pick([0, 0, 15, 30])
      while (t < hours[1]) {
        const serviceId = weightedService(pro.serviceIds)
        const svc = SERVICES.find((s) => s.id === serviceId)!
        if (t + svc.duration > hours[1]) break
        if (r() < busy) {
          const client = pickClient(offset)
          if (client) {
            const isPast = offset < 0 || (offset === 0 && t + svc.duration <= now.minutes)
            let status: Appointment['status']
            if (isPast) {
              const x = r()
              status = x < 0.89 ? 'concluido' : x < 0.94 ? 'faltou' : 'cancelado'
            } else {
              status = r() < 0.55 ? 'confirmado' : 'agendado'
            }
            const m = method()
            const roll = r()
            const paid = status === 'concluido' ? roll > 0.03 : m === 'pix' && roll < 0.55
            const checking = !isPast && m === 'pix' && !paid && roll < 0.6
            appointments.push({
              id: `a${++n}`,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone,
              serviceId,
              proId: pro.id,
              date,
              start: t,
              end: t + svc.duration,
              price: svc.price,
              status,
              payment: {
                method: m,
                status: paid ? 'pago' : checking ? 'em_analise' : 'pendente',
                paidAt: paid ? date + 'T12:00:00.000Z' : undefined,
              },
              source: r() < 0.7 ? 'site' : 'admin',
              createdAt: addDays(date, -Math.floor(r() * 6)) + 'T12:00:00.000Z',
            })
          }
          t += svc.duration + pick([0, 0, 0, 15, 15, 30])
        } else {
          t += pick([30, 45, 60])
        }
      }
    }
  }

  const cleanClients: Client[] = clients.map(({ from: _f, until: _u, weight: _w, ...c }) => c)

  return {
    services: SERVICES,
    pros: PROS,
    clients: cleanClients,
    appointments,
    users: SEED_USERS.map(({ password: _p, ...u }) => ({ ...u, createdAt: iso })),
  }
}
