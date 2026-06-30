// src/pages/DashboardPage.tsx — Solo para clientes
// Staff nunca llega aquí (ProtectedRoute los redirige a /core)

import { useState, Component, ReactNode } from 'react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import HomeModule     from '../components/dashboard/HomeModule'
import AhorrosModule  from '../components/dashboard/AhorrosModule'
import CreditosModule from '../components/dashboard/CreditosModule'
import PerfilModule   from '../components/dashboard/PerfilModule'
import { useDashboard } from '../hooks/useDashboard'

type Module = 'home' | 'ahorros' | 'creditos' | 'perfil'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, msg: '' } }
  static getDerivedStateFromError(e: Error) { return { hasError: true, msg: e.message } }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center bg-pearl px-4">
        <div className="text-center max-w-md">
          <span className="text-6xl block mb-4">😕</span>
          <h1 className="font-display font-bold text-2xl text-charcoal mb-2">Algo salió mal</h1>
          <p className="text-gray-400 font-body text-sm mb-6">{this.state.msg}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => this.setState({ hasError: false, msg: '' })} className="btn-primary text-sm px-5 py-2.5">Reintentar</button>
            <button onClick={() => { localStorage.clear(); window.location.href = '/login' }}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-body hover:bg-gray-50 transition-colors">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    )
    return this.props.children
  }
}

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<Module>('home')
  const { data } = useDashboard()

  function renderModule() {
    switch (activeModule) {
      case 'home':     return <HomeModule onNavigate={m => setActiveModule(m as Module)} />
      case 'ahorros':  return <AhorrosModule />
      case 'creditos': return <CreditosModule />
      case 'perfil':   return <PerfilModule />
      default:         return <HomeModule onNavigate={m => setActiveModule(m as Module)} />
    }
  }

  return (
    <ErrorBoundary>
      <DashboardLayout
        activeModule={activeModule}
        onModuleChange={m => setActiveModule(m as Module)}
        creditosActivos={data?.creditos_activos ?? 0}
      >
        {renderModule()}
      </DashboardLayout>
    </ErrorBoundary>
  )
}
