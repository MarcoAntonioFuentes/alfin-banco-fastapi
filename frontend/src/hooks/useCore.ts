// src/hooks/useCore.ts
// Custom hooks for Core Bancario — propagates HTTP status for better error UX

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  bandejaApi, reportesApi,
  BandejaResponse, ResumenCartera, DesembolsosResponse,
} from '../services/coreApi'

interface FetchError { message: string; status: number }

// ─── useBandeja ───────────────────────────────────────────────────────────────
export function useBandeja(estadoFiltro?: string, pagina = 1) {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<BandejaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<FetchError | null>(null)

  const fetch = useCallback(async () => {
    if (!accessToken) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      setData(await bandejaApi.listar(accessToken, estadoFiltro, pagina))
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number }
      setError({ message: err?.error ?? 'Error al cargar la bandeja', status: err?.status ?? 0 })
    } finally { setLoading(false) }
  }, [accessToken, estadoFiltro, pagina])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

// ─── useResumenCartera ────────────────────────────────────────────────────────
export function useResumenCartera() {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<ResumenCartera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<FetchError | null>(null)

  const fetch = useCallback(async () => {
    if (!accessToken) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      setData(await reportesApi.resumenCartera(accessToken))
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number }
      setError({ message: err?.error ?? 'Error al cargar resumen', status: err?.status ?? 0 })
    } finally { setLoading(false) }
  }, [accessToken])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

// ─── useDesembolsosHoy ────────────────────────────────────────────────────────
export function useDesembolsosHoy() {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<DesembolsosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<FetchError | null>(null)

  const fetch = useCallback(async () => {
    if (!accessToken) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      setData(await reportesApi.desembolsosHoy(accessToken))
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number }
      setError({ message: err?.error ?? 'Error al cargar desembolsos', status: err?.status ?? 0 })
    } finally { setLoading(false) }
  }, [accessToken])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}
