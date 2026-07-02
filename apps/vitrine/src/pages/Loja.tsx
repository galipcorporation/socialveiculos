import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchLoja, lojaMeta, formatBRL, type LojaPublica } from '../lib/loaders'
import { getSSGData } from '../lib/ssgData'

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
            // Mídia unificada: a capa é a primeira mídia (foto ou vídeo).
            const capa = [...(v.midias ?? [])].sort((a, b) => a.ordem - b.ordem)[0]
            return (
              <Link key={v.id} to={`/carro/${v.id}`} className="vt-store-item">
                {capa ? (
                  capa.tipo === 'video' ? (
                    <video src={capa.url} preload="metadata" muted />
                  ) : (
                    <img src={capa.url} alt={`${v.marca} ${v.modelo}`} loading="lazy" />
                  )
                ) : (
                  <div className="vt-store-item-empty" />
                )}
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
