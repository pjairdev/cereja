import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Field, Input, Modal, useToast } from '../../components/ui'
import { addDays, brl, duration, nowInBusiness, uid } from '../../lib/business'
import { inRange, topServices } from '../../lib/analytics'
import type { Service } from '../../lib/types'
import { useDB, useRepo } from '../../data/store'
import { PageHeader, Segmented } from './shared'

export default function Services() {
  const db = useDB()
  const [period, setPeriod] = useState(30)
  const [editing, setEditing] = useState<Service | null>(null)
  const today = nowInBusiness().date
  const from = addDays(today, -(period - 1))
  const list = useMemo(() => db.appointments.filter((a) => inRange(a, from, today)), [db.appointments, from, today])
  const ranked = topServices(db, list)
  const totalCount = ranked.reduce((s, r) => s + r.count, 0) || 1
  const totalRevenue = ranked.reduce((s, r) => s + r.revenue, 0)
  const weeks = period / 7

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle={`${totalCount} atendimentos · ${brl(totalRevenue, false)} em ${period} dias`}
        actions={
          <>
            <Segmented
              label="Período"
              value={period}
              onChange={setPeriod}
              options={[7, 30, 90].map((d) => ({ value: d, label: `${d} dias` }))}
            />
            <Button
              size="sm"
              onClick={() => setEditing({ id: uid('s'), name: '', duration: 45, price: 40, description: '', active: true })}
            >
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </>
        }
      />
      <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-line/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wider text-mauve">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3 text-right">Feitos</th>
              <th className="px-4 py-3">Participação</th>
              <th className="px-4 py-3 text-right">Por semana</th>
              <th className="px-4 py-3 text-right">Faturamento</th>
              <th className="px-4 py-3 text-right">Preço</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {ranked.map((r, i) => (
              <tr key={r.service.id} className={r.service.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-display text-lg text-cherry/50">{i + 1}</td>
                <td className="px-4 py-3">
                  <b className="block">{r.service.name}</b>
                  <span className="text-xs text-mauve">
                    {duration(r.service.duration)} {!r.service.active && <Badge tone="bad">inativo</Badge>}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{r.count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-petal">
                      <div className="h-full rounded-full bg-cherry" style={{ width: `${(r.count / totalCount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-mauve">{Math.round((r.count / totalCount) * 100)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{(r.count / weeks).toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-semibold">{brl(r.revenue, false)}</td>
                <td className="px-4 py-3 text-right">{brl(r.service.price, false)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(r.service)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-petal" aria-label={`Editar ${r.service.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ServiceForm service={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ServiceForm({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const repo = useRepo()
  const toast = useToast()
  const [draft, setDraft] = useState<Service | null>(null)
  const s = draft?.id === service?.id ? draft : service
  const set = (patch: Partial<Service>) => setDraft({ ...(s as Service), ...patch })

  const db = useDB()
  const [proIds, setProIds] = useState<string[] | null>(null)
  const assigned = proIds ?? (s ? db.pros.filter((p) => p.serviceIds.includes(s.id)).map((p) => p.id) : [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!s || !s.name.trim()) return
    await repo.saveService({ ...s, name: s.name.trim() })
    for (const p of db.pros) {
      const has = p.serviceIds.includes(s.id)
      const want = assigned.includes(p.id)
      if (has !== want) {
        await repo.savePro({ ...p, serviceIds: want ? [...p.serviceIds, s.id] : p.serviceIds.filter((x) => x !== s.id) })
      }
    }
    setProIds(null)
    toast('Serviço salvo')
    setDraft(null)
    onClose()
  }

  return (
    <Modal open={!!service} onClose={() => (setDraft(null), setProIds(null), onClose())} title={service?.name ? 'Editar serviço' : 'Novo serviço'}>
      {s && (
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome">
            <Input value={s.name} onChange={(e) => set({ name: e.target.value })} required />
          </Field>
          <Field label="Descrição">
            <Input value={s.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)">
              <Input type="number" min={15} step={5} value={s.duration} onChange={(e) => set({ duration: Number(e.target.value) })} />
            </Field>
            <Field label="Preço (R$)">
              <Input type="number" min={0} step={1} value={s.price} onChange={(e) => set({ price: Number(e.target.value) })} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Quem faz este serviço</legend>
            <div className="flex flex-wrap gap-2">
              {db.pros.map((p) => {
                const on = assigned.includes(p.id)
                return (
                  <button
                    type="button"
                    key={p.id}
                    aria-pressed={on}
                    onClick={() => setProIds(on ? assigned.filter((x) => x !== p.id) : [...assigned, p.id])}
                    className={on ? 'rounded-full bg-wine px-3 py-1.5 text-sm font-semibold text-white' : 'rounded-full bg-petal px-3 py-1.5 text-sm font-semibold text-wine'}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={s.active} onChange={(e) => set({ active: e.target.checked })} className="h-5 w-5 accent-cherry" />
            Disponível para agendamento no site
          </label>
          <Button type="submit" className="w-full">
            Salvar
          </Button>
        </form>
      )}
    </Modal>
  )
}
