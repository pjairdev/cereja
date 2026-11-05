import { addDays, nowInBusiness } from '../lib/business'
import type { DB } from '../lib/types'

/** Contagem pública: serviços concluídos nos últimos 30 dias (sem nenhum dado pessoal). */
export function analyticsForStats(db: DB): NonNullable<DB['publicStats']> {
  const today = nowInBusiness().date
  const from = addDays(today, -30)
  const serviceCounts: Record<string, number> = {}
  let doneLast30 = 0
  for (const a of db.appointments) {
    if (a.status === 'concluido' && a.date >= from && a.date <= today) {
      serviceCounts[a.serviceId] = (serviceCounts[a.serviceId] ?? 0) + 1
      doneLast30++
    }
  }
  return { serviceCounts, doneLast30, updatedAt: new Date().toISOString() }
}

export function publicStats(db: DB) {
  return db.publicStats ?? analyticsForStats(db)
}
