import { describe, expect, it } from 'vitest'
import { pixPayload, crc16 } from './pix'
import { availableSlots } from './scheduling'
import { openStatus } from './business'
import { SERVICES, PROS, buildSeed } from '../data/seed'
import type { Appointment } from './types'

describe('Pix BR Code', () => {
  it('reproduz o exemplo oficial do Banco Central', () => {
    const p = pixPayload({
      key: '123e4567-e12b-12d1-a456-426655440000',
      name: 'Fulano de Tal',
      city: 'BRASILIA',
    })
    expect(p).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })
  it('inclui valor e confere o CRC', () => {
    const p = pixPayload({ key: 'a@b.com', name: 'Cereja', city: 'Santo Amaro', amount: 50, txid: 'ABC123' })
    expect(p).toContain('540550.00')
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4))
  })
})

describe('agenda', () => {
  const mao = SERVICES.find((s) => s.id === 'mao')!
  const along = SERVICES.find((s) => s.id === 'alongamento')!
  const now = { date: '2026-11-02', minutes: 7 * 60 } // segunda, antes de abrir

  it('não oferece horários no domingo', () => {
    expect(availableSlots({ date: '2026-11-08', service: mao, pros: PROS, proId: 'any', appointments: [], now })).toEqual([])
  })

  it('respeita duração e fechamento', () => {
    const slots = availableSlots({ date: '2026-11-02', service: along, pros: PROS, proId: 'p2', appointments: [], now })
    expect(slots[0].start).toBe(9 * 60)
    expect(slots.at(-1)!.end).toBeLessThanOrEqual(19 * 60)
  })

  it('bloqueia conflitos e libera cancelados', () => {
    const base: Appointment = {
      id: 'x', clientId: 'c', clientName: 'A', clientPhone: '75999999999', serviceId: 'mao', proId: 'p2',
      date: '2026-11-02', start: 600, end: 640, price: 25, status: 'agendado',
      payment: { method: 'pix', status: 'pendente' }, source: 'site', createdAt: '',
    }
    const busy = availableSlots({ date: '2026-11-02', service: mao, pros: PROS, proId: 'p2', appointments: [base], now })
    expect(busy.some((s) => s.start < 640 && s.end > 600)).toBe(false)
    const freed = availableSlots({
      date: '2026-11-02', service: mao, pros: PROS, proId: 'p2',
      appointments: [{ ...base, status: 'cancelado' }], now,
    })
    expect(freed.some((s) => s.start === 600)).toBe(true)
  })

  it('aplica antecedência mínima no dia de hoje', () => {
    const slots = availableSlots({
      date: '2026-11-02', service: mao, pros: PROS, proId: 'any', appointments: [],
      now: { date: '2026-11-02', minutes: 10 * 60 + 5 },
    })
    expect(slots[0].start).toBe(10 * 60 + 45)
  })
})

describe('status do salão', () => {
  it('aberto e fechado', () => {
    expect(openStatus({ date: '2026-11-02', minutes: 10 * 60, weekday: 1 }).open).toBe(true)
    const sun = openStatus({ date: '2026-11-08', minutes: 10 * 60, weekday: 0 })
    expect(sun.open).toBe(false)
    expect(sun.detail).toBe('Abre amanhã às 09:00')
  })
})

describe('seed', () => {
  it('não tem sobreposição para a mesma profissional', () => {
    const db = buildSeed()
    const active = db.appointments.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou')
    for (const a of active) {
      const clash = active.find((b) => b !== a && b.proId === a.proId && b.date === a.date && a.start < b.end && b.start < a.end)
      expect(clash).toBeUndefined()
    }
    expect(db.appointments.length).toBeGreaterThan(500)
  })
})
