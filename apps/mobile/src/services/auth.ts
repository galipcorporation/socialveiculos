import { delay } from './db'
import { LOJA_ID } from './seed'
import type { User } from '../stores/authStore'

// Autenticação simulada — mesmas credenciais de dev do restante do projeto.
// Ao plugar a API real: trocar por api.post('/auth/login', ...) mantendo o contrato.

interface ContaMock {
  senha: string
  user: User
}

const CONTAS: Record<string, ContaMock> = {
  'gestor@autopremium.com.br': {
    senha: 'demo123',
    user: {
      id: 'user-gestor-001',
      nome: 'Ricardo Almeida',
      email: 'gestor@autopremium.com.br',
      papel: 'gestor',
      ativo: true,
      mfa_ativo: false,
      loja_id: LOJA_ID,
    },
  },
  'paulo@autopremium.com.br': {
    senha: 'demo123',
    user: {
      id: 'user-vend-001',
      nome: 'Paulo Mendes',
      email: 'paulo@autopremium.com.br',
      papel: 'vendedor',
      ativo: true,
      mfa_ativo: false,
      loja_id: LOJA_ID,
    },
  },
}

export interface LoginResult {
  access_token: string
  refresh_token: string
  user: User
}

export const authService = {
  async login(email: string, senha: string): Promise<LoginResult> {
    await delay(500, 900)
    const conta = CONTAS[email.trim().toLowerCase()]
    if (!conta || conta.senha !== senha) {
      throw new Error('E-mail ou senha incorretos.')
    }
    return {
      access_token: `mock-access-${Date.now()}`,
      refresh_token: `mock-refresh-${Date.now()}`,
      user: conta.user,
    }
  },

  credenciaisDemo(): { email: string; senha: string } {
    return { email: 'gestor@autopremium.com.br', senha: 'demo123' }
  },
}
