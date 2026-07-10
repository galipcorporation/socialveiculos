import { delay, getDb, mutate, novoId } from './db'
import type { Conversa, Mensagem } from './types'

export const chatService = {
  async conversas(): Promise<Conversa[]> {
    await delay()
    const db = await getDb()
    return [...db.conversas].sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
  },

  async mensagens(conversaId: string): Promise<Mensagem[]> {
    await delay(120, 260)
    const db = await getDb()
    return db.mensagens
      .filter((m) => m.conversa_id === conversaId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async marcarLidas(conversaId: string): Promise<void> {
    return mutate((db) => {
      const conversa = db.conversas.find((c) => c.id === conversaId)
      if (conversa) conversa.nao_lidas = 0
      db.mensagens.forEach((m) => {
        if (m.conversa_id === conversaId) m.lida = true
      })
    })
  },

  async enviar(conversaId: string, texto: string): Promise<Mensagem> {
    await delay(100, 220)
    return mutate((db) => {
      const agora = new Date().toISOString()
      const msg: Mensagem = {
        id: novoId('msg'),
        conversa_id: conversaId,
        autor: 'loja',
        texto,
        created_at: agora,
        lida: true,
      }
      db.mensagens.push(msg)
      const conversa = db.conversas.find((c) => c.id === conversaId)
      if (conversa) {
        conversa.ultima_mensagem = texto
        conversa.ultima_mensagem_em = agora
      }
      return msg
    })
  },

  async totalNaoLidas(): Promise<number> {
    const db = await getDb()
    return db.conversas.reduce((acc, c) => acc + c.nao_lidas, 0)
  },

  /** Não lidas por tipo — para os badges das abas Clientes / Parceiros (M049). */
  async naoLidasPorTipo(): Promise<{ cliente: number; parceiro: number }> {
    const db = await getDb()
    return db.conversas.reduce(
      (acc, c) => {
        acc[c.tipo] += c.nao_lidas
        return acc
      },
      { cliente: 0, parceiro: 0 },
    )
  },

  /** Abre (ou reaproveita) uma conversa B2B com uma loja parceira (M063). */
  async abrirConversaParceiro(lojaNome: string, contatoNome: string, veiculoInteresse?: string): Promise<string> {
    return mutate((db) => {
      let conv = db.conversas.find((c) => c.tipo === 'parceiro' && c.loja_parceira_nome === lojaNome)
      if (!conv) {
        const agora = new Date().toISOString()
        conv = {
          id: novoId('conv'),
          tipo: 'parceiro',
          cliente_nome: contatoNome,
          loja_parceira_nome: lojaNome,
          veiculo_interesse: veiculoInteresse,
          canal: 'chat',
          ultima_mensagem: 'Conversa iniciada',
          ultima_mensagem_em: agora,
          nao_lidas: 0,
        }
        db.conversas.unshift(conv)
      }
      return conv.id
    })
  },
}
