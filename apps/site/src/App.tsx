import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchSitePublico, type SitePublicoResponse } from './lib/api'
import { getSSGData } from './lib/ssgData'
import { Home } from './pages/Home'
import { Estoque } from './pages/Estoque'
import { Contato } from './pages/Contato'
import { Sobre } from './pages/Sobre'
import { Financiamento } from './pages/Financiamento'
import { NaoEncontrado } from './pages/NaoEncontrado'

function autoDealerJsonLd(dados: SitePublicoResponse) {
  const { site, loja } = dados
  const local = [loja.cidade, loja.estado].filter(Boolean).join(' - ')
  return {
    '@context': 'https://schema.org/',
    '@type': 'AutoDealer',
    name: loja.nome,
    image: site.logo_url || site.og_image_url || undefined,
    address: local || undefined,
    telephone: loja.whatsapp || undefined,
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
  }
}

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

  const titulo = dados.site.seo_title || dados.loja.nome
  const descricao = dados.site.seo_description || undefined
  const imagem = dados.site.og_image_url || dados.site.logo_url || undefined

  return (
    <>
      <Helmet>
        <title>{titulo}</title>
        {descricao && <meta name="description" content={descricao} />}
        {dados.site.favicon_url && <link rel="icon" href={dados.site.favicon_url} />}

        <meta property="og:type" content="website" />
        <meta property="og:title" content={titulo} />
        {descricao && <meta property="og:description" content={descricao} />}
        {imagem && <meta property="og:image" content={imagem} />}
        <meta name="twitter:card" content="summary_large_image" />

        {dados.site.ga4_id && (
          <script
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${dados.site.ga4_id}';document.head.appendChild(s);})();window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${dados.site.ga4_id}');`,
            }}
          />
        )}
        {dados.site.meta_pixel_id && (
          <script
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${dados.site.meta_pixel_id}');fbq('track','PageView');`,
            }}
          />
        )}

        <script type="application/ld+json">{JSON.stringify(autoDealerJsonLd(dados))}</script>
      </Helmet>
      <Routes>
        <Route path="/" element={<Home dados={dados} />} />
        <Route path="/estoque" element={<Estoque dados={dados} />} />
        <Route path="/sobre" element={<Sobre dados={dados} />} />
        <Route path="/financiamento" element={<Financiamento dados={dados} />} />
        <Route path="/contato" element={<Contato dados={dados} />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Routes>
    </>
  )
}
