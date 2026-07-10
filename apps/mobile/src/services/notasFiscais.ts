// Notas Fiscais / NF-e — /v1/fiscal/notas. Emissão a partir de um contrato.
import { api } from '../lib/api'
import type { AmbienteFiscal, Contrato, NotaFiscal, StatusNota } from './types'

interface NotaDTO {
  id: string
  contrato_id?: string | null
  contrato_numero?: string | null
  tipo: string
  ambiente: string
  status: string
  numero?: number | null
  serie?: string | null
  chave_acesso?: string | null
  valor_total: number
  xml_url?: string | null
  danfe_pdf_url?: string | null
  motivo_rejeicao?: string | null
  emitida_em?: string | null
  justificativa_cancelamento?: string | null
  veiculo_nome?: string | null
  cliente_nome?: string | null
  cartas_correcao?: { id: string; sequencia: number; texto?: string; correcao?: string; created_at: string }[]
  created_at?: string
}

function mapNota(n: NotaDTO): NotaFiscal {
  return {
    id: n.id,
    numero: n.numero != null ? String(n.numero) : undefined,
    serie: n.serie ?? undefined,
    tipo: n.tipo === 'entrada' ? 'entrada' : 'saida',
    status: n.status as StatusNota,
    chave_acesso: n.chave_acesso ?? undefined,
    valor_total: n.valor_total,
    veiculo_nome: n.veiculo_nome ?? undefined,
    cliente_nome: n.cliente_nome ?? undefined,
    contrato_numero: n.contrato_numero ?? undefined,
    ambiente: (n.ambiente as AmbienteFiscal) ?? 'homologacao',
    motivo_rejeicao: n.motivo_rejeicao ?? undefined,
    justificativa_cancelamento: n.justificativa_cancelamento ?? undefined,
    danfe_pdf_url: n.danfe_pdf_url ?? undefined,
    xml_url: n.xml_url ?? undefined,
    cartas_correcao: (n.cartas_correcao ?? []).map((c) => ({
      id: c.id,
      sequencia: c.sequencia,
      texto: c.texto ?? c.correcao ?? '',
      created_at: c.created_at,
    })),
    emitida_em: n.emitida_em ?? undefined,
    created_at: n.created_at ?? n.emitida_em ?? new Date().toISOString(),
  }
}

export const notasFiscaisService = {
  async lista(): Promise<NotaFiscal[]> {
    const data = await api.get<NotaDTO[]>('/fiscal/notas')
    return data.map(mapNota).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async emitir(contrato: Contrato): Promise<NotaFiscal> {
    const n = await api.post<NotaDTO>('/fiscal/notas', { contrato_id: contrato.id })
    return mapNota(n)
  },

  async cancelar(id: string, justificativa: string): Promise<void> {
    await api.post(`/fiscal/notas/${id}/cancelar`, { justificativa })
  },

  async emitirCartaCorrecao(id: string, texto: string): Promise<void> {
    await api.post(`/fiscal/notas/${id}/carta-correcao`, { correcao: texto.trim() })
  },
}
