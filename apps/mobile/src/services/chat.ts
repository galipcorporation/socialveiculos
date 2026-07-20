import { api } from '../lib/api'
import type { Conversa, Mensagem } from './types'

// O chat do gestor combina dois domínios do backend:
//  - cliente  → conversas B2C recebidas pela loja  (/vitrine/chat/conversas)
//  - parceiro → conversas B2B loja↔loja            (/b2b/chat/conversas)
// Guardamos o tipo de cada conversa em memória para rotear mensagens/envio.

interface ConversaB2CDTO {
  id: string
  loja_id?: string | null
  cliente_nome?: string | null
  veiculo_marca?: string | null
  veiculo_modelo?: string | null
  ultima_mensagem?: string | null
  ultima_mensagem_data?: string | null
  mensagens_nao_lidas?: number
}
interface ConversaB2BDTO {
  id: string
  loja_a_nome?: string | null
  loja_b_nome?: string | null
  ultima_mensagem?: string | null
  ultima_mensagem_data?: string | null
  mensagens_nao_lidas?: number
}
interface MensagemDTO {
  id: string
  conversa_id: string
  autor_id?: string | null
  autor_nome?: string | null
  // B2C (/vitrine/chat) informa quem é o autor de fato; B2B (/b2b/chat) informa
  // apenas se a mensagem é minha (não há "loja"/"cliente" entre lojas parceiras).
  autor_tipo?: 'loja' | 'cliente'
  minha?: boolean
  conteudo: string
  lida: boolean
  created_at: string
}

const tipoPorConversa = new Map<string, 'cliente' | 'parceiro'>()

function basePath(conversaId: string): string {
  return tipoPorConversa.get(conversaId) === 'parceiro'
    ? `/b2b/chat/conversas/${conversaId}`
    : `/vitrine/chat/conversas/${conversaId}`
}

function mapMensagem(m: MensagemDTO): Mensagem {
  // No painel da loja, "minha" (do lado direito) é sempre a própria loja —
  // tanto no B2C (autor_tipo já vem calculado pelo backend) quanto no B2B
  // (minha === true quando o autor é o usuário logado).
  const autor: 'loja' | 'cliente' = m.autor_tipo ?? (m.minha ? 'loja' : 'cliente')
  return {
    id: m.id,
    conversa_id: m.conversa_id,
    autor,
    texto: m.conteudo,
    created_at: m.created_at,
    lida: m.lida,
  }
}

function mapConversaB2C(c: ConversaB2CDTO): Conversa {
  const veiculo = [c.veiculo_marca, c.veiculo_modelo].filter(Boolean).join(' ') || undefined
  return {
    id: c.id,
    tipo: 'cliente',
    cliente_nome: c.cliente_nome ?? 'Cliente',
    veiculo_interesse: veiculo,
    canal: 'chat',
    ultima_mensagem: c.ultima_mensagem ?? '',
    ultima_mensagem_em: c.ultima_mensagem_data ?? new Date(0).toISOString(),
    nao_lidas: c.mensagens_nao_lidas ?? 0,
  }
}

function mapConversaB2B(c: ConversaB2BDTO, lojaPropriaNome?: string): Conversa {
  // O nome do parceiro é a "outra" loja da dupla.
  const parceira =
    c.loja_a_nome && c.loja_a_nome !== lojaPropriaNome ? c.loja_a_nome : c.loja_b_nome
  return {
    id: c.id,
    tipo: 'parceiro',
    cliente_nome: parceira ?? 'Parceiro',
    loja_parceira_nome: parceira ?? undefined,
    canal: 'chat',
    ultima_mensagem: c.ultima_mensagem ?? '',
    ultima_mensagem_em: c.ultima_mensagem_data ?? new Date(0).toISOString(),
    nao_lidas: c.mensagens_nao_lidas ?? 0,
  }
}

export const chatService = {
  async conversas(): Promise<Conversa[]> {
    const [b2c, b2b] = await Promise.all([
      api.get<ConversaB2CDTO[]>('/vitrine/chat/conversas').catch(() => []),
      api.get<ConversaB2BDTO[]>('/b2b/chat/conversas').catch(() => []),
    ])
    const lista = [
      ...b2c.map(mapConversaB2C),
      ...b2b.map((c) => mapConversaB2B(c)),
    ]
    tipoPorConversa.clear()
    for (const c of lista) tipoPorConversa.set(c.id, c.tipo)
    return lista.sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
  },

  async mensagens(conversaId: string): Promise<Mensagem[]> {
    const data = await api.get<MensagemDTO[]>(`${basePath(conversaId)}/mensagens`)
    return data.map(mapMensagem).sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async marcarLidas(_conversaId: string): Promise<void> {
    // A leitura é registrada pelo backend ao listar as mensagens.
    return
  },

  async enviar(conversaId: string, texto: string): Promise<Mensagem> {
    const m = await api.post<MensagemDTO>(`${basePath(conversaId)}/mensagens`, { conteudo: texto })
    return mapMensagem(m)
  },

  async totalNaoLidas(): Promise<number> {
    // Tenta endpoint leve que retorna só a contagem (sem carregar todas as conversas).
    // Se o backend ainda não tiver, faz fallback carregando a lista completa.
    try {
      const r = await api.get<{ total: number }>('/chat/nao-lidas')
      return r.total
    } catch {
      const lista = await this.conversas()
      return lista.reduce((acc, c) => acc + c.nao_lidas, 0)
    }
  },

  async naoLidasPorTipo(): Promise<{ cliente: number; parceiro: number }> {
    const lista = await this.conversas()
    return lista.reduce(
      (acc, c) => {
        acc[c.tipo] += c.nao_lidas
        return acc
      },
      { cliente: 0, parceiro: 0 },
    )
  },

  /** Abre (ou reaproveita) uma conversa B2B com uma loja parceira. */
  async abrirConversaParceiro(outraLojaId: string): Promise<string> {
    const conv = await api.post<{ id: string }>('/b2b/chat/conversas', { outra_loja_id: outraLojaId })
    tipoPorConversa.set(conv.id, 'parceiro')
    return conv.id
  },
}
