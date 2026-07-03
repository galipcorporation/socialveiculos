import { useState, useEffect, useCallback } from 'react'
import { api, extractErrorDetails } from '../lib/api'
import { useUIStore } from '../stores/uiStore'

/* ── Types ───────────────────────────────────────────────────── */

interface VeiculoResumo {
  id: string
  marca?: string
  modelo?: string
  ano_modelo?: number
  placa?: string
  foto?: string | null
}

interface CompradorResumo {
  id: string
  nome?: string
  telefone?: string
}

interface EsteiraResumoResponse {
  id: string
  estagio: 'contrato' | 'pagamento' | 'documentos' | 'transferencia' | 'concluido'
  origem?: string
  veiculo?: VeiculoResumo | null
  comprador?: CompradorResumo | null
  proximo_item?: string | null
  prazo_mais_proximo?: string | null
  tem_vencido: boolean
  total_itens: number
  concluidos: number
  aberta_em?: string | null
}

type StatusItem = 'pendente' | 'em_andamento' | 'concluido' | 'nao_aplicavel'
type CategoriaItem = 'contrato' | 'financeiro' | 'documento' | 'transferencia'

interface ItemChecklist {
  id: string
  chave: string
  titulo: string
  categoria: CategoriaItem
  responsavel: 'loja' | 'comprador'
  status: StatusItem
  obrigatorio: boolean
  prazo_em?: string | null
  doc_id?: string | null
  observacao?: string | null
  concluido_em?: string | null
  vencido: boolean
}

interface EsteiraDetalheResponse {
  id: string
  estagio: EsteiraResumoResponse['estagio']
  origem?: string
  veiculo?: VeiculoResumo | null
  comprador?: CompradorResumo | null
  contrato_id?: string | null
  vendedor_id?: string | null
  comunicacao_venda_em?: string | null
  transferencia_em?: string | null
  aberta_em?: string | null
  concluida_em?: string | null
  itens: ItemChecklist[]
  total_itens: number
  concluidos: number
  vencidos: number
}

const CATEGORIA_LABEL: Record<CategoriaItem, string> = {
  contrato: 'Contrato',
  financeiro: 'Pagamento',
  documento: 'Documentos',
  transferencia: 'Transferência',
}

interface EstagioDef {
  key: 'contrato' | 'pagamento' | 'documentos' | 'transferencia'
  label: string
  description: string
}

const ESTAGIOS: EstagioDef[] = [
  { key: 'contrato', label: 'Contrato', description: 'Assinatura e validação' },
  { key: 'pagamento', label: 'Pagamento', description: 'Confirmação e recibo' },
  { key: 'documentos', label: 'Documentos', description: 'Carteira do proprietário' },
  { key: 'transferencia', label: 'Transferência', description: 'DETRAN e finalização' },
]

export function PosVenda() {
  const [esteiras, setEsteiras] = useState<EsteiraResumoResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const showError = useUIStore((state) => state.showError)

  const carregarEsteiras = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<EsteiraResumoResponse[]>('/esteira')
      setEsteiras(data)
    } catch (err) {
      const { message } = extractErrorDetails(err)
      showError(message || 'Erro ao carregar esteira de pós-venda.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    carregarEsteiras()
  }, [carregarEsteiras])

  const formatData = (dateStr?: string | null) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // Agrupar itens por estágio
  const esteirasPorEstagio = {
    contrato: esteiras.filter((e) => e.estagio === 'contrato'),
    pagamento: esteiras.filter((e) => e.estagio === 'pagamento'),
    documentos: esteiras.filter((e) => e.estagio === 'documentos'),
    transferencia: esteiras.filter((e) => e.estagio === 'transferencia'),
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Estilos específicos locais adicionais para garantir layout responsivo Velocity Glass */}
      <style>{`
        .posvenda-board {
          display: grid;
          grid-template-columns: repeat(4, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 20px;
          align-items: start;
          overflow-x: auto;
          padding-bottom: 16px;
          min-height: calc(100vh - 200px);
        }

        .posvenda-column {
          background: var(--sv-surface-dim);
          border: 1px solid var(--sv-border);
          border-radius: var(--sv-radius-md);
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          max-height: 80vh;
        }

        .posvenda-column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          padding: 0 4px;
        }

        .posvenda-column-header h4 {
          font-size: 15px;
          font-weight: 700;
          color: var(--sv-text);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .posvenda-column-header span.count {
          background: var(--sv-overlay-strong);
          color: var(--sv-text-dim);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .posvenda-cards-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          flex: 1;
          padding: 4px;
        }

        .posvenda-card {
          background: var(--sv-surface);
          border: 1px solid var(--sv-border);
          border-radius: var(--sv-radius);
          padding: 12px;
          position: relative;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .posvenda-card:hover {
          transform: translateY(-2px);
          border-color: var(--sv-border-hover);
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        }

        .posvenda-card-img-wrapper {
          width: 100%;
          height: 120px;
          border-radius: var(--sv-radius-sm);
          overflow: hidden;
          background: var(--sv-surface-dim);
          border: 1px solid var(--sv-border);
          position: relative;
        }

        .posvenda-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .posvenda-card-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--sv-text-muted);
          font-size: 11px;
          gap: 6px;
          background: var(--sv-surface-dim);
        }

        .posvenda-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--sv-text);
          margin-top: 4px;
          line-height: 1.3;
        }

        .posvenda-card-info-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--sv-text-dim);
        }

        .posvenda-card-info-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .posvenda-card-progress {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .posvenda-progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--sv-text-muted);
          font-weight: 600;
        }

        .posvenda-progress-bar-bg {
          width: 100%;
          height: 6px;
          background: var(--sv-overlay);
          border-radius: 999px;
          overflow: hidden;
        }

        .posvenda-progress-bar-fill {
          height: 100%;
          background: var(--sv-primary);
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .posvenda-card-footer {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--sv-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .posvenda-card-date {
          font-size: 10px;
          color: var(--sv-text-muted);
        }

        .posvenda-chip-vencido {
          background: color-mix(in srgb, var(--sv-error) 12%, transparent);
          color: var(--sv-error);
          border: 1px solid color-mix(in srgb, var(--sv-error) 30%, transparent);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        @media (max-width: 1200px) {
          .posvenda-board {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .posvenda-board {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page-header">
        <h2>Esteira Pós-venda</h2>
        <p>Acompanhe e gerencie as etapas posteriores à venda dos veículos da sua loja.</p>
      </div>

      {loading && esteiras.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--sv-text-dim)' }}>Buscando dados da esteira...</p>
        </div>
      ) : esteiras.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px 20px' }}>
          <div className="empty-icon" style={{ fontSize: '48px', color: 'var(--sv-text-muted)' }}>📋</div>
          <h3 style={{ marginTop: 16, color: 'var(--sv-text)' }}>Nenhum veículo em pós-venda</h3>
          <p style={{ marginTop: 8, color: 'var(--sv-text-dim)', maxWidth: 400 }}>
            Quando você registrar a venda de um veículo no estoque, a esteira pós-venda correspondente será gerada automaticamente aqui.
          </p>
        </div>
      ) : (
        <div className="posvenda-board">
          {ESTAGIOS.map((col) => {
            const list = esteirasPorEstagio[col.key] || []
            return (
              <div key={col.key} className="posvenda-column">
                <div className="posvenda-column-header">
                  <h4>
                    <span>{col.label}</span>
                  </h4>
                  <span className="count">{list.length}</span>
                </div>

                <div className="posvenda-cards-container">
                  {list.map((esteira) => {
                    const progressPercent = esteira.total_itens > 0 
                      ? Math.round((esteira.concluidos / esteira.total_itens) * 100)
                      : 0

                    return (
                      <div
                        key={esteira.id}
                        className="posvenda-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedId(esteira.id)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') setSelectedId(esteira.id) }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Foto do Veículo */}
                        <div className="posvenda-card-img-wrapper">
                          {esteira.veiculo?.foto ? (
                            <img
                              src={esteira.veiculo.foto}
                              alt={`${esteira.veiculo.marca} ${esteira.veiculo.modelo}`}
                              className="posvenda-card-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="posvenda-card-placeholder">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32 }}>
                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2" />
                                <circle cx="7" cy="17" r="2" />
                                <path d="M9 17h6" />
                                <circle cx="17" cy="17" r="2" />
                              </svg>
                              <span>Sem foto</span>
                            </div>
                          )}
                        </div>

                        {/* Detalhes do Veículo */}
                        <div className="posvenda-card-title">
                          {esteira.veiculo 
                            ? `${esteira.veiculo.marca} ${esteira.veiculo.modelo} ${esteira.veiculo.ano_modelo || ''}`
                            : 'Veículo não identificado'}
                        </div>

                        {/* Informações da Venda */}
                        <div className="posvenda-card-info-row">
                          {esteira.veiculo?.placa && (
                            <div className="posvenda-card-info-item">
                              <span style={{ fontWeight: 600 }}>Placa:</span>
                              <span style={{ fontFamily: 'monospace' }}>{esteira.veiculo.placa.toUpperCase()}</span>
                            </div>
                          )}
                          <div className="posvenda-card-info-item">
                            <span style={{ fontWeight: 600 }}>Comprador:</span>
                            <span>{esteira.comprador?.nome || 'Não informado'}</span>
                          </div>
                          
                          {/* Próximo Passo */}
                          {esteira.proximo_item ? (
                            <div className="posvenda-card-info-item" style={{ marginTop: 4 }}>
                              <span style={{ fontWeight: 600, color: 'var(--sv-primary-text)' }}>Próximo:</span>
                              <span style={{ color: 'var(--sv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={esteira.proximo_item}>
                                {esteira.proximo_item}
                              </span>
                            </div>
                          ) : (
                            <div className="posvenda-card-info-item" style={{ marginTop: 4, color: 'var(--sv-success)' }}>
                              <span>✓ Todos os itens concluídos</span>
                            </div>
                          )}
                        </div>

                        {/* Barra de Progresso do Checklist */}
                        <div className="posvenda-card-progress">
                          <div className="posvenda-progress-header">
                            <span>Checklist</span>
                            <span>{esteira.concluidos}/{esteira.total_itens} ({progressPercent}%)</span>
                          </div>
                          <div className="posvenda-progress-bar-bg">
                            <div 
                              className="posvenda-progress-bar-fill"
                              style={{ 
                                width: `${progressPercent}%`,
                                backgroundColor: progressPercent === 100 ? 'var(--sv-success)' : 'var(--sv-primary)'
                              }}
                            />
                          </div>
                        </div>

                        {/* Footer do Card */}
                        <div className="posvenda-card-footer">
                          <div className="posvenda-card-date">
                            Aberto em: {formatData(esteira.aberta_em)}
                          </div>
                          
                          {/* Badge de Atraso */}
                          {esteira.tem_vencido && (
                            <div className="posvenda-chip-vencido">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <span>Atrasado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedId && (
        <EsteiraDetalheModal
          esteiraId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={carregarEsteiras}
        />
      )}
    </div>
  )
}

/* ── Modal de detalhe / checklist ────────────────────────────── */

const STATUS_LABEL: Record<StatusItem, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  nao_aplicavel: 'Não se aplica',
}

function EsteiraDetalheModal({
  esteiraId,
  onClose,
  onUpdated,
}: {
  esteiraId: string
  onClose: () => void
  onUpdated: () => void
}) {
  const [esteira, setEsteira] = useState<EsteiraDetalheResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState<string | null>(null)
  const [concluindo, setConcluindo] = useState(false)
  const [uploadItem, setUploadItem] = useState<string | null>(null)
  const showError = useUIStore((state) => state.showError)
  const showToast = useUIStore((state) => state.showToast)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<EsteiraDetalheResponse>(`/esteira/${esteiraId}`)
      setEsteira(data)
    } catch (err) {
      const { message } = extractErrorDetails(err)
      showError(message || 'Erro ao carregar detalhe da esteira.')
    } finally {
      setLoading(false)
    }
  }, [esteiraId, showError])

  useEffect(() => { carregar() }, [carregar])

  const formatData = (dateStr?: string | null) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const alternarStatus = async (item: ItemChecklist) => {
    if (!esteira) return
    const novoStatus: StatusItem = item.status === 'concluido' ? 'pendente' : 'concluido'
    setSavingItem(item.id)
    try {
      const atualizado = await api.patch<EsteiraDetalheResponse>(
        `/esteira/${esteira.id}/itens/${item.id}`,
        { status: novoStatus },
      )
      setEsteira(atualizado)
      onUpdated()
    } catch (err) {
      const { message } = extractErrorDetails(err)
      showError(message || 'Erro ao atualizar item.')
    } finally {
      setSavingItem(null)
    }
  }

  const enviarDocumento = async (item: ItemChecklist, file: File) => {
    if (!esteira?.veiculo?.id) return
    setUploadItem(item.id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo', 'nota_fiscal')
      fd.append('visivel_comprador', 'true')
      const doc = await api.post<{ id: string; url: string; nome: string }>(
        `/veiculos/${esteira.veiculo.id}/documentos/upload`,
        fd,
      )
      const atualizado = await api.post<EsteiraDetalheResponse>(
        `/esteira/${esteira.id}/documentos`,
        undefined,
        { params: { item_chave: item.chave, nome: doc.nome, url: doc.url } },
      )
      setEsteira(atualizado)
      onUpdated()
    } catch (err) {
      const { message } = extractErrorDetails(err)
      showError(message || 'Erro ao anexar documento.')
    } finally {
      setUploadItem(null)
    }
  }

  const concluir = async () => {
    if (!esteira) return
    setConcluindo(true)
    try {
      await api.post(`/esteira/${esteira.id}/concluir`)
      showToast('Esteira concluída — arquivada na Carteira do Proprietário.', 'success')
      onUpdated()
      onClose()
    } catch (err) {
      const { message } = extractErrorDetails(err)
      showError(message || 'Não foi possível concluir. Verifique os itens obrigatórios pendentes.')
    } finally {
      setConcluindo(false)
    }
  }

  const categorias: CategoriaItem[] = ['contrato', 'financeiro', 'documento', 'transferencia']
  const podeConcluir = esteira && !esteira.concluida_em && esteira.itens.every(
    (i) => !i.obrigatorio || i.status === 'concluido' || i.status === 'nao_aplicavel',
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {esteira?.veiculo
              ? `${esteira.veiculo.marca} ${esteira.veiculo.modelo} ${esteira.veiculo.ano_modelo || ''}`
              : 'Esteira Pós-venda'}
          </h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="spinner" />
            </div>
          ) : !esteira ? (
            <div style={{ textAlign: 'center', padding: 20 }}>Erro ao carregar detalhes.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: 'var(--sv-text-dim)' }}>
                <span><strong style={{ color: 'var(--sv-text)' }}>Comprador:</strong> {esteira.comprador?.nome || 'Não informado'}</span>
                <span><strong style={{ color: 'var(--sv-text)' }}>Placa:</strong> {esteira.veiculo?.placa?.toUpperCase() || '—'}</span>
                <span><strong style={{ color: 'var(--sv-text)' }}>Aberta em:</strong> {formatData(esteira.aberta_em)}</span>
              </div>

              {categorias.map((cat) => {
                const itensCat = esteira.itens.filter((i) => i.categoria === cat)
                if (itensCat.length === 0) return null
                return (
                  <div key={cat} style={{ marginBottom: 18 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--sv-text)', marginBottom: 8 }}>
                      {CATEGORIA_LABEL[cat]}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {itensCat.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 'var(--sv-radius)',
                            border: '1px solid var(--sv-border)',
                            background: item.vencido ? 'color-mix(in srgb, var(--sv-error) 8%, transparent)' : 'var(--sv-surface)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.status === 'concluido'}
                            disabled={savingItem === item.id || item.status === 'nao_aplicavel' || !!esteira.concluida_em}
                            onChange={() => alternarStatus(item)}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--sv-text)' }}>
                              {item.titulo}
                              {item.obrigatorio && <span style={{ color: 'var(--sv-error)' }}> *</span>}
                            </div>
                            {item.prazo_em && (
                              <div style={{ fontSize: 11, color: item.vencido ? 'var(--sv-error)' : 'var(--sv-text-muted)' }}>
                                Prazo: {formatData(item.prazo_em)}
                              </div>
                            )}
                          </div>
                          {item.categoria === 'documento' && item.status !== 'concluido' && !esteira.concluida_em && (
                            <label className="btn btn-glass" style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                              {uploadItem === item.id ? <span className="spinner" /> : 'Anexar'}
                              <input
                                type="file"
                                accept="application/pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) enviarDocumento(item, file)
                                }}
                              />
                            </label>
                          )}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              color: item.status === 'concluido' ? 'var(--sv-success)' : item.vencido ? 'var(--sv-error)' : 'var(--sv-text-dim)',
                              background: item.status === 'concluido'
                                ? 'color-mix(in srgb, var(--sv-success) 12%, transparent)'
                                : item.vencido
                                  ? 'color-mix(in srgb, var(--sv-error) 12%, transparent)'
                                  : 'var(--sv-overlay-strong)',
                            }}
                          >
                            {STATUS_LABEL[item.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
          {esteira && !esteira.concluida_em && (
            <button
              className="btn btn-primary"
              disabled={!podeConcluir || concluindo}
              title={!podeConcluir ? 'Conclua todos os itens obrigatórios antes de finalizar' : undefined}
              onClick={concluir}
            >
              {concluindo ? <span className="spinner" /> : 'Concluir esteira'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
