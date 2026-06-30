// src/services/coreApi.ts
// API client for Core Bancario — with proper error differentiation

const BASE_URL = '/api/v1';

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch (networkErr) {
    // Genuine network failure (backend not running, CORS blocked, etc.)
    console.error('[coreApi] Network error:', networkErr)
    throw {
      status: 0,
      error: 'Sin conexión con el servidor',
      detalle: 'El backend no responde. Verifica que uvicorn esté corriendo en el puerto 8000.',
    }
  }

  let body: unknown = null
  try {
    const ct = res.headers.get('content-type') ?? ''
    body = ct.includes('application/json') ? await res.json() : await res.text()
  } catch { body = null }

  if (!res.ok) {
    const err = body as { error?: string; detalle?: string; detail?: string | { msg: string }[] }
    let msg = `Error ${res.status}`
    if (err?.error)                      msg = err.error
    else if (typeof err?.detail === 'string') msg = err.detail
    else if (Array.isArray(err?.detail)) msg = err.detail.map(d => d.msg).join(', ')

    console.error(`[coreApi] HTTP ${res.status} ${path}:`, body)
    throw { status: res.status, error: msg, detalle: body }
  }
  return body as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolicitudBandeja {
  id: string; numero_credito: string; cliente: string; dni: string
  monto_solicitado: number; monto_aprobado: number | null; moneda: string
  estado: string; tasa_interes: number; plazo_meses: number; proposito: string | null
  score_crediticio: number | null; analista: string | null
  fecha_solicitud: string; observaciones: string | null
}

export interface BandejaResponse {
  items: SolicitudBandeja[]; total: number; pagina: number
  por_pagina: number; total_paginas: number
}

export interface ResumenCartera {
  total_creditos_activos: number; monto_total_desembolsado: number
  monto_total_pendiente_cobro: number; creditos_en_evaluacion: number
  creditos_en_mora: number; tasa_morosidad: number
  desembolsos_hoy: number; monto_desembolsado_hoy: number
}

export interface CarteraItem {
  id: string; numero_credito: string; cliente: string; dni: string
  monto_aprobado: number | null; moneda: string; estado: string
  tasa_interes: number; plazo_meses: number; fecha_solicitud: string
  fecha_desembolso: string | null; cuotas_pendientes: number | null
  cuotas_vencidas: number | null; analista: string | null
}

export interface DesembolsoHoy {
  id: string; numero_credito: string; cliente: string; dni: string
  monto_aprobado: number | null; moneda: string; tasa_interes: number
  plazo_meses: number; fecha_desembolso: string | null; aprobado_por: string | null
}

export interface DesembolsosResponse {
  fecha: string; total_operaciones: number
  monto_total_pen: number; monto_total_usd: number; desembolsos: DesembolsoHoy[]
}

// ─── Bandeja ──────────────────────────────────────────────────────────────────
export const bandejaApi = {
  listar: (token: string, estado?: string, pagina = 1, porPagina = 20) => {
    const qs = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) })
    if (estado) qs.set('estado', estado)
    return apiFetch<BandejaResponse>(`/creditos/bandeja?${qs}`, {}, token)
  },

  asignarAnalista: (token: string, creditoId: string, analistaId: string, obs?: string) =>
    apiFetch(`/creditos/${creditoId}/asignar-analista`, {
      method: 'PATCH', body: JSON.stringify({ analista_id: analistaId, observaciones: obs }),
    }, token),

  evaluar: (token: string, creditoId: string, data: {
    score_crediticio: number; tasa_interes_propuesta: number
    monto_aprobado_propuesto?: number; plazo_meses_propuesto?: number
    recomendacion: 'aprobar' | 'rechazar' | 'escalar_comite'; observaciones: string
  }) => apiFetch(`/creditos/${creditoId}/evaluar`, {
    method: 'PATCH', body: JSON.stringify(data),
  }, token),

  decisionComite: (token: string, creditoId: string, data: {
    decision: 'aprobado' | 'rechazado'; monto_aprobado?: number
    tasa_interes_final?: number; plazo_meses_final?: number
    motivo_rechazo?: string; observaciones?: string
  }) => apiFetch(`/creditos/${creditoId}/decision-comite`, {
    method: 'PATCH', body: JSON.stringify(data),
  }, token),

  desembolsar: (token: string, creditoId: string, obs?: string) =>
    apiFetch(`/creditos/${creditoId}/desembolsar`, {
      method: 'POST', body: JSON.stringify({ confirmar: true, observaciones: obs }),
    }, token),
}

// ─── Reportes ─────────────────────────────────────────────────────────────────
export const reportesApi = {
  resumenCartera: (token: string) =>
    apiFetch<ResumenCartera>('/creditos/reportes/resumen-cartera', {}, token),

  carteraActiva: (token: string, pagina = 1, porPagina = 25) =>
    apiFetch<{ items: CarteraItem[]; total: number; pagina: number; por_pagina: number; total_paginas: number }>(
      `/creditos/reportes/cartera-activa?pagina=${pagina}&por_pagina=${porPagina}`, {}, token
    ),

  desembolsosHoy: (token: string) =>
    apiFetch<DesembolsosResponse>('/creditos/reportes/desembolsos-hoy', {}, token),
}
