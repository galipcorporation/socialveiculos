/**
 * Funções utilitárias de máscara/validação para inputs do site público.
 * Mesmo algoritmo de apps/gestor/src/lib/mascaras.ts (mascararTelefone),
 * duplicado aqui porque site e gestor são apps separados sem pacote compartilhado.
 */

/**
 * Aplica máscara de Telefone brasileiro: (00) 00000-0000 ou (00) 0000-0000
 */
export function mascararTelefone(val: string): string {
  const limpo = val.replace(/\D/g, '')
  if (limpo.length <= 10) {
    return limpo
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
      .substring(0, 14)
  }
  return limpo
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2')
    .substring(0, 15)
}

/**
 * Valida telefone brasileiro: exige DDD (2 dígitos) + 8 ou 9 dígitos do número.
 */
export function validarTelefone(val: string): boolean {
  const limpo = (val || '').replace(/\D/g, '')
  return limpo.length === 10 || limpo.length === 11
}

/**
 * Validação simples de e-mail (não substitui verificação no backend).
 */
export function validarEmail(val: string): boolean {
  if (!val) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
}
