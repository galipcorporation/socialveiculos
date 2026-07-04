import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchSitePublico, type SitePublicoResponse } from './lib/api'
import { getSSGData } from './lib/ssgData'
import { Home } from './pages/Home'
import { Estoque } from './pages/Estoque'
import { Contato } from './pages/Contato'
import { NaoEncontrado } from './pages/NaoEncontrado'

function getHost(): string {
  if (typeof window !== 'undefined') return window.location.hostname
  const g = globalThis as unknown as { __SITE_HOST__?: string }
  return g.__SITE_HOST__ || ''
}

export default function App() {
  const ssg = getSSGData<SitePublicoResponse>()
  const [dados, setDados] = useState<SitePublicoResponse | null>(ssg)
  const [loading, setLoading] = useState(!ssg)

  useEffect(() => {
    if (ssg) return
    const host = getHost()
    fetchSitePublico(host).then((res) => {
      setDados(res)
      setLoading(false)
    })
  }, [ssg])

  useEffect(() => {
    if (dados?.site.cor_primaria) {
      document.documentElement.style.setProperty('--site-primary', dados.site.cor_primaria)
    }
    if (dados?.site.cor_secundaria) {
      document.documentElement.style.setProperty('--site-secondary', dados.site.cor_secundaria)
    }
  }, [dados])

  if (loading) {
    return <div className="site-empty">Carregando…</div>
  }

  if (!dados) {
    return <NaoEncontrado />
  }

  return (
    <>
      <Helmet>
        <title>{dados.site.seo_title || dados.loja.nome}</title>
        {dados.site.seo_description && <meta name="description" content={dados.site.seo_description} />}
        {dados.site.favicon_url && <link rel="icon" href={dados.site.favicon_url} />}
        {dados.site.ga4_id && (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${dados.site.ga4_id}`} />
        )}
      </Helmet>
      <Routes>
        <Route path="/" element={<Home dados={dados} />} />
        <Route path="/estoque" element={<Estoque dados={dados} />} />
        <Route path="/contato" element={<Contato dados={dados} />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Routes>
    </>
  )
}
