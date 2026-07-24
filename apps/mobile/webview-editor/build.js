// Gera src/components/RichEditorHtml.ts a partir de webview-editor/src/*.
// Roda via `pnpm --filter mobile run build:editor` sempre que webview-editor/src mudar.
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const SRC_DIR = __dirname + '/src'
const OUT_TS = path.join(__dirname, '..', 'src', 'components', 'RichEditorHtml.ts')

async function main() {
  const result = await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'editor.ts')],
    bundle: true,
    write: false,
    minify: true,
    target: 'es2019',
    format: 'iife',
  })
  const js = result.outputFiles[0].text

  let html = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8')

  // O JS minificado do TipTap contém a string literal `<script src="./bundle.js">
  // </script>` no código de tratamento de colagem. Um replace direto casava com
  // ESSA ocorrência (ela vem antes da tag real no HTML montado) e cortava o
  // bundle no meio → SyntaxError e editor nunca inicializava. Usamos um
  // marcador improvável e uma função de replace (que não interpreta `$&` etc).
  const MARCADOR = '<script src="./bundle.js"></script>'
  const partes = html.split(MARCADOR)
  if (partes.length !== 2) {
    throw new Error(`index.html deve conter exatamente 1 "${MARCADOR}" (achou ${partes.length - 1})`)
  }
  // `</script>` dentro do JS também encerraria a tag antes da hora.
  const jsSeguro = js.replace(/<\/script>/gi, '<\\/script>')
  html = `${partes[0]}<script>${jsSeguro}</script>${partes[1]}`

  const ts = `// GERADO por webview-editor/build.js — não editar à mão.
// Fonte: apps/mobile/webview-editor/src/{editor.ts,index.html}
// Para atualizar: edite a fonte e rode \`pnpm --filter mobile run build:editor\`.
export const RICH_EDITOR_HTML = ${JSON.stringify(html)}
`
  fs.writeFileSync(OUT_TS, ts, 'utf8')
  console.log(`OK: ${OUT_TS} (${(js.length / 1024).toFixed(1)} kB de JS embutido)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
