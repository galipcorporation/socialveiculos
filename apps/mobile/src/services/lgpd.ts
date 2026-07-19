// LGPD — exportar dados pessoais e excluir/anonimizar a conta (B2C).
// Backend: /v1/lgpd/exportar (qualquer usuário) e /v1/lgpd/excluir (só CLIENTE B2C).
import { api } from '../lib/api'

export interface DadosExportados {
  perfil: Record<string, unknown>
  favoritos: unknown[]
  mensagens: unknown[]
  sessoes: unknown[]
}

export const lgpdService = {
  /** Baixa todos os dados pessoais do usuário (perfil, favoritos, mensagens, sessões). */
  async exportar(): Promise<DadosExportados> {
    return api.get<DadosExportados>('/lgpd/exportar')
  },

  /** Solicita a exclusão e anonimização da conta. Irreversível. Só clientes B2C. */
  async excluirConta(): Promise<{ message: string }> {
    return api.delete<{ message: string }>('/lgpd/excluir')
  },
}
