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
  | 'assistente'
  | 'fiscal'
  | 'site'

export interface ModuloDef {
  key: ModuloKey
  label: string
}

export const MODULOS: ModuloDef[] = [
  { key: 'estoque', label: 'Estoque' },
  { key: 'crm', label: 'CRM Kanban' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'simulador', label: 'Simulador de Crédito' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'assistente', label: 'Assistente de IA' },
  { key: 'fiscal', label: 'Fiscal / NF-e' },
  { key: 'site', label: 'Meu Site' },
]

export const TODOS_MODULOS: ModuloKey[] = MODULOS.map((m) => m.key)

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
