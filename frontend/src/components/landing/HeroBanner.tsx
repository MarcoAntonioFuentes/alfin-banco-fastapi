// src/components/landing/HeroBanner.tsx

import { useNavigate } from 'react-router-dom'

export default function HeroBanner() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden noise-overlay bg-gradient-hero diagonal-divider">

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-20 animate-orb"
          style={{ background: 'radial-gradient(circle, #FF4F00 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-48 w-[700px] h-[700px] rounded-full opacity-15 animate-orb"
          style={{ background: 'radial-gradient(circle, #7A1D8A 0%, transparent 70%)', animationDelay: '-4s' }}
        />
        <div
          className="absolute -bottom-48 left-1/3 w-[500px] h-[500px] rounded-full opacity-10 animate-orb"
          style={{ background: 'radial-gradient(circle, #d4ade7 0%, transparent 70%)', animationDelay: '-8s' }}
        />

        {/* Geometric grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* ── Left: Copy ───────────────────────────────── */}
          <div className="text-white">
            {/* Campaign badge */}
            <div className="animate-fade-up animate-delay-100 inline-flex items-center gap-2 mb-6">
              <span className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-display font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Campaña especial 2025
              </span>
            </div>

            {/* Headline */}
            <h1 className="animate-fade-up animate-delay-200 font-display font-bold leading-[1.05] mb-6">
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-white">La suerte</span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-gradient-orange">te llama.</span>
            </h1>

            {/* Sub */}
            <p className="animate-fade-up animate-delay-300 text-white/70 text-lg sm:text-xl font-body leading-relaxed max-w-lg mb-4">
              Obtén tu préstamo con solo tu <strong className="text-white font-semibold">DNI</strong>. Sin trámites complicados, sin avales. El dinero que necesitas, cuando lo necesitas.
            </p>

            {/* Trust indicators */}
            <div className="animate-fade-up animate-delay-400 flex flex-wrap gap-4 mb-10 text-sm text-white/60">
              <span className="flex items-center gap-1.5"><CheckIcon /> Aprobación en 24h</span>
              <span className="flex items-center gap-1.5"><CheckIcon /> 0 comisiones ocultas</span>
              <span className="flex items-center gap-1.5"><CheckIcon /> 100% digital</span>
            </div>

            {/* CTAs */}
            <div className="animate-fade-up animate-delay-500 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary text-base px-8 py-4 shadow-orange group"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="group-hover:scale-110 transition-transform">
                  <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                </svg>
                Banca por internet
              </button>
              <a href="#soluciones" className="btn-ghost text-base px-8 py-4">
                Conocer productos
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a.5.5 0 01.5.5v11.793l3.146-3.147a.5.5 0 01.708.708l-4 4a.5.5 0 01-.708 0l-4-4a.5.5 0 01.708-.708L7.5 13.293V1.5A.5.5 0 018 1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* ── Right: Floating card mockup ───────────────── */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Main card */}
            <div
              className="relative w-80 animate-float"
              style={{ animationDuration: '6s' }}
            >
              {/* Debit card mockup */}
              <div className="rounded-3xl p-6 shadow-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #7A1D8A 0%, #430e4f 50%, #1e0524 100%)' }}>
                {/* Card chip & logo */}
                <div className="flex justify-between items-start mb-8">
                  <div className="w-12 h-9 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 opacity-90 grid grid-cols-2 grid-rows-2 gap-0.5 p-1">
                    <div className="bg-yellow-400/60 rounded-sm" />
                    <div className="bg-yellow-400/60 rounded-sm" />
                    <div className="bg-yellow-400/60 rounded-sm" />
                    <div className="bg-yellow-400/60 rounded-sm" />
                  </div>
                  <div className="flex -space-x-3">
                    <div className="w-8 h-8 rounded-full bg-orange-400/80" />
                    <div className="w-8 h-8 rounded-full bg-orange-600/80" />
                  </div>
                </div>
                {/* Card number */}
                <p className="text-white/40 text-xs font-mono tracking-widest mb-1">NÚMERO DE CUENTA</p>
                <p className="text-white font-mono text-lg tracking-[0.2em] mb-6">0110 •••• •••• 7821</p>
                {/* Cardholder */}
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-0.5">Titular</p>
                    <p className="text-white font-display font-semibold text-sm">JUAN C. PÉREZ</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-0.5">Válida</p>
                    <p className="text-white font-mono text-sm">12/28</p>
                  </div>
                </div>
              </div>

              {/* Floating balance pill */}
              <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl px-4 py-3 shadow-card-hover">
                <p className="text-gray-400 text-xs font-body mb-0.5">Saldo disponible</p>
                <p className="text-charcoal font-display font-bold text-lg">S/ 4,850<span className="text-gray-400 font-normal text-sm">.00</span></p>
              </div>

              {/* Floating transaction pill */}
              <div className="absolute -top-4 -left-4 glass-card rounded-2xl px-3 py-2.5 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-green-400">
                      <path d="M6 1l.5 3.5L10 5l-3.5.5L6 9l-.5-3.5L2 5l3.5-.5L6 1z"/>
                    </svg>
                  </span>
                  <div>
                    <p className="text-white text-xs font-semibold">Transferencia</p>
                    <p className="text-green-400 text-xs font-mono">+S/ 1,200</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce opacity-40">
          <span className="text-white text-xs font-body tracking-widest uppercase">Scroll</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <path d="M8 4a.5.5 0 01.5.5v5.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 01.708-.708L7.5 10.293V4.5A.5.5 0 018 4z"/>
          </svg>
        </div>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-orange-400 flex-shrink-0">
      <path d="M7 0a7 7 0 100 14A7 7 0 007 0zm3.293 5.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L5.586 7.172l3.293-3.293a1 1 0 111.414 1.414z"/>
    </svg>
  )
}
