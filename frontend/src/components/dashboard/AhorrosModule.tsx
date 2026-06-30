// src/components/dashboard/AhorrosModule.tsx
// Módulo de Ahorros: historial de movimientos + formularios de depósito y transferencia

import { useState, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDashboard, useMovimientos, Movimiento } from '../../hooks/useDashboard'
import { cuentasApi } from '../../services/api'
import { Alert, Spinner } from '../shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; sign: string; dot: string }> = {
  deposito:              { label: 'Depósito',       color: 'text-emerald-600', bg: 'bg-emerald-50',  sign: '+', dot: 'bg-emerald-400' },
  transferencia_entrada: { label: 'Recibido',       color: 'text-emerald-600', bg: 'bg-emerald-50',  sign: '+', dot: 'bg-emerald-400' },
  abono_interes:         { label: 'Interés',        color: 'text-blue-600',    bg: 'bg-blue-50',     sign: '+', dot: 'bg-blue-400' },
  desembolso_credito:    { label: 'Desembolso',     color: 'text-violet-600',  bg: 'bg-violet-50',   sign: '+', dot: 'bg-violet-400' },
  retiro:                { label: 'Retiro',         color: 'text-red-500',     bg: 'bg-red-50',      sign: '-', dot: 'bg-red-400' },
  transferencia_salida:  { label: 'Transferencia',  color: 'text-red-500',     bg: 'bg-red-50',      sign: '-', dot: 'bg-red-400' },
  pago_credito:          { label: 'Pago cuota',     color: 'text-orange-600',  bg: 'bg-orange-50',   sign: '-', dot: 'bg-orange-400' },
  cargo_comision:        { label: 'Comisión',       color: 'text-gray-500',    bg: 'bg-gray-100',    sign: '-', dot: 'bg-gray-400' },
}
function tipoCfg(tipo: string) {
  return TIPO_CONFIG[tipo] ?? { label: tipo, color: 'text-gray-500', bg: 'bg-gray-100', sign: '', dot: 'bg-gray-300' }
}

// ─── Deposit Form ─────────────────────────────────────────────────────────────

function DepositForm({ cuentaId, onSuccess }: { cuentaId: string; onSuccess: () => void }) {
  const { accessToken } = useAuth()
  const [monto, setMonto]       = useState('')
  const [desc, setDesc]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [alert, setAlert]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [errMonto, setErrMonto] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setAlert(null)
    const val = parseFloat(monto)
    if (!monto || isNaN(val) || val <= 0)  { setErrMonto('Ingresa un monto mayor a S/ 0.'); return }
    if (val > 100000)                       { setErrMonto('El máximo por operación es S/ 100,000.'); return }
    setErrMonto('')
    setLoading(true)
    try {
      await cuentasApi.depositar(accessToken!, { cuenta_id: cuentaId, monto: val, descripcion: desc || undefined })
      setAlert({ type: 'success', msg: `Depósito de ${fmt(val)} realizado exitosamente. Tu saldo ha sido actualizado.` })
      setMonto(''); setDesc('')
      onSuccess()
    } catch (err: unknown) {
      const e = err as { error?: string }
      setAlert({ type: 'error', msg: e?.error ?? 'Error al procesar el depósito. Intenta nuevamente.' })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Monto a depositar</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-body text-sm font-semibold">S/</span>
          <input type="number" min="0.01" step="0.01" placeholder="0.00" value={monto}
            onChange={e => { setMonto(e.target.value); setErrMonto('') }}
            className={`input-field pl-9 ${errMonto ? 'error' : ''}`} />
        </div>
        {errMonto && <p className="mt-1.5 text-red-500 text-xs font-body">{errMonto}</p>}
      </div>
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Descripción <span className="text-gray-400">(opcional)</span></label>
        <input type="text" maxLength={200} placeholder="Ej: Depósito de sueldo" value={desc}
          onChange={e => setDesc(e.target.value)} className="input-field" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? <><Spinner size="sm" color="white" />Procesando...</> : <>Confirmar depósito</>}
      </button>
    </form>
  )
}

// ─── Transfer Form ────────────────────────────────────────────────────────────

function TransferForm({ cuentaOrigenId, onSuccess }: { cuentaOrigenId: string; onSuccess: () => void }) {
  const { accessToken } = useAuth()
  const [destino, setDestino]   = useState('')
  const [monto, setMonto]       = useState('')
  const [desc, setDesc]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [alert, setAlert]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setAlert(null)
    const errs: Record<string, string> = {}
    const val = parseFloat(monto)
    if (!destino.trim()) errs.destino = 'Ingresa el número de cuenta destino.'
    if (!destino.match(/^\d{4}-\d{4}-\d{8}$/) && destino.trim())
      errs.destino = 'Formato inválido. Ej: 0110-1234-56789012'
    if (!monto || isNaN(val) || val <= 0) errs.monto = 'Ingresa un monto mayor a S/ 0.'
    if (val > 50000) errs.monto = 'El límite por transferencia es S/ 50,000.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await cuentasApi.transferir(accessToken!, {
        cuenta_origen_id: cuentaOrigenId,
        cuenta_destino_numero: destino.trim(),
        monto: val,
        descripcion: desc || undefined,
      })
      setAlert({ type: 'success', msg: `Transferencia de ${fmt(val)} enviada a cuenta ${destino}. Operación completada.` })
      setDestino(''); setMonto(''); setDesc('')
      onSuccess()
    } catch (err: unknown) {
      const e = err as { error?: string; status?: number }
      const msg = e?.status === 404 ? 'Cuenta destino no encontrada o inactiva.'
                : e?.status === 400 ? (e?.error ?? 'Saldo insuficiente o límite diario excedido.')
                : e?.error ?? 'Error al procesar la transferencia.'
      setAlert({ type: 'error', msg })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Cuenta destino</label>
        <input type="text" placeholder="0110-1234-56789012" value={destino}
          onChange={e => { setDestino(e.target.value); setErrors(p => ({...p, destino: ''})) }}
          className={`input-field font-mono ${errors.destino ? 'error' : ''}`} />
        {errors.destino && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.destino}</p>}
      </div>
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Monto</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-body text-sm font-semibold">S/</span>
          <input type="number" min="0.01" max="50000" step="0.01" placeholder="0.00" value={monto}
            onChange={e => { setMonto(e.target.value); setErrors(p => ({...p, monto: ''})) }}
            className={`input-field pl-9 ${errors.monto ? 'error' : ''}`} />
        </div>
        {errors.monto && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.monto}</p>}
        <p className="mt-1 text-gray-400 text-xs font-body">Límite diario: S/ 50,000</p>
      </div>
      <div>
        <label className="block text-sm font-body font-medium text-gray-700 mb-1.5">Descripción <span className="text-gray-400">(opcional)</span></label>
        <input type="text" maxLength={200} placeholder="Ej: Pago de alquiler" value={desc}
          onChange={e => setDesc(e.target.value)} className="input-field" />
      </div>
      <button type="submit" disabled={loading} className="btn-accent w-full py-3">
        {loading ? <><Spinner size="sm" color="white" />Procesando...</> : <>Enviar transferencia</>}
      </button>
    </form>
  )
}

// ─── Movements Table ─────────────────────────────────────────────────────────

function MovimientosTable({ cuentaId, onRefresh }: { cuentaId: string; onRefresh: () => void }) {
  const [filtro, setFiltro]    = useState('')
  const { data, loading, error, refetch } = useMovimientos(cuentaId, 30)

  const movimientos: Movimiento[] = data?.movimientos ?? []
  const filtered = filtro
    ? movimientos.filter(m => m.tipo === filtro)
    : movimientos

  function handleRefresh() { refetch(); onRefresh() }

  return (
    <div>
      {/* Table header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-semibold text-base text-charcoal">Historial de movimientos</h3>
          <p className="text-gray-400 text-xs font-body mt-0.5">{data?.total ?? 0} operaciones totales</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filtro} onChange={e => setFiltro(e.target.value)}
            className="text-xs font-body border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400">
            <option value="">Todos los tipos</option>
            <option value="deposito">Depósitos</option>
            <option value="retiro">Retiros</option>
            <option value="transferencia_salida">Transferencias enviadas</option>
            <option value="transferencia_entrada">Transferencias recibidas</option>
            <option value="pago_credito">Pagos de crédito</option>
          </select>
          <button onClick={handleRefresh}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-violet-500 hover:border-violet-200 transition-colors bg-white">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" color="violet" /></div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 font-body text-sm">{error}</p>
            <button onClick={handleRefresh} className="mt-3 text-violet-500 text-xs font-body hover:underline">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-gray-500 font-display font-semibold text-sm mb-1">Sin movimientos</p>
            <p className="text-gray-400 font-body text-xs">
              {filtro ? 'No hay movimientos para el filtro seleccionado.' : 'Tus transacciones aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                  <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                  <th className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                  <th className="text-right py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                  <th className="text-right py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(mov => {
                  const cfg = tipoCfg(mov.tipo)
                  return (
                    <tr key={mov.id} className="group hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-xs text-gray-400 font-body whitespace-nowrap">{fmtDate(mov.fecha)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <div>
                            <p className="text-sm text-charcoal font-body font-medium leading-none mb-0.5">{mov.descripcion ?? cfg.label}</p>
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
                      <td className="py-3 px-4 text-right text-xs text-gray-400 font-mono hidden md:table-cell">
                        {fmt(mov.saldo_posterior)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab component ────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-body font-medium transition-all duration-200 ${
        active ? 'bg-white text-violet-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'
      }`}>
      {children}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AhorrosModule() {
  const { data, loading, refetch } = useDashboard()
  const [tab, setTab]   = useState<'movimientos' | 'depositar' | 'transferir'>('movimientos')

  const cuentas       = data?.cuentas ?? []
  const cuentaPrincipal = cuentas[0]

  if (loading) return (
    <div className="space-y-4">
      <div className="animate-pulse h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>

      {/* Page header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-charcoal">Ahorros y Movimientos</h1>
        <p className="text-gray-400 font-body text-sm mt-1">Consulta tu historial y realiza operaciones</p>
      </div>

      {/* Account summary row */}
      {cuentaPrincipal && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg, #7A1D8A, #430e4f)' }}>
            <p className="text-white/50 text-xs font-body mb-1">Saldo disponible</p>
            <p className="font-display font-bold text-2xl">{fmt(cuentaPrincipal.saldo)}</p>
            <p className="text-white/40 text-xs font-mono mt-1">{cuentaPrincipal.numero_cuenta}</p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-gray-400 text-xs font-body mb-1">Tipo de cuenta</p>
            <p className="font-display font-semibold text-charcoal text-sm">
              {{ ahorros_libre: 'Ahorros Libre', ahorros_plazo_fijo: 'Plazo Fijo', cuenta_corriente: 'Corriente', cuenta_remuneraciones: 'Remuneraciones' }[cuentaPrincipal.tipo_cuenta] ?? cuentaPrincipal.tipo_cuenta}
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-gray-400 text-xs font-body mb-1">TEA</p>
            <p className="font-display font-semibold text-emerald-600 text-lg">{cuentaPrincipal.tasa_interes_anual ?? 0}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        <Tab active={tab === 'movimientos'}  onClick={() => setTab('movimientos')}>📋 Movimientos</Tab>
        <Tab active={tab === 'depositar'}   onClick={() => setTab('depositar')}>💰 Depositar</Tab>
        <Tab active={tab === 'transferir'}  onClick={() => setTab('transferir')}>📤 Transferir</Tab>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'movimientos' && cuentaPrincipal && (
          <MovimientosTable cuentaId={cuentaPrincipal.id} onRefresh={refetch} />
        )}

        {tab === 'movimientos' && !cuentaPrincipal && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 font-body text-sm">No tienes cuentas activas aún.</p>
          </div>
        )}

        {(tab === 'depositar' || tab === 'transferir') && (
          <div className="max-w-lg">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <h3 className="font-display font-semibold text-base text-charcoal mb-1">
                {tab === 'depositar' ? '💰 Realizar depósito' : '📤 Transferencia a otra cuenta'}
              </h3>
              <p className="text-gray-400 font-body text-sm mb-5">
                {tab === 'depositar'
                  ? 'Acredita fondos a tu cuenta. Máximo S/ 100,000 por operación.'
                  : 'Transfiere fondos a cualquier cuenta Alfin Banco. Límite diario: S/ 50,000.'}
              </p>

              {!cuentaPrincipal ? (
                <p className="text-gray-400 font-body text-sm text-center py-6">No tienes cuentas activas para operar.</p>
              ) : tab === 'depositar' ? (
                <DepositForm cuentaId={cuentaPrincipal.id} onSuccess={refetch} />
              ) : (
                <TransferForm cuentaOrigenId={cuentaPrincipal.id} onSuccess={refetch} />
              )}
            </div>

            {/* Info note */}
            <div className="mt-4 flex items-start gap-2.5 text-xs text-gray-400 font-body">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-300">
                <path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0 1A8 8 0 118 0a8 8 0 010 16zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 110-2 1 1 0 010 2z"/>
              </svg>
              Las operaciones son inmediatas y se reflejan al instante en el saldo de tu cuenta.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
