import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Banknote, Check, CreditCard, Download, MessageCircle, QrCode, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BUSINESS, brl, duration, fmtDate, fmtPhone, hm, nowInBusiness, onlyDigits, whatsappLink, WEEKDAYS_SHORT, weekdayOf } from '../lib/business'
import { CARD_PAYMENT_URL } from '../lib/pix'
import { availableSlots, bookableDates, prosForService } from '../lib/scheduling'
import type { Appointment, PaymentMethod } from '../lib/types'
import { useDB, useRepo } from '../data/store'
import { BookingConflictError } from '../data/repo'
import { PixPayment } from './PixPayment'
import { Button, Field, Input, Modal, cx, useToast } from './ui'

type Step = 'service' | 'pro' | 'time' | 'details' | 'payment' | 'done'
const ORDER: Step[] = ['service', 'pro', 'time', 'details', 'payment']
const LAST_CLIENT = 'cereja.lastclient'

export function BookingModal({
  open,
  onClose,
  initialServiceId,
  source = 'site',
}: {
  open: boolean
  onClose: () => void
  initialServiceId?: string
  source?: 'site' | 'admin'
}) {
  const db = useDB()
  const repo = useRepo()
  const toast = useToast()
  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<string>('')
  const [proId, setProId] = useState<string>('any')
  const [date, setDate] = useState<string>('')
  const [start, setStart] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [saving, setSaving] = useState(false)
  const [booked, setBooked] = useState<Appointment | null>(null)

  useEffect(() => {
    if (!open) return
    const now = nowInBusiness()
    setServiceId(initialServiceId ?? '')
    setStep(initialServiceId ? 'pro' : 'service')
    setProId('any')
    setDate(bookableDates(now.date, 1)[0] ?? now.date)
    setStart(null)
    setNotes('')
    setBooked(null)
    if (source === 'site') {
      try {
        const last = JSON.parse(localStorage.getItem(LAST_CLIENT) || 'null')
        if (last) {
          setName(last.name)
          setPhone(last.phone)
        }
      } catch {
        /* ignora */
      }
    } else {
      setName('')
      setPhone('')
      setMethod('local')
    }
  }, [open, initialServiceId, source])

  const service = db.services.find((s) => s.id === serviceId)
  const pros = service ? prosForService(db.pros, service.id) : []
  const now = nowInBusiness()
  const dates = useMemo(() => bookableDates(now.date, 14), [now.date])

  const slotsByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof availableSlots>>()
    if (!service) return map
    for (const d of dates) {
      map.set(d, availableSlots({ date: d, service, pros: db.pros, proId, appointments: db.appointments }))
    }
    return map
  }, [service, dates, db.pros, db.appointments, proId])

  const slots = slotsByDate.get(date) ?? []
  const groups = [
    { label: 'Manhã', items: slots.filter((s) => s.start < 12 * 60) },
    { label: 'Tarde', items: slots.filter((s) => s.start >= 12 * 60 && s.start < 18 * 60) },
    { label: 'Noite', items: slots.filter((s) => s.start >= 18 * 60) },
  ].filter((g) => g.items.length)

  const chosenPro = db.pros.find((p) => p.id === (booked?.proId ?? proId))
  const idx = ORDER.indexOf(step)
  const back = () => idx > 0 && setStep(ORDER[idx - 1])

  async function confirm() {
    if (!service || start === null) return
    setSaving(true)
    try {
      const appt = await repo.book({
        serviceId: service.id,
        proId,
        date,
        start,
        name,
        phone,
        notes,
        paymentMethod: method,
        source,
      })
      if (source === 'site') {
        try {
          localStorage.setItem(LAST_CLIENT, JSON.stringify({ name: name.trim(), phone: onlyDigits(phone) }))
        } catch {
          /* ignora */
        }
      }
      setBooked(appt)
      setStep('done')
      if (source === 'admin') toast('Agendamento criado')
    } catch (e) {
      if (e instanceof BookingConflictError) {
        toast(e.message, 'bad')
        setStart(null)
        setStep('time')
      } else toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  const phoneOk = onlyDigits(phone).length >= 10
  const titles: Record<Step, string> = {
    service: 'Qual serviço?',
    pro: 'Com quem?',
    time: 'Quando?',
    details: source === 'admin' ? 'Dados da cliente' : 'Seus dados',
    payment: 'Como prefere pagar?',
    done: source === 'admin' ? 'Agendamento criado' : 'Horário reservado!',
  }

  return (
    <Modal open={open} onClose={onClose} title={titles[step]} wide>
      {step !== 'done' && (
        <div className="mb-5 flex items-center gap-3">
          {idx > 0 && (
            <button onClick={back} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex flex-1 gap-1.5" aria-label={`Etapa ${idx + 1} de ${ORDER.length}`}>
            {ORDER.map((s, i) => (
              <span key={s} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= idx ? 'bg-cherry' : 'bg-petal')} />
            ))}
          </div>
        </div>
      )}

      {service && step !== 'service' && step !== 'done' && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
          <b>{service.name}</b>
          <span className="text-mauve">{duration(service.duration)}</span>
          <span className="text-mauve">{brl(service.price, false)}</span>
          {idx >= 2 && <span className="text-mauve">· {proId === 'any' ? 'Primeira livre' : chosenPro?.name}</span>}
          {idx >= 3 && start !== null && (
            <span className="text-mauve">
              · {fmtDate(date, { weekday: true })} às {hm(start)}
            </span>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
          {step === 'service' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {db.services
                .filter((s) => s.active)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setServiceId(s.id)
                      setProId('any')
                      setStart(null)
                      setStep('pro')
                    }}
                    className={cx(
                      'rounded-2xl p-4 text-left ring-1 transition hover:ring-cherry',
                      s.id === serviceId ? 'bg-petal ring-cherry' : 'bg-white ring-line',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-wine">{s.name}</span>
                      <span className="font-bold text-cherry">{brl(s.price, false)}</span>
                    </div>
                    <p className="mt-1 text-sm text-mauve">
                      {duration(s.duration)} · {s.description}
                    </p>
                  </button>
                ))}
            </div>
          )}

          {step === 'pro' && (
            <div className="grid gap-2">
              <button
                onClick={() => {
                  setProId('any')
                  setStart(null)
                  setStep('time')
                }}
                className="flex items-center gap-4 rounded-2xl bg-wine p-4 text-left text-white transition hover:bg-wine/90"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
                  <Users className="h-5 w-5" />
                </span>
                <span>
                  <b className="block">Primeira profissional livre</b>
                  <span className="text-sm text-white/70">Mais horários disponíveis</span>
                </span>
              </button>
              {pros.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProId(p.id)
                    setStart(null)
                    setStep('time')
                  }}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-line transition hover:ring-cherry"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-full font-display text-xl text-white" style={{ background: p.tone }}>
                    {p.name[0]}
                  </span>
                  <span>
                    <b className="block text-wine">{p.name}</b>
                    <span className="text-sm text-mauve">{p.role}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 'time' && (
            <div>
              <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6" role="tablist" aria-label="Dia">
                {dates.map((d) => {
                  const n = slotsByDate.get(d)?.length ?? 0
                  const active = d === date
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={active}
                      disabled={!n}
                      onClick={() => {
                        setDate(d)
                        setStart(null)
                      }}
                      className={cx(
                        'flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 ring-1 transition',
                        active ? 'bg-cherry text-white ring-cherry' : 'bg-white text-wine ring-line hover:ring-cherry',
                        !n && 'opacity-40',
                      )}
                    >
                      <span className="text-[11px] font-semibold uppercase opacity-80">{d === now.date ? 'hoje' : WEEKDAYS_SHORT[weekdayOf(d)]}</span>
                      <span className="font-display text-2xl leading-tight">{Number(d.slice(8))}</span>
                      <span className={cx('text-[10px] font-semibold', active ? 'text-white/80' : 'text-mauve')}>{n ? `${n} hor.` : 'lotado'}</span>
                    </button>
                  )
                })}
              </div>
              {groups.length === 0 && (
                <p className="rounded-2xl bg-blush p-5 text-center text-sm text-mauve">Sem horários livres nesse dia. Tente outro dia ou outra profissional.</p>
              )}
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mauve">{g.label}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {g.items.map((s) => (
                        <button
                          key={s.start}
                          onClick={() => setStart(s.start)}
                          className={cx(
                            'rounded-xl py-2.5 text-sm font-bold ring-1 transition',
                            start === s.start ? 'bg-cherry text-white ring-cherry' : 'bg-white text-wine ring-line hover:ring-cherry',
                          )}
                        >
                          {hm(s.start)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-5 w-full" disabled={start === null} onClick={() => setStep('details')}>
                Continuar
              </Button>
            </div>
          )}

          {step === 'details' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim().length >= 2 && phoneOk) setStep('payment')
              }}
            >
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" required />
              </Field>
              <Field label="WhatsApp" hint="A confirmação e o lembrete chegam por aqui.">
                <Input
                  value={fmtPhone(phone)}
                  onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
                  placeholder="(75) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </Field>
              <Field label="Observação (opcional)">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: quero nail art igual à foto do Instagram" />
              </Field>
              <Button type="submit" className="w-full" disabled={name.trim().length < 2 || !phoneOk}>
                Continuar
              </Button>
            </form>
          )}

          {step === 'payment' && service && (
            <div>
              <div className="grid gap-2">
                <PayOption
                  active={method === 'pix'}
                  onClick={() => setMethod('pix')}
                  icon={<QrCode className="h-5 w-5" />}
                  title="Pix agora"
                  text="QR Code e copia e cola na próxima tela"
                  tag="Garante o horário"
                />
                <PayOption
                  active={method === 'cartao'}
                  onClick={() => setMethod('cartao')}
                  icon={<CreditCard className="h-5 w-5" />}
                  title={CARD_PAYMENT_URL ? 'Cartão online' : 'Cartão na maquininha'}
                  text={CARD_PAYMENT_URL ? 'Crédito em até 3x, pelo link seguro' : 'Débito ou crédito no dia do atendimento'}
                />
                <PayOption
                  active={method === 'local'}
                  onClick={() => setMethod('local')}
                  icon={<Banknote className="h-5 w-5" />}
                  title="Pagar no salão"
                  text="Dinheiro ou Pix na hora"
                />
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-blush px-4 py-3">
                <span className="text-sm text-mauve">Total</span>
                <span className="font-display text-2xl text-wine">{brl(service.price)}</span>
              </div>
              <Button className="mt-4 w-full" size="lg" onClick={confirm} disabled={saving}>
                {saving ? 'Reservando…' : 'Confirmar agendamento'}
              </Button>
              <p className="mt-3 text-center text-xs text-mauve">Cancelamento gratuito até 2 horas antes.</p>
            </div>
          )}

          {step === 'done' && booked && service && (
            <Done appt={booked} serviceName={service.name} proName={chosenPro?.name ?? ''} onClose={onClose} admin={source === 'admin'} />
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  )
}

function PayOption(props: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string; tag?: string }) {
  return (
    <button
      onClick={props.onClick}
      aria-pressed={props.active}
      className={cx(
        'flex items-center gap-4 rounded-2xl p-4 text-left ring-1 transition',
        props.active ? 'bg-petal ring-2 ring-cherry' : 'bg-white ring-line hover:ring-cherry',
      )}
    >
      <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', props.active ? 'bg-cherry text-white' : 'bg-blush text-cherry')}>
        {props.icon}
      </span>
      <span className="flex-1">
        <b className="flex items-center gap-2 text-wine">
          {props.title}
          {props.tag && <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok">{props.tag}</span>}
        </b>
        <span className="text-sm text-mauve">{props.text}</span>
      </span>
      <span className={cx('grid h-6 w-6 place-items-center rounded-full ring-2', props.active ? 'bg-cherry ring-cherry text-white' : 'ring-line')}>
        {props.active && <Check className="h-4 w-4" />}
      </span>
    </button>
  )
}

function icsFile(appt: Appointment, serviceName: string) {
  const dt = (min: number) => `${appt.date.replace(/-/g, '')}T${hm(min).replace(':', '')}00`
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cereja Esmalteria//Agenda//PT',
    'BEGIN:VEVENT',
    `UID:${appt.id}@cereja`,
    `DTSTART;TZID=${BUSINESS.timeZone}:${dt(appt.start)}`,
    `DTEND;TZID=${BUSINESS.timeZone}:${dt(appt.end)}`,
    `SUMMARY:${serviceName} · ${BUSINESS.name}`,
    `LOCATION:${BUSINESS.address}\\, ${BUSINESS.city}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Seu horário na Cereja é daqui a 2 horas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return URL.createObjectURL(new Blob([body], { type: 'text/calendar' }))
}

function Done({ appt, serviceName, proName, onClose, admin }: { appt: Appointment; serviceName: string; proName: string; onClose: () => void; admin: boolean }) {
  const repo = useRepo()
  const db = useDB()
  const live = db.appointments.find((a) => a.id === appt.id) ?? appt
  const msg = `Olá! Acabei de agendar ${serviceName} com ${proName} em ${fmtDate(appt.date, { weekday: true })} às ${hm(appt.start)} (código ${appt.id.slice(-6).toUpperCase()}).`
  return (
    <div>
      <div className="mb-5 flex items-center gap-4 rounded-3xl bg-wine p-5 text-white">
        <motion.span
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cherry"
        >
          <Sparkles className="h-6 w-6" />
        </motion.span>
        <div>
          <p className="font-display text-2xl leading-tight">
            {fmtDate(appt.date, { weekday: true })} · {hm(appt.start)}
          </p>
          <p className="text-sm text-white/75">
            {serviceName} com {proName} · código {appt.id.slice(-6).toUpperCase()}
          </p>
        </div>
      </div>

      {appt.payment.method === 'pix' && !admin && (
        <PixPayment
          amount={appt.price}
          txid={appt.id}
          status={live.payment.status}
          onPaid={() => repo.confirmPixSent(appt.id)}
        />
      )}
      {appt.payment.method === 'cartao' && CARD_PAYMENT_URL && !admin && (
        <a href={CARD_PAYMENT_URL} target="_blank" rel="noreferrer" className="mb-4 block">
          <Button className="w-full" size="lg">
            <CreditCard className="h-5 w-5" /> Pagar {brl(appt.price)} no cartão
          </Button>
        </a>
      )}
      {(appt.payment.method === 'local' || (appt.payment.method === 'cartao' && !CARD_PAYMENT_URL)) && !admin && (
        <p className="mb-4 rounded-2xl bg-blush p-4 text-sm text-wine">
          Pagamento de <b>{brl(appt.price)}</b> no dia, {appt.payment.method === 'cartao' ? 'no cartão' : 'no salão'}. Chegue 5 minutos antes 💅
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <a href={icsFile(appt, serviceName)} download="cereja-agendamento.ics">
          <Button variant="soft" className="w-full">
            <Download className="h-4 w-4" /> Salvar na agenda
          </Button>
        </a>
        {admin ? (
          <a
            href={whatsappLink(appt.clientPhone, `Oi, ${appt.clientName.split(' ')[0]}! Seu horário de ${serviceName} na Cereja está confirmado para ${fmtDate(appt.date, { weekday: true })} às ${hm(appt.start)}.`)}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="soft" className="w-full">
              <MessageCircle className="h-4 w-4" /> Avisar a cliente
            </Button>
          </a>
        ) : (
          <a href={whatsappLink(BUSINESS.whatsapp, msg)} target="_blank" rel="noreferrer">
            <Button variant="soft" className="w-full">
              <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
            </Button>
          </a>
        )}
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
        Fechar
      </Button>
    </div>
  )
}
