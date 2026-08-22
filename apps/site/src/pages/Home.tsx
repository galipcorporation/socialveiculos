import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchEstoqueLoja, type SitePublicoResponse, type VeiculoB2C } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

function formatBRL(v?: number | null) {
  if (v == null) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Hero({ dados }: { dados: SitePublicoResponse }) {
  const { site } = dados
  const titulo = site.hero_titulo || dados.loja.nome
  const subtitulo = site.hero_subtitulo || 'Confira nosso estoque de veículos selecionados com garantia e procedência.'
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
      <div className="site-container">
        <h1 className="site-hero-titulo">{titulo}</h1>
        <p className="site-hero-subtitulo">{subtitulo}</p>
        <Link to="/estoque" className="site-hero-cta">{cta}</Link>
      </div>
    </section>
  )
}

export function Home({ dados }: { dados: SitePublicoResponse }) {
  const [veiculos, setVeiculos] = useState<VeiculoB2C[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dados.loja.slug])

  const destaques = veiculos.slice(0, 6)
  const telLimpo = (dados.loja.whatsapp || '').replace(/\D/g, '')

  return (
    <>
      <SiteHeader dados={dados} />
      <Hero dados={dados} />

      {/* ── Seção de Estoque em Destaque ── */}
      <div className="site-container">
        <section className="site-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="site-section-titulo" style={{ margin: 0 }}>Nosso Estoque</h2>
              <p style={{ color: 'var(--site-text-dim)', fontSize: 14, margin: '4px 0 0' }}>
                Veículos inspecionados, revisados e prontos para entrega.
              </p>
            </div>
            {veiculos.length > 0 && (
              <Link to="/estoque" style={{ color: 'var(--site-primary)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                Ver todos ({veiculos.length}) →
              </Link>
            )}
          </div>

          {loading ? (
            <p className="site-empty">Carregando catálogo de veículos…</p>
          ) : veiculos.length === 0 ? (
            <div className="site-empty" style={{ background: 'var(--site-surface)', borderRadius: 'var(--site-radius)', border: '1px solid var(--site-border)', padding: 40 }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Nenhum veículo publicado no momento.</p>
              <p style={{ fontSize: 13, color: 'var(--site-text-dim)', margin: 0 }}>
                Novas opções estão sendo preparadas e estarão disponíveis em breve.
              </p>
            </div>
          ) : (
            <div className="site-estoque-grid">
              {destaques.map((v) => {
                const foto = v.midias?.[0]?.url
                const msgWhats = encodeURIComponent(`Olá! Vi o anúncio do ${v.marca} ${v.modelo} ${v.ano_modelo || ''} no site e gostaria de mais informações.`)
                const linkWhats = telLimpo ? `https://wa.me/55${telLimpo}?text=${msgWhats}` : null

                return (
                  <div key={v.id} className="site-card">
                    {foto ? (
                      <img src={foto} alt={`${v.marca} ${v.modelo}`} className="site-card-img" />
                    ) : (
                      <div className="site-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--site-text-dim)', fontSize: 13 }}>
                        Foto do Veículo
                      </div>
                    )}
                    <div className="site-card-body">
                      <div className="site-card-titulo">{v.marca} {v.modelo}</div>
                      <div className="site-card-info">
                        {v.ano_fabricacao}/{v.ano_modelo}
                        {v.km != null && ` · ${v.km.toLocaleString('pt-BR')} km`}
                        {v.cor && ` · ${v.cor}`}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <div className="site-card-preco">{formatBRL(v.preco_venda) || 'Consulte'}</div>
                        {linkWhats && (
                          <a
                            href={linkWhats}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="site-card-btn-whats"
                            title="Conversar no WhatsApp"
                          >
                            Proposta
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {veiculos.length > 6 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/estoque" className="site-hero-cta">
                Ver todo o estoque ({veiculos.length} veículos)
              </Link>
            </div>
          )}
        </section>

        {/* ── Sobre nós ── */}
        {dados.site.sobre_texto && (
          <section className="site-section">
            <h2 className="site-section-titulo">Sobre nós</h2>
            <p style={{ color: 'var(--site-text-dim)', lineHeight: 1.7, fontSize: 15 }}>
              {dados.site.sobre_texto}
            </p>
          </section>
        )}
      </div>

      <SiteFooter dados={dados} />
    </>
  )
}
