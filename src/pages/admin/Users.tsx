import { KeyRound, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Field, Input, Modal, Select, cx, useConfirm, useToast } from '../../components/ui'
import { fmtDate } from '../../lib/business'
import type { Role, StaffUser } from '../../lib/types'
import { ROLE_LABEL, useCurrentUser, useDB, useRepo } from '../../data/store'
import { PageHeader } from './shared'

const ROLE_HELP: Record<Role, string> = {
  admin: 'Tudo: faturamento, serviços e usuários.',
  recepcao: 'Agenda de todas, clientes e painel sem valores.',
  profissional: 'Apenas a própria agenda.',
}

type FormState = { mode: 'new' } | { mode: 'edit'; user: StaffUser } | { mode: 'password'; user: StaffUser } | null

export default function Users() {
  const db = useDB()
  const repo = useRepo()
  const toast = useToast()
  const me = useCurrentUser()!
  const ask = useConfirm()
  const [form, setForm] = useState<FormState>(null)

  const run = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn()
      toast(msg)
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  const users = [...db.users].sort((a, b) => Number(b.active) - Number(a.active) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name))

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Quem acessa o painel e o que cada pessoa pode ver"
        actions={
          <Button size="sm" onClick={() => setForm({ mode: 'new' })}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <div key={r} className="rounded-2xl bg-white/70 p-4 ring-1 ring-line/60">
            <p className="flex items-center justify-between text-sm font-bold">
              {ROLE_LABEL[r]} <span className="font-display text-xl text-cherry">{db.users.filter((u) => u.role === r && u.active).length}</span>
            </p>
            <p className="text-xs text-mauve">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line/60">
        <ul className="divide-y divide-line/60">
          {users.map((u) => {
            const pro = db.pros.find((p) => p.id === u.proId)
            return (
              <li key={u.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap', !u.active && 'opacity-55')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-white" style={{ background: pro?.tone ?? '#3d0f1e' }}>
                  {u.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2">
                    <span className="truncate">{u.name}</span>
                    {u.id === me.id && <Badge>você</Badge>}
                  </b>
                  <span className="block truncate text-xs text-mauve">{u.email}</span>
                </span>
                <span className="w-36">
                  <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>
                  {pro && <span className="ml-1 text-xs text-mauve">· {pro.name}</span>}
                </span>
                <span className="hidden w-32 text-xs text-mauve lg:block">
                  {u.active ? (u.lastLoginAt ? `Último acesso ${fmtDate(u.lastLoginAt.slice(0, 10))}` : 'Nunca acessou') : 'Desativado'}
                </span>
                <span className="flex gap-1">
                  <IconBtn label="Editar" onClick={() => setForm({ mode: 'edit', user: u })}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label={repo.kind === 'firebase' ? 'Enviar redefinição de senha' : 'Trocar senha'} onClick={() => setForm({ mode: 'password', user: u })}>
                    <KeyRound className="h-4 w-4" />
                  </IconBtn>
                  {u.id !== me.id && (
                    <>
                      <IconBtn
                        label={u.active ? 'Desativar' : 'Reativar'}
                        onClick={() => run(() => repo.updateUser(u.id, { active: !u.active }), u.active ? 'Usuário desativado' : 'Usuário reativado')}
                      >
                        <Power className={cx('h-4 w-4', u.active ? 'text-ok' : 'text-mauve')} />
                      </IconBtn>
                      <IconBtn
                        label="Excluir"
                        onClick={async () => (await ask({ title: `Excluir ${u.name}?`, text: 'O acesso ao painel é removido. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })) && run(() => repo.deleteUser(u.id), 'Usuário excluído')}
                      >
                        <Trash2 className="h-4 w-4 text-cherry" />
                      </IconBtn>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {repo.kind === 'local' && repo.resetDemo && (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-4 text-sm text-mauve">
          Modo demonstração: os dados ficam salvos neste navegador.{' '}
          <button
            className="font-semibold text-cherry underline"
            onClick={async () => (await ask({ title: 'Recriar dados de exemplo?', text: 'Agendamentos, clientes e usuários criados neste navegador serão apagados.', confirmLabel: 'Recriar', danger: true })) && run(() => repo.resetDemo!(), 'Dados de exemplo recriados')}
          >
            Recriar dados de exemplo
          </button>
        </div>
      )}

      <UserForm state={form} onClose={() => setForm(null)} />
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-9 w-9 place-items-center rounded-full hover:bg-petal">
      {children}
    </button>
  )
}

function UserForm({ state, onClose }: { state: FormState; onClose: () => void }) {
  const db = useDB()
  const repo = useRepo()
  const toast = useToast()
  const editing = state?.mode === 'edit' ? state.user : null
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('recepcao')
  const [proId, setProId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState<string | null>(null)

  // Reinicia o formulário sempre que abre para outro usuário
  const stateKey = state ? `${state.mode}-${'user' in state ? state.user.id : 'new'}` : null
  if (stateKey !== key) {
    setKey(stateKey)
    setError('')
    setPassword('')
    setName(editing?.name ?? '')
    setEmail(editing?.email ?? '')
    setRole(editing?.role ?? 'recepcao')
    setProId(editing?.proId ?? db.pros[0]?.id ?? '')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (state?.mode === 'new') {
        await repo.createUser({ name, email, role, proId: role === 'profissional' ? proId : undefined, password })
        toast('Usuário criado')
      } else if (state?.mode === 'edit') {
        await repo.updateUser(state.user.id, { name: name.trim(), role, proId: role === 'profissional' ? proId : undefined })
        toast('Usuário atualizado')
      } else if (state?.mode === 'password') {
        await repo.setPassword(state.user.id, password)
        toast(repo.kind === 'firebase' ? 'E-mail de redefinição enviado' : 'Senha alterada')
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const title = state?.mode === 'new' ? 'Novo usuário' : state?.mode === 'edit' ? 'Editar usuário' : 'Senha'

  return (
    <Modal open={!!state} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {state?.mode === 'password' ? (
          repo.kind === 'firebase' ? (
            <p className="text-sm text-mauve">
              Vamos enviar um link de redefinição para <b className="text-wine">{state.user.email}</b>.
            </p>
          ) : (
            <Field label={`Nova senha para ${state.user.name}`} hint="Mínimo de 6 caracteres">
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus />
            </Field>
          )
        ) : (
          <>
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="E-mail de acesso">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={state?.mode === 'edit'} />
            </Field>
            <Field label="Papel" hint={ROLE_HELP[role]}>
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {role === 'profissional' && (
              <Field label="Agenda vinculada">
                <Select value={proId} onChange={(e) => setProId(e.target.value)}>
                  {db.pros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {state?.mode === 'new' && (
              <Field label="Senha inicial" hint="Mínimo de 6 caracteres. Peça para trocar no primeiro acesso.">
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </Field>
            )}
          </>
        )}
        {error && <p className="rounded-xl bg-cherry/10 px-3 py-2 text-sm font-semibold text-cherry-dark">{error}</p>}
        <Button type="submit" className="w-full">
          {state?.mode === 'password' && repo.kind === 'firebase' ? 'Enviar link' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  )
}
