// src/components/dashboard/CreditosModule.tsx — VERSIÓN ACTUALIZADA
// Agrega: campo ingreso_mensual, selector de producto, semáforo RDS en tiempo real
// REEMPLAZA tu CreditosModule.tsx actual

import { useState, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDashboard, useCreditos, useCronograma, Credito, Cuota } from '../../hooks/useDashboard'
import { creditosApi } from '../../services/api'
import { moraApi } from '../../services/moraApi'
import { Alert, Spinner, Badge } from '../shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, cur = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string) {
  try { return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) }
  catch { return iso }
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  enviado:       { label: 'Enviado',       color: 'text-blue-600',    bg: 'bg-blue-100',    step: 1 },
  en_evaluacion: { label: 'En evaluación', color: 'text-amber-600',   bg: 'bg-amber-100',   step: 2 },
  en_comite:     { label: 'En comité',     color: 'text-purple-600',  bg: 'bg-purple-100',  step: 3 },
  aprobado:      { label: 'Aprobado',      color: 'text-emerald-600', bg: 'bg-emerald-100', step: 4 },
  rechazado:     { label: 'Rechazado',     color: 'text-red-600',     bg: 'bg-red-100',     step: 0 },
  desembolsado:  { label: 'Desembolsado',  color: 'text-emerald-700', bg: 'bg-emerald-100', step: 5 },
  cancelado:     { label: 'Cancelado',     color: 'text-gray-500',    bg: 'bg-gray-100',    step: 0 },
  pagado:        { label: 'Pagado',        color: 'text-gray-600',    bg: 'bg-gray-100',    step: 6 },
}
function estadoCfg(estado: string) {
  return ESTADO_CONFIG[estado] ?? { label: estado, color: 'text-gray-500', bg: 'bg-gray-100', step: 0 }
}

// ─── Productos disponibles ─────────────────────────────────────────────────────
const PRODUCTOS = [
  { value: 'consumo',      label: 'Consumo personal',    icon: '💳', desc: 'S/ 500 – S/ 50,000 | 3–84 meses | TEA 18–25%' },
  { value: 'hipotecario',  label: 'Hipotecario',         icon: '🏠', desc: 'S/ 20,000 – S/ 500,000 | 60–240 meses | TEA 8–14%' },
  { value: 'vehicular',    label: 'Vehicular',           icon: '🚗', desc: 'S/ 5,000 – S/ 120,000 | 12–72 meses | TEA 12–20%' },
  { value: 'microempresa', label: 'Microempresa',        icon: '🏪', desc: 'S/ 1,000 – S/ 80,000 | 6–60 meses | TEA 20–28%' },
]

const TASAS_DEFAULT: Record<string, number> = {
  consumo: 20, hipotecario: 10.5, vehicular: 15, microempresa: 22,
}

// ─── RDS Semáforo component ────────────────────────────────────────────────────
interface RDSData {
  rds: number; semaforo: string; cuota_nueva: number
  carga_total: number; elegible: boolean; observacion: string; nivel_aprobacion: string
}

function RDSSemaforo({ data, loading }: { data: RDSData | null; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-2 py-2">
      <Spinner size="sm" color="violet" />
      <span className="text-xs text-gray-400 font-body">Calculando RDS...</span>
    </div>
  )
  if (!data) return null

  const colors = {
    verde:    { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    amarillo: { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
    rojo:     { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
  }
  const c = colors[data.semaforo as keyof typeof colors] ?? colors.rojo

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      {/* Header RDS */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${c.dot} animate-pulse`} />
          <span className={`font-display font-semibold text-sm ${c.text}`}>
            Semáforo RDS — {data.semaforo.charAt(0).toUpperCase() + data.semaforo.slice(1)}
          </span>
        </div>
        <span className={`text-xs font-display font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
          {data.rds.toFixed(1)}%
        </span>
      </div>

      {/* Barra de RDS */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-body text-gray-500 mb-1">
          <span>0%</span>
          <span className="text-emerald-600">30% Verde</span>
          <span className="text-amber-600">40% Amarillo</span>
          <span className="text-red-600">+40% Rojo</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
          {/* Zonas de color */}
          <div className="absolute inset-0 flex">
            <div className="h-full bg-emerald-200" style={{ width: '30%' }} />
            <div className="h-full bg-amber-200" style={{ width: '10%' }} />
            <div className="h-full bg-red-200 flex-1" />
          </div>
          {/* Indicador */}
          <div className={`absolute top-0 h-full ${c.dot} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(data.rds, 100)}%` }} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Cuota nueva', value: fmt(data.cuota_nueva) },
          { label: 'Carga total', value: fmt(data.carga_total) },
          { label: 'Nivel aprob.', value: data.nivel_aprobacion === 'analista' ? 'Analista' : data.nivel_aprobacion === 'comite' ? 'Comité' : 'Gerencia' },
        ].map(k => (
          <div key={k.label} className="bg-white/60 rounded-lg p-2 text-center">
            <p className="text-gray-400 text-[10px] font-body">{k.label}</p>
            <p className={`font-display font-bold text-xs ${c.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Observación */}
      <p className={`text-xs font-body ${c.text}`}>
        {data.elegible ? '✓' : '✕'} {data.observacion}
      </p>
    </div>
  )
}

// ─── Status Pipeline ───────────────────────────────────────────────────────────
function StatusPipeline({ estado }: { estado: string }) {
  const steps = [
    { key: 'enviado', label: 'Enviado' }, { key: 'en_evaluacion', label: 'Evaluación' },
    { key: 'en_comite', label: 'Comité' }, { key: 'aprobado', label: 'Aprobado' },
    { key: 'desembolsado', label: 'Desembolsado' },
  ]
  const cfg = estadoCfg(estado)
  if (estado === 'rechazado' || estado === 'cancelado') return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs">✕</span>
      <span className="text-red-600 text-xs font-body font-semibold">Solicitud {estado}</span>
    </div>
  )
  if (estado === 'pagado') return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✓</span>
      <span className="text-gray-600 text-xs font-body font-semibold">Crédito pagado</span>
    </div>
  )
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const stepNum = i + 1
        const isDone = stepNum < cfg.step
        const isCurrent = stepNum === cfg.step
        return (
          <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDone ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-violet-500 text-white ring-2 ring-violet-500/30' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? '✓' : stepNum}
              </div>
              <span className={`text-[9px] font-body whitespace-nowrap ${
                isDone ? 'text-emerald-600' : isCurrent ? 'text-violet-600 font-semibold' : 'text-gray-400'
              }`}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-5 h-0.5 mb-3 flex-shrink-0 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Credit request form ───────────────────────────────────────────────────────
function SolicitarCreditoForm({ cuentaId, onSuccess }: { cuentaId: string; onSuccess: () => void }) {
  const { accessToken } = useAuth()

  // Form fields
  const [producto,  setProducto]  = useState('consumo')
  const [monto,     setMonto]     = useState('')
  const [plazo,     setPlazo]     = useState('12')
  const [proposito, setProposito] = useState('')
  const [ingreso,   setIngreso]   = useState('')
  const [deuda,     setDeuda]     = useState('0')

  // RDS state
  const [rdsData,    setRdsData]    = useState<RDSData | null>(null)
  const [rdsLoading, setRdsLoading] = useState(false)
  const [rdsTimer,   setRdsTimer]   = useState<ReturnType<typeof setTimeout> | null>(null)

  // Submit state
  const [loading, setLoading] = useState(false)
  const [alert,   setAlert]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  // ── Calcular RDS en tiempo real con debounce ───────────────────────────────
  function triggerRDS(newMonto = monto, newPlazo = plazo, newIngreso = ingreso, newDeuda = deuda, newProducto = producto) {
    if (rdsTimer) clearTimeout(rdsTimer)
    const montoVal   = parseFloat(newMonto)
    const ingresoVal = parseFloat(newIngreso)
    if (!montoVal || !ingresoVal || montoVal <= 0 || ingresoVal <= 0) {
      setRdsData(null); return
    }
    const timer = setTimeout(async () => {
      setRdsLoading(true)
      try {
        const res = await moraApi.calcularRds({
          ingreso_mensual:       ingresoVal,
          deuda_mensual_actual:  parseFloat(newDeuda) || 0,
          monto_nuevo:           montoVal,
          tasa_tea:              TASAS_DEFAULT[newProducto] ?? 20,
          plazo_meses:           parseInt(newPlazo) || 12,
        })
        setRdsData(res as RDSData)
      } catch { setRdsData(null) }
      finally { setRdsLoading(false) }
    }, 600)
    setRdsTimer(timer)
  }

  function handleChange(field: string, value: string) {
    if (field === 'monto')    { setMonto(value);    triggerRDS(value, plazo, ingreso, deuda, producto) }
    if (field === 'plazo')    { setPlazo(value);    triggerRDS(monto, value, ingreso, deuda, producto) }
    if (field === 'ingreso')  { setIngreso(value);  triggerRDS(monto, plazo, value, deuda, producto) }
    if (field === 'deuda')    { setDeuda(value);    triggerRDS(monto, plazo, ingreso, value, producto) }
    if (field === 'producto') { setProducto(value); triggerRDS(monto, plazo, ingreso, deuda, value) }
    setErrors(p => ({ ...p, [field]: '' }))
    if (alert) setAlert(null)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    const val = parseFloat(monto)
    if (!monto || isNaN(val) || val <= 0) errs.monto = 'Ingresa el monto a solicitar.'
    if (val < 500)    errs.monto = 'El monto mínimo es S/ 500.'
    const p = parseInt(plazo)
    if (!plazo || isNaN(p) || p < 3) errs.plazo = 'El plazo mínimo es 3 meses.'
    if (!proposito || proposito.length < 5) errs.proposito = 'Describe el propósito del crédito.'
    if (!ingreso || parseFloat(ingreso) <= 0) errs.ingreso = 'Ingresa tu ingreso mensual para calcular el RDS.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setAlert(null)
    if (!validate()) return
    setLoading(true)
    try {
      await creditosApi.solicitar(accessToken!, {
        monto_solicitado:     parseFloat(monto),
        moneda:               'PEN',
        plazo_meses:          parseInt(plazo),
        producto,
        proposito,
        cuenta_desembolso_id: cuentaId,
        ingreso_mensual:      parseFloat(ingreso),
        deuda_mensual_actual: parseFloat(deuda) || 0,
      })
      setAlert({ type: 'success', msg: '¡Solicitud enviada! Tu crédito está en evaluación.' })
      setMonto(''); setPlazo('12'); setProposito(''); setIngreso(''); setDeuda('0'); setRdsData(null)
      onSuccess()
    } catch (err: unknown) {
      const e = err as { error?: string; status?: number }
      setAlert({ type: 'error', msg: e?.error ?? 'Error al enviar la solicitud.' })
    } finally { setLoading(false) }
  }

  const plazosDisponibles: Record<string, number[]> = {
    consumo:      [3,6,12,18,24,36,48,60,72,84],
    hipotecario:  [60,84,120,180,240],
    vehicular:    [12,24,36,48,60,72],
    microempresa: [6,12,18,24,36,48,60],
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {/* Selector de producto */}
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-2">Tipo de crédito</label>
        <div className="grid grid-cols-2 gap-2">
          {PRODUCTOS.map(p => (
            <button key={p.value} type="button" onClick={() => handleChange('producto', p.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                producto === p.value
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{p.icon}</span>
                <span className={`font-display font-semibold text-xs ${producto === p.value ? 'text-violet-700' : 'text-charcoal'}`}>
                  {p.label}
                </span>
              </div>
              <p className="text-gray-400 text-[10px] font-body leading-tight">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Monto y plazo */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Monto a solicitar</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-body text-sm font-semibold">S/</span>
            <input type="number" min="500" step="100" placeholder="Ej: 10000" value={monto}
              onChange={e => handleChange('monto', e.target.value)}
              className={`input-field pl-9 ${errors.monto ? 'error' : ''}`} />
          </div>
          {errors.monto && <p className="mt-1 text-red-500 text-xs font-body">{errors.monto}</p>}
        </div>
        <div>
          <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Plazo</label>
          <select value={plazo} onChange={e => handleChange('plazo', e.target.value)}
            className={`input-field ${errors.plazo ? 'error' : ''}`}>
            {(plazosDisponibles[producto] ?? [12,24,36]).map(m =>
              <option key={m} value={m}>{m} meses</option>
            )}
          </select>
        </div>
      </div>

      {/* Propósito */}
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Propósito del crédito</label>
        <input type="text" placeholder="Ej: Compra de vehículo de trabajo" value={proposito}
          onChange={e => { setProposito(e.target.value); setErrors(p => ({...p, proposito: ''})) }}
          className={`input-field ${errors.proposito ? 'error' : ''}`} />
        {errors.proposito && <p className="mt-1 text-red-500 text-xs font-body">{errors.proposito}</p>}
      </div>

      {/* Campos RDS */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-600 text-sm">📊</span>
          <p className="font-display font-semibold text-sm text-blue-700">Evaluación de capacidad de pago (RDS)</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-body font-medium text-gray-700 mb-1">
              Ingreso mensual neto <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">S/</span>
              <input type="number" min="0" step="100" placeholder="Ej: 3500" value={ingreso}
                onChange={e => handleChange('ingreso', e.target.value)}
                className={`input-field pl-8 text-sm ${errors.ingreso ? 'error' : ''}`} />
            </div>
            {errors.ingreso && <p className="mt-1 text-red-500 text-xs font-body">{errors.ingreso}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-700 mb-1">
              Deudas mensuales actuales
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">S/</span>
              <input type="number" min="0" step="10" placeholder="0.00" value={deuda}
                onChange={e => handleChange('deuda', e.target.value)}
                className="input-field pl-8 text-sm" />
            </div>
            <p className="text-gray-400 text-[10px] font-body mt-1">Cuotas de otros préstamos vigentes</p>
          </div>
        </div>

        {/* Semáforo RDS */}
        <RDSSemaforo data={rdsData} loading={rdsLoading} />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
        {loading ? <><Spinner size="sm" color="white" />Enviando solicitud...</> : 'Solicitar crédito'}
      </button>
    </form>
  )
}

// ─── Cronograma Table ──────────────────────────────────────────────────────────
function CronogramaTable({ creditoId }: { creditoId: string }) {
  const { data, loading, error } = useCronograma(creditoId)
  if (loading) return <div className="flex justify-center py-8"><Spinner size="md" color="violet" /></div>
  if (error)   return <p className="text-center text-gray-400 text-sm py-8">{error}</p>
  if (!data.length) return <p className="text-center text-gray-400 text-sm py-8">Sin cronograma.</p>

  const pagadas  = data.filter((c: Cuota) => c.estado === 'pagado').length
  const progress = Math.round((pagadas / data.length) * 100)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 border border-gray-100">
        <div className="flex justify-between text-xs font-body text-gray-500 mb-1.5">
          <span>{pagadas} de {data.length} cuotas pagadas</span>
          <span className="font-semibold text-violet-600">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-orange-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {['#','Cuota','Capital','Interés','Vencimiento','Estado'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((c: Cuota) => {
                const overdue = c.estado === 'pendiente' && new Date(c.fecha_vencimiento) < new Date()
                return (
                  <tr key={c.id} className={`transition-colors ${overdue ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}`}>
                    <td className="py-2.5 px-3 text-xs font-mono text-gray-500">{c.numero_cuota}</td>
                    <td className="py-2.5 px-3 font-display font-bold text-xs text-charcoal whitespace-nowrap">{fmt(c.monto_cuota)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-400 font-mono hidden sm:table-cell">{fmt(c.monto_capital)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-400 font-mono hidden sm:table-cell">{fmt(c.monto_interes)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600 font-body whitespace-nowrap">
                      {fmtDate(c.fecha_vencimiento)}{overdue && <span className="ml-1 text-red-500">⚠</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-body font-medium ${
                        c.estado === 'pagado' ? 'bg-emerald-50 text-emerald-600' :
                        overdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {c.estado === 'pagado' ? '✓ Pagado' : overdue ? 'Vencida' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Credit card ───────────────────────────────────────────────────────────────
function CreditoCard({ credito, onSelect, selected }: { credito: Credito; onSelect: () => void; selected: boolean }) {
  const cfg = estadoCfg(credito.estado)
  const canShowCronograma = ['aprobado','desembolsado','pagado'].includes(credito.estado)
  const rdsColor = (credito as any).rds_semaforo === 'verde' ? 'text-emerald-600' :
                   (credito as any).rds_semaforo === 'amarillo' ? 'text-amber-600' : 'text-red-600'

  return (
    <div className={`bg-white rounded-2xl border shadow-card transition-all duration-200 overflow-hidden ${
      selected ? 'border-violet-300 shadow-violet' : 'border-gray-100 hover:shadow-card-hover'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-mono text-xs text-gray-400 mb-0.5">{credito.numero_credito}</p>
            <p className="font-display font-bold text-xl text-charcoal">{fmt(credito.monto_solicitado, credito.moneda)}</p>
          </div>
          <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div><p className="text-gray-400 text-xs font-body">Plazo</p><p className="font-display font-semibold text-sm">{credito.plazo_meses}m</p></div>
          <div><p className="text-gray-400 text-xs font-body">TEA</p><p className="font-display font-semibold text-sm">{credito.tasa_interes}%</p></div>
          <div><p className="text-gray-400 text-xs font-body">Fecha</p><p className="font-body text-xs text-gray-600">{fmtDate(credito.fecha_solicitud)}</p></div>
        </div>

        {/* RDS si existe */}
        {(credito as any).rds_calculado && (
          <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2">
            <span className={`w-2 h-2 rounded-full ${
              (credito as any).rds_semaforo === 'verde' ? 'bg-emerald-500' :
              (credito as any).rds_semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span className="text-gray-500 text-xs font-body">RDS:</span>
            <span className={`font-display font-bold text-xs ${rdsColor}`}>
              {Number((credito as any).rds_calculado).toFixed(1)}% — {(credito as any).rds_semaforo}
            </span>
          </div>
        )}

        <StatusPipeline estado={credito.estado} />
      </div>

      {canShowCronograma && (
        <div className="border-t border-gray-50 px-5 py-3">
          <button onClick={onSelect}
            className={`w-full text-sm font-body font-medium py-2 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              selected ? 'bg-violet-50 text-violet-600' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50'
            }`}>
            📋 {selected ? 'Ocultar cronograma' : 'Ver cronograma de pagos'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreditosModule() {
  const { data: dashData }                                      = useDashboard()
  const { data: creditos, loading, error, refetch }             = useCreditos()
  const [tab, setTab]                                           = useState<'historial' | 'solicitar'>('historial')
  const [selectedCreditoId, setSelectedId]                      = useState<string | null>(null)

  const cuentaPrincipal = dashData?.cuentas?.[0]

  function TabBtn({ id, label, icon }: { id: 'historial' | 'solicitar'; label: string; icon: string }) {
    return (
      <button onClick={() => setTab(id)}
        className={`px-4 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-200 flex items-center gap-2 ${
          tab === id ? 'bg-white text-violet-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'
        }`}>
        <span>{icon}</span>{label}
      </button>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>
      <div>
        <h1 className="font-display font-bold text-2xl text-charcoal">Mis Créditos</h1>
        <p className="text-gray-400 font-body text-sm mt-1">Solicita y gestiona tus créditos con evaluación de RDS</p>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        <TabBtn id="historial" label="Historial" icon="📋" />
        <TabBtn id="solicitar" label="Solicitar crédito" icon="💳" />
      </div>

      {tab === 'historial' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" color="violet" /></div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-gray-400 font-body text-sm mb-3">{error}</p>
              <button onClick={refetch} className="btn-primary text-sm px-5 py-2">Reintentar</button>
            </div>
          ) : creditos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-card">
              <span className="text-5xl block mb-4">💳</span>
              <h3 className="font-display font-semibold text-base text-charcoal mb-2">Sin solicitudes aún</h3>
              <p className="text-gray-400 font-body text-sm mb-5">Solicita tu primer crédito de forma rápida.</p>
              <button onClick={() => setTab('solicitar')} className="btn-primary text-sm px-6 py-2.5">Solicitar mi primer crédito</button>
            </div>
          ) : (
            creditos.map(c => (
              <div key={c.id} className="space-y-3">
                <CreditoCard credito={c} selected={selectedCreditoId === c.id}
                  onSelect={() => setSelectedId(prev => prev === c.id ? null : c.id)} />
                {selectedCreditoId === c.id && (
                  <div className="pl-4 border-l-2 border-violet-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display font-semibold text-sm text-charcoal">Cronograma de pagos</h4>
                      <Badge variant="violet">{c.plazo_meses} cuotas</Badge>
                    </div>
                    <CronogramaTable creditoId={c.id} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'solicitar' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <h3 className="font-display font-semibold text-base text-charcoal mb-1">Nueva solicitud</h3>
            <p className="text-gray-400 font-body text-sm mb-5">El sistema calculará tu RDS en tiempo real.</p>
            {!cuentaPrincipal ? (
              <p className="text-center text-gray-400 font-body text-sm py-6">Necesitas una cuenta activa para solicitar un crédito.</p>
            ) : (
              <SolicitarCreditoForm cuentaId={cuentaPrincipal.id} onSuccess={() => { refetch(); setTab('historial') }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
