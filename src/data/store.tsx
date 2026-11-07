import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { DB, Role } from '../lib/types'
import { LocalRepo } from './localRepo'
import type { Repo } from './repo'

const provider = (import.meta.env.VITE_DATA_PROVIDER || 'local') as 'local' | 'firebase'

async function createRepo(): Promise<Repo> {
  if (provider === 'firebase') {
    // Carregado sob demanda: quem usa o modo local não baixa o SDK do Firebase
    const { FirebaseRepo } = await import('./firebaseRepo')
    return new FirebaseRepo()
  }
  return new LocalRepo()
}

const RepoContext = createContext<Repo | null>(null)

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    createRepo()
      .then(async (r) => {
        await r.init()
        if (alive) setRepo(r)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])
  if (error)
    return (
      <div className="grid min-h-screen place-items-center bg-blush p-6 text-center text-wine">
        <div>
          <p className="font-display text-3xl">Ops!</p>
          <p className="mt-2 max-w-sm text-mauve">Não foi possível carregar os dados: {error}</p>
        </div>
      </div>
    )
  if (!repo) return <>{fallback}</>
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
}

export function useRepo(): Repo {
  const r = useContext(RepoContext)
  if (!r) throw new Error('useRepo fora do DataProvider')
  return r
}

export function useDB(): DB {
  const repo = useRepo()
  return useSyncExternalStore(
    (fn) => repo.subscribe(fn),
    () => repo.getDB(),
  )
}

export function useCurrentUser() {
  const repo = useRepo()
  return useSyncExternalStore(
    (fn) => repo.subscribe(fn),
    () => repo.currentUser(),
  )
}

export function useCurrentClient() {
  const repo = useRepo()
  return useSyncExternalStore(
    (fn) => repo.subscribe(fn),
    () => repo.currentClient(),
  )
}

/** Atualiza o componente a cada minuto (status aberto/fechado, horários que passaram). */
export function useMinuteTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
}

export type Permission = 'dashboard' | 'finance' | 'agenda' | 'agenda:all' | 'clientes' | 'servicos' | 'usuarios'

const PERMS: Record<Role, Permission[]> = {
  admin: ['dashboard', 'finance', 'agenda', 'agenda:all', 'clientes', 'servicos', 'usuarios'],
  recepcao: ['dashboard', 'agenda', 'agenda:all', 'clientes'],
  profissional: ['agenda'],
}

export function can(role: Role | undefined, p: Permission) {
  return !!role && PERMS[role].includes(p)
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administradora',
  recepcao: 'Recepção',
  profissional: 'Profissional',
}
