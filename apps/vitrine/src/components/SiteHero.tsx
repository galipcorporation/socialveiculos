import { ThemeConfig } from '../lib/theme'
import '../styles/site-hero.css'

interface SiteHeroProps {
  config: ThemeConfig
  onSearchChange?: (q: string) => void
}

export function SiteHero({ config }: SiteHeroProps) {
  if (config.tipo === 'marketplace') {
    // Marketplace padrão (manter como estava)
    return (
      <div className="vt-hero-marketplace">
        <div className="vt-hero-content">
          <h1>{config.hero?.titulo || 'Encontre seu próximo veículo'}</h1>
          <p>{config.hero?.subtitulo || 'Marketplace de carros de lojas verificadas'}</p>
        </div>
      </div>
    )
  }

  // White-label: hero customizado por template
  const { template = 'clean', hero, logo, paleta } = config

  if (template === 'premium') {
    return (
      <div
        className="vt-hero-white-label premium"
        style={{
          backgroundImage: hero?.banner ? `url(${hero.banner})` : 'none',
          backgroundColor: paleta.background,
        }}
      >
        <div className="vt-hero-overlay" style={{ background: `rgba(0,0,0,0.4)` }} />
        <div className="vt-hero-content">
          {logo && <img src={logo} alt="Logo" className="vt-hero-logo" />}
          <h1 style={{ color: '#fff' }}>{hero?.titulo || 'Bem-vindo'}</h1>
          {hero?.subtitulo && <p style={{ color: '#fff' }}>{hero.subtitulo}</p>}
          {hero?.ctaTexto && (
            <button
              className="vt-hero-cta"
              style={{ backgroundColor: paleta.primary, color: '#fff' }}
            >
              {hero.ctaTexto}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (template === 'compacto') {
    return (
      <div
        className="vt-hero-white-label compacto"
        style={{
          backgroundColor: paleta.primary,
          backgroundImage: hero?.banner ? `url(${hero.banner})` : 'none',
        }}
      >
        <div className="vt-hero-content">
          {logo && <img src={logo} alt="Logo" className="vt-hero-logo-small" />}
          <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>{hero?.titulo}</h2>
          {hero?.ctaTexto && (
            <button
              className="vt-hero-cta-small"
              style={{ backgroundColor: paleta.secondary, color: '#000' }}
            >
              {hero.ctaTexto}
            </button>
          )}
        </div>
      </div>
    )
  }

  // clean (default)
  return (
    <div
      className="vt-hero-white-label clean"
      style={{
        backgroundColor: paleta.background,
        borderBottom: `4px solid ${paleta.primary}`,
      }}
    >
      <div className="vt-hero-content">
        {logo && <img src={logo} alt="Logo" className="vt-hero-logo" />}
        <h1 style={{ color: paleta.primary }}>{hero?.titulo || 'Bem-vindo'}</h1>
        {hero?.subtitulo && <p style={{ color: '#666' }}>{hero.subtitulo}</p>}
        {hero?.ctaTexto && (
          <button
            className="vt-hero-cta"
            style={{ backgroundColor: paleta.primary, color: '#fff' }}
          >
            {hero.ctaTexto}
          </button>
        )}
      </div>
    </div>
  )
}
