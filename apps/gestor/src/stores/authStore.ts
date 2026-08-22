import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  nome: string
  email: string
  papel: 'admin_plataforma' | 'gestor' | 'vendedor' | 'cliente'
  ativo: boolean
  mfa_ativo: boolean
  avatar_url?: string | null
  telefone?: string | null
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
  isAuthenticated: boolean
  login: (user: User) => void
  updateUser: (data: Partial<User>) => void
  logout: (reason?: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      updateUser: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        })),
      logout: (reason?: string) => {
        if (reason) setLogoutReason(reason)
        set({
          user: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'sv-auth-storage', // Nome da chave no localStorage — só guarda `user`, nunca token.
    }
  )
)
