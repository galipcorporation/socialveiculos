import { delay, getDb, mutate, novoId } from './db'
import { LOJA_ID } from './seed'
import type { Lancamento, ResumoFinanceiro, TipoLancamento } from './types'

export interface LancamentoInput {
  tipo: TipoLancamento
  descricao: string
  valor: number
  status_pagamento: 'pago' | 'pendente'
  veiculo_nome?: string
}

export interface PeriodoFinanceiro {
  mes: number | 'todos' // 0-11 ou 'todos'
  ano: number
}

function noPeriodo(dataIso: string, periodo?: PeriodoFinanceiro): boolean {
  if (!periodo) return true
  const d = new Date(dataIso)
  if (d.getFullYear() !== periodo.ano) return false
  if (periodo.mes !== 'todos' && d.getMonth() !== periodo.mes) return false
  return true
}

export const financeiroService = {
  async resumo(periodo?: PeriodoFinanceiro): Promise<ResumoFinanceiro> {
    await delay()
    const db = await getDb()
    const doPeriodo = db.lancamentos.filter((l) => noPeriodo(l.data, periodo))

    const soma = (tipo: TipoLancamento, apenasPagos = false) =>
      doPeriodo
        .filter((l) => l.tipo === tipo && (!apenasPagos || l.status_pagamento === 'pago'))
        .reduce((acc, l) => acc + l.valor, 0)

    const receitas = soma('receita')
    const despesas = soma('despesa')
    const comissoes = soma('comissao')
    const custoEstoque = db.veiculos
      .filter((v) => v.status === 'disponivel' || v.status === 'reservado')
      .reduce((acc, v) => acc + (v.preco_custo ?? 0), 0)
    const comissoesPendentes = db.lancamentos
      .filter((l) => l.tipo === 'comissao' && l.status_pagamento === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0)

    return {
      receitas,
      despesas,
      comissoes,
      saldo: receitas - despesas - comissoes,
      custo_estoque: custoEstoque,
      comissoes_pendentes: comissoesPendentes,
    }
  },

  async lancamentos(filtro?: TipoLancamento | 'todos', periodo?: PeriodoFinanceiro): Promise<Lancamento[]> {
    await delay()
    const db = await getDb()
    let lista = db.lancamentos.filter((l) => noPeriodo(l.data, periodo))
    if (filtro && filtro !== 'todos') lista = lista.filter((l) => l.tipo === filtro)
    return lista.sort((a, b) => b.data.localeCompare(a.data))
  },

  async excluir(idLancamento: string): Promise<void> {
    await delay(120, 260)
    return mutate((db) => {
      db.lancamentos = db.lancamentos.filter((l) => l.id !== idLancamento)
    })
  },

  async criar(input: LancamentoInput): Promise<Lancamento> {
    await delay()
    return mutate((db) => {
      const agora = new Date().toISOString()
      const novo: Lancamento = {
        id: novoId('lan'),
        loja_id: LOJA_ID,
        tipo: input.tipo,
        descricao: input.descricao,
        valor: input.valor,
        data: agora,
        veiculo_nome: input.veiculo_nome,
        status_pagamento: input.status_pagamento,
        created_at: agora,
      }
      db.lancamentos.unshift(novo)
      return novo
    })
  },

  async alternarPagamento(idLancamento: string): Promise<Lancamento> {
    await delay(120, 260)
    return mutate((db) => {
      const l = db.lancamentos.find((x) => x.id === idLancamento)
      if (!l) throw new Error('Lançamento não encontrado.')
      l.status_pagamento = l.status_pagamento === 'pago' ? 'pendente' : 'pago'
      return l
    })
  },
}
