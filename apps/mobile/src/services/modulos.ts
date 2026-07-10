// Gate de módulos pagos — /v1/assinaturas/modulos.
import { api } from '../lib/api'
import type { Modulo, ModuloStatus } from './types'

interface ModuloDTO {
  modulo: Modulo
  liberado: boolean
}

export const modulosService = {
  async todos(): Promise<ModuloStatus[]> {
    const data = await api.get<ModuloDTO[]>('/assinaturas/modulos')
    return data.map((m) => ({ modulo: m.modulo, liberado: m.liberado }))
  },

  async liberado(modulo: Modulo): Promise<boolean> {
    const todos = await this.todos()
    return todos.find((m) => m.modulo === modulo)?.liberado ?? false
  },
}
