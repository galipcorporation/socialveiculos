import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  nome: string
  email: string
  papel: string
  ativo: boolean
  avatar_url?: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoginModalOpen: boolean
  loginModalTab: 'login' | 'register'
  openLoginModal: (tab?: 'login' | 'register') => void
  closeLoginModal: () => void
  login: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoginModalOpen: false,
      loginModalTab: 'login',
      openLoginModal: (tab = 'login') =>
        set({ isLoginModalOpen: true, loginModalTab: tab }),
      closeLoginModal: () => set({ isLoginModalOpen: false }),
      login: (token, refreshToken, user) =>
        set({
          token,
          refreshToken,
          user,
          isAuthenticated: true,
          isLoginModalOpen: false,
        }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
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
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
