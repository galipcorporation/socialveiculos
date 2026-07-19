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

export interface CampoExtraTemplate {
  chave: string
  label: string
}

export interface TemplateContrato {
  id: string
  nome: string
  corpo: string
  camposExtras: CampoExtraTemplate[]
  usarIdentidadeLoja: boolean
  created_at: string
}

export interface VarGroup {
  grupo: string
  itens: { chave: string; label: string }[]
}

/** Catálogo de variáveis do sistema — espelha o contexto Jinja2 resolvido em
 *  apps/api/routers/contratos.py (_render_template_contrato). Chaves com ponto,
 *  igual ao catálogo do apps/gestor (variaveisContrato.ts). */
export const CATALOGO_VARIAVEIS: VarGroup[] = [
  {
    grupo: 'Cliente',
    itens: [
      { chave: 'cliente.nome', label: 'Nome' },
      { chave: 'cliente.cpf', label: 'CPF' },
      { chave: 'cliente.rg', label: 'RG' },
      { chave: 'cliente.telefone', label: 'Telefone' },
      { chave: 'cliente.endereco', label: 'Endereço' },
      { chave: 'cliente.cidade', label: 'Cidade' },
      { chave: 'cliente.estado', label: 'Estado' },
    ],
  },
  {
    grupo: 'Veículo',
    itens: [
      { chave: 'veiculo.marca', label: 'Marca' },
      { chave: 'veiculo.modelo', label: 'Modelo' },
      { chave: 'veiculo.versao', label: 'Versão' },
      { chave: 'veiculo.ano_fabricacao', label: 'Ano fabricação' },
      { chave: 'veiculo.ano_modelo', label: 'Ano modelo' },
      { chave: 'veiculo.placa', label: 'Placa' },
      { chave: 'veiculo.cor', label: 'Cor' },
      { chave: 'veiculo.km', label: 'KM' },
      { chave: 'veiculo.combustivel', label: 'Combustível' },
    ],
  },
  {
    grupo: 'Loja',
    itens: [
      { chave: 'loja.nome', label: 'Razão social' },
      { chave: 'loja.cnpj', label: 'CNPJ' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.telefone', label: 'Telefone' },
    ],
  },
  {
    grupo: 'Contrato / Valores',
    itens: [
      { chave: 'contrato.numero', label: 'Número' },
      { chave: 'contrato.data', label: 'Data' },
      { chave: 'contrato.valor_venda', label: 'Valor da venda' },
      { chave: 'contrato.valor_entrada', label: 'Entrada' },
      { chave: 'contrato.parcelas', label: 'Parcelas' },
      { chave: 'contrato.observacoes', label: 'Observações' },
    ],
  },
]

export function labelsDe(groups: VarGroup[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const g of groups) for (const it of g.itens) m[it.chave] = it.label
  return m
}

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
  campos_extras: CampoExtraTemplate[]
  usar_identidade_loja: boolean
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
  return {
    id: t.id,
    nome: t.nome,
    corpo: t.conteudo_html,
    camposExtras: t.campos_extras ?? [],
    usarIdentidadeLoja: t.usar_identidade_loja,
    created_at: t.created_at,
  }
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

  async salvarTemplate(input: {
    id?: string
    nome: string
    corpo: string
    camposExtras?: CampoExtraTemplate[]
    usarIdentidadeLoja?: boolean
  }): Promise<TemplateContrato> {
    const payload = {
      nome: input.nome.trim(),
      conteudo_html: input.corpo,
      campos_extras: input.camposExtras ?? [],
      usar_identidade_loja: input.usarIdentidadeLoja ?? true,
    }
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
