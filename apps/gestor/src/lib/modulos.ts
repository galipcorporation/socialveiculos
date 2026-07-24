// Definição canônica dos módulos cujo acesso o gestor pode liberar por vendedor.
// A `key` é o que é serializado em JSON no campo `modulos` (ex.: ["estoque","crm"])
// e deve bater com o que a navegação (Sidebar) e o guard de rotas (App) esperam.
//
// As keys premium são as MESMAS do enum `Modulo` do backend (apps/api/modulos.py),
// porque o gestor só pode liberar a um vendedor o que o admin habilitou para a loja.

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
  /** Rotas controladas por este módulo. */
  paths: string[]
  /**
   * Módulo base: faz parte do núcleo do CRM e não é contratável por fora.
   * Sempre disponível para o gestor liberar, independente do que o admin habilitou.
   */
  base?: boolean
}

export const MODULOS: ModuloDef[] = [
  { key: 'estoque', label: 'Estoque', paths: ['/estoque'], base: true },
  { key: 'crm', label: 'CRM Kanban', paths: ['/crm'], base: true },
  { key: 'financeiro', label: 'Financeiro', paths: ['/financeiro'], base: true },
  { key: 'simulador', label: 'Simulador de Crédito', paths: ['/ferramentas/simulador'] },
  { key: 'contratos', label: 'Contratos', paths: ['/ferramentas/contratos'] },
  { key: 'marketing', label: 'Marketing', paths: ['/ferramentas/marketing'] },
  { key: 'assistente_ia', label: 'Assistente de IA', paths: ['/assistente'] },
  { key: 'fiscal', label: 'Fiscal / NF-e', paths: ['/ferramentas/fiscal', '/ferramentas/notas-fiscais'] },
  { key: 'site', label: 'Meu Site', paths: ['/ferramentas/meu-site'] },
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

/** Mapa rota -> módulo que a controla (apenas rotas restritas). */
export const PATH_TO_MODULO: Record<string, ModuloKey> = MODULOS.reduce((acc, m) => {
  m.paths.forEach((p) => {
    acc[p] = m.key
  })
  return acc
}, {} as Record<string, ModuloKey>)

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

/**
 * Retorna se o usuário pode acessar um módulo.
 * Gestor/admin têm acesso total; vendedor depende do array `modulos`.
 */
export function podeAcessarModulo(
  papel: string | undefined,
  modulos: ModuloKey[],
  key: ModuloKey,
): boolean {
  if (papel === 'gestor' || papel === 'admin_plataforma') return true
  if (papel === 'vendedor') return modulos.includes(key)
  return false
}
