// src/components/core/BandejaModule.tsx
// Bandeja de flujo de aprobación crediticia

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useBandeja } from '../../hooks/useCore'
import { bandejaApi, SolicitudBandeja } from '../../services/coreApi'
import { Spinner, Alert } from '../shared'
import AccionModal from './AccionModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string) {
  try { return new Intl.DateTimeFormat('es-PE', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(iso)) }
  catch { return iso }
}

const ESTADO_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  enviado:       { label: 'Enviado',      dot: 'bg-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-700' },
  en_evaluacion: { label: 'Evaluando',    dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  en_comite:     { label: 'En comité',    dot: 'bg-purple-400', bg: 'bg-purple-50',  text: 'text-purple-700' },
  aprobado:      { label: 'Aprobado',     dot: 'bg-emerald-400',bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rechazado:     { label: 'Rechazado',    dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-700' },
  desembolsado:  { label: 'Desembolsado', dot: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-800' },
  cancelado:     { label: 'Cancelado',    dot: 'bg-gray-400',   bg: 'bg-gray-100',   text: 'text-gray-600' },
  pagado:        { label: 'Pagado',       dot: 'bg-gray-500',   bg: 'bg-gray-100',   text: 'text-gray-600' },
}
function estadoCfg(e: string) { return ESTADO_CFG[e] ?? { label: e, dot:'bg-gray-400', bg:'bg-gray-100', text:'text-gray-600' } }

const ESTADOS_FILTRO = [
  { value: '',              label: 'Todos' },
  { value: 'enviado',       label: 'Enviados' },
  { value: 'en_evaluacion', label: 'En evaluación' },
  { value: 'en_comite',     label: 'En comité' },
  { value: 'aprobado',      label: 'Aprobados' },
  { value: 'desembolsado',  label: 'Desembolsados' },
  { value: 'rechazado',     label: 'Rechazados' },
]

// ─── Action buttons per estado ────────────────────────────────────────────────
function getAcciones(estado: string, rol: string) {
  const acciones: { label: string; type: 'evaluar'|'comite'|'desembolsar'|'pasar'; color: string }[] = []

  if (estado === 'enviado' && ['analista','admin'].includes(rol)) {
    acciones.push({ label: '🔍 Evaluar', type: 'evaluar', color: 'bg-amber-500 hover:bg-amber-600 text-white' })
  }
  if (estado === 'en_evaluacion' && ['analista','admin'].includes(rol)) {
    acciones.push({ label: '📋 Resultado', type: 'evaluar', color: 'bg-amber-500 hover:bg-amber-600 text-white' })
  }
  if (estado === 'en_comite' && ['comite','admin'].includes(rol)) {
    acciones.push({ label: '🏛️ Decidir', type: 'comite', color: 'bg-purple-500 hover:bg-purple-600 text-white' })
  }
  if (estado === 'aprobado' && ['comite','admin'].includes(rol)) {
    acciones.push({ label: '💸 Desembolsar', type: 'desembolsar', color: 'bg-orange-500 hover:bg-orange-600 text-white' })
  }
  return acciones
}

// ─── Solicitud Row ────────────────────────────────────────────────────────────
function SolicitudRow({
  s, rol, onAccion, onPasar, pasando,
}: {
  s: SolicitudBandeja
  rol: string
  onAccion: (s: SolicitudBandeja, a: 'evaluar'|'comite'|'desembolsar') => void
  onPasar: (id: string) => void
  pasando: boolean
}) {
  const cfg     = estadoCfg(s.estado)
  const acciones = getAcciones(s.estado, rol)

  return (
    <tr className="group hover:bg-gray-50/70 transition-colors border-b border-gray-50 last:border-0">
      {/* Número + cliente */}
      <td className="py-3.5 px-4">
        <p className="font-mono text-xs text-gray-400 leading-none mb-0.5">{s.numero_credito}</p>
        <p className="font-body font-semibold text-sm text-charcoal">{s.cliente}</p>
        <p className="text-xs text-gray-400 font-mono">{s.dni}</p>
      </td>
      {/* Monto */}
      <td className="py-3.5 px-4 hidden sm:table-cell">
        <p className="font-display font-bold text-sm text-charcoal">{fmt(s.monto_solicitado)}</p>
        {s.monto_aprobado && (
          <p className="text-xs text-emerald-600 font-body">Aprobado: {fmt(s.monto_aprobado)}</p>
        )}
      </td>
      {/* Propósito + plazo */}
      <td className="py-3.5 px-4 hidden md:table-cell">
        <p className="text-sm text-gray-600 font-body">{s.proposito ?? '—'}</p>
        <p className="text-xs text-gray-400 font-body">{s.plazo_meses} meses · {s.tasa_interes}% TEA</p>
      </td>
      {/* Estado */}
      <td className="py-3.5 px-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-semibold ${cfg.bg} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </td>
      {/* Fecha */}
      <td className="py-3.5 px-4 hidden lg:table-cell">
        <p className="text-xs text-gray-400 font-body">{fmtDate(s.fecha_solicitud)}</p>
        {s.analista && <p className="text-xs text-gray-400 font-body truncate max-w-[100px]">👤 {s.analista}</p>}
      </td>
      {/* Acciones */}
      <td className="py-3.5 px-4">
        <div className="flex flex-wrap gap-1.5">
          {/* Pasar a "en_evaluacion" si está en enviado */}
          {s.estado === 'enviado' && ['analista','admin'].includes(rol) && (
            <button
              onClick={() => onPasar(s.id)}
              disabled={pasando}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50">
              {pasando ? <Spinner size="sm" color="violet" /> : '→'} Iniciar
            </button>
          )}
          {acciones.map(a => (
            <button key={a.type}
              onClick={() => onAccion(s, a.type)}
              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-body font-medium transition-colors ${a.color}`}>
              {a.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BandejaModule() {
  const { accessToken, usuario } = useAuth()
  const rol = usuario?.rol ?? 'analista'

  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina,       setPagina]       = useState(1)
  const { data, loading, error, refetch } = useBandeja(filtroEstado || undefined, pagina)

  const [modalSolicitud, setModalSolicitud] = useState<SolicitudBandeja | null>(null)
  const [modalAccion,    setModalAccion]    = useState<'evaluar'|'comite'|'desembolsar'|null>(null)
  const [pasandoId,      setPasandoId]      = useState<string | null>(null)
  const [toast,          setToast]          = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handlePasarEvaluacion(creditoId: string) {
    if (!accessToken) return
    setPasandoId(creditoId)
    try {
      await bandejaApi.evaluar(accessToken, creditoId, {
        score_crediticio: 0,
        tasa_interes_propuesta: data?.items.find(i => i.id === creditoId)?.tasa_interes ?? 18,
        recomendacion: 'escalar_comite',
        observaciones: 'Solicitud tomada para evaluación.',
      })
      showToast('Solicitud movida a En evaluación.')
      refetch()
    } catch (e: unknown) {
      showToast((e as { error?: string }).error ?? 'Error al actualizar estado.')
    } finally {
      setPasandoId(null)
    }
  }

  const solicitudes = data?.items ?? []
  const total       = data?.total ?? 0
  const totalPages  = data?.total_paginas ?? 1

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-charcoal">Bandeja de Créditos</h1>
          <p className="text-gray-400 font-body text-sm mt-1">
            {total} solicitudes {filtroEstado ? `en estado "${ESTADOS_FILTRO.find(e => e.value === filtroEstado)?.label}"` : 'totales'}
          </p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-600 font-body border border-violet-200 px-3 py-1.5 rounded-xl bg-white transition-colors self-start sm:self-auto">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-fade-up">
            <span className="text-emerald-500">✓</span>
            <p className="text-sm font-body text-charcoal">{toast}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-white rounded-2xl p-2 border border-gray-100 shadow-card w-fit">
        {ESTADOS_FILTRO.map(f => (
          <button key={f.value}
            onClick={() => { setFiltroEstado(f.value); setPagina(1) }}
            className={`px-3.5 py-2 rounded-xl text-xs font-body font-medium transition-all duration-200 ${
              filtroEstado === f.value
                ? 'bg-violet-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <Alert type="error" message={error} onClose={refetch} />}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="violet" /></div>
        ) : solicitudes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📭</span>
            <p className="font-display font-semibold text-base text-charcoal mb-1">Sin solicitudes</p>
            <p className="text-gray-400 font-body text-sm">
              {filtroEstado
                ? `No hay solicitudes en estado "${ESTADOS_FILTRO.find(e => e.value === filtroEstado)?.label}".`
                : 'No hay solicitudes registradas aún.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {['Cliente / Nro.','Monto','Propósito','Estado','Fecha','Acciones'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(s => (
                  <SolicitudRow
                    key={s.id} s={s} rol={rol}
                    pasando={pasandoId === s.id}
                    onPasar={handlePasarEvaluacion}
                    onAccion={(sol, accion) => { setModalSolicitud(sol); setModalAccion(accion) }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-body">
            Página {pagina} de {totalPages} · {total} solicitudes
          </p>
          <div className="flex gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-body text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              ← Anterior
            </button>
            <button disabled={pagina >= totalPages} onClick={() => setPagina(p => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-body text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalSolicitud && modalAccion && (
        <AccionModal
          solicitud={modalSolicitud}
          accion={modalAccion}
          onClose={() => { setModalSolicitud(null); setModalAccion(null) }}
          onSuccess={() => { refetch(); showToast('Operación aplicada exitosamente.') }}
        />
      )}
    </div>
  )
}
