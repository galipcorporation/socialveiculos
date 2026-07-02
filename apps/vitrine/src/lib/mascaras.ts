/**
 * Funções utilitárias de máscaras para inputs do SocialVeículos (Vitrine)
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
 * Capitaliza as palavras de um nome, deixando preposições comuns em minúsculas se estiverem no meio.
 */
export function capitalizarNome(val: string): string {
  if (!val) return ''
  const preposicoes = ['de', 'di', 'do', 'da', 'dos', 'das', 'e', 'del', 'la', 'von', 'van']
  return val
    .split(/(\s+)/)
    .map((word, idx, arr) => {
      if (/^\s+$/.test(word)) return word
      const wordLower = word.toLowerCase()
      const isLast = idx === arr.length - 1
      if (preposicoes.includes(wordLower) && idx > 0 && !isLast) {
        return wordLower
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}
