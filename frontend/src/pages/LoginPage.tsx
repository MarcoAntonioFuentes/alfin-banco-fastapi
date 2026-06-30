// src/pages/LoginPage.tsx
// Two-phase auth UX: Pre-login security screen → Login form
// Animated panel with decorative brand column on the left

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PreLoginScreen from '../components/auth/PreLoginScreen'
import LoginForm      from '../components/auth/LoginForm'

type Phase = 'pre-login' | 'login'

const testimonials = [
  { text: '"Obtuve mi préstamo en 24 horas sin salir de casa. El proceso fue increíblemente sencillo."', author: 'Carlos M., Lima' },
  { text: '"La cuenta de ahorros me genera intereses sin monto mínimo. Por fin un banco para todos."',  author: 'Rosa T., Arequipa' },
  { text: '"Transferencias al instante, sin colas y sin comisiones. Alfin Banco cambió mis finanzas."', author: 'Pedro L., Cusco' },
]

export default function LoginPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase]     = useState<Phase>('pre-login')
  const [testIdx, setTestIdx] = useState(0)
  const [testFade, setTestFade] = useState(true)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  // Cycle testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setTestFade(false)
      setTimeout(() => {
        setTestIdx(i => (i + 1) % testimonials.length)
        setTestFade(true)
      }, 400)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: Brand panel (desktop only) ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden flex-col justify-between p-12 noise-overlay"
        style={{ background: 'linear-gradient(150deg, #1e0524 0%, #7A1D8A 55%, #430e4f 100%)' }}
      >
        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-20 animate-orb"
            style={{ background: 'radial-gradient(circle, #FF4F00 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-150px] right-[-80px] w-[450px] h-[450px] rounded-full opacity-15 animate-orb"
            style={{ background: 'radial-gradient(circle, #d4ade7 0%, transparent 70%)', animationDelay: '-5s' }} />
        </div>

        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>

        <div className="relative z-10">
          {/* Logo */}
          <a href="/" className="inline-block">
            <div className="font-display font-bold text-2xl tracking-tight flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L24 8V20L14 26L4 20V8L14 2Z" stroke="white" strokeWidth="1.5" opacity="0.4"/>
                <circle cx="14" cy="14" r="4" fill="#FF4F00" />
              </svg>
              <span className="text-white">alfin</span><span className="text-orange-400">banco</span>
            </div>
          </a>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <div className="max-w-md">
            {/* Campaign tag */}
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-orange-300 text-xs font-display font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Banca digital 2025
            </span>

            <h2 className="font-display font-bold text-4xl xl:text-5xl text-white leading-[1.1] mb-4">
              Tu dinero.<br />
              <span className="text-gradient-orange">Tu control.</span><br />
              Tu banco.
            </h2>
            <p className="text-white/60 font-body text-lg leading-relaxed">
              Gestiona tus finanzas desde cualquier lugar, a cualquier hora. Seguro, simple y 100% digital.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-10">
            {[['S/500M+', 'Créditos'], ['+200K', 'Clientes'], ['24h', 'Aprobación']].map(([v, l]) => (
              <div key={l}>
                <p className="font-display font-bold text-2xl text-white">{v}</p>
                <p className="text-white/40 text-xs font-body">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <div className={`glass-card rounded-2xl p-5 transition-all duration-400 ${testFade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none" className="mb-3 opacity-40">
              <path d="M0 16V9.6C0 4.267 3.2 1.067 9.6 0l1.2 1.6C7.467 2.4 5.6 4 5.333 6.4H9.6V16H0zm14.4 0V9.6C14.4 4.267 17.6 1.067 24 0l1.2 1.6C21.867 2.4 20 4 19.733 6.4H24V16h-9.6z" fill="white"/>
            </svg>
            <p className="text-white/70 font-body text-sm leading-relaxed italic mb-3">
              {testimonials[testIdx].text}
            </p>
            <p className="text-orange-400 font-display font-semibold text-xs">
              — {testimonials[testIdx].author}
            </p>
          </div>
          {/* Dots */}
          <div className="flex gap-1.5 mt-3 justify-center">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setTestIdx(i)}
                className={`h-1 rounded-full transition-all duration-300 ${i === testIdx ? 'w-6 bg-orange-400' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Auth panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-pearl">
        <div className="w-full max-w-md">

          {/* Phase transition */}
          <div
            key={phase}
            className="animate-fade-up"
            style={{ animationDuration: '0.4s' }}
          >
            {phase === 'pre-login' ? (
              <PreLoginScreen onContinue={() => setPhase('login')} />
            ) : (
              <LoginForm onBack={() => setPhase('pre-login')} />
            )}
          </div>

          {/* Phase indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-1 rounded-full transition-all duration-300 ${phase === 'pre-login' ? 'w-6 bg-violet-500' : 'w-2 bg-gray-200'}`} />
            <div className={`h-1 rounded-full transition-all duration-300 ${phase === 'login' ? 'w-6 bg-violet-500' : 'w-2 bg-gray-200'}`} />
          </div>
        </div>
      </div>
    </div>
  )
}
