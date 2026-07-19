/**
 * Funções utilitárias de máscaras para inputs do SocialVeículos
 */

/**
 * Aplica máscara de Data: DD/MM/AAAA
 */
export function mascararData(val: string): string {
  const limpo = val.replace(/\D/g, '')
  return limpo
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
    .substring(0, 10)
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function mascararCPF(val: string): string {
  const limpo = val.replace(/\D/g, '').slice(0, 11)
  return limpo
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
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
 * Sanitiza campos de texto livre (trim, colapsa espaços, remove caracteres de
 * controle e zero-width). A defesa real contra injeção/"prompt vírus" é no
 * backend; o front só limita tamanho e remove caracteres invisíveis.
 */
export function sanitizarTexto(val: string, maxLen = 255): string {
  if (!val) return ''
  return val
    .trim()
    // eslint-disable-next-line no-control-regex -- remoção intencional de caracteres de controle
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .substring(0, maxLen)
}

/**
 * Valida CPF (11 dígitos + dígitos verificadores).
 */
export function validarCPF(val: string): boolean {
  const cpf = (val || '').replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calcDV = (base: string, pesoInicial: number): number => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (pesoInicial - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const dv1 = calcDV(cpf.slice(0, 9), 10)
  const dv2 = calcDV(cpf.slice(0, 10), 11)
  return dv1 === parseInt(cpf[9], 10) && dv2 === parseInt(cpf[10], 10)
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

/**
 * Lista das 27 UFs válidas (26 estados + DF).
 */
export const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO',
]

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
 * Aplica máscara de Moeda BRL (R$) em tempo real
 * Ex: "555" -> "5,55"
 * Ex: "5555" -> "55,55"
 * Ex: "55555" -> "555,55"
 * Ex: "555555" -> "5.555,55"
 */
export function mascararMoeda(val: string | number): string {
  if (val === undefined || val === null) return ''
  
  // Se for número, converter para string com duas casas
  const str = typeof val === 'number' 
    ? val.toFixed(2).replace('.', '') 
    : val.toString().replace(/\D/g, '')
    
  if (!str) return ''
  
  const centavos = parseInt(str, 10) / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(centavos)
}

/**
 * Converte string formatada de moeda de volta para número float
 * Ex: "1.500,55" -> 1500.55
 */
export function parseMoeda(val: string): number {
  if (!val) return 0
  const valorLimpo = val.replace(/\./g, '').replace(',', '.')
  return parseFloat(valorLimpo) || 0
}

/**
 * Aplica máscara de CEP: 00000-000
 */
export function mascararCEP(val: string): string {
  const limpo = val.replace(/\D/g, '')
  return limpo
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 9)
}

/**
 * Aplica máscara de RG: 00.000.000-0 ou 00.000.000-X
 */
export function mascararRG(val: string): string {
  if (!val) return ''
  const limpo = val.replace(/[^0-9Xx]/g, '').slice(0, 9)
  return limpo
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})([\dXdx])/, '$1.$2.$3-$4')
}

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
