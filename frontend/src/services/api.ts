// src/services/api.ts
// Centralized API client for Alfin Banco backend (FastAPI)

// Lee la variable de entorno de Vercel en producción o usa localhost en desarrollo
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE_URL = `${API_URL}/api/v1`;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LoginPayload  { email: string; password: string }
export interface RegisterPayload {
  email: string; password: string
  nombre_completo: string; dni: string; telefono?: string
}
export interface ApiError { error: string; detalle?: string | object; codigo?: string }

// ─── Base fetch ───────────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    // Network error — backend not reachable
    throw { status: 0, error: 'No se puede conectar al servidor. Verifica que el backend esté corriendo en localhost:8000.' }
  }

  let body: unknown
  const contentType = res.headers.get('content-type') ?? ''
  try {
    body = contentType.includes('application/json') ? await res.json() : await res.text()
  } catch {
    body = null
  }

  if (!res.ok) {
    const err = body as ApiError & { detail?: string | { msg: string }[] }
    // FastAPI validation error (422) returns { detail: [...] }
    let errorMsg = 'Error desconocido'
    if (err?.error) {
      errorMsg = err.error
    } else if (typeof err?.detail === 'string') {
      errorMsg = err.detail
    } else if (Array.isArray(err?.detail)) {
      errorMsg = err.detail.map((d: { msg: string }) => d.msg).join(', ')
    }
    throw { status: res.status, error: errorMsg, detalle: err?.detail ?? body, codigo: err?.codigo }
  }

  return body as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<{ access_token: string; refresh_token: string; usuario: object }>(
      '/auth/login', { method: 'POST', body: JSON.stringify(payload) }
    ),

  register: (payload: RegisterPayload) =>
    apiFetch('/auth/registro', { method: 'POST', body: JSON.stringify(payload) }),

  logout: (token: string) =>
    apiFetch('/auth/logout', { method: 'POST' }, token),

  me: (token: string) =>
    apiFetch('/auth/me', {}, token),

  // Resolve DNI → email by calling backend
  resolverDni: (dni: string) =>
    apiFetch<{ email: string }>(`/auth/resolver-dni?dni=${dni}`),
}

// ─── Cuentas & Dashboard ──────────────────────────────────────────────────────
export const cuentasApi = {
  dashboard: (token: string) =>
    apiFetch('/cuentas/dashboard', {}, token),

  listar: (token: string) =>
    apiFetch('/cuentas/', {}, token),

  saldo: (token: string, cuentaId: string) =>
    apiFetch(`/cuentas/${cuentaId}/saldo`, {}, token),

  movimientos: (token: string, cuentaId: string, params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return apiFetch(`/cuentas/${cuentaId}/movimientos${qs}`, {}, token)
  },

  depositar: (token: string, body: object) =>
    apiFetch('/cuentas/depositar', { method: 'POST', body: JSON.stringify(body) }, token),

  retirar: (token: string, body: object) =>
    apiFetch('/cuentas/retirar', { method: 'POST', body: JSON.stringify(body) }, token),

  transferir: (token: string, body: object) =>
    apiFetch('/cuentas/transferir', { method: 'POST', body: JSON.stringify(body) }, token),
}

// ─── Créditos ─────────────────────────────────────────────────────────────────
export const creditosApi = {
  simular: (monto: number, tea: number, plazo: number) =>
    apiFetch(`/creditos/simulador?monto=${monto}&tea=${tea}&plazo_meses=${plazo}`),

  solicitar: (token: string, body: object) =>
    apiFetch('/creditos/solicitar', { method: 'POST', body: JSON.stringify(body) }, token),

  misCreditos: (token: string) =>
    apiFetch('/creditos/mis-creditos', {}, token),

  cronograma: (token: string, creditoId: string) =>
    apiFetch(`/creditos/${creditoId}/cronograma`, {}, token),
}