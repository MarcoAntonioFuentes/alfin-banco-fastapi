// src/components/auth/PreLoginScreen.tsx
// Security landing before exposing login form — builds trust and context

import { useEffect, useState } from 'react'
import { AlfinLogo, PrivacyBadge } from '../shared'

interface Props { onContinue: () => void }

const securityPoints = [
  { icon: '🔒', text: 'Sesión cifrada con SSL de 256 bits' },
  { icon: '🛡️', text: 'Autenticación protegida por Supabase Auth' },
  { icon: '👁️', text: 'Monitoreo antifraude en tiempo real' },
  { icon: '📱', text: 'Verificación de dispositivos registrados' },
]

export default function PreLoginScreen({ onContinue }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t) }, [])

  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

      {/* Logo */}
      <div className="flex justify-center mb-8">
        <AlfinLogo variant="dark" size="lg" />
      </div>

      {/* Headline */}
      <div className="text-center mb-8">
        <h1 className="font-display font-bold text-2xl text-charcoal mb-2">
          Zona segura
        </h1>
        <p className="text-gray-500 font-body text-sm leading-relaxed">
          Estás a punto de acceder a tu banca personal.<br />
          Tu privacidad y seguridad son nuestra prioridad.
        </p>
      </div>

      {/* Security checklist */}
      <div className="bg-violet-50/60 rounded-2xl border border-violet-100 p-5 mb-6">
        <p className="font-display font-semibold text-xs uppercase tracking-widest text-violet-500 mb-3">
          Protecciones activas
        </p>
        <ul className="space-y-2.5">
          {securityPoints.map((pt, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 transition-all duration-300`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="text-base">{pt.icon}</span>
              <span className="text-gray-600 text-sm font-body">{pt.text}</span>
              <span className="ml-auto w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="text-green-600">
                  <path d="M6.5 2.5l-3 3L2 4"/>
                </svg>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Warning notice */}
      <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-7 text-xs text-amber-700 font-body leading-snug">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-500 flex-shrink-0 mt-0.5">
          <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/>
        </svg>
        <span>
          <strong>Aviso de seguridad:</strong> Alfin Banco <strong>nunca</strong> te pedirá tu contraseña por teléfono, correo o mensaje. Si recibes este tipo de solicitudes, repórtalo.
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={onContinue}
        className="btn-primary w-full text-base py-4 group"
      >
        Continuar al inicio de sesión
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="group-hover:translate-x-1 transition-transform">
          <path d="M1 8a7 7 0 1014 0A7 7 0 001 8zm7-3.5a.5.5 0 01.5.5v3.793l1.146-1.147a.5.5 0 01.708.708l-2 2a.5.5 0 01-.708 0l-2-2a.5.5 0 01.708-.708L7.5 8.793V5a.5.5 0 01.5-.5z"/>
        </svg>
      </button>

      <div className="flex justify-center mt-5">
        <PrivacyBadge />
      </div>
    </div>
  )
}
