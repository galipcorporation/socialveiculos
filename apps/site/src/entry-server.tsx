import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'

/**
 * Renderiza uma rota no servidor (prerender) para um host (loja) específico.
 * Mesma técnica de extração de <head> usada na vitrine (apps/vitrine/src/entry-server.tsx).
 */
export function render(url: string, host: string, ssgData?: unknown) {
  ;(globalThis as { __SSG_DATA__?: unknown; __SITE_HOST__?: string }).__SSG_DATA__ = ssgData
  ;(globalThis as { __SITE_HOST__?: string }).__SITE_HOST__ = host

  const rendered = renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  )
  delete (globalThis as { __SSG_DATA__?: unknown }).__SSG_DATA__
  delete (globalThis as { __SITE_HOST__?: string }).__SITE_HOST__

  const headTags: string[] = []
  const html = rendered
    .replace(/<title[^>]*>.*?<\/title>/gis, (m) => {
      headTags.push(m)
      return ''
    })
    .replace(/<meta\b[^>]*\/?>(?:<\/meta>)?/gis, (m) => {
      if (/name="(description|twitter)|property="og:/i.test(m)) {
        headTags.push(m)
        return ''
      }
      return m
    })
    .replace(/<link rel="icon"[^>]*\/?>/gis, (m) => {
      headTags.push(m)
      return ''
    })
    // Scripts do Helmet (GA4, Meta Pixel, JSON-LD) — todos os que este app declara
    // via <Helmet><script>...</script></Helmet> em App.tsx acabam soltos no início
    // do body renderizado; movê-los para o <head> do HTML estático.
    .replace(/<script(?:(?!<\/script>).)*?(?:googletagmanager|gtag\(|fbq\(|application\/ld\+json)(?:(?!<\/script>).)*?<\/script>/gis, (m) => {
      headTags.push(m)
      return ''
    })

  return { html, head: headTags.join('\n    ') }
}
