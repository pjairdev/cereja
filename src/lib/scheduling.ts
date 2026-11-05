import { BUSINESS, addDays, nowInBusiness, weekdayOf } from './business'
import type { Appointment, Professional, Service } from './types'

export const BLOCKING: Appointment['status'][] = ['agendado', 'confirmado', 'concluido']

export interface Slot {
  start: number
  end: number
  proIds: string[]
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

export function prosForService(pros: Professional[], serviceId: string) {
  return pros.filter((p) => p.active && p.serviceIds.includes(serviceId))
}

/** Verdadeiro se a profissional está livre no intervalo (ignora o próprio agendamento ao remarcar). */
export function isFree(
  appointments: Appointment[],
  proId: string,
  date: string,
  start: number,
  end: number,
  ignoreId?: string,
) {
  return !appointments.some(
    (a) =>
      a.id !== ignoreId &&
      a.proId === proId &&
      a.date === date &&
      BLOCKING.includes(a.status) &&
      overlaps(start, end, a.start, a.end),
  )
}

/**
 * Horários reais disponíveis para um serviço numa data.
 * Considera expediente, duração do serviço, agenda de cada profissional,
 * antecedência mínima e o horário atual (no fuso do salão).
 */
export function availableSlots(params: {
  date: string
  service: Service
  pros: Professional[]
  proId: string | 'any'
  appointments: Appointment[]
  now?: { date: string; minutes: number }
}): Slot[] {
  const { date, service, appointments } = params
  const now = params.now ?? nowInBusiness()
  const hours = BUSINESS.hours[weekdayOf(date)]
  if (!hours) return []
  if (date < now.date) return []
  if (date > addDays(now.date, BUSINESS.bookingWindowDays)) return []

  const candidates = prosForService(params.pros, service.id).filter(
    (p) => params.proId === 'any' || p.id === params.proId,
  )
  if (!candidates.length) return []

  const step = BUSINESS.slotStep
  let first = hours[0]
  if (date === now.date) {
    const min = now.minutes + BUSINESS.bookingLeadMinutes
    first = Math.max(first, Math.ceil(min / step) * step)
  }

  const slots: Slot[] = []
  for (let start = first; start + service.duration <= hours[1]; start += step) {
    const end = start + service.duration
    const free = candidates.filter((p) => isFree(appointments, p.id, date, start, end)).map((p) => p.id)
    if (free.length) slots.push({ start, end, proIds: free })
  }
  return slots
}

/** Escolhe a profissional menos ocupada no dia entre as livres (distribui a demanda). */
export function pickPro(proIds: string[], appointments: Appointment[], date: string): string {
  const load = (id: string) =>
    appointments
      .filter((a) => a.proId === id && a.date === date && BLOCKING.includes(a.status))
      .reduce((s, a) => s + (a.end - a.start), 0)
  return [...proIds].sort((a, b) => load(a) - load(b))[0]
}

/** Próximas datas com expediente, para a régua de dias do agendamento. */
export function bookableDates(from: string, count: number): string[] {
  const out: string[] = []
  for (let i = 0; out.length < count && i <= BUSINESS.bookingWindowDays; i++) {
    const d = addDays(from, i)
    if (BUSINESS.hours[weekdayOf(d)]) out.push(d)
  }
  return out
}

/** Primeiro horário livre de hoje para uma profissional (para os cards da equipe). */
export function nextFreeToday(
  pro: Professional,
  services: Service[],
  appointments: Appointment[],
  now = nowInBusiness(),
): number | null {
  const shortest = services
    .filter((s) => s.active && pro.serviceIds.includes(s.id))
    .sort((a, b) => a.duration - b.duration)[0]
  if (!shortest) return null
  const slots = availableSlots({
    date: now.date,
    service: shortest,
    pros: [pro],
    proId: pro.id,
    appointments,
    now,
  })
  return slots[0]?.start ?? null
}
