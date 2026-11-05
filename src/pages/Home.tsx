import { motion } from 'framer-motion'
import { AtSign, CalendarHeart, Clock, LockKeyhole, MapPin, MessageCircle, Navigation, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookingModal } from '../components/Booking'
import { HeroScroll } from '../components/HeroScroll'
import { Badge, Button, Card, Input, Logo, cx, useConfirm, useToast } from '../components/ui'
import { BUSINESS, WEEKDAYS, brl, duration, fmtDate, fmtPhone, hm, nowInBusiness, onlyDigits, openStatus, whatsappLink } from '../lib/business'
import { nextFreeToday } from '../lib/scheduling'
import type { Appointment } from '../lib/types'
import { publicStats } from '../data/statsHelper'
import { useDB, useMinuteTick, useRepo } from '../data/store'

const reveal = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] as const },
}

export default function Home() {
  useMinuteTick()
  const [booking, setBooking] = useState<{ open: boolean; serviceId?: string }>({ open: false })
  const book = (serviceId?: string) => setBooking({ open: true, serviceId })
  const status = openStatus()

  return (
    <div className="bg-blush font-sans text-wine">
      <Nav status={status} onBook={() => book()} />
      <HeroScroll onBook={() => book()} />
      <TopServices onBook={book} />
      <Team onBook={() => book()} />
      <Location status={status} />
      <MyBookings />
      <Footer />
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <Button size="lg" className="w-full shadow-lift" onClick={() => book()}>
          <CalendarHeart className="h-5 w-5" /> Agendar agora
        </Button>
      </div>
      <BookingModal open={booking.open} initialServiceId={booking.serviceId} onClose={() => setBooking({ open: false })} />
    </div>
  )
}

function StatusPill({ status, className }: { status: ReturnType<typeof openStatus>; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-soft', className)}>
      <span className="relative flex h-2.5 w-2.5">
        {status.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
        <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', status.open ? 'bg-ok' : 'bg-cherry')} />
      </span>
      <span className={status.open ? 'text-ok' : 'text-cherry-dark'}>{status.label}</span>
      <span className="hidden font-semibold text-mauve sm:inline">· {status.detail}</span>
    </span>
  )
}

function Nav({ status, onBook }: { status: ReturnType<typeof openStatus>; onBook: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/50 bg-blush/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <a href="#inicio" aria-label="Cereja Esmalteria, início">
          <Logo />
        </a>
        <nav className="hidden items-center gap-1 rounded-full bg-white/80 p-1 text-sm font-semibold md:flex">
          {[
            ['#servicos', 'Serviços'],
            ['#equipe', 'Equipe'],
            ['#local', 'Local'],
            ['#meus', 'Meus horários'],
          ].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-4 py-2 hover:bg-petal">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <Link
            to="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-wine px-3 text-sm font-semibold text-white transition hover:bg-wine/90"
            aria-label="Área da equipe"
          >
            <LockKeyhole className="h-4 w-4" />
            <span className="hidden lg:inline">Área da equipe</span>
          </Link>
          <Button size="sm" className="hidden md:inline-flex" onClick={onBook}>
            Agendar
          </Button>
        </div>
      </div>
    </header>
  )
}

function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <motion.div {...reveal} className="mb-8 md:mb-12">
      <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-cherry md:text-sm">{kicker}</p>
      <h2 className="font-display text-4xl leading-none text-wine md:text-6xl">{title}</h2>
      {text && <p className="mt-3 max-w-xl text-mauve md:text-lg">{text}</p>}
    </motion.div>
  )
}

function TopServices({ onBook }: { onBook: (id: string) => void }) {
  const db = useDB()
  const stats = publicStats(db)
  const ranked = useMemo(
    () =>
      db.services
        .filter((s) => s.active)
        .map((s) => ({ s, count: stats.serviceCounts[s.id] ?? 0 }))
        .sort((a, b) => b.count - a.count),
    [db.services, stats],
  )
  const max = Math.max(1, ...ranked.map((r) => r.count))
  const [hero, ...rest] = ranked

  return (
    <section id="servicos" className="relative mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
      <SectionTitle
        kicker="Os queridinhos"
        title="Mais pedidos do mês"
        text={`${stats.doneLast30} atendimentos nos últimos 30 dias. O ranking se atualiza sozinho a cada unha feita.`}
      />
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        {hero && (
          <motion.button
            {...reveal}
            onClick={() => onBook(hero.s.id)}
            className="group relative overflow-hidden rounded-[32px] bg-cherry p-7 text-left text-white shadow-lift md:p-9"
          >
            <span className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-125" />
            <Badge tone="neutral">
              <Star className="h-3.5 w-3.5 fill-cherry text-cherry" /> nº 1 do mês
            </Badge>
            <h3 className="mt-6 font-display text-5xl leading-none md:text-7xl">{hero.s.name}</h3>
            <p className="mt-3 max-w-xs text-white/80">{hero.s.description}</p>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl">{brl(hero.s.price, false)}</p>
                <p className="text-sm text-white/70">
                  {duration(hero.s.duration)} · {hero.count} feitos este mês
                </p>
              </div>
              <span className="rounded-full bg-white px-5 py-3 text-sm font-bold text-cherry transition group-hover:translate-x-1">Agendar →</span>
            </div>
          </motion.button>
        )}
        <div className="grid gap-2">
          {rest.map((r, i) => (
            <motion.button
              key={r.s.id}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.05 }}
              onClick={() => onBook(r.s.id)}
              className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-line/60 transition hover:ring-cherry"
            >
              <span className="w-6 font-display text-xl text-cherry/40">{i + 2}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <b className="truncate">{r.s.name}</b>
                  <b className="shrink-0 text-cherry">{brl(r.s.price, false)}</b>
                </span>
                <span className="mt-1.5 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-petal">
                    <motion.span
                      className="block h-full rounded-full bg-cherry"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(r.count / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.2 + i * 0.05 }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-mauve">{duration(r.s.duration)}</span>
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Team({ onBook }: { onBook: () => void }) {
  const db = useDB()
  const now = nowInBusiness()
  return (
    <section id="equipe" className="bg-wine py-20 text-white md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <motion.div {...reveal} className="mb-10 md:mb-14">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-cherry-soft md:text-sm">Quem cuida de você</p>
          <h2 className="font-display text-4xl leading-none md:text-6xl">A equipe</h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-3">
          {db.pros
            .filter((p) => p.active)
            .map((p, i) => {
              const free = nextFreeToday(p, db.services, db.appointments, now)
              const names = db.services.filter((s) => p.serviceIds.includes(s.id)).map((s) => s.name)
              return (
                <motion.article
                  key={p.id}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: i * 0.1 }}
                  whileHover={{ y: -6 }}
                  className="rounded-[28px] bg-white/[0.06] p-6 ring-1 ring-white/10"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-16 w-16 place-items-center rounded-full font-display text-3xl" style={{ background: p.tone }}>
                      {p.name[0]}
                    </span>
                    <div>
                      <h3 className="font-display text-3xl leading-none">{p.name}</h3>
                      <p className="mt-1 text-sm text-white/60">{p.role}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-white/80">{p.bio}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {names.slice(0, 4).map((n) => (
                      <span key={n} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">
                        {n}
                      </span>
                    ))}
                  </div>
                  <button onClick={onBook} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-cherry-soft" />
                      {free !== null ? (
                        <>
                          Livre hoje às <b>{hm(free)}</b>
                        </>
                      ) : (
                        'Agenda de hoje fechada'
                      )}
                    </span>
                    <span className="font-bold text-cherry-soft">Agendar →</span>
                  </button>
                </motion.article>
              )
            })}
        </div>
      </div>
    </section>
  )
}

function Location({ status }: { status: ReturnType<typeof openStatus> }) {
  const today = nowInBusiness().weekday
  return (
    <section id="local" className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
      <SectionTitle kicker="Onde estamos" title="Passa aqui" />
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <motion.div {...reveal}>
          <Card className="h-full p-6 md:p-8">
            <div
              className={cx(
                'mb-6 flex items-center gap-4 rounded-2xl p-4',
                status.open ? 'bg-ok/10 text-ok' : 'bg-cherry/10 text-cherry-dark',
              )}
            >
              <span className="relative flex h-4 w-4">
                {status.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />}
                <span className={cx('relative inline-flex h-4 w-4 rounded-full', status.open ? 'bg-ok' : 'bg-cherry')} />
              </span>
              <div>
                <p className="font-display text-2xl leading-none">{status.label}</p>
                <p className="text-sm font-semibold opacity-80">{status.detail}</p>
              </div>
            </div>
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cherry" />
              <span>
                <b className="block">{BUSINESS.address}</b>
                <span className="text-mauve">{BUSINESS.city}</span>
              </span>
            </p>
            <ul className="mt-6 divide-y divide-line/60 text-sm">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const h = BUSINESS.hours[wd]
                return (
                  <li key={wd} className={cx('flex justify-between py-2', wd === today && 'font-bold text-cherry')}>
                    <span>
                      {WEEKDAYS[wd]} {wd === today && '· hoje'}
                    </span>
                    <span>{h ? `${hm(h[0])} – ${hm(h[1])}` : 'Fechado'}</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(BUSINESS.mapsQuery)}`} target="_blank" rel="noreferrer">
                <Button variant="soft" className="w-full">
                  <Navigation className="h-4 w-4" /> Como chegar
                </Button>
              </a>
              <a href={whatsappLink(BUSINESS.whatsapp, 'Olá, Cereja! Tenho uma dúvida.')} target="_blank" rel="noreferrer">
                <Button variant="soft" className="w-full">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            </div>
          </Card>
        </motion.div>
        <motion.a
          {...reveal}
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.mapsQuery)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir localização no Google Maps"
          className="group relative block min-h-[320px] overflow-hidden rounded-3xl bg-petal shadow-soft ring-1 ring-line/70"
        >
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <rect width="600" height="400" fill="#ffe2de" />
            <path d="M-20 300 C120 260 200 330 340 280 S560 200 640 230" stroke="#bfe3e4" strokeWidth="38" fill="none" />
            {[60, 150, 250, 360, 470, 560].map((x) => (
              <path key={x} d={`M${x} -10 L${x - 40} 410`} stroke="#fff" strokeWidth={x === 250 ? 14 : 8} />
            ))}
            {[50, 120, 200, 350].map((y) => (
              <path key={y} d={`M-10 ${y} L610 ${y + 30}`} stroke="#fff" strokeWidth={y === 120 ? 14 : 8} />
            ))}
            {[[90, 60], [180, 150], [300, 40], [400, 160], [500, 70], [110, 220], [420, 330]].map(([x, y]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="54" height="38" rx="8" fill="#f6cfca" />
            ))}
          </svg>
          <span className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-full">
            <span className="flex flex-col items-center">
              <span className="rounded-full bg-wine px-4 py-2 text-sm font-bold text-white shadow-lift">Cereja Esmalteria</span>
              <MapPin className="-mt-1 h-10 w-10 fill-cherry text-white drop-shadow transition-transform group-hover:-translate-y-1" />
            </span>
          </span>
          <span className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm backdrop-blur">
            <span>
              <b className="block">{BUSINESS.address}</b>
              <span className="text-mauve">Toque para traçar a rota</span>
            </span>
            <span className="shrink-0 font-bold text-cherry">Abrir mapa →</span>
          </span>
        </motion.a>
      </div>
    </section>
  )
}

const STATUS_LABEL: Record<Appointment['status'], string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Não compareceu',
}

function MyBookings() {
  const repo = useRepo()
  const db = useDB()
  const toast = useToast()
  const ask = useConfirm()
  const [phone, setPhone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cereja.lastclient') || 'null')?.phone ?? ''
    } catch {
      return ''
    }
  })
  const [list, setList] = useState<Appointment[] | null>(null)
  const now = nowInBusiness()

  const search = async () => {
    const found = await repo.findByPhone(phone)
    setList(found.filter((a) => a.date >= now.date).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)))
  }
  const cancel = async (a: Appointment) => {
    const minutesUntil = (Date.parse(a.date) - Date.parse(now.date)) / 60000 + a.start - now.minutes
    if (minutesUntil < 120) return toast('Faltam menos de 2 horas. Fale com a gente no WhatsApp.', 'bad')
    if (!(await ask({ title: 'Cancelar esse horário?', text: 'O horário fica livre para outra cliente.', confirmLabel: 'Cancelar horário', danger: true }))) return
    await repo.cancelByClient(a.id, phone)
    toast('Horário cancelado')
    search()
  }

  return (
    <section id="meus" className="mx-auto max-w-3xl px-4 pb-24 md:px-8">
      <motion.div {...reveal}>
        <Card className="p-6 md:p-8">
          <h2 className="font-display text-3xl">Meus horários</h2>
          <p className="mt-1 text-sm text-mauve">Consulte ou cancele usando o WhatsApp do agendamento.</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (onlyDigits(phone).length >= 10) search()
            }}
          >
            <Input value={fmtPhone(phone)} onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))} placeholder="(75) 99999-9999" inputMode="tel" aria-label="WhatsApp" />
            <Button type="submit" variant="dark" aria-label="Buscar">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          {list && (
            <ul className="mt-4 space-y-2">
              {list.length === 0 && <li className="text-sm text-mauve">Nenhum horário futuro encontrado.</li>}
              {list.map((a) => {
                const s = db.services.find((x) => x.id === a.serviceId)
                const p = db.pros.find((x) => x.id === a.proId)
                const active = a.status === 'agendado' || a.status === 'confirmado'
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-blush p-4">
                    <div>
                      <b>
                        {fmtDate(a.date, { weekday: true })} · {hm(a.start)}
                      </b>
                      <p className="text-sm text-mauve">
                        {s?.name} com {p?.name} · {STATUS_LABEL[a.status]}
                      </p>
                    </div>
                    {active && (
                      <Button size="sm" variant="danger" onClick={() => cancel(a)}>
                        Cancelar
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </motion.div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-cherry pb-24 pt-14 text-white md:pb-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-white/80">{BUSINESS.tagline}. {BUSINESS.address}, {BUSINESS.city}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <a href={`https://instagram.com/${BUSINESS.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
            <AtSign className="h-4 w-4" /> @{BUSINESS.instagram}
          </a>
          <a href={whatsappLink(BUSINESS.whatsapp, 'Olá!')} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <Link to="/admin" className="rounded-full bg-white/15 px-4 py-2 hover:bg-white/25">
            Área da equipe
          </Link>
        </div>
      </div>
    </footer>
  )
}
