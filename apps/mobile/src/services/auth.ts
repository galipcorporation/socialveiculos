import { api } from '../lib/api'
import type { User } from '../stores/authStore'

// Autenticação real contra o apps/api. Login + refresh; MFA fica p/ rodada futura.

export interface LoginResult {
  access_token: string
  refresh_token: string
  user: User
}

export const authService = {
  async login(email: string, senha: string): Promise<LoginResult> {
    return api.post<LoginResult>('/auth/login', { email: email.trim(), senha })
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken })
    } catch {
      // logout local sempre prossegue mesmo se a revogação remota falhar
    }
  },

  credenciaisDemo(): { email: string; senha: string } {
    return { email: 'gestor@autopremium.com.br', senha: 'demo123' }
  },
}
