// src/components/shared/ProtectedRoute.tsx
// Protege rutas por autenticación Y por rol

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from './index'
import { STAFF_ROLES } from '../../App'

interface Props {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthenticated, isLoading, usuario } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" color="violet" />
          <p className="text-gray-400 font-body text-sm">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // No autenticado → al login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const rol = usuario?.rol ?? ''

  // Si hay roles permitidos y el usuario no tiene ninguno
  if (allowedRoles && !allowedRoles.includes(rol)) {
    // Staff intentando entrar al dashboard de cliente → redirigir al core
    if (STAFF_ROLES.includes(rol)) {
      return <Navigate to="/core" replace />
    }
    // Cliente intentando entrar al core → redirigir a su dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
