// src/components/core/AccionModal.tsx
// Modal de acciones sobre una solicitud de crédito

import { useState, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { bandejaApi, SolicitudBandeja } from '../../services/coreApi'
import { Alert, Spinner } from '../shared'

interface Props {
  solicitud: SolicitudBandeja
  accion: 'evaluar' | 'comite' | 'desembolsar' | 'asignar'
  onClose: () => void
  onSuccess: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n)
}

export default function AccionModal({ solicitud, accion, onClose, onSuccess }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [alert, setAlert]     = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  // Form fields
  const [score,        setScore]        = useState('700')
  const [tasa,         setTasa]         = useState(String(solicitud.tasa_interes))
  const [montoAprobado,setMontoAprobado]= useState(String(solicitud.monto_solicitado))
  const [plazo,        setPlazo]        = useState(String(solicitud.plazo_meses))
  const [recomendacion,setRecomendacion]= useState<'aprobar'|'rechazar'|'escalar_comite'>('aprobar')
  const [decision,     setDecision]     = useState<'aprobado'|'rechazado'>('aprobado')
  const [motivo,       setMotivo]       = useState('')
  const [obs,          setObs]          = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setAlert(null)
    setLoading(true)

    try {
      if (accion === 'evaluar') {
        await bandejaApi.evaluar(accessToken, solicitud.id, {
          score_crediticio:        parseInt(score),
          tasa_interes_propuesta:  parseFloat(tasa),
          monto_aprobado_propuesto:parseFloat(montoAprobado),
          plazo_meses_propuesto:   parseInt(plazo),
          recomendacion,
          observaciones:           obs || `Evaluación completada. Recomendación: ${recomendacion}.`,
        })
      } else if (accion === 'comite') {
        if (decision === 'rechazado' && !motivo.trim()) {
          setAlert({ type: 'error', msg: 'Debes ingresar el motivo de rechazo.' })
          setLoading(false); return
        }
        await bandejaApi.decisionComite(accessToken, solicitud.id, {
          decision,
          monto_aprobado:     decision === 'aprobado' ? parseFloat(montoAprobado) : undefined,
          tasa_interes_final: decision === 'aprobado' ? parseFloat(tasa) : undefined,
          plazo_meses_final:  decision === 'aprobado' ? parseInt(plazo) : undefined,
          motivo_rechazo:     decision === 'rechazado' ? motivo : undefined,
          observaciones:      obs || undefined,
        })
      } else if (accion === 'desembolsar') {
        await bandejaApi.desembolsar(accessToken, solicitud.id, obs || undefined)
      }

      setAlert({ type: 'success', msg: 'Operación realizada exitosamente.' })
      setTimeout(() => { onSuccess(); onClose() }, 900)
    } catch (err: unknown) {
      const e = err as { error?: string }
      setAlert({ type: 'error', msg: e?.error ?? 'Error al procesar la operación.' })
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    evaluar:    '🔍 Registrar Evaluación Crediticia',
    comite:     '🏛️ Decisión del Comité',
    desembolsar:'💸 Ejecutar Desembolso',
    asignar:    '👤 Asignar Analista',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-up"
        style={{ animationDuration: '0.3s' }}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-base text-charcoal">{titles[accion]}</h2>
            <p className="text-gray-400 text-xs font-mono mt-0.5">{solicitud.numero_credito} · {solicitud.cliente}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ml-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 5.586L1.707.293.293 1.707 5.586 7 .293 12.293l1.414 1.414L7 8.414l5.293 5.293 1.414-1.414L8.414 7l5.293-5.293L12.293.293 7 5.586z"/>
            </svg>
          </button>
        </div>

        {/* Credit info strip */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-gray-400 text-xs font-body">Solicitado</p>
              <p className="font-display font-bold text-sm text-charcoal">{fmt(solicitud.monto_solicitado)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-body">Plazo</p>
              <p className="font-display font-bold text-sm text-charcoal">{solicitud.plazo_meses} meses</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-body">Propósito</p>
              <p className="font-body text-xs text-gray-600 truncate">{solicitud.proposito ?? '—'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

          {/* ── EVALUAR ─────────────────────────────────────────────────── */}
          {accion === 'evaluar' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-body font-medium text-gray-700 mb-1">Score crediticio</label>
                  <input type="number" min="0" max="999" value={score}
                    onChange={e => setScore(e.target.value)}
                    className="input-field text-sm" placeholder="0-999" />
                  {/* Score indicator */}
                  {score && (
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        parseInt(score) >= 750 ? 'bg-emerald-500' :
                        parseInt(score) >= 600 ? 'bg-amber-500' : 'bg-red-400'
                      }`} style={{ width: `${(parseInt(score)/999)*100}%` }} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-body font-medium text-gray-700 mb-1">TEA propuesta (%)</label>
                  <input type="number" min="0" max="200" step="0.1" value={tasa}
                    onChange={e => setTasa(e.target.value)}
                    className="input-field text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-body font-medium text-gray-700 mb-1">Monto aprobado (S/)</label>
                  <input type="number" min="0" step="100" value={montoAprobado}
                    onChange={e => setMontoAprobado(e.target.value)}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-body font-medium text-gray-700 mb-1">Plazo (meses)</label>
                  <input type="number" min="1" max="120" value={plazo}
                    onChange={e => setPlazo(e.target.value)}
                    className="input-field text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">Recomendación</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['aprobar','rechazar','escalar_comite'] as const).map(r => (
                    <button key={r} type="button"
                      onClick={() => setRecomendacion(r)}
                      className={`py-2 px-2 rounded-xl text-xs font-body font-semibold border transition-all ${
                        recomendacion === r
                          ? r === 'aprobar' ? 'bg-emerald-500 border-emerald-500 text-white'
                            : r === 'rechazar' ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-violet-500 border-violet-500 text-white'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {r === 'aprobar' ? '✓ Aprobar' : r === 'rechazar' ? '✕ Rechazar' : '↑ Comité'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">
                  Observaciones del análisis <span className="text-red-400">*</span>
                </label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
                  placeholder="Detalla los criterios del análisis crediticio (mínimo 20 caracteres)..."
                  className="input-field text-sm resize-none" />
              </div>
            </>
          )}

          {/* ── COMITÉ ──────────────────────────────────────────────────── */}
          {accion === 'comite' && (
            <>
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-2">Decisión final</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['aprobado','rechazado'] as const).map(d => (
                    <button key={d} type="button"
                      onClick={() => setDecision(d)}
                      className={`py-3 rounded-xl text-sm font-display font-bold border-2 transition-all ${
                        decision === d
                          ? d === 'aprobado'
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                            : 'bg-red-500 border-red-500 text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}>
                      {d === 'aprobado' ? '✓ APROBAR' : '✕ RECHAZAR'}
                    </button>
                  ))}
                </div>
              </div>

              {decision === 'aprobado' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-body font-medium text-gray-700 mb-1">Monto aprobado (S/)</label>
                    <input type="number" min="0" step="100" value={montoAprobado}
                      onChange={e => setMontoAprobado(e.target.value)}
                      className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-body font-medium text-gray-700 mb-1">TEA final (%)</label>
                    <input type="number" min="0" step="0.1" value={tasa}
                      onChange={e => setTasa(e.target.value)}
                      className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-body font-medium text-gray-700 mb-1">Plazo final (meses)</label>
                    <input type="number" min="1" max="120" value={plazo}
                      onChange={e => setPlazo(e.target.value)}
                      className="input-field text-sm" />
                  </div>
                </div>
              )}

              {decision === 'rechazado' && (
                <div>
                  <label className="block text-xs font-body font-medium text-gray-700 mb-1">
                    Motivo de rechazo <span className="text-red-400">*</span>
                  </label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                    placeholder="Explica detalladamente el motivo del rechazo..."
                    className="input-field text-sm resize-none" required />
                </div>
              )}

              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">Observaciones adicionales</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                  placeholder="Observaciones del comité (opcional)..."
                  className="input-field text-sm resize-none" />
              </div>
            </>
          )}

          {/* ── DESEMBOLSAR ─────────────────────────────────────────────── */}
          {accion === 'desembolsar' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div>
                    <p className="font-display font-semibold text-amber-700 text-sm">Operación irreversible</p>
                    <p className="text-amber-600 font-body text-xs mt-1 leading-relaxed">
                      Al confirmar, se acreditará <strong>{fmt(solicitud.monto_aprobado ?? solicitud.monto_solicitado)}</strong> a la cuenta del cliente y se generará el cronograma de pagos automáticamente.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {[
                  { label: 'Cliente',    value: solicitud.cliente },
                  { label: 'DNI',        value: solicitud.dni },
                  { label: 'Monto',      value: fmt(solicitud.monto_aprobado ?? solicitud.monto_solicitado) },
                  { label: 'TEA',        value: `${solicitud.tasa_interes}%` },
                  { label: 'Plazo',      value: `${solicitud.plazo_meses} meses` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500 font-body">{row.label}</span>
                    <span className="font-display font-semibold text-charcoal">{row.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-700 mb-1">Observaciones</label>
                <input type="text" value={obs} onChange={e => setObs(e.target.value)}
                  placeholder="Observaciones del desembolso (opcional)"
                  className="input-field text-sm" />
              </div>
            </>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-display font-semibold text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className={`flex-2 flex-grow flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold text-sm text-white transition-all ${
                accion === 'desembolsar' ? 'bg-orange-500 hover:bg-orange-600' :
                accion === 'comite' && decision === 'rechazado' ? 'bg-red-500 hover:bg-red-600' :
                'bg-violet-500 hover:bg-violet-600'
              } ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}>
              {loading
                ? <><Spinner size="sm" color="white" />Procesando...</>
                : accion === 'desembolsar' ? '💸 Confirmar desembolso'
                : accion === 'comite' ? (decision === 'aprobado' ? '✓ Aprobar crédito' : '✕ Rechazar crédito')
                : '✓ Guardar evaluación'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
