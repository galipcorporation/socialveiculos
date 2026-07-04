/**
 * Dados pré-carregados para render imediato (sem flash de loading).
 * - No browser: lê de window.__SSG_DATA__ (injetado no HTML pelo prerender).
 * - No servidor (prerender): lê de globalThis.__SSG_DATA__ (setado por entry-server).
 */
export function getSSGData<T>(): T | null {
  const g = globalThis as unknown as { __SSG_DATA__?: T }
  return g.__SSG_DATA__ ?? null
}
