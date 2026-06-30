// src/components/core/CoreLayout.tsx — Solo staff
// Sidebar exclusivo del Core Bancario, sin sección "Mi banca"

import { useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AlfinLogo } from '../shared'

const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador', analista: 'Analista de Créditos', asesor: 'Asesor de Créditos',
  riesgos: 'Riesgos', comite: 'Comité Crediticio', gerencia: 'Gerencia',
}

const Icon = {
  Chart:  () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
  Inbox:  () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd"/></svg>,
  Wallet: () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>,
  Alert:  () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  Menu:   () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  Logout: () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/></svg>,
}

const NAV = [
  { id: 'reportes', label: 'Dashboard',     icon: <Icon.Chart /> },
  { id: 'bandeja',  label: 'Solicitudes',   icon: <Icon.Inbox /> },
  { id: 'cartera',  label: 'Cartera',       icon: <Icon.Wallet /> },
  { id: 'mora',     label: 'Recuperaciones',icon: <Icon.Alert /> },
]

const LABELS: Record<string, string> = {
  reportes: 'Dashboard', bandeja: 'Solicitudes', cartera: 'Cartera', mora: 'Recuperaciones',
}

interface Props {
  children: ReactNode
  activeModule: string
  onModuleChange: (m: string) => void
  pendingCount?: number
  moraCount?: number
}

export default function CoreLayout({ children, activeModule, onModuleChange, pendingCount, moraCount }: Props) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const rol = usuario?.rol ?? ''

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo + badge */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
        <AlfinLogo variant="light" size="md" />
        <span className="mt-3 inline-flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/25 text-orange-300 text-[10px] font-display font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Panel interno
        </span>
      </div>

      {/* User chip */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/[0.05]">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-display font-bold text-xs text-white"
            style={{ background: 'linear-gradient(135deg,#FF4F00,#7A1D8A)' }}>
            {(usuario?.nombre_completo?.[0] ?? 'S').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-display font-semibold truncate leading-none mb-0.5">
              {usuario?.nombre_completo?.split(' ')[0]}
            </p>
            <p className="text-white/40 text-[10px] font-body truncate">{ROL_LABELS[rol] ?? rol}</p>
          </div>
        </div>
      </div>

      {/* Nav — solo Core, sin sección cliente */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => {
          const active = activeModule === item.id
          const badge = item.id === 'bandeja' ? pendingCount : item.id === 'mora' ? moraCount : undefined
          return (
            <button key={item.id}
              onClick={() => { onModuleChange(item.id); setMenuOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                active ? 'bg-orange-500/20 text-orange-400' : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
              }`}>
              <span className={`flex-shrink-0 ${active ? 'text-orange-400' : 'text-white/40 group-hover:text-white/70'}`}>
                {item.icon}
              </span>
              <span className="font-body font-medium text-sm flex-1">{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom: solo logout — sin "Ir al Home Banking" porque staff no tiene cuenta de cliente */}
      <div className="px-3 pb-5 pt-3 border-t border-white/[0.06]">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-body">
          <Icon.Logout />Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f0f4]">
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#0f0920 0%,#1a0d2e 100%)' }}>
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64" style={{ background: 'linear-gradient(180deg,#0f0920 0%,#1a0d2e 100%)' }}>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 bg-white border-b border-gray-100 h-14 px-4 sm:px-6 flex items-center gap-4 shadow-sm">
          <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setMenuOpen(true)}>
            <Icon.Menu />
          </button>
          <div className="flex-1">
            <p className="text-xs font-body text-gray-400 hidden sm:block">
              Core Bancario · <span className="text-violet-500 font-medium">{LABELS[activeModule] ?? activeModule}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full font-body">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {ROL_LABELS[rol] ?? 'Staff'}
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-display font-bold"
              style={{ background: 'linear-gradient(135deg,#FF4F00,#7A1D8A)' }}>
              {(usuario?.nombre_completo?.[0] ?? 'S').toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
