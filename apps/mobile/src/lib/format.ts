// Formatação pt-BR — sem depender de Intl completo no Hermes usar toLocaleString com fallback manual.

export function formatBRL(v?: number | null): string {
  if (v == null) return '—'
  try {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${formatNumber(v, 2)}`
  }
}

export function formatBRLCompact(v?: number | null): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`
  return formatBRL(v)
}

export function formatNumber(v?: number | null, decimals = 0): string {
  if (v == null) return '—'
  const fixed = v.toFixed(decimals)
  const [int, dec] = fixed.split('.')
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec ? `${withDots},${dec}` : withDots
}

export function formatKm(km?: number | null): string {
  if (km == null) return '—'
  return `${formatNumber(km)} km`
}

export function formatData(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatHora(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDataHora(iso?: string | null): string {
  if (!iso) return '—'
  return `${formatData(iso)} ${formatHora(iso)}`
}

/** "há 5 min", "há 2 h", "ontem", "12/05" — para feeds e chat */
export function formatRelativo(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

export function iniciais(nome?: string | null): string {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

export function formatTelefone(v?: string | null): string {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

export function formatPlaca(v?: string | null): string {
  if (!v) return '—'
  const clean = v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length === 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`
  return clean
}

/** Máscara progressiva de moeda para inputs: digita centavos ("12345" → "123,45") */
export function maskMoedaInput(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (!d) return ''
  const n = parseInt(d, 10) / 100
  return formatNumber(n, 2)
}

export function parseMoedaInput(masked: string): number {
  const d = masked.replace(/\D/g, '')
  if (!d) return 0
  return parseInt(d, 10) / 100
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
