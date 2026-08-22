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
  isAuthenticated: boolean
  // M6: a API não devolve mais o token pro JS guardar — /auth/login já seta
  // cookie httpOnly (sv_access/sv_refresh) na mesma resposta. `login()` só
  // recebe o `user` porque é o único dado não sensível que a UI precisa
  // (nome, papel, avatar). Um XSS que rode `JSON.stringify(localStorage)`
  // não encontra mais nada capaz de autenticar como este usuário.
  login: (user: User) => void
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
