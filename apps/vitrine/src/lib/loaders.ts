/**
 * Loaders SSG-aware: usados pelo prerender (servidor) e pela hidratação (cliente).
 * No servidor (window === undefined) usa URL absoluta da API; no cliente usa /v1 (proxy).
 */

export interface Midia {
  id: string
  tipo: 'foto' | 'video'
  url: string
  ordem: number
}

export interface Veiculo {
  id: string
  loja_id: string
  loja_nome?: string
  loja_cidade?: string
  loja_estado?: string
  loja_whatsapp?: string
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao: number
  ano_modelo: number
  km: number
  cor?: string
  cambio?: string
  combustivel?: string
  tipo?: string
  portas?: number
  preco_venda?: number
  descricao?: string
  opcionais?: string
  midias: Midia[]
  status: string
  total_favoritos: number
  favoritado_por_mim: boolean
}

export interface LojaPublica {
  id: string
  nome: string
  slug: string
  logo_url?: string
  cidade?: string
  estado?: string
  whatsapp?: string
  verificada: boolean
  total_veiculos: number
  veiculos: Veiculo[]
}

const isServer = typeof window === 'undefined'

/** Base da API: no build/prerender vem de env; no browser usa o proxy /v1. */
function apiBase(): string {
  if (isServer) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    return env?.PRERENDER_API_URL || 'http://localhost:8000'
  }
  return ''
}

async function ssgFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}/v1${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchVeiculo(id: string): Promise<Veiculo | null> {
  return ssgFetch<Veiculo>(`/vitrine/veiculos/${id}`)
}

export function fetchLoja(slug: string): Promise<LojaPublica | null> {
  return ssgFetch<LojaPublica>(`/marketplace/loja/${slug}`)
}

export interface SitemapData {
  car_ids: string[]
  store_slugs: string[]
}

export function fetchSitemap(): Promise<SitemapData | null> {
  return ssgFetch<SitemapData>('/marketplace/sitemap')
}

/* ── Helpers de formatação / meta ───────────────────────────── */

export function formatBRL(value?: number): string {
  if (value == null) return 'Consulte'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function carroMeta(v: Veiculo) {
  const nome = `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''} ${v.ano_modelo}`
  const title = `${nome} — ${formatBRL(v.preco_venda)} | Social Veículos`
  const description =
    v.descricao?.slice(0, 160) ||
    `${nome}, ${v.km.toLocaleString('pt-BR')} km, ${v.cor ?? ''} — à venda na Social Veículos.`
  const image = v.midias?.find((m) => m.tipo === 'foto')?.url || v.midias?.[0]?.url || ''
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Vehicle',
    name: nome,
    image: image || undefined,
    description,
    brand: { '@type': 'Brand', name: v.marca },
    model: v.modelo,
    vehicleModelDate: String(v.ano_modelo),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.km, unitCode: 'KMT' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: v.preco_venda ?? undefined,
      availability: 'https://schema.org/InStock',
    },
  }
  return { title, description, image, jsonLd }
}

export function lojaMeta(l: LojaPublica) {
  const local = [l.cidade, l.estado].filter(Boolean).join(' - ')
  const title = `${l.nome} — Estoque${local ? ' em ' + local : ''} | Social Veículos`
  const description = `Confira ${l.total_veiculos} veículo(s) à venda na ${l.nome}${
    local ? ', ' + local : ''
  }. Loja${l.verificada ? ' verificada' : ''} no Social Veículos.`
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'AutoDealer',
    name: l.nome,
    image: l.logo_url || undefined,
    address: local || undefined,
    telephone: l.whatsapp || undefined,
  }
  return { title, description, image: l.logo_url || '', jsonLd }
}
