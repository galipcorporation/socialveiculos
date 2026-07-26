// Validações client-side espelhando o backend (apps/api/schemas.py) e o gestor
// (apps/gestor/src/lib/mascaras.ts). Erro na tela é mais barato que 422 da API.

/** Valida CPF (11 dígitos + dígitos verificadores). */
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

/** Mesmo formato aceito pelo backend: algo@algo.algo, sem espaços. */
export function validarEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((val || '').trim())
}

/**
 * Converte "DD/MM/AAAA" (máscara da tela) para ISO, que é o que a API espera.
 * Retorna undefined se a data estiver incompleta ou não existir no calendário.
 */
export function dataBRparaISO(val: string): string | undefined {
  const digits = (val || '').replace(/\D/g, '')
  if (digits.length !== 8) return undefined
  const dia = parseInt(digits.slice(0, 2), 10)
  const mes = parseInt(digits.slice(2, 4), 10)
  const ano = parseInt(digits.slice(4), 10)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  // Rejeita 31/02 e afins, que o Date "corrige" silenciosamente.
  if (d.getUTCDate() !== dia || d.getUTCMonth() !== mes - 1 || d.getUTCFullYear() !== ano) {
    return undefined
  }
  return d.toISOString()
}

/** ISO → "DD/MM/AAAA" para preencher o campo mascarado ao editar. */
export function isoParaDataBR(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}
