import type { ReactNode } from 'react'
import { Badge, cx } from '../../components/ui'
import type { Appointment } from '../../lib/types'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-none md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-mauve">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white p-1 shadow-soft ring-1 ring-line/60">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
            o.value === value ? 'bg-wine text-white' : 'text-mauve hover:text-wine',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const STATUS_META: Record<Appointment['status'], { label: string; tone: 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' }> = {
  agendado: { label: 'Agendado', tone: 'warn' },
  confirmado: { label: 'Confirmado', tone: 'neutral' },
  concluido: { label: 'Concluído', tone: 'ok' },
  cancelado: { label: 'Cancelado', tone: 'bad' },
  faltou: { label: 'Faltou', tone: 'bad' },
}

export const PAY_LABEL = { pix: 'Pix', cartao: 'Cartão', local: 'No local' } as const
export const PAY_STATUS = {
  pendente: { label: 'A receber', tone: 'warn' },
  em_analise: { label: 'Pix a conferir', tone: 'brand' },
  pago: { label: 'Pago', tone: 'ok' },
  reembolsado: { label: 'Reembolsado', tone: 'neutral' },
} as const

export function StatusBadge({ status }: { status: Appointment['status'] }) {
  const m = STATUS_META[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function Kpi({
  label,
  value,
  delta,
  hint,
  invert,
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  invert?: boolean
}) {
  const good = delta == null ? null : invert ? delta < 0 : delta > 0
  return (
    <div className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-line/60 md:p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-mauve">{label}</p>
      <p className="mt-1.5 font-display text-3xl leading-tight text-wine md:text-[34px]">{value}</p>
      <p className="mt-1 text-xs">
        {delta != null && (
          <span className={cx('font-bold', good ? 'text-ok' : 'text-cherry-dark')}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(Math.round(delta * 100))}%
          </span>
        )}{' '}
        <span className="text-mauve">{hint}</span>
      </p>
    </div>
  )
}
