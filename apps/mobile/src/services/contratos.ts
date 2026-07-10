// Contratos (M051) — mock. Espelha /contratos do gestor (lista + detalhe + PDF).
// Estado em memória de sessão; swap p/ API = reimplementar mantendo assinaturas.

import { delay, novoId } from './db'
import type { Contrato, StatusContrato } from './types'

export interface ContratoInput {
  tipo: 'compra_venda' | 'compra'
  veiculo_nome?: string
  cliente_nome?: string
  valor_venda?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
}

const now = Date.now()
const diasAtras = (d: number) => new Date(now - d * 86_400_000).toISOString()

let contratos: Contrato[] = [
  { id: 'ctr-001', numero: 'CV-2026-0042', tipo: 'compra_venda', status: 'assinado', veiculo_nome: 'Hyundai HB20 Comfort Plus', cliente_nome: 'Luiz Henrique Ramos', valor_venda: 68500, valor_entrada: 20000, parcelas: 36, created_at: diasAtras(3) },
  { id: 'ctr-002', numero: 'CV-2026-0041', tipo: 'compra_venda', status: 'aguardando', veiculo_nome: 'Jeep Compass Longitude', cliente_nome: 'Juliana Ferreira', valor_venda: 137500, valor_entrada: 40000, parcelas: 48, created_at: diasAtras(1) },
  { id: 'ctr-003', numero: 'CV-2026-0040', tipo: 'compra_venda', status: 'assinado', veiculo_nome: 'VW Nivus Highline', cliente_nome: 'André Oliveira', valor_venda: 108500, valor_entrada: 108500, parcelas: 0, created_at: diasAtras(15) },
  { id: 'ctr-004', numero: 'CV-2026-0039', tipo: 'compra_venda', status: 'rascunho', veiculo_nome: 'Chevrolet Onix Premier', cliente_nome: 'Vanessa Pereira', valor_venda: 81200, created_at: diasAtras(0) },
  { id: 'ctr-005', numero: 'CO-2026-0011', tipo: 'compra', status: 'assinado', veiculo_nome: 'Fiat Mobi Like', cliente_nome: 'Repasse — AutoCenter Canoas', valor_venda: 48000, created_at: diasAtras(28) },
]

export const contratosService = {
  async lista(): Promise<Contrato[]> {
    await delay()
    return [...contratos].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async detalhe(id: string): Promise<Contrato | undefined> {
    await delay(120, 260)
    return contratos.find((c) => c.id === id)
  },

  // URL fictícia do PDF (o app real retornaria /contratos/{id}/pdf autenticado).
  async pdfUrl(id: string): Promise<string> {
    await delay(150, 300)
    return `https://demo.socialveiculos.com.br/contratos/${id}.pdf`
  },

  async criar(input: ContratoInput): Promise<Contrato> {
    await delay(250, 500)
    const seq = String(43 + contratos.length).padStart(4, '0')
    const prefixo = input.tipo === 'compra' ? 'CO' : 'CV'
    const novo: Contrato = {
      id: novoId('ctr'),
      numero: `${prefixo}-${new Date().getFullYear()}-${seq}`,
      tipo: input.tipo,
      status: 'aguardando',
      veiculo_nome: input.veiculo_nome,
      cliente_nome: input.cliente_nome,
      valor_venda: input.valor_venda,
      valor_entrada: input.valor_entrada,
      parcelas: input.parcelas,
      observacoes: input.observacoes,
      created_at: new Date().toISOString(),
    }
    contratos = [novo, ...contratos]
    return novo
  },

  async alterarStatus(id: string, status: StatusContrato): Promise<Contrato> {
    await delay(150, 300)
    const c = contratos.find((x) => x.id === id)
    if (!c) throw new Error('Contrato não encontrado.')
    c.status = status
    return c
  },
}
