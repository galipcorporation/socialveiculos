// Carteira de clientes — CRUD + busca contra /v1/clientes.
import { api } from '../lib/api'
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

interface ClienteDTO {
  id: string
  loja_id: string
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  rg?: string | null
  data_nascimento?: string | null
  renda_mensal?: number | null
  cep?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  observacoes?: string | null
  created_at: string
}

function mapCliente(c: ClienteDTO): Cliente {
  return {
    id: c.id,
    loja_id: c.loja_id,
    nome: c.nome,
    telefone: c.telefone ?? undefined,
    email: c.email ?? undefined,
    cpf: c.cpf ?? undefined,
    rg: c.rg ?? undefined,
    data_nascimento: c.data_nascimento ?? undefined,
    renda_mensal: c.renda_mensal ?? undefined,
    cep: c.cep ?? undefined,
    endereco: c.endereco ?? undefined,
    bairro: c.bairro ?? undefined,
    cidade: c.cidade ?? undefined,
    estado: c.estado ?? undefined,
    observacoes: c.observacoes ?? undefined,
    created_at: c.created_at,
  }
}

// A API pode responder com lista pura ou paginada { items }.
function extrairLista(data: ClienteDTO[] | { items: ClienteDTO[] }): ClienteDTO[] {
  return Array.isArray(data) ? data : data.items ?? []
}

export const clientesService = {
  async listar(busca = ''): Promise<Cliente[]> {
    const params: Record<string, string> = {}
    if (busca.trim()) params.q = busca.trim()
    const data = await api.get<ClienteDTO[] | { items: ClienteDTO[] }>('/clientes', params)
    return extrairLista(data).map(mapCliente).sort((a, b) => a.nome.localeCompare(b.nome))
  },

  async obter(id: string): Promise<Cliente | undefined> {
    try {
      const c = await api.get<ClienteDTO>(`/clientes/${id}`)
      return mapCliente(c)
    } catch {
      return undefined
    }
  },

  async criar(input: ClienteInput): Promise<Cliente> {
    const c = await api.post<ClienteDTO>('/clientes', { ...input, nome: input.nome.trim() })
    return mapCliente(c)
  },

  async atualizar(id: string, input: ClienteInput): Promise<Cliente> {
    const c = await api.patch<ClienteDTO>(`/clientes/${id}`, { ...input, nome: input.nome.trim() })
    return mapCliente(c)
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/clientes/${id}`)
  },
}
