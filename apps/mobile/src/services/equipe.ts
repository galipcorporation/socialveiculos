import { delay, getDb, mutate, novoId } from './db'
import type { Membro, Papel } from './types'
import { TODOS_MODULOS } from '../lib/modulos'

export interface MembroInput {
  nome: string
  email: string
  telefone?: string
  papel: Papel
  percentual_comissao?: number | null
  /** JSON array das keys de módulos liberados. Ignorado p/ gestor (acesso total). */
  modulos?: string
  /** Senha provisória (no convite). No mock só validamos que foi informada. */
  senha?: string
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
        modulos: input.papel === 'gestor'
          ? JSON.stringify(TODOS_MODULOS)
          : input.modulos ?? JSON.stringify([]),
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

  async excluir(idMembro: string): Promise<void> {
    await delay(150, 300)
    return mutate((db) => {
      db.equipe = db.equipe.filter((m) => m.id !== idMembro)
    })
  },

  async configurarIA(idMembro: string, input: { ativo: boolean; autonomia: 'copiloto' | 'automatico' }): Promise<Membro> {
    await delay(150, 300)
    return mutate((db) => {
      const m = db.equipe.find((x) => x.id === idMembro)
      if (!m) throw new Error('Membro não encontrado.')
      m.assistente_ativo = input.ativo
      m.assistente_autonomia = input.autonomia
      return m
    })
  },
}
