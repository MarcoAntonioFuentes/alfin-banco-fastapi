// src/pages/RecuperarPage.tsx
// Pantalla de recuperación: el usuario ingresa su email y recibe un link

import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlfinLogo, Alert, Spinner, PrivacyBadge } from '../components/shared'
import { useAuth } from '../context/AuthContext'

const BASE_URL = '/api/v1'

export default function RecuperarPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [email,    setEmail]   = useState('')
  const [loading,  setLoading] = useState(false)
  const [success,  setSuccess] = useState(false)
  const [error,    setError]   = useState<string | null>(null)
  const [emailErr, setEmailErr]= useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  function validate(): boolean {
    if (!email.trim()) { setEmailErr('Ingresa tu correo electrónico.'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('Ingresa un correo electrónico válido.'); return false
    }
    setEmailErr(''); return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch(`${BASE_URL}/auth/recuperar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (res.ok || res.status === 404) {
        setSuccess(true)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Error al procesar la solicitud.')
      }
    } catch {
      setError('No se puede conectar al servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pearl px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-card-hover border border-gray-100 p-8 sm:p-10">

          <div className="flex justify-center mb-8">
            <AlfinLogo variant="dark" size="md" />
          </div>

          {success ? (
            <div className="text-center animate-fade-up">
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center mx-auto mb-5">
                <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
                  <circle cx="20" cy="20" r="18" fill="#d1fae5"/>
                  <path d="M8 20l8 8 16-16" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="font-display font-bold text-xl text-charcoal mb-2">¡Revisa tu correo!</h2>
              <p className="text-gray-500 font-body text-sm leading-relaxed mb-2">
                Si el correo <strong className="text-charcoal">{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="text-gray-400 font-body text-xs mb-7">
                El enlace expira en 60 minutos. Revisa también tu carpeta de spam.
              </p>
              <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2.5 mb-7">
                {[
                  { n: '1', text: 'Abre el correo de Alfin Banco' },
                  { n: '2', text: 'Haz clic en "Restablecer contraseña"' },
                  { n: '3', text: 'Elige tu nueva contraseña segura' },
                ].map(s => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{s.n}</div>
                    <p className="text-gray-600 font-body text-sm">{s.text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => { setSuccess(false); setEmail('') }}
                className="text-violet-500 hover:text-violet-600 text-sm font-body underline underline-offset-2 block mx-auto mb-3 transition-colors">
                Intentar con otro correo
              </button>
              <button onClick={() => navigate('/login')} className="btn-primary w-full py-3">
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <div className="animate-fade-up">
              <div className="flex items-center gap-3 mb-7">
                <button onClick={() => navigate('/login')}
                  className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-violet-500 hover:border-violet-200 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M15 8a.5.5 0 00-.5-.5H2.707l3.147-3.146a.5.5 0 10-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L2.707 8.5H14.5A.5.5 0 0015 8z"/>
                  </svg>
                </button>
                <div>
                  <h1 className="font-display font-bold text-xl text-charcoal leading-none">¿Olvidaste tu contraseña?</h1>
                  <p className="text-gray-400 text-xs font-body mt-0.5">Te enviaremos un enlace de recuperación</p>
                </div>
              </div>

              {error && (
                <div className="mb-5">
                  <Alert type="error" message={error} onClose={() => setError(null)} />
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-3 mb-5 text-xs text-violet-600 font-body">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500">
                  <path d="M8 15A7 7 0 108 1a7 7 0 000 14zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
                Ingresa el correo con el que te registraste y te enviaremos las instrucciones.
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="block font-body font-medium text-sm text-gray-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M0 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v.217l7 4.2 7-4.2V4a1 1 0 00-1-1H2zm13 2.383l-4.758 2.855L15 11.114v-5.73zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 002 13h12a1 1 0 00.966-.739zM1 11.114l4.758-2.876L1 5.383v5.73z"/>
                      </svg>
                    </span>
                    <input id="email" type="email" autoComplete="email" autoFocus
                      placeholder="tucorreo@ejemplo.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailErr('') }}
                      disabled={loading}
                      className={`input-field pl-10 ${emailErr ? 'error' : ''} ${loading ? 'opacity-60' : ''}`}
                    />
                  </div>
                  {emailErr && <p role="alert" className="mt-1.5 text-red-500 text-xs font-body">{emailErr}</p>}
                </div>

                <button type="submit" disabled={loading}
                  className={`btn-primary w-full py-4 text-base ${loading ? 'opacity-90 cursor-not-allowed' : ''}`}>
                  {loading
                    ? <><Spinner size="sm" color="white" />Enviando enlace...</>
                    : 'Enviar enlace de recuperación'
                  }
                </button>
              </form>

              <div className="flex justify-center mt-5"><PrivacyBadge /></div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-400 text-xs font-body mt-6">
          ¿Recordaste tu contraseña?{' '}
          <button onClick={() => navigate('/login')} className="text-violet-500 hover:text-violet-600 underline underline-offset-2 transition-colors">
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  )
}
