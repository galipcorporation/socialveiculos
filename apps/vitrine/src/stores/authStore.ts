import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  nome: string
  email: string
  papel: string
  ativo: boolean
  avatar_url?: string | null
  mfa_ativo?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoginModalOpen: boolean
  loginModalTab: 'login' | 'register'
  openLoginModal: (tab?: 'login' | 'register') => void
  closeLoginModal: () => void
  // M6: a API não devolve mais o token pro JS guardar — /auth/login já seta
  // cookie httpOnly (sv_access/sv_refresh) na mesma resposta. `login()` só
  // recebe o `user` porque é o único dado não sensível que a UI precisa.
  login: (user: User) => void
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoginModalOpen: false,
      loginModalTab: 'login',
      openLoginModal: (tab = 'login') =>
        set({ isLoginModalOpen: true, loginModalTab: tab }),
      closeLoginModal: () => set({ isLoginModalOpen: false }),
      login: (user) =>
        set({
          user,
          isAuthenticated: true,
          isLoginModalOpen: false,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
      updateUser: (patch) =>
        set((state) =>
          state.user ? { user: { ...state.user, ...patch } } : {}
        ),
    }),
    {
      name: 'sv-vitrine-auth-storage',
      // Só persistir os campos de autenticação, excluindo o estado de abertura do modal
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
