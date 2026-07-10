// Simulador de crédito — POST /v1/simulador. A automação real roda no backend
// (extensão/robôs por banco); aqui apenas enviamos os dados e mapeamos o retorno.
import { api } from '../lib/api'

export interface BancoSim {
  codigo: string
  nome: string
  tier: 'free' | 'paid'
  taxaBase: number
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

interface ResultadoDTO {
  banco: string
  status: string
  taxa?: number | null
  prazo?: number | null
  parcela?: number | null
  total?: number | null
  erro?: string | null
}
interface SimulacaoRespDTO {
  resultados?: ResultadoDTO[]
}

function nomeBanco(cod: string): string {
  return BANCOS_SIM.find((b) => b.codigo === cod)?.nome ?? cod.toUpperCase()
}

export const simuladorService = {
  bancos(): BancoSim[] {
    return BANCOS_SIM
  },

  async simular(input: SimulacaoInput): Promise<ResultadoBanco[]> {
    const resp = await api.post<SimulacaoRespDTO>('/simulador', {
      bancos: input.bancos,
      entrada: input.entrada,
      prazo_desejado: input.parcelas,
      cliente_dados: { nome: input.cliente_nome },
      veiculo_dados: { valor: input.valor },
    })
    return (resp.resultados ?? []).map((r): ResultadoBanco => ({
      banco: r.banco,
      banco_nome: nomeBanco(r.banco),
      status: r.status === 'aprovado' ? 'aprovado' : 'negado',
      taxa: r.taxa ?? undefined,
      prazo: r.prazo ?? undefined,
      parcela: r.parcela ?? undefined,
      total: r.total ?? undefined,
      erro: r.erro ?? undefined,
    }))
  },
}
