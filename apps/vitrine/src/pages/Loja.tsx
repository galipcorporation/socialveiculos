import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchLoja, lojaMeta, formatBRL, type LojaPublica } from '../lib/loaders'
import { getSSGData } from '../lib/ssgData'

interface MidiaItem {
  id: string
  tipo: 'foto' | 'video'
  url: string
  ordem: number
}

function StoreItemMedia({ midias, alt }: { midias: MidiaItem[]; alt: string }) {
  const [idx, setIdx] = useState(0)
  const ordenadas = [...(midias ?? [])].sort((a, b) => a.ordem - b.ordem)
  const atual = ordenadas[idx]

  const prev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx((i) => (i === 0 ? ordenadas.length - 1 : i - 1))
  }
  const next = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx((i) => (i === ordenadas.length - 1 ? 0 : i + 1))
  }

  if (!atual) return <div className="vt-store-item-empty" />

  return (
    <div className="vt-store-item-media">
      {atual.tipo === 'video' ? (
        <video src={atual.url} preload="metadata" muted />
      ) : (
        <img src={atual.url} alt={alt} loading="lazy" />
      )}
      {ordenadas.length > 1 && (
        <>
          <span className="vt-media-count">{idx + 1}/{ordenadas.length}</span>
          <button className="vt-media-arrow left" onClick={prev}>‹</button>
          <button className="vt-media-arrow right" onClick={next}>›</button>
          <div className="vt-media-dots">
            {ordenadas.map((_, i) => (
              <span key={i} className={i === idx ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Loja({ initialData }: { initialData?: LojaPublica | null }) {
  const { slug } = useParams()
  const seed = initialData ?? getSSGData<LojaPublica>()
  const [loja, setLoja] = useState<LojaPublica | null>(seed)
  const [loading, setLoading] = useState(!seed)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (seed && seed.slug === slug) return
    let alive = true
    setLoading(true)
    fetchLoja(slug!).then((l) => {
      if (!alive) return
      if (l) setLoja(l)
      else setErro(true)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="vt-detail">Carregando…</div>
  if (erro || !loja) {
    return (
      <div className="vt-detail">
        Loja não encontrada.{' '}
        <Link to="/" className="vt-detail-back">
          Voltar ao feed
        </Link>
      </div>
    )
  }

  const meta = lojaMeta(loja)
  const local = [loja.cidade, loja.estado].filter(Boolean).join(' - ')

  return (
    <div className="vt-detail">
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        <script type="application/ld+json">{JSON.stringify(meta.jsonLd)}</script>
      </Helmet>

      <div className="vt-store-header">
        {loja.logo_url ? (
          <img src={loja.logo_url} alt={loja.nome} className="vt-store-logo" />
        ) : (
          <div className="vt-store-logo-fallback">{loja.nome.slice(0, 2).toUpperCase()}</div>
        )}
        <div>
          <h1 className="vt-detail-title">{loja.nome}</h1>
          <div className="vt-store-meta">
            {local && <span>{local}</span>}
            {loja.verificada && <span className="vt-store-verified">✓ Loja Verificada</span>}
          </div>
        </div>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Veículos em Estoque ({loja.total_veiculos})</h2>

      {loja.veiculos.length === 0 ? (
        <div className="vt-empty">Esta loja não tem veículos publicados no momento.</div>
      ) : (
        <div className="vt-store-grid">
          {loja.veiculos.map((v) => {
            return (
              <Link key={v.id} to={`/carro/${v.id}`} className="vt-store-item">
                <StoreItemMedia midias={v.midias} alt={`${v.marca} ${v.modelo}`} />
                <div className="vt-store-item-body">
                  <div className="vt-store-item-title">{v.marca} {v.modelo}</div>
                  <div className="vt-store-item-sub">
                    {v.ano_fabricacao}/{v.ano_modelo} · {v.km.toLocaleString('pt-BR')} km
                  </div>
                  <div className="vt-store-item-price">{formatBRL(v.preco_venda)}</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
