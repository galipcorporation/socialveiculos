// apps/mobile/src/stores/authStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useExperienciaStore } from './experienciaStore'

export interface User {
  id: string
  nome: string
  email: string
  papel: 'admin_plataforma' | 'gestor' | 'vendedor' | 'cliente'
  ativo: boolean
  mfa_ativo: boolean
  avatar_url?: string | null
  telefone?: string | null
  modulos?: string | null
  loja_id?: string | null
  /** Mostrar o botão flutuante de ações rápidas (AssistiveTouch). */
  botao_flutuante?: boolean
  /** Ainda perguntar sobre o botão flutuante no primeiro acesso. */
  botao_flutuante_perguntar?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  setToken: (token: string) => void
  /**
   * Atualiza o usuário logado (após editar o perfil), mantendo a sessão.
   * Preserva o vínculo de loja quando a resposta não o traz — ver setUser.
   */
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),
      // Sair do painel devolve o app à Vitrine: sem isso a experiência segue
      // 'lojista' no AsyncStorage e o RootNavigator reabre direto no Login.
      logout: () => {
        useExperienciaStore.getState().escolher('comprador')
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
      },
      setToken: (token) => set({ token }),
      // Rotas que devolvem o usuário sem resolver MembroLoja mandam
      // loja_id/modulos vazios; trocar o objeto inteiro apagaria o vínculo e
      // esconderia o "Sou lojista". Só sobrescreve esses campos se vierem.
      setUser: (user) =>
        set((s) => ({
          user: {
            ...user,
            loja_id: user.loja_id ?? s.user?.loja_id ?? null,
            modulos: user.modulos ?? s.user?.modulos,
          },
        })),
    }),
    {
      name: 'sv-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
