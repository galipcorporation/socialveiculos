const API_BASE = '/v1/public/site'

export interface SiteConfig {
  id: string
  subdominio: string
  dominio_customizado?: string | null
  dominio_status: string
  publicado: boolean
  template: string
  cor_primaria?: string | null
  cor_secundaria?: string | null
  logo_url?: string | null
  banner_url?: string | null
  favicon_url?: string | null
  hero_titulo?: string | null
  hero_subtitulo?: string | null
  hero_cta?: string | null
  sobre_texto?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_image_url?: string | null
  ga4_id?: string | null
  meta_pixel_id?: string | null
}

export interface LojaPublica {
  id: string
  nome: string
  slug: string
  whatsapp?: string | null
  cidade?: string | null
  estado?: string | null
  verificada?: boolean
  total_veiculos?: number
}

export interface SitePublicoResponse {
  site: SiteConfig
  loja: LojaPublica
}

export async function fetchSitePublico(host: string): Promise<SitePublicoResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/${host}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface VeiculoB2C {
  id: string
  marca: string
  modelo: string
  versao?: string | null
  ano_fabricacao: number
  ano_modelo: number
  km?: number | null
  cor?: string | null
  preco_venda?: number | null
  midias?: { url: string }[]
}

export async function fetchEstoqueLoja(lojaSlug: string): Promise<VeiculoB2C[]> {
  try {
    const res = await fetch(`/v1/marketplace/loja/${lojaSlug}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.veiculos || []
  } catch {
    return []
  }
}

export async function enviarLead(payload: {
  host: string
  nome: string
  telefone: string
  email?: string
  mensagem?: string
  veiculo_id?: string
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}
