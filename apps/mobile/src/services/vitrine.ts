// Vitrine B2C (comprador) — feed público, favoritos, chat comprador↔loja e
// auth PF leve, contra /v1/veiculos/marketplace, /v1/vitrine e /v1/auth.
import { api } from '../lib/api'
import type { User } from '../stores/authStore'
import type { LoginResult } from './auth'
import type { AnuncioVitrine, ConversaVitrine, LojaVitrine, Mensagem, Midia, TipoVeiculo } from './types'

export type FiltroFeed = 'todos' | 'ofertas' | 'novidades' | 'carro' | 'moto'

export const FILTROS_FEED: { value: FiltroFeed; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ofertas', label: 'Ofertas' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'carro', label: 'Carros' },
  { value: 'moto', label: 'Motos' },
]

interface VeiculoB2CDTO {
  id: string
  loja_id: string
  loja_nome?: string | null
  loja_cidade?: string | null
  loja_estado?: string | null
  loja_whatsapp?: string | null
  loja_verificada?: boolean
  marca: string
  modelo: string
  versao?: string | null
  ano_fabricacao?: number | null
  ano_modelo: number
  km?: number | null
  cor?: string | null
  cambio?: string | null
  combustivel?: string | null
  tipo?: string | null
  portas?: number | null
  preco_venda?: number | null
  descricao?: string | null
  opcionais?: string | null
  midias?: { id: string; tipo: 'imagem' | 'video'; url: string; ordem: number }[]
  total_favoritos?: number
  favoritado_por_mim?: boolean
  created_at?: string
}
interface ConversaB2CDTO {
  id: string
  loja_id?: string | null
  loja_nome?: string | null
  veiculo_marca?: string | null
  veiculo_modelo?: string | null
  ultima_mensagem?: string | null
  ultima_mensagem_data?: string | null
  mensagens_nao_lidas?: number
}
interface MensagemB2CDTO {
  id: string
  conversa_id: string
  autor_id?: string | null
  conteudo: string
  lida: boolean
  created_at: string
}

function mapAnuncio(v: VeiculoB2CDTO): AnuncioVitrine {
  return {
    id: v.id,
    loja_id: v.loja_id,
    loja_nome: v.loja_nome ?? 'Loja',
    loja_cidade: v.loja_cidade ?? undefined,
    loja_estado: v.loja_estado ?? undefined,
    loja_whatsapp: v.loja_whatsapp ?? undefined,
    loja_verificada: v.loja_verificada ?? false,
    marca: v.marca,
    modelo: v.modelo,
    versao: v.versao ?? undefined,
    tipo: (v.tipo as TipoVeiculo) ?? 'carro',
    ano_fabricacao: v.ano_fabricacao ?? undefined,
    ano_modelo: v.ano_modelo,
    km: v.km ?? undefined,
    cor: v.cor ?? undefined,
    cambio: v.cambio ?? undefined,
    combustivel: v.combustivel ?? undefined,
    portas: v.portas ?? undefined,
    preco_venda: v.preco_venda ?? undefined,
    descricao: v.descricao ?? undefined,
    opcionais: v.opcionais ?? undefined,
    midias: (v.midias ?? []).map((m): Midia => ({ id: m.id, tipo: m.tipo, url: m.url, ordem: m.ordem })),
    oferta: false,
    novidade: false,
    total_favoritos: v.total_favoritos ?? 0,
    favoritado_por_mim: v.favoritado_por_mim ?? false,
    created_at: v.created_at ?? new Date().toISOString(),
  }
}

function mapConversa(c: ConversaB2CDTO): ConversaVitrine {
  const veiculo = [c.veiculo_marca, c.veiculo_modelo].filter(Boolean).join(' ') || undefined
  return {
    id: c.id,
    loja_id: c.loja_id ?? '',
    loja_nome: c.loja_nome ?? 'Loja',
    loja_verificada: false,
    veiculo_interesse: veiculo,
    ultima_mensagem: c.ultima_mensagem ?? '',
    ultima_mensagem_em: c.ultima_mensagem_data ?? new Date(0).toISOString(),
    nao_lidas: c.mensagens_nao_lidas ?? 0,
  }
}

function mapMensagem(m: MensagemB2CDTO): Mensagem {
  return {
    id: m.id,
    conversa_id: m.conversa_id,
    autor: m.autor_id ? 'cliente' : 'loja',
    texto: m.conteudo,
    created_at: m.created_at,
    lida: m.lida,
  }
}

const DEMO_PF = { email: 'vitrine@demo.com', senha: 'demo123' }

export const vitrineService = {
  // ── Auth PF leve ─────────────────────────────────────────
  async login(): Promise<LoginResult> {
    return api.post<LoginResult>('/auth/login', DEMO_PF)
  },

  async cadastrar(nome: string, email: string, senha = 'demo123'): Promise<LoginResult> {
    await api.post('/auth/register-b2c', { nome: nome.trim(), email: email.trim().toLowerCase(), senha })
    return api.post<LoginResult>('/auth/login', { email: email.trim().toLowerCase(), senha })
  },

  // ── Feed / detalhe ───────────────────────────────────────
  async feed(filtro: FiltroFeed = 'todos', busca = ''): Promise<AnuncioVitrine[]> {
    const params: Record<string, string> = {}
    if (busca.trim()) params.q = busca.trim()
    if (filtro === 'carro' || filtro === 'moto') params.tipo = filtro
    const data = await api.get<VeiculoB2CDTO[]>('/veiculos/marketplace/feed', params)
    let lista = data.map(mapAnuncio)
    if (filtro === 'ofertas') lista = lista.filter((a) => a.oferta)
    else if (filtro === 'novidades') lista = lista.filter((a) => a.novidade)
    return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async detalhe(id: string): Promise<AnuncioVitrine | undefined> {
    try {
      return mapAnuncio(await api.get<VeiculoB2CDTO>(`/vitrine/veiculos/${id}`))
    } catch {
      return undefined
    }
  },

  // ── Favoritos ────────────────────────────────────────────
  async favoritos(): Promise<AnuncioVitrine[]> {
    const data = await api.get<VeiculoB2CDTO[]>('/vitrine/favoritos')
    return data.map(mapAnuncio)
  },

  async alternarFavorito(id: string): Promise<boolean> {
    // Descobre o estado atual pelo detalhe e alterna.
    const atual = await this.detalhe(id)
    if (atual?.favoritado_por_mim) {
      await api.delete(`/vitrine/favoritos/${id}`)
      return false
    }
    await api.post('/vitrine/favoritos', { veiculo_id: id })
    return true
  },

  // ── Lojas ────────────────────────────────────────────────
  async loja(id: string): Promise<LojaVitrine | undefined> {
    // O feed já carrega os dados da loja em cada anúncio; derivamos a partir dele.
    const anuncios = await api.get<VeiculoB2CDTO[]>('/veiculos/marketplace/feed').catch(() => [])
    const daLoja = anuncios.filter((a) => a.loja_id === id)
    const ref = daLoja[0]
    if (!ref) return undefined
    return {
      id,
      nome: ref.loja_nome ?? 'Loja',
      cidade: ref.loja_cidade ?? undefined,
      estado: ref.loja_estado ?? undefined,
      whatsapp: ref.loja_whatsapp ?? undefined,
      verificada: ref.loja_verificada ?? false,
      total_veiculos: daLoja.length,
    }
  },

  async veiculosDaLoja(lojaId: string): Promise<AnuncioVitrine[]> {
    const anuncios = await api.get<VeiculoB2CDTO[]>('/veiculos/marketplace/feed')
    return anuncios.filter((a) => a.loja_id === lojaId).map(mapAnuncio)
  },

  async seguirLoja(_lojaId: string): Promise<boolean> {
    // Seguir loja no B2C ainda não é exposto pela API; no-op estável.
    return false
  },

  // ── Chat B2C (comprador ↔ loja) ──────────────────────────
  async conversas(): Promise<ConversaVitrine[]> {
    const data = await api.get<ConversaB2CDTO[]>('/vitrine/conversas')
    return data.map(mapConversa).sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
  },

  async mensagens(conversaId: string): Promise<Mensagem[]> {
    const data = await api.get<MensagemB2CDTO[]>(`/vitrine/conversas/${conversaId}/mensagens`)
    return data.map(mapMensagem).sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async abrirConversa(anuncio: AnuncioVitrine): Promise<ConversaVitrine> {
    const c = await api.post<ConversaB2CDTO>('/vitrine/conversas', { veiculo_id: anuncio.id })
    return mapConversa(c)
  },

  async enviar(conversaId: string, texto: string): Promise<Mensagem> {
    const m = await api.post<MensagemB2CDTO>(`/vitrine/conversas/${conversaId}/mensagens`, { conteudo: texto })
    return mapMensagem(m)
  },

  async marcarLidas(_conversaId: string): Promise<void> {
    return
  },
}

export type { User }
