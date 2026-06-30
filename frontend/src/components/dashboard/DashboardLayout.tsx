// src/components/dashboard/DashboardLayout.tsx — Solo cliente
// Sin sección "Core bancario" en el sidebar

import { useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AlfinLogo } from '../shared'

const Icon = {
  Home:   () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>,
  Savings:() => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>,
  Credit: () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd"/><path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"/></svg>,
  Profile:() => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>,
  Menu:   () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  Logout: () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/></svg>,
}

const NAV = [
  { id: 'home',     label: 'Inicio',    icon: <Icon.Home /> },
  { id: 'ahorros',  label: 'Ahorros',   icon: <Icon.Savings /> },
  { id: 'creditos', label: 'Créditos',  icon: <Icon.Credit /> },
  { id: 'perfil',   label: 'Mi Perfil', icon: <Icon.Profile /> },
]

const LABELS: Record<string, string> = {
  home: 'Inicio', ahorros: 'Ahorros', creditos: 'Créditos', perfil: 'Mi Perfil',
}

interface Props {
  children: ReactNode
  activeModule: string
  onModuleChange: (m: string) => void
  creditosActivos?: number
}

export default function DashboardLayout({ children, activeModule, onModuleChange, creditosActivos }: Props) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
        <AlfinLogo variant="light" size="md" />
      </div>

      {/* User chip */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/[0.05]">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-display font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg,#FF4F00,#7A1D8A)' }}>
            {(usuario?.nombre_completo?.[0] ?? 'C').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-display font-semibold truncate leading-none mb-0.5">
              {usuario?.nombre_completo?.split(' ')[0] ?? 'Cliente'}
            </p>
            <p className="text-white/40 text-xs font-body truncate">{usuario?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-white/25 text-[10px] font-body font-semibold uppercase tracking-widest px-3 mb-2">Mi banca</p>
        {NAV.map(item => {
          const active = activeModule === item.id
          return (
            <button key={item.id}
              onClick={() => { onModuleChange(item.id); setMenuOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                active ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
              }`}>
              <span className={`flex-shrink-0 ${active ? 'text-violet-400' : 'text-white/40 group-hover:text-white/70'}`}>
                {item.icon}
              </span>
              <span className="font-body font-medium text-sm flex-1">{item.label}</span>
              {item.id === 'creditos' && (creditosActivos ?? 0) > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {creditosActivos}
                </span>
              )}
              {active && <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-3 border-t border-white/[0.06]">
        <button onClick={() => { logout(); navigate('/', { replace: true }) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-body">
          <Icon.Logout />Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f4f6]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#1a0d2e 0%,#0f0920 100%)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64"
            style={{ background: 'linear-gradient(180deg,#1a0d2e 0%,#0f0920 100%)' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 bg-white border-b border-gray-100 h-14 px-4 sm:px-6 flex items-center gap-4 shadow-sm">
          <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setMenuOpen(true)}>
            <Icon.Menu />
          </button>
          <div className="flex-1">
            <p className="text-xs font-body text-gray-400 hidden sm:block">
              Banca Digital · <span className="text-violet-500 font-medium">{LABELS[activeModule] ?? activeModule}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full font-body">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Sesión activa
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-display font-bold"
              style={{ background: 'linear-gradient(135deg,#FF4F00,#7A1D8A)' }}>
              {(usuario?.nombre_completo?.[0] ?? 'C').toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
