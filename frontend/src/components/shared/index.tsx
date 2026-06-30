// src/components/shared/index.tsx
// Reusable UI primitives

import { ReactNode, useEffect, useState } from 'react'

// ─── Logo ─────────────────────────────────────────────────────────────────────
export function AlfinLogo({ variant = 'dark', size = 'md' }: { variant?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }
  const color  = variant === 'light' ? 'text-white' : 'text-violet-500'
  const accent = variant === 'light' ? 'text-orange-400' : 'text-orange-500'

  return (
    <div className={`font-display font-bold ${sizes[size]} tracking-tight flex items-center gap-1.5 select-none`}>
      {/* Abstract diamond mark */}
      <span className="relative inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="flex-shrink-0">
          <path d="M14 2L24 8V20L14 26L4 20V8L14 2Z" fill={variant === 'light' ? 'white' : '#7A1D8A'} opacity="0.15" />
          <path d="M14 2L24 8V20L14 26L4 20V8L14 2Z" stroke={variant === 'light' ? 'white' : '#7A1D8A'} strokeWidth="1.5" />
          <circle cx="14" cy="14" r="4" fill={variant === 'light' ? '#FF4F00' : '#FF4F00'} />
        </svg>
      </span>
      <span className={color}>alfin</span>
      <span className={accent}>banco</span>
    </div>
  )
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
interface AlertProps {
  type: 'error' | 'success' | 'warning' | 'info'
  title?: string
  message: string
  onClose?: () => void
  className?: string
}

export function Alert({ type, title, message, onClose, className = '' }: AlertProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const configs = {
    error:   { bg: 'bg-red-50',    border: 'border-red-300',   icon: '✕', iconBg: 'bg-red-100 text-red-600',   text: 'text-red-800',   sub: 'text-red-600' },
    success: { bg: 'bg-green-50',  border: 'border-green-300', icon: '✓', iconBg: 'bg-green-100 text-green-600', text: 'text-green-800', sub: 'text-green-600' },
    warning: { bg: 'bg-amber-50',  border: 'border-amber-300', icon: '!', iconBg: 'bg-amber-100 text-amber-600', text: 'text-amber-800', sub: 'text-amber-600' },
    info:    { bg: 'bg-violet-50', border: 'border-violet-200',icon: 'i', iconBg: 'bg-violet-100 text-violet-600', text: 'text-violet-800', sub: 'text-violet-600' },
  }
  const c = configs[type]

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 px-4 py-3.5 rounded-xl border
        ${c.bg} ${c.border}
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${className}
      `}
    >
      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${c.iconBg}`}>
        {icon(type)}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className={`font-display font-semibold text-sm ${c.text}`}>{title}</p>}
        <p className={`text-sm ${title ? c.sub : c.text} leading-snug`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`flex-shrink-0 ${c.sub} hover:opacity-70 transition-opacity`}
          aria-label="Cerrar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      )}
    </div>
  )
}

function icon(type: string) {
  if (type === 'error')   return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 3.586L1.707.293.293 1.707 3.586 5 .293 8.293l1.414 1.414L5 6.414l3.293 3.293 1.414-1.414L6.414 5l3.293-3.293L8.293.293 5 3.586z"/></svg>
  if (type === 'success') return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M8.707 2.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L4 5.586l3.293-3.293a1 1 0 011.414 0z"/></svg>
  if (type === 'warning') return <span className="text-xs font-bold">!</span>
  return <span className="text-xs font-bold">i</span>
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', color = 'violet' }: { size?: 'sm'|'md'|'lg'; color?: 'violet'|'white'|'orange' }) {
  const sizes  = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' }
  const colors = { violet: 'border-violet-200 border-t-violet-500', white: 'border-white/20 border-t-white', orange: 'border-orange-200 border-t-orange-500' }
  return (
    <div className={`rounded-full animate-spin ${sizes[size]} ${colors[color]}`} role="status" aria-label="Cargando" />
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'violet' }: { children: ReactNode; variant?: 'violet'|'orange'|'green'|'gray' }) {
  const variants = {
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    green:  'bg-green-100  text-green-700  border-green-200',
    gray:   'bg-gray-100   text-gray-600   border-gray-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  )
}

// ─── PrivacyBadge ─────────────────────────────────────────────────────────────
export function PrivacyBadge() {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-xs">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-green-500 flex-shrink-0">
        <path d="M8 1L2 3.5V8c0 3.3 2.5 6.1 6 6.9 3.5-.8 6-3.6 6-6.9V3.5L8 1zm-1 9.4L4.6 8l1.1-1.1 1.3 1.3 2.9-2.9 1.1 1.1L7 10.4z"/>
      </svg>
      Conexión segura SSL 256-bit
    </div>
  )
}
