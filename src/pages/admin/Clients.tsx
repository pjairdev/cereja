import { Check, MessageCircle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, Empty, Input, Modal, useToast } from '../../components/ui'
import { brl, fmtDate, fmtPhone, nowInBusiness, whatsappLink } from '../../lib/business'
import { clientStats, inactiveClients, type ClientStats } from '../../lib/analytics'
import type { DB } from '../../lib/types'
import { can, useCurrentUser, useDB, useRepo } from '../../data/store'
import { PageHeader, Segmented } from './shared'

const TEMPLATE_KEY = 'cereja.template.inactive'
const DEFAULT_TEMPLATE =
  'Oi, {nome}! Aqui é da Cereja Esmalteria 💅 Faz {dias} dias que você não aparece e a gente sentiu sua falta. Que tal renovar sua {servico}? Essa semana tem 10% off pra você. É só responder aqui que eu já reservo seu horário!'

function getTemplate() {
  try {
    return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE
  } catch {
    return DEFAULT_TEMPLATE
  }
}

export function inactiveMessage(c: ClientStats, db: DB, template = getTemplate()) {
  const service = db.services.find((s) => s.id === c.favoriteServiceId)?.name.toLowerCase() ?? 'unha'
  return template
    .replace(/\{nome\}/g, c.client.name.split(' ')[0])
    .replace(/\{dias\}/g, String(c.daysAway ?? ''))
    .replace(/\{servico\}/g, service)
}

export default function Clients() {
  const db = useDB()
  const repo = useRepo()
  const toast = useToast()
  const user = useCurrentUser()!
  const finance = can(user.role, 'finance')
  const now = nowInBusiness()
  const [tab, setTab] = useState<'sumidas' | 'todas'>('sumidas')
  const [days, setDays] = useState(45)
  const [q, setQ] = useState('')
  const [template, setTemplate] = useState(getTemplate)
  const [editing, setEditing] = useState(false)

  const stats = useMemo(() => clientStats(db, now.date, now.minutes), [db, now.date, now.minutes])
  const inactive = useMemo(() => inactiveClients(stats, days), [stats, days])
  const base = tab === 'sumidas' ? inactive : [...stats].sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  const term = q.trim().toLowerCase()
  const list = term ? base.filter((c) => c.client.name.toLowerCase().includes(term) || c.client.phone.includes(term.replace(/\D/g, '') || '§')) : base
  const lostRevenue = inactive.reduce((s, c) => s + (c.visits ? c.spent / c.visits : 0), 0)
  const contacted = inactive.filter((c) => c.client.lastContactAt && c.client.lastContactAt.slice(0, 10) >= (c.lastVisit ?? '')).length

  const saveTemplate = () => {
    try {
      localStorage.setItem(TEMPLATE_KEY, template)
    } catch {
      /* ignora */
    }
    setEditing(false)
    toast('Mensagem salva')
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${db.clients.length} cadastradas`}
        actions={
          <Button variant="soft" size="sm" onClick={() => setEditing(true)}>
            Editar mensagem
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-mauve">Sumidas</p>
          <p className="font-display text-3xl">{inactive.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-mauve">Já contatadas</p>
          <p className="font-display text-3xl">{contacted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-mauve">{finance ? 'Potencial' : 'Média visitas'}</p>
          <p className="font-display text-3xl">
            {finance ? brl(lostRevenue, false) : (inactive.reduce((s, c) => s + c.visits, 0) / (inactive.length || 1)).toFixed(1)}
          </p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Lista"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sumidas', label: 'Sumidas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        {tab === 'sumidas' && (
          <Segmented
            label="Dias sem vir"
            value={days}
            onChange={setDays}
            options={[30, 45, 60, 90].map((d) => ({ value: d, label: `${d}d+` }))}
          />
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mauve" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou telefone" className="pl-10" />
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>{tab === 'sumidas' ? 'Nenhuma cliente sumida nesse critério.' : 'Nenhuma cliente encontrada.'}</Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line/60">
          <ul className="divide-y divide-line/60">
            {list.map((c) => {
              const fav = db.services.find((s) => s.id === c.favoriteServiceId)
              const wasContacted = c.client.lastContactAt && c.client.lastContactAt.slice(0, 10) >= (c.lastVisit ?? '')
              return (
                <li key={c.client.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-petal font-display text-cherry">{c.client.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{c.client.name}</b>
                    <span className="text-xs text-mauve">{fmtPhone(c.client.phone)}</span>
                  </span>
                  <span className="w-28 text-sm">
                    <span className="block text-xs text-mauve">Última visita</span>
                    {c.lastVisit ? (
                      <b className={c.daysAway! >= days ? 'text-cherry-dark' : ''}>
                        {fmtDate(c.lastVisit)} · {c.daysAway}d
                      </b>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="hidden w-24 text-sm md:block">
                    <span className="block text-xs text-mauve">Visitas</span>
                    <b>{c.visits}</b>
                    {finance && <span className="text-mauve"> · {brl(c.spent, false)}</span>}
                  </span>
                  <span className="hidden w-40 truncate text-sm lg:block">
                    <span className="block text-xs text-mauve">Preferido</span>
                    {fav?.name ?? '—'}
                  </span>
                  <span className="flex items-center gap-2">
                    {c.hasUpcoming && <Badge tone="ok">Marcado</Badge>}
                    {wasContacted && (
                      <Badge>
                        <Check className="h-3 w-3" /> Contatada
                      </Badge>
                    )}
                    <a
                      href={whatsappLink(c.client.phone, inactiveMessage(c, db, template))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => repo.markClientContacted(c.client.id)}
                    >
                      <Button size="sm" variant={tab === 'sumidas' ? 'primary' : 'soft'}>
                        <MessageCircle className="h-4 w-4" /> {tab === 'sumidas' ? 'Chamar de volta' : 'WhatsApp'}
                      </Button>
                    </a>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Mensagem para clientes sumidas">
        <p className="mb-2 text-sm text-mauve">
          Use <code className="rounded bg-petal px-1">{'{nome}'}</code>, <code className="rounded bg-petal px-1">{'{dias}'}</code> e{' '}
          <code className="rounded bg-petal px-1">{'{servico}'}</code> — são trocados pelos dados de cada cliente.
        </p>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={6}
          className="w-full rounded-2xl bg-blush p-4 text-sm text-wine ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-cherry"
        />
        {inactive[0] && (
          <p className="mt-3 rounded-2xl bg-ok/10 p-3 text-sm text-wine">
            <b className="mb-1 block text-xs text-ok">Prévia para {inactive[0].client.name.split(' ')[0]}</b>
            {inactiveMessage(inactive[0], db, template)}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => setTemplate(DEFAULT_TEMPLATE)}>
            Restaurar padrão
          </Button>
          <Button className="flex-1" onClick={saveTemplate}>
            Salvar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
