// src/pages/CorePage.tsx — Solo para staff (admin, analista, comite, riesgos, gerencia, asesor)
// Clientes nunca llegan aquí (ProtectedRoute los redirige a /dashboard)

import { useState, Component, ReactNode } from 'react'
import CoreLayout     from '../components/core/CoreLayout'
import ReportesModule from '../components/core/ReportesModule'
import BandejaModule  from '../components/core/BandejaModule'
import CarteraModule  from '../components/core/CarteraModule'
import MoraModule     from '../components/core/MoraModule'
import { useBandeja } from '../hooks/useCore'
import { useAuth } from '../context/AuthContext'
import { moraApi } from '../services/moraApi'
import { useState as useStateH, useEffect, useCallback } from 'react'

type Module = 'reportes' | 'bandeja' | 'cartera' | 'mora'

function useMoraCount() {
  const { accessToken } = useAuth()
  const [count, setCount] = useStateH(0)
  const fetch = useCallback(async () => {
    if (!accessToken) return
    try {
      const kpis = await moraApi.kpis(accessToken)
      setCount(kpis.resumen.en_mora)
    } catch { /* silencioso */ }
  }, [accessToken])
  useEffect(() => { fetch() }, [fetch])
  return count
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, msg: '' } }
  static getDerivedStateFromError(e: Error) { return { hasError: true, msg: e.message } }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center bg-pearl px-4">
        <div className="text-center max-w-md">
          <span className="text-6xl block mb-4">⚠️</span>
          <h1 className="font-display font-bold text-2xl text-charcoal mb-2">Error en el panel</h1>
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

export default function CorePage() {
  const [activeModule, setActiveModule] = useState<Module>('reportes')
  const { data: bandejaData } = useBandeja('enviado', 1)
  const moraCount = useMoraCount()

  function renderModule() {
    switch (activeModule) {
      case 'reportes': return <ReportesModule />
      case 'bandeja':  return <BandejaModule />
      case 'cartera':  return <CarteraModule />
      case 'mora':     return <MoraModule />
      default:         return <ReportesModule />
    }
  }

  return (
    <ErrorBoundary>
      <CoreLayout
        activeModule={activeModule}
        onModuleChange={m => setActiveModule(m as Module)}
        pendingCount={bandejaData?.total ?? 0}
        moraCount={moraCount}
      >
        {renderModule()}
      </CoreLayout>
    </ErrorBoundary>
  )
}
