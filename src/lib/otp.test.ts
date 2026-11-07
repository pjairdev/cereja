import { describe, expect, it } from 'vitest'
import { OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, OtpStore, generateCode, isValidEmail } from './otp'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('código de verificação', () => {
  it('gera 6 dígitos', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/)
  })

  it('valida e-mails', () => {
    expect(isValidEmail(' Maria@Gmail.com ')).toBe(true)
    expect(isValidEmail('maria@')).toBe(false)
    expect(isValidEmail('maria.gmail.com')).toBe(false)
  })

  it('aceita o código certo uma única vez, ignorando maiúsculas no e-mail', async () => {
    const c = clock()
    const store = new OtpStore(c.now)
    const code = await store.issue('Ana@Email.com')
    await expect(store.verify('ana@email.com', code)).resolves.toBeUndefined()
    await expect(store.verify('ana@email.com', code)).rejects.toThrow('Peça um código')
  })

  it('recusa código errado e bloqueia após o limite', async () => {
    const store = new OtpStore(clock().now)
    const code = await store.issue('a@b.com')
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) await expect(store.verify('a@b.com', wrong)).rejects.toThrow('incorreto')
    await expect(store.verify('a@b.com', wrong)).rejects.toThrow('Muitas tentativas')
    await expect(store.verify('a@b.com', code)).rejects.toThrow('Peça um código')
  })

  it('expira depois de 10 minutos', async () => {
    const c = clock()
    const store = new OtpStore(c.now)
    const code = await store.issue('a@b.com')
    c.advance(OTP_TTL_MS + 1)
    await expect(store.verify('a@b.com', code)).rejects.toThrow('expirou')
  })

  it('exige intervalo entre reenvios e o novo código substitui o antigo', async () => {
    const c = clock()
    const store = new OtpStore(c.now)
    const first = await store.issue('a@b.com')
    await expect(store.issue('a@b.com')).rejects.toThrow('Aguarde')
    c.advance(OTP_RESEND_MS)
    const second = await store.issue('a@b.com')
    if (first !== second) await expect(store.verify('a@b.com', first)).rejects.toThrow('incorreto')
    await expect(store.verify('a@b.com', second)).resolves.toBeUndefined()
  })
})
