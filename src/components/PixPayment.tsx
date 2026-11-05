import { Check, Copy, Hourglass } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { brl } from '../lib/business'
import { PIX_CONFIG, pixPayload } from '../lib/pix'
import type { PaymentStatus } from '../lib/types'
import { Button } from './ui'

export function PixPayment({
  amount,
  txid,
  status,
  onPaid,
}: {
  amount: number
  txid: string
  status: PaymentStatus
  onPaid: () => void
}) {
  const payload = useMemo(
    () => pixPayload({ key: PIX_CONFIG.key, name: PIX_CONFIG.name, city: PIX_CONFIG.city, amount, txid: txid.replace(/[^A-Za-z0-9]/g, '').slice(-25) }),
    [amount, txid],
  )
  const [svg, setSvg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toString(payload, { type: 'svg', margin: 1, color: { dark: '#3d0f1e', light: '#ffffff' } }).then(setSvg)
  }, [payload])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = payload
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'pago')
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ok/10 p-4 text-sm font-semibold text-ok">
        <Check className="h-5 w-5" /> Pagamento confirmado pelo salão.
      </div>
    )

  return (
    <div className="mb-4 rounded-3xl bg-blush p-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label="QR Code Pix"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="w-full min-w-0">
          <p className="text-sm text-mauve">Pague com Pix</p>
          <p className="font-display text-3xl text-wine">{brl(amount)}</p>
          <p className="mt-1 text-xs text-mauve">Abra o app do banco, escolha Pix › Ler QR Code ou Copia e Cola.</p>
          <div className="mt-3 truncate rounded-xl bg-white px-3 py-2 font-mono text-[11px] text-mauve ring-1 ring-line">{payload}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="dark" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar código'}
            </Button>
            {status === 'pendente' ? (
              <Button size="sm" onClick={onPaid}>
                Já paguei
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-3 text-xs font-semibold text-warn">
                <Hourglass className="h-3.5 w-3.5" /> Aguardando o salão confirmar
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
