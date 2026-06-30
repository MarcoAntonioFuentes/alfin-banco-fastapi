// src/components/dashboard/PerfilModule.tsx
// Módulo de Perfil: datos del usuario y sesión activa

import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso))
}

function InfoRow({ label, value, mono = false, sensitive = false }:
  { label: string; value: string; mono?: boolean; sensitive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0 group">
      <span className="text-gray-400 font-body text-sm">{label}</span>
      <span className={`font-body text-sm text-charcoal text-right ${mono ? 'font-mono' : 'font-medium'} ${sensitive ? 'tracking-widest' : ''}`}>
        {sensitive ? '••••••••' : value}
      </span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <h2 className="font-display font-semibold text-base text-charcoal">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

export default function PerfilModule() {
  const { usuario, accessToken } = useAuth()
  const { data } = useDashboard()

  const ROL_LABELS: Record<string, string> = {
    cliente: 'Cliente', analista: 'Analista de créditos',
    comite: 'Comité crediticio', admin: 'Administrador',
  }

  const tokenPreview = accessToken
    ? `${accessToken.slice(0, 12)}...${accessToken.slice(-6)}`
    : '—'

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl" style={{ animationDuration: '0.4s' }}>

      {/* Page header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-charcoal">Mi Perfil</h1>
        <p className="text-gray-400 font-body text-sm mt-1">Información de tu cuenta y sesión activa</p>
      </div>

      {/* Avatar card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #7A1D8A 0%, #430e4f 70%, #1e0524 100%)' }}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4F00, rgba(255,79,0,0.6))' }}>
            {(usuario?.nombre_completo?.[0] ?? usuario?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div>
            <p className="font-display font-bold text-xl text-white leading-tight">{usuario?.nombre_completo ?? '—'}</p>
            <p className="text-white/60 font-body text-sm">{usuario?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 bg-white/15 text-white/90 text-xs font-body font-medium px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {ROL_LABELS[usuario?.rol ?? ''] ?? usuario?.rol}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-body font-medium ${
                usuario?.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {usuario?.estado ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal data */}
      <Section title="Datos personales" icon="👤">
        <InfoRow label="Nombre completo" value={usuario?.nombre_completo ?? '—'} />
        <InfoRow label="Correo electrónico" value={usuario?.email ?? '—'} />
        <InfoRow label="DNI" value={usuario?.dni ?? '—'} mono />
        <InfoRow label="Teléfono" value={usuario?.telefono ?? 'No registrado'} />
        <InfoRow label="Fecha de registro" value={usuario?.fecha_registro ? fmtDate(usuario.fecha_registro) : '—'} />
        <InfoRow label="Rol en el sistema" value={ROL_LABELS[usuario?.rol ?? ''] ?? (usuario?.rol ?? '—')} />
      </Section>

      {/* Account summary */}
      {data && (
        <Section title="Resumen de cuenta" icon="🏦">
          <InfoRow label="Cuentas activas"  value={String(data.cuentas.length)} />
          <InfoRow label="Cuenta principal" value={data.cuentas[0]?.numero_cuenta ?? 'Sin cuenta'} mono />
          <InfoRow label="Créditos activos" value={String(data.creditos_activos)} />
          <InfoRow label="Saldo total PEN"  value={new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(data.saldo_total_pen)} />
        </Section>
      )}

      {/* Session info */}
      <Section title="Sesión activa" icon="🔐">
        <InfoRow label="Estado" value="Sesión activa" />
        <InfoRow label="Token" value={tokenPreview} mono />
        <InfoRow label="ID de usuario" value={usuario?.id ? `${usuario.id.slice(0, 8)}...` : '—'} mono />
        <div className="py-3.5 flex items-center justify-between">
          <span className="text-gray-400 font-body text-sm">Seguridad</span>
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-body">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M7 1L1 3.5V7c0 3.1 2.5 5.8 6 6.5 3.5-.7 6-3.4 6-6.5V3.5L7 1zm-1 9.2L3.8 8l1.1-1.1L6.8 8.2l3.3-3.3L11.2 6 6 10.2z"/>
            </svg>
            SSL 256-bit · Supabase Auth
          </div>
        </div>
      </Section>

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
        <span className="text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="font-display font-semibold text-amber-700 text-sm">Aviso de seguridad</p>
          <p className="text-amber-600 font-body text-xs mt-0.5 leading-relaxed">
            Alfin Banco nunca te solicitará tu contraseña, token o datos personales por correo electrónico, teléfono o mensaje de texto. Si recibes este tipo de solicitudes, repórtalo a <strong>seguridad@alfinbanco.pe</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
