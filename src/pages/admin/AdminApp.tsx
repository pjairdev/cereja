import { ArrowLeft, CalendarDays, Eye, EyeOff, LayoutDashboard, LogOut, Scissors, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Logo, cx, useToast } from '../../components/ui'
import { ROLE_LABEL, can, useCurrentUser, useRepo, type Permission } from '../../data/store'
import Agenda from './Agenda'
import Clients from './Clients'
import Dashboard from './Dashboard'
import Services from './Services'
import Users from './Users'

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; perm: Permission }[] = [
  { to: '/admin', label: 'Painel', icon: LayoutDashboard, perm: 'dashboard' },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, perm: 'agenda' },
  { to: '/admin/clientes', label: 'Clientes', icon: UserRound, perm: 'clientes' },
  { to: '/admin/servicos', label: 'Serviços', icon: Scissors, perm: 'servicos' },
  { to: '/admin/usuarios', label: 'Usuários', icon: ShieldCheck, perm: 'usuarios' },
]

export default function AdminApp() {
  const user = useCurrentUser()
  if (!user) return <Login />
  const home = can(user.role, 'dashboard') ? '/admin' : '/admin/agenda'
  const guard = (perm: Permission, el: ReactNode) => (can(user.role, perm) ? el : <Navigate to={home} replace />)
  return (
    <Layout>
      <Routes>
        <Route index element={guard('dashboard', <Dashboard />)} />
        <Route path="agenda" element={guard('agenda', <Agenda />)} />
        <Route path="clientes" element={guard('clientes', <Clients />)} />
        <Route path="servicos" element={guard('servicos', <Services />)} />
        <Route path="usuarios" element={guard('usuarios', <Users />)} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  )
}

function Layout({ children }: { children: ReactNode }) {
  const user = useCurrentUser()!
  const repo = useRepo()
  const navigate = useNavigate()
  const items = NAV.filter((n) => can(user.role, n.perm))
  const logout = async () => {
    await repo.logout()
    navigate('/admin')
  }
  return (
    <div className="min-h-screen bg-blush font-sans text-wine md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line/70 bg-white/60 p-5 backdrop-blur md:flex">
        <Link to="/" className="mb-8">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isActive ? 'bg-cherry text-white shadow-soft' : 'hover:bg-petal',
                )
              }
            >
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-blush p-3">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="text-xs text-mauve">{ROLE_LABEL[user.role]}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs font-semibold text-cherry hover:underline">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/">
          <Logo />
        </Link>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-semibold">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line/70 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/admin'}
            className={({ isActive }) =>
              cx('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold', isActive ? 'text-cherry' : 'text-mauve')
            }
          >
            <n.icon className="h-5 w-5" /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Login() {
  const repo = useRepo()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const u = await repo.login(email, password)
      toast(`Olá, ${u.name.split(' ')[0]}!`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-blush px-4 font-sans text-wine">
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-wine shadow-soft ring-1 ring-line/60 transition hover:bg-petal md:left-8 md:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para o site
      </Link>
      <div className="w-full max-w-sm pt-16 md:pt-0">
        <Link to="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <form onSubmit={submit} className="space-y-4 rounded-[28px] bg-white p-6 shadow-lift">
          <div>
            <h1 className="font-display text-3xl">Área da equipe</h1>
            <p className="text-sm text-mauve">Agenda, clientes e faturamento.</p>
          </div>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Senha">
            <div className="relative">
              <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mauve"
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          {error && <p className="rounded-xl bg-cherry/10 px-3 py-2 text-sm font-semibold text-cherry-dark">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        {repo.kind === 'local' && (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 text-xs text-mauve">
            <p className="mb-2 font-bold text-wine">Acessos de demonstração (senha cereja123)</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['admin@cereja.com', 'Administradora'],
                ['recepcao@cereja.com', 'Recepção'],
                ['jessica@cereja.com', 'Profissional'],
              ].map(([e, l]) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmail(e)
                    setPassword('cereja123')
                  }}
                  className="rounded-full bg-petal px-3 py-1 font-semibold text-wine hover:bg-cherry-soft/60"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
