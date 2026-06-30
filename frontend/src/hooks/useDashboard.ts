// src/hooks/useDashboard.ts
// Custom hooks — fixed: loading never stuck, graceful 401/404 handling

import { useState, useEffect, useCallback } from 'react'
import { cuentasApi, creditosApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Cuenta {
  id: string
  numero_cuenta: string
  tipo_cuenta: string
  saldo: number
  moneda: string
  estado: string
  tasa_interes_anual: number | null
  fecha_creacion: string
}

export interface Movimiento {
  id: string
  tipo: string
  monto: number
  saldo_anterior: number
  saldo_posterior: number
  descripcion: string | null
  referencia: string
  canal: string | null
  fecha: string
}

export interface ProximaCuota {
  credito_id: string
  numero_credito: string
  numero_cuota: number
  monto_cuota: number
  fecha_vencimiento: string
  dias_para_vencer: number
}

export interface DashboardData {
  usuario: {
    id: string; email: string; nombre_completo: string
    dni: string; telefono: string | null; rol: string
    estado: string; fecha_registro: string
  }
  cuentas: Cuenta[]
  saldo_total_pen: number
  saldo_total_usd: number
  ultimos_movimientos: Movimiento[]
  creditos_activos: number
  proxima_cuota: ProximaCuota | null
}

export interface Credito {
  id: string
  numero_credito: string
  monto_solicitado: number
  monto_aprobado: number | null
  moneda: string
  estado: string
  tasa_interes: number
  tasa_tipo: string
  plazo_meses: number
  proposito: string | null
  observaciones: string | null
  fecha_solicitud: string
  fecha_decision: string | null
  fecha_desembolso: string | null
}

export interface Cuota {
  id: string
  numero_cuota: number
  monto_cuota: number
  monto_capital: number
  monto_interes: number
  saldo_capital: number
  fecha_vencimiento: string
  fecha_pago: string | null
  monto_pagado: number | null
  estado: string
}

// ─── useDashboard ─────────────────────────────────────────────────────────────
export function useDashboard() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Wait until auth context has finished loading
    if (authLoading) return
    // No token = not authenticated, stop loading immediately
    if (!accessToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await cuentasApi.dashboard(accessToken)
      setData(res as DashboardData)
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number }
      // 404 means user profile not synced yet — not a fatal error
      if (err?.status === 404) {
        setError(null)
        setData(null)
      } else {
        setError(err?.error ?? 'Error al cargar el dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, authLoading])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// ─── useMovimientos ───────────────────────────────────────────────────────────
export function useMovimientos(cuentaId: string | null, limite = 20) {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<{ movimientos: Movimiento[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!accessToken || !cuentaId) return
    setLoading(true); setError(null)
    try {
      const res = await cuentasApi.movimientos(accessToken, cuentaId, { limite })
      setData(res as { movimientos: Movimiento[]; total: number })
    } catch (e: unknown) {
      const err = e as { error?: string }
      setError(err?.error ?? 'Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }, [accessToken, cuentaId, limite])

  useEffect(() => { fetchData() }, [fetchData])
  return { data, loading, error, refetch: fetchData }
}

// ─── useCreditos ──────────────────────────────────────────────────────────────
export function useCreditos() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [data, setData]       = useState<Credito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (authLoading) return
    if (!accessToken) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await creditosApi.misCreditos(accessToken)
      setData(res as Credito[])
    } catch (e: unknown) {
      const err = e as { error?: string }
      setError(err?.error ?? 'Error al cargar créditos')
    } finally {
      setLoading(false)
    }
  }, [accessToken, authLoading])

  useEffect(() => { fetchData() }, [fetchData])
  return { data, loading, error, refetch: fetchData }
}

// ─── useCronograma ────────────────────────────────────────────────────────────
export function useCronograma(creditoId: string | null) {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<Cuota[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!accessToken || !creditoId) return
    setLoading(true); setError(null)
    try {
      const res = await creditosApi.cronograma(accessToken, creditoId)
      setData(res as Cuota[])
    } catch (e: unknown) {
      const err = e as { error?: string }
      setError(err?.error ?? 'Error al cargar cronograma')
    } finally {
      setLoading(false)
    }
  }, [accessToken, creditoId])

  useEffect(() => { fetchData() }, [fetchData])
  return { data, loading, error, refetch: fetchData }
}
