/**
 * Decide se uma mídia é vídeo. A extensão da URL tem precedência sobre o campo
 * `tipo` — mídias gravadas antes da guarda de extensão no backend vieram com
 * "video" em foto, e um <video src="...jpg"> renderiza um player preto em 0:00
 * e falha em silêncio (o erro sai no evento `error` do elemento, não no
 * console). Mesma regra de apps/api/routers/midias.py.
 */
const EXT_VIDEO = /\.(mp4|mov|webm)$/i
const EXT_FOTO = /\.(jpe?g|png|webp)$/i

export function ehVideo(midia: { tipo?: string | null; url: string }): boolean {
  if (EXT_VIDEO.test(midia.url)) return true
  if (EXT_FOTO.test(midia.url)) return false
  return midia.tipo === 'video'
}
