// src/components/auth/LoginForm.tsx
// Redirige según rol: staff → /core | cliente → /dashboard

import { useState, useRef, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlfinLogo, Alert, Spinner, PrivacyBadge } from '../shared'
import { authApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { STAFF_ROLES } from '../../App'

interface FormState {
  identifier: string
  password:   string
  showPass:   boolean
}
interface ApiErr { status?: number; error?: string }

export default function LoginForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm]         = useState<FormState>({ identifier: '', password: '', showPass: false })
  const [errors, setErrors]     = useState<{ identifier?: string; password?: string }>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const identifierRef           = useRef<HTMLInputElement>(null)

  const isDni   = (v: string) => /^\d{6,8}$/.test(v.trim())
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  function validate(): boolean {
    const errs: { identifier?: string; password?: string } = {}
    const val = form.identifier.trim()
    if (!val)                        errs.identifier = 'Ingresa tu correo o DNI.'
    else if (!isDni(val) && !isEmail(val))
      errs.identifier = 'Ingresa un correo válido o tu DNI de 8 dígitos.'
    if (!form.password) errs.password = 'Ingresa tu contraseña.'
    setErrors(errs)
    if (errs.identifier) identifierRef.current?.focus()
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)
    if (!validate()) return
    setLoading(true)

    try {
      let email = form.identifier.trim()

      // Si ingresó DNI, resolverlo a email
      if (isDni(email)) {
        try {
          const resolved = await authApi.resolverDni(email)
          email = (resolved as { email: string }).email
        } catch {
          setApiError('No encontramos una cuenta con ese DNI.')
          setLoading(false)
          return
        }
      }

      const res = await authApi.login({ email, password: form.password }) as {
        access_token: string; refresh_token: string
        usuario: {
          id: string; email: string; nombre_completo: string; dni: string
          telefono?: string; rol: string; estado: string; fecha_registro: string
        }
      }

      setSuccess(true)
      login(res.access_token, res.refresh_token, res.usuario)
      await new Promise(r => setTimeout(r, 700))

      // ── Redirección según rol ──────────────────────────────────────────
      if (STAFF_ROLES.includes(res.usuario.rol)) {
        navigate('/core')        // analista, admin, comite, riesgos, gerencia, asesor
      } else {
        navigate('/dashboard')   // cliente
      }

    } catch (err) {
      const e = err as ApiErr
      setLoading(false)
      if (e.status === 0)          setApiError('No se puede conectar al servidor. Verifica que el backend esté en localhost:8000.')
      else if (e.status === 401 || e.status === 400) setApiError('Credenciales incorrectas. Verifica tu correo/DNI y contraseña.')
      else if (e.status === 403)   setApiError('Tu cuenta está bloqueada. Contacta a soporte: 0800-00000.')
      else if (e.status === 422)   setApiError('Datos inválidos: ' + (e.error ?? 'revisa el correo y contraseña.'))
      else                         setApiError(e.error ?? 'Error inesperado. Intenta nuevamente.')
    }
  }

  function setField(field: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    if (typeof value === 'string') setErrors(e => ({ ...e, [field]: undefined }))
    if (apiError) setApiError(null)
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-violet-500 hover:border-violet-200 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15 8a.5.5 0 00-.5-.5H2.707l3.147-3.146a.5.5 0 10-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L2.707 8.5H14.5A.5.5 0 0015 8z"/>
          </svg>
        </button>
        <div>
          <h1 className="font-display font-bold text-xl text-charcoal leading-none">Inicio de sesión</h1>
          <p className="text-gray-400 text-xs font-body mt-0.5">Banca digital Alfin Banco</p>
        </div>
        <div className="ml-auto"><AlfinLogo variant="dark" size="sm" /></div>
      </div>

      {apiError && (
        <div className="mb-5">
          <Alert type="error" title="Error de autenticación" message={apiError} onClose={() => setApiError(null)} />
        </div>
      )}
      {success && (
        <div className="mb-5">
          <Alert type="success" title="¡Bienvenido!" message="Autenticación exitosa. Redirigiendo..." />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Identifier */}
        <div>
          <label htmlFor="identifier" className="block font-body font-medium text-sm text-gray-700 mb-1.5">
            Correo electrónico o DNI
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z"/>
              </svg>
            </span>
            <input ref={identifierRef} id="identifier" type="text" autoComplete="username"
              placeholder="correo@ejemplo.com o 12345678"
              value={form.identifier}
              onChange={e => setField('identifier', e.target.value)}
              disabled={loading || success}
              className={`input-field pl-10 ${errors.identifier ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
            />
          </div>
          {errors.identifier && <p role="alert" className="mt-1.5 text-red-500 text-xs font-body">{errors.identifier}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block font-body font-medium text-sm text-gray-700">Contraseña</label>
            <a href="/recuperar" className="text-violet-500 hover:text-violet-600 text-xs font-body transition-colors">¿Olvidaste tu contraseña?</a>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
              </svg>
            </span>
            <input id="password" type={form.showPass ? 'text' : 'password'}
              autoComplete="current-password" placeholder="••••••••"
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              disabled={loading || success}
              className={`input-field pl-10 pr-11 ${errors.password ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
            />
            <button type="button" tabIndex={-1}
              onClick={() => setField('showPass', !form.showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {form.showPass
                ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
                : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/></svg>
              }
            </button>
          </div>
          {errors.password && <p role="alert" className="mt-1.5 text-red-500 text-xs font-body">{errors.password}</p>}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading || success}
          className={`btn-primary w-full py-4 text-base mt-2 ${success ? 'bg-green-500 hover:bg-green-500' : ''} ${loading || success ? 'opacity-90 cursor-not-allowed' : ''}`}>
          {success
            ? <><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M9 0a9 9 0 100 18A9 9 0 009 0zm4.207 6.793l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L7.5 9.672l4.293-4.293a1 1 0 011.414 1.414z"/></svg>¡Autenticado!</>
            : loading
            ? <><Spinner size="sm" color="white" />Verificando...</>
            : <>Ingresar a mi cuenta</>
          }
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-gray-300 text-xs font-body">¿Primera vez?</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button onClick={() => navigate('/registro')}
        className="w-full py-3.5 rounded-xl border-2 border-violet-200 text-violet-600 font-display font-semibold text-sm hover:bg-violet-50 hover:border-violet-300 transition-all duration-200">
        Crear cuenta nueva
      </button>

      <div className="flex justify-center mt-5"><PrivacyBadge /></div>
    </div>
  )
}
