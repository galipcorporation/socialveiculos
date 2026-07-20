// FIPE — cascata marca → modelo → ano → valor contra /v1/veiculos/fipe/*.
import { api } from '../lib/api'
import type { FipeItem, FipeResultado } from './types'

type TipoFipe = 'carro' | 'moto' | 'caminhao'

export const TIPOS_FIPE: { value: TipoFipe; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
]

interface FipeItemDTO {
  codigo: string | number
  nome: string
}
interface FipeConsultaDTO {
  fipe?: number | null
  fipe_disponivel?: boolean
}

export const fipeService = {
  async marcas(tipo: TipoFipe): Promise<FipeItem[]> {
    const data = await api.get<FipeItemDTO[]>('/veiculos/fipe/marcas', { tipo })
    return data.map((m) => ({ codigo: String(m.codigo), nome: m.nome }))
  },

  async modelos(tipo: TipoFipe, marcaCod: string): Promise<FipeItem[]> {
    const data = await api.get<FipeItemDTO[]>(`/veiculos/fipe/marcas/${marcaCod}/modelos`, { tipo })
    return data.map((m) => ({ codigo: String(m.codigo), nome: m.nome }))
  },

  async anos(tipo: TipoFipe, marcaCod: string, modeloCod: string): Promise<FipeItem[]> {
    const data = await api.get<FipeItemDTO[]>(
      `/veiculos/fipe/marcas/${marcaCod}/modelos/${modeloCod}/anos`,
      { tipo },
    )
    return data.map((a) => ({ codigo: String(a.codigo), nome: a.nome }))
  },

  async consultar(input: { tipo: TipoFipe; marcaCod: string; modeloCod: string; anoCod: string }): Promise<FipeResultado> {
    const r = await api.post<FipeConsultaDTO>('/veiculos/fipe/consultar', {
      tipo: input.tipo,
      marca_codigo: input.marcaCod,
      modelo_codigo: input.modeloCod,
      ano_codigo: input.anoCod,
    })
    return { fipe: r.fipe ?? null, fipe_disponivel: r.fipe_disponivel ?? false }
  },
}
