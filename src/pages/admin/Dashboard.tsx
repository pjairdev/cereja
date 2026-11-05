import { ArrowRight, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty } from '../../components/ui'
import { BUSINESS, addDays, brl, fmtDate, hm, nowInBusiness, whatsappLink } from '../../lib/business'
import { byPro, clientStats, delta, inRange, inactiveClients, isUpcoming, kpis, paymentMix, revenueSeries, topServices } from '../../lib/analytics'
import { can, useCurrentUser, useDB, useMinuteTick, useRepo } from '../../data/store'
import { Kpi, PageHeader, Segmented, StatusBadge } from './shared'
import { inactiveMessage } from './Clients'

type Period = 1 | 7 | 30 | 90

export default function Dashboard() {
  useMinuteTick()
  const db = useDB()
  const repo = useRepo()
  const user = useCurrentUser()!
  const finance = can(user.role, 'finance')
  const [period, setPeriod] = useState<Period>(30)
  const now = nowInBusiness()
  const to = now.date
  const from = addDays(to, -(period - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(period - 1))

  const cur = useMemo(() => db.appointments.filter((a) => inRange(a, from, to)), [db.appointments, from, to])
  const prev = useMemo(() => db.appointments.filter((a) => inRange(a, prevFrom, prevTo)), [db.appointments, prevFrom, prevTo])
  const k = kpis(cur)
  const kp = kpis(prev)
  const series = useMemo(() => revenueSeries(db.appointments, period === 1 ? addDays(to, -13) : from, to), [db.appointments, from, to, period])
  const services = topServices(db, cur)
  const pros = byPro(db, cur)
  const mix = paymentMix(cur)
  const upcoming = db.appointments
    .filter((a) => isUpcoming(a, now.date, now.minutes))
    .sort((a, b) => (a.date + String(a.start).padStart(4, '0')).localeCompare(b.date + String(b.start).padStart(4, '0')))
    .slice(0, 7)
  const stats = useMemo(() => clientStats(db, now.date, now.minutes), [db, now.date, now.minutes])
  const gone = inactiveClients(stats).slice(0, 5)
  const pixToCheck = db.appointments.filter((a) => a.payment.status === 'em_analise' && a.status !== 'cancelado')

  // No modo Firebase, mantém atualizado o ranking público exibido no site
  useEffect(() => {
    const r = repo as { refreshPublicStats?: () => Promise<void> }
    r.refreshPublicStats?.()
  }, [repo])

  const label = period === 1 ? 'vs. ontem' : `vs. ${period} dias anteriores`
  const maxService = Math.max(1, ...services.map((s) => s.count))
  const maxPro = Math.max(1, ...pros.map((p) => (finance ? p.revenue : p.count)))
  const mixTotal = mix.reduce((s, m) => s + m.revenue, 0) || 1

  return (
    <div>
      <PageHeader
        title={`Olá, ${user.name.split(' ')[0]}`}
        subtitle={`${fmtDate(now.date, { weekday: true })} · ${hm(now.minutes)}`}
        actions={
          <Segmented
            label="Período"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 1, label: 'Hoje' },
              { value: 7, label: '7 dias' },
              { value: 30, label: '30 dias' },
              { value: 90, label: '90 dias' },
            ]}
          />
        }
      />

      {pixToCheck.length > 0 && (
        <Link to="/admin/agenda?pix=1" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-cherry px-4 py-3 text-sm font-semibold text-white shadow-soft">
          <span>
            {pixToCheck.length} pagamento{pixToCheck.length > 1 ? 's' : ''} via Pix aguardando conferência
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {finance && <Kpi label="Faturamento" value={brl(k.revenue, false)} delta={delta(k.revenue, kp.revenue)} hint={label} />}
        <Kpi label="Atendimentos" value={String(k.done)} delta={delta(k.done, kp.done)} hint={label} />
        {finance && <Kpi label="Ticket médio" value={brl(k.ticket)} delta={delta(k.ticket, kp.ticket)} hint={label} />}
        <Kpi label="Faltas" value={`${Math.round(k.noShowRate * 100)}%`} delta={delta(k.noShowRate, kp.noShowRate)} hint={label} invert />
        {!finance && <Kpi label="Agendados" value={String(k.booked)} hint="no período" />}
        {!finance && <Kpi label="Cancelamentos" value={`${Math.round(k.cancelRate * 100)}%`} hint="no período" />}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="flex min-w-0 flex-col">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-bold">{finance ? 'Faturamento' : 'Atendimentos'} {period > 45 ? 'por semana' : 'por dia'}</h2>
            {finance && k.pendingPayments > 0 && <span className="text-xs text-mauve">A receber: <b className="text-warn">{brl(k.pendingPayments)}</b></span>}
          </div>
          <div className="h-64 xl:h-auto xl:min-h-[18rem] xl:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -8, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d8304a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#d8304a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f6cfca" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8f6570', fontSize: 11 }} minTickGap={18} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8f6570', fontSize: 11 }}
                  width={48}
                  tickFormatter={(v: number) => (finance ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v))}
                />
                <Tooltip
                  cursor={{ stroke: '#d8304a', strokeOpacity: 0.3 }}
                  contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 12px 32px -12px rgba(61,15,30,.35)', fontFamily: 'Figtree' }}
                  formatter={(v) => (finance ? [brl(Number(v)), 'Faturamento'] : [String(v), 'Atendimentos'])}
                  separator=": "
                  labelFormatter={(l) => (period > 45 ? `Semana de ${l}` : `Dia ${l}`)}
                />
                <Area type="monotone" dataKey={finance ? 'revenue' : 'count'} stroke="#d8304a" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Próximos horários</h2>
            <Link to="/admin/agenda" className="text-xs font-semibold text-cherry hover:underline">
              Ver agenda
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty>Nenhum horário marcado.</Empty>
          ) : (
            <ul className="divide-y divide-line/60">
              {upcoming.map((a) => {
                const s = db.services.find((x) => x.id === a.serviceId)
                const p = db.pros.find((x) => x.id === a.proId)
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-14 shrink-0 text-center">
                      <b className="block text-sm">{hm(a.start)}</b>
                      <span className="text-[11px] text-mauve">{a.date === now.date ? 'hoje' : fmtDate(a.date)}</span>
                    </span>
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: p?.tone }} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{a.clientName}</b>
                      <span className="block truncate text-xs text-mauve">
                        {s?.name} · {p?.name}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 font-bold">Serviços mais feitos</h2>
          <ul className="space-y-3">
            {services.slice(0, 6).map((s) => (
              <li key={s.service.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{s.service.name}</span>
                  <span className="text-mauve">
                    <b className="text-wine">{s.count}</b>
                    {finance && ` · ${brl(s.revenue, false)}`}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-petal">
                  <div className="h-full rounded-full bg-cherry transition-all duration-700" style={{ width: `${(s.count / maxService) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">Por profissional</h2>
          <ul className="space-y-4">
            {pros.map((p) => (
              <li key={p.pro.id} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-white" style={{ background: p.pro.tone }}>
                  {p.pro.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between text-sm">
                    <b>{p.pro.name}</b>
                    <span className="text-mauve">{finance ? brl(p.revenue, false) : `${p.count} atend.`}</span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-petal">
                    <span className="block h-full rounded-full" style={{ width: `${((finance ? p.revenue : p.count) / maxPro) * 100}%`, background: p.pro.tone }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {finance && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-bold">Formas de pagamento</h3>
              <div className="flex h-3 overflow-hidden rounded-full">
                {mix.map((m, i) => (
                  <span key={m.method} style={{ width: `${(m.revenue / mixTotal) * 100}%`, background: ['#d8304a', '#3d0f1e', '#ffb3bd'][i] }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mauve">
                {mix.map((m, i) => (
                  <li key={m.method} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ['#d8304a', '#3d0f1e', '#ffb3bd'][i] }} />
                    {m.label} <b className="text-wine">{Math.round((m.revenue / mixTotal) * 100)}%</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Clientes sumidas</h2>
            <Link to="/admin/clientes" className="text-xs font-semibold text-cherry hover:underline">
              Ver todas
            </Link>
          </div>
          <p className="mb-3 text-xs text-mauve">Sem visita há mais de {BUSINESS.inactiveDays} dias e sem horário marcado.</p>
          {gone.length === 0 ? (
            <Empty>Ninguém sumido. 🎉</Empty>
          ) : (
            <ul className="space-y-2">
              {gone.map((c) => (
                <li key={c.client.id} className="flex items-center gap-3 rounded-2xl bg-blush p-3">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{c.client.name}</b>
                    <span className="text-xs text-mauve">
                      há {c.daysAway} dias{finance && ` · ${brl(c.spent, false)} no total`}
                    </span>
                  </span>
                  <a
                    href={whatsappLink(c.client.phone, inactiveMessage(c, db))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => repo.markClientContacted(c.client.id)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok text-white"
                    aria-label={`Chamar ${c.client.name} no WhatsApp`}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
