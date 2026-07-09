// Rede Social / Repasses B2B (M055) — mock. Espelha /repasses, /propostas e o
// diretório de parceiros do gestor (RedeSocial.tsx). Liga com o chat B2B (M049).

import { delay, novoId } from './db'
import type { LojaParceira, PropostaRepasse, PublicacaoRepasse } from './types'

const now = Date.now()
const minAtras = (m: number) => new Date(now - m * 60_000).toISOString()

let feed: PublicacaoRepasse[] = [
  { id: 'rep-001', loja_nome: 'Garagem RS Motors', autor_nome: 'Fábio', veiculo_nome: 'VW Nivus Highline 1.0 TSI', veiculo_ano: 2022, veiculo_km: 31200, conteudo: 'Repasse para lojistas — único dono, revisões em dia. Aceito troca.', valor_repasse: 97000, curtidas: 5, comentarios: 2, curtido_por_mim: false, created_at: minAtras(180) },
  { id: 'rep-002', loja_nome: 'AutoCenter Canoas', autor_nome: 'Renata', veiculo_nome: 'Fiat Mobi Like 1.0', veiculo_ano: 2022, veiculo_km: 28700, conteudo: 'Saindo por repasse, ótimo para entrada de estoque.', valor_repasse: 46500, curtidas: 3, comentarios: 0, curtido_por_mim: true, created_at: minAtras(1400) },
  { id: 'rep-003', loja_nome: 'Premium Motors Gravataí', autor_nome: 'Jonas', veiculo_nome: 'Chevrolet Tracker Premier 1.2 Turbo', veiculo_ano: 2023, veiculo_km: 16500, conteudo: 'Disponível para repasse entre parceiros. Laudo aprovado.', valor_repasse: 118000, curtidas: 8, comentarios: 4, curtido_por_mim: false, created_at: minAtras(300) },
  { id: 'rep-004', loja_nome: 'Sul Veículos', autor_nome: 'Marcelo', veiculo_nome: 'Renault Kwid Zen 1.0', veiculo_ano: 2023, veiculo_km: 12400, valor_repasse: 52000, curtidas: 2, comentarios: 1, curtido_por_mim: false, created_at: minAtras(2600) },
]

let propostas: PropostaRepasse[] = [
  { id: 'prop-001', direcao: 'enviada', loja_parceira_nome: 'Garagem RS Motors', veiculo_nome: 'VW Nivus Highline', valor_proposta: 95000, status: 'pendente', observacoes: 'Consigo buscar em POA na sexta.', created_at: minAtras(120) },
  { id: 'prop-002', direcao: 'recebida', loja_parceira_nome: 'Premium Motors Gravataí', veiculo_nome: 'Toyota Hilux SRX (do meu estoque)', valor_proposta: 225000, status: 'pendente', observacoes: 'Tenho cliente fechado, pago à vista.', created_at: minAtras(90) },
  { id: 'prop-003', direcao: 'enviada', loja_parceira_nome: 'AutoCenter Canoas', veiculo_nome: 'Fiat Mobi Like', valor_proposta: 46000, status: 'aceita', created_at: minAtras(1380) },
  { id: 'prop-004', direcao: 'recebida', loja_parceira_nome: 'Sul Veículos', veiculo_nome: 'Chevrolet Onix Premier (do meu estoque)', valor_proposta: 78000, status: 'rejeitada', observacoes: 'Valor abaixo do repasse.', created_at: minAtras(4000) },
]

const parceiros: LojaParceira[] = [
  { id: 'loja-p1', nome: 'Garagem RS Motors', cidade: 'Porto Alegre', estado: 'RS', telefone: '5133001020', whatsapp: '51999110022', verificada: true, total_veiculos: 34, conversa_id: undefined },
  { id: 'loja-p2', nome: 'AutoCenter Canoas', cidade: 'Canoas', estado: 'RS', telefone: '5134002030', whatsapp: '51998220033', verificada: true, total_veiculos: 21, conversa_id: undefined },
  { id: 'loja-p3', nome: 'Premium Motors Gravataí', cidade: 'Gravataí', estado: 'RS', telefone: '5134003040', whatsapp: '51997330044', verificada: false, total_veiculos: 18, conversa_id: undefined },
  { id: 'loja-p4', nome: 'Sul Veículos', cidade: 'São Leopoldo', estado: 'RS', telefone: '5135004050', whatsapp: '51996440055', verificada: true, total_veiculos: 27, conversa_id: undefined },
]

export const repassesService = {
  async feed(): Promise<PublicacaoRepasse[]> {
    await delay()
    return [...feed].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async curtir(id: string): Promise<void> {
    await delay(80, 180)
    feed = feed.map((p) =>
      p.id === id
        ? { ...p, curtido_por_mim: !p.curtido_por_mim, curtidas: p.curtidas + (p.curtido_por_mim ? -1 : 1) }
        : p,
    )
  },

  async propostas(): Promise<PropostaRepasse[]> {
    await delay()
    return [...propostas].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async responderProposta(id: string, aceitar: boolean): Promise<void> {
    await delay(200, 400)
    propostas = propostas.map((p) =>
      p.id === id ? { ...p, status: aceitar ? 'aceita' : 'rejeitada' } : p,
    )
  },

  async cancelarProposta(id: string): Promise<void> {
    await delay(200, 400)
    propostas = propostas.map((p) => (p.id === id ? { ...p, status: 'cancelada' } : p))
  },

  // Cria uma proposta a partir de uma publicação do feed.
  async criarProposta(input: { loja_nome: string; veiculo_nome: string; valor: number; observacoes?: string }): Promise<PropostaRepasse> {
    await delay(200, 400)
    const nova: PropostaRepasse = {
      id: novoId('prop'),
      direcao: 'enviada',
      loja_parceira_nome: input.loja_nome,
      veiculo_nome: input.veiculo_nome,
      valor_proposta: input.valor,
      status: 'pendente',
      observacoes: input.observacoes,
      created_at: new Date().toISOString(),
    }
    propostas = [nova, ...propostas]
    return nova
  },

  async parceiros(): Promise<LojaParceira[]> {
    await delay()
    return parceiros
  },
}
