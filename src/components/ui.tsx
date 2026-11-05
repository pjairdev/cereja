import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'soft' | 'dark' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-cherry text-white hover:bg-cherry-dark shadow-soft',
  dark: 'bg-wine text-white hover:bg-wine/90',
  soft: 'bg-petal text-wine hover:bg-cherry-soft/60',
  ghost: 'bg-transparent text-wine hover:bg-petal',
  danger: 'bg-white text-cherry-dark ring-1 ring-cherry/30 hover:bg-cherry/5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-11 px-5 text-[15px]',
        size === 'lg' && 'h-14 px-7 text-base',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line/70', className)}>{children}</div>
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  const t = {
    neutral: 'bg-petal text-wine',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
    bad: 'bg-cherry/10 text-cherry-dark',
    brand: 'bg-cherry text-white',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-wine">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mauve">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border-0 bg-blush px-4 py-3 text-wine ring-1 ring-line placeholder:text-mauve/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cherry'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, 'appearance-none', props.className)} />
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path d="M12 15 C14 8 19 5 25 3" stroke={light ? '#fff' : '#3d0f1e'} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M21 18 C20 11 22 6 25 3" stroke={light ? '#fff' : '#3d0f1e'} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M25 3 c3 0 5 2 4 4 c-3 0-4-2-4-4z" fill="#2e8a5a" />
        <circle cx="11" cy="21" r="7" fill="#d8304a" />
        <circle cx="21.5" cy="23" r="6" fill="#b3263c" />
        <circle cx="8.5" cy="18.5" r="1.8" fill="#fff" opacity=".7" />
      </svg>
      <span className={cx('font-display text-2xl leading-none', light ? 'text-white' : 'text-wine')}>Cereja</span>
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-wine/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx(
              'max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-lift sm:rounded-[28px] sm:p-6',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-wine">{title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-petal" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Toast = { id: number; text: string; tone: 'ok' | 'bad' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'bad') => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className={cx(
                'pointer-events-auto rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lift',
                t.tone === 'ok' ? 'bg-wine' : 'bg-cherry-dark',
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mauve">{children}</div>
}

type AskOptions = { title: string; text?: string; confirmLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: AskOptions) => Promise<boolean>>(async () => false)

/** Confirmação dentro da página (não depende de window.confirm, bloqueado em alguns navegadores embutidos). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(AskOptions & { resolve: (v: boolean) => void }) | null>(null)
  const ask = useCallback((o: AskOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ''}>
        {state?.text && <p className="text-sm text-mauve">{state.text}</p>}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => close(false)}>
            Voltar
          </Button>
          <Button variant={state?.danger ? 'primary' : 'dark'} className="flex-1" onClick={() => close(true)} autoFocus>
            {state?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
