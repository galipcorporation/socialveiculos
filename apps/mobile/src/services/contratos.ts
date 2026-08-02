// Contratos — lista + detalhe + PDF + templates contra /v1/contratos e
// /v1/templates-contrato.
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'
import type { Contrato, StatusContrato } from './types'

// O backend (`ContratoCreateRequest`) só aceita **ids** — `veiculo_nome` /
// `cliente_nome` eram descartados em silêncio pelo Pydantic, e o contrato
// nascia órfão (`veiculo_id = None`). Como o `veiculo_nome` da resposta é
// derivado do relacionamento, ele voltava vazio: contrato sem veículo nem
// cliente na lista, e PDF com as variáveis todas em branco.
export interface ContratoInput {
  tipo: 'compra_venda' | 'compra'
  veiculo_id?: string
  cliente_id?: string
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
      { chave: 'cliente.email', label: 'E-mail' },
      { chave: 'cliente.endereco', label: 'Endereço' },
      { chave: 'cliente.cidade', label: 'Cidade' },
      { chave: 'cliente.estado', label: 'Estado' },
      { chave: 'cliente.nacionalidade', label: 'Nacionalidade' },
      { chave: 'cliente.estado_civil', label: 'Estado civil' },
      { chave: 'cliente.profissao', label: 'Profissão' },
      { chave: 'cliente.cnh', label: 'CNH' },
      { chave: 'cliente.cnh_categoria', label: 'Categoria CNH' },
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
      { chave: 'veiculo.chassi', label: 'Chassi' },
      { chave: 'veiculo.renavam', label: 'RENAVAM' },
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
      { chave: 'loja.inscricao_estadual', label: 'Inscrição estadual' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.cep', label: 'CEP' },
      { chave: 'loja.telefone', label: 'Telefone' },
      { chave: 'loja.email', label: 'E-mail' },
      { chave: 'loja.representante_nome', label: 'Representante legal' },
      { chave: 'loja.representante_cpf', label: 'CPF do representante' },
      { chave: 'loja.representante_rg', label: 'RG do representante' },
    ],
  },
  {
    grupo: 'Contrato / Valores',
    itens: [
      { chave: 'contrato.numero', label: 'Número' },
      { chave: 'contrato.data', label: 'Data' },
      { chave: 'contrato.data_extenso', label: 'Data por extenso' },
      { chave: 'contrato.valor_venda', label: 'Valor da venda' },
      { chave: 'contrato.valor_venda_extenso', label: 'Valor da venda por extenso' },
      { chave: 'contrato.valor_entrada', label: 'Entrada' },
      { chave: 'contrato.valor_entrada_extenso', label: 'Entrada por extenso' },
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
  veiculo_id?: string | null
  cliente_id?: string | null
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
    veiculo_id: c.veiculo_id ?? undefined,
    cliente_id: c.cliente_id ?? undefined,
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
    // O PDF é servido autenticado; anexamos o token de sessão e o ID da loja
    // atual como query parameters para permitir que o navegador do celular o baixe
    // sem precisar de headers HTTP.
    const { token } = useAuthStore.getState()
    const { lojaId } = useLojaAtivaStore.getState()
    let url = `${API_BASE}/contratos/${id}/pdf`
    const params: string[] = []
    if (token) {
      params.push(`token=${encodeURIComponent(token)}`)
    }
    if (lojaId) {
      params.push(`loja_id=${encodeURIComponent(lojaId)}`)
    }
    if (params.length) {
      url += `?${params.join('&')}`
    }
    return url
  },

  async criar(input: ContratoInput): Promise<Contrato> {
    const c = await api.post<ContratoDTO>('/contratos', {
      tipo: input.tipo,
      veiculo_id: input.veiculo_id || null,
      cliente_id: input.cliente_id || null,
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

  async atualizar(id: string, input: Partial<ContratoInput> & { status?: StatusContrato }): Promise<Contrato> {
    const c = await api.patch<ContratoDTO>(`/contratos/${id}`, {
      tipo: input.tipo,
      status: input.status,
      veiculo_id: input.veiculo_id,
      cliente_id: input.cliente_id,
      valor_venda: input.valor_venda,
      valor_entrada: input.valor_entrada,
      parcelas: input.parcelas,
      observacoes: input.observacoes,
    })
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
