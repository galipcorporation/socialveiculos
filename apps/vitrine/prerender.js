/**
 * Prerender SEO da vitrine.
 * Roda após `vite build` (dist/) e `vite build --ssr` (dist-server/).
 * 1. Busca o sitemap da API (carros + lojas publicados).
 * 2. Renderiza /carro/:id e /loja/:slug no servidor (entry-server).
 * 3. Injeta <head> (Helmet) + HTML + __SSG_DATA__ no template e grava estático.
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

function buildHtml(url, head, appHtml, ssgData) {
  return template
    // Remove title/description default do template (substituídos pelos do Helmet).
    .replace(/<title>.*?<\/title>\s*/is, '')
    .replace(/<meta name="description"[^>]*>\s*/is, '')
    .replace('</head>', `  ${head}\n  <script>window.__SSG_DATA__=${JSON.stringify(ssgData)}</script>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
}

function writePage(routePath, html) {
  const out = resolve(dist, `.${routePath}`, 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
}

const sitemap = await getJSON('/v1/marketplace/sitemap')
if (!sitemap) {
  console.warn('[prerender] API offline — pulando rotas dinâmicas (só SPA shell).')
  process.exit(0)
}

let count = 0

for (const id of sitemap.car_ids ?? []) {
  const veiculo = await getJSON(`/v1/vitrine/veiculos/${id}`)
  if (!veiculo) continue
  const { html, head } = render(`/carro/${id}`, veiculo)
  writePage(`/carro/${id}`, buildHtml(`/carro/${id}`, head, html, veiculo))
  count++
}

for (const slug of sitemap.store_slugs ?? []) {
  const loja = await getJSON(`/v1/marketplace/loja/${slug}`)
  if (!loja) continue
  const { html, head } = render(`/loja/${slug}`, loja)
  writePage(`/loja/${slug}`, buildHtml(`/loja/${slug}`, head, html, loja))
  count++
}

console.log(`[prerender] ${count} página(s) estática(s) gerada(s) com SEO.`)
