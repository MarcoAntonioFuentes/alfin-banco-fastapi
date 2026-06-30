// src/components/core/CarteraModule.tsx
// Cartera activa: listado completo de créditos vigentes con estado de cuotas

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { reportesApi, CarteraItem } from '../../services/coreApi'
import { Spinner } from '../shared'

function fmt(n: number, cur = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: cur, minimumFractionDigits: 2,
  }).format(n)
}
function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso))
  } catch { return iso }
}

const ESTADO_CFG: Record<string, { bg: string; text: string; label: string }> = {
  enviado:       { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Enviado' },
  en_evaluacion: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Evaluando' },
  en_comite:     { bg: 'bg-purple-50',  text: 'text-purple-700',  label: 'En comité' },
  aprobado:      { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Aprobado' },
  desembolsado:  { bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'Desembolsado' },
  rechazado:     { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Rechazado' },
  pagado:        { bg: 'bg-gray-100',   text: 'text-gray-600',    label: 'Pagado' },
}
function estadoCfg(e: string) {
  return ESTADO_CFG[e] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: e }
}

function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

export default function CarteraModule() {
  const { accessToken } = useAuth()
  const [pagina, setPagina]     = useState(1)
  const [data, setData]         = useState<{ items: CarteraItem[]; total: number; total_paginas: number } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [searchTerm, setSearch] = useState('')

  const fetchData = useCallback(async (pg: number) => {
    if (!accessToken) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await reportesApi.carteraActiva(accessToken, pg, 25)
      setData(res)
    } catch (e: unknown) {
      setError((e as { error?: string }).error ?? 'Error al cargar la cartera')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchData(pagina) }, [fetchData, pagina])

  const items    = data?.items ?? []
  const filtered = searchTerm
    ? items.filter(i =>
        i.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.dni.includes(searchTerm) ||
        i.numero_credito.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : items

  const totalMonto = items
    .filter(i => i.estado === 'desembolsado')
    .reduce((s, i) => s + (i.monto_aprobado ?? 0), 0)
  const enMora     = items.filter(i => (i.cuotas_vencidas ?? 0) > 0).length
  const totalPages = data?.total_paginas ?? 1
  const total      = data?.total ?? 0

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationDuration: '0.4s' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-charcoal">Cartera Activa</h1>
          <p className="text-gray-400 font-body text-sm mt-1">
            {total} créditos · Total desembolsado:{' '}
            <span className="font-semibold text-violet-600">{fmt(totalMonto)}</span>
          </p>
        </div>
        <button
          onClick={() => fetchData(pagina)}
          className="flex items-center gap-1.5 text-xs text-violet-500 font-body border border-violet-200 px-3 py-1.5 rounded-xl bg-white hover:border-violet-300 transition-colors self-start"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Summary strip */}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total cartera',     value: fmt(totalMonto), color: 'text-violet-600' },
            { label: 'Créditos vigentes', value: String(total),   color: 'text-emerald-600' },
            { label: 'Con mora',          value: String(enMora),  color: enMora > 0 ? 'text-red-500' : 'text-gray-500' },
            { label: 'Tasa mora',
              value: total > 0 ? `${((enMora / total) * 100).toFixed(1)}%` : '0.0%',
              color: enMora > 0 ? 'text-red-500' : 'text-emerald-600' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <p className="text-gray-400 text-xs font-body mb-1">{kpi.label}</p>
              <p className={`font-display font-bold text-xl ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.099zm-5.242 1.656a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/>
          </svg>
        </span>
        <input
          type="text"
          placeholder="Buscar por cliente, DNI o nro. crédito..."
          value={searchTerm}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <Sk key={i} className="h-10" />)}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 font-body text-sm mb-3">{error}</p>
            <button onClick={() => fetchData(pagina)} className="btn-primary text-sm px-5 py-2">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-3">🔍</span>
            <p className="font-display font-semibold text-sm text-charcoal mb-1">
              {searchTerm ? 'Sin resultados' : 'Cartera vacía'}
            </p>
            <p className="text-gray-400 text-xs font-body">
              {searchTerm
                ? 'Intenta con otro nombre, DNI o número de crédito.'
                : 'Los créditos desembolsados aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {['Crédito / Cliente','Monto','Condiciones','Estado','Cuotas','Analista','Desembolso'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-body font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item: CarteraItem) => {
                  const cfg      = estadoCfg(item.estado)
                  const conMora  = (item.cuotas_vencidas ?? 0) > 0
                  return (
                    <tr key={item.id}
                      className={`group transition-colors ${conMora ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50/60'}`}>

                      <td className="py-3.5 px-4">
                        <p className="font-mono text-xs text-gray-400 leading-none mb-0.5">{item.numero_credito}</p>
                        <p className="font-body font-semibold text-sm text-charcoal">{item.cliente}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.dni}</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-display font-bold text-sm text-charcoal">
                          {item.monto_aprobado ? fmt(item.monto_aprobado, item.moneda) : '—'}
                        </p>
                        <p className="text-xs text-gray-400 font-body">{item.moneda}</p>
                      </td>

                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <p className="text-sm text-gray-600 font-body">{item.plazo_meses} meses</p>
                        <p className="text-xs text-gray-400 font-body">{item.tasa_interes}% TEA</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell">
                        {item.cuotas_pendientes !== null ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-body text-gray-600">
                              <span className="font-semibold">{item.cuotas_pendientes}</span> pendientes
                            </p>
                            {conMora && (
                              <p className="text-xs font-body text-red-600 font-semibold">
                                ⚠ {item.cuotas_vencidas} vencidas
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <p className="text-xs text-gray-500 font-body truncate max-w-[100px]">
                          {item.analista ?? '—'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <p className="text-xs text-gray-400 font-body whitespace-nowrap">
                          {item.fecha_desembolso ? fmtDate(item.fecha_desembolso) : '—'}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-card px-5 py-3">
          <p className="text-xs text-gray-400 font-body">
            Página {pagina} de {totalPages} · {total} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-body text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              ← Anterior
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const pg = i + 1
              return (
                <button key={pg} onClick={() => setPagina(pg)}
                  className={`w-8 h-8 rounded-lg text-xs font-body font-medium transition-colors ${
                    pagina === pg ? 'bg-violet-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {pg}
                </button>
              )
            })}
            <button
              disabled={pagina >= totalPages}
              onClick={() => setPagina(p => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-body text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
