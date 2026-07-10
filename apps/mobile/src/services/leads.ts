import { api } from '../lib/api'
import { clientesService } from './clientes'
import { veiculosService } from './veiculos'
import type { Cliente, EtapaLead, Interacao, Lead, Negociacao, OrigemLead } from './types'

export interface NegociacaoInput {
  valor_proposta: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
}

export interface LeadInput {
  cliente_nome: string
  cliente_telefone?: string
  veiculo_id?: string
  origem: OrigemLead
  valor_proposta?: number
  observacoes?: string
}

// ── DTOs ───────────────────────────────────────────────────
interface ClienteSimplesDTO {
  id: string
  nome: string
  telefone?: string | null
  cpf?: string | null
}
interface NegociacaoDTO {
  id: string
  lead_id: string
  valor_proposta?: number | null
  valor_entrada?: number | null
  parcelas?: number | null
  observacoes?: string | null
  created_at: string
}
interface LeadDTO {
  id: string
  loja_id: string
  cliente_id: string
  veiculo_id?: string | null
  etapa: EtapaLead
  origem: OrigemLead
  valor_proposta?: number | null
  observacoes?: string | null
  cliente?: ClienteSimplesDTO | null
  negociacoes?: NegociacaoDTO[]
  created_at: string
  updated_at: string
}

function mapNegociacao(n: NegociacaoDTO): Negociacao {
  return {
    id: n.id,
    lead_id: n.lead_id,
    valor_proposta: n.valor_proposta ?? 0,
    valor_entrada: n.valor_entrada ?? undefined,
    parcelas: n.parcelas ?? undefined,
    observacoes: n.observacoes ?? undefined,
    created_at: n.created_at,
  }
}

// A timeline livre não é modelada no backend; derivamos as interações das
// negociações + o marco de criação do lead.
function derivarInteracoes(l: LeadDTO): Interacao[] {
  const itens: Interacao[] = [
    { id: `${l.id}-criado`, lead_id: l.id, tipo: 'sistema', texto: 'Lead criado', created_at: l.created_at },
  ]
  for (const n of l.negociacoes ?? []) {
    const valor = (n.valor_proposta ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    itens.push({
      id: `${n.id}-int`,
      lead_id: l.id,
      tipo: 'proposta',
      texto: `Proposta: ${valor}${n.parcelas ? ` em ${n.parcelas}x` : ''}`,
      created_at: n.created_at,
    })
  }
  return itens.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function mapClienteSimples(c?: ClienteSimplesDTO | null): Cliente | undefined {
  if (!c) return undefined
  return {
    id: c.id,
    loja_id: '',
    nome: c.nome,
    telefone: c.telefone ?? undefined,
    cpf: c.cpf ?? undefined,
    created_at: '',
  }
}

function mapLead(l: LeadDTO): Lead {
  return {
    id: l.id,
    loja_id: l.loja_id,
    cliente_id: l.cliente_id,
    veiculo_id: l.veiculo_id ?? undefined,
    etapa: l.etapa,
    origem: l.origem,
    valor_proposta: l.valor_proposta ?? undefined,
    observacoes: l.observacoes ?? undefined,
    cliente: mapClienteSimples(l.cliente),
    interacoes: derivarInteracoes(l),
    created_at: l.created_at,
    updated_at: l.updated_at,
  }
}

async function enriquecerVeiculo(lead: Lead): Promise<Lead> {
  if (!lead.veiculo_id) return lead
  try {
    lead.veiculo = await veiculosService.obter(lead.veiculo_id)
  } catch {
    // veículo removido — segue sem o card
  }
  return lead
}

export const leadsService = {
  async listar(): Promise<Lead[]> {
    const data = await api.get<LeadDTO[]>('/leads')
    return data.map(mapLead).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  },

  async obter(idLead: string): Promise<Lead> {
    const l = await api.get<LeadDTO>(`/leads/${idLead}`)
    return enriquecerVeiculo(mapLead(l))
  },

  async criar(input: LeadInput): Promise<Lead> {
    // Acha um cliente pelo nome ou cadastra na hora (paridade com o mock).
    const nome = input.cliente_nome.trim()
    const existentes = await clientesService.listar(nome)
    let cliente = existentes.find((c) => c.nome.toLowerCase() === nome.toLowerCase())
    if (!cliente) {
      cliente = await clientesService.criar({ nome, telefone: input.cliente_telefone })
    }
    const l = await api.post<LeadDTO>('/leads', {
      cliente_id: cliente.id,
      veiculo_id: input.veiculo_id || null,
      etapa: 'lead',
      origem: input.origem,
      valor_proposta: input.valor_proposta || null,
      observacoes: input.observacoes || null,
    })
    return enriquecerVeiculo(mapLead(l))
  },

  async moverEtapa(idLead: string, etapa: EtapaLead): Promise<Lead> {
    await api.patch(`/leads/${idLead}/etapa`, { etapa })
    return this.obter(idLead)
  },

  // Timeline livre não é persistida no backend; recarrega o lead.
  async adicionarInteracao(idLead: string, _tipo: Interacao['tipo'], _texto: string): Promise<Lead> {
    return this.obter(idLead)
  },

  async atualizarProposta(idLead: string, valor: number | undefined, observacoes?: string): Promise<Lead> {
    await api.patch(`/leads/${idLead}`, {
      valor_proposta: valor ?? null,
      ...(observacoes !== undefined ? { observacoes } : {}),
    })
    return this.obter(idLead)
  },

  async negociacoes(idLead: string): Promise<Negociacao[]> {
    const data = await api.get<NegociacaoDTO[]>(`/leads/${idLead}/negociacoes`)
    return data.map(mapNegociacao).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async adicionarNegociacao(idLead: string, input: NegociacaoInput): Promise<Negociacao> {
    const n = await api.post<NegociacaoDTO>(`/leads/${idLead}/negociacoes`, {
      valor_proposta: input.valor_proposta,
      valor_entrada: input.valor_entrada ?? null,
      parcelas: input.parcelas ?? null,
      observacoes: input.observacoes?.trim() || null,
    })
    return mapNegociacao(n)
  },

  // Sem endpoint de remoção de negociação no backend; mantém a assinatura
  // para não quebrar a tela (a proposta permanece no histórico).
  async removerNegociacao(_idNeg: string): Promise<void> {
    return
  },
}
