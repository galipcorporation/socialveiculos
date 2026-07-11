// Marketing IA — geração de legenda + publicar/agendar + histórico contra
// /v1/marketing. A geração real usa o backend de IA (ver stack-ia-assistente-vs-marketing).
import { api } from '../lib/api'
import type { Veiculo } from './types'

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

interface GerarPostDTO {
  texto: string
  hashtags?: string[]
}
interface PostDTO {
  id: string
  redes?: string[]
  canais?: string[]
  texto?: string
  legenda?: string
  status: string
  publicar_em?: string | null
  agendado_para?: string | null
  erro?: string | null
  created_at: string
}

function mapPost(p: PostDTO): PostMarketing {
  const canais = (p.redes ?? p.canais ?? []) as CanalMarketing[]
  const status: StatusPost =
    p.status === 'agendado' ? 'agendado' : p.status === 'falhou' ? 'falhou' : 'publicado'
  return {
    id: p.id,
    canais,
    legenda: p.texto ?? p.legenda ?? '',
    status,
    agendado_para: p.publicar_em ?? p.agendado_para ?? undefined,
    erro: p.erro ?? undefined,
    created_at: p.created_at,
  }
}

export const marketingService = {
  async gerarLegenda(v: Veiculo, tom: TomMarketing, canal: CanalMarketing, destaques = ''): Promise<string> {
    const res = await api.post<GerarPostDTO>('/marketing/gerar-post', {
      veiculo_id: v.id,
      rede: canal,
      tom,
      destaques: destaques.trim() || undefined,
    })
    const tags = res.hashtags?.length ? '\n\n' + res.hashtags.map((h) => `#${h}`).join(' ') : ''
    return `${res.texto}${tags}`
  },

  async historico(): Promise<PostMarketing[]> {
    const data = await api.get<PostDTO[]>('/marketing/historico')
    return data.map(mapPost).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async publicar(legenda: string, canais: CanalMarketing[]): Promise<PostMarketing> {
    const res = await api.post<{ resultados: { rede: string; sucesso: boolean; erro?: string }[] }>(
      '/marketing/publicar',
      { texto: legenda, hashtags: [], redes: canais },
    )
    const falhas = res.resultados.filter((r) => !r.sucesso)
    if (falhas.length > 0) {
      throw new Error(falhas.map((f) => `${f.rede}: ${f.erro ?? 'falha ao publicar'}`).join(' · '))
    }
    return {
      id: `local-${Date.now()}`,
      canais,
      legenda,
      status: 'publicado',
      created_at: new Date().toISOString(),
    }
  },

  async agendar(legenda: string, canais: CanalMarketing[], quando: string): Promise<PostMarketing> {
    const p = await api.post<PostDTO>('/marketing/agendar', {
      texto: legenda,
      hashtags: [],
      redes: canais,
      publicar_em: quando,
    })
    return mapPost(p)
  },

  async cancelarAgendado(id: string): Promise<void> {
    await api.delete(`/marketing/posts/${id}`)
  },
}
