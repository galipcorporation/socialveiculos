import { delay, getDb, mutate, novoId } from './db'
import type { Membro, Papel } from './types'

export interface MembroInput {
  nome: string
  email: string
  telefone?: string
  papel: Papel
  percentual_comissao?: number | null
}

export const equipeService = {
  async listar(): Promise<Membro[]> {
    await delay()
    const db = await getDb()
    return [...db.equipe].sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
      if (a.papel !== b.papel) return a.papel === 'gestor' ? -1 : 1
      return a.nome.localeCompare(b.nome)
    })
  },

  async criar(input: MembroInput): Promise<Membro> {
    await delay()
    return mutate((db) => {
      if (db.equipe.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) {
        throw new Error('Já existe um membro com este e-mail.')
      }
      const novo: Membro = {
        id: novoId('mem'),
        nome: input.nome,
        email: input.email,
        telefone: input.telefone,
        papel: input.papel,
        ativo: true,
        percentual_comissao: input.papel === 'vendedor' ? input.percentual_comissao ?? 0 : null,
        vendas_mes: 0,
        created_at: new Date().toISOString(),
      }
      db.equipe.push(novo)
      return novo
    })
  },

  async atualizar(idMembro: string, input: Partial<MembroInput>): Promise<Membro> {
    await delay()
    return mutate((db) => {
      const m = db.equipe.find((x) => x.id === idMembro)
      if (!m) throw new Error('Membro não encontrado.')
      Object.assign(m, input)
      return m
    })
  },

  async alternarAtivo(idMembro: string): Promise<Membro> {
    await delay(120, 260)
    return mutate((db) => {
      const m = db.equipe.find((x) => x.id === idMembro)
      if (!m) throw new Error('Membro não encontrado.')
      m.ativo = !m.ativo
      return m
    })
  },
}
