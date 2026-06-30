// src/components/dashboard/HomeModule.tsx
// Dashboard principal: saludo, cuentas, KPIs, movimientos recientes

import { Component, ReactNode } from 'react'
import { Spinner } from '../shared'
import { useDashboard, Cuenta, Movimiento } from '../../hooks/useDashboard'
import { useAuth } from '../../context/AuthContext'

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
class ModuleErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">⚠️</span>
          <p className="font-display font-semibold text-gray-700 mb-1">Algo salió mal</p>
          <p className="text-gray-400 text-sm font-body mb-4">{this.state.message}</p>
          <button onClick={() => window.location.reload()}
            className="btn-primary text-sm px-5 py-2">Recargar página</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; sign: string; dot: string }> = {
  deposito:              { label: 'Depósito',      color: 'text-emerald-600', bg: 'bg-emerald-50', sign: '+', dot: 'bg-emerald-400' },
  transferencia_entrada: { label: 'Recibido',      color: 'text-emerald-600', bg: 'bg-emerald-50', sign: '+', dot: 'bg-emerald-400' },
  abono_interes:         { label: 'Interés',       color: 'text-blue-600',    bg: 'bg-blue-50',    sign: '+', dot: 'bg-blue-400' },
  desembolso_credito:    { label: 'Desembolso',    color: 'text-violet-600',  bg: 'bg-violet-50',  sign: '+', dot: 'bg-violet-400' },
  retiro:                { label: 'Retiro',        color: 'text-red-500',     bg: 'bg-red-50',     sign: '-', dot: 'bg-red-400' },
  transferencia_salida:  { label: 'Transferencia', color: 'text-red-500',     bg: 'bg-red-50',     sign: '-', dot: 'bg-red-400' },
  pago_credito:          { label: 'Pago cuota',    color: 'text-orange-600',  bg: 'bg-orange-50',  sign: '-', dot: 'bg-orange-400' },
  cargo_comision:        { label: 'Comisión',      color: 'text-gray-500',    bg: 'bg-gray-100',   sign: '-', dot: 'bg-gray-400' },
}
function tipoCfg(tipo: string) {
  return TIPO_CONFIG[tipo] ?? { label: tipo, color: 'text-gray-500', bg: 'bg-gray-100', sign: '', dot: 'bg-gray-300' }
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({ cuenta, primary }: { cuenta: Cuenta; primary: boolean }) {
  const labelMap: Record<string, string> = {
    ahorros_libre:         'Cuenta de Ahorros',
    ahorros_plazo_fijo:    'Ahorros Plazo Fijo',
    cuenta_corriente:      'Cuenta Corriente',
    cuenta_remuneraciones: 'Cuenta Remuneraciones',
  }

  if (primary) {
    return (
      <div className="relative rounded-2xl p-6 text-white overflow-hidden shadow-violet"
        style={{ background: 'linear-gradient(135deg, #7A1D8A 0%, #430e4f 60%, #1e0524 100%)' }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-white/50 text-xs font-body uppercase tracking-widest mb-1">
                {labelMap[cuenta.tipo_cuenta] ?? cuenta.tipo_cuenta}
              </p>
              <p className="text-white/60 font-mono text-sm tracking-wider">{cuenta.numero_cuenta}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/15 text-white font-body">
              {cuenta.estado}
            </span>
          </div>
          <p className="text-white/50 text-xs font-body mb-1">Saldo disponible</p>
          <p className="font-display font-bold text-3xl text-white">{fmt(cuenta.saldo, cuenta.moneda)}</p>
          {cuenta.tasa_interes_anual != null && cuenta.tasa_interes_anual > 0 && (
            <p className="text-white/40 text-xs font-body mt-3">TEA {cuenta.tasa_interes_anual}% · {cuenta.moneda}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6 bg-white border border-gray-100 shadow-card">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-1">
            {labelMap[cuenta.tipo_cuenta] ?? cuenta.tipo_cuenta}
          </p>
          <p className="text-gray-500 font-mono text-sm">{cuenta.numero_cuenta}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-body ${
          cuenta.estado === 'activa' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>{cuenta.estado}</span>
      </div>
      <p className="text-gray-400 text-xs font-body mb-1">Saldo disponible</p>
      <p className="font-display font-bold text-3xl text-charcoal">{fmt(cuenta.saldo, cuenta.moneda)}</p>
    </div>
  )
}

// ─── Empty welcome state (new user) ──────────────────────────────────────────
function WelcomeNewUser({ nombre, onNavigate }: { nombre: string; onNavigate: (m: string) => void }) {
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-gray-400 font-body text-sm mb-1">{greeting()},</p>
        <h1 className="font-display font-bold text-3xl text-charcoal leading-tight">
          {nombre} <span className="text-violet-500">🎉</span>
        </h1>
        <p className="text-gray-400 font-body text-sm mt-1">Bienvenido a Alfin Banco</p>
      </div>

      {/* Welcome card */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #7A1D8A 0%, #430e4f 60%, #1e0524 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <span className="text-4xl block mb-4">🏦</span>
          <h2 className="font-display font-bold text-xl text-white mb-2">¡Tu cuenta está lista!</h2>
          <p className="text-white/70 font-body text-sm leading-relaxed mb-5">
            Tu cuenta de ahorros fue creada automáticamente. Empieza realizando tu primer depósito.
          </p>
          <button onClick={() => onNavigate('ahorros')} className="btn-accent text-sm px-5 py-2.5">
            Ir a Ahorros →
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display font-semibold text-base text-charcoal mb-4">¿Qué quieres hacer hoy?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '💰', label: 'Depositar',    mod: 'ahorros'  },
            { icon: '📤', label: 'Transferir',   mod: 'ahorros'  },
            { icon: '💳', label: 'Pedir crédito',mod: 'creditos' },
            { icon: '👤', label: 'Mi perfil',    mod: 'perfil'   },
          ].map(a => (
            <button key={a.label} onClick={() => onNavigate(a.mod)}
              className="bg-white border border-gray-100 rounded-2xl p-4 text-center hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 shadow-card group">
              <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform duration-200">{a.icon}</span>
              <p className="text-sm font-body font-medium text-gray-600">{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main HomeModule ──────────────────────────────────────────────────────────
function HomeModuleInner({ onNavigate }: { onNavigate: (mod: string) => void }) {
  const { usuario } = useAuth()
  const { data, loading, error, refetch } = useDashboard()

  const firstName = (
    data?.usuario?.nombre_completo ??
    usuario?.nombre_completo ??
    usuario?.email ??
    'Cliente'
  ).split(' ')[0]

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── API error (not 404) ────────────────────────────────────────────────────
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-red-400" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
        </svg>
      </div>
      <p className="font-display font-semibold text-gray-700 mb-1">No se pudo cargar tu panel</p>
      <p className="text-gray-400 text-sm font-body mb-4">{error}</p>
      <button onClick={refetch} className="btn-primary text-sm px-5 py-2">Reintentar</button>
    </div>
  )

  // ── New user: no dashboard data yet ────────────────────────────────────────
  if (!data) return <WelcomeNewUser nombre={firstName} onNavigate={onNavigate} />

  // ── Normal dashboard ───────────────────────────────────────────────────────
  const cuentas       = data.cuentas ?? []
  const movimientos   = data.ultimos_movimientos ?? []
  const saldoTotal    = data.saldo_total_pen ?? 0
  const proximaCuota  = data.proxima_cuota ?? null

  return (
    <div className="space-y-8 animate-fade-up" style={{ animationDuration: '0.5s' }}>

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-gray-400 font-body text-sm mb-1">{greeting()},</p>
          <h1 className="font-display font-bold text-3xl text-charcoal leading-tight">
            {firstName} <span className="text-violet-500">👋</span>
          </h1>
          <p className="text-gray-400 font-body text-sm mt-1">
            DNI: <span className="font-mono font-semibold text-gray-600">{data.usuario?.dni ?? usuario?.dni ?? '—'}</span>
            {' · '}Banca digital
          </p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-500 transition-colors font-body self-start sm:self-auto">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Saldo total PEN',    value: fmt(saldoTotal),                   sub: 'disponible',   color: 'text-violet-600' },
          { label: 'Cuentas activas',    value: String(cuentas.length),             sub: 'cuentas',      color: 'text-emerald-600' },
          { label: 'Créditos activos',   value: String(data.creditos_activos ?? 0), sub: 'en proceso',   color: 'text-orange-600' },
          {
            label: 'Próx. cuota',
            value: proximaCuota ? fmt(proximaCuota.monto_cuota) : '—',
            sub:   proximaCuota ? `en ${proximaCuota.dias_para_vencer} días` : 'Sin vencimientos',
            color: proximaCuota && proximaCuota.dias_para_vencer <= 7 ? 'text-red-500' : 'text-gray-700',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
            <p className="text-gray-400 text-xs font-body mb-2">{kpi.label}</p>
            <p className={`font-display font-bold text-xl leading-none ${kpi.color}`}>{kpi.value}</p>
            <p className="text-gray-400 text-xs font-body mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Próxima cuota alert */}
      {proximaCuota && proximaCuota.dias_para_vencer <= 10 && (
        <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 border ${
          proximaCuota.dias_para_vencer <= 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <span className="text-xl flex-shrink-0">
            {proximaCuota.dias_para_vencer <= 3 ? '🚨' : '⏰'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`font-display font-semibold text-sm ${
              proximaCuota.dias_para_vencer <= 3 ? 'text-red-700' : 'text-amber-700'
            }`}>
              {proximaCuota.dias_para_vencer <= 3
                ? `¡Tu cuota vence en ${proximaCuota.dias_para_vencer} día(s)!`
                : `Cuota próxima a vencer (${proximaCuota.dias_para_vencer} días)`}
            </p>
            <p className={`text-xs font-body mt-0.5 ${
              proximaCuota.dias_para_vencer <= 3 ? 'text-red-600' : 'text-amber-600'
            }`}>
              Crédito {proximaCuota.numero_credito} · Cuota #{proximaCuota.numero_cuota} · {fmt(proximaCuota.monto_cuota)}
            </p>
          </div>
          <button onClick={() => onNavigate('creditos')}
            className={`text-xs font-body font-semibold flex-shrink-0 px-3 py-1.5 rounded-lg transition-colors ${
              proximaCuota.dias_para_vencer <= 3
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}>
            Ver
          </button>
        </div>
      )}

      {/* Account cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-base text-charcoal">Mis cuentas</h2>
          <button onClick={() => onNavigate('ahorros')}
            className="text-xs text-violet-500 hover:text-violet-600 font-body font-medium transition-colors">
            Ver movimientos →
          </button>
        </div>
        {cuentas.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {cuentas.map((c, i) => <AccountCard key={c.id} cuenta={c} primary={i === 0} />)}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-card">
            <p className="text-gray-400 font-body text-sm">No tienes cuentas activas.</p>
          </div>
        )}
      </div>

      {/* Last movements */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-base text-charcoal">Últimos movimientos</h2>
          <button onClick={() => onNavigate('ahorros')}
            className="text-xs text-violet-500 hover:text-violet-600 font-body font-medium transition-colors">
            Ver todos →
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          {movimientos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                    <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                    <th className="text-right py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movimientos.slice(0, 5).map((mov: Movimiento) => {
                    const cfg = tipoCfg(mov.tipo)
                    return (
                      <tr key={mov.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 text-xs text-gray-400 font-body whitespace-nowrap">{fmtDate(mov.fecha)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <div>
                              <p className="text-sm text-charcoal font-body font-medium leading-none mb-0.5">
                                {mov.descripcion ?? cfg.label}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">{mov.referencia}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-medium ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-display font-bold text-sm whitespace-nowrap ${cfg.color}`}>
                          {cfg.sign}{fmt(mov.monto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-gray-500 font-display font-semibold text-sm mb-1">Sin movimientos aún</p>
              <p className="text-gray-400 font-body text-xs">Tus transacciones aparecerán aquí</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display font-semibold text-base text-charcoal mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '📤', label: 'Transferir',   mod: 'ahorros'  },
            { icon: '💰', label: 'Depositar',    mod: 'ahorros'  },
            { icon: '💳', label: 'Mis créditos', mod: 'creditos' },
            { icon: '👤', label: 'Mi perfil',    mod: 'perfil'   },
          ].map(a => (
            <button key={a.label} onClick={() => onNavigate(a.mod)}
              className="bg-white border border-gray-100 rounded-2xl p-4 text-center hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 shadow-card group">
              <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform duration-200">{a.icon}</span>
              <p className="text-sm font-body font-medium text-gray-600">{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HomeModule({ onNavigate }: { onNavigate: (mod: string) => void }) {
  return (
    <ModuleErrorBoundary>
      <HomeModuleInner onNavigate={onNavigate} />
    </ModuleErrorBoundary>
  )
}
