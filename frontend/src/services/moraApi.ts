// src/services/moraApi.ts
// Cliente API para el módulo de Recuperaciones / Mora

const BASE_URL = '/api/v1'

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw { status: 0, error: 'Sin conexión con el servidor.' }
  }

  let body: unknown = null
  try {
    body = res.headers.get('content-type')?.includes('application/json')
      ? await res.json() : await res.text()
  } catch { body = null }

  if (!res.ok) {
    const err = body as { error?: string; detail?: string }
    throw {
      status: res.status,
      error: err?.error ?? (typeof err?.detail === 'string' ? err.detail : 'Error del servidor'),
    }
  }
  return body as T
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BandaKpi {
  banda: string; cantidad: number; porcentaje: number
  monto_capital: number; monto_pendiente: number
  dias_promedio: number; en_judicial: number; semaforo: string
}

export interface KpisMora {
  resumen: {
    total_cartera: number; al_dia: number; en_mora: number
    tasa_morosidad: number; monto_total: number
    monto_en_mora: number; tasa_promedio: number
  }
  bandas: BandaKpi[]
  actualizado_en: string
}

export interface CreditoMora {
  id: string; numero_credito: string; banda_mora: string; dias_mora: number
  monto_aprobado: number; moneda: string; tasa_interes: number
  estado_judicial: boolean; fecha_judicial: string | null; fecha_castigo: string | null
  cliente: string; dni: string; telefono: string | null
  cuotas_vencidas: number; monto_vencido: number
  ultima_gestion: string | null; total_gestiones: number
}

export interface Gestion {
  id: string; tipo_gestion: string; resultado: string
  monto_comprometido: number | null; fecha_compromiso: string | null
  observaciones: string | null; proxima_gestion: string | null
  banda_mora_momento: string; dias_mora_momento: number
  fecha_gestion: string; gestor: string; rol_gestor: string
}

export interface RDSResult {
  ingreso_mensual: number; deuda_mensual_actual: number
  cuota_nueva: number; carga_total: number; rds: number
  semaforo: string; nivel_aprobacion: string; elegible: boolean; observacion: string
}

// ─── API calls ────────────────────────────────────────────────────────────────
export const moraApi = {
  kpis: (token: string) =>
    apiFetch<KpisMora>('/mora/kpis', {}, token),

  creditosPorBanda: (token: string, banda: string, pagina = 1, porPagina = 20) =>
    apiFetch<{ items: CreditoMora[]; total: number; pagina: number; total_paginas: number }>(
      `/mora/banda/${banda}?pagina=${pagina}&por_pagina=${porPagina}`, {}, token
    ),

  listarGestiones: (token: string, creditoId: string) =>
    apiFetch<Gestion[]>(`/mora/${creditoId}/gestiones`, {}, token),

  registrarGestion: (token: string, creditoId: string, data: object) =>
    apiFetch(`/mora/${creditoId}/gestiones`, {
      method: 'POST', body: JSON.stringify(data),
    }, token),

  derivarJudicial: (token: string, creditoId: string, observaciones?: string) =>
    apiFetch(`/mora/${creditoId}/derivar-judicial`, {
      method: 'POST', body: JSON.stringify({ observaciones }),
    }, token),

  castigar: (token: string, creditoId: string, observaciones?: string) =>
    apiFetch(`/mora/${creditoId}/castigar`, {
      method: 'POST', body: JSON.stringify({ observaciones }),
    }, token),

  calcularRds: (data: {
    ingreso_mensual: number; deuda_mensual_actual: number
    monto_nuevo: number; tasa_tea: number; plazo_meses: number
  }) => apiFetch<RDSResult>('/mora/calcular-rds', {
    method: 'POST', body: JSON.stringify(data),
  }),

  actualizarMora: (token: string) =>
    apiFetch('/mora/actualizar', { method: 'POST' }, token),
}
