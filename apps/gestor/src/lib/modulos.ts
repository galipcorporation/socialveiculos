// Definição canônica dos módulos cujo acesso o gestor pode liberar por vendedor.
// A `key` é o que é serializado em JSON no campo `modulos` (ex.: ["estoque","crm"])
// e deve bater com o que a navegação (Sidebar) e o guard de rotas (App) esperam.

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
  /** Rotas controladas por este módulo. */
  paths: string[]
}

export const MODULOS: ModuloDef[] = [
  { key: 'estoque', label: 'Estoque', paths: ['/estoque'] },
  { key: 'crm', label: 'CRM Kanban', paths: ['/crm'] },
  { key: 'financeiro', label: 'Financeiro', paths: ['/financeiro'] },
  { key: 'simulador', label: 'Simulador de Crédito', paths: ['/ferramentas/simulador'] },
  { key: 'contratos', label: 'Contratos', paths: ['/ferramentas/contratos'] },
  { key: 'marketing', label: 'Marketing', paths: ['/ferramentas/marketing'] },
  { key: 'assistente', label: 'Assistente de IA', paths: ['/assistente'] },
  { key: 'fiscal', label: 'Fiscal / NF-e', paths: ['/ferramentas/fiscal', '/ferramentas/notas-fiscais'] },
  { key: 'site', label: 'Meu Site', paths: ['/ferramentas/meu-site'] },
]

export const TODOS_MODULOS: ModuloKey[] = MODULOS.map((m) => m.key)

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
