// src/components/core/MoraModule.tsx
// Módulo de Recuperaciones: R1 (bandas + KPIs), R2 (gestiones), R3 (judicial/castigo)

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { moraApi, BandaKpi, CreditoMora, Gestion, RDSResult } from '../../services/moraApi'
import { Spinner, Alert } from '../shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string) {
  try { return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) }
  catch { return iso }
}

const BANDA_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string; desc: string }> = {
  al_dia:     { label: 'Al día',       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500', desc: '0 días' },
  preventiva: { label: 'Preventiva',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500',    desc: '1–30 días' },
  temprana:   { label: 'Temprana',     color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500',   desc: '31–60 días' },
  tardia:     { label: 'Tardía',       color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  dot: 'bg-orange-500',  desc: '61–120 días' },
  judicial:   { label: 'Judicial',     color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500',     desc: '121–180 días' },
  castigo:    { label: 'Castigo',      color: 'text-gray-700',    bg: 'bg-gray-100',    border: 'border-gray-300',    dot: 'bg-gray-500',    desc: '>180 días' },
}
function bandaCfg(b: string) { return BANDA_CONFIG[b] ?? BANDA_CONFIG['al_dia'] }

const TIPO_GESTION_LABELS: Record<string, string> = {
  llamada_telefonica: '📞 Llamada', visita_domiciliaria: '🏠 Visita',
  correo_electronico: '📧 Correo',  whatsapp: '💬 WhatsApp',
  carta_notarial: '📄 Carta notarial', acuerdo_pago: '🤝 Acuerdo',
  promesa_pago: '🗓 Promesa', refinanciamiento: '🔄 Refinanciamiento',
}
const RESULTADO_LABELS: Record<string, string> = {
  contactado_compromiso: '✅ Contactado c/ compromiso',
  contactado_sin_compromiso: '⚠️ Contactado s/ compromiso',
  no_contactado: '❌ No contactado', numero_errado: '📵 Número errado',
  acuerdo_alcanzado: '🤝 Acuerdo alcanzado', rechazo_pago: '🚫 Rechazó pago',
  promesa_incumplida: '⏰ Promesa incumplida',
}

function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
}

// ─── R1: Banda card ───────────────────────────────────────────────────────────
function BandaCard({ banda, onSelect, selected }: {
  banda: BandaKpi; onSelect: () => void; selected: boolean
}) {
  const cfg = bandaCfg(banda.banda)
  const bInfo = BANDA_CONFIG[banda.banda]

  return (
    <button onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
        selected ? `${cfg.bg} ${cfg.border} shadow-md` : 'bg-white border-gray-100 hover:shadow-card'
      }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          <span className={`font-display font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
        </div>
        <span className="text-gray-400 text-xs font-body">{bInfo?.desc}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display font-bold text-2xl text-charcoal">{banda.cantidad}</p>
          <p className="text-gray-400 text-xs font-body">créditos</p>
        </div>
        <div className="text-right">
          <p className={`font-display font-bold text-sm ${cfg.color}`}>{banda.porcentaje}%</p>
          <p className="text-gray-400 text-xs font-body">{fmt(banda.monto_capital)}</p>
        </div>
      </div>
      {banda.cantidad > 0 && (
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${cfg.dot} transition-all duration-700`}
            style={{ width: `${Math.min(banda.porcentaje * 5, 100)}%` }} />
        </div>
      )}
    </button>
  )
}

// ─── R2: Gestion form modal ───────────────────────────────────────────────────
function GestionModal({ credito, onClose, onSuccess }: {
  credito: CreditoMora; onClose: () => void; onSuccess: () => void
}) {
  const { accessToken } = useAuth()
  const [tipo, setTipo]     = useState('llamada_telefonica')
  const [resultado, setRes] = useState('contactado_compromiso')
  const [obs, setObs]       = useState('')
  const [monto, setMonto]   = useState('')
  const [fechaComp, setFechaComp] = useState('')
  const [proxGestion, setProxG]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setLoading(true); setError(null)
    try {
      await moraApi.registrarGestion(accessToken, credito.id, {
        tipo_gestion: tipo, resultado,
        observaciones: obs || undefined,
        monto_comprometido: monto ? parseFloat(monto) : undefined,
        fecha_compromiso: fechaComp || undefined,
        proxima_gestion: proxGestion || undefined,
      })
      onSuccess(); onClose()
    } catch (e: unknown) {
      setError((e as { error?: string }).error ?? 'Error al registrar.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-charcoal">📋 Registrar gestión</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{credito.numero_credito} · {credito.cliente}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 5.586L1.707.293.293 1.707 5.586 7 .293 12.293l1.414 1.414L7 8.414l5.293 5.293 1.414-1.414L8.414 7l5.293-5.293L12.293.293 7 5.586z"/></svg>
            </button>
          </div>
          {/* Info del crédito */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Días mora', v: String(credito.dias_mora) },
              { l: 'Banda', v: bandaCfg(credito.banda_mora).label },
              { l: 'Vencido', v: fmt(credito.monto_vencido) },
            ].map(i => (
              <div key={i.l} className="bg-gray-50 rounded-xl p-2">
                <p className="text-gray-400 text-[10px] font-body">{i.l}</p>
                <p className="font-display font-bold text-sm text-charcoal">{i.v}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-body font-medium text-gray-700 mb-1">Tipo de gestión</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="input-field text-sm">
                {Object.entries(TIPO_GESTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-700 mb-1">Resultado</label>
              <select value={resultado} onChange={e => setRes(e.target.value)} className="input-field text-sm">
                {Object.entries(RESULTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {(resultado === 'contactado_compromiso' || resultado === 'acuerdo_alcanzado') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">Monto comprometido (S/)</label>
                <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="input-field text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">Fecha compromiso</label>
                <input type="date" value={fechaComp} onChange={e => setFechaComp(e.target.value)} className="input-field text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-body font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className="input-field text-sm resize-none" placeholder="Detalla el resultado de la gestión..." />
          </div>

          <div>
            <label className="block text-xs font-body font-medium text-gray-700 mb-1">Próxima gestión</label>
            <input type="date" value={proxGestion} onChange={e => setProxG(e.target.value)} className="input-field text-sm" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-body hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-[2] btn-primary py-3 text-sm">
              {loading ? <><Spinner size="sm" color="white" />Guardando...</> : '✓ Registrar gestión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── R3: Transition confirm modal ─────────────────────────────────────────────
function TransicionModal({ credito, tipo, onClose, onSuccess }: {
  credito: CreditoMora
  tipo: 'judicial' | 'castigo'
  onClose: () => void
  onSuccess: () => void
}) {
  const { accessToken } = useAuth()
  const [obs, setObs]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleConfirm() {
    if (!accessToken) return
    setLoading(true); setError(null)
    try {
      if (tipo === 'judicial') {
        await moraApi.derivarJudicial(accessToken, credito.id, obs)
      } else {
        await moraApi.castigar(accessToken, credito.id, obs)
      }
      onSuccess(); onClose()
    } catch (e: unknown) {
      setError((e as { error?: string }).error ?? 'Error al procesar.')
    } finally { setLoading(false) }
  }

  const isJudicial = tipo === 'judicial'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="p-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isJudicial ? 'bg-red-50' : 'bg-gray-100'}`}>
            <span className="text-2xl">{isJudicial ? '⚖️' : '🗑️'}</span>
          </div>
          <h3 className="font-display font-bold text-lg text-charcoal text-center mb-1">
            {isJudicial ? 'Derivar a Cobranza Judicial' : 'Castigar Cartera (Write-Off)'}
          </h3>
          <p className="text-gray-500 text-sm text-center font-body mb-4">
            {isJudicial
              ? `Crédito ${credito.numero_credito} — ${credito.dias_mora} días de mora. Esta acción notifica al área legal.`
              : `Crédito ${credito.numero_credito} — ${credito.dias_mora} días. El castigo es una operación contable irreversible.`}
          </p>

          {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-3" />}

          <div className="mb-4">
            <label className="block text-xs font-body font-medium text-gray-700 mb-1">Motivo / Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className="input-field text-sm resize-none" placeholder="Describe el motivo de la transición..." />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-body hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className={`py-3 rounded-xl text-white text-sm font-display font-bold transition-colors ${
                isJudicial ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
              } ${loading ? 'opacity-80' : ''}`}>
              {loading ? <><Spinner size="sm" color="white" />...</> : isJudicial ? 'Confirmar' : 'Castigar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Credito mora row ─────────────────────────────────────────────────────────
function CreditoRow({ credito, rol, onGestion, onTransicion, onVerGestiones }: {
  credito: CreditoMora; rol: string
  onGestion: () => void
  onTransicion: (tipo: 'judicial' | 'castigo') => void
  onVerGestiones: () => void
}) {
  const cfg = bandaCfg(credito.banda_mora)
  const puedeJudicial = !credito.estado_judicial && credito.dias_mora >= 121 && ['riesgos','gerencia','admin'].includes(rol)
  const puedeCastigar = !credito.fecha_castigo && credito.dias_mora >= 181 && ['gerencia','admin'].includes(rol)

  return (
    <tr className={`group transition-colors ${credito.estado_judicial ? 'bg-red-50/30' : 'hover:bg-gray-50/60'}`}>
      <td className="py-3.5 px-4">
        <p className="font-mono text-xs text-gray-400 leading-none mb-0.5">{credito.numero_credito}</p>
        <p className="font-body font-semibold text-sm text-charcoal">{credito.cliente}</p>
        <p className="text-xs text-gray-400 font-mono">{credito.dni}</p>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <div>
            <p className={`text-xs font-body font-semibold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-gray-400 text-xs font-body">{credito.dias_mora} días</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4 hidden sm:table-cell">
        <p className="font-display font-bold text-sm text-red-600">{fmt(credito.monto_vencido)}</p>
        <p className="text-xs text-gray-400 font-body">{credito.cuotas_vencidas} cuota(s)</p>
      </td>
      <td className="py-3.5 px-4 hidden md:table-cell">
        <p className="text-xs text-gray-500 font-body">{credito.ultima_gestion ? fmtDate(credito.ultima_gestion) : '—'}</p>
        <p className="text-gray-400 text-xs font-body">{credito.total_gestiones} gestión(es)</p>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={onVerGestiones}
            className="px-2.5 py-1.5 rounded-lg text-xs font-body font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
            📋 Ver
          </button>
          <button onClick={onGestion}
            className="px-2.5 py-1.5 rounded-lg text-xs font-body font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
            + Gestión
          </button>
          {puedeJudicial && (
            <button onClick={() => onTransicion('judicial')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-body font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              ⚖️ Judicial
            </button>
          )}
          {puedeCastigar && (
            <button onClick={() => onTransicion('castigo')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-body font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              🗑️ Castigar
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Gestiones historial panel ────────────────────────────────────────────────
function GestionesPanel({ creditoId, onClose }: { creditoId: string; onClose: () => void }) {
  const { accessToken } = useAuth()
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!accessToken) return
    moraApi.listarGestiones(accessToken, creditoId)
      .then(setGestiones).catch(() => {}).finally(() => setLoading(false))
  }, [accessToken, creditoId])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="font-display font-semibold text-base text-charcoal">Historial de gestiones</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="md" color="violet" /></div>
          ) : gestiones.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-3xl block mb-2">📋</span>
              <p className="text-gray-400 text-sm font-body">Sin gestiones registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gestiones.map(g => (
                <div key={g.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-sm font-body font-semibold text-charcoal">
                      {TIPO_GESTION_LABELS[g.tipo_gestion] ?? g.tipo_gestion}
                    </span>
                    <span className="text-xs text-gray-400 font-body">{fmtDate(g.fecha_gestion)}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-body mb-1">{RESULTADO_LABELS[g.resultado] ?? g.resultado}</p>
                  {g.observaciones && <p className="text-xs text-gray-500 font-body italic">{g.observaciones}</p>}
                  {g.monto_comprometido && (
                    <p className="text-xs text-emerald-600 font-body mt-1">💰 Comprometido: {fmt(g.monto_comprometido)}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400 font-body">👤 {g.gestor}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-body ${bandaCfg(g.banda_mora_momento).bg} ${bandaCfg(g.banda_mora_momento).color}`}>
                      {g.dias_mora_momento} días
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MoraModule() {
  const { accessToken, usuario } = useAuth()
  const rol = usuario?.rol ?? 'analista'

  const [kpis, setKpis]       = useState<import('../../services/moraApi').KpisMora | null>(null)
  const [kLoading, setKLoad]  = useState(true)
  const [kError, setKError]   = useState<string | null>(null)

  const [bandaSeleccionada, setBanda] = useState<string | null>(null)
  const [creditos, setCreditos] = useState<CreditoMora[]>([])
  const [cLoading, setCLoad]   = useState(false)
  const [cTotal, setCTotal]    = useState(0)
  const [cPagina, setCPagina]  = useState(1)
  const [cPages, setCPages]    = useState(1)

  const [modalGestion, setModalGestion]     = useState<CreditoMora | null>(null)
  const [modalTransicion, setModalTransicion] = useState<{ credito: CreditoMora; tipo: 'judicial'|'castigo' } | null>(null)
  const [panelGestiones, setPanelGestiones]  = useState<string | null>(null)
  const [toast, setToast]                    = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // Load KPIs
  const loadKpis = useCallback(async () => {
    if (!accessToken) return
    setKLoad(true); setKError(null)
    try { setKpis(await moraApi.kpis(accessToken)) }
    catch (e: unknown) { setKError((e as { error?: string }).error ?? 'Error') }
    finally { setKLoad(false) }
  }, [accessToken])

  useEffect(() => { loadKpis() }, [loadKpis])

  // Load creditos by banda
  const loadCreditos = useCallback(async (banda: string, pagina: number) => {
    if (!accessToken) return
    setCLoad(true)
    try {
      const res = await moraApi.creditosPorBanda(accessToken, banda, pagina)
      setCreditos(res.items); setCTotal(res.total); setCPages(res.total_paginas)
    } catch { setCreditos([]) }
    finally { setCLoad(false) }
  }, [accessToken])

  useEffect(() => {
    if (bandaSeleccionada) { loadCreditos(bandaSeleccionada, cPagina) }
  }, [bandaSeleccionada, cPagina, loadCreditos])

  function handleSelectBanda(banda: string) {
    if (bandaSeleccionada === banda) { setBanda(null); return }
    setBanda(banda); setCPagina(1)
  }

  function handleRefresh() {
    loadKpis()
    if (bandaSeleccionada) loadCreditos(bandaSeleccionada, cPagina)
    showToast('Datos actualizados')
  }

  // ── Global KPIs summary ───────────────────────────────────────────────────
  const res = kpis?.resumen
  const moraColor = !res ? 'text-gray-400' : res.tasa_morosidad < 5 ? 'text-emerald-600' : res.tasa_morosidad < 15 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-fade-up">
            <span className="text-emerald-500">✓</span>
            <p className="text-sm font-body text-charcoal">{toast}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-charcoal">Recuperaciones / Mora</h1>
          <p className="text-gray-400 font-body text-sm mt-1">R1 · R2 · R3 — Gestión integral de cartera morosa</p>
        </div>
        <button onClick={handleRefresh} className="flex items-center gap-1.5 text-xs text-violet-500 font-body border border-violet-200 px-3 py-1.5 rounded-xl bg-white hover:border-violet-300 transition-colors self-start">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/><path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/></svg>
          Actualizar
        </button>
      </div>

      {/* Error */}
      {kError && !kLoading && (
        <Alert type="error" message={kError} onClose={loadKpis} />
      )}

      {/* ── R1: KPI strip ──────────────────────────────────────────────────── */}
      {kLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_,i) => <Sk key={i} className="h-24" />)}
        </div>
      ) : res && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-gray-400 text-xs font-body mb-1">Cartera total</p>
              <p className="font-display font-bold text-2xl text-charcoal">{res.total_cartera}</p>
              <p className="text-gray-400 text-xs font-body mt-1">créditos desembolsados</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-gray-400 text-xs font-body mb-1">En mora</p>
              <p className={`font-display font-bold text-2xl ${res.en_mora > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{res.en_mora}</p>
              <p className="text-gray-400 text-xs font-body mt-1">créditos con atraso</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-gray-400 text-xs font-body mb-1">Tasa morosidad</p>
              <p className={`font-display font-bold text-2xl ${moraColor}`}>{res.tasa_morosidad.toFixed(1)}%</p>
              <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${res.tasa_morosidad < 5 ? 'bg-emerald-500' : res.tasa_morosidad < 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(res.tasa_morosidad * 5, 100)}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-gray-400 text-xs font-body mb-1">Monto en mora</p>
              <p className="font-display font-bold text-xl text-red-600">{fmt(res.monto_en_mora)}</p>
              <p className="text-gray-400 text-xs font-body mt-1">{fmt(res.monto_total)} cartera total</p>
            </div>
          </div>

          {/* ── Bandas grid ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-base text-charcoal">Bandas de mora</h2>
              <p className="text-gray-400 text-xs font-body">Haz clic en una banda para ver los créditos</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpis?.bandas.map(banda => (
                <BandaCard key={banda.banda} banda={banda}
                  selected={bandaSeleccionada === banda.banda}
                  onSelect={() => handleSelectBanda(banda.banda)} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── R2 / R3: Tabla de créditos por banda ─────────────────────────── */}
      {bandaSeleccionada && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${bandaCfg(bandaSeleccionada).dot}`} />
              <h2 className="font-display font-semibold text-base text-charcoal">
                Créditos en banda: <span className={bandaCfg(bandaSeleccionada).color}>{bandaCfg(bandaSeleccionada).label}</span>
              </h2>
              <span className="text-xs text-gray-400 font-body">({cTotal} créditos)</span>
            </div>
            <button onClick={() => setBanda(null)} className="text-xs text-gray-400 hover:text-gray-600 font-body">✕ Cerrar</button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            {cLoading ? (
              <div className="flex justify-center py-10"><Spinner size="lg" color="violet" /></div>
            ) : creditos.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-4xl block mb-2">✅</span>
                <p className="text-gray-500 font-display font-semibold text-sm">Sin créditos en esta banda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      {['Cliente','Banda / Días','Monto vencido','Última gestión','Acciones'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {creditos.map(c => (
                      <CreditoRow key={c.id} credito={c} rol={rol}
                        onGestion={() => setModalGestion(c)}
                        onTransicion={(tipo) => setModalTransicion({ credito: c, tipo })}
                        onVerGestiones={() => setPanelGestiones(c.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {cPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-3 shadow-card">
              <p className="text-xs text-gray-400 font-body">Página {cPagina} de {cPages} · {cTotal} créditos</p>
              <div className="flex gap-2">
                <button disabled={cPagina <= 1} onClick={() => setCPagina(p => p - 1)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50 transition-colors">← Ant.</button>
                <button disabled={cPagina >= cPages} onClick={() => setCPagina(p => p + 1)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50 transition-colors">Sig. →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modalGestion && (
        <GestionModal credito={modalGestion}
          onClose={() => setModalGestion(null)}
          onSuccess={() => { showToast('Gestión registrada'); if (bandaSeleccionada) loadCreditos(bandaSeleccionada, cPagina); loadKpis() }} />
      )}
      {modalTransicion && (
        <TransicionModal credito={modalTransicion.credito} tipo={modalTransicion.tipo}
          onClose={() => setModalTransicion(null)}
          onSuccess={() => { showToast(modalTransicion.tipo === 'judicial' ? 'Derivado a judicial' : 'Crédito castigado'); if (bandaSeleccionada) loadCreditos(bandaSeleccionada, cPagina); loadKpis() }} />
      )}
      {panelGestiones && (
        <GestionesPanel creditoId={panelGestiones} onClose={() => setPanelGestiones(null)} />
      )}
    </div>
  )
}
