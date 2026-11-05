import { ChevronLeft, ChevronRight, MessageCircle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookingModal } from '../../components/Booking'
import { Badge, Button, Card, Empty, Modal, cx, useConfirm, useToast } from '../../components/ui'
import { BUSINESS, addDays, brl, duration, fmtDate, fmtPhone, hm, nowInBusiness, weekdayOf, whatsappLink, WEEKDAYS } from '../../lib/business'
import { isUpcoming } from '../../lib/analytics'
import type { Appointment } from '../../lib/types'
import { can, useCurrentUser, useDB, useMinuteTick, useRepo } from '../../data/store'
import { PAY_LABEL, PAY_STATUS, PageHeader, Segmented, StatusBadge } from './shared'

const PX = 1.3 // pixels por minuto na linha do tempo

export default function Agenda() {
  useMinuteTick()
  const db = useDB()
  const user = useCurrentUser()!
  const [params, setParams] = useSearchParams()
  const now = nowInBusiness()
  const [date, setDate] = useState(now.date)
  const [view, setView] = useState<'dia' | 'proximos' | 'pix'>(params.get('pix') ? 'pix' : 'dia')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const seeAll = can(user.role, 'agenda:all')
  const pros = db.pros.filter((p) => p.active && (seeAll || p.id === user.proId))
  const visible = (a: Appointment) => seeAll || a.proId === user.proId
  const hours = BUSINESS.hours[weekdayOf(date)]
  const dayList = db.appointments.filter((a) => a.date === date && visible(a))
  const active = dayList.filter((a) => a.status !== 'cancelado')

  const upcoming = useMemo(
    () =>
      db.appointments
        .filter((a) => visible(a) && isUpcoming(a, now.date, now.minutes) && a.date <= addDays(now.date, 7))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start),
    [db.appointments, now.date, now.minutes, user.proId, seeAll],
  )
  const pixList = db.appointments.filter((a) => visible(a) && a.payment.status === 'em_analise' && a.status !== 'cancelado')

  const setViewAndUrl = (v: typeof view) => {
    setView(v)
    if (v !== 'pix' && params.get('pix')) setParams({})
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={seeAll ? 'Todas as profissionais' : `Sua agenda, ${user.name.split(' ')[0]}`}
        actions={
          <>
            <Segmented
              label="Visualização"
              value={view}
              onChange={setViewAndUrl}
              options={[
                { value: 'dia', label: 'Dia' },
                { value: 'proximos', label: 'Próximos' },
                { value: 'pix', label: `Pix${pixList.length ? ` (${pixList.length})` : ''}` },
              ]}
            />
            {seeAll && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
            )}
          </>
        }
      />

      {view === 'dia' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="soft" size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center">
              <b className="font-display text-xl">{date === now.date ? 'Hoje' : WEEKDAYS[weekdayOf(date)]}</b>
              <span className="ml-2 text-sm text-mauve">{fmtDate(date)}</span>
            </div>
            <Button variant="soft" size="sm" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== now.date && (
              <Button variant="ghost" size="sm" onClick={() => setDate(now.date)}>
                Hoje
              </Button>
            )}
            <span className="ml-auto text-sm text-mauve">
              {active.length} horários
              {can(user.role, 'finance') && ` · ${brl(active.reduce((s, a) => s + a.price, 0), false)} previstos`}
            </span>
          </div>

          {!hours ? (
            <Empty>Fechado neste dia.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-line/60">
              <div className="flex min-w-max">
                <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-line/60 bg-white pt-12">
                  <div className="relative" style={{ height: (hours[1] - hours[0]) * PX }}>
                    {Array.from({ length: Math.floor((hours[1] - hours[0]) / 60) + 1 }, (_, i) => (
                      <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-mauve" style={{ top: i * 60 * PX }}>
                        {hm(hours[0] + i * 60)}
                      </span>
                    ))}
                  </div>
                </div>
                {pros.map((p) => {
                  const items = dayList.filter((a) => a.proId === p.id && a.status !== 'cancelado')
                  return (
                    <div key={p.id} className="w-[220px] shrink-0 border-r border-line/40 last:border-r-0 md:w-auto md:min-w-[220px] md:flex-1">
                      <div className="sticky top-0 flex h-12 items-center gap-2 border-b border-line/60 px-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: p.tone }} />
                        <b className="text-sm">{p.name}</b>
                        <span className="ml-auto text-xs text-mauve">{items.length}</span>
                      </div>
                      <div className="relative" style={{ height: (hours[1] - hours[0]) * PX }}>
                        {Array.from({ length: Math.floor((hours[1] - hours[0]) / 60) }, (_, i) => (
                          <div key={i} className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: i * 60 * PX }} />
                        ))}
                        {date === now.date && now.minutes > hours[0] && now.minutes < hours[1] && (
                          <div className="absolute inset-x-0 z-10 border-t-2 border-cherry" style={{ top: (now.minutes - hours[0]) * PX }}>
                            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-cherry" />
                          </div>
                        )}
                        {items.map((a) => {
                          const s = db.services.find((x) => x.id === a.serviceId)
                          const done = a.status === 'concluido'
                          return (
                            <button
                              key={a.id}
                              onClick={() => setSelected(a.id)}
                              className={cx(
                                'absolute inset-x-1.5 overflow-hidden rounded-xl px-2.5 py-1.5 text-left text-xs transition hover:z-20 hover:shadow-lift',
                                a.status === 'faltou' && 'opacity-50 line-through',
                              )}
                              style={{
                                top: (a.start - hours[0]) * PX + 1,
                                height: (a.end - a.start) * PX - 2,
                                background: done ? '#f3ecec' : `${p.tone}1f`,
                                borderLeft: `3px solid ${p.tone}`,
                              }}
                            >
                              <b className="block truncate text-wine">{a.clientName}</b>
                              <span className="block truncate text-mauve">
                                {hm(a.start)} · {s?.name}
                              </span>
                              {a.payment.status === 'em_analise' && <span className="mt-0.5 inline-block rounded bg-cherry px-1 text-[10px] font-bold text-white">PIX</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'proximos' && <ApptList list={upcoming} onSelect={setSelected} empty="Nenhum horário nos próximos 7 dias." grouped />}
      {view === 'pix' && (
        <ApptList list={pixList} onSelect={setSelected} empty="Nenhum Pix aguardando conferência." hint="Confira no app do banco e marque como pago." />
      )}

      <AppointmentDetail id={selected} onClose={() => setSelected(null)} />
      <BookingModal open={creating} onClose={() => setCreating(false)} source="admin" />
    </div>
  )
}

function ApptList({
  list,
  onSelect,
  empty,
  hint,
  grouped,
}: {
  list: Appointment[]
  onSelect: (id: string) => void
  empty: string
  hint?: string
  grouped?: boolean
}) {
  const db = useDB()
  const now = nowInBusiness()
  if (!list.length) return <Empty>{empty}</Empty>
  const dates = grouped ? [...new Set(list.map((a) => a.date))] : [null]
  return (
    <div className="space-y-4">
      {hint && <p className="text-sm text-mauve">{hint}</p>}
      {dates.map((d) => (
        <Card key={d ?? 'all'} className="p-0">
          {d && (
            <p className="border-b border-line/60 px-4 py-3 text-sm font-bold">
              {d === now.date ? 'Hoje' : d === addDays(now.date, 1) ? 'Amanhã' : fmtDate(d, { weekday: true })}
            </p>
          )}
          <ul className="divide-y divide-line/60">
            {list
              .filter((a) => !d || a.date === d)
              .map((a) => {
                const s = db.services.find((x) => x.id === a.serviceId)
                const p = db.pros.find((x) => x.id === a.proId)
                return (
                  <li key={a.id}>
                    <button onClick={() => onSelect(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blush">
                      <span className="w-14 shrink-0">
                        <b className="block">{hm(a.start)}</b>
                        {!grouped && <span className="text-[11px] text-mauve">{fmtDate(a.date)}</span>}
                      </span>
                      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: p?.tone }} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{a.clientName}</b>
                        <span className="block truncate text-xs text-mauve">
                          {s?.name} · {p?.name} · {brl(a.price, false)}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <Badge tone={PAY_STATUS[a.payment.status].tone}>{PAY_STATUS[a.payment.status].label}</Badge>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                )
              })}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function AppointmentDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDB()
  const repo = useRepo()
  const toast = useToast()
  const ask = useConfirm()
  const user = useCurrentUser()!
  const a = db.appointments.find((x) => x.id === id)
  const s = a && db.services.find((x) => x.id === a.serviceId)
  const p = a && db.pros.find((x) => x.id === a.proId)

  const update = async (patch: Partial<Appointment>, msg: string) => {
    if (!a) return
    try {
      await repo.updateAppointment(a.id, patch)
      toast(msg)
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <Modal open={!!a} onClose={onClose} title="Atendimento">
      {a && s && p && (
        <div>
          <div className="rounded-2xl bg-blush p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl leading-tight">{a.clientName}</p>
                <p className="text-sm text-mauve">{fmtPhone(a.clientPhone)}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-mauve">Quando</dt>
                <dd className="font-semibold">
                  {fmtDate(a.date, { weekday: true })}, {hm(a.start)}–{hm(a.end)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mauve">Serviço</dt>
                <dd className="font-semibold">
                  {s.name} · {duration(s.duration)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mauve">Profissional</dt>
                <dd className="font-semibold">{p.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-mauve">Pagamento</dt>
                <dd className="font-semibold">
                  {brl(a.price)} · {PAY_LABEL[a.payment.method]}
                </dd>
              </div>
            </dl>
            {a.notes && <p className="mt-3 rounded-xl bg-white p-3 text-sm">“{a.notes}”</p>}
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={PAY_STATUS[a.payment.status].tone}>{PAY_STATUS[a.payment.status].label}</Badge>
              <span className="text-xs text-mauve">via {a.source === 'site' ? 'site' : 'equipe'}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {a.status === 'agendado' && (
              <Button variant="dark" onClick={() => update({ status: 'confirmado' }, 'Confirmado')}>
                Confirmar
              </Button>
            )}
            {(a.status === 'agendado' || a.status === 'confirmado') && (
              <>
                <Button onClick={() => update({ status: 'concluido' }, 'Atendimento concluído')}>Concluir</Button>
                <Button variant="soft" onClick={() => update({ status: 'faltou' }, 'Marcado como falta')}>
                  Faltou
                </Button>
                <Button variant="danger" onClick={async () => (await ask({ title: 'Cancelar este horário?', text: 'O horário volta a ficar livre no site.', confirmLabel: 'Cancelar horário', danger: true })) && update({ status: 'cancelado' }, 'Horário cancelado')}>
                  Cancelar
                </Button>
              </>
            )}
            {a.payment.status !== 'pago' && a.status !== 'cancelado' && a.status !== 'faltou' && can(user.role, 'agenda:all') && (
              <Button
                variant="soft"
                className="col-span-2"
                onClick={() => update({ payment: { ...a.payment, status: 'pago', paidAt: new Date().toISOString() } }, 'Pagamento registrado')}
              >
                Registrar pagamento recebido
              </Button>
            )}
            {(a.status === 'concluido' || a.status === 'faltou' || a.status === 'cancelado') && (
              <Button variant="ghost" className="col-span-2" onClick={() => update({ status: 'confirmado' }, 'Status reaberto')}>
                Reabrir atendimento
              </Button>
            )}
          </div>
          <a
            href={whatsappLink(
              a.clientPhone,
              `Oi, ${a.clientName.split(' ')[0]}! Passando pra lembrar do seu horário de ${s.name} na Cereja: ${fmtDate(a.date, { weekday: true })} às ${hm(a.start)} com ${p.name}. Posso confirmar? 💅`,
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block"
          >
            <Button variant="ghost" className="w-full">
              <MessageCircle className="h-4 w-4" /> Lembrar pelo WhatsApp
            </Button>
          </a>
        </div>
      )}
    </Modal>
  )
}
