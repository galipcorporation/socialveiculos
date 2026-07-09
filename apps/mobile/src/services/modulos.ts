// Gate de módulos pagos (mock) — espelha /assinaturas/modulos do gestor.
// Define quais módulos a loja demo tem liberados. Swap p/ API = trocar este mapa.

import { delay } from './db'
import type { Modulo, ModuloStatus } from './types'

const LIBERADOS: Record<Modulo, boolean> = {
  contratos: true,
  simulador: true,
  marketing: true,
  assistente: false, // demonstra o paywall no app
  fiscal: true,
  site: true,
}

export const modulosService = {
  async liberado(modulo: Modulo): Promise<boolean> {
    await delay(120, 260)
    return LIBERADOS[modulo] ?? false
  },

  async todos(): Promise<ModuloStatus[]> {
    await delay()
    return (Object.keys(LIBERADOS) as Modulo[]).map((m) => ({ modulo: m, liberado: LIBERADOS[m] }))
  },
}
