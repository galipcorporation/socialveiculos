import { delay, getDb, mutate } from './db'
import type { DashboardKpis, Notificacao } from './types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const dashboardService = {
  async kpis(escopo: 'loja' | 'vendedor'): Promise<DashboardKpis> {
    await delay()
    const db = await getDb()

    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const estoqueAtivo = db.veiculos.filter(
      (v) => v.status === 'disponivel' || v.status === 'reservado'
    ).length
    const publicados = db.veiculos.filter((v) => v.publicado_marketplace).length
    const leadsAtivos = db.leads.filter((l) => l.etapa !== 'perdido' && l.etapa !== 'fechamento').length

    const esteirasMes = db.esteiras.filter((e) => new Date(e.aberta_em) >= inicioMes)
    const minhas = db.esteiras.filter((e) => e.vendedor_nome === 'Você')
    const minhasMes = minhas.filter((e) => new Date(e.aberta_em) >= inicioMes)

    const receitaMes = db.lancamentos
      .filter((l) => l.tipo === 'receita' && new Date(l.data) >= inicioMes)
      .reduce((acc, l) => acc + l.valor, 0)

    const comissoesPendentes = minhas
      .filter((e) => e.comissao_paga === false)
      .reduce((acc, e) => acc + (e.comissao_valor ?? 0), 0)
    const comissoesPagasMes = minhasMes
      .filter((e) => e.comissao_paga === true)
      .reduce((acc, e) => acc + (e.comissao_valor ?? 0), 0)

    // Série de 6 meses: meses anteriores estáveis (demo) + mês corrente real.
    const vendasMesAtual = escopo === 'vendedor' ? minhasMes.length : esteirasMes.length
    const base = escopo === 'vendedor' ? [1, 2, 1, 3, 2] : [3, 5, 4, 6, 5]
    const agora = new Date()
    const vendasPorMes = [...base, vendasMesAtual].map((total, i) => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1)
      return { mes: MESES[d.getMonth()], total }
    })

    return {
      escopo,
      estoque_ativo: estoqueAtivo,
      leads_ativos: leadsAtivos,
      vendas_mes: vendasMesAtual,
      receita_mes: escopo === 'vendedor' ? null : receitaMes,
      veiculos_publicados: publicados,
      minhas_comissoes_pendentes: escopo === 'vendedor' ? comissoesPendentes : null,
      minhas_comissoes_pagas_mes: escopo === 'vendedor' ? comissoesPagasMes : null,
      vendas_por_mes: vendasPorMes,
    }
  },

  async notificacoes(): Promise<Notificacao[]> {
    await delay(120, 260)
    const db = await getDb()
    return db.notificacoes.filter((n) => !n.lida)
  },

  async marcarLida(idNotificacao: string): Promise<void> {
    return mutate((db) => {
      const n = db.notificacoes.find((x) => x.id === idNotificacao)
      if (n) n.lida = true
    })
  },
}
