export interface ThemeConfig {
  tipo: 'marketplace' | 'white-label'
  lojaId?: string
  lojaSlug?: string
  paleta: {
    primary: string
    secondary: string
    accent: string
    background: string
  }
  logo?: string
  template: 'clean' | 'premium' | 'compacto'
  hero?: {
    titulo: string
    subtitulo?: string
    ctaTexto?: string
    banner?: string
  }
  footerText?: string
  analytics?: {
    ga4?: string
    pixel?: string
  }
}

const DEFAULT_MARKETPLACE_CONFIG: ThemeConfig = {
  tipo: 'marketplace',
  paleta: {
    primary: '#0066cc',
    secondary: '#00cc99',
    accent: '#ff6600',
    background: '#f5f5f5',
  },
  template: 'clean',
  hero: {
    titulo: 'Encontre seu próximo veículo',
    subtitulo: 'Marketplace de carros de lojas verificadas',
    ctaTexto: 'Buscar agora',
  },
}

export function detectarTipoSite(host: string): 'marketplace' | 'white-label' {
  if (!host) return 'marketplace'
  const parts = host.split('.')
  // socialveiculos.com.br = marketplace
  // {slug}.socialveiculos.com.br = white-label
  return parts.length > 2 ? 'white-label' : 'marketplace'
}

export function extrairSlugDoHost(host: string): string | null {
  if (!host) return null
  const tipo = detectarTipoSite(host)
  if (tipo === 'marketplace') return null
  return host.split('.')[0]
}

export async function getThemeConfig(host: string): Promise<ThemeConfig> {
  const tipo = detectarTipoSite(host)

  if (tipo === 'marketplace') {
    return DEFAULT_MARKETPLACE_CONFIG
  }

  // white-label: busca config da loja no backend
  const slug = extrairSlugDoHost(host)
  if (!slug) return DEFAULT_MARKETPLACE_CONFIG

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/v1/public/site/${host}`,
      { credentials: 'omit' }
    )
    if (!response.ok) return DEFAULT_MARKETPLACE_CONFIG

    const siteData = await response.json()
    return {
      tipo: 'white-label',
      lojaId: siteData.loja_id,
      lojaSlug: slug,
      paleta: {
        primary: siteData.cor_primaria || '#0066cc',
        secondary: siteData.cor_secundaria || '#00cc99',
        accent: siteData.cor_destaque || '#ff6600',
        background: '#f5f5f5',
      },
      logo: siteData.logo_url,
      template: siteData.template || 'clean',
      hero: {
        titulo: siteData.hero_titulo || 'Bem-vindo',
        subtitulo: siteData.hero_subtitulo || '',
        ctaTexto: siteData.hero_cta || 'Ver estoque',
        banner: siteData.banner_url,
      },
      footerText: siteData.sobre_texto,
      analytics: {
        ga4: siteData.ga4_id,
        pixel: siteData.pixel_id,
      },
    }
  } catch (error) {
    console.error('[theme] Erro ao buscar config:', error)
    return DEFAULT_MARKETPLACE_CONFIG
  }
}
