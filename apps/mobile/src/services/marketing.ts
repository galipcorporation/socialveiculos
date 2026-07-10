// Marketing IA (M056/M065) — geração de legenda + publicar/agendar + histórico.
// MOCK: legenda por template determinístico (sem LLM). O app real chamaria o
// backend de Marketing (Claude opus-4-8, ver memória stack-ia-assistente-vs-marketing).

import { delay, novoId } from './db'
import type { Veiculo } from './types'
import { formatBRL, formatKm } from '../lib/format'

export type TomMarketing = 'entusiasmado' | 'sofisticado' | 'direto'
export type CanalMarketing = 'instagram' | 'facebook' | 'whatsapp' | 'olx'
export type StatusPost = 'publicado' | 'agendado' | 'falhou'

export const TONS_MARKETING: { value: TomMarketing; label: string }[] = [
  { value: 'entusiasmado', label: 'Entusiasmado' },
  { value: 'sofisticado', label: 'Sofisticado' },
  { value: 'direto', label: 'Direto ao ponto' },
]

export const CANAIS_MARKETING: { value: CanalMarketing; label: string; icon: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { value: 'olx', label: 'OLX', icon: 'pricetag' },
]

export interface PostMarketing {
  id: string
  canais: CanalMarketing[]
  legenda: string
  status: StatusPost
  agendado_para?: string
  erro?: string
  created_at: string
}

const EMOJIS = ['🚗', '🔥', '✨', '🏁', '💥', '🚀']

function hashtags(v: Veiculo, canal: CanalMarketing): string {
  if (canal === 'olx') return '' // OLX não usa hashtags
  const tags = [v.marca, v.modelo, 'seminovos', 'carros', 'autopremium']
    .map((t) => '#' + t.replace(/\s+/g, '').toLowerCase())
  return tags.join(' ')
}

let posts: PostMarketing[] = [
  { id: 'post-1', canais: ['instagram', 'facebook'], legenda: '🔥 Toyota Corolla Cross XRE — o SUV que todo mundo quer! #corollacross', status: 'publicado', created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: 'post-2', canais: ['whatsapp'], legenda: 'Honda Civic Touring por R$ 146.500. Chama pra fechar!', status: 'agendado', agendado_para: new Date(Date.now() + 86_400_000).toISOString(), created_at: new Date(Date.now() - 3600_000).toISOString() },
]

export const marketingService = {
  async gerarLegenda(v: Veiculo, tom: TomMarketing, canal: CanalMarketing, destaques = ''): Promise<string> {
    await delay(600, 1200)
    const nome = `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''}`
    const preco = v.preco_venda ? formatBRL(v.preco_venda) : 'preço sob consulta'
    const km = v.km != null ? formatKm(v.km) : null
    const detalhes = [v.ano_modelo, km, v.cor, v.cambio].filter(Boolean).join(' · ')
    const e = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    const extra = destaques.trim() ? `\n✅ ${destaques.trim()}` : ''

    let corpo: string
    if (canal === 'olx') {
      corpo = `${nome} ${v.ano_modelo}\n${detalhes}\nValor: ${preco}.${extra}\nAceito troca e financio. Agende sua visita.`
    } else if (tom === 'sofisticado') {
      corpo = `Apresentamos o ${nome}. Requinte, procedência e desempenho.\n\n${detalhes}${extra}\n\nValor: ${preco}. Agende sua avaliação.`
    } else if (tom === 'direto') {
      corpo = `${nome} ${e}\n${detalhes}${extra}\nPor ${preco}. Chama no WhatsApp que a gente fecha.`
    } else {
      corpo = `${e} CHEGOU: ${nome}! ${e}\n\n${detalhes}${extra}\n\n👉 ${preco} — condições especiais. Vem test drive!`
    }
    const tags = hashtags(v, canal)
    return tags ? `${corpo}\n\n${tags}` : corpo
  },

  async historico(): Promise<PostMarketing[]> {
    await delay()
    return [...posts].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async publicar(legenda: string, canais: CanalMarketing[]): Promise<PostMarketing> {
    await delay(400, 800)
    const post: PostMarketing = { id: novoId('post'), canais, legenda, status: 'publicado', created_at: new Date().toISOString() }
    posts = [post, ...posts]
    return post
  },

  async agendar(legenda: string, canais: CanalMarketing[], quando: string): Promise<PostMarketing> {
    await delay(400, 800)
    const post: PostMarketing = { id: novoId('post'), canais, legenda, status: 'agendado', agendado_para: quando, created_at: new Date().toISOString() }
    posts = [post, ...posts]
    return post
  },

  async cancelarAgendado(id: string): Promise<void> {
    await delay(150, 300)
    posts = posts.filter((p) => p.id !== id)
  },
}
