// src/App.tsx
// /dashboard → solo clientes | /core → solo staff (analista, admin, etc.)

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'

import LandingPage       from './pages/LandingPage'
import LoginPage         from './pages/LoginPage'
import RegisterPage      from './pages/RegisterPage'
import RecuperarPage     from './pages/RecuperarPage'
import NuevaPasswordPage from './pages/NuevaPasswordPage'
import DashboardPage     from './pages/DashboardPage'
import CorePage          from './pages/CorePage'

export const STAFF_ROLES = ['admin','analista','asesor','riesgos','comite','gerencia']
export const CLIENT_ROLES = ['cliente']

// Redirige al panel correcto tras el login
function AutoRedirect() {
  const { isAuthenticated, isLoading, usuario } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (STAFF_ROLES.includes(usuario?.rol ?? '')) return <Navigate to="/core" replace />
  return <Navigate to="/dashboard" replace />
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-pearl">
      <div className="text-center">
        <p className="font-display font-bold text-8xl text-violet-100 mb-4 select-none">404</p>
        <h1 className="font-display font-bold text-2xl text-charcoal mb-2">Página no encontrada</h1>
        <p className="text-gray-400 font-body mb-6">La página que buscas no existe.</p>
        <a href="/" className="btn-primary inline-flex">Volver al inicio</a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/"               element={<LandingPage />} />
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/registro"       element={<RegisterPage />} />
          <Route path="/recuperar"      element={<RecuperarPage />} />
          <Route path="/nueva-password" element={<NuevaPasswordPage />} />

          {/* Redirección automática al panel correcto */}
          <Route path="/inicio" element={<AutoRedirect />} />

          {/* ── Solo clientes ─────────────────────────────────── */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={CLIENT_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          } />

          {/* ── Solo staff ────────────────────────────────────── */}
          <Route path="/core" element={
            <ProtectedRoute allowedRoles={STAFF_ROLES}>
              <CorePage />
            </ProtectedRoute>
          } />

          {/* Si un staff intenta ir a /dashboard → redirigir a /core */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
