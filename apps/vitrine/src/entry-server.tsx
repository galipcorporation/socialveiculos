import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'

/**
 * Renderiza uma rota no servidor (prerender).
 *
 * No React 19, as tags de <title>/<meta>/<script type="application/ld+json">
 * declaradas via <Helmet> são renderizadas inline no HTML. Este função extrai
 * essas tags do corpo e as devolve em `head`, para o prerender colocá-las no
 * <head> do documento estático (necessário p/ crawlers que não executam JS).
 */
export function render(url: string, ssgData?: unknown) {
  ;(globalThis as { __SSG_DATA__?: unknown }).__SSG_DATA__ = ssgData
  const rendered = renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  )
  delete (globalThis as { __SSG_DATA__?: unknown }).__SSG_DATA__

  const headTags: string[] = []
  // Extrai title, meta e script ld+json para o <head>.
  const html = rendered
    .replace(/<title[^>]*>.*?<\/title>/gis, (m) => {
      headTags.push(m)
      return ''
    })
    .replace(/<meta\b[^>]*\/?>(?:<\/meta>)?/gis, (m) => {
      // Preserva apenas metas "de SEO" (description/og/twitter); ignora charset/viewport.
      if (/name="(description|twitter)|property="og:/i.test(m)) {
        headTags.push(m)
        return ''
      }
      return m
    })
    .replace(/<script type="application\/ld\+json"[^>]*>.*?<\/script>/gis, (m) => {
      headTags.push(m)
      return ''
    })

  return { html, head: headTags.join('\n    ') }
}
