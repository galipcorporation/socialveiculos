/**
 * Prerender SEO do site white-label (apps/site).
 * Roda após `vite build` (dist/) e `vite build --ssr` (dist-server/).
 * 1. Busca a lista de hosts publicados na API.
 * 2. Para cada host, resolve a config + renderiza /, /estoque, /financiamento, /contato
 *    (e /sobre quando a loja tiver descrição) no servidor.
 * 3. Grava um dist/<host>/... por host (mesmo output usado por reverse-proxy por Host header).
 *
 * Sem API no ar (offline): gera só a SPA shell — não falha o build.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API = process.env.PRERENDER_API_URL || 'http://localhost:8000'
const dist = resolve(__dirname, 'dist')

const template = readFileSync(resolve(dist, 'index.html'), 'utf-8')
const { render } = await import(pathToFileURL(resolve(__dirname, 'dist-server/entry-server.js')).href)

async function getJSON(path) {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function buildHtml(head, appHtml, ssgData) {
  return template
    .replace(/<title>.*?<\/title>\s*/is, '')
    .replace(/<meta name="description"[^>]*>\s*/is, '')
    .replace('</head>', `  ${head}\n  <script>window.__SSG_DATA__=${JSON.stringify(ssgData)}</script>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
}

function writePage(host, routePath, html) {
  const out = resolve(dist, '_hosts', host, routePath === '/' ? '' : routePath.slice(1), 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
}

// Emite arquivos "crus" (sitemap.xml / robots.txt) na raiz do host, no mesmo
// output servido pelo reverse-proxy por Host header. Sem isso os endpoints de
// SEO ficam só sob a API (/v1/public/site/...), fora do caminho que os
// crawlers buscam (https://<host>/sitemap.xml e /robots.txt) → não indexam.
function writeRaw(host, filename, content) {
  const out = resolve(dist, '_hosts', host, filename)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, content)
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSitemap(host, rotas) {
  const base = `https://${host}`
  const now = new Date().toISOString().slice(0, 10)
  const itens = rotas
    .map((r) => `<url><loc>${xmlEscape(base + r)}</loc><lastmod>${now}</lastmod></url>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${itens}</urlset>`
}

function buildRobots(host) {
  return `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`
}

const sitemap = await getJSON('/v1/public/site/_sitemap/hosts')
if (!sitemap) {
  console.warn('[prerender] API offline — pulando geração por host (só SPA shell).')
  process.exit(0)
}

let count = 0

for (const host of sitemap.hosts ?? []) {
  const dados = await getJSON(`/v1/public/site/${host}`)
  if (!dados) continue

  const rotas = ['/', '/estoque', '/financiamento', '/contato']
  if (dados.site?.sobre_texto) rotas.push('/sobre')

  for (const rota of rotas) {
    const { html, head } = render(rota, host, dados)
    writePage(host, rota, buildHtml(head, html, dados))
  }

  // SEO técnico por host: sitemap.xml + robots.txt estáticos na raiz do host,
  // alinhados exatamente às páginas realmente prerenderizadas acima.
  writeRaw(host, 'sitemap.xml', buildSitemap(host, rotas))
  writeRaw(host, 'robots.txt', buildRobots(host))

  count++
}

console.log(`[prerender] ${count} site(s) gerado(s) com SEO.`)
