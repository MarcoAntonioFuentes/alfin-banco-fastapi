// src/components/landing/Header.tsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlfinLogo } from '../shared'

const navLinks = [
  { label: 'Soluciones',  href: '#soluciones' },
  { label: 'Conócenos',   href: '#conocenos'  },
  { label: 'Encuéntranos',href: '#encuentranos'},
]

export default function Header() {
  const navigate   = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-violet-950/95 backdrop-blur-md shadow-lg py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <a href="/" className="flex-shrink-0 group">
            <AlfinLogo variant="light" size="md" />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Navegación principal">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="link-underline text-white/80 hover:text-white font-body font-medium text-sm tracking-wide transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-sm px-5 py-2.5 group"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" className="group-hover:rotate-12 transition-transform duration-200">
                <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zm3 4V3a3 3 0 10-6 0v2H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1zm-3 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
              </svg>
              Banca por internet
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Abrir menú"
          >
            <div className={`w-5 flex flex-col gap-1 transition-all duration-300 ${menuOpen ? 'gap-0' : ''}`}>
              <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-0.5' : ''}`} />
              <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${menuOpen ? 'opacity-0 w-0' : 'w-full'}`} />
              <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-1' : ''}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden transition-all duration-300 overflow-hidden ${menuOpen ? 'max-h-64 mt-4' : 'max-h-0'}`}>
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-1">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="text-white/80 hover:text-white hover:bg-white/10 px-4 py-2.5 rounded-xl font-body font-medium text-sm transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full text-sm"
              >
                Banca por internet
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
