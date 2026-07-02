import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  nome: string
  email: string
  papel: 'admin_plataforma' | 'gestor' | 'vendedor' | 'cliente'
  ativo: boolean
  mfa_ativo: boolean
  modulos?: string | null // JSON array de módulos liberados (para vendedor)
  loja_id?: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (token, refreshToken, user) =>
        set({
          token,
          refreshToken,
          user,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'sv-auth-storage', // Nome da chave no localStorage
    }
  )
)
