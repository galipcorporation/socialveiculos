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

// Motivo do último logout involuntário (conta desativada / sessão expirada).
// Guardado fora do store persistido para o Login exibir o aviso e limpar em seguida.
const LOGOUT_REASON_KEY = 'sv-logout-reason'

export function setLogoutReason(reason: string) {
  try { sessionStorage.setItem(LOGOUT_REASON_KEY, reason) } catch { /* ignore */ }
}

export function consumeLogoutReason(): string | null {
  try {
    const r = sessionStorage.getItem(LOGOUT_REASON_KEY)
    if (r) sessionStorage.removeItem(LOGOUT_REASON_KEY)
    return r
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (token: string, refreshToken: string, user: User) => void
  logout: (reason?: string) => void
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
      logout: (reason?: string) => {
        if (reason) setLogoutReason(reason)
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        })
      },
      setToken: (token) => set({ token }),
    }),
    {
      name: 'sv-auth-storage', // Nome da chave no localStorage
    }
  )
)
