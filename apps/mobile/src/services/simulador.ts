// Simulador de crédito (M057) — mock. Espelha /simulador do gestor: seleção de
// bancos + dados cliente/veículo → resultados por banco. A automação real usa
// extensão Chrome (desktop-only) — aqui os resultados são calculados/fictícios.

import { delay } from './db'

export interface BancoSim {
  codigo: string
  nome: string
  tier: 'free' | 'paid'
  taxaBase: number // % a.m. de referência
}

export const BANCOS_SIM: BancoSim[] = [
  { codigo: 'bv', nome: 'Banco BV', tier: 'free', taxaBase: 1.89 },
  { codigo: 'c6', nome: 'C6 Bank', tier: 'free', taxaBase: 1.99 },
  { codigo: 'itau', nome: 'Itaú', tier: 'paid', taxaBase: 1.79 },
  { codigo: 'santander', nome: 'Santander', tier: 'paid', taxaBase: 2.09 },
]

export type StatusResultado = 'aprovado' | 'negado'

export interface ResultadoBanco {
  banco: string
  banco_nome: string
  status: StatusResultado
  taxa?: number
  prazo?: number
  parcela?: number
  total?: number
  erro?: string
}

export interface SimulacaoInput {
  bancos: string[]
  valor: number
  entrada: number
  parcelas: number
  cliente_nome: string
}

function pmtPrice(pv: number, i: number, n: number): number {
  if (i <= 0) return pv / n
  return (pv * i) / (1 - Math.pow(1 + i, -n))
}

export const simuladorService = {
  bancos(): BancoSim[] {
    return BANCOS_SIM
  },

  async simular(input: SimulacaoInput): Promise<ResultadoBanco[]> {
    await delay(700, 1400) // simula consulta em paralelo
    const financiado = Math.max(0, input.valor - input.entrada)
    return input.bancos.map((cod) => {
      const banco = BANCOS_SIM.find((b) => b.codigo === cod)
      const nome = banco?.nome ?? cod.toUpperCase()
      // Regra mock: nega quando financiado > 90% do valor (entrada muito baixa).
      const ltvAlto = input.entrada < input.valor * 0.1
      if (ltvAlto && cod === 'santander') {
        return { banco: cod, banco_nome: nome, status: 'negado', erro: 'Entrada abaixo da mínima exigida (10%).' }
      }
      // pequena variação por banco p/ parecer real
      const jitter = (cod.charCodeAt(0) % 5) * 0.03
      const taxa = (banco?.taxaBase ?? 1.99) + jitter
      const parcela = pmtPrice(financiado, taxa / 100, input.parcelas)
      return {
        banco: cod,
        banco_nome: nome,
        status: 'aprovado',
        taxa: Number(taxa.toFixed(2)),
        prazo: input.parcelas,
        parcela,
        total: parcela * input.parcelas,
      }
    })
  },
}
