import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { Gem, Upload, ExternalLink, Globe } from 'lucide-react'

interface SiteLoja {
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
  ga4_id?: string | null
  meta_pixel_id?: string | null
}

const TEMPLATES = [
  { value: 'clean', label: 'Clean' },
  { value: 'premium', label: 'Premium' },
  { value: 'compacto', label: 'Compacto' },
]

export function MeuSitePage() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()

  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [site, setSite] = useState<SiteLoja | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [mostrarAvancado, setMostrarAvancado] = useState(false)

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const mod = res.find((m) => m.modulo === 'site')
        setLiberado(mod ? mod.liberado : false)
      } catch {
        setLiberado(false)
      }
    }
    verificar()
  }, [])

  const carregarSite = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<SiteLoja>('/site')
      setSite(res)
    } catch (err) {
      console.warn('Erro ao carregar site:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarSite()
  }, [carregarSite])

  const set = <K extends keyof SiteLoja>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setSite((s) => (s ? { ...s, [key]: e.target.value } : s))

  const salvar = async () => {
    if (!site) return
    setSalvando(true)
    try {
      const atualizado = await api.put<SiteLoja>('/site', {
        template: site.template,
        cor_primaria: site.cor_primaria,
        cor_secundaria: site.cor_secundaria,
        logo_url: site.logo_url,
        banner_url: site.banner_url,
        favicon_url: site.favicon_url,
        hero_titulo: site.hero_titulo,
        hero_subtitulo: site.hero_subtitulo,
        hero_cta: site.hero_cta,
        sobre_texto: site.sobre_texto,
        seo_title: site.seo_title,
        seo_description: site.seo_description,
        ga4_id: site.ga4_id,
        meta_pixel_id: site.meta_pixel_id,
      })
      setSite(atualizado)
      showToast('Configurações salvas.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao salvar site.', details)
    } finally {
      setSalvando(false)
    }
  }

  const alternarPublicacao = async () => {
    if (!site) return
    setSalvando(true)
    try {
      const acao = site.publicado ? 'despublicar' : 'publicar'
      const atualizado = await api.post<SiteLoja>(`/site/${acao}`)
      setSite(atualizado)
      showToast(site.publicado ? 'Site despublicado.' : 'Site publicado!', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao alterar publicação.', details)
    } finally {
      setSalvando(false)
    }
  }

  const uploadImagem = async (file: File, campo: 'logo_url' | 'banner_url' | 'favicon_url', setUploading: (v: boolean) => void) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<{ url: string }>('/midias/upload', fd)
      setSite((s) => (s ? { ...s, [campo]: res.url } : s))
      showToast('Imagem enviada — clique em Salvar para aplicar.', 'success')
    } catch (err) {
      const { message } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao enviar imagem.')
    } finally {
      setUploading(false)
    }
  }

  if (liberado === false) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>Meu Site</h2>
          <p>Site próprio e personalizado da sua loja.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
          <h3>Recurso Premium</h3>
          <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
            O módulo Site não está ativo no seu plano.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ferramentas')}>
            Ver Módulos &amp; Assinatura
          </button>
        </div>
      </div>
    )
  }

  if (liberado === null || loading || !site) {
    return <div className="empty-state">Carregando…</div>
  }

  const urlSite = `${site.subdominio}.socialveiculos.com.br`

  return (
    <div className="page-content">
      <style>{`
        .site-builder-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .site-builder-grid {
            grid-template-columns: 1fr;
          }
        }
        .site-preview-device {
          border: 1px solid var(--sv-border);
          border-radius: var(--sv-radius-lg);
          overflow: hidden;
          background: #f8fafc;
          color: #0f172a;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
          position: sticky;
          top: 24px;
        }
        .site-preview-browser {
          background: var(--sv-surface-solid);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--sv-border);
        }
        .site-preview-dots {
          display: flex;
          gap: 6px;
        }
        .site-preview-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .site-preview-address {
          flex: 1;
          background: var(--sv-input-bg);
          border: 1px solid var(--sv-border);
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          font-family: monospace;
          color: var(--sv-text-dim);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-preview-viewport {
          height: 520px;
          overflow-y: auto;
          background: #f8fafc;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-logo {
          height: 24px;
          max-width: 100px;
          object-fit: contain;
        }
        .preview-logo-placeholder {
          font-weight: 700;
          font-size: 14px;
          color: #0f172a;
        }
        .preview-nav {
          display: flex;
          gap: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
        }
        .preview-hero-clean {
          padding: 48px 16px;
          text-align: center;
          background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
        }
        .preview-hero-premium {
          padding: 64px 16px;
          text-align: center;
          color: #ffffff;
          background-size: cover;
          background-position: center;
          position: relative;
        }
        .preview-hero-premium::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
        }
        .preview-hero-premium-content {
          position: relative;
          z-index: 1;
        }
        .preview-hero-compacto {
          padding: 32px 16px;
          text-align: left;
          background: var(--preview-secondary);
          color: #ffffff;
        }
        .preview-hero-title {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 8px;
          line-height: 1.2;
          color: inherit;
        }
        .preview-hero-clean .preview-hero-title {
          color: #0f172a;
        }
        .preview-hero-subtitle {
          font-size: 12px;
          margin-bottom: 16px;
          color: inherit;
          opacity: 0.85;
        }
        .preview-hero-clean .preview-hero-subtitle {
          color: #64748b;
          opacity: 1;
        }
        .preview-hero-btn {
          display: inline-block;
          padding: 8px 16px;
          background: var(--preview-primary);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          border-radius: 4px;
          text-align: center;
          text-decoration: none;
        }
        .preview-section {
          padding: 24px 16px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-section-title {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #0f172a;
        }
        .preview-section-text {
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
          white-space: pre-line;
        }
        .preview-footer {
          padding: 16px;
          text-align: center;
          background: var(--preview-secondary);
          color: #94a3b8;
          font-size: 10px;
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Meu Site</h2>
          <p>Configure o site próprio da sua loja — marca, cores e conteúdo.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--sv-text-dim)' }}>
            <Globe style={{ width: 14, height: 14 }} />
            <span style={{ fontFamily: 'monospace' }}>{urlSite}</span>
          </div>
          <button
            className={site.publicado ? 'btn btn-outline' : 'btn btn-primary'}
            onClick={alternarPublicacao}
            disabled={salvando}
          >
            {site.publicado ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </div>

      {site.publicado && (
        <div className="glass-card" style={{ marginBottom: 16, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sv-success)', fontSize: 13 }}>
          <ExternalLink style={{ width: 14, height: 14 }} /> Site publicado e acessível em {urlSite}
        </div>
      )}

      <div className="site-builder-grid">
        {/* Left Side: Editor Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="glass-card">
            <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
              Aparência
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Template</label>
                <select className="form-input" value={site.template} onChange={set('template')}>
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Cor primária</label>
                  <input type="color" className="form-input" value={site.cor_primaria || '#3B82F6'} onChange={set('cor_primaria')} style={{ height: 40 }} />
                </div>
                <div className="form-group">
                  <label>Cor secundária</label>
                  <input type="color" className="form-input" value={site.cor_secundaria || '#1E293B'} onChange={set('cor_secundaria')} style={{ height: 40 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Logo</label>
                  <label className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                    {uploadingLogo ? <span className="spinner" /> : <Upload style={{ width: 14, height: 14 }} />}
                    {site.logo_url ? 'Trocar logo' : 'Enviar logo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadImagem(f, 'logo_url', setUploadingLogo)
                    }} />
                  </label>
                  {site.logo_url && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <img src={site.logo_url} alt="Logo" style={{ height: 32, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Banner (Fundo Premium)</label>
                  <label className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                    {uploadingBanner ? <span className="spinner" /> : <Upload style={{ width: 14, height: 14 }} />}
                    {site.banner_url ? 'Trocar banner' : 'Enviar banner'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadImagem(f, 'banner_url', setUploadingBanner)
                    }} />
                  </label>
                  {site.banner_url && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <img src={site.banner_url} alt="Banner" style={{ height: 32, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
              Conteúdo — Home
            </h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Título de destaque (hero)</label>
                <input className="form-input" value={site.hero_titulo || ''} onChange={set('hero_titulo')} placeholder="Ex.: Os melhores carros seminovos da região" />
              </div>
              <div className="form-group">
                <label>Subtítulo</label>
                <input className="form-input" value={site.hero_subtitulo || ''} onChange={set('hero_subtitulo')} placeholder="Ex.: Confira nosso estoque com garantia" />
              </div>
              <div className="form-group">
                <label>Texto do botão (CTA)</label>
                <input className="form-input" value={site.hero_cta || ''} onChange={set('hero_cta')} placeholder="Ex.: Ver estoque" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Sobre a loja</label>
              <textarea className="form-input" rows={4} value={site.sobre_texto || ''} onChange={set('sobre_texto')} placeholder="Conte a história da sua loja para o cliente." />
            </div>
          </div>

          <div className="glass-card">
            <h4 style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
              Como seu site aparece no Google
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--sv-text-dim)' }}>
              Esse texto aparece quando alguém encontra sua loja numa busca no Google.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label>Título</label>
                <input className="form-input" value={site.seo_title || ''} onChange={set('seo_title')} maxLength={200} placeholder="Ex.: AutoPremium - Carros seminovos" />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <input className="form-input" value={site.seo_description || ''} onChange={set('seo_description')} maxLength={300} placeholder="Ex.: Confira nosso estoque de seminovos com garantia" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMostrarAvancado((v) => !v)}
              style={{ marginTop: 16, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--sv-primary, #6366f1)' }}
            >
              {mostrarAvancado ? '– Ocultar configurações avançadas' : '+ Configurações avançadas (para quem já usa Google Analytics ou Meta Ads)'}
            </button>

            {mostrarAvancado && (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Google Analytics (GA4)</label>
                  <input className="form-input" value={site.ga4_id || ''} onChange={set('ga4_id')} placeholder="G-XXXXXXXXXX" />
                  <small style={{ color: 'var(--sv-text-dim)' }}>Só preencha se você já usa o Google Analytics. Se não souber o que é, pode deixar em branco.</small>
                </div>
                <div className="form-group">
                  <label>Meta Pixel</label>
                  <input className="form-input" value={site.meta_pixel_id || ''} onChange={set('meta_pixel_id')} placeholder="123456789012345" />
                  <small style={{ color: 'var(--sv-text-dim)' }}>Usado para anúncios no Instagram/Facebook. Só preencha se você já tiver esse código.</small>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? <span className="spinner" /> : 'Salvar Configurações'}
            </button>
          </div>
        </div>

        {/* Right Side: Real-time Live Preview */}
        <div className="site-preview-device">
          <div className="site-preview-browser">
            <div className="site-preview-dots">
              <div className="site-preview-dot" style={{ background: '#ef4444' }} />
              <div className="site-preview-dot" style={{ background: '#f59e0b' }} />
              <div className="site-preview-dot" style={{ background: '#10b981' }} />
            </div>
            <div className="site-preview-address">
              https://{urlSite} (Visualização)
            </div>
          </div>
          <div
            className="site-preview-viewport"
            style={{
              '--preview-primary': site.cor_primaria || '#3B82F6',
              '--preview-secondary': site.cor_secundaria || '#1E293B',
            } as React.CSSProperties}
          >
            {/* Header Preview */}
            <header className="preview-header">
              {site.logo_url ? (
                <img src={site.logo_url} alt="Logo" className="preview-logo" />
              ) : (
                <span className="preview-logo-placeholder">{site.subdominio.toUpperCase()}</span>
              )}
              <nav className="preview-nav">
                <span>Home</span>
                <span>Estoque</span>
                <span>Sobre</span>
                <span>Contato</span>
              </nav>
            </header>

            {/* Hero Banner Preview */}
            {site.template === 'premium' ? (
              <section
                className="preview-hero-premium"
                style={site.banner_url ? { backgroundImage: `url(${site.banner_url})` } : { background: '#1e293b' }}
              >
                <div className="preview-hero-premium-content">
                  <h1 className="preview-hero-title">{site.hero_titulo || 'Título de Destaque'}</h1>
                  <p className="preview-hero-subtitle">{site.hero_subtitulo || 'Subtítulo atraente da home'}</p>
                  <span className="preview-hero-btn">{site.hero_cta || 'Ver estoque'}</span>
                </div>
              </section>
            ) : site.template === 'compacto' ? (
              <section
                className="preview-hero-compacto"
                style={site.banner_url ? { backgroundImage: `url(${site.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                <h1 className="preview-hero-title">{site.hero_titulo || 'Título de Destaque'}</h1>
                <p className="preview-hero-subtitle">{site.hero_subtitulo || 'Subtítulo atraente da home'}</p>
                <span className="preview-hero-btn" style={{ background: '#ffffff', color: 'var(--preview-primary)' }}>
                  {site.hero_cta || 'Ver estoque'}
                </span>
              </section>
            ) : (
              <section
                className="preview-hero-clean"
                style={site.banner_url ? { backgroundImage: `url(${site.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                <h1 className="preview-hero-title">{site.hero_titulo || 'Título de Destaque'}</h1>
                <p className="preview-hero-subtitle">{site.hero_subtitulo || 'Subtítulo atraente da home'}</p>
                <span className="preview-hero-btn">{site.hero_cta || 'Ver estoque'}</span>
              </section>
            )}

            {/* About us Section Preview */}
            {site.sobre_texto && (
              <section className="preview-section">
                <h2 className="preview-section-title">Sobre nós</h2>
                <p className="preview-section-text">{site.sobre_texto}</p>
              </section>
            )}

            {/* Mocked Inventory Grid Preview */}
            <section className="preview-section" style={{ background: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
              <h2 className="preview-section-title" style={{ textAlign: 'center', marginBottom: 12 }}>Nosso Estoque</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { marca: 'Chevrolet', mod: 'Onix 1.0 Turbo', ano: '2022', preco: 'R$ 68.900' },
                  { marca: 'Jeep', mod: 'Compass 2.0 T270', ano: '2021', preco: 'R$ 134.900' }
                ].map((car, i) => (
                  <div key={i} style={{ background: '#ffffff', borderRadius: 4, padding: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ background: '#cbd5e1', height: 60, borderRadius: 2, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b' }}>Foto do Veículo</div>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>{car.mod}</p>
                    <p style={{ fontSize: 9, color: '#64748b', margin: '0 0 6px' }}>{car.marca} · {car.ano}</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--preview-primary)', margin: 0 }}>{car.preco}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Footer Preview */}
            <footer className="preview-footer">
              <p style={{ margin: 0 }}>© 2026 {site.subdominio.toUpperCase()} · Todos os direitos reservados.</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
