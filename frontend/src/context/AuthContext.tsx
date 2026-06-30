// src/context/AuthContext.tsx
// Global authentication state using React Context + localStorage persistence

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface Usuario {
  id: string
  email: string
  nombre_completo: string
  dni: string
  telefono?: string
  rol: string
  estado: string
  fecha_registro: string
}

interface AuthState {
  usuario: Usuario | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, usuario: Usuario) => void
  logout: () => void
  updateUsuario: (usuario: Partial<Usuario>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY    = 'alfin_access_token'
const REFRESH_KEY  = 'alfin_refresh_token'
const USUARIO_KEY  = 'alfin_usuario'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    usuario:         null,
    accessToken:     null,
    refreshToken:    null,
    isAuthenticated: false,
    isLoading:       true,
  })

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const token   = localStorage.getItem(TOKEN_KEY)
      const refresh = localStorage.getItem(REFRESH_KEY)
      const raw     = localStorage.getItem(USUARIO_KEY)
      const usuario = raw ? (JSON.parse(raw) as Usuario) : null

      if (token && usuario) {
        setState({ usuario, accessToken: token, refreshToken: refresh, isAuthenticated: true, isLoading: false })
      } else {
        setState(s => ({ ...s, isLoading: false }))
      }
    } catch {
      setState(s => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback((accessToken: string, refreshToken: string, usuario: Usuario) => {
    localStorage.setItem(TOKEN_KEY,   accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
    setState({ usuario, accessToken, refreshToken, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USUARIO_KEY)
    setState({ usuario: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false })
  }, [])

  const updateUsuario = useCallback((partial: Partial<Usuario>) => {
    setState(s => {
      if (!s.usuario) return s
      const updated = { ...s.usuario, ...partial }
      localStorage.setItem(USUARIO_KEY, JSON.stringify(updated))
      return { ...s, usuario: updated }
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
