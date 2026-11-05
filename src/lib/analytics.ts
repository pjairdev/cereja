import { BUSINESS, addDays, daysBetween } from './business'
import type { Appointment, Client, DB } from './types'

export const isDone = (a: Appointment) => a.status === 'concluido'
export const isUpcoming = (a: Appointment, today: string, nowMin: number) =>
  (a.status === 'agendado' || a.status === 'confirmado') &&
  (a.date > today || (a.date === today && a.end > nowMin))

export function inRange(a: Appointment, from: string, to: string) {
  return a.date >= from && a.date <= to
}

export interface Kpis {
  revenue: number
  done: number
  ticket: number
  noShowRate: number
  cancelRate: number
  pendingPayments: number
  booked: number
}

export function kpis(list: Appointment[]): Kpis {
  const done = list.filter(isDone)
  const revenue = done.reduce((s, a) => s + a.price, 0)
  const settled = list.filter((a) => a.status === 'concluido' || a.status === 'faltou')
  const noShows = list.filter((a) => a.status === 'faltou').length
  const cancels = list.filter((a) => a.status === 'cancelado').length
  return {
    revenue,
    done: done.length,
    ticket: done.length ? revenue / done.length : 0,
    noShowRate: settled.length ? noShows / settled.length : 0,
    cancelRate: list.length ? cancels / list.length : 0,
    pendingPayments: done.filter((a) => a.payment.status !== 'pago').reduce((s, a) => s + a.price, 0),
    booked: list.length,
  }
}

export function delta(cur: number, prev: number): number | null {
  if (!prev) return null
  return (cur - prev) / prev
}

/** Faturamento e atendimentos dia a dia (agrupa por semana em períodos longos). */
export function revenueSeries(list: Appointment[], from: string, to: string) {
  const days = daysBetween(from, to) + 1
  const bucket = days > 45 ? 7 : 1
  const out: { label: string; date: string; revenue: number; count: number }[] = []
  for (let i = 0; i < days; i += bucket) {
    const start = addDays(from, i)
    const end = addDays(from, Math.min(i + bucket - 1, days - 1))
    const items = list.filter((a) => isDone(a) && a.date >= start && a.date <= end)
    const [, m, d] = start.split('-')
    out.push({
      label: `${d}/${m}`,
      date: start,
      revenue: items.reduce((s, a) => s + a.price, 0),
      count: items.length,
    })
  }
  return out
}

export function topServices(db: DB, list: Appointment[]) {
  const map = new Map<string, { count: number; revenue: number }>()
  for (const a of list.filter(isDone)) {
    const m = map.get(a.serviceId) ?? { count: 0, revenue: 0 }
    m.count++
    m.revenue += a.price
    map.set(a.serviceId, m)
  }
  return db.services
    .map((s) => ({ service: s, ...(map.get(s.id) ?? { count: 0, revenue: 0 }) }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
}

export function byPro(db: DB, list: Appointment[]) {
  return db.pros.map((p) => {
    const items = list.filter((a) => a.proId === p.id && isDone(a))
    return { pro: p, count: items.length, revenue: items.reduce((s, a) => s + a.price, 0) }
  })
}

export function paymentMix(list: Appointment[]) {
  const done = list.filter(isDone)
  const labels = { pix: 'Pix', cartao: 'Cartão', local: 'No local' } as const
  return (Object.keys(labels) as (keyof typeof labels)[]).map((k) => {
    const items = done.filter((a) => a.payment.method === k)
    return { method: k, label: labels[k], count: items.length, revenue: items.reduce((s, a) => s + a.price, 0) }
  })
}

export interface ClientStats {
  client: Client
  visits: number
  spent: number
  lastVisit: string | null
  daysAway: number | null
  favoriteServiceId: string | null
  hasUpcoming: boolean
}

export function clientStats(db: DB, today: string, nowMin: number): ClientStats[] {
  const byClient = new Map<string, Appointment[]>()
  for (const a of db.appointments) {
    const arr = byClient.get(a.clientId) ?? []
    arr.push(a)
    byClient.set(a.clientId, arr)
  }
  return db.clients.map((c) => {
    const list = byClient.get(c.id) ?? []
    const done = list.filter(isDone).sort((a, b) => (a.date < b.date ? 1 : -1))
    const fav = new Map<string, number>()
    done.forEach((a) => fav.set(a.serviceId, (fav.get(a.serviceId) ?? 0) + 1))
    const favoriteServiceId = [...fav.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const lastVisit = done[0]?.date ?? null
    return {
      client: c,
      visits: done.length,
      spent: done.reduce((s, a) => s + a.price, 0),
      lastVisit,
      daysAway: lastVisit ? daysBetween(lastVisit, today) : null,
      favoriteServiceId,
      hasUpcoming: list.some((a) => isUpcoming(a, today, nowMin)),
    }
  })
}

/** Clientes que já vieram, não voltam há N dias e não têm horário marcado. */
export function inactiveClients(stats: ClientStats[], days = BUSINESS.inactiveDays) {
  return stats
    .filter((s) => s.visits > 0 && !s.hasUpcoming && (s.daysAway ?? 0) >= days)
    .sort((a, b) => b.spent - a.spent)
}
