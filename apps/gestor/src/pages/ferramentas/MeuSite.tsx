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

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
          Aparência
        </h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Template</label>
            <select className="form-input" value={site.template} onChange={set('template')}>
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Cor primária</label>
            <input type="color" className="form-input" value={site.cor_primaria || '#3B82F6'} onChange={set('cor_primaria')} style={{ height: 40 }} />
          </div>
          <div className="form-group">
            <label>Cor secundária</label>
            <input type="color" className="form-input" value={site.cor_secundaria || '#1E293B'} onChange={set('cor_secundaria')} style={{ height: 40 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <div className="form-group">
            <label>Logo</label>
            <label className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' }}>
              {uploadingLogo ? <span className="spinner" /> : <Upload style={{ width: 14, height: 14 }} />}
              {site.logo_url ? 'Trocar logo' : 'Enviar logo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadImagem(f, 'logo_url', setUploadingLogo)
              }} />
            </label>
            {site.logo_url && <img src={site.logo_url} alt="Logo" style={{ height: 48, marginTop: 8, borderRadius: 4 }} />}
          </div>
          <div className="form-group">
            <label>Banner</label>
            <label className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' }}>
              {uploadingBanner ? <span className="spinner" /> : <Upload style={{ width: 14, height: 14 }} />}
              {site.banner_url ? 'Trocar banner' : 'Enviar banner'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadImagem(f, 'banner_url', setUploadingBanner)
              }} />
            </label>
            {site.banner_url && <img src={site.banner_url} alt="Banner" style={{ height: 48, marginTop: 8, borderRadius: 4 }} />}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 24 }}>
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

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
          SEO &amp; Analytics
        </h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Título SEO</label>
            <input className="form-input" value={site.seo_title || ''} onChange={set('seo_title')} maxLength={200} />
          </div>
          <div className="form-group">
            <label>Descrição SEO</label>
            <input className="form-input" value={site.seo_description || ''} onChange={set('seo_description')} maxLength={300} />
          </div>
          <div className="form-group">
            <label>Google Analytics (GA4)</label>
            <input className="form-input" value={site.ga4_id || ''} onChange={set('ga4_id')} placeholder="G-XXXXXXXXXX" />
          </div>
          <div className="form-group">
            <label>Meta Pixel</label>
            <input className="form-input" value={site.meta_pixel_id || ''} onChange={set('meta_pixel_id')} placeholder="123456789012345" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? <span className="spinner" /> : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}
