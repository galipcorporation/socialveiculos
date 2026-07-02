import { useState, useEffect, useCallback, useRef } from 'react'
import { api, extractErrorDetails, type ApiErrorDetails } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararCPF, mascararTelefone, mascararMoeda, parseMoeda, mascararCNPJ, mascararCEP, mascararRG, sanitizarTexto, validarCPF, validarCNPJ, UFS_VALIDAS, capitalizarNome } from '../lib/mascaras'
import { VeiculoModal } from './Estoque'
import { buscarCEP } from '../lib/cep'

/* ── Types ───────────────────────────────────────────────────── */

interface ClientSimples {
  id: string
  nome: string
  telefone?: string
}

interface Negociacao {
  id: string
  lead_id: string
  veiculo_id?: string
  valor_proposta?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
  created_at: string
  updated_at: string
}

interface Lead {
  id: string
  loja_id: string
  cliente_id: string
  veiculo_id?: string
  etapa: 'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido'
  origem: 'manual' | 'vitrine' | 'simulador' | 'whatsapp'
  valor_proposta?: number
  observacoes?: string
  cliente?: ClientSimples
  negociacoes?: Negociacao[]
  created_at: string
  updated_at: string
}

interface KanbanColumn {
  etapa: 'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido'
  total: number
  leads: Lead[]
}

interface KanbanBoardResponse {
  colunas: KanbanColumn[]
}

interface Cliente {
  id: string
  loja_id: string
  usuario_id?: string
  nome: string
  cpf?: string
  cnpj?: string
  rg?: string
  data_nascimento?: string
  telefone?: string
  email?: string
  renda_mensal?: number
  cep?: string
  endereco?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
  tags?: string
  created_at: string
  updated_at: string
}

interface Veiculo {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_modelo: number
  preco_venda?: number
}

/* ── Toast System ────────────────────────────────────────────── */

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; type: ToastType; message: string; details?: ApiErrorDetails }

let toastId = 0

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => onDismiss(t.id)}>
          <span>{t.message}</span>
          {t.details && (
            <details className="sv-toast-details" onClick={e => e.stopPropagation()}>
              <summary>Detalhes técnicos</summary>
              <ul>
                {t.details.status && <li><b>Código:</b> {t.details.status}</li>}
                {t.details.path && <li><b>Rota:</b> {t.details.path}</li>}
                {t.details.timestamp && <li><b>Horário:</b> {new Date(t.details.timestamp).toLocaleTimeString('pt-BR')}</li>}
                {t.details.requestId && <li><b>ID:</b> {t.details.requestId}</li>}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)

const KanbanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCurrency(value?: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ETAPA_LABELS: Record<string, string> = {
  lead: 'Lead Recebido',
  proposta: 'Proposta Enviada',
  negociacao: 'Em Negociação',
  fechamento: 'Fechamento',
  perdido: 'Perdido',
}

const ORIGEM_LABELS: Record<string, string> = {
  manual: 'Manual',
  vitrine: 'Vitrine',
  simulador: 'Simulador',
  whatsapp: 'WhatsApp',
}

/* ══════════════════════════════════════════════════════════════
   MAIN CRM COMPONENT
   ══════════════════════════════════════════════════════════════ */

export function CRM() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'clientes'>('kanban')
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, details?: ApiErrorDetails) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message, details }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), details ? 8000 : 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="page-content">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="page-header">
        <h2>Gestão de Vendas (CRM)</h2>
        <p>Acompanhe seus leads no funil ou gerencie sua carteira de clientes.</p>
      </div>

      {/* Tabs */}
      <div className="crm-tabs">
        <button
          className={`crm-tab-btn ${activeTab === 'kanban' ? 'active' : ''}`}
          onClick={() => setActiveTab('kanban')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KanbanIcon />
            <span>Funil de Vendas</span>
          </div>
        </button>
        <button
          className={`crm-tab-btn ${activeTab === 'clientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('clientes')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UsersIcon />
            <span>Clientes</span>
          </div>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'kanban' ? (
        <KanbanTab addToast={addToast} />
      ) : (
        <ClientesTab addToast={addToast} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   KANBAN TAB COMPONENT
   ══════════════════════════════════════════════════════════════ */

function KanbanTab({ addToast }: { addToast: (type: ToastType, message: string, details?: any) => void }) {
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  // Modals
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  const fetchKanban = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<KanbanBoardResponse>('/leads/kanban')
      setColumns(data.colunas)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar funil de vendas', details)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchKanban()
  }, [fetchKanban])

  // Drag Handlers
  const handleDragStart = (leadId: string) => {
    setDraggedLeadId(leadId)
  }

  const handleDragEnd = () => {
    setDraggedLeadId(null)
    setDraggedOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, etapa: string) => {
    e.preventDefault()
    setDraggedOverColumn(etapa)
  }

  const handleDrop = async (etapa: 'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido') => {
    if (!draggedLeadId) return
    const leadId = draggedLeadId

    // Optimistic Update
    let oldColumns = [...columns]
    let leadToMove: Lead | null = null

    // Encontra e remove da coluna antiga
    const nextCols = columns.map(col => {
      const exists = col.leads.find(l => l.id === leadId)
      if (exists) {
        leadToMove = { ...exists, etapa }
        return { ...col, total: col.total - 1, leads: col.leads.filter(l => l.id !== leadId) }
      }
      return col
    })

    // Adiciona na coluna nova
    if (leadToMove) {
      const updatedCols = nextCols.map(col => {
        if (col.etapa === etapa) {
          return { ...col, total: col.total + 1, leads: [leadToMove!, ...col.leads] }
        }
        return col
      })
      setColumns(updatedCols)
    }

    try {
      await api.patch(`/leads/${leadId}/etapa`, { etapa })
      addToast('success', `Lead movido para "${ETAPA_LABELS[etapa]}"`)
    } catch (err) {
      setColumns(oldColumns)
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao mover lead', details)
    } finally {
      handleDragEnd()
      fetchKanban()
    }
  }

  return (
    <div>
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>
          <PlusIcon /> Novo Lead
        </button>
      </div>

      {loading && columns.length === 0 ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Carregando funil Kanban...</p>
        </div>
      ) : (
        <div className="kanban-board">
          {columns.map(col => (
            <div
              key={col.etapa}
              className={`kanban-column ${draggedOverColumn === col.etapa ? 'drag-over' : ''}`}
              onDragOver={e => handleDragOver(e, col.etapa)}
              onDragLeave={() => setDraggedOverColumn(null)}
              onDrop={() => handleDrop(col.etapa)}
            >
              <div className="kanban-column-header">
                <h4>{ETAPA_LABELS[col.etapa]}</h4>
                <span className="kanban-column-count">{col.total}</span>
              </div>

              <div className="kanban-cards-container">
                {col.leads.map(lead => (
                  <div
                    key={lead.id}
                    className={`lead-card ${draggedLeadId === lead.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      setSelectedLeadId(lead.id)
                      setShowDetailModal(true)
                    }}
                  >
                    <div className="lead-card-header">
                      <h5>{lead.cliente?.nome || 'Cliente Sem Nome'}</h5>
                      <span className={`lead-origin-badge ${lead.origem}`}>
                        {ORIGEM_LABELS[lead.origem]}
                      </span>
                    </div>

                    <div className="lead-card-body">
                      {lead.veiculo_id ? (
                        <div className="lead-card-vehicle">Interesse: Carregando...</div>
                      ) : (
                        <div className="lead-card-vehicle" style={{ color: 'var(--sv-text-muted)' }}>Sem veículo vinculado</div>
                      )}
                      <div className="lead-card-price">
                        {lead.valor_proposta ? formatCurrency(lead.valor_proposta) : 'Sem proposta'}
                      </div>
                    </div>

                    <div className="lead-card-footer">
                      <div className="lead-card-date">
                        <CalendarIcon />
                        <span>{formatDate(lead.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Novo Lead Modal */}
      {showLeadModal && (
        <NovoLeadModal
          onClose={() => setShowLeadModal(false)}
          onSaved={() => {
            setShowLeadModal(false)
            addToast('success', 'Lead criado com sucesso!')
            fetchKanban()
          }}
          onError={msg => addToast('error', msg)}
        />
      )}

      {/* Detalhe do Lead Modal */}
      {showDetailModal && selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedLeadId(null)
          }}
          onUpdated={() => {
            fetchKanban()
          }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   NOVO LEAD MODAL
   ══════════════════════════════════════════════════════════════ */

function NovoLeadModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showClientesDropdown, setShowClientesDropdown] = useState(false)
  const [showCriarCliente, setShowCriarCliente] = useState(false)

  const [veiculoId, setVeiculoId] = useState('')
  const [veiculoSearch, setVeiculoSearch] = useState('')
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [showVeiculosDropdown, setShowVeiculosDropdown] = useState(false)
  const [showCriarVeiculo, setShowCriarVeiculo] = useState(false)

  const [etapa, setEtapa] = useState<'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido'>('lead')
  const [origem, setOrigem] = useState<'manual' | 'vitrine' | 'simulador' | 'whatsapp'>('manual')
  const [valorProposta, setValorProposta] = useState(0)
  const [valorPropostaStr, setValorPropostaStr] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submetido, setSubmetido] = useState(false)

  const clienteRef = useRef<HTMLDivElement>(null)
  const veiculoRef = useRef<HTMLDivElement>(null)

  const carregarClientesRecentes = async () => {
    try {
      const data = await api.get<Cliente[]>('/clientes')
      setClientes(data.slice(0, 20))
      setShowClientesDropdown(data.length > 0)
    } catch { /* ignore */ }
  }

  const carregarVeiculosRecentes = async () => {
    try {
      const data = await api.get<{ items: Veiculo[] }>('/veiculos')
      setVeiculos(data.items.slice(0, 20))
      setShowVeiculosDropdown(data.items.length > 0)
    } catch { /* ignore */ }
  }

  // Autocomplete Clientes
  useEffect(() => {
    if (clienteSearch.length < 1) return
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<Cliente[]>('/clientes', { q: clienteSearch })
        setClientes(data)
        setShowClientesDropdown(data.length > 0)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteSearch])

  // Autocomplete Veículos
  useEffect(() => {
    if (veiculoSearch.length < 1) return
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ items: Veiculo[] }>('/veiculos', { q: veiculoSearch })
        setVeiculos(data.items)
        setShowVeiculosDropdown(data.items.length > 0)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [veiculoSearch])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setShowClientesDropdown(false)
      if (veiculoRef.current && !veiculoRef.current.contains(e.target as Node)) setShowVeiculosDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = async () => {
    setSubmetido(true)
    if (!clienteId) {
      onError('Por favor, selecione um cliente.')
      return
    }

    setSaving(true)
    try {
      await api.post('/leads', {
        cliente_id: clienteId,
        veiculo_id: veiculoId || null,
        etapa,
        origem,
        valor_proposta: valorProposta || null,
        observacoes: observacoes || null,
      })
      onSaved()
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao criar lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Novo Lead</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            {/* Cliente */}
            <div className="form-group full-width" ref={clienteRef} style={{ position: 'relative' }}>
              <label>Cliente *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Busque por nome do cliente..."
                  value={clienteSearch}
                  onChange={e => {
                    setClienteSearch(e.target.value)
                    setClienteId('')
                  }}
                  onFocus={() => {
                    if (clienteSearch.length < 1) {
                      carregarClientesRecentes()
                    } else if (clientes.length > 0) {
                      setShowClientesDropdown(true)
                    }
                  }}
                  style={{ flex: 1, ...(submetido && !clienteId ? { borderColor: 'rgba(239, 68, 68, 0.6)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.15)' } : {}) }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCriarCliente(true)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}
                  title="Cadastrar Novo Cliente"
                >
                  <PlusIcon />
                </button>
              </div>
              {showClientesDropdown && (
                <div className="autocomplete-search-result">
                  {clientes.map(c => (
                    <div
                      key={c.id}
                      className="autocomplete-search-item"
                      onClick={() => {
                        setClienteId(c.id)
                        setClienteSearch(c.nome)
                        setShowClientesDropdown(false)
                      }}
                    >
                      {c.nome} {c.cpf ? `(${c.cpf})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Veículo */}
            <div className="form-group full-width" ref={veiculoRef} style={{ position: 'relative' }}>
              <label>Veículo de Interesse</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Busque por marca, modelo ou placa..."
                  value={veiculoSearch}
                  onChange={e => {
                    setVeiculoSearch(e.target.value)
                    setVeiculoId('')
                  }}
                  onFocus={() => {
                    if (veiculoSearch.length < 1) {
                      carregarVeiculosRecentes()
                    } else if (veiculos.length > 0) {
                      setShowVeiculosDropdown(true)
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCriarVeiculo(true)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}
                  title="Cadastrar Novo Veículo"
                >
                  <PlusIcon />
                </button>
              </div>
              {showVeiculosDropdown && (
                <div className="autocomplete-search-result">
                  {veiculos.map(v => (
                    <div
                      key={v.id}
                      className="autocomplete-search-item"
                      onClick={() => {
                        setVeiculoId(v.id)
                        setVeiculoSearch(`${v.marca} ${v.modelo} (${v.ano_modelo})`)
                        setShowVeiculosDropdown(false)
                        if (v.preco_venda) {
                          setValorProposta(v.preco_venda)
                          setValorPropostaStr(mascararMoeda(v.preco_venda))
                        }
                      }}
                    >
                      {v.marca} {v.modelo} {v.versao || ''} - {formatCurrency(v.preco_venda)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Etapa */}
            <div className="form-group">
              <label>Etapa Inicial</label>
              <select value={etapa} onChange={e => setEtapa(e.target.value as any)}>
                {Object.entries(ETAPA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Origem */}
            <div className="form-group">
              <label>Origem do Lead</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as any)}>
                {Object.entries(ORIGEM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Valor Proposto */}
            <div className="form-group">
              <label>Valor Proposto (R$)</label>
              <input
                type="text"
                value={valorPropostaStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setValorPropostaStr(masked)
                  setValorProposta(parseMoeda(masked))
                }}
              />
            </div>

            {/* Observações */}
            <div className="form-group full-width">
              <label>Observações</label>
              <textarea
                placeholder="Detalhes adicionais sobre o interesse do cliente..."
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Lead'}
          </button>
        </div>
      </div>

      {showCriarCliente && (
        <ClienteModal
          cliente={null}
          onClose={() => setShowCriarCliente(false)}
          onSaved={async () => {
            setShowCriarCliente(false)
            try {
              const data = await api.get<Cliente[]>('/clientes')
              if (data.length > 0) {
                const novo = data[0]
                setClienteId(novo.id)
                setClienteSearch(novo.nome)
              }
            } catch { /* ignore */ }
          }}
          onError={onError}
        />
      )}

      {showCriarVeiculo && (
        <VeiculoModal
          veiculo={null}
          onClose={() => setShowCriarVeiculo(false)}
          onSaved={async () => {
            setShowCriarVeiculo(false)
            try {
              const data = await api.get<{ items: Veiculo[] }>('/veiculos')
              if (data.items && data.items.length > 0) {
                const novo = data.items[0]
                setVeiculoId(novo.id)
                setVeiculoSearch(`${novo.marca} ${novo.modelo} (${novo.ano_modelo})`)
                if (novo.preco_venda) {
                  setValorProposta(novo.preco_venda)
                  setValorPropostaStr(mascararMoeda(novo.preco_venda))
                }
              }
            } catch { /* ignore */ }
          }}
          onError={onError}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   LEAD DETAIL MODAL
   ══════════════════════════════════════════════════════════════ */

function LeadDetailModal({
  leadId,
  onClose,
  onUpdated,
  addToast,
}: {
  leadId: string
  onClose: () => void
  onUpdated: () => void
  addToast: (type: ToastType, message: string, details?: any) => void
}) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [loading, setLoading] = useState(true)
  const [propostas, setPropostas] = useState<Negociacao[]>()
  const [loadingPropostas, setLoadingPropostas] = useState(false)

  // Nova Proposta Form
  const [valorProp, setValorProp] = useState(0)
  const [valorPropStr, setValorPropStr] = useState('')
  const [valorEntrada, setValorEntrada] = useState(0)
  const [valorEntradaStr, setValorEntradaStr] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [obsProposta, setObsProposta] = useState('')
  const [submittingProposta, setSubmittingProposta] = useState(false)

  const fetchLeadDetails = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Lead>(`/leads/${leadId}`)
      setLead(data)
      if (data.valor_proposta) {
        setValorProp(data.valor_proposta)
        setValorPropStr(mascararMoeda(data.valor_proposta))
      }

      if (data.veiculo_id) {
        try {
          const v = await api.get<any>(`/veiculos/${data.veiculo_id}`)
          setVeiculo(v)
        } catch { /* ignore */ }
      }
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar detalhes do lead', details)
    } finally {
      setLoading(false)
    }
  }, [leadId, addToast])

  const fetchPropostas = useCallback(async () => {
    setLoadingPropostas(true)
    try {
      const list = await api.get<Negociacao[]>(`/leads/${leadId}/negociacoes`)
      setPropostas(list)
    } catch { /* ignore */ }
    finally {
      setLoadingPropostas(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLeadDetails()
    fetchPropostas()
  }, [fetchLeadDetails, fetchPropostas])

  const handleAddProposta = async () => {
    if (!valorProp) {
      addToast('error', 'Valor proposto é obrigatório.')
      return
    }

    setSubmittingProposta(true)
    try {
      await api.post(`/leads/${leadId}/negociacoes`, {
        veiculo_id: lead?.veiculo_id || null,
        valor_proposta: valorProp,
        valor_entrada: valorEntrada || 0,
        parcelas,
        observacoes: obsProposta || null,
      })
      addToast('success', 'Proposta registrada com sucesso!')
      setValorEntrada(0)
      setValorEntradaStr('')
      setValorProp(0)
      setValorPropStr('')
      setObsProposta('')
      fetchPropostas()
      onUpdated()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao criar proposta', details)
    } finally {
      setSubmittingProposta(false)
    }
  }

  const handleDeleteLead = async () => {
    const ok = await useUIStore.getState().confirm({
      title: 'Excluir Lead',
      message: 'Deseja realmente excluir este lead permanentemente?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.delete(`/leads/${leadId}`)
      addToast('success', 'Lead excluído com sucesso.')
      onUpdated()
      onClose()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao excluir lead', details)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 750 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Detalhes do Lead</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>Carregando dados...</div>
          ) : lead ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Informações Básicas */}
              <div className="form-grid">
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sv-primary-text)', marginBottom: 8 }}>
                    {lead.cliente?.nome}
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
                    Telefone: {lead.cliente?.telefone || 'Não informado'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginTop: 4 }}>
                    Origem: <strong>{ORIGEM_LABELS[lead.origem]}</strong>
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Veículo de Interesse</h4>
                  {veiculo ? (
                    <div>
                      <p style={{ fontSize: 14, color: 'var(--sv-text)' }}>
                        <strong>{veiculo.marca} {veiculo.modelo}</strong> ({veiculo.ano_modelo})
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginTop: 2 }}>
                        Valor anunciado: {formatCurrency(veiculo.preco_venda)}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Sem veículo selecionado</p>
                  )}
                </div>
              </div>

              {lead.observacoes && (
                <div style={{ background: 'var(--sv-surface-dim)', padding: 12, borderRadius: 'var(--sv-radius)', border: '1px solid var(--sv-border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--sv-text-muted)' }}>Observações do Lead:</span>
                  <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginTop: 4 }}>{lead.observacoes}</p>
                </div>
              )}

              {/* Registro de Nova Proposta */}
              <div className="propostas-section">
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Registrar Nova Proposta</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Valor da Proposta (R$)</label>
                    <input
                      type="text"
                      value={valorPropStr}
                      onChange={e => {
                        const masked = mascararMoeda(e.target.value)
                        setValorPropStr(masked)
                        setValorProp(parseMoeda(masked))
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Valor da Entrada (R$)</label>
                    <input
                      type="text"
                      value={valorEntradaStr}
                      onChange={e => {
                        const masked = mascararMoeda(e.target.value)
                        setValorEntradaStr(masked)
                        setValorEntrada(parseMoeda(masked))
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Parcelas</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={parcelas}
                      onChange={e => setParcelas(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data Criação</label>
                    <div style={{ fontSize: 13, color: 'var(--sv-text-dim)', padding: '10px 0' }}>
                      {formatDate(lead.created_at)}
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Obs. Proposta</label>
                    <textarea
                      placeholder="Ex: Cliente quer pagar no pix / pegando troca..."
                      value={obsProposta}
                      onChange={e => setObsProposta(e.target.value)}
                    />
                  </div>
                  <div className="full-width" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-primary" onClick={handleAddProposta} disabled={submittingProposta}>
                      {submittingProposta ? 'Registrando...' : 'Enviar Proposta'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Histórico de Propostas */}
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700 }}>Histórico de Negociações</h4>
                {loadingPropostas ? (
                  <p style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Carregando propostas...</p>
                ) : propostas && propostas.length > 0 ? (
                  <div className="propostas-history">
                    {propostas.map(p => (
                      <div key={p.id} className="proposta-history-item">
                        <div className="proposta-history-header">
                          <span>Proposta: {formatCurrency(p.valor_proposta)}</span>
                          <span className="proposta-history-date">{formatDate(p.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>
                          Entrada: {formatCurrency(p.valor_entrada)} · Parcelas: {p.parcelas || 1}x
                        </div>
                        {p.observacoes && (
                          <p className="proposta-history-obs">{p.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--sv-text-muted)', marginTop: 8 }}>Nenhuma proposta registrada para este lead.</p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>Erro ao carregar detalhes.</div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-danger" onClick={handleDeleteLead}>
            <TrashIcon /> Excluir Lead
          </button>
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CLIENTES TAB COMPONENT
   ══════════════════════════════════════════════════════════════ */

function ClientesTab({ addToast }: { addToast: (type: ToastType, message: string, details?: any) => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.q = search
      const data = await api.get<Cliente[]>('/clientes', params)
      setClientes(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar clientes', details)
    } finally {
      setLoading(false)
    }
  }, [search, addToast])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(value)
    }, 400)
  }

  const handleDelete = async (c: Cliente) => {
    const ok = await useUIStore.getState().confirm({
      title: 'Excluir Cliente',
      message: `Tem certeza que deseja excluir o cliente ${c.nome} permanentemente?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.delete(`/clientes/${c.id}`)
      addToast('success', 'Cliente excluído com sucesso.')
      fetchClientes()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao excluir cliente', details)
    }
  }

  return (
    <div>
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="search-wrapper" style={{ width: 480, maxWidth: '100%' }}>
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            style={{ width: '100%' }}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingCliente(null); setShowModal(true) }}>
          <PlusIcon /> Novo Cliente
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Carregando lista de clientes...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="empty-state">
          <UsersIcon />
          <h3>Nenhum cliente cadastrado</h3>
          <p>Cadastre seu primeiro cliente clicando em "Novo Cliente".</p>
        </div>
      ) : (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>CPF / CNPJ</th>
              <th>Cidade / Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--sv-text)' }}>{c.nome}</div>
                  {c.email && <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>{c.email}</div>}
                </td>
                <td>{c.telefone || '—'}</td>
                <td>{c.cpf || c.cnpj || '—'}</td>
                <td>{c.cidade ? `${c.cidade} / ${c.estado || ''}` : '—'}</td>
                <td>
                  <div className="actions-cell">
                    <button
                      className="action-btn"
                      title="Editar"
                      onClick={() => { setEditingCliente(c); setShowModal(true) }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="action-btn danger"
                      title="Excluir"
                      onClick={() => handleDelete(c)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Cliente Modal */}
      {showModal && (
        <ClienteModal
          cliente={editingCliente}
          onClose={() => { setShowModal(false); setEditingCliente(null) }}
          onSaved={() => {
            setShowModal(false)
            setEditingCliente(null)
            addToast('success', editingCliente ? 'Cliente atualizado!' : 'Cliente cadastrado!')
            fetchClientes()
          }}
          onError={msg => addToast('error', msg)}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CLIENTE CADASTRO/EDIÇÃO MODAL
   ══════════════════════════════════════════════════════════════ */

function ClienteModal({
  cliente,
  onClose,
  onSaved,
  onError,
}: {
  cliente: Cliente | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const isEditing = !!cliente

  // State
  const [nome, setNome] = useState(cliente?.nome || '')
  const [cpf, setCpf] = useState(cliente?.cpf ? mascararCPF(cliente.cpf) : '')
  const [cnpj, setCnpj] = useState(cliente?.cnpj ? mascararCNPJ(cliente.cnpj) : '')
  const [rg, setRg] = useState(cliente?.rg ? mascararRG(cliente.rg) : '')
  const [nascimento, setNascimento] = useState(cliente?.data_nascimento ? cliente.data_nascimento.substring(0, 10) : '')
  const [telefone, setTelefone] = useState(cliente?.telefone ? mascararTelefone(cliente.telefone) : '')
  const [email, setEmail] = useState(cliente?.email || '')
  const [renda, setRenda] = useState(cliente?.renda_mensal || 0)
  const [rendaStr, setRendaStr] = useState(mascararMoeda(cliente?.renda_mensal || 0))
  const [cep, setCep] = useState(cliente?.cep || '')
  const [endereco, setEndereco] = useState(cliente?.endereco || '')
  const [numero, setNumero] = useState(cliente?.numero || '')
  const [bairro, setBairro] = useState(cliente?.bairro || '')
  const [cidade, setCidade] = useState(cliente?.cidade || '')
  const [estado, setEstado] = useState(cliente?.estado || '')
  const [observacoes, setObservacoes] = useState(cliente?.observacoes || '')
  const [saving, setSaving] = useState(false)
  const [submetido, setSubmetido] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

  const handleCepBlur = async () => {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      setLoadingCep(true)
      try {
        const res = await buscarCEP(cepLimpo)
        if (res) {
          setEndereco(res.endereco)
          setBairro(res.bairro)
          setCidade(res.cidade)
          setEstado(res.estado)
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  const handleSubmit = async () => {
    setSubmetido(true)
    if (!nome.trim()) {
      onError('O nome é obrigatório.')
      return
    }

    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ''
    if (cpfLimpo && !validarCPF(cpfLimpo)) {
      onError('CPF inválido. Verifique os números digitados.')
      return
    }

    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : ''
    if (cnpjLimpo && !validarCNPJ(cnpjLimpo)) {
      onError('CNPJ inválido. Verifique os números digitados.')
      return
    }

    const telLimpo = telefone ? telefone.replace(/\D/g, '') : ''
    if (telLimpo && telLimpo.length !== 10 && telLimpo.length !== 11) {
      onError('Telefone deve conter 10 ou 11 dígitos.')
      return
    }

    const cepLimpo = cep ? cep.replace(/\D/g, '') : ''
    if (cepLimpo && cepLimpo.length !== 8) {
      onError('CEP deve conter exatamente 8 dígitos.')
      return
    }

    if (estado && !UFS_VALIDAS.includes(estado.trim().toUpperCase())) {
      onError('UF do estado inválida.')
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onError('E-mail inválido.')
      return
    }

    setSaving(true)
    try {
      const body = {
        nome: sanitizarTexto(nome, 255),
        cpf: cpfLimpo || null,
        cnpj: cnpjLimpo || null,
        rg: rg ? sanitizarTexto(rg, 14).replace(/[^A-Za-z0-9]/g, '') : null,
        data_nascimento: nascimento ? new Date(nascimento).toISOString() : null,
        telefone: telLimpo || null,
        email: email ? sanitizarTexto(email, 255) : null,
        renda_mensal: renda || null,
        cep: cepLimpo || null,
        endereco: endereco ? sanitizarTexto(endereco, 255) : null,
        numero: numero ? sanitizarTexto(numero, 10) : null,
        bairro: bairro ? sanitizarTexto(bairro, 255) : null,
        cidade: cidade ? sanitizarTexto(cidade, 255) : null,
        estado: estado ? sanitizarTexto(estado, 2).toUpperCase() : null,
        observacoes: observacoes ? sanitizarTexto(observacoes, 255) : null,
      }

      if (isEditing) {
        await api.patch(`/clientes/${cliente!.id}`, body)
      } else {
        await api.post('/clientes', body)
      }
      onSaved()
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Nome Completo *</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={nome}
                onChange={e => setNome(capitalizarNome(e.target.value))}
                maxLength={255}
                style={submetido && !nome.trim() ? { borderColor: 'rgba(239, 68, 68, 0.6)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.15)' } : {}}
              />
            </div>

            <div className="form-group">
              <label>CPF</label>
              <input
                type="text"
                placeholder="Ex: 000.000.000-00"
                value={cpf}
                onChange={e => setCpf(mascararCPF(e.target.value))}
                maxLength={14}
              />
            </div>

            <div className="form-group">
              <label>CNPJ</label>
              <input
                type="text"
                placeholder="Ex: 00.000.000/0001-00"
                value={cnpj}
                onChange={e => setCnpj(mascararCNPJ(e.target.value))}
                maxLength={18}
              />
            </div>

            <div className="form-group">
              <label>RG</label>
              <input
                type="text"
                placeholder="Ex: 00.000.000-0"
                value={rg}
                onChange={e => setRg(mascararRG(e.target.value))}
                maxLength={12}
              />
            </div>

            <div className="form-group">
              <label>Data de Nascimento</label>
              <input
                type="date"
                value={nascimento}
                onChange={e => setNascimento(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                placeholder="Ex: (11) 99999-9999"
                value={telefone}
                onChange={e => setTelefone(mascararTelefone(e.target.value))}
                maxLength={15}
              />
            </div>

            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                placeholder="Ex: joao@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                  }
                }}
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label>Renda Mensal (R$)</label>
              <input
                type="text"
                value={rendaStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setRendaStr(masked)
                  setRenda(parseMoeda(masked))
                }}
                maxLength={20}
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label>CEP</label>
              <input
                type="text"
                placeholder={loadingCep ? "Buscando..." : "00000-000"}
                value={cep}
                onChange={e => setCep(mascararCEP(e.target.value))}
                onBlur={handleCepBlur}
                maxLength={9}
                disabled={loadingCep}
              />
            </div>

            <div className="form-group full-width">
              <label>Endereço</label>
              <input
                type="text"
                placeholder="Rua, Avenida..."
                value={endereco}
                onChange={e => setEndereco(capitalizarNome(e.target.value))}
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label>Número</label>
              <input
                type="text"
                placeholder="Ex: 123"
                value={numero}
                onChange={e => setNumero(e.target.value)}
                maxLength={10}
              />
            </div>

            <div className="form-group">
              <label>Bairro</label>
              <input
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={e => setBairro(capitalizarNome(e.target.value))}
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label>Cidade</label>
              <input
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={e => setCidade(capitalizarNome(e.target.value))}
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label>Estado (UF)</label>
              <input
                type="text"
                placeholder="Ex: SP"
                maxLength={2}
                value={estado}
                onChange={e => setEstado(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
              />
            </div>

            <div className="form-group full-width">
              <label>Observações</label>
              <textarea
                placeholder="Histórico ou perfil do cliente..."
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                maxLength={255}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}
