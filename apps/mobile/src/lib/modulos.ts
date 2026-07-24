// Definição canônica dos módulos cujo acesso o gestor pode liberar por vendedor.
// Espelha apps/gestor/src/lib/modulos.ts — a `key` é serializada em JSON no campo
// `modulos` (ex.: ["estoque","crm"]) e deve bater com o gestor web.

export type ModuloKey =
  | 'estoque'
  | 'crm'
  | 'financeiro'
  | 'simulador'
  | 'contratos'
  | 'marketing'
  | 'assistente_ia'
  | 'fiscal'
  | 'site'

export interface ModuloDef {
  key: ModuloKey
  label: string
  /** Módulo do núcleo do CRM: não é contratável por fora, sempre disponível. */
  base?: boolean
}

export const MODULOS: ModuloDef[] = [
  { key: 'estoque', label: 'Estoque', base: true },
  { key: 'crm', label: 'CRM Kanban', base: true },
  { key: 'financeiro', label: 'Financeiro', base: true },
  { key: 'simulador', label: 'Simulador de Crédito' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'assistente_ia', label: 'Assistente de IA' },
  { key: 'fiscal', label: 'Fiscal / NF-e' },
  { key: 'site', label: 'Meu Site' },
]

export const TODOS_MODULOS: ModuloKey[] = MODULOS.map((m) => m.key)

/** Módulos do núcleo — nunca dependem de contratação com o admin. */
export const MODULOS_BASE: ModuloKey[] = MODULOS.filter((m) => m.base).map((m) => m.key)

/**
 * Módulos que o gestor pode, de fato, liberar para um vendedor:
 * os do núcleo + os premium que o admin habilitou para esta loja.
 */
export function modulosDisponiveis(habilitadosNaLoja: string[]): ModuloKey[] {
  return TODOS_MODULOS.filter(
    (k) => MODULOS_BASE.includes(k) || habilitadosNaLoja.includes(k),
  )
}

/** Faz o parse do campo `modulos` (JSON array string) com tolerância a nulo/inválido. */
export function parseModulos(modulos?: string | null): ModuloKey[] {
  if (!modulos) return []
  try {
    const arr = JSON.parse(modulos)
    if (!Array.isArray(arr)) return []
    return arr.filter((k): k is ModuloKey => TODOS_MODULOS.includes(k as ModuloKey))
  } catch {
    return []
  }
}
