// Carteira de clientes (M059) — CRUD + busca sobre a tabela `clientes` do mock.
// Espelha a aba Clientes / ClienteModal do gestor. Swap p/ API = reimplementar.

import { delay, getDb, mutate, novoId } from './db'
import { LOJA_ID } from './seed'
import type { Cliente } from './types'

export interface ClienteInput {
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  renda_mensal?: number
  cep?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
}

export const clientesService = {
  async listar(busca = ''): Promise<Cliente[]> {
    await delay()
    const db = await getDb()
    let lista = [...db.clientes]
    const q = busca.trim().toLowerCase()
    if (q) {
      const qd = q.replace(/\D/g, '')
      lista = lista.filter((c) =>
        c.nome.toLowerCase().includes(q) ||
        (!!qd && ((c.cpf ?? '').replace(/\D/g, '').includes(qd) || (c.telefone ?? '').replace(/\D/g, '').includes(qd))),
      )
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome))
  },

  async obter(id: string): Promise<Cliente | undefined> {
    await delay(120, 240)
    const db = await getDb()
    return db.clientes.find((c) => c.id === id)
  },

  async criar(input: ClienteInput): Promise<Cliente> {
    await delay(200, 400)
    return mutate((db) => {
      const cliente: Cliente = {
        id: novoId('cli'),
        loja_id: LOJA_ID,
        created_at: new Date().toISOString(),
        ...input,
        nome: input.nome.trim(),
      }
      db.clientes.unshift(cliente)
      return cliente
    })
  },

  async atualizar(id: string, input: ClienteInput): Promise<Cliente> {
    await delay(200, 400)
    return mutate((db) => {
      const c = db.clientes.find((x) => x.id === id)
      if (!c) throw new Error('Cliente não encontrado.')
      Object.assign(c, input, { nome: input.nome.trim() })
      return c
    })
  },

  async excluir(id: string): Promise<void> {
    await delay(150, 300)
    return mutate((db) => {
      db.clientes = db.clientes.filter((c) => c.id !== id)
    })
  },
}
