// src/pages/NuevaPasswordPage.tsx
// Página para establecer nueva contraseña tras hacer clic en el link del correo.
// Supabase redirige aquí con el token en el hash de la URL:
// /nueva-password#access_token=XXX&type=recovery

import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlfinLogo, Alert, Spinner } from '../components/shared'

const BASE_URL = '/api/v1'

function calcStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8)           score++
  if (pw.length >= 12)          score++
  if (/[A-Z]/.test(pw))         score++
  if (/[0-9]/.test(pw))         score++
  if (/[^A-Za-z0-9]/.test(pw))  score++
  if (score <= 1) return { score, label: 'Muy débil',  color: 'bg-red-400' }
  if (score === 2) return { score, label: 'Débil',      color: 'bg-orange-400' }
  if (score === 3) return { score, label: 'Regular',    color: 'bg-amber-400' }
  if (score === 4) return { score, label: 'Fuerte',     color: 'bg-emerald-400' }
  return               { score,    label: 'Muy fuerte', color: 'bg-emerald-500' }
}

export default function NuevaPasswordPage() {
  const navigate = useNavigate()

  const [token,      setToken]     = useState<string | null>(null)
  const [tokenError, setTokenError]= useState(false)
  const [password,   setPassword]  = useState('')
  const [confirmar,  setConfirmar] = useState('')
  const [showPass,   setShowPass]  = useState(false)
  const [loading,    setLoading]   = useState(false)
  const [success,    setSuccess]   = useState(false)
  const [error,      setError]     = useState<string | null>(null)
  const [errors,     setErrors]    = useState<Record<string, string>>({})

  // Leer el access_token del hash de la URL (#access_token=XXX&type=recovery)
  useEffect(() => {
    const hash = window.location.hash.slice(1) // quita el #
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const type        = params.get('type')

    if (accessToken && type === 'recovery') {
      setToken(accessToken)
      // Limpiar el hash de la URL por seguridad
      window.history.replaceState(null, '', window.location.pathname)
    } else {
      // Si no hay token válido, mostrar error
      setTokenError(true)
    }
  }, [])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!password)
      errs.password = 'Ingresa tu nueva contraseña.'
    else if (password.length < 8)
      errs.password = 'La contraseña debe tener al menos 8 caracteres.'
    else if (!/[A-Za-z]/.test(password))
      errs.password = 'La contraseña debe contener al menos una letra.'
    else if (!/\d/.test(password))
      errs.password = 'La contraseña debe contener al menos un número.'

    if (!confirmar)
      errs.confirmar = 'Confirma tu nueva contraseña.'
    else if (confirmar !== password)
      errs.confirmar = 'Las contraseñas no coinciden.'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate() || !token) return
    setLoading(true)

    try {
      const res = await fetch(`${BASE_URL}/auth/nueva-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, nueva_password: password }),
      })

      const body = await res.json().catch(() => ({}))

      if (res.ok) {
        setSuccess(true)
        // Redirigir al login después de 2.5 segundos
        setTimeout(() => navigate('/login'), 2500)
      } else {
        setError(body?.error ?? 'Error al actualizar la contraseña. El enlace puede haber expirado.')
      }
    } catch {
      setError('No se puede conectar al servidor.')
    } finally {
      setLoading(false)
    }
  }

  const strength = password ? calcStrength(password) : null

  // ── Token inválido / expirado ──────────────────────────────────────────────
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-card-hover border border-gray-100 p-8 text-center">
            <div className="flex justify-center mb-6">
              <AlfinLogo variant="dark" size="md" />
            </div>
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-red-400" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
            </div>
            <h2 className="font-display font-bold text-xl text-charcoal mb-2">
              Enlace inválido o expirado
            </h2>
            <p className="text-gray-500 font-body text-sm leading-relaxed mb-6">
              Este enlace de recuperación no es válido o ya expiró (duración: 60 minutos). Solicita uno nuevo.
            </p>
            <button
              onClick={() => navigate('/recuperar')}
              className="btn-primary w-full py-3 mb-3"
            >
              Solicitar nuevo enlace
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl border border-gray-200 text-gray-500 font-body text-sm hover:bg-gray-50 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-card-hover border border-gray-100 p-8 text-center animate-fade-up">
            <div className="flex justify-center mb-6">
              <AlfinLogo variant="dark" size="md" />
            </div>
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center mx-auto mb-5">
              <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
                <circle cx="20" cy="20" r="18" fill="#d1fae5"/>
                <path d="M8 20l8 8 16-16" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="font-display font-bold text-xl text-charcoal mb-2">
              ¡Contraseña actualizada!
            </h2>
            <p className="text-gray-500 font-body text-sm mb-6">
              Tu contraseña fue cambiada exitosamente. Serás redirigido al inicio de sesión en unos segundos...
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-body">
              <Spinner size="sm" color="violet" />
              Redirigiendo al login...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-pearl px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-card-hover border border-gray-100 p-8 sm:p-10 animate-fade-up">

          <div className="flex justify-center mb-8">
            <AlfinLogo variant="dark" size="md" />
          </div>

          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-violet-500" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
              </svg>
            </div>
            <h1 className="font-display font-bold text-xl text-charcoal">Nueva contraseña</h1>
            <p className="text-gray-400 font-body text-sm mt-1">Elige una contraseña segura para tu cuenta</p>
          </div>

          {error && (
            <div className="mb-5">
              <Alert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Nueva contraseña */}
            <div>
              <label htmlFor="password" className="block font-body font-medium text-sm text-gray-700 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                  disabled={loading}
                  className={`input-field pl-10 pr-11 ${errors.password ? 'error' : ''} ${loading ? 'opacity-60' : ''}`}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/></svg>
                  }
                </button>
              </div>
              {/* Strength meter */}
              {password && strength && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-body ${strength.score <= 2 ? 'text-red-500' : strength.score === 3 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {strength.label}
                  </p>
                </div>
              )}
              {errors.password && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.password}</p>}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label htmlFor="confirmar" className="block font-body font-medium text-sm text-gray-700 mb-1.5">
                Confirmar contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                  </svg>
                </span>
                <input
                  id="confirmar"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repite tu nueva contraseña"
                  value={confirmar}
                  onChange={e => { setConfirmar(e.target.value); setErrors(p => ({ ...p, confirmar: '' })) }}
                  disabled={loading}
                  className={`input-field pl-10 pr-10 ${errors.confirmar ? 'error' : ''} ${
                    confirmar && confirmar === password ? 'border-emerald-400 focus:border-emerald-500' : ''
                  } ${loading ? 'opacity-60' : ''}`}
                />
                {/* Match indicator */}
                {confirmar && (
                  <span className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${confirmar === password ? 'text-emerald-500' : 'text-red-400'}`}>
                    {confirmar === password
                      ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0a7 7 0 100 14A7 7 0 007 0zm3.293 5.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L5.586 7.172l3.293-3.293a1 1 0 111.414 1.414z"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0a7 7 0 100 14A7 7 0 007 0zM5.354 4.646L7 6.293l1.646-1.647.708.708L7.707 7l1.647 1.646-.708.708L7 7.707 5.354 9.354l-.708-.708L6.293 7 4.646 5.354l.708-.708z"/></svg>
                    }
                  </span>
                )}
              </div>
              {errors.confirmar && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.confirmar}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary w-full py-4 text-base mt-2 ${loading ? 'opacity-90 cursor-not-allowed' : ''}`}
            >
              {loading
                ? <><Spinner size="sm" color="white" />Actualizando contraseña...</>
                : <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                    </svg>
                    Guardar nueva contraseña
                  </>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
