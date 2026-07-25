import { api } from '../lib/api'
import type { User } from '../stores/authStore'

// Autenticação real contra o apps/api. Login + refresh; MFA fica p/ rodada futura.

export interface LoginResult {
  access_token: string
  refresh_token: string
  user: User
}

export interface PerfilMeInput {
  nome?: string
  telefone?: string
}

export const authService = {
  async login(email: string, senha: string): Promise<LoginResult> {
    return api.post<LoginResult>('/auth/login', { email: email.trim(), senha })
  },

  /** Usuário logado, já com avatar_url e telefone. */
  async me(): Promise<User> {
    return api.get<User>('/auth/me')
  },

  /** Edita nome e telefone do próprio usuário. E-mail não muda por aqui. */
  async atualizarPerfil(input: PerfilMeInput): Promise<User> {
    return api.patch<User>('/auth/me', {
      ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
      ...(input.telefone !== undefined ? { telefone: input.telefone.trim() } : {}),
    })
  },

  /** Envia a foto de perfil (galeria/câmera) e devolve o usuário atualizado. */
  async enviarAvatar(uri: string): Promise<User> {
    const nome = uri.split('/').pop() || 'avatar.jpg'
    const ext = nome.split('.').pop()?.toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const fd = new FormData()
    fd.append('file', { uri, name: nome, type: mime } as unknown as Blob)
    return api.post<User>('/auth/me/avatar', fd)
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken })
    } catch {
      // logout local sempre prossegue mesmo se a revogação remota falhar
    }
  },
}
