// Gera o "Pix Copia e Cola" (BR Code estático) seguindo o padrão EMV QRCPS do Banco Central.
// O QR Code gerado é lido por qualquer app de banco e já vem com valor e identificador.

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function clean(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-@]/g, '')
    .trim()
    .slice(0, max)
}

export function pixPayload(opts: {
  key: string
  name: string
  city: string
  amount?: number
  txid?: string
  description?: string
}): string {
  const mai =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', opts.key.trim()) +
    (opts.description ? tlv('02', clean(opts.description, 40)) : '')
  const txid = (opts.txid ?? '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***'

  let p =
    tlv('00', '01') +
    tlv('26', mai) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (opts.amount && opts.amount > 0 ? tlv('54', opts.amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', clean(opts.name, 25) || 'RECEBEDOR') +
    tlv('60', clean(opts.city, 15) || 'BRASIL') +
    tlv('62', tlv('05', txid))
  p += '6304'
  return p + crc16(p)
}

export const PIX_CONFIG = {
  key: import.meta.env.VITE_PIX_KEY || 'cereja@exemplo.com',
  name: import.meta.env.VITE_PIX_MERCHANT_NAME || 'CEREJA ESMALTERIA',
  city: import.meta.env.VITE_PIX_MERCHANT_CITY || 'SANTO AMARO',
}

export const CARD_PAYMENT_URL: string = import.meta.env.VITE_CARD_PAYMENT_URL || ''
