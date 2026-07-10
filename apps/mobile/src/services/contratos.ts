// Contratos — lista + detalhe + PDF + templates contra /v1/contratos e
// /v1/templates-contrato.
import { api } from '../lib/api'
import type { Contrato, StatusContrato } from './types'

export interface ContratoInput {
  tipo: 'compra_venda' | 'compra'
  veiculo_nome?: string
  cliente_nome?: string
  valor_venda?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
}

export interface TemplateContrato {
  id: string
  nome: string
  corpo: string
  created_at: string
}

export const VARIAVEIS_CONTRATO: { chave: string; label: string }[] = [
  { chave: '{{cliente_nome}}', label: 'Nome do cliente' },
  { chave: '{{cliente_cpf}}', label: 'CPF do cliente' },
  { chave: '{{veiculo}}', label: 'Veículo (marca/modelo)' },
  { chave: '{{placa}}', label: 'Placa' },
  { chave: '{{valor}}', label: 'Valor da venda' },
  { chave: '{{entrada}}', label: 'Entrada' },
  { chave: '{{parcelas}}', label: 'Nº de parcelas' },
  { chave: '{{loja_nome}}', label: 'Nome da loja' },
  { chave: '{{data}}', label: 'Data' },
]

interface ContratoDTO {
  id: string
  numero: string
  tipo: 'compra_venda' | 'compra'
  status: StatusContrato
  veiculo_nome?: string | null
  cliente_nome?: string | null
  valor_venda?: number | null
  valor_entrada?: number | null
  parcelas?: number | null
  observacoes?: string | null
  created_at: string
}
interface TemplateDTO {
  id: string
  nome: string
  conteudo_html: string
  created_at: string
}

function mapContrato(c: ContratoDTO): Contrato {
  return {
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    status: c.status,
    veiculo_nome: c.veiculo_nome ?? undefined,
    cliente_nome: c.cliente_nome ?? undefined,
    valor_venda: c.valor_venda ?? undefined,
    valor_entrada: c.valor_entrada ?? undefined,
    parcelas: c.parcelas ?? undefined,
    observacoes: c.observacoes ?? undefined,
    created_at: c.created_at,
  }
}

function mapTemplate(t: TemplateDTO): TemplateContrato {
  return { id: t.id, nome: t.nome, corpo: t.conteudo_html, created_at: t.created_at }
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/v1'

export const contratosService = {
  async lista(): Promise<Contrato[]> {
    const data = await api.get<{ items: ContratoDTO[] }>('/contratos')
    return (data.items ?? []).map(mapContrato).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async detalhe(id: string): Promise<Contrato | undefined> {
    try {
      const c = await api.get<ContratoDTO>(`/contratos/${id}`)
      return mapContrato(c)
    } catch {
      return undefined
    }
  },

  async pdfUrl(id: string): Promise<string> {
    // O PDF é servido autenticado; retornamos a URL absoluta do endpoint.
    return `${API_BASE}/contratos/${id}/pdf`
  },

  async criar(input: ContratoInput): Promise<Contrato> {
    const c = await api.post<ContratoDTO>('/contratos', {
      tipo: input.tipo,
      veiculo_nome: input.veiculo_nome || null,
      cliente_nome: input.cliente_nome || null,
      valor_venda: input.valor_venda ?? null,
      valor_entrada: input.valor_entrada ?? null,
      parcelas: input.parcelas ?? null,
      observacoes: input.observacoes || null,
    })
    return mapContrato(c)
  },

  async alterarStatus(id: string, status: StatusContrato): Promise<Contrato> {
    const c = await api.patch<ContratoDTO>(`/contratos/${id}`, { status })
    return mapContrato(c)
  },

  async templates(): Promise<TemplateContrato[]> {
    const data = await api.get<{ items: TemplateDTO[] }>('/templates-contrato')
    return (data.items ?? []).map(mapTemplate).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async salvarTemplate(input: { id?: string; nome: string; corpo: string }): Promise<TemplateContrato> {
    const payload = { nome: input.nome.trim(), conteudo_html: input.corpo }
    const t = input.id
      ? await api.patch<TemplateDTO>(`/templates-contrato/${input.id}`, payload)
      : await api.post<TemplateDTO>('/templates-contrato', payload)
    return mapTemplate(t)
  },

  async duplicarTemplate(id: string): Promise<TemplateContrato> {
    const t = await api.post<TemplateDTO>(`/templates-contrato/${id}/duplicar`)
    return mapTemplate(t)
  },

  async removerTemplate(id: string): Promise<void> {
    await api.delete(`/templates-contrato/${id}`)
  },
}
