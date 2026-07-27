// Integrador de anúncios em portais (M079) — contra /v1/anuncios.
// No celular o módulo serve a duas coisas: decidir o que publica/retira e
// resolver a baixa manual depois da venda. Configuração fica no gestor web.
import { api } from '../lib/api'

export type StatusAnuncio =
  | 'nao_publicado'
  | 'sincronizando'
  | 'publicado'
  | 'erro'
  | 'despublicado'
  | 'baixa_pendente'

export interface Portal {
  nome: string
  rotulo: string
  disponivel: boolean
  requer_parceria: boolean
  tipo_auth: string
  conectado: boolean
  motivo?: string | null
}

export interface CelulaAnuncio {
  id?: string | null
  portal: string
  status: StatusAnuncio
  url_externa?: string | null
  erro?: string | null
  publicado_em?: string | null
}

export interface LinhaAnuncio {
  veiculo_id: string
  titulo: string
  placa?: string | null
  preco_venda?: number | null
  foto?: string | null
  vendido: boolean
  celulas: CelulaAnuncio[]
}

export interface GradeAnuncios {
  total: number
  itens: LinhaAnuncio[]
}

export interface PendenciaBaixa {
  id: string
  veiculo_id: string
  titulo: string
  portal: string
  rotulo_portal: string
  erro?: string | null
}

export interface ResultadoAcao {
  enfileirados: number
  ignorados?: string[]
}

export interface FiltroGrade {
  status?: StatusAnuncio | ''
  portal?: string
  busca?: string
  limit?: number
  offset?: number
}

export const anunciosService = {
  async portais(): Promise<Portal[]> {
    return api.get<Portal[]>('/anuncios/portais')
  },

  async grade(filtro: FiltroGrade = {}): Promise<GradeAnuncios> {
    const params: Record<string, string> = {
      limit: String(filtro.limit ?? 20),
      offset: String(filtro.offset ?? 0),
    }
    if (filtro.status) params.status = filtro.status
    if (filtro.portal) params.portal = filtro.portal
    if (filtro.busca?.trim()) params.busca = filtro.busca.trim()
    return api.get<GradeAnuncios>('/anuncios/grade', params)
  },

  async publicar(veiculoIds: string[], portais: string[]): Promise<ResultadoAcao> {
    return api.post<ResultadoAcao>('/anuncios/publicar', {
      veiculo_ids: veiculoIds,
      portais,
    })
  },

  async despublicar(veiculoIds: string[], portais: string[]): Promise<ResultadoAcao> {
    return api.post<ResultadoAcao>('/anuncios/despublicar', {
      veiculo_ids: veiculoIds,
      portais,
    })
  },

  async pendencias(): Promise<PendenciaBaixa[]> {
    return api.get<PendenciaBaixa[]>('/anuncios/pendencias')
  },

  /** "Já removi" — declaração do usuário; o backend grava quem e quando. */
  async confirmarBaixa(anuncioId: string): Promise<void> {
    await api.post(`/anuncios/${anuncioId}/confirmar-baixa`)
  },
}
