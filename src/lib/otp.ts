// Código de verificação de 6 dígitos com validade, limite de tentativas e intervalo de reenvio.
// Usado no modo local; no Firebase a verificação é feita pelo link de login enviado ao e-mail.

export const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutos
export const OTP_RESEND_MS = 30 * 1000 // 30 s entre envios
export const OTP_MAX_ATTEMPTS = 5

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return EMAIL_RE.test(normalizeEmail(email))
}

export function generateCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface Pending {
  hash: string
  expiresAt: number
  attempts: number
  sentAt: number
}

export class OtpError extends Error {}

export class OtpStore {
  private pending = new Map<string, Pending>()
  constructor(private now: () => number = () => Date.now()) {}

  /** Quantos segundos faltam para poder reenviar (0 = pode enviar). */
  cooldown(email: string): number {
    const p = this.pending.get(normalizeEmail(email))
    if (!p) return 0
    return Math.max(0, Math.ceil((p.sentAt + OTP_RESEND_MS - this.now()) / 1000))
  }

  async issue(email: string): Promise<string> {
    const key = normalizeEmail(email)
    if (!isValidEmail(key)) throw new OtpError('Digite um e-mail válido.')
    const wait = this.cooldown(key)
    if (wait > 0) throw new OtpError(`Aguarde ${wait}s para pedir um novo código.`)
    const code = generateCode()
    this.pending.set(key, {
      hash: await sha256(`${key}:${code}`),
      expiresAt: this.now() + OTP_TTL_MS,
      attempts: 0,
      sentAt: this.now(),
    })
    return code
  }

  async verify(email: string, code: string): Promise<void> {
    const key = normalizeEmail(email)
    const p = this.pending.get(key)
    if (!p) throw new OtpError('Peça um código primeiro.')
    if (this.now() > p.expiresAt) {
      this.pending.delete(key)
      throw new OtpError('O código expirou. Peça um novo.')
    }
    if (p.attempts >= OTP_MAX_ATTEMPTS) {
      this.pending.delete(key)
      throw new OtpError('Muitas tentativas. Peça um novo código.')
    }
    p.attempts++
    if ((await sha256(`${key}:${code.trim()}`)) !== p.hash) {
      const left = OTP_MAX_ATTEMPTS - p.attempts
      if (left <= 0) {
        this.pending.delete(key) // esgotou: o código antigo deixa de valer
        throw new OtpError('Muitas tentativas. Peça um novo código.')
      }
      throw new OtpError(`Código incorreto. Restam ${left} tentativa${left > 1 ? 's' : ''}.`)
    }
    this.pending.delete(key) // código de uso único
  }
}
