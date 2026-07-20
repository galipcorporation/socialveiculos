import { api } from '../lib/api'
import type {
  CategoriaItemEsteira, EstagioEsteira, Esteira, ItemChecklist, MinhaVenda, StatusItemEsteira,
} from './types'

// ── DTOs da API (apps/api) ─────────────────────────────────
interface VeiculoResumoDTO {
  id: string
  marca?: string | null
  modelo?: string | null
  ano_modelo?: number | null
  placa?: string | null
  foto?: string | null
}
interface CompradorResumoDTO {
  id: string
  nome?: string | null
  telefone?: string | null
}
interface ItemChecklistDTO {
  id: string
  chave: string
  titulo: string
  categoria: CategoriaItemEsteira
  responsavel: 'loja' | 'comprador'
  status: StatusItemEsteira
  obrigatorio: boolean
  prazo_em?: string | null
  doc_id?: string | null
  observacao?: string | null
  concluido_em?: string | null
  vencido?: boolean
}
interface EsteiraResumoDTO {
  id: string
  estagio: EstagioEsteira
  veiculo?: VeiculoResumoDTO | null
  comprador?: CompradorResumoDTO | null
  aberta_em?: string | null
}
interface EsteiraDetalheDTO extends EsteiraResumoDTO {
  vendedor_id?: string | null
  vendedor_nome?: string | null
  valor_venda?: number | null
  comissao_valor?: number | null
  comissao_percentual?: number | null
  contrato_id?: string | null
  concluida_em?: string | null
  itens: ItemChecklistDTO[]
}
interface MinhaVendaDTO {
  esteira_id: string
  veiculo_id?: string | null
  veiculo_nome?: string | null
  valor_venda?: number | null
  comissao_valor?: number | null
  comissao_percentual?: number | null
  comissao_paga?: boolean | null
  estagio: string
  aberta_em: string
}

function nomeVeiculo(v?: VeiculoResumoDTO | null): string {
  if (!v) return 'Veículo'
  return [v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'
}

function mapItem(i: ItemChecklistDTO): ItemChecklist {
  return {
    id: i.id,
    chave: i.chave,
    titulo: i.titulo,
    categoria: i.categoria,
    responsavel: i.responsavel,
    status: i.status,
    obrigatorio: i.obrigatorio,
    prazo_em: i.prazo_em ?? null,
    vencido: i.vencido ?? false,
    concluido_em: i.concluido_em ?? null,
    documento_nome: i.doc_id ? 'Documento anexado' : null,
  }
}

// A comissão paga é modelada como o item de checklist chave 'comissao_paga'.
function comissaoPaga(itens: ItemChecklist[]): boolean | null {
  const item = itens.find((i) => i.chave === 'comissao_paga')
  if (!item) return null
  return item.status === 'concluido'
}

function mapDetalhe(d: EsteiraDetalheDTO): Esteira {
  const itens = (d.itens ?? []).map(mapItem)
  return {
    id: d.id,
    estagio: d.estagio,
    veiculo_nome: nomeVeiculo(d.veiculo),
    veiculo_id: d.veiculo?.id,
    contrato_id: d.contrato_id ?? undefined,
    comprador_nome: d.comprador?.nome ?? '—',
    vendedor_nome: d.vendedor_nome ?? undefined,
    valor_venda: d.valor_venda ?? undefined,
    comissao_valor: d.comissao_valor ?? undefined,
    comissao_percentual: d.comissao_percentual ?? undefined,
    comissao_paga: comissaoPaga(itens),
    itens,
    aberta_em: d.aberta_em ?? new Date().toISOString(),
    concluida_em: d.concluida_em ?? null,
  }
}

function mapResumo(r: EsteiraResumoDTO): Esteira {
  return {
    id: r.id,
    estagio: r.estagio,
    veiculo_nome: nomeVeiculo(r.veiculo),
    veiculo_id: r.veiculo?.id,
    comprador_nome: r.comprador?.nome ?? '—',
    vendedor_nome: undefined,
    valor_venda: undefined,
    comissao_valor: undefined,
    comissao_paga: null,
    itens: [],
    aberta_em: r.aberta_em ?? new Date().toISOString(),
    concluida_em: null,
  }
}

export const esteiraService = {
  async listar(): Promise<Esteira[]> {
    const data = await api.get<EsteiraResumoDTO[]>('/esteira')
    return data.map(mapResumo)
  },

  async obter(idEsteira: string): Promise<Esteira> {
    const d = await api.get<EsteiraDetalheDTO>(`/esteira/${idEsteira}`)
    return mapDetalhe(d)
  },

  /** Alterna o status de um item. Ao CONCLUIR um item financeiro (débitos, taxa
   *  de transferência, entrada), passe `valor` — o backend gera o lançamento
   *  financeiro com esse valor; sem ele, o lançamento fica R$ 0 para ajuste. */
  async alternarItem(idEsteira: string, idItem: string, valor?: number): Promise<Esteira> {
    const atual = await api.get<EsteiraDetalheDTO>(`/esteira/${idEsteira}`)
    const item = atual.itens.find((i) => i.id === idItem)
    const novoStatus = item?.status === 'concluido' ? 'pendente' : 'concluido'
    const body: { status: StatusItemEsteira; valor?: number } = { status: novoStatus }
    if (novoStatus === 'concluido' && valor && valor > 0) body.valor = valor
    const d = await api.patch<EsteiraDetalheDTO>(`/esteira/${idEsteira}/itens/${idItem}`, body)
    return mapDetalhe(d)
  },

  // Anexa documento: sobe o PDF real no veículo e vincula ao item da esteira.
  async anexarDocumento(
    idEsteira: string,
    idItem: string,
    veiculoId: string,
    arquivo: { uri: string; nome: string; mimeType?: string },
  ): Promise<Esteira> {
    const fd = new FormData()
    fd.append('file', {
      uri: arquivo.uri,
      name: arquivo.nome,
      type: arquivo.mimeType || 'application/pdf',
    } as unknown as Blob)
    fd.append('tipo', 'outro')
    fd.append('visivel_comprador', 'true')
    const item = await api.get<EsteiraDetalheDTO>(`/esteira/${idEsteira}`)
    const chave = item.itens.find((i) => i.id === idItem)?.chave
    const doc = await api.post<{ id: string; url: string; nome: string }>(
      `/veiculos/${veiculoId}/documentos/upload`,
      fd,
    )
    const d = await api.post<EsteiraDetalheDTO>(
      `/esteira/${idEsteira}/documentos`,
      undefined,
      { params: { item_chave: chave, nome: doc.nome, url: doc.url } },
    )
    return mapDetalhe(d)
  },

  async adicionarItem(
    idEsteira: string,
    input: { titulo: string; categoria: CategoriaItemEsteira; obrigatorio: boolean },
  ): Promise<Esteira> {
    const d = await api.post<EsteiraDetalheDTO>(`/esteira/${idEsteira}/itens`, {
      titulo: input.titulo.trim(),
      categoria: input.categoria,
      obrigatorio: input.obrigatorio,
    })
    return mapDetalhe(d)
  },

  async removerItem(idEsteira: string, idItem: string): Promise<Esteira> {
    const d = await api.delete<EsteiraDetalheDTO>(`/esteira/${idEsteira}/itens/${idItem}`)
    return mapDetalhe(d)
  },

  async concluir(idEsteira: string): Promise<Esteira> {
    const d = await api.post<EsteiraDetalheDTO>(`/esteira/${idEsteira}/concluir`)
    return mapDetalhe(d)
  },

  async marcarComissaoPaga(idEsteira: string): Promise<Esteira> {
    const atual = await api.get<EsteiraDetalheDTO>(`/esteira/${idEsteira}`)
    const item = atual.itens.find((i) => i.chave === 'comissao_paga')
    if (item && item.status !== 'concluido') {
      const d = await api.patch<EsteiraDetalheDTO>(`/esteira/${idEsteira}/itens/${item.id}`, {
        status: 'concluido',
      })
      return mapDetalhe(d)
    }
    return mapDetalhe(atual)
  },
}

export const comissoesService = {
  async minhasVendas(): Promise<MinhaVenda[]> {
    const data = await api.get<MinhaVendaDTO[]>('/me/vendas')
    return data.map((v) => ({
      esteira_id: v.esteira_id,
      veiculo_nome: v.veiculo_nome ?? undefined,
      valor_venda: v.valor_venda ?? undefined,
      comissao_valor: v.comissao_valor ?? undefined,
      comissao_percentual: v.comissao_percentual ?? undefined,
      comissao_paga: v.comissao_paga ?? null,
      estagio: v.estagio as EstagioEsteira,
      aberta_em: v.aberta_em,
    }))
  },
}
