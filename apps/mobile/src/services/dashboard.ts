import { api } from '../lib/api'
import type { DashboardKpis, Notificacao } from './types'

interface KpisDTO {
  escopo?: string
  estoque_ativo: number
  leads_ativos: number
  vendas_mes: number
  receita_mes?: number | null
  veiculos_publicados: number
  minhas_comissoes_pendentes?: number | null
  minhas_comissoes_pagas_mes?: number | null
  vendas_por_mes?: { mes: string; total: number }[]
}
interface NotificacaoDTO {
  id: string
  titulo: string
  conteudo?: string | null
  mensagem?: string | null
  lida: boolean
  created_at: string
}

export const dashboardService = {
  async kpis(escopo: 'loja' | 'vendedor'): Promise<DashboardKpis> {
    const k = await api.get<KpisDTO>('/dashboard/kpis')
    return {
      escopo: (k.escopo as 'loja' | 'vendedor') ?? escopo,
      estoque_ativo: k.estoque_ativo,
      leads_ativos: k.leads_ativos,
      vendas_mes: k.vendas_mes,
      receita_mes: k.receita_mes ?? null,
      veiculos_publicados: k.veiculos_publicados,
      minhas_comissoes_pendentes: k.minhas_comissoes_pendentes ?? null,
      minhas_comissoes_pagas_mes: k.minhas_comissoes_pagas_mes ?? null,
      vendas_por_mes: k.vendas_por_mes ?? [],
    }
  },

  async notificacoes(): Promise<Notificacao[]> {
    const data = await api.get<NotificacaoDTO[]>('/notificacoes')
    return data
      .filter((n) => !n.lida)
      .map((n) => ({
        id: n.id,
        titulo: n.titulo,
        conteudo: n.conteudo ?? n.mensagem ?? '',
        lida: n.lida,
        created_at: n.created_at,
      }))
  },

  async marcarLida(idNotificacao: string): Promise<void> {
    await api.post(`/notificacoes/${idNotificacao}/ler`)
  },
}
