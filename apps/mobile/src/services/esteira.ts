import { delay, getDb, mutate } from './db'
import type { CategoriaItemEsteira, EstagioEsteira, Esteira, MinhaVenda } from './types'

// Ordem das categorias define a progressão do estágio.
const ORDEM_CATEGORIA: CategoriaItemEsteira[] = ['contrato', 'financeiro', 'documento', 'transferencia']
const CATEGORIA_PARA_ESTAGIO: Record<CategoriaItemEsteira, Exclude<EstagioEsteira, 'concluido'>> = {
  contrato: 'contrato',
  financeiro: 'pagamento',
  documento: 'documentos',
  transferencia: 'transferencia',
}

function recalcularEstagio(esteira: Esteira) {
  for (const cat of ORDEM_CATEGORIA) {
    const pendentes = esteira.itens.filter(
      (i) => i.categoria === cat && i.status !== 'concluido' && i.status !== 'nao_aplicavel'
    )
    if (pendentes.length > 0) {
      esteira.estagio = CATEGORIA_PARA_ESTAGIO[cat]
      esteira.concluida_em = null
      return
    }
  }
  esteira.estagio = 'concluido'
  esteira.concluida_em = esteira.concluida_em ?? new Date().toISOString()
}

export const esteiraService = {
  async listar(): Promise<Esteira[]> {
    await delay()
    const db = await getDb()
    return [...db.esteiras].sort((a, b) => {
      const aFim = a.estagio === 'concluido' ? 1 : 0
      const bFim = b.estagio === 'concluido' ? 1 : 0
      return aFim - bFim || b.aberta_em.localeCompare(a.aberta_em)
    })
  },

  async obter(idEsteira: string): Promise<Esteira> {
    await delay(120, 260)
    const db = await getDb()
    const e = db.esteiras.find((x) => x.id === idEsteira)
    if (!e) throw new Error('Venda não encontrada.')
    return e
  },

  async alternarItem(idEsteira: string, idItem: string): Promise<Esteira> {
    await delay(120, 260)
    return mutate((db) => {
      const e = db.esteiras.find((x) => x.id === idEsteira)
      if (!e) throw new Error('Venda não encontrada.')
      const item = e.itens.find((i) => i.id === idItem)
      if (!item) throw new Error('Item não encontrado.')
      if (item.status === 'concluido') {
        item.status = 'pendente'
        item.concluido_em = null
      } else {
        item.status = 'concluido'
        item.concluido_em = new Date().toISOString()
        item.vencido = false
      }
      recalcularEstagio(e)
      return e
    })
  },

  async marcarComissaoPaga(idEsteira: string): Promise<Esteira> {
    await delay(150, 300)
    return mutate((db) => {
      const e = db.esteiras.find((x) => x.id === idEsteira)
      if (!e) throw new Error('Venda não encontrada.')
      e.comissao_paga = true
      const lanc = db.lancamentos.find(
        (l) => l.tipo === 'comissao' && l.veiculo_nome && e.veiculo_nome.includes(l.veiculo_nome)
      )
      if (lanc) lanc.status_pagamento = 'pago'
      return e
    })
  },
}

export const comissoesService = {
  /** Vendas do usuário logado (no mock, vendedor_nome === 'Você'). */
  async minhasVendas(): Promise<MinhaVenda[]> {
    await delay()
    const db = await getDb()
    return db.esteiras
      .filter((e) => e.vendedor_nome === 'Você')
      .map((e) => ({
        esteira_id: e.id,
        veiculo_nome: e.veiculo_nome,
        valor_venda: e.valor_venda,
        comissao_valor: e.comissao_valor,
        comissao_paga: e.comissao_paga,
        estagio: e.estagio,
        aberta_em: e.aberta_em,
      }))
      .sort((a, b) => b.aberta_em.localeCompare(a.aberta_em))
  },
}
