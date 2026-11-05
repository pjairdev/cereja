// Dados fixos do estabelecimento. Para outra empresa, troque este arquivo e o seed.
export const BUSINESS = {
  name: 'Cereja Esmalteria',
  tagline: 'Unhas prontas sem fila',
  address: 'Rua Sales Barbosa, 88 · Centro',
  city: 'Santo Amaro · BA',
  mapsQuery: 'Rua Sales Barbosa, 88, Centro, Santo Amaro - BA',
  whatsapp: '5575999990003',
  instagram: 'cerejaesmalteria',
  timeZone: 'America/Bahia',
  // índice 0 = domingo. [abre, fecha] em minutos desde 00:00; null = fechado
  hours: [
    null,
    [9 * 60, 19 * 60],
    [9 * 60, 19 * 60],
    [9 * 60, 19 * 60],
    [9 * 60, 19 * 60],
    [9 * 60, 20 * 60],
    [8 * 60, 16 * 60],
  ] as ([number, number] | null)[],
  bookingLeadMinutes: 30, // antecedência mínima para agendar hoje
  bookingWindowDays: 30, // até quantos dias à frente
  slotStep: 15,
  inactiveDays: 45, // cliente "sumida" a partir de quantos dias sem vir
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Data e hora atuais no fuso do salão, independente do fuso do visitante. */
export function nowInBusiness(d = new Date()): { date: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const hour = Number(get('hour')) % 24
  return { date, minutes: hour * 60 + Number(get('minute')), weekday: weekdayOf(date) }
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000)
}

export function hm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function brl(v: number, cents = true): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
}

export function fmtDate(date: string, opts: { weekday?: boolean } = {}): string {
  const [, m, d] = date.split('-').map(Number)
  const base = `${d} ${MONTHS_SHORT[m - 1]}`
  return opts.weekday ? `${WEEKDAYS_SHORT[weekdayOf(date)]}, ${base}` : base
}

export function duration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export interface OpenStatus {
  open: boolean
  label: string
  detail: string
}

/** Calcula se está aberto agora e quando muda. */
export function openStatus(now = nowInBusiness()): OpenStatus {
  const today = BUSINESS.hours[now.weekday]
  if (today && now.minutes >= today[0] && now.minutes < today[1]) {
    const left = today[1] - now.minutes
    const detail =
      left <= 60 ? `Fecha em ${left} min` : `Fecha às ${hm(today[1])}`
    return { open: true, label: 'Aberto agora', detail }
  }
  if (today && now.minutes < today[0]) {
    return { open: false, label: 'Fechado', detail: `Abre hoje às ${hm(today[0])}` }
  }
  for (let i = 1; i <= 7; i++) {
    const wd = (now.weekday + i) % 7
    const h = BUSINESS.hours[wd]
    if (h) {
      const when = i === 1 ? 'amanhã' : WEEKDAYS[wd].toLowerCase()
      return { open: false, label: 'Fechado', detail: `Abre ${when} às ${hm(h[0])}` }
    }
  }
  return { open: false, label: 'Fechado', detail: '' }
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export function fmtPhone(digits: string): string {
  const d = onlyDigits(digits).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export function whatsappLink(phoneDigits: string, text: string): string {
  let d = onlyDigits(phoneDigits)
  if (d.length <= 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

export function uid(prefix = ''): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return prefix + r
}
