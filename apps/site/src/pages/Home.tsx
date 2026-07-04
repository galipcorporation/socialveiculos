import { Link } from 'react-router-dom'
import type { SitePublicoResponse } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

function Hero({ dados }: { dados: SitePublicoResponse }) {
  const { site } = dados
  const titulo = site.hero_titulo || dados.loja.nome
  const subtitulo = site.hero_subtitulo || 'Confira nosso estoque de veículos.'
  const cta = site.hero_cta || 'Ver estoque'

  if (site.template === 'premium') {
    return (
      <section
        className="site-hero-premium"
        style={site.banner_url ? { backgroundImage: `url(${site.banner_url})` } : undefined}
      >
        <h1 className="site-hero-titulo">{titulo}</h1>
        <p className="site-hero-subtitulo">{subtitulo}</p>
        <Link to="/estoque" className="site-hero-cta">{cta}</Link>
      </section>
    )
  }

  if (site.template === 'compacto') {
    return (
      <section className="site-hero-compacto">
        <div className="site-container">
          <h1 className="site-hero-titulo">{titulo}</h1>
          <p className="site-hero-subtitulo">{subtitulo}</p>
          <Link to="/estoque" className="site-hero-cta" style={{ marginTop: 16, display: 'inline-block' }}>{cta}</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="site-hero">
      <h1 className="site-hero-titulo">{titulo}</h1>
      <p className="site-hero-subtitulo">{subtitulo}</p>
      <Link to="/estoque" className="site-hero-cta">{cta}</Link>
    </section>
  )
}

export function Home({ dados }: { dados: SitePublicoResponse }) {
  return (
    <>
      <SiteHeader dados={dados} />
      <Hero dados={dados} />
      {dados.site.sobre_texto && (
        <div className="site-container">
          <section className="site-section">
            <h2 className="site-section-titulo">Sobre nós</h2>
            <p>{dados.site.sobre_texto}</p>
          </section>
        </div>
      )}
      <SiteFooter dados={dados} />
    </>
  )
}
