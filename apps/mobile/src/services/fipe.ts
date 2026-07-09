// FIPE mock (M054) — cascata marca → modelo → ano → valor.
// Espelha os endpoints /veiculos/fipe/* do gestor. Catálogo estático reduzido;
// swap p/ API real = reimplementar este service mantendo as assinaturas.

import { delay } from './db'
import type { FipeItem, FipeResultado } from './types'

type TipoFipe = 'carro' | 'moto' | 'caminhao'

interface ModeloDef { nome: string; base: number }
interface MarcaDef { nome: string; modelos: ModeloDef[] }

const CATALOGO: Record<TipoFipe, MarcaDef[]> = {
  carro: [
    { nome: 'Toyota', modelos: [{ nome: 'Corolla', base: 135000 }, { nome: 'Corolla Cross', base: 150000 }, { nome: 'Hilux', base: 240000 }, { nome: 'Yaris', base: 95000 }] },
    { nome: 'Honda', modelos: [{ nome: 'Civic', base: 145000 }, { nome: 'HR-V', base: 140000 }, { nome: 'City', base: 110000 }] },
    { nome: 'Volkswagen', modelos: [{ nome: 'T-Cross', base: 120000 }, { nome: 'Nivus', base: 115000 }, { nome: 'Polo', base: 90000 }, { nome: 'Virtus', base: 105000 }] },
    { nome: 'Jeep', modelos: [{ nome: 'Compass', base: 145000 }, { nome: 'Renegade', base: 120000 }] },
    { nome: 'Hyundai', modelos: [{ nome: 'Creta', base: 130000 }, { nome: 'HB20', base: 75000 }] },
    { nome: 'Chevrolet', modelos: [{ nome: 'Onix', base: 82000 }, { nome: 'Tracker', base: 125000 }] },
    { nome: 'Fiat', modelos: [{ nome: 'Toro', base: 130000 }, { nome: 'Argo', base: 74000 }, { nome: 'Mobi', base: 55000 }] },
  ],
  moto: [
    { nome: 'Honda', modelos: [{ nome: 'CB 500F', base: 39000 }, { nome: 'CG 160', base: 16000 }, { nome: 'PCX', base: 22000 }] },
    { nome: 'Yamaha', modelos: [{ nome: 'MT-03', base: 32000 }, { nome: 'Fazer 250', base: 21000 }] },
    { nome: 'Kawasaki', modelos: [{ nome: 'Ninja 400', base: 38000 }] },
  ],
  caminhao: [
    { nome: 'Mercedes-Benz', modelos: [{ nome: 'Accelo 1016', base: 280000 }, { nome: 'Atego 1719', base: 380000 }] },
    { nome: 'Volkswagen', modelos: [{ nome: 'Delivery 11.180', base: 290000 }] },
    { nome: 'Volvo', modelos: [{ nome: 'FH 460', base: 720000 }] },
  ],
}

const ANOS: number[] = (() => {
  const max = new Date().getFullYear()
  const arr: number[] = []
  for (let y = max; y >= max - 12; y--) arr.push(y)
  return arr
})()

export const TIPOS_FIPE: { value: TipoFipe; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
]

export const fipeService = {
  async marcas(tipo: TipoFipe): Promise<FipeItem[]> {
    await delay(150, 320)
    return CATALOGO[tipo].map((m, i) => ({ codigo: String(i), nome: m.nome }))
  },

  async modelos(tipo: TipoFipe, marcaCod: string): Promise<FipeItem[]> {
    await delay(150, 320)
    const marca = CATALOGO[tipo][Number(marcaCod)]
    if (!marca) return []
    return marca.modelos.map((m, i) => ({ codigo: String(i), nome: m.nome }))
  },

  async anos(tipo: TipoFipe, _marcaCod: string, _modeloCod: string): Promise<FipeItem[]> {
    await delay(150, 320)
    return ANOS.map((a) => ({ codigo: String(a), nome: String(a) }))
  },

  async consultar(input: { tipo: TipoFipe; marcaCod: string; modeloCod: string; anoCod: string }): Promise<FipeResultado> {
    await delay(400, 800)
    const marca = CATALOGO[input.tipo][Number(input.marcaCod)]
    const modelo = marca?.modelos[Number(input.modeloCod)]
    if (!modelo) return { fipe: null, fipe_disponivel: false }
    const ano = Number(input.anoCod)
    const idade = Math.max(0, new Date().getFullYear() - ano)
    // Depreciação ~7% a.a. sobre a base do modelo (referência FIPE fictícia).
    const valor = Math.round((modelo.base * Math.pow(0.93, idade)) / 100) * 100
    return { fipe: valor, fipe_disponivel: true }
  },
}
