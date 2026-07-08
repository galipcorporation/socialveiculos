import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { SearchSelect, type SearchSelectOption } from '../../components/SearchSelect'
import { Gem, FileText, Download, RefreshCw, Ban, MessageSquarePlus, X } from 'lucide-react'

interface NotaFiscalItem {
  id: string
  contrato_id?: string
  tipo: string
  ambiente: string
  status: string
  numero: number
  serie: string
  chave_acesso?: string
  valor_total: number
  xml_url?: string
  danfe_pdf_url?: string
  motivo_rejeicao?: string
  emitida_em?: string
  justificativa_cancelamento?: string
  cancelada_em?: string
}

interface ContratoOpcao {
  id: string
  numero: string
  valor_venda?: number
  veiculo_nome?: string
  cliente_nome?: string
}

const STATUS_LABELS: Record<string, string> = {
  processando: 'Processando',
  processando_autorizacao: 'Processando',
  processando_cancelamento: 'Cancelando…',
  autorizada: 'Autorizada',
  rejeitada: 'Rejeitada',
  erro: 'Erro',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  autorizada: 'var(--sv-success)',
  rejeitada: 'var(--sv-error)',
  erro: 'var(--sv-error)',
  cancelada: 'var(--sv-text-muted)',
  processando_cancelamento: 'var(--sv-warning)',
}

function formatBRL(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function NotasFiscaisPage() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [notas, setNotas] = useState<NotaFiscalItem[]>([])
  const [loading, setLoading] = useState(true)

  const [contratoId, setContratoId] = useState('')
  const [contratoLabel, setContratoLabel] = useState('')
  const [contratosOpcoes, setContratosOpcoes] = useState<SearchSelectOption[]>([])
  const [emitindo, setEmitindo] = useState(false)

  const [notaCancelando, setNotaCancelando] = useState<NotaFiscalItem | null>(null)
  const [notaCce, setNotaCce] = useState<NotaFiscalItem | null>(null)

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const mod = res.find((m) => m.modulo === 'fiscal')
        setLiberado(mod ? mod.liberado : false)
      } catch {
        setLiberado(false)
      }
    }
    verificar()
  }, [])

  const carregarNotas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<NotaFiscalItem[]>('/fiscal/notas')
      setNotas(res)
    } catch (err) {
      console.warn('Erro ao carregar notas fiscais:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (liberado) carregarNotas()
    else setLoading(false)
  }, [liberado, carregarNotas])

  // Veio do botão "Emitir NF-e" do contrato (Contratos.tsx) — pré-seleciona o contrato
  useEffect(() => {
    const contratoParam = searchParams.get('contrato')
    if (!contratoParam || liberado !== true) return
    api.get<ContratoOpcao>(`/contratos/${contratoParam}`)
      .then((c) => {
        setContratoId(c.id)
        setContratoLabel(`${c.numero} — ${c.veiculo_nome || ''}`)
      })
      .catch(() => showToast('Contrato não encontrado.', 'error'))
      .finally(() => {
        searchParams.delete('contrato')
        setSearchParams(searchParams, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liberado])

  const buscarContratos = async (q: string) => {
    try {
      const res = await api.get<{ items: ContratoOpcao[] }>('/contratos', { per_page: '10', status: 'aguardando', q })
      setContratosOpcoes((res.items || []).map((c) => ({
        id: c.id,
        label: `${c.numero} — ${c.veiculo_nome || ''}`,
        sub: c.cliente_nome,
      })))
    } catch {
      setContratosOpcoes([])
    }
  }

  const handleEmitir = async () => {
    if (!contratoId) {
      showToast('Selecione o contrato da venda.', 'error')
      return
    }
    setEmitindo(true)
    try {
      await api.post('/fiscal/notas', { contrato_id: contratoId })
      showToast('NF-e enviada para emissão — acompanhe o status abaixo.', 'success')
      setContratoId('')
      setContratoLabel('')
      carregarNotas()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      if (message?.includes('Configure os dados fiscais')) {
        const ir = await useUIStore.getState().confirm({
          title: 'Configuração fiscal pendente',
          message: `${message} Deseja configurar agora?`,
          confirmText: 'Configurar agora',
          cancelText: 'Depois',
        })
        if (ir) navigate('/configuracoes', { state: { aba: 'fiscal' } })
      } else {
        useUIStore.getState().showError(message || 'Erro ao emitir NF-e.', details)
      }
    } finally {
      setEmitindo(false)
    }
  }

  if (liberado === false) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>Notas Fiscais</h2>
          <p>Histórico de NF-e emitidas pela loja.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
          <h3>Recurso Premium</h3>
          <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
            O módulo Fiscal não está ativo no seu plano.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ferramentas')}>
            Ver Módulos &amp; Assinatura
          </button>
        </div>
      </div>
    )
  }

  if (liberado === null) {
    return <div className="empty-state">Carregando…</div>
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Notas Fiscais</h2>
        <p>Emita NF-e de venda a partir de um contrato e acompanhe o status de autorização.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
          Emitir NF-e
        </h4>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <SearchSelect
              label="Contrato"
              placeholder="Buscar contrato aguardando…"
              value={contratoId}
              displayValue={contratoLabel}
              options={contratosOpcoes}
              onSearch={buscarContratos}
              onSelect={(id, label) => { setContratoId(id); setContratoLabel(label) }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleEmitir} disabled={emitindo || !contratoId}>
            {emitindo ? 'Emitindo…' : 'Emitir NF-e'}
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Histórico</h4>
          <button className="btn btn-outline" onClick={carregarNotas} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Carregando…</div>
        ) : notas.length === 0 ? (
          <div className="empty-state">Nenhuma NF-e emitida ainda.</div>
        ) : (
          <div className="table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Status</th>
                <th>Valor</th>
                <th className="col-secondary">Chave de acesso</th>
                <th className="col-secondary">Documentos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id}>
                  <td>{n.serie}/{n.numero}</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[n.status] || 'var(--sv-text-dim)', fontWeight: 600 }}>
                      {STATUS_LABELS[n.status] || n.status}
                    </span>
                    {n.motivo_rejeicao && (
                      <div style={{ fontSize: 12, color: 'var(--sv-error)' }}>{n.motivo_rejeicao}</div>
                    )}
                    {n.status === 'cancelada' && n.justificativa_cancelamento && (
                      <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>{n.justificativa_cancelamento}</div>
                    )}
                  </td>
                  <td>{formatBRL(n.valor_total)}</td>
                  <td className="col-secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{n.chave_acesso || '—'}</td>
                  <td className="col-secondary">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {n.danfe_pdf_url && (
                        <a href={n.danfe_pdf_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <FileText style={{ width: 14, height: 14 }} /> DANFE
                        </a>
                      )}
                      {n.xml_url && (
                        <a href={n.xml_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <Download style={{ width: 14, height: 14 }} /> XML
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    {n.status === 'autorizada' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                          onClick={() => setNotaCce(n)}
                          title="Emitir carta de correção"
                        >
                          <MessageSquarePlus style={{ width: 14, height: 14 }} /> CC-e
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sv-error)' }}
                          onClick={() => setNotaCancelando(n)}
                          title="Cancelar NF-e"
                        >
                          <Ban style={{ width: 14, height: 14 }} /> Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {notaCancelando && (
        <ModalCancelarNota
          nota={notaCancelando}
          onClose={() => setNotaCancelando(null)}
          onDone={() => { setNotaCancelando(null); carregarNotas() }}
        />
      )}
      {notaCce && (
        <ModalCartaCorrecao
          nota={notaCce}
          onClose={() => setNotaCce(null)}
          onDone={() => { setNotaCce(null); carregarNotas() }}
        />
      )}
    </div>
  )
}

function ModalCancelarNota({ nota, onClose, onDone }: { nota: NotaFiscalItem; onClose: () => void; onDone: () => void }) {
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/fiscal/notas/${nota.id}/cancelar`, { justificativa })
      showToast('Cancelamento solicitado — acompanhe o status na lista.', 'success')
      onDone()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao cancelar NF-e.', details)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Cancelar NF-e {nota.serie}/{nota.numero}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          <p style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
            O cancelamento é solicitado à SEFAZ e só é aceito dentro do prazo legal (tipicamente 24h após a autorização). Esta ação não pode ser desfeita.
          </p>
          <div className="form-group">
            <label>Justificativa (mín. 15 caracteres)</label>
            <textarea
              className="form-input"
              rows={3}
              minLength={15}
              maxLength={255}
              required
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: Venda desfeita por desistência do comprador."
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Voltar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || justificativa.length < 15} style={{ background: 'var(--sv-error)' }}>
              {loading ? <span className="spinner" /> : 'Confirmar Cancelamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalCartaCorrecao({ nota, onClose, onDone }: { nota: NotaFiscalItem; onClose: () => void; onDone: () => void }) {
  const [correcao, setCorrecao] = useState('')
  const [loading, setLoading] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/fiscal/notas/${nota.id}/carta-correcao`, { correcao })
      showToast('Carta de correção enviada.', 'success')
      onDone()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao emitir carta de correção.', details)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Carta de Correção — NF-e {nota.serie}/{nota.numero}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          <p style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
            Use a CC-e apenas para corrigir dado não-essencial (ex.: descrição, endereço). Valores, impostos, partes e datas não podem ser alterados por CC-e — nesses casos, cancele e emita novamente.
          </p>
          <div className="form-group">
            <label>Texto da correção (mín. 15 caracteres)</label>
            <textarea
              className="form-input"
              rows={4}
              minLength={15}
              maxLength={1000}
              required
              value={correcao}
              onChange={(e) => setCorrecao(e.target.value)}
              placeholder="Ex.: Correção da descrição do item para incluir a cor do veículo."
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || correcao.length < 15}>
              {loading ? <span className="spinner" /> : 'Enviar Correção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
