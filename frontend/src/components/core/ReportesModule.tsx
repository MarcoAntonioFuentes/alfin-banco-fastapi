// src/components/core/ReportesModule.tsx
// Dashboard administrativo: KPIs, salud de cartera, desembolsos del día

import { useResumenCartera, useDesembolsosHoy } from '../../hooks/useCore'
import { Spinner } from '../shared'
import { DesembolsoHoy } from '../../services/coreApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, cur = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: cur, minimumFractionDigits: 2,
  }).format(n)
}
function fmtDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}
function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(iso))
  } catch { return iso }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string; value: string; sub?: string; icon: string
  color: 'violet'|'orange'|'emerald'|'red'|'blue'|'amber'
  trend?: { value: string; up: boolean }
}
const colorMap = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-100', text: 'text-violet-600',  icon: 'bg-violet-100'  },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-100', text: 'text-orange-600',  icon: 'bg-orange-100'  },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100',text: 'text-emerald-600', icon: 'bg-emerald-100' },
  red:     { bg: 'bg-red-50',     border: 'border-red-100',    text: 'text-red-600',     icon: 'bg-red-100'     },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',   text: 'text-blue-600',    icon: 'bg-blue-100'    },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',  text: 'text-amber-600',   icon: 'bg-amber-100'   },
}
function KpiCard({ label, value, sub, icon, color, trend }: KpiProps) {
  const c = colorMap[color]
  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-card p-5 hover:shadow-card-hover transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center text-xl`}>{icon}</div>
        {trend && (
          <span className={`text-xs font-body font-semibold px-2 py-1 rounded-full ${trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs font-body mb-1">{label}</p>
      <p className={`font-display font-bold text-2xl ${c.text} leading-none`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs font-body mt-1.5">{sub}</p>}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
}

// ─── Backend Error Panel ──────────────────────────────────────────────────────
function BackendError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white rounded-2xl border border-red-100 shadow-card overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
          <span className="text-2xl">🔌</span>
          <div>
            <p className="font-display font-semibold text-red-700">Backend no conectado</p>
            <p className="text-red-500 text-xs font-body">No se puede alcanzar el servidor FastAPI</p>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          <p className="text-gray-600 font-body text-sm">Sigue estos pasos para iniciar el backend:</p>

          {[
            { n: '1', label: 'Abre una terminal en la carpeta del backend', cmd: 'cd alfin_banco/backend' },
            { n: '2', label: 'Activa el entorno virtual', cmd: 'venv\\Scripts\\activate   (Windows)\nsource venv/bin/activate  (Mac/Linux)' },
            { n: '3', label: 'Inicia el servidor FastAPI', cmd: 'uvicorn app.main:app --reload --port 8000' },
          ].map(step => (
            <div key={step.n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 font-body mb-1.5">{step.label}</p>
                <div className="bg-gray-900 rounded-xl px-4 py-2.5">
                  <code className="text-green-400 text-xs font-mono whitespace-pre">{step.cmd}</code>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600 font-body">
            💡 Cuando veas <code className="bg-blue-100 px-1 rounded">Application startup complete</code> en la terminal, el servidor está listo.
          </div>

          <button onClick={onRetry}
            className="btn-primary w-full py-3 mt-2">
            Reintentar conexión
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportesModule() {
  const { data: kpis,  loading: kLoading, error: kError,  refetch: kRefetch }  = useResumenCartera()
  const { data: desemb,loading: dLoading, error: dError,  refetch: dRefetch }  = useDesembolsosHoy()

  const loading  = kLoading || dLoading
  const anyError = kError ?? dError

  function handleRefresh() { kRefetch(); dRefetch() }

  // ── Error handling by status ───────────────────────────────────────────────
  if (anyError && !loading) {
    const status = anyError.status
    const isNetworkError = status === 0
    const isAuthError    = status === 401 || status === 403
    const isServerError  = status >= 500

    if (isNetworkError) {
      return (
        <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>
          <div>
            <h1 className="font-display font-bold text-2xl text-charcoal">Dashboard Administrativo</h1>
            <p className="text-gray-400 font-body text-sm mt-1">Métricas en tiempo real de la cartera crediticia</p>
          </div>
          <BackendError onRetry={handleRefresh} />
        </div>
      )
    }

    return (
      <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>
        <div>
          <h1 className="font-display font-bold text-2xl text-charcoal">Dashboard Administrativo</h1>
        </div>
        <div className="max-w-lg">
          <div className="bg-white rounded-2xl border border-red-100 shadow-card p-6">
            <div className="flex items-start gap-4 mb-4">
              <span className="text-3xl">{isAuthError ? '🔒' : isServerError ? '💥' : '⚠️'}</span>
              <div>
                <p className="font-display font-semibold text-base text-charcoal mb-1">
                  {isAuthError ? 'Sin permisos' : isServerError ? 'Error en el servidor' : 'Error inesperado'}
                </p>
                <p className="text-gray-500 font-body text-sm">{anyError.message}</p>
                {isServerError && (
                  <p className="text-gray-400 font-body text-xs mt-2">
                    Revisa la terminal del backend para más detalles del error.
                  </p>
                )}
                {isAuthError && (
                  <p className="text-gray-400 font-body text-xs mt-2">
                    Tu usuario necesita rol de analista, comité o admin para acceder al Core Bancario.
                  </p>
                )}
              </div>
            </div>
            <button onClick={handleRefresh} className="btn-primary w-full py-3 text-sm">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-up" style={{ animationDuration: '0.4s' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-charcoal">Dashboard Administrativo</h1>
          <p className="text-gray-400 font-body text-sm mt-1">Métricas en tiempo real de la cartera crediticia</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-body hidden sm:block">
            {fmtDate(new Date().toISOString())}
          </span>
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-600 font-body border border-violet-200 px-3 py-1.5 rounded-xl bg-white transition-colors">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Sk key={i} className="h-32" />)}
        </div>
      ) : kpis ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Cartera Activa"      value={fmt(kpis.monto_total_desembolsado)}           sub={`${kpis.total_creditos_activos} créditos vigentes`}  icon="💼" color="violet" />
            <KpiCard label="Desembolsado Hoy"    value={fmt(desemb?.monto_total_pen ?? 0)}            sub={`${desemb?.total_operaciones ?? 0} operaciones`}      icon="💸" color="orange" />
            <KpiCard label="Pendiente de Cobro"  value={fmt(kpis.monto_total_pendiente_cobro)}        sub="Cuotas por vencer"                                    icon="📅" color="blue" />
            <KpiCard label="En Evaluación"       value={String(kpis.creditos_en_evaluacion)}          sub="Solicitudes activas"                                  icon="🔍" color="amber" />
            <KpiCard label="En Mora"             value={String(kpis.creditos_en_mora)}                sub={`Tasa: ${kpis.tasa_morosidad.toFixed(1)}%`}            icon="⚠️" color="red"
              trend={kpis.creditos_en_mora > 0 ? { value: `${kpis.tasa_morosidad.toFixed(1)}%`, up: false } : undefined} />
            <KpiCard label="Créditos Activos"    value={String(kpis.total_creditos_activos)}          sub="Vigentes"                                             icon="✅" color="emerald" />
            <KpiCard label="Operaciones Hoy"     value={String(kpis.desembolsos_hoy)}                 sub="Desembolsos del día"                                  icon="📊" color="violet" />
            <KpiCard label="Desemb. Hoy (USD)"   value={fmt(desemb?.monto_total_usd ?? 0, 'USD')}    sub="Dólares americanos"                                   icon="💵" color="emerald" />
          </div>

          {/* Summary panels */}
          <div className="grid sm:grid-cols-2 gap-5">

            {/* Salud de la cartera */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold text-base text-charcoal">Salud de la cartera</h3>
                <span className={`text-xs font-body font-semibold px-2.5 py-1 rounded-full ${
                  kpis.tasa_morosidad < 5  ? 'bg-emerald-50 text-emerald-600' :
                  kpis.tasa_morosidad < 10 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                }`}>
                  {kpis.tasa_morosidad < 5 ? '🟢 Saludable' : kpis.tasa_morosidad < 10 ? '🟡 Precaución' : '🔴 En riesgo'}
                </span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Al corriente',    value: kpis.total_creditos_activos - kpis.creditos_en_mora, max: Math.max(kpis.total_creditos_activos, 1), color: 'bg-emerald-500' },
                  { label: 'Cuotas vencidas', value: kpis.creditos_en_mora,                               max: Math.max(kpis.total_creditos_activos, 1), color: 'bg-red-400' },
                  { label: 'En evaluación',   value: kpis.creditos_en_evaluacion,                         max: Math.max(kpis.total_creditos_activos + kpis.creditos_en_evaluacion, 1), color: 'bg-amber-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs font-body mb-1.5">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-semibold text-charcoal">{item.value}</span>
                    </div>
                    <ProgressBar value={item.value} max={item.max} color={item.color} />
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-2 gap-3">
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="font-display font-bold text-xl text-violet-600">{kpis.tasa_morosidad.toFixed(2)}%</p>
                  <p className="text-gray-400 text-xs font-body mt-0.5">Tasa de morosidad</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="font-display font-bold text-xl text-emerald-600">
                    {kpis.total_creditos_activos > 0
                      ? (((kpis.total_creditos_activos - kpis.creditos_en_mora) / kpis.total_creditos_activos) * 100).toFixed(1)
                      : '100.0'}%
                  </p>
                  <p className="text-gray-400 text-xs font-body mt-0.5">Al corriente</p>
                </div>
              </div>
            </div>

            {/* Desembolsos del día */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-base text-charcoal">Desembolsos del día</h3>
                <span className="text-xs text-gray-400 font-body">
                  {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </span>
              </div>

              {dLoading ? (
                <div className="flex justify-center py-8"><Spinner size="md" color="violet" /></div>
              ) : !desemb || desemb.desembolsos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-4xl mb-3">📭</span>
                  <p className="text-gray-500 font-display font-semibold text-sm">Sin desembolsos hoy</p>
                  <p className="text-gray-400 text-xs font-body mt-1">Los desembolsos ejecutados aparecerán aquí</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="font-display font-bold text-xl text-orange-600">{fmt(desemb.monto_total_pen)}</p>
                      <p className="text-gray-400 text-xs font-body mt-0.5">Total en soles</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="font-display font-bold text-xl text-blue-600">{desemb.total_operaciones}</p>
                      <p className="text-gray-400 text-xs font-body mt-0.5">Operaciones</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {desemb.desembolsos.map((d: DesembolsoHoy) => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-gray-400 leading-none mb-0.5">{d.numero_credito}</p>
                          <p className="font-body font-medium text-sm text-charcoal truncate">{d.cliente}</p>
                          <p className="text-gray-400 text-xs font-body">{d.dni} · {d.plazo_meses}m · {d.tasa_interes}% TEA</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-display font-bold text-sm text-orange-600">
                            {fmt(d.monto_aprobado ?? 0, d.moneda)}
                          </p>
                          <p className="text-gray-400 text-xs font-body">
                            {d.fecha_desembolso
                              ? fmtDateTime(d.fecha_desembolso).split(',')[1]?.trim()
                              : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
