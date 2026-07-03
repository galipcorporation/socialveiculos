import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { SearchSelect, type SearchSelectOption } from '../../components/SearchSelect'
import { Gem, FileText, Download, RefreshCw } from 'lucide-react'

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
}

function formatBRL(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function NotasFiscaisPage() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()

  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [notas, setNotas] = useState<NotaFiscalItem[]>([])
  const [loading, setLoading] = useState(true)

  const [contratoId, setContratoId] = useState('')
  const [contratoLabel, setContratoLabel] = useState('')
  const [contratosOpcoes, setContratosOpcoes] = useState<SearchSelectOption[]>([])
  const [emitindo, setEmitindo] = useState(false)

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
      useUIStore.getState().showError(message || 'Erro ao emitir NF-e.', details)
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
          <table className="stock-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Chave de acesso</th>
                <th>Documentos</th>
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
                  </td>
                  <td>{formatBRL(n.valor_total)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{n.chave_acesso || '—'}</td>
                  <td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
