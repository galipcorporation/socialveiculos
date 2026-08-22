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
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  // M6: a API não devolve mais o token pro JS guardar — /auth/login já seta
  // cookie httpOnly (sv_access/sv_refresh) na mesma resposta. `login()` só
  // recebe o `user` porque é o único dado não sensível que a UI precisa.
  login: (user: User) => void
  logout: () => void
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
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'sv-auth-storage', // Nome da chave no localStorage — só guarda `user`, nunca token.
    }
  )
)
