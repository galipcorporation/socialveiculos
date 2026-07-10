// Rede Social / Repasses B2B — contra /v1/b2b (repasses, propostas, parceiros).
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import type { ComentarioRepasse, LojaParceira, PropostaRepasse, PublicacaoRepasse, StatusProposta } from './types'

interface VeiculoRefDTO {
  id?: string
  marca?: string | null
  modelo?: string | null
  versao?: string | null
  ano_modelo?: number | null
  km?: number | null
  midias?: { url: string }[]
}
interface ComentarioDTO {
  id: string
  publicacao_id: string
  autor_nome?: string | null
  conteudo: string
  created_at: string
}
interface PublicacaoDTO {
  id: string
  loja_id: string
  loja_nome?: string | null
  veiculo_id?: string | null
  veiculo?: VeiculoRefDTO | null
  autor_nome?: string | null
  conteudo?: string | null
  valor_repasse?: number | null
  comentarios?: ComentarioDTO[]
  curtidas?: unknown[]
  curtido_por_mim?: boolean
  created_at: string
}
interface PropostaDTO {
  id: string
  loja_proponente_id: string
  loja_proponente_nome?: string | null
  loja_destino_id: string
  loja_destino_nome?: string | null
  veiculo?: VeiculoRefDTO | null
  valor_proposta: number
  status: StatusProposta
  observacoes?: string | null
  created_at: string
}
interface LojaDTO {
  id: string
  nome: string
  cidade?: string | null
  estado?: string | null
  telefone?: string | null
  whatsapp?: string | null
  verificada?: boolean
  total_veiculos?: number
  seguindo?: boolean
  conversa_id?: string | null
}

function nomeVeiculo(v?: VeiculoRefDTO | null): string {
  if (!v) return 'Veículo'
  return [v.marca, v.modelo, v.versao].filter(Boolean).join(' ') || 'Veículo'
}

function mapPublicacao(p: PublicacaoDTO): PublicacaoRepasse {
  return {
    id: p.id,
    loja_id: p.loja_id,
    loja_nome: p.loja_nome ?? 'Loja',
    autor_nome: p.autor_nome ?? p.loja_nome ?? 'Loja',
    veiculo_id: p.veiculo_id ?? p.veiculo?.id ?? undefined,
    veiculo_nome: nomeVeiculo(p.veiculo),
    veiculo_ano: p.veiculo?.ano_modelo ?? undefined,
    veiculo_km: p.veiculo?.km ?? undefined,
    foto_url: p.veiculo?.midias?.[0]?.url,
    conteudo: p.conteudo ?? undefined,
    valor_repasse: p.valor_repasse ?? undefined,
    curtidas: p.curtidas?.length ?? 0,
    comentarios: p.comentarios?.length ?? 0,
    curtido_por_mim: p.curtido_por_mim ?? false,
    created_at: p.created_at,
  }
}

function mapComentario(c: ComentarioDTO): ComentarioRepasse {
  return {
    id: c.id,
    publicacao_id: c.publicacao_id,
    autor_nome: c.autor_nome ?? 'Loja',
    texto: c.conteudo,
    created_at: c.created_at,
  }
}

function mapProposta(p: PropostaDTO, minhaLojaId?: string): PropostaRepasse {
  const enviada = p.loja_proponente_id === minhaLojaId
  return {
    id: p.id,
    direcao: enviada ? 'enviada' : 'recebida',
    loja_parceira_nome: (enviada ? p.loja_destino_nome : p.loja_proponente_nome) ?? 'Parceiro',
    veiculo_nome: nomeVeiculo(p.veiculo),
    valor_proposta: p.valor_proposta,
    status: p.status,
    observacoes: p.observacoes ?? undefined,
    created_at: p.created_at,
  }
}

function mapLoja(l: LojaDTO): LojaParceira {
  return {
    id: l.id,
    nome: l.nome,
    cidade: l.cidade ?? undefined,
    estado: l.estado ?? undefined,
    telefone: l.telefone ?? undefined,
    whatsapp: l.whatsapp ?? undefined,
    verificada: l.verificada ?? false,
    total_veiculos: l.total_veiculos ?? 0,
    seguindo: l.seguindo ?? false,
    conversa_id: l.conversa_id ?? undefined,
  }
}

export const repassesService = {
  async feed(): Promise<PublicacaoRepasse[]> {
    const data = await api.get<PublicacaoDTO[]>('/b2b/repasses')
    return data.map(mapPublicacao).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async curtir(id: string): Promise<void> {
    await api.post(`/b2b/repasses/${id}/curtir`)
  },

  async propostas(): Promise<PropostaRepasse[]> {
    const minhaLojaId = useAuthStore.getState().user?.loja_id ?? undefined
    const [recebidas, enviadas] = await Promise.all([
      api.get<PropostaDTO[]>('/b2b/propostas/recebidas').catch(() => []),
      api.get<PropostaDTO[]>('/b2b/propostas/enviadas').catch(() => []),
    ])
    return [...recebidas, ...enviadas]
      .map((p) => mapProposta(p, minhaLojaId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async responderProposta(id: string, aceitar: boolean): Promise<void> {
    await api.patch(`/b2b/propostas/${id}/status`, { status: aceitar ? 'aceita' : 'rejeitada' })
  },

  async cancelarProposta(id: string): Promise<void> {
    await api.patch(`/b2b/propostas/${id}/status`, { status: 'cancelada' })
  },

  async criarProposta(input: { veiculo_id: string; valor: number; observacoes?: string }): Promise<PropostaRepasse> {
    const minhaLojaId = useAuthStore.getState().user?.loja_id ?? undefined
    const p = await api.post<PropostaDTO>('/b2b/propostas', {
      veiculo_id: input.veiculo_id,
      valor_proposta: input.valor,
      observacoes: input.observacoes || null,
    })
    return mapProposta(p, minhaLojaId)
  },

  async parceiros(busca = '', apenasFavoritos = false): Promise<LojaParceira[]> {
    const params: Record<string, string> = {}
    if (busca.trim()) params.q = busca.trim()
    const data = await api.get<LojaDTO[]>('/b2b/parceiros', params)
    let lista = data.map(mapLoja)
    if (apenasFavoritos) lista = lista.filter((p) => p.seguindo)
    return lista
  },

  async favoritarParceiro(id: string): Promise<boolean> {
    const r = await api.post<{ seguindo: boolean }>(`/b2b/parceiros/${id}/seguir`).catch(() => ({ seguindo: false }))
    return r.seguindo
  },

  async comentarios(publicacaoId: string): Promise<ComentarioRepasse[]> {
    const feed = await api.get<PublicacaoDTO[]>('/b2b/repasses')
    const pub = feed.find((p) => p.id === publicacaoId)
    return (pub?.comentarios ?? []).map(mapComentario).sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async comentar(publicacaoId: string, texto: string): Promise<ComentarioRepasse> {
    const c = await api.post<ComentarioDTO>(`/b2b/repasses/${publicacaoId}/comentarios`, {
      conteudo: texto.trim(),
    })
    return mapComentario(c)
  },
}
