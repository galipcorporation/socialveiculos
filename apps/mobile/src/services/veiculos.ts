import { delay, getDb, mutate, novoId } from './db'
import { LOJA_ID } from './seed'
import type { CategoriaCusto, CustoVeiculo, Esteira, Midia, Veiculo, VeiculoStatus } from './types'

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
  // Pagamento composto (M058) — soma deve fechar com valor_venda.
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

function aplicarInput(v: Veiculo, input: VeiculoInput) {
  Object.assign(v, {
    marca: input.marca,
    modelo: input.modelo,
    versao: input.versao,
    tipo: input.tipo,
    placa: input.placa,
    ano_modelo: input.ano_modelo,
    ano_fabricacao: input.ano_fabricacao ?? input.ano_modelo,
    km: input.km,
    cor: input.cor,
    cambio: input.cambio,
    combustivel: input.combustivel,
    portas: input.portas,
    preco_venda: input.preco_venda,
    preco_custo: input.preco_custo,
    descricao: input.descricao,
    opcionais: input.opcionais,
    publicado_marketplace: input.publicado_marketplace ?? false,
    updated_at: new Date().toISOString(),
  })
  if (input.fotos) {
    v.midias = input.fotos.map((url, i): Midia => ({ id: novoId('mid'), tipo: 'imagem', url, ordem: i }))
  }
}

export const veiculosService = {
  async listar(filtro: VeiculosFiltro = {}): Promise<Veiculo[]> {
    await delay()
    const db = await getDb()
    let lista = [...db.veiculos]
    if (filtro.status && filtro.status !== 'todos') {
      lista = lista.filter((v) => v.status === filtro.status)
    }
    if (filtro.busca?.trim()) {
      const q = filtro.busca.trim().toLowerCase()
      lista = lista.filter((v) =>
        [v.marca, v.modelo, v.versao, v.placa, v.cor, String(v.ano_modelo)]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(q))
      )
    }
    // Disponíveis primeiro, depois mais recentes
    const peso: Record<VeiculoStatus, number> = { disponivel: 0, reservado: 1, repasse: 2, vendido: 3, inativo: 4 }
    return lista.sort((a, b) => peso[a.status] - peso[b.status] || b.created_at.localeCompare(a.created_at))
  },

  async obter(idVeiculo: string): Promise<Veiculo> {
    await delay(120, 260)
    const db = await getDb()
    const v = db.veiculos.find((x) => x.id === idVeiculo)
    if (!v) throw new Error('Veículo não encontrado.')
    return v
  },

  async criar(input: VeiculoInput): Promise<Veiculo> {
    await delay()
    return mutate((db) => {
      const agora = new Date().toISOString()
      const novo: Veiculo = {
        id: novoId('vei'),
        loja_id: LOJA_ID,
        status: 'disponivel',
        created_at: agora,
        updated_at: agora,
        midias: [],
        marca: input.marca,
        modelo: input.modelo,
        tipo: input.tipo,
        ano_modelo: input.ano_modelo,
      }
      aplicarInput(novo, input)
      db.veiculos.unshift(novo)
      return novo
    })
  },

  async atualizar(idVeiculo: string, input: VeiculoInput): Promise<Veiculo> {
    await delay()
    return mutate((db) => {
      const v = db.veiculos.find((x) => x.id === idVeiculo)
      if (!v) throw new Error('Veículo não encontrado.')
      aplicarInput(v, input)
      return v
    })
  },

  async alterarStatus(idVeiculo: string, status: VeiculoStatus): Promise<Veiculo> {
    await delay(150, 300)
    return mutate((db) => {
      const v = db.veiculos.find((x) => x.id === idVeiculo)
      if (!v) throw new Error('Veículo não encontrado.')
      v.status = status
      v.updated_at = new Date().toISOString()
      return v
    })
  },

  async alterarPublicacao(idVeiculo: string, publicado: boolean): Promise<Veiculo> {
    await delay(150, 300)
    return mutate((db) => {
      const v = db.veiculos.find((x) => x.id === idVeiculo)
      if (!v) throw new Error('Veículo não encontrado.')
      v.publicado_marketplace = publicado
      v.updated_at = new Date().toISOString()
      return v
    })
  },

  async excluir(idVeiculo: string): Promise<void> {
    await delay()
    return mutate((db) => {
      db.veiculos = db.veiculos.filter((x) => x.id !== idVeiculo)
    })
  },

  /** Venda: marca vendido, abre esteira de pós-venda e lança receita. */
  async registrarVenda(idVeiculo: string, input: RegistrarVendaInput): Promise<Esteira> {
    await delay(350, 600)
    return mutate((db) => {
      const v = db.veiculos.find((x) => x.id === idVeiculo)
      if (!v) throw new Error('Veículo não encontrado.')
      v.status = 'vendido'
      v.publicado_marketplace = false
      v.updated_at = new Date().toISOString()

      const agora = new Date().toISOString()
      const nome = `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''}`

      const vendedor = db.equipe.find((m) => m.nome === input.vendedor_nome)
      const percentual = vendedor?.percentual_comissao ?? null
      const comissao = percentual ? Math.round(input.valor_venda * percentual) / 100 : undefined

      const modelos: { chave: string; titulo: string; categoria: 'contrato' | 'financeiro' | 'documento' | 'transferencia'; responsavel: 'loja' | 'comprador' }[] = [
        { chave: 'contrato_gerado', titulo: 'Gerar contrato de compra e venda', categoria: 'contrato', responsavel: 'loja' },
        { chave: 'contrato_assinado', titulo: 'Colher assinaturas do contrato', categoria: 'contrato', responsavel: 'loja' },
        { chave: 'pagamento_confirmado', titulo: 'Confirmar pagamento integral', categoria: 'financeiro', responsavel: 'loja' },
        { chave: 'recibo_emitido', titulo: 'Emitir recibo de quitação', categoria: 'financeiro', responsavel: 'loja' },
        { chave: 'crlv_entregue', titulo: 'Receber CRLV assinado', categoria: 'documento', responsavel: 'comprador' },
        { chave: 'vistoria', titulo: 'Vistoria de transferência', categoria: 'documento', responsavel: 'loja' },
        { chave: 'comunicacao_venda', titulo: 'Comunicar venda ao DETRAN', categoria: 'transferencia', responsavel: 'loja' },
        { chave: 'transferencia_concluida', titulo: 'Confirmar transferência de propriedade', categoria: 'transferencia', responsavel: 'comprador' },
      ]

      const esteira: Esteira = {
        id: novoId('est'),
        estagio: 'contrato',
        veiculo_nome: nome,
        veiculo_id: v.id,
        comprador_nome: input.comprador_nome,
        vendedor_nome: input.vendedor_nome,
        valor_venda: input.valor_venda,
        comissao_valor: comissao,
        comissao_paga: comissao != null ? false : null,
        itens: modelos.map((m, i) => ({
          id: novoId('item'),
          chave: m.chave,
          titulo: m.titulo,
          categoria: m.categoria,
          responsavel: m.responsavel,
          status: i === 0 ? 'em_andamento' : 'pendente',
          obrigatorio: true,
          prazo_em: new Date(Date.now() + (i + 2) * 86_400_000).toISOString(),
          vencido: false,
          concluido_em: null,
        })),
        aberta_em: agora,
        concluida_em: null,
      }
      db.esteiras.unshift(esteira)

      db.lancamentos.unshift({
        id: novoId('lan'),
        loja_id: LOJA_ID,
        tipo: 'receita',
        descricao: `Venda — ${nome}`,
        valor: input.valor_venda,
        data: agora,
        veiculo_nome: nome,
        status_pagamento: 'pendente',
        created_at: agora,
      })
      if (comissao && input.vendedor_nome) {
        db.lancamentos.unshift({
          id: novoId('lan'),
          loja_id: LOJA_ID,
          tipo: 'comissao',
          descricao: `Comissão — ${input.vendedor_nome} (${v.modelo})`,
          valor: comissao,
          data: agora,
          veiculo_nome: nome,
          status_pagamento: 'pendente',
          created_at: agora,
        })
      }

      // Pagamento composto (M058): veículo de troca entra no estoque como rascunho.
      if (input.valor_troca && input.valor_troca > 0 && input.troca_descricao?.trim()) {
        db.veiculos.unshift({
          id: novoId('vei'),
          loja_id: LOJA_ID,
          marca: input.troca_descricao.trim().split(' ')[0] || 'Troca',
          modelo: input.troca_descricao.trim().split(' ').slice(1).join(' ') || 'a avaliar',
          tipo: 'carro',
          ano_modelo: new Date().getFullYear(),
          preco_custo: input.valor_troca,
          preco_venda: undefined,
          status: 'inativo',
          publicado_marketplace: false,
          descricao: `Entrou como troca na venda de ${nome}. Avaliação/preparação pendente.`,
          created_at: agora,
          updated_at: agora,
          midias: [],
        })
      }
      return esteira
    })
  },

  // ── Custos de preparação (M058) ──────────────────────────
  async custos(idVeiculo: string): Promise<CustoVeiculo[]> {
    await delay(120, 260)
    const db = await getDb()
    return db.custos
      .filter((c) => c.veiculo_id === idVeiculo)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async adicionarCusto(idVeiculo: string, input: { categoria: CategoriaCusto; descricao: string; valor: number }): Promise<CustoVeiculo> {
    await delay(150, 300)
    return mutate((db) => {
      const agora = new Date().toISOString()
      const custo: CustoVeiculo = {
        id: novoId('custo'),
        veiculo_id: idVeiculo,
        categoria: input.categoria,
        descricao: input.descricao.trim(),
        valor: input.valor,
        created_at: agora,
      }
      db.custos.unshift(custo)
      // Custo de preparação vira despesa no Financeiro (paridade com o gestor).
      const v = db.veiculos.find((x) => x.id === idVeiculo)
      const nome = v ? `${v.marca} ${v.modelo}` : undefined
      db.lancamentos.unshift({
        id: novoId('lan'),
        loja_id: LOJA_ID,
        tipo: 'despesa',
        descricao: `Preparação — ${input.descricao.trim()}${nome ? ` (${nome})` : ''}`,
        valor: input.valor,
        data: agora,
        veiculo_nome: nome,
        status_pagamento: 'pago',
        created_at: agora,
      })
      return custo
    })
  },

  async removerCusto(idCusto: string): Promise<void> {
    await delay(120, 240)
    return mutate((db) => {
      db.custos = db.custos.filter((c) => c.id !== idCusto)
    })
  },
}
