import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider, Logo, ToastProvider } from './components/ui'
import { DataProvider } from './data/store'
import Home from './pages/Home'

// O painel só é baixado por quem entra nele
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-blush">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
      <DataProvider fallback={<Splash />}>
        <HashRouter>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </DataProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
