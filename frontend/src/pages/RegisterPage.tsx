// src/pages/RegisterPage.tsx
// Página de registro de nuevo usuario con validación completa

import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import { AlfinLogo, Alert, Spinner, PrivacyBadge } from '../components/shared'

interface FormState {
  nombre_completo: string
  dni:             string
  email:           string
  telefono:        string
  password:        string
  confirmar:       string
  showPass:        boolean
  showConfirm:     boolean
  acepta:          boolean
}

interface FormErrors {
  nombre_completo?: string
  dni?:             string
  email?:           string
  telefono?:        string
  password?:        string
  confirmar?:       string
  acepta?:          string
}

const INITIAL: FormState = {
  nombre_completo: '',
  dni:             '',
  email:           '',
  telefono:        '',
  password:        '',
  confirmar:       '',
  showPass:        false,
  showConfirm:     false,
  acepta:          false,
}

// Password strength calculator
function calcStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8)            score++
  if (pw.length >= 12)           score++
  if (/[A-Z]/.test(pw))          score++
  if (/[0-9]/.test(pw))          score++
  if (/[^A-Za-z0-9]/.test(pw))   score++

  if (score <= 1) return { score, label: 'Muy débil',  color: 'bg-red-400' }
  if (score === 2) return { score, label: 'Débil',      color: 'bg-orange-400' }
  if (score === 3) return { score, label: 'Regular',    color: 'bg-amber-400' }
  if (score === 4) return { score, label: 'Fuerte',     color: 'bg-emerald-400' }
  return               { score,    label: 'Muy fuerte', color: 'bg-emerald-500' }
}

const testimonials = [
  { text: '"Abrí mi cuenta en menos de 3 minutos. Sin papeles, sin colas."', author: 'Ana L., Lima' },
  { text: '"Mi primer préstamo aprobado en 24 horas. Increíble."',           author: 'Marco T., Trujillo' },
  { text: '"La mejor decisión financiera que tomé este año."',               author: 'Sofia R., Arequipa' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()

  const [form, setForm]       = useState<FormState>(INITIAL)
  const [errors, setErrors]   = useState<FormErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [testIdx, setTestIdx] = useState(0)
  const [testFade, setTestFade] = useState(true)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  // Cycle testimonials
  useEffect(() => {
    const t = setInterval(() => {
      setTestFade(false)
      setTimeout(() => { setTestIdx(i => (i + 1) % testimonials.length); setTestFade(true) }, 350)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  // ── Field helpers ──────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (key in errors) setErrors(e => ({ ...e, [key]: undefined }))
    if (apiError) setApiError(null)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: FormErrors = {}

    if (!form.nombre_completo.trim() || form.nombre_completo.trim().length < 3)
      errs.nombre_completo = 'Ingresa tu nombre completo (mínimo 3 caracteres).'
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]{3,}$/.test(form.nombre_completo.trim()))
      errs.nombre_completo = 'El nombre solo puede contener letras y espacios.'

    if (!form.dni.trim())
      errs.dni = 'Ingresa tu DNI.'
    else if (!/^\d{8}$/.test(form.dni.trim()))
      errs.dni = 'El DNI debe tener exactamente 8 dígitos numéricos.'

    if (!form.email.trim())
      errs.email = 'Ingresa tu correo electrónico.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = 'Ingresa un correo electrónico válido.'

    if (form.telefono && !/^\d{9}$/.test(form.telefono.trim()))
      errs.telefono = 'El teléfono debe tener 9 dígitos (ej: 987654321).'

    if (!form.password)
      errs.password = 'Ingresa una contraseña.'
    else if (form.password.length < 8)
      errs.password = 'La contraseña debe tener al menos 8 caracteres.'
    else if (!/[A-Za-z]/.test(form.password))
      errs.password = 'La contraseña debe contener al menos una letra.'
    else if (!/\d/.test(form.password))
      errs.password = 'La contraseña debe contener al menos un número.'

    if (!form.confirmar)
      errs.confirmar = 'Confirma tu contraseña.'
    else if (form.confirmar !== form.password)
      errs.confirmar = 'Las contraseñas no coinciden.'

    if (!form.acepta)
      errs.acepta = 'Debes aceptar los términos y condiciones para continuar.'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)
    if (!validate()) return

    setLoading(true)
    try {
      const res = await authApi.register({
        email:           form.email.trim().toLowerCase(),
        password:        form.password,
        nombre_completo: form.nombre_completo.trim(),
        dni:             form.dni.trim(),
        telefono:        form.telefono.trim() || undefined,
      }) as {
        access_token: string; refresh_token: string
        usuario: {
          id: string; email: string; nombre_completo: string; dni: string
          telefono?: string; rol: string; estado: string; fecha_registro: string
        }
      }

      setSuccess(true)
      login(res.access_token, res.refresh_token, res.usuario)
      await new Promise(r => setTimeout(r, 900))
      navigate('/dashboard', { replace: true })

    } catch (err: unknown) {
      const e = err as { status?: number; error?: string; detalle?: unknown }
      setLoading(false)

      if (e?.status === 400) {
        const det = e?.detalle
        if (typeof det === 'string' && det.includes('DNI'))
          setApiError('Este DNI ya está registrado en el sistema. Si ya tienes una cuenta, inicia sesión.')
        else if (typeof det === 'string' && det.includes('correo'))
          setApiError('Este correo electrónico ya está registrado. ¿Olvidaste tu contraseña?')
        else
          setApiError(e?.error ?? 'Los datos ingresados son inválidos. Revísalos e intenta nuevamente.')
      } else if (!navigator.onLine) {
        setApiError('Sin conexión a internet. Verifica tu red e intenta nuevamente.')
      } else {
        setApiError('Error al crear la cuenta. Por favor intenta más tarde.')
      }
    }
  }

  const strength = form.password ? calcStrength(form.password) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── LEFT brand panel ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] relative overflow-hidden flex-col justify-between p-12 noise-overlay"
        style={{ background: 'linear-gradient(150deg, #1e0524 0%, #7A1D8A 55%, #430e4f 100%)' }}>

        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-25 animate-orb"
            style={{ background: 'radial-gradient(circle, #FF4F00 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15 animate-orb"
            style={{ background: 'radial-gradient(circle, #d4ade7 0%, transparent 70%)', animationDelay: '-6s' }} />
        </div>

        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>

        {/* Logo */}
        <div className="relative z-10">
          <a href="/"><AlfinLogo variant="light" size="md" /></a>
        </div>

        {/* Center */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-orange-300 text-xs font-display font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Únete hoy — es gratis
          </span>
          <h2 className="font-display font-bold text-4xl xl:text-5xl text-white leading-[1.1] mb-4">
            Tu cuenta<br />
            <span className="text-gradient-orange">en minutos.</span>
          </h2>
          <p className="text-white/60 font-body text-lg leading-relaxed max-w-sm">
            Sin trámites presenciales. Solo tu DNI, un correo y ya eres parte de Alfin Banco.
          </p>

          {/* Benefits */}
          <div className="mt-8 space-y-3">
            {[
              '✓  Cuenta de ahorros abierta automáticamente',
              '✓  Sin costo de mantenimiento mensual',
              '✓  Acceso inmediato a préstamos con tu DNI',
              '✓  App y banca web disponible 24/7',
            ].map(b => (
              <p key={b} className="text-white/70 font-body text-sm">{b}</p>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <div className={`glass-card rounded-2xl p-5 transition-all duration-400 ${testFade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <p className="text-white/70 font-body text-sm leading-relaxed italic mb-3">
              {testimonials[testIdx].text}
            </p>
            <p className="text-orange-400 font-display font-semibold text-xs">
              — {testimonials[testIdx].author}
            </p>
          </div>
          <div className="flex gap-1.5 mt-3 justify-center">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setTestIdx(i)}
                className={`h-1 rounded-full transition-all duration-300 ${i === testIdx ? 'w-6 bg-orange-400' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: form ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center p-6 sm:p-10 bg-pearl overflow-y-auto">
        <div className="w-full max-w-md py-4">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <AlfinLogo variant="dark" size="md" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <button onClick={() => navigate('/login')}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-violet-500 hover:border-violet-200 transition-colors flex-shrink-0"
              aria-label="Volver al login">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M15 8a.5.5 0 00-.5-.5H2.707l3.147-3.146a.5.5 0 10-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L2.707 8.5H14.5A.5.5 0 0015 8z"/>
              </svg>
            </button>
            <div>
              <h1 className="font-display font-bold text-xl text-charcoal leading-none">Crear cuenta</h1>
              <p className="text-gray-400 text-xs font-body mt-0.5">Alfin Banco · Registro gratuito</p>
            </div>
          </div>

          {/* API Error */}
          {apiError && (
            <div className="mb-5">
              <Alert type="error" title="No se pudo crear la cuenta" message={apiError} onClose={() => setApiError(null)} />
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-5">
              <Alert type="success" title="¡Cuenta creada exitosamente!" message="Tu cuenta fue abierta. Redirigiendo a tu dashboard..." />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                Nombre completo <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.029 10 8 10c-2.03 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                  </svg>
                </span>
                <input id="nombre" type="text" autoComplete="name"
                  placeholder="Juan Carlos Pérez López"
                  value={form.nombre_completo}
                  onChange={e => setField('nombre_completo', e.target.value)}
                  disabled={loading || success}
                  className={`input-field pl-10 ${errors.nombre_completo ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
                />
              </div>
              {errors.nombre_completo && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.nombre_completo}</p>}
            </div>

            {/* DNI + Teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dni" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                  DNI <span className="text-red-400">*</span>
                </label>
                <input id="dni" type="text" inputMode="numeric" maxLength={8}
                  placeholder="12345678"
                  value={form.dni}
                  onChange={e => setField('dni', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  disabled={loading || success}
                  className={`input-field font-mono ${errors.dni ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
                />
                {errors.dni && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.dni}</p>}
              </div>
              <div>
                <label htmlFor="tel" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                  Teléfono
                </label>
                <input id="tel" type="tel" inputMode="numeric" maxLength={9}
                  placeholder="987654321"
                  value={form.telefono}
                  onChange={e => setField('telefono', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  disabled={loading || success}
                  className={`input-field font-mono ${errors.telefono ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
                />
                {errors.telefono && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.telefono}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                Correo electrónico <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v.217l7 4.2 7-4.2V4a1 1 0 00-1-1H2zm13 2.383l-4.758 2.855L15 11.114v-5.73zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 002 13h12a1 1 0 00.966-.739zM1 11.114l4.758-2.876L1 5.383v5.73z"/>
                  </svg>
                </span>
                <input id="email" type="email" autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  disabled={loading || success}
                  className={`input-field pl-10 ${errors.email ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
                />
              </div>
              {errors.email && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                Contraseña <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                  </svg>
                </span>
                <input id="password" type={form.showPass ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  disabled={loading || success}
                  className={`input-field pl-10 pr-11 ${errors.password ? 'error' : ''} ${loading || success ? 'opacity-60' : ''}`}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setField('showPass', !form.showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Mostrar contraseña">
                  {form.showPass
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/></svg>
                  }
                </button>
              </div>
              {/* Strength meter */}
              {form.password && strength && (
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

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmar" className="block text-sm font-body font-medium text-gray-700 mb-1.5">
                Confirmar contraseña <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                  </svg>
                </span>
                <input id="confirmar" type={form.showConfirm ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Repite tu contraseña"
                  value={form.confirmar}
                  onChange={e => setField('confirmar', e.target.value)}
                  disabled={loading || success}
                  className={`input-field pl-10 pr-11 ${errors.confirmar ? 'error' : ''} ${
                    form.confirmar && form.confirmar === form.password ? 'border-emerald-400 focus:border-emerald-500' : ''
                  } ${loading || success ? 'opacity-60' : ''}`}
                />
                {/* Match indicator */}
                {form.confirmar && (
                  <span className={`absolute right-10 top-1/2 -translate-y-1/2 ${form.confirmar === form.password ? 'text-emerald-500' : 'text-red-400'}`}>
                    {form.confirmar === form.password
                      ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0a7 7 0 100 14A7 7 0 007 0zm3.293 5.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L5.586 7.172l3.293-3.293a1 1 0 111.414 1.414z"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0a7 7 0 100 14A7 7 0 007 0zM5.354 4.646L7 6.293l1.646-1.647.708.708L7.707 7l1.647 1.646-.708.708L7 7.707 5.354 9.354l-.708-.708L6.293 7 4.646 5.354l.708-.708z"/></svg>
                    }
                  </span>
                )}
                <button type="button" tabIndex={-1}
                  onClick={() => setField('showConfirm', !form.showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Mostrar contraseña">
                  {form.showConfirm
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z"/><path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/></svg>
                  }
                </button>
              </div>
              {errors.confirmar && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.confirmar}</p>}
            </div>

            {/* Terms checkbox */}
            <div>
              <label className={`flex items-start gap-3 cursor-pointer group ${loading || success ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <input type="checkbox" checked={form.acepta}
                    onChange={e => setField('acepta', e.target.checked)}
                    className="sr-only peer" />
                  <div className={`w-4.5 h-4.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    form.acepta
                      ? 'bg-violet-500 border-violet-500'
                      : errors.acepta
                      ? 'border-red-400 bg-white'
                      : 'border-gray-300 bg-white group-hover:border-violet-400'
                  }`}>
                    {form.acepta && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="white">
                        <path d="M9.207.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L3.5 5.086 7.793.793a1 1 0 011.414 0z"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm font-body text-gray-600 leading-snug">
                  Acepto los{' '}
                  <a href="#" className="text-violet-500 hover:text-violet-600 underline">Términos y condiciones</a>
                  {' '}y la{' '}
                  <a href="#" className="text-violet-500 hover:text-violet-600 underline">Política de privacidad</a>
                  {' '}de Alfin Banco.
                </span>
              </label>
              {errors.acepta && <p className="mt-1.5 text-red-500 text-xs font-body">{errors.acepta}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading || success}
              className={`btn-primary w-full py-4 text-base mt-2 transition-all duration-200 ${
                success ? 'bg-green-500 hover:bg-green-500 shadow-none' : ''
              } ${loading || success ? 'opacity-90 cursor-not-allowed' : ''}`}>
              {success ? (
                <><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M9 0a9 9 0 100 18A9 9 0 009 0zm4.207 6.793l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L7.5 9.672l4.293-4.293a1 1 0 011.414 1.414z"/></svg>¡Cuenta creada!</>
              ) : loading ? (
                <><Spinner size="sm" color="white" />Creando cuenta...</>
              ) : (
                <>Crear mi cuenta gratis</>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-gray-300 text-xs font-body">¿Ya tienes cuenta?</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button onClick={() => navigate('/login')}
            className="w-full py-3.5 rounded-xl border-2 border-violet-200 text-violet-600 font-display font-semibold text-sm hover:bg-violet-50 hover:border-violet-300 transition-all duration-200">
            Iniciar sesión
          </button>

          <div className="flex justify-center mt-5">
            <PrivacyBadge />
          </div>
        </div>
      </div>
    </div>
  )
}
