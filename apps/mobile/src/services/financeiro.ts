import { api } from '../lib/api'
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

interface LancamentoDTO {
  id: string
  loja_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  veiculo_nome?: string | null
  status_pagamento: string
  created_at: string
  deletado_em?: string | null
  deletado_por_nome?: string | null
  motivo_exclusao?: string | null
}
interface ResumoDTO {
  receitas: number
  despesas: number
  comissoes: number
  saldo: number
  custo_estoque: number
  comissoes_pendentes: number
}

function paramsPeriodo(periodo?: PeriodoFinanceiro): Record<string, string | number> {
  if (!periodo || periodo.mes === 'todos') return periodo ? { ano: periodo.ano } : {}
  // Backend usa mês 1-12; o app usa 0-11.
  return { mes: periodo.mes + 1, ano: periodo.ano }
}

function mapLancamento(l: LancamentoDTO): Lancamento {
  return {
    id: l.id,
    loja_id: l.loja_id,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    data: l.data,
    veiculo_nome: l.veiculo_nome ?? undefined,
    status_pagamento: l.status_pagamento === 'pago' ? 'pago' : 'pendente',
    created_at: l.created_at,
    deletado_em: l.deletado_em ?? undefined,
    deletado_por_nome: l.deletado_por_nome ?? undefined,
    motivo_exclusao: l.motivo_exclusao ?? undefined,
  }
}

export const financeiroService = {
  async resumo(periodo?: PeriodoFinanceiro): Promise<ResumoFinanceiro> {
    const r = await api.get<ResumoDTO>('/financeiro/resumo', paramsPeriodo(periodo))
    return {
      receitas: r.receitas ?? 0,
      despesas: r.despesas ?? 0,
      comissoes: r.comissoes ?? 0,
      saldo: r.saldo ?? 0,
      custo_estoque: r.custo_estoque ?? 0,
      comissoes_pendentes: r.comissoes_pendentes ?? 0,
    }
  },

  async lancamentos(filtro?: TipoLancamento | 'todos', periodo?: PeriodoFinanceiro): Promise<Lancamento[]> {
    const params = paramsPeriodo(periodo)
    if (filtro && filtro !== 'todos') params.tipo = filtro
    const data = await api.get<LancamentoDTO[] | { items: LancamentoDTO[] }>('/financeiro/lancamentos', params)
    const lista = Array.isArray(data) ? data : data.items ?? []
    return lista.map(mapLancamento).sort((a, b) => b.data.localeCompare(a.data))
  },

  /** Exclui (soft delete) um lançamento. O motivo é obrigatório (mín. 3 chars)
   *  e fica registrado na auditoria; o lançamento vai para a lixeira. */
  async excluir(idLancamento: string, motivo: string): Promise<void> {
    await api.delete(`/financeiro/lancamentos/${idLancamento}`, { motivo: motivo.trim() })
  },

  /** Lista os lançamentos excluídos (lixeira), para restauração. */
  async lixeira(): Promise<Lancamento[]> {
    const data = await api.get<LancamentoDTO[]>('/financeiro/lancamentos/lixeira')
    return (Array.isArray(data) ? data : []).map(mapLancamento)
  },

  /** Restaura um lançamento previamente excluído. */
  async restaurar(idLancamento: string): Promise<Lancamento> {
    const l = await api.post<LancamentoDTO>(`/financeiro/lancamentos/${idLancamento}/restaurar`, {})
    return mapLancamento(l)
  },

  async criar(input: LancamentoInput): Promise<Lancamento> {
    const l = await api.post<LancamentoDTO>('/financeiro/lancamentos', {
      tipo: input.tipo,
      descricao: input.descricao,
      valor: input.valor,
      status_pagamento: input.status_pagamento,
      veiculo_nome: input.veiculo_nome || null,
    })
    return mapLancamento(l)
  },

  async alternarPagamento(idLancamento: string): Promise<Lancamento> {
    // Lê o atual para inverter o status (o backend não expõe toggle direto).
    const atuais = await this.lancamentos()
    const atual = atuais.find((l) => l.id === idLancamento)
    const novo = atual?.status_pagamento === 'pago' ? 'pendente' : 'pago'
    const l = await api.patch<LancamentoDTO>(`/financeiro/lancamentos/${idLancamento}`, {
      status_pagamento: novo,
    })
    return mapLancamento(l)
  },
}
