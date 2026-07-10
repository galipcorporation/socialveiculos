import { api } from '../lib/api'
import { esteiraService } from './esteira'
import type {
  CategoriaCusto, CustoVeiculo, DocumentoVenda, Esteira, Midia, SolicitacaoAprovacao,
  TipoDocumentoVenda, TipoSolicitacao, Veiculo, VeiculoStatus,
} from './types'

export interface VeiculosFiltro {
  busca?: string
  status?: VeiculoStatus | 'todos'
}

export interface VeiculoInput {
  marca: string
  modelo: string
  versao?: string
  tipo: Veiculo['tipo']
  placa?: string
  ano_modelo: number
  ano_fabricacao?: number
  km?: number
  cor?: string
  cambio?: string
  combustivel?: string
  portas?: number
  preco_venda?: number
  preco_custo?: number
  descricao?: string
  opcionais?: string
  publicado_marketplace?: boolean
  fotos?: string[]
}

export interface RegistrarVendaInput {
  comprador_nome: string
  valor_venda: number
  vendedor_nome?: string
  valor_dinheiro?: number
  valor_financiado?: number
  valor_troca?: number
  troca_descricao?: string
}

export const CATEGORIAS_CUSTO: { value: CategoriaCusto; label: string }[] = [
  { value: 'mecanica', label: 'Mecânica' },
  { value: 'pintura', label: 'Pintura / funilaria' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'documentacao', label: 'Documentação' },
  { value: 'estetica', label: 'Estética / limpeza' },
  { value: 'outro', label: 'Outro' },
]

// ── DTOs da API ────────────────────────────────────────────
interface MidiaDTO { id: string; tipo: 'imagem' | 'video'; url: string; ordem: number }
interface VeiculoDTO {
  id: string
  loja_id: string
  placa?: string | null
  marca: string
  modelo: string
  versao?: string | null
  ano_fabricacao?: number | null
  ano_modelo: number
  km?: number | null
  cor?: string | null
  cambio?: string | null
  combustivel?: string | null
  tipo?: string | null
  portas?: number | null
  preco_venda?: number | null
  preco_custo?: number | null
  status: VeiculoStatus
  publicado_marketplace?: boolean
  descricao?: string | null
  opcionais?: string | null
  created_at: string
  updated_at: string
  midias?: MidiaDTO[]
}
interface DocumentoDTO {
  id: string
  tipo: string
  nome: string
  url: string
  visivel_comprador: boolean
  created_at: string
}
interface VendaDataDTO {
  veiculo_id?: string
  documentos?: DocumentoDTO[]
}
interface PrecificacaoDTO {
  fipe?: number | null
  preco_venda?: number | null
  margem_sobre_fipe?: number | null
  dias_no_estoque?: number
  alerta_encalhe?: boolean
  fipe_disponivel?: boolean
}
interface ConsultaPlacaDTO {
  encontrado: boolean
  marca?: string | null
  modelo?: string | null
  ano_modelo?: number | null
  cor?: string | null
}
interface VenderRespDTO {
  contrato_id: string
  veiculo_id: string
  esteira_id?: string | null
  trocas_veiculo_ids?: string[]
}
interface SolicitacaoDTO {
  id: string
  entidade_id: string
  tipo_acao: 'excluir_veiculo' | 'alterar_preco'
  status: 'pendente' | 'aprovado' | 'rejeitado'
  motivo?: string | null
  justificativa_rejeicao?: string | null
  veiculo_marca?: string | null
  veiculo_modelo?: string | null
  created_at: string
  updated_at: string
}

const STATUS_SOL: Record<SolicitacaoDTO['status'], SolicitacaoAprovacao['status']> = {
  pendente: 'pendente', aprovado: 'aprovada', rejeitado: 'rejeitada',
}
const TIPO_SOL: Record<SolicitacaoDTO['tipo_acao'], TipoSolicitacao> = {
  excluir_veiculo: 'exclusao', alterar_preco: 'alteracao_preco',
}

function mapVeiculo(v: VeiculoDTO): Veiculo {
  return {
    id: v.id,
    loja_id: v.loja_id,
    placa: v.placa ?? undefined,
    marca: v.marca,
    modelo: v.modelo,
    versao: v.versao ?? undefined,
    ano_fabricacao: v.ano_fabricacao ?? undefined,
    ano_modelo: v.ano_modelo,
    km: v.km ?? undefined,
    cor: v.cor ?? undefined,
    cambio: v.cambio ?? undefined,
    combustivel: v.combustivel ?? undefined,
    tipo: (v.tipo as Veiculo['tipo']) ?? 'carro',
    portas: v.portas ?? undefined,
    preco_venda: v.preco_venda ?? undefined,
    preco_custo: v.preco_custo ?? undefined,
    status: v.status,
    publicado_marketplace: v.publicado_marketplace ?? false,
    descricao: v.descricao ?? undefined,
    opcionais: v.opcionais ?? undefined,
    created_at: v.created_at,
    updated_at: v.updated_at,
    midias: (v.midias ?? []).map((m): Midia => ({ id: m.id, tipo: m.tipo, url: m.url, ordem: m.ordem })),
  }
}

function mapDoc(d: DocumentoDTO): DocumentoVenda {
  return {
    id: d.id,
    veiculo_id: '',
    tipo: (d.tipo as TipoDocumentoVenda) ?? 'outro',
    nome_arquivo: d.nome,
    visivel_comprador: d.visivel_comprador,
    created_at: d.created_at,
  }
}

function bodyVeiculo(input: VeiculoInput) {
  return {
    marca: input.marca,
    modelo: input.modelo,
    versao: input.versao || null,
    tipo: input.tipo,
    placa: input.placa || null,
    ano_modelo: input.ano_modelo,
    ano_fabricacao: input.ano_fabricacao ?? input.ano_modelo,
    km: input.km ?? 0,
    cor: input.cor || null,
    cambio: input.cambio || null,
    combustivel: input.combustivel || null,
    portas: input.portas ?? null,
    preco_venda: input.preco_venda ?? null,
    preco_custo: input.preco_custo ?? null,
    descricao: input.descricao || null,
    opcionais: input.opcionais || null,
    publicado_marketplace: input.publicado_marketplace ?? false,
    fotos: input.fotos ?? undefined,
  }
}

export const veiculosService = {
  async listar(filtro: VeiculosFiltro = {}): Promise<Veiculo[]> {
    const params: Record<string, string> = {}
    if (filtro.busca?.trim()) params.q = filtro.busca.trim()
    if (filtro.status && filtro.status !== 'todos') params.status = filtro.status
    const data = await api.get<{ items: VeiculoDTO[] }>('/veiculos', params)
    return (data.items ?? []).map(mapVeiculo)
  },

  async obter(idVeiculo: string): Promise<Veiculo> {
    const v = await api.get<VeiculoDTO>(`/veiculos/${idVeiculo}`)
    return mapVeiculo(v)
  },

  async consultarPlaca(placa: string): Promise<{ marca: string; modelo: string; ano_modelo: number; cor?: string } | null> {
    const p = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (p.length !== 7) return null
    try {
      const r = await api.get<ConsultaPlacaDTO>(`/veiculos/consulta-placa/${p}`)
      if (!r.encontrado || !r.marca || !r.modelo) return null
      return {
        marca: r.marca,
        modelo: r.modelo,
        ano_modelo: r.ano_modelo ?? new Date().getFullYear(),
        cor: r.cor ?? undefined,
      }
    } catch {
      return null
    }
  },

  async precificacao(idVeiculo: string): Promise<{ fipe: number; margem_sobre_fipe: number | null; dias_estoque: number; encalhado: boolean } | null> {
    const r = await api.get<PrecificacaoDTO>(`/veiculos/${idVeiculo}/precificacao`)
    if (!r.fipe_disponivel || r.fipe == null) return null
    return {
      fipe: r.fipe,
      margem_sobre_fipe: r.margem_sobre_fipe ?? null,
      dias_estoque: r.dias_no_estoque ?? 0,
      encalhado: r.alerta_encalhe ?? false,
    }
  },

  async criar(input: VeiculoInput): Promise<Veiculo> {
    const v = await api.post<VeiculoDTO>('/veiculos', bodyVeiculo(input))
    return mapVeiculo(v)
  },

  async atualizar(idVeiculo: string, input: VeiculoInput): Promise<Veiculo> {
    const v = await api.patch<VeiculoDTO>(`/veiculos/${idVeiculo}`, bodyVeiculo(input))
    return mapVeiculo(v)
  },

  async alterarStatus(idVeiculo: string, status: VeiculoStatus): Promise<Veiculo> {
    const v = await api.patch<VeiculoDTO>(`/veiculos/${idVeiculo}/status`, { status })
    return mapVeiculo(v)
  },

  async atualizarPreco(idVeiculo: string, preco: number): Promise<Veiculo> {
    const v = await api.patch<VeiculoDTO>(`/veiculos/${idVeiculo}`, { preco_venda: preco })
    return mapVeiculo(v)
  },

  async alterarPublicacao(idVeiculo: string, publicado: boolean): Promise<Veiculo> {
    const v = await api.patch<VeiculoDTO>(`/veiculos/${idVeiculo}/publicar`, { publicado })
    return mapVeiculo(v)
  },

  async excluir(idVeiculo: string): Promise<void> {
    await api.delete(`/veiculos/${idVeiculo}`)
  },

  /** Venda: cria contrato + esteira no backend e retorna a esteira criada. */
  async registrarVenda(idVeiculo: string, input: RegistrarVendaInput): Promise<Esteira> {
    const trocas =
      input.valor_troca && input.valor_troca > 0 && input.troca_descricao?.trim()
        ? [{
            marca: input.troca_descricao.trim().split(' ')[0] || 'Troca',
            modelo: input.troca_descricao.trim().split(' ').slice(1).join(' ') || 'a avaliar',
            valor_avaliacao: input.valor_troca,
            km: 0,
          }]
        : []
    const resp = await api.post<VenderRespDTO>(`/veiculos/${idVeiculo}/vender`, {
      cliente_id: null,
      cliente_novo: { nome: input.comprador_nome.trim(), cpf: null, telefone: null },
      valor_venda: input.valor_venda || null,
      pagamento_dinheiro: input.valor_dinheiro || null,
      financiamento: input.valor_financiado ? { valor: input.valor_financiado, parcelas: null } : null,
      trocas,
    })
    if (resp.esteira_id) {
      return esteiraService.obter(resp.esteira_id)
    }
    throw new Error('Venda registrada, mas a esteira não pôde ser carregada.')
  },

  // ── Custos de preparação ─────────────────────────────────
  async custos(idVeiculo: string): Promise<CustoVeiculo[]> {
    const r = await api.get<{ custos: CustoVeiculoDTO[] }>(`/financeiro/veiculos/${idVeiculo}/custos`)
    return (r.custos ?? []).map((c) => ({
      id: c.id,
      veiculo_id: idVeiculo,
      categoria: (c.categoria as CategoriaCusto) ?? 'outro',
      descricao: c.descricao,
      valor: c.valor,
      created_at: c.created_at,
    }))
  },

  async adicionarCusto(idVeiculo: string, input: { categoria: CategoriaCusto; descricao: string; valor: number }): Promise<CustoVeiculo> {
    const r = await api.post<{ custos: CustoVeiculoDTO[] }>(`/financeiro/veiculos/${idVeiculo}/custos`, {
      descricao: input.descricao.trim(),
      valor: input.valor,
      categoria: input.categoria || null,
    })
    const novo = (r.custos ?? [])[0]
    return {
      id: novo?.id ?? '',
      veiculo_id: idVeiculo,
      categoria: input.categoria,
      descricao: input.descricao.trim(),
      valor: input.valor,
      created_at: novo?.created_at ?? new Date().toISOString(),
    }
  },

  async removerCusto(idVeiculo: string, idCusto: string): Promise<void> {
    await api.delete(`/financeiro/veiculos/${idVeiculo}/custos/${idCusto}`)
  },

  // ── Documentos de venda ──────────────────────────────────
  async documentos(idVeiculo: string): Promise<DocumentoVenda[]> {
    const r = await api.get<VendaDataDTO>(`/veiculos/${idVeiculo}/venda`)
    return (r.documentos ?? []).map((d) => ({ ...mapDoc(d), veiculo_id: idVeiculo }))
  },

  async adicionarDocumento(idVeiculo: string, input: { tipo: TipoDocumentoVenda; nome_arquivo: string; visivel_comprador: boolean }): Promise<DocumentoVenda> {
    const d = await api.post<DocumentoDTO>(`/veiculos/${idVeiculo}/documentos`, {
      tipo: input.tipo,
      nome: input.nome_arquivo.trim(),
      url: '',
      visivel_comprador: input.visivel_comprador,
    })
    return { ...mapDoc(d), veiculo_id: idVeiculo }
  },

  async removerDocumento(idVeiculo: string, idDoc: string): Promise<void> {
    await api.delete(`/veiculos/${idVeiculo}/documentos/${idDoc}`)
  },

  // ── Aprovação do vendedor ────────────────────────────────
  // O backend cria a solicitação automaticamente quando um vendedor tenta
  // excluir/alterar preço. Aqui disparamos a ação real e sintetizamos o retorno.
  async solicitarAprovacao(idVeiculo: string, input: { tipo: TipoSolicitacao; motivo: string; solicitante_nome: string; novo_preco?: number }): Promise<SolicitacaoAprovacao> {
    if (input.tipo === 'exclusao') {
      await api.delete(`/veiculos/${idVeiculo}?motivo=${encodeURIComponent(input.motivo.trim())}`)
    } else if (input.novo_preco != null) {
      await api.patch(`/veiculos/${idVeiculo}`, { preco_venda: input.novo_preco })
    }
    return {
      id: 'pendente',
      veiculo_id: idVeiculo,
      veiculo_nome: 'Veículo',
      tipo: input.tipo,
      motivo: input.motivo.trim(),
      solicitante_nome: input.solicitante_nome,
      novo_preco: input.novo_preco,
      status: 'pendente',
      created_at: new Date().toISOString(),
    }
  },

  async solicitacoes(status?: 'pendente' | 'aprovada' | 'rejeitada'): Promise<SolicitacaoAprovacao[]> {
    const path = status && status !== 'pendente' ? '/aprovacoes/historico' : '/aprovacoes/pendentes'
    const data = await api.get<SolicitacaoDTO[]>(path)
    let lista = data.map((s): SolicitacaoAprovacao => ({
      id: s.id,
      veiculo_id: s.entidade_id,
      veiculo_nome: [s.veiculo_marca, s.veiculo_modelo].filter(Boolean).join(' ') || 'Veículo',
      tipo: TIPO_SOL[s.tipo_acao],
      motivo: s.motivo ?? '',
      solicitante_nome: '',
      status: STATUS_SOL[s.status],
      created_at: s.created_at,
      resolvida_em: s.status !== 'pendente' ? s.updated_at : undefined,
    }))
    if (status) lista = lista.filter((s) => s.status === status)
    return lista
  },

  async resolverSolicitacao(idSol: string, aprovar: boolean): Promise<void> {
    await api.post(`/aprovacoes/${idSol}/processar`, {
      status: aprovar ? 'aprovado' : 'rejeitado',
    })
  },
}

interface CustoVeiculoDTO {
  id: string
  descricao: string
  valor: number
  categoria?: string | null
  created_at: string
}
