import { api } from '../lib/api'
import { veiculosService } from './veiculos'
import type {
  Cliente, EtapaLead, Interacao, Lead, MotivoPerda, Negociacao, OrigemLead, TipoInteracao,
} from './types'

export interface NegociacaoInput {
  valor_proposta: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
}

// Dados do cliente editáveis de dentro do lead — no mobile o lead É o cadastro
// do cliente, não existe tela de clientes separada.
export interface ClienteLeadInput {
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  renda_mensal?: number
  cep?: string
  endereco?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
}

export interface LeadInput extends ClienteLeadInput {
  veiculo_id?: string
  origem: OrigemLead
  valor_proposta?: number
  lead_observacoes?: string
  responsavel_id?: string
  proximo_contato?: string
}

// ── DTOs ───────────────────────────────────────────────────
interface ClienteDTO {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  rg?: string | null
  data_nascimento?: string | null
  renda_mensal?: number | null
  cep?: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  observacoes?: string | null
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
interface InteracaoDTO {
  id: string
  lead_id: string
  tipo: TipoInteracao
  texto: string
  autor_nome?: string | null
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
  responsavel_id?: string | null
  responsavel_nome?: string | null
  proximo_contato?: string | null
  motivo_perda?: MotivoPerda | null
  motivo_perda_detalhe?: string | null
  cliente?: ClienteDTO | null
  negociacoes?: NegociacaoDTO[]
  interacoes?: InteracaoDTO[]
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

function mapInteracao(i: InteracaoDTO): Interacao {
  return {
    id: i.id,
    lead_id: i.lead_id,
    tipo: i.tipo,
    texto: i.texto,
    autor: i.autor_nome ?? undefined,
    created_at: i.created_at,
  }
}

function mapCliente(c?: ClienteDTO | null): Cliente | undefined {
  if (!c) return undefined
  return {
    id: c.id,
    loja_id: '',
    nome: c.nome,
    telefone: c.telefone ?? undefined,
    email: c.email ?? undefined,
    cpf: c.cpf ?? undefined,
    rg: c.rg ?? undefined,
    data_nascimento: c.data_nascimento ?? undefined,
    renda_mensal: c.renda_mensal ?? undefined,
    cep: c.cep ?? undefined,
    endereco: c.endereco ?? undefined,
    numero: c.numero ?? undefined,
    bairro: c.bairro ?? undefined,
    cidade: c.cidade ?? undefined,
    estado: c.estado ?? undefined,
    observacoes: c.observacoes ?? undefined,
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
    responsavel_id: l.responsavel_id ?? undefined,
    responsavel_nome: l.responsavel_nome ?? undefined,
    proximo_contato: l.proximo_contato ?? undefined,
    motivo_perda: l.motivo_perda ?? undefined,
    motivo_perda_detalhe: l.motivo_perda_detalhe ?? undefined,
    cliente: mapCliente(l.cliente),
    negociacoes: (l.negociacoes ?? []).map(mapNegociacao),
    interacoes: (l.interacoes ?? []).map(mapInteracao),
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

// Campos opcionais vazios viram undefined: o backend valida formato (CPF com
// dígito, e-mail, UF) e rejeitaria string vazia.
function limpar<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = typeof v === 'string' ? v.trim() : v
  }
  return out as Partial<T>
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
    const { veiculo_id, origem, valor_proposta, lead_observacoes, responsavel_id, proximo_contato, ...cliente } = input
    // O backend cadastra o cliente junto com o lead (rota aceita bloco inline).
    const l = await api.post<LeadDTO>('/leads', {
      cliente: limpar(cliente),
      veiculo_id: veiculo_id || null,
      etapa: 'lead',
      origem,
      valor_proposta: valor_proposta || null,
      observacoes: lead_observacoes?.trim() || null,
      responsavel_id: responsavel_id || null,
      proximo_contato: proximo_contato || null,
    })
    // O valor informado no cadastro também vira a primeira proposta, senão não
    // apareceria no histórico de negociações.
    if (valor_proposta) {
      try {
        await this.adicionarNegociacao(l.id, { valor_proposta })
      } catch {
        // o lead já foi criado; o valor segue em lead.valor_proposta
      }
      return this.obter(l.id)
    }
    return enriquecerVeiculo(mapLead(l))
  },

  async atualizar(idLead: string, dados: Partial<{
    veiculo_id: string | null
    origem: OrigemLead
    valor_proposta: number | null
    observacoes: string | null
    responsavel_id: string | null
    proximo_contato: string | null
  }>): Promise<Lead> {
    await api.patch(`/leads/${idLead}`, dados)
    return this.obter(idLead)
  },

  async excluir(idLead: string): Promise<void> {
    await api.delete(`/leads/${idLead}`)
  },

  // Edita o cadastro do cliente sem sair do lead.
  async atualizarCliente(idLead: string, dados: ClienteLeadInput): Promise<Lead> {
    const l = await api.patch<LeadDTO>(`/leads/${idLead}/cliente`, limpar(dados))
    return enriquecerVeiculo(mapLead(l))
  },

  async moverEtapa(
    idLead: string,
    etapa: EtapaLead,
    perda?: { motivo_perda?: MotivoPerda; motivo_perda_detalhe?: string },
  ): Promise<Lead> {
    await api.patch(`/leads/${idLead}/etapa`, { etapa, ...(perda ?? {}) })
    return this.obter(idLead)
  },

  async atualizarProposta(idLead: string, valor: number | undefined, observacoes?: string): Promise<Lead> {
    await api.patch(`/leads/${idLead}`, {
      valor_proposta: valor ?? null,
      ...(observacoes !== undefined ? { observacoes } : {}),
    })
    return this.obter(idLead)
  },

  // ── Negociações / propostas ──────────────────────────────
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

  async atualizarNegociacao(idLead: string, idNeg: string, input: NegociacaoInput): Promise<Negociacao> {
    const n = await api.patch<NegociacaoDTO>(`/leads/${idLead}/negociacoes/${idNeg}`, {
      valor_proposta: input.valor_proposta,
      valor_entrada: input.valor_entrada ?? null,
      parcelas: input.parcelas ?? null,
      observacoes: input.observacoes?.trim() || null,
    })
    return mapNegociacao(n)
  },

  async removerNegociacao(idLead: string, idNeg: string): Promise<void> {
    await api.delete(`/leads/${idLead}/negociacoes/${idNeg}`)
  },

  // ── Timeline de interações ───────────────────────────────
  async interacoes(idLead: string): Promise<Interacao[]> {
    const data = await api.get<InteracaoDTO[]>(`/leads/${idLead}/interacoes`)
    return data.map(mapInteracao)
  },

  async adicionarInteracao(idLead: string, tipo: TipoInteracao, texto: string): Promise<Interacao> {
    const i = await api.post<InteracaoDTO>(`/leads/${idLead}/interacoes`, { tipo, texto: texto.trim() })
    return mapInteracao(i)
  },

  async atualizarInteracao(idLead: string, idInt: string, tipo: TipoInteracao, texto: string): Promise<Interacao> {
    const i = await api.patch<InteracaoDTO>(`/leads/${idLead}/interacoes/${idInt}`, { tipo, texto: texto.trim() })
    return mapInteracao(i)
  },

  async removerInteracao(idLead: string, idInt: string): Promise<void> {
    await api.delete(`/leads/${idLead}/interacoes/${idInt}`)
  },
}
