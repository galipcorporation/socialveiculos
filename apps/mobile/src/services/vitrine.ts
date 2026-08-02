// Vitrine B2C (comprador) — feed público, favoritos, chat comprador↔loja e
// auth PF leve, contra /v1/veiculos/marketplace, /v1/vitrine e /v1/auth.
import { api } from '../lib/api'
import type { User } from '../stores/authStore'
import type { LoginResult } from './auth'
import { isFoto } from './types'
import type { AnuncioVitrine, ConversaVitrine, LojaVitrine, Mensagem, Midia, TipoVeiculo } from './types'

export type FiltroFeed = 'todos' | 'ofertas' | 'novidades' | 'carro' | 'moto'

export const FILTROS_FEED: { value: FiltroFeed; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ofertas', label: 'Ofertas' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'carro', label: 'Carros' },
  { value: 'moto', label: 'Motos' },
]

export type OrdenacaoBusca = 'relevancia' | 'preco_asc' | 'preco_desc' | 'km_asc' | 'ano_desc'

/**
 * Filtros da busca avançada. `marca`, `tipo`, `carroceria`, `preco_max` e parte da
 * ordenação são resolvidos pelo backend (/marketplace/feed); o resto (faixa de ano,
 * km, câmbio, combustível, cor, preço mínimo) é filtrado aqui — o endpoint público
 * ainda não aceita esses parâmetros.
 */
export interface FiltrosAvancados {
  tipo?: TipoVeiculo
  marca?: string
  carroceria?: string
  preco_min?: number
  preco_max?: number
  ano_min?: number
  ano_max?: number
  km_max?: number
  cambio?: string
  /** Multiescolha: quem procura "Flex ou Gasolina" não deveria ter que buscar duas vezes. */
  combustivel?: string[]
  cor?: string[]
  ordenacao?: OrdenacaoBusca
}

export const FILTROS_AVANCADOS_VAZIO: FiltrosAvancados = {}

/** Lista de critério multiescolha só conta como ativa se tiver algum item. */
function listaAtiva(v?: string[]): string[] | undefined {
  return v && v.length > 0 ? v : undefined
}

/** Quantos critérios estão ativos — alimenta o badge do botão de filtros.
 *  Combustível e cor contam 1 por critério, não 1 por opção marcada. */
export function contarFiltrosAtivos(f: FiltrosAvancados): number {
  return [
    f.tipo, f.marca, f.carroceria, f.preco_min, f.preco_max,
    f.ano_min, f.ano_max, f.km_max, f.cambio,
    listaAtiva(f.combustivel), listaAtiva(f.cor),
    f.ordenacao && f.ordenacao !== 'relevancia' ? f.ordenacao : undefined,
  ].filter((v) => v != null && v !== '').length
}

function temFiltroLocal(f: FiltrosAvancados): boolean {
  return [
    f.preco_min, f.ano_min, f.ano_max, f.km_max, f.cambio,
    listaAtiva(f.combustivel), listaAtiva(f.cor),
  ].some((v) => v != null && v !== '')
}

/** Casa o valor do anúncio com qualquer uma das opções marcadas (OR). */
function casaAlguma(valor: string | null | undefined, opcoes: string[] | undefined, porTrecho = false): boolean {
  if (!opcoes || opcoes.length === 0) return true
  const alvo = (valor ?? '').toLowerCase()
  return opcoes.some((o) => (porTrecho ? alvo.includes(o.toLowerCase()) : alvo === o.toLowerCase()))
}

function aplicarFiltrosLocais(lista: AnuncioVitrine[], f: FiltrosAvancados): AnuncioVitrine[] {
  return lista.filter((a) => {
    if (f.preco_min != null && (a.preco_venda ?? 0) < f.preco_min) return false
    if (f.preco_max != null && (a.preco_venda ?? Infinity) > f.preco_max) return false
    if (f.ano_min != null && a.ano_modelo < f.ano_min) return false
    if (f.ano_max != null && a.ano_modelo > f.ano_max) return false
    if (f.km_max != null && (a.km ?? 0) > f.km_max) return false
    if (f.cambio && a.cambio?.toLowerCase() !== f.cambio.toLowerCase()) return false
    if (!casaAlguma(a.combustivel, f.combustivel)) return false
    // Cor casa por trecho: o cadastro costuma vir como "Preto metálico".
    if (!casaAlguma(a.cor, f.cor, true)) return false
    return true
  })
}

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
  midias?: { id: string; tipo: string; url: string; ordem: number }[]
  total_favoritos?: number
  favoritado_por_mim?: boolean
  seguindo_loja?: boolean
  oferta?: boolean
  novidade?: boolean
  created_at?: string
}
interface LojaSeguidaDTO {
  id: string
  nome: string
  logo_url?: string | null
  cidade?: string | null
  estado?: string | null
  verificada?: boolean
  total_veiculos?: number
  seguindo_desde: string
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
  autor_tipo: 'loja' | 'cliente'
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
    midias: (v.midias ?? []).map((m): Midia => ({
      id: m.id,
      tipo: isFoto({ tipo: m.tipo as Midia['tipo'], url: m.url }) ? 'foto' : 'video',
      url: m.url,
      ordem: m.ordem,
    })),
    oferta: v.oferta ?? (v.preco_venda != null && v.preco_venda > 0),
    novidade: v.novidade ?? (v.created_at ? (Date.now() - new Date(v.created_at).getTime() < 14 * 86400000) : false),
    total_favoritos: v.total_favoritos ?? 0,
    favoritado_por_mim: v.favoritado_por_mim ?? false,
    seguindo_loja: v.seguindo_loja ?? false,
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
    autor: m.autor_tipo,
    texto: m.conteudo,
    created_at: m.created_at,
    lida: m.lida,
  }
}

export const vitrineService = {
  // ── Auth PF leve ─────────────────────────────────────────
  async cadastrar(nome: string, email: string, senha: string): Promise<LoginResult> {
    await api.post('/auth/register-b2c', { nome: nome.trim(), email: email.trim().toLowerCase(), senha })
    return api.post<LoginResult>('/auth/login', { email: email.trim().toLowerCase(), senha })
  },

  // ── Feed / detalhe ───────────────────────────────────────
  async feed(filtro: FiltroFeed = 'todos', busca = '', avancado: FiltrosAvancados = {}): Promise<AnuncioVitrine[]> {
    const params: Record<string, string> = {}
    if (busca.trim()) params.q = busca.trim()
    if (filtro === 'carro' || filtro === 'moto') params.tipo = filtro
    else if (avancado.tipo) params.tipo = avancado.tipo
    if (filtro === 'ofertas' || filtro === 'novidades') params.ordenacao = filtro
    else if (avancado.ordenacao) params.ordenacao = avancado.ordenacao
    if (avancado.marca) params.marca = avancado.marca
    if (avancado.carroceria) params.carroceria = avancado.carroceria
    if (avancado.preco_max != null) params.preco_max = String(avancado.preco_max)
    // O feed público pagina em 12 por padrão; com filtros locais (ano/km/câmbio…)
    // precisamos de um lote maior para não devolver uma lista quase vazia.
    if (temFiltroLocal(avancado)) params.per_page = '50'

    const data = await api.get<VeiculoB2CDTO[]>('/marketplace/feed', params)
    let lista = data.map(mapAnuncio)

    if (filtro === 'carro') lista = lista.filter((a) => a.tipo === 'carro')
    else if (filtro === 'moto') lista = lista.filter((a) => a.tipo === 'moto')
    else if (filtro === 'ofertas') lista = lista.filter((a) => a.oferta)
    else if (filtro === 'novidades') lista = lista.filter((a) => a.novidade)

    lista = aplicarFiltrosLocais(lista, avancado)

    if (avancado.ordenacao === 'preco_asc') return lista.sort((a, b) => (a.preco_venda ?? Infinity) - (b.preco_venda ?? Infinity))
    if (avancado.ordenacao === 'preco_desc') return lista.sort((a, b) => (b.preco_venda ?? -Infinity) - (a.preco_venda ?? -Infinity))
    if (avancado.ordenacao === 'km_asc') return lista.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
    if (avancado.ordenacao === 'ano_desc') return lista.sort((a, b) => b.ano_modelo - a.ano_modelo)
    return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  /** Carrocerias com anúncios publicados — alimenta o filtro de carroceria. */
  async categorias(): Promise<string[]> {
    try {
      return await api.get<string[]>('/marketplace/categorias')
    } catch {
      return []
    }
  },

  async detalhe(id: string): Promise<AnuncioVitrine | undefined> {
    try {
      return mapAnuncio(await api.get<VeiculoB2CDTO>(`/vitrine/veiculos/${id}`))
    } catch {
      return undefined
    }
  },

  async cadastrarLead(veiculoId: string, nome: string, telefone: string, email?: string, mensagem?: string): Promise<{ ok: boolean; whatsapp_url?: string }> {
    return api.post<{ ok: boolean; whatsapp_url?: string }>('/marketplace/lead-vitrine', {
      veiculo_id: veiculoId,
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email?.trim() || undefined,
      mensagem: mensagem?.trim() || undefined,
    })
  },

  // ── Favoritos ────────────────────────────────────────────
  async favoritos(): Promise<AnuncioVitrine[]> {
    const data = await api.get<VeiculoB2CDTO[]>('/vitrine/favoritos')
    return data.map(mapAnuncio)
  },

  async alternarFavorito(id: string, favoritadoAgora: boolean): Promise<boolean> {
    // O estado atual já vem do card/detalhe — não busca de novo.
    if (favoritadoAgora) {
      await api.delete(`/vitrine/favoritos/${id}`)
      return false
    }
    await api.post('/vitrine/favoritos', { veiculo_id: id })
    return true
  },

  // ── Lojas ────────────────────────────────────────────────
  async loja(id: string): Promise<LojaVitrine | undefined> {
    // O feed já carrega os dados da loja em cada anúncio; derivamos a partir dele.
    const anuncios = await api.get<VeiculoB2CDTO[]>('/marketplace/feed').catch(() => [])
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
    const anuncios = await api.get<VeiculoB2CDTO[]>('/marketplace/feed')
    return anuncios.filter((a) => a.loja_id === lojaId).map(mapAnuncio)
  },

  /** Lojas que o usuário logado segue, com contagem de anúncios. */
  async lojasSeguidas(): Promise<LojaVitrine[]> {
    const data = await api.get<LojaSeguidaDTO[]>('/vitrine/lojas/seguindo')
    return data.map((l) => ({
      id: l.id,
      nome: l.nome,
      logo_url: l.logo_url ?? undefined,
      cidade: l.cidade ?? undefined,
      estado: l.estado ?? undefined,
      verificada: l.verificada ?? false,
      total_veiculos: l.total_veiculos ?? 0,
      seguindo: true,
      seguindo_desde: l.seguindo_desde,
    }))
  },

  /** Retorna se o usuário logado segue a loja. */
  async checarSeguindo(lojaId: string): Promise<boolean> {
    const r = await api.get<{ seguindo: boolean; loja_id: string }>(`/vitrine/lojas/${lojaId}/seguindo`)
    return !!r.seguindo
  },

  /** Alterna seguir/deixar de seguir a loja. Retorna o novo estado. */
  async alternarSeguir(lojaId: string, seguindoAgora: boolean): Promise<boolean> {
    try {
      if (seguindoAgora) {
        await api.delete<{ seguindo: boolean }>(`/vitrine/lojas/${lojaId}/seguir`)
        return false
      }
      await api.post<{ seguindo: boolean }>(`/vitrine/lojas/${lojaId}/seguir`)
      return true
    } catch (err: any) {
      if (err?.details?.status === 400) return true
      if (err?.details?.status === 404) return false
      throw err
    }
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
    const c = await api.post<ConversaB2CDTO>('/vitrine/conversas', {
      veiculo_id: anuncio.id,
      loja_id: anuncio.loja_id,
      mensagem: `Olá, tenho interesse no veículo ${anuncio.marca} ${anuncio.modelo}.`,
    })
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
