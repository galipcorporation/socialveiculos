// Notas Fiscais / NF-e (M052) — mock. Espelha /fiscal/notas do gestor.
// Emissão assíncrona simulada (processando → autorizada). Gate via modulosService.

import { delay, novoId } from './db'
import type { Contrato, NotaFiscal } from './types'

const now = Date.now()
const diasAtras = (d: number) => new Date(now - d * 86_400_000).toISOString()

const chaveFake = () =>
  Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join('')

let notas: NotaFiscal[] = [
  { id: 'nf-001', numero: '128', serie: '1', tipo: 'saida', status: 'autorizada', chave_acesso: chaveFake(), valor_total: 68500, veiculo_nome: 'Hyundai HB20 Comfort Plus', cliente_nome: 'Luiz Henrique Ramos', contrato_numero: 'CV-2026-0042', ambiente: 'homologacao', emitida_em: diasAtras(3), created_at: diasAtras(3) },
  { id: 'nf-002', numero: '127', serie: '1', tipo: 'saida', status: 'autorizada', chave_acesso: chaveFake(), valor_total: 108500, veiculo_nome: 'VW Nivus Highline', cliente_nome: 'André Oliveira', contrato_numero: 'CV-2026-0040', ambiente: 'homologacao', emitida_em: diasAtras(15), created_at: diasAtras(15) },
  { id: 'nf-003', numero: '126', serie: '1', tipo: 'saida', status: 'cancelada', chave_acesso: chaveFake(), valor_total: 81200, veiculo_nome: 'Chevrolet Onix Premier', cliente_nome: 'Vanessa Pereira', contrato_numero: 'CV-2026-0038', ambiente: 'homologacao', justificativa_cancelamento: 'Cliente desistiu da compra após a emissão.', emitida_em: diasAtras(30), created_at: diasAtras(30) },
]

export const notasFiscaisService = {
  async lista(): Promise<NotaFiscal[]> {
    await delay()
    return [...notas].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  // Emite a partir de um contrato — cria em "processando" e autoriza após um tempo.
  async emitir(contrato: Contrato): Promise<NotaFiscal> {
    await delay(400, 800)
    const nova: NotaFiscal = {
      id: novoId('nf'),
      tipo: 'saida',
      status: 'processando',
      valor_total: contrato.valor_venda ?? 0,
      veiculo_nome: contrato.veiculo_nome,
      cliente_nome: contrato.cliente_nome,
      contrato_numero: contrato.numero,
      ambiente: 'homologacao',
      created_at: new Date().toISOString(),
    }
    notas = [nova, ...notas]
    // Autorização assíncrona simulada.
    setTimeout(() => {
      const n = notas.find((x) => x.id === nova.id)
      if (n && n.status === 'processando') {
        n.status = 'autorizada'
        n.chave_acesso = chaveFake()
        n.numero = String(129 + Math.floor(Math.random() * 50))
        n.serie = '1'
        n.emitida_em = new Date().toISOString()
      }
    }, 2500)
    return nova
  },

  async cancelar(id: string, justificativa: string): Promise<void> {
    await delay(300, 600)
    const n = notas.find((x) => x.id === id)
    if (n) {
      n.status = 'cancelada'
      n.justificativa_cancelamento = justificativa
    }
  },
}
