/**
 * Capitaliza as palavras de um nome ou lugar, deixando preposições comuns em minúsculas se estiverem no meio.
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

/**
 * Aplica máscara de Moeda BRL (R$) em tempo real (padrão do projeto — mesmo algoritmo de apps/gestor/src/lib/mascaras.ts).
 * Ex: "555" -> "5,55"
 * Ex: "5555" -> "55,55"
 * Ex: "555555" -> "5.555,55"
 */
export function mascararMoeda(val: string | number): string {
  if (val === undefined || val === null) return ''

  const str = typeof val === 'number'
    ? val.toFixed(2).replace('.', '')
    : val.toString().replace(/\D/g, '')

  if (!str) return ''

  const centavos = parseInt(str, 10) / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos)
}

/**
 * Converte string formatada de moeda de volta para número float.
 * Ex: "1.500,55" -> 1500.55
 */
export function parseMoeda(val: string): number {
  if (!val) return 0
  const valorLimpo = val.replace(/\./g, '').replace(',', '.')
  return parseFloat(valorLimpo) || 0
}

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00
 */
export function mascararCNPJ(val: string): string {
  const limpo = val.replace(/\D/g, '').slice(0, 14)
  return limpo
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/**
 * Valida CNPJ (14 dígitos + dígitos verificadores).
 */
export function validarCNPJ(val: string): boolean {
  const cnpj = (val || '').replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calcDV = (base: string): number => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * pesos[i]
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const dv1 = calcDV(cnpj.slice(0, 12))
  const dv2 = calcDV(cnpj.slice(0, 13))
  return dv1 === parseInt(cnpj[12], 10) && dv2 === parseInt(cnpj[13], 10)
}

