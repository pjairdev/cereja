// Envio do código por e-mail no modo local, via EmailJS (funciona direto do navegador).
// Sem as variáveis configuradas, o site entra em modo demonstração e mostra o código na tela.
import { BUSINESS } from './business'

const cfg = {
  service: import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined,
  template: import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined,
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined,
}

export const emailSendingConfigured = !!(cfg.service && cfg.template && cfg.publicKey)

/** Envia o código. Retorna false quando não há envio configurado (modo demonstração). */
export async function sendCodeEmail(to: string, code: string): Promise<boolean> {
  if (!emailSendingConfigured) return false
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: cfg.service,
      template_id: cfg.template,
      user_id: cfg.publicKey,
      template_params: { to_email: to, code, app_name: BUSINESS.name, minutes: 10 },
    }),
  })
  if (!res.ok) throw new Error('Não conseguimos enviar o e-mail agora. Tente de novo em instantes.')
  return true
}
