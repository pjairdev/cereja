import { ArrowLeft, Check, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fmtPhone, onlyDigits } from '../lib/business'
import { OTP_RESEND_MS, isValidEmail, normalizeEmail } from '../lib/otp'
import type { ClientAccount } from '../lib/types'
import { useRepo } from '../data/store'
import { Button, Field, Input, Modal, cx } from './ui'

type Step = 'email' | 'code' | 'link-sent' | 'confirm-link' | 'profile'

export const profileComplete = (c: ClientAccount | null) => !!c && c.name.trim().length >= 2 && onlyDigits(c.phone).length >= 10

/**
 * Login da cliente por e-mail verificado.
 * Modo local: código de 6 dígitos. Firebase: link de login enviado ao e-mail.
 * Depois da verificação, pede nome e WhatsApp no primeiro acesso.
 */
export function ClientLogin({
  open,
  onClose,
  onDone,
  reason = 'agendar',
}: {
  open: boolean
  onClose: () => void
  onDone: (account: ClientAccount) => void
  reason?: 'agendar' | 'entrar'
}) {
  const repo = useRepo()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!open) return
    setError('')
    setCode('')
    setDemoCode(undefined)
    const me = repo.currentClient()
    if (repo.pendingEmailLink()) setStep('confirm-link')
    else if (me && !profileComplete(me)) {
      setName(me.name)
      setPhone(me.phone)
      setStep('profile')
    } else setStep('email')
  }, [open, repo])

  // contador do "reenviar código"
  useEffect(() => {
    if (resendAt <= Date.now()) return
    const id = setInterval(() => tick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [resendAt])
  const wait = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))

  const finish = (acc: ClientAccount) => {
    if (profileComplete(acc)) onDone(acc)
    else {
      setName(acc.name)
      setPhone(acc.phone)
      setStep('profile')
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const requestCode = () =>
    run(async () => {
      const r = await repo.requestClientLogin(email)
      setResendAt(Date.now() + OTP_RESEND_MS)
      setCode('')
      setDemoCode(r.demoCode)
      setStep(r.method === 'code' ? 'code' : 'link-sent')
    })

  const verify = (value = code) =>
    run(async () => {
      const acc = await repo.verifyClientCode(email, value)
      finish(acc)
    })

  const titles: Record<Step, string> = {
    email: reason === 'agendar' ? 'Entre para agendar' : 'Entrar',
    code: 'Confirme seu e-mail',
    'link-sent': 'Confira seu e-mail',
    'confirm-link': 'Confirme seu e-mail',
    profile: 'Quase lá',
  }

  return (
    <Modal open={open} onClose={onClose} title={titles[step]}>
      {step === 'email' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValidEmail(email)) requestCode()
            else setError('Digite um e-mail válido, como maria@gmail.com.')
          }}
        >
          <p className="text-sm text-mauve">
            {reason === 'agendar'
              ? 'Usamos seu e-mail para guardar seus horários e confirmar que é você. '
              : 'Veja e cancele seus horários de qualquer aparelho. '}
            {repo.kind === 'firebase' ? 'Vamos enviar um link de acesso.' : 'Vamos enviar um código de 6 dígitos.'}
          </p>
          <Field label="E-mail">
            <Input
              id="client-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoFocus
              required
            />
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" className="w-full" disabled={busy}>
            <Mail className="h-4 w-4" /> {busy ? 'Enviando…' : repo.kind === 'firebase' ? 'Enviar link' : 'Enviar código'}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <button onClick={() => setStep('email')} className="flex items-center gap-1.5 text-sm font-semibold text-mauve hover:text-wine">
            <ArrowLeft className="h-4 w-4" /> Trocar e-mail
          </button>
          <p className="text-sm text-mauve">
            Digite o código enviado para <b className="break-all text-wine">{normalizeEmail(email)}</b>. Ele vale por 10 minutos.
          </p>

          {demoCode && (
            <div className="rounded-2xl bg-wine p-4 text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cherry-soft">
                <MailCheck className="h-4 w-4" /> Modo demonstração
              </p>
              <p className="mt-1 text-sm text-white/80">Ainda não há envio de e-mail configurado. Este é o código que chegaria na caixa de entrada:</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-display text-3xl tracking-[.3em]">{demoCode}</span>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => {
                    setCode(demoCode)
                    verify(demoCode)
                  }}
                >
                  Usar código
                </Button>
              </div>
            </div>
          )}

          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v)
              setError('')
              if (v.length === 6) verify(v)
            }}
            disabled={busy}
            invalid={!!error}
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => verify()}>
            <ShieldCheck className="h-4 w-4" /> {busy ? 'Verificando…' : 'Verificar e entrar'}
          </Button>
          <p className="text-center text-sm text-mauve">
            Não chegou?{' '}
            {wait > 0 ? (
              <span>Reenviar em {wait}s</span>
            ) : (
              <button onClick={requestCode} className="font-semibold text-cherry hover:underline" disabled={busy}>
                Reenviar código
              </button>
            )}
          </p>
        </div>
      )}

      {step === 'link-sent' && (
        <div className="space-y-4 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-petal text-cherry">
            <MailCheck className="h-8 w-8" />
          </span>
          <p className="text-sm text-mauve">
            Enviamos um link de acesso para <b className="break-all text-wine">{normalizeEmail(email)}</b>. Abra o e-mail neste aparelho e toque no link para
            entrar. Se não aparecer, veja a pasta de spam.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStep('email')}>
              Trocar e-mail
            </Button>
            <Button variant="soft" className="flex-1" disabled={wait > 0 || busy} onClick={requestCode}>
              {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar link'}
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm-link' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => finish(await repo.completeEmailLink(email)))
          }}
        >
          <p className="text-sm text-mauve">Você abriu o link em outro aparelho. Por segurança, digite o mesmo e-mail que usou para pedir o acesso.</p>
          <Field label="E-mail">
            <Input id="client-email-confirm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" className="w-full" disabled={busy}>
            Confirmar e entrar
          </Button>
        </form>
      )}

      {step === 'profile' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => onDone(await repo.saveClientProfile({ name, phone })))
          }}
        >
          <p className="flex items-center gap-2 rounded-2xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
            <Check className="h-4 w-4" /> E-mail verificado
          </p>
          <p className="text-sm text-mauve">Só falta isso no primeiro acesso. O WhatsApp é para confirmar e lembrar do seu horário.</p>
          <Field label="Nome">
            <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" required autoFocus />
          </Field>
          <Field label="WhatsApp">
            <Input
              id="client-phone"
              value={fmtPhone(phone)}
              onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
              placeholder="(75) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2 || onlyDigits(phone).length < 10}>
            {reason === 'agendar' ? 'Continuar para o agendamento' : 'Salvar e entrar'}
          </Button>
        </form>
      )}
    </Modal>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-cherry/10 px-3 py-2 text-sm font-semibold text-cherry-dark">
      {children}
    </p>
  )
}

/** Seis caixas para o código, com avanço automático e colar o código inteiro. */
function CodeInput({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => {
    refs.current[Math.min(value.length, 5)]?.focus()
  }, [value.length])

  const setAt = (i: number, digit: string) => {
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = digit
    onChange(arr.join('').replace(/\s+$/, '').replace(/\s/g, ''))
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Código de 6 dígitos">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          ref={(el) => (refs.current[i] = el)}
          value={value[i] ?? ''}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1}`}
          maxLength={6}
          onChange={(e) => {
            const digits = onlyDigits(e.target.value)
            if (digits.length > 1) onChange(digits.slice(0, 6)) // colou o código todo
            else if (digits) setAt(i, digits)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              e.preventDefault()
              onChange(value.slice(0, i - 1))
            } else if (e.key === 'Backspace') {
              e.preventDefault()
              onChange(value.slice(0, i))
            }
          }}
          onPaste={(e) => {
            const digits = onlyDigits(e.clipboardData.getData('text')).slice(0, 6)
            if (digits) {
              e.preventDefault()
              onChange(digits)
            }
          }}
          className={cx(
            'h-14 w-full min-w-0 rounded-2xl bg-blush text-center font-display text-2xl text-wine ring-1 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-cherry',
            invalid ? 'ring-cherry' : 'ring-line',
          )}
        />
      ))}
    </div>
  )
}
