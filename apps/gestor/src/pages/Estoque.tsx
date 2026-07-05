import { useState, useEffect, useCallback, useRef } from 'react'
import { StatusSelect } from '../components/StatusSelect'
import { api, extractErrorDetails, type ApiErrorDetails } from '../lib/api'
import { UploadMidia } from '../components/UploadMidia'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { mascararMoeda, parseMoeda, mascararCPF, mascararTelefone, capitalizarNome } from '../lib/mascaras'
import { SimuladorModal } from '../components/SimuladorModal'
import { VehicleIdentityFields } from '../components/VehicleIdentityFields'
import { TIPOS_VEICULO, regraDoTipo, type Veiculo } from '../lib/veiculo'

/* ── Types ───────────────────────────────────────────────────── */

interface VeiculoListResponse {
  items: Veiculo[]
  total: number
  page: number
  per_page: number
  pages: number
}

interface CustoLancamento {
  id: string
  descricao: string
  valor: number
  data: string
  categoria?: string | null
  observacoes?: string
}
interface CustosVeiculoResponse {
  veiculo_id: string
  preco_compra: number
  total_preparacao: number
  custo_total: number
  custos: CustoLancamento[]
}

interface VeiculoDocumento {
  id: string
  tipo: string
  nome: string
  url: string
  visivel_comprador: boolean
  created_at: string
}

interface VendaData {
  veiculo_id: string
  comprador_id: string | null
  comprador_nome: string | null
  comprador_telefone: string | null
  documentos: VeiculoDocumento[]
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

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

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="6" width="22" height="10" rx="3" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M5 6L7 2h10l2 4" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ChevLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const ChevRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const DollarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCurrency(value?: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatKm(km: number) {
  return km.toLocaleString('pt-BR') + ' km'
}

const STATUS_LABELS: Record<string, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  repasse: 'Repasse',
  inativo: 'Inativo',
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export function Estoque() {
  // ── State ──
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [perPage] = useState(15)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null)
  const [simulandoVeiculo, setSimulandoVeiculo] = useState<Veiculo | null>(null)
  const [vendendoVeiculo, setVendendoVeiculo] = useState<Veiculo | null>(null)
  const [solicitandoExclusaoVeiculo, setSolicitandoExclusaoVeiculo] = useState<Veiculo | null>(null)
  const [motivoExclusao, setMotivoExclusao] = useState('')

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([])

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const addToast = useCallback((type: ToastType, message: string, details?: ApiErrorDetails) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message, details }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), details ? 8000 : 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Fetch ──
  const fetchVeiculos = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        per_page: String(perPage),
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      if (search) params.q = search
      if (statusFilter) params.status = statusFilter

      const data = await api.get<VeiculoListResponse>('/veiculos', params)
      setVeiculos(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar estoque', details)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [page, perPage, sortBy, sortOrder, search, statusFilter, addToast])

  useEffect(() => { fetchVeiculos() }, [fetchVeiculos])

  // ── Debounced Search ──
  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 400)
  }

  // ── Status Change ──
  const handleStatusChange = async (veiculo: Veiculo, newStatus: string) => {
    const oldStatus = veiculo.status
    // Optimistic UI Update
    setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, status: newStatus as any } : v))
    try {
      await api.patch(`/veiculos/${veiculo.id}/status`, { status: newStatus })
      addToast('success', `Status alterado para "${STATUS_LABELS[newStatus]}"`)
    } catch (err) {
      // Revert on error
      setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, status: oldStatus } : v))
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao alterar status', details)
    }
  }

  // ── Publish Toggle ──
  const handlePublishToggle = async (veiculo: Veiculo) => {
    const newValue = !veiculo.publicado_marketplace
    // Optimistic UI Update
    setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, publicado_marketplace: newValue } : v))
    try {
      await api.patch(`/veiculos/${veiculo.id}/publicar`, { publicado: newValue })
      addToast('success', newValue ? 'Veículo publicado na vitrine!' : 'Veículo removido da vitrine.')
    } catch (err) {
      // Revert on error
      setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, publicado_marketplace: !newValue } : v))
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao alterar publicação', details)
    }
  }

  // ── Toggle Feed ──
  const handleToggleFeed = async (veiculo: Veiculo) => {
    const isRepasse = veiculo.status === 'repasse'
    const newStatus = isRepasse ? 'disponivel' : 'repasse'
    
    // Optimistic UI Update
    setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, status: newStatus as any } : v))
    try {
      await api.patch(`/veiculos/${veiculo.id}/status`, { status: newStatus })
      addToast('success', newStatus === 'repasse' ? 'Veículo publicado no Feed de Repasses!' : 'Veículo removido do Feed de Repasses.')
    } catch (err) {
      // Revert on error
      setVeiculos(prev => prev.map(v => v.id === veiculo.id ? { ...v, status: veiculo.status } : v))
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao alterar publicação no feed', details)
    }
  }

  // ── Toggle All Publish ──
  const handleToggleAllPublish = async (newValue: boolean) => {
    const disponiveis = veiculos.filter(v => v.status === 'disponivel' && v.publicado_marketplace !== newValue)
    if (disponiveis.length === 0) return

    // Optimistic UI Update
    setVeiculos(prev => prev.map(v => 
      (v.status === 'disponivel' && v.publicado_marketplace !== newValue)
        ? { ...v, publicado_marketplace: newValue }
        : v
    ))

    try {
      await Promise.all(
        disponiveis.map(v => api.patch(`/veiculos/${v.id}/publicar`, { publicado: newValue }))
      )
      addToast('success', newValue ? `${disponiveis.length} veículos publicados!` : `${disponiveis.length} veículos removidos da vitrine.`)
    } catch (err) {
      // Revert by fetching real state from DB
      fetchVeiculos(false)
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao alterar publicações em lote', details)
    }
  }

  // ── Delete ──
  const handleDelete = async (veiculo: Veiculo) => {
    const isVendedor = useAuthStore.getState().user?.papel === 'vendedor'
    if (isVendedor) {
      setSolicitandoExclusaoVeiculo(veiculo)
      setMotivoExclusao('')
      return
    }

    const ok = await useUIStore.getState().confirm({
      title: 'Excluir Veículo',
      message: `Tem certeza que deseja excluir o veículo ${veiculo.marca} ${veiculo.modelo}?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      const res = await api.delete<{ message?: string; status?: string }>(`/veiculos/${veiculo.id}`)
      if (res.status === 'APROVACAO_PENDENTE') {
        addToast('info', res.message || 'Solicitação enviada para aprovação.')
      } else {
        addToast('success', 'Veículo excluído com sucesso.')
      }
      fetchVeiculos()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao excluir', details)
    }
  }

  // ── Sort ──
  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
    setPage(1)
  }

  // ── KPIs ──
  const kpiDisponivel = veiculos.filter(v => v.status === 'disponivel').length
  const kpiPublicado = veiculos.filter(v => v.publicado_marketplace).length

  return (
    <div className="page-content">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2>Estoque de Veículos</h2>
          <p>Gerencie seu inventário, preços e disponibilidade.</p>
        </div>
        <button
          id="btn-novo-veiculo"
          className="btn btn-primary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => { setEditingVeiculo(null); setShowModal(true) }}
        >
          <PlusIcon /> Novo Veículo
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Total no Estoque</div>
            <div className="kpi-value">{total}</div>
          </div>
          <div className="kpi-icon">
            <CarIcon />
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Disponíveis</div>
            <div className="kpi-value">{kpiDisponivel}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'color-mix(in srgb, var(--sv-success) 14%, transparent)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-success)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Na Vitrine</div>
            <div className="kpi-value">{kpiPublicado}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'color-mix(in srgb, var(--sv-secondary) 14%, transparent)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-secondary)" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ maxWidth: 360, width: '100%' }}>
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por placa, marca ou modelo..."
            style={{ width: '100%' }}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">Todos os Status</option>
          <option value="disponivel">Disponível</option>
          <option value="reservado">Reservado</option>
          <option value="vendido">Vendido</option>
          <option value="repasse">Repasse</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Carregando estoque...</p>
        </div>
      ) : veiculos.length === 0 ? (
        <div className="empty-state">
          <CarIcon />
          <h3>Nenhum veículo encontrado</h3>
          <p>Cadastre seu primeiro veículo clicando em "Novo Veículo" acima.</p>
        </div>
      ) : (
        <>
          <table className="stock-table">
            <thead>
              <tr>
                <th>Veículo</th>
                <th
                  className={`sortable ${sortBy === 'ano_modelo' ? 'sorted' : ''}`}
                  onClick={() => toggleSort('ano_modelo')}
                >
                  Ano {sortBy === 'ano_modelo' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className={`sortable ${sortBy === 'km' ? 'sorted' : ''}`}
                  onClick={() => toggleSort('km')}
                >
                  KM {sortBy === 'km' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className={`sortable ${sortBy === 'preco_venda' ? 'sorted' : ''}`}
                  onClick={() => toggleSort('preco_venda')}
                >
                  Preço {sortBy === 'preco_venda' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>Margem</th>
                <th>Status</th>
                <th>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Vitrine
                    {(() => {
                      const disponiveis = veiculos.filter(v => v.status === 'disponivel')
                      if (disponiveis.length === 0) return null
                      const allPublished = disponiveis.length > 0 && disponiveis.every(v => v.publicado_marketplace)
                      return (
                        <label className={`toggle-publish ${allPublished ? 'is-on' : 'is-off'}`} style={{ transform: 'scale(0.75)', transformOrigin: 'left center' }} title="Publicar/Despublicar todos disponíveis">
                          <input
                            type="checkbox"
                            checked={allPublished}
                            onChange={() => handleToggleAllPublish(!allPublished)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      )
                    })()}
                  </div>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className="vehicle-info-cell">
                      {v.midias && v.midias.length > 0 ? (
                        <div className="vehicle-thumb">
                          <img src={v.midias[0].url} alt={`${v.marca} ${v.modelo}`} />
                        </div>
                      ) : (
                        <div className="vehicle-thumb-placeholder">
                          <CarIcon />
                        </div>
                      )}
                      <div className="vehicle-info-text">
                        <h4>{v.marca} {v.modelo} {v.versao || ''}</h4>
                        <p>{v.placa || 'Sem placa'} · {v.cor || '—'} · {v.combustivel || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="vehicle-year">{v.ano_fabricacao}/{v.ano_modelo}</td>
                  <td className="vehicle-km">{formatKm(v.km ?? 0)}</td>
                  <td className="vehicle-price">{formatCurrency(v.preco_venda)}</td>
                  <td>
                    {v.preco_venda && v.preco_custo ? (() => {
                      const lucro = v.preco_venda - v.preco_custo
                      const margem = (lucro / v.preco_venda) * 100
                      return (
                        <span className={`margem-badge ${lucro >= 0 ? 'pos' : 'neg'}`}>
                          {margem.toFixed(0)}%
                        </span>
                      )
                    })() : <span className="margem-badge none">—</span>}
                  </td>
                  <td>
                    <StatusSelect
                      value={v.status || 'disponivel'}
                      onChange={newStatus => handleStatusChange(v, newStatus)}
                    />
                  </td>
                  <td>
                    <label className={`toggle-publish ${v.publicado_marketplace ? 'is-on' : 'is-off'}`}>
                      <input
                        type="checkbox"
                        checked={v.publicado_marketplace}
                        disabled={v.status !== 'disponivel' && !v.publicado_marketplace}
                        onChange={() => handlePublishToggle(v)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                  <td>
                    <div className="actions-cell">
                      {v.status === 'disponivel' && (
                        <button
                          className="action-btn"
                          title="Fechar Venda"
                          onClick={() => setVendendoVeiculo(v)}
                          style={{ color: 'var(--sv-success)' }}
                        >
                          <DollarIcon />
                        </button>
                      )}
                      <button
                        className="action-btn"
                        title="Simular Crédito"
                        onClick={() => setSimulandoVeiculo(v)}
                        style={{ color: 'var(--sv-primary)' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <line x1="8" x2="16" y1="6" y2="6" />
                          <line x1="16" x2="16" y1="14" y2="18" />
                          <path d="M16 10h.01" />
                          <path d="M12 10h.01" />
                          <path d="M8 10h.01" />
                          <path d="M12 14h.01" />
                          <path d="M8 14h.01" />
                          <path d="M12 18h.01" />
                          <path d="M8 18h.01" />
                        </svg>
                      </button>
                      {(v.status === 'disponivel' || v.status === 'repasse') && (
                        <button
                          className="action-btn"
                          title={v.status === 'repasse' ? 'Remover do Feed de Repasses' : 'Postar no Feed de Repasses'}
                          onClick={() => handleToggleFeed(v)}
                          style={{ color: v.status === 'repasse' ? 'var(--sv-success)' : 'var(--sv-text-dim)' }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
                      )}
                      <button
                        className="action-btn"
                        title="Editar"
                        onClick={() => { setEditingVeiculo(v); setShowModal(true) }}
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="action-btn danger"
                        title="Excluir"
                        onClick={() => handleDelete(v)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Paginação ── */}
          <div className="pagination">
            <div className="pagination-info">
              Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total} veículos
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevLeft />
              </button>
              {(() => {
                const maxButtons = 5
                let start = Math.max(1, page - 2)
                let end = Math.min(pages, page + 2)
                
                if (end - start + 1 < maxButtons) {
                  if (start === 1) {
                    end = Math.min(pages, start + maxButtons - 1)
                  } else if (end === pages) {
                    start = Math.max(1, end - maxButtons + 1)
                  }
                }

                return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => {
                  const p = start + i
                  return (
                    <button
                      key={p}
                      className={`pagination-btn ${page === p ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                })
              })()}
              <button
                className="pagination-btn"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevRight />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal Criar/Editar ── */}
      {showModal && (
        <VeiculoModal
          veiculo={editingVeiculo}
          onClose={() => { setShowModal(false); setEditingVeiculo(null) }}
          onSaved={() => {
            setShowModal(false)
            setEditingVeiculo(null)
            addToast('success', editingVeiculo ? 'Veículo atualizado!' : 'Veículo cadastrado!')
            fetchVeiculos()
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* ── Modal Simulador ── */}
      {simulandoVeiculo && (
        <SimuladorModal
          veiculo={simulandoVeiculo}
          onClose={() => setSimulandoVeiculo(null)}
        />
      )}

      {/* ── Modal Vender ── */}
      {vendendoVeiculo && (
        <VenderModal
          veiculo={vendendoVeiculo}
          onClose={() => setVendendoVeiculo(null)}
          onSaved={(contratoId) => {
            setVendendoVeiculo(null)
            addToast('success', 'Veículo vendido com sucesso!')
            fetchVeiculos()
            // Redirecionar para o contrato (usando window.location para contornar hook router)
            setTimeout(() => {
              window.location.href = `/ferramentas/contratos?id=${contratoId}`
            }, 500)
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {solicitandoExclusaoVeiculo && (
        <div className="modal-overlay" onClick={() => setSolicitandoExclusaoVeiculo(null)}>
          <div className="modal-glass" style={{ width: '450px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Solicitar Exclusão</h3>
              <button className="modal-close" onClick={() => setSolicitandoExclusaoVeiculo(null)} style={{ background: 'none', border: 'none', color: 'var(--sv-text-muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: 'var(--sv-text-dim)', margin: 0 }}>
                Você está solicitando a exclusão de <strong>{solicitandoExclusaoVeiculo.marca} {solicitandoExclusaoVeiculo.modelo}</strong> ({solicitandoExclusaoVeiculo.placa}). Esta ação requer aprovação do gestor.
              </p>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase' }}>Motivo da Exclusão (obrigatório)</label>
                <input
                  type="text"
                  placeholder="Ex: Veículo vendido externamente, dados incorretos..."
                  value={motivoExclusao}
                  onChange={e => setMotivoExclusao(e.target.value)}
                  style={{
                    background: 'var(--sv-input-bg)',
                    border: '1px solid var(--sv-border)',
                    borderRadius: 'var(--sv-radius)',
                    color: 'var(--sv-text)',
                    height: '42px',
                    padding: '0 14px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-outline" onClick={() => setSolicitandoExclusaoVeiculo(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!motivoExclusao.trim()}
                onClick={async () => {
                  try {
                    const res = await api.delete<{ message?: string; status?: string }>(
                      `/veiculos/${solicitandoExclusaoVeiculo.id}?motivo=${encodeURIComponent(motivoExclusao)}`
                    )
                    if (res.status === 'APROVACAO_PENDENTE') {
                      addToast('info', res.message || 'Solicitação enviada para aprovação.')
                    } else {
                      addToast('success', 'Veículo excluído com sucesso.')
                    }
                    setSolicitandoExclusaoVeiculo(null)
                    fetchVeiculos()
                  } catch (err) {
                    const { message, details } = extractErrorDetails(err)
                    addToast('error', message || 'Erro ao solicitar exclusão', details)
                  }
                }}
              >
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   MODAL DE CRIAÇÃO / EDIÇÃO
   ══════════════════════════════════════════════════════════════ */

// Categorias de custo de preparação (chips de atalho do Histórico)
const CATEGORIAS_CUSTO: { value: string; label: string; icon: string }[] = [
  { value: 'mecanica', label: 'Mecânica', icon: '🔧' },
  { value: 'pintura', label: 'Pintura/Funilaria', icon: '🎨' },
  { value: 'pneus', label: 'Pneus', icon: '🛞' },
  { value: 'higienizacao', label: 'Higienização', icon: '🧼' },
  { value: 'documentacao', label: 'Documentação', icon: '📄' },
  { value: 'outro', label: 'Outro', icon: '➕' },
]
const iconeCategoria = (cat?: string | null) =>
  CATEGORIAS_CUSTO.find(c => c.value === cat)?.icon || '💸'
const labelCategoria = (cat?: string | null) =>
  CATEGORIAS_CUSTO.find(c => c.value === cat)?.label || ''

export function VeiculoModal({
  veiculo,
  onClose,
  onSaved,
  onError,
}: {
  veiculo: Veiculo | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const isEditing = !!veiculo

  // Form state
  const [placa, setPlaca] = useState(veiculo?.placa || '')
  const [marca, setMarca] = useState(veiculo?.marca || '')
  const [modelo, setModelo] = useState(veiculo?.modelo || '')
  const [versao, setVersao] = useState(veiculo?.versao || '')
  const [anoFab, setAnoFab] = useState(veiculo?.ano_fabricacao || new Date().getFullYear())
  const [anoMod, setAnoMod] = useState(veiculo?.ano_modelo || new Date().getFullYear())
  const [km, setKm] = useState<number | ''>(veiculo?.km !== undefined ? veiculo.km : 0)
  const [cor, setCor] = useState(veiculo?.cor || '')
  const [cambio, setCambio] = useState(veiculo?.cambio || '')
  const [combustivel, setCombustivel] = useState(veiculo?.combustivel || '')
  const [tipo, setTipo] = useState(veiculo?.tipo || '')
  const [carroceria, setCarroceria] = useState(veiculo?.carroceria || '')
  const [portas, setPortas] = useState(veiculo?.portas || 4)
  const [precoVenda, setPrecoVenda] = useState(veiculo?.preco_venda || 0)
  const [precoVendaStr, setPrecoVendaStr] = useState(mascararMoeda(veiculo?.preco_venda || 0))
  const [motivo, setMotivo] = useState('')
  const [precoCusto, setPrecoCusto] = useState(veiculo?.preco_custo || 0)
  const [precoCustoStr, setPrecoCustoStr] = useState(mascararMoeda(veiculo?.preco_custo || 0))
  const [midias, setMidias] = useState<any[]>(veiculo?.midias || [])
  const [opcionais, setOpcionais] = useState<string[]>(() => {
    try { return veiculo?.opcionais ? JSON.parse(veiculo.opcionais) : [] } catch { return [] }
  })
  const [novoOpcional, setNovoOpcional] = useState('')
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)
  const [fipeMarcaCodigo, setFipeMarcaCodigo] = useState(veiculo?.fipe_marca_codigo || '')
  const [fipeModeloCodigo, setFipeModeloCodigo] = useState(veiculo?.fipe_modelo_codigo || '')
  const [fipeAnoCodigo, setFipeAnoCodigo] = useState(veiculo?.fipe_ano_codigo || '')

  const [saving, setSaving] = useState(false)
  const [submetido, setSubmetido] = useState(false)
  const [rascunhoId, setRascunhoId] = useState<string | null>(null)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)

  // Rede Social
  const [publicarRedeSocial, setPublicarRedeSocial] = useState(veiculo?.publicar_rede_social || false)
  const [legendaStory, setLendaStory] = useState('')
  const [valorRepasse, setValorRepasse] = useState(veiculo?.valor_repasse || 0)
  const [valorRepasseStr, setValorRepasseStr] = useState(mascararMoeda(veiculo?.valor_repasse || 0))

  // FIPE (Melhoria 15)
  const [fipeData, setFipeData] = useState<any>(null)

  // ── Aba Venda (M018) ──
  const [vendaData, setVendaData] = useState<VendaData | null>(null)
  const [compradorSearch, setCompradorSearch] = useState('')
  const [compradorResults, setCompradorResults] = useState<any[]>([])
  const [novoDocTipo, setNovoDocTipo] = useState('contrato')
  const [novoDocFile, setNovoDocFile] = useState<File | null>(null)
  const [novoDocVisivel, setNovoDocVisivel] = useState(true)
  const [docForm, setDocForm] = useState(false)
  const [vendaSaving, setVendaSaving] = useState(false)

  // ── Abas ──
  const [aba, setAba] = useState<'dados' | 'custos' | 'venda'>('dados')

  // ── Custos de preparação (aba 2) ──
  const [custos, setCustos] = useState<CustoLancamento[]>([])
  const [totalPreparacao, setTotalPreparacao] = useState(0)
  const [precoCompra, setPrecoCompra] = useState(veiculo?.preco_custo || 0)
  const [custoNovaDesc, setCustoNovaDesc] = useState('')
  const [custoNovoValorStr, setCustoNovoValorStr] = useState('')
  const [custoNovaCategoria, setCustoNovaCategoria] = useState('')
  const [custoForm, setCustoForm] = useState(false)
  const [custoSaving, setCustoSaving] = useState(false)

  const aplicarCustos = useCallback((c: CustosVeiculoResponse) => {
    setCustos(c.custos)
    setTotalPreparacao(c.total_preparacao)
    setPrecoCompra(c.preco_compra)
    setPrecoCusto(c.custo_total)
    setPrecoCustoStr(mascararMoeda(c.custo_total))
  }, [])

  // Carrega custos e FIPE ao abrir (somente edição)
  useEffect(() => {
    if (!veiculo) return
    api.get<CustosVeiculoResponse>(`/financeiro/veiculos/${veiculo.id}/custos`)
      .then(aplicarCustos)
      .catch(() => { /* ignore */ })
    
    api.get(`/veiculos/${veiculo.id}/precificacao`)
      .then(res => setFipeData(res))
      .catch(() => { /* ignore */ })

    api.get<VendaData>(`/veiculos/${veiculo.id}/venda`)
      .then(res => setVendaData(res))
      .catch(() => { /* ignore */ })
  }, [veiculo, aplicarCustos])

  const adicionarCusto = async () => {
    if (!veiculo) return
    const valor = parseMoeda(custoNovoValorStr)
    if (!custoNovaDesc.trim() || valor <= 0) {
      onError('Informe descrição e valor do custo.')
      return
    }
    setCustoSaving(true)
    try {
      const res = await api.post<CustosVeiculoResponse>(
        `/financeiro/veiculos/${veiculo.id}/custos`,
        { descricao: custoNovaDesc.trim(), valor, categoria: custoNovaCategoria || null },
      )
      aplicarCustos(res)
      setCustoNovaDesc('')
      setCustoNovoValorStr('')
      setCustoNovaCategoria('')
      setCustoForm(false)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao lançar custo')
    } finally {
      setCustoSaving(false)
    }
  }

  const removerCusto = async (lancamentoId: string) => {
    if (!veiculo) return
    try {
      const res = await api.delete<CustosVeiculoResponse>(
        `/financeiro/veiculos/${veiculo.id}/custos/${lancamentoId}`,
      )
      aplicarCustos(res)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao remover custo')
    }
  }

  // ── Regras de visibilidade por tipo ──
  const regra = regraDoTipo(tipo)

  // ── Buscar dados da placa (KePlaca, server-side scraping) ──
  const buscarPlaca = async () => {
    const p = placa.trim().toUpperCase()
    if (!p) { onError('Informe a placa para buscar.'); return }
    setBuscandoPlaca(true)
    try {
      const res = await api.get<any>(`/veiculos/consulta-placa/${p}`)
      if (!res?.encontrado) {
        onError(res?.mensagem || 'Placa não encontrada.')
        return
      }
      if (res.marca) setMarca(res.marca)
      if (res.modelo) setModelo(res.modelo)
      if (res.ano_modelo) { setAnoMod(res.ano_modelo); setAnoFab(res.ano_fabricacao || res.ano_modelo) }
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao consultar a placa.')
    } finally {
      setBuscandoPlaca(false)
    }
  }

  // ── Opcionais ──
  const adicionarOpcional = () => {
    const v = novoOpcional.trim()
    if (!v) return
    if (!opcionais.some(o => o.toLowerCase() === v.toLowerCase())) {
      setOpcionais([...opcionais, v])
    }
    setNovoOpcional('')
  }
  const removerOpcional = (item: string) => setOpcionais(opcionais.filter(o => o !== item))

  // ── Rascunho: cria veículo silenciosamente para liberar upload de mídia ──
  const buildBody = (rascunho = false) => ({
    placa: regra.placa ? (placa || null) : null,
    marca: marca || 'Rascunho',
    modelo: modelo || 'Rascunho',
    versao: versao || null,
    ano_fabricacao: anoFab,
    ano_modelo: anoMod,
    km: regra.km ? (km === '' ? 0 : km) : null,
    cor: cor || null,
    cambio: regra.cambio ? (cambio || null) : null,
    combustivel: regra.combustivel ? (combustivel || null) : null,
    tipo: tipo || null,
    carroceria: regra.carroceria ? (carroceria || null) : null,
    portas: regra.portas ? (portas || null) : null,
    opcionais: opcionais.length > 0 ? JSON.stringify(opcionais) : null,
    preco_venda: precoVenda || null,
    preco_custo: precoCusto || null,
    publicar_rede_social: false,
    valor_repasse: null,
    fipe_marca_codigo: fipeMarcaCodigo || null,
    fipe_modelo_codigo: fipeModeloCodigo || null,
    fipe_ano_codigo: fipeAnoCodigo || null,
    status: rascunho ? 'RASCUNHO' : undefined,
  })

  const salvarRascunho = async (): Promise<string | null> => {
    if (rascunhoId) return rascunhoId
    if (isEditing) return veiculo!.id
    setSalvandoRascunho(true)
    try {
      const criado = await api.post<{ id: string }>('/veiculos', buildBody(true))
      setRascunhoId(criado.id)
      return criado.id
    } catch {
      return null
    } finally {
      setSalvandoRascunho(false)
    }
  }

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmetido(true)
    if (!marca.trim() || !modelo.trim()) {
      onError('Marca e Modelo são obrigatórios.')
      return
    }

    const isVendedor = useAuthStore.getState().user?.papel === 'vendedor'
    const precoAlterado = isEditing && veiculo && precoVenda !== veiculo.preco_venda
    if (precoAlterado && isVendedor && !motivo.trim()) {
      onError('Por favor, informe o motivo para o reajuste de preço.')
      return
    }

    setSaving(true)
    try {
      const body: any = {
        ...buildBody(false),
        marca,
        modelo,
        publicar_rede_social: publicarRedeSocial,
        valor_repasse: publicarRedeSocial ? (valorRepasse || null) : null,
        status: 'DISPONIVEL',
      }
      if (precoAlterado && isVendedor) {
        body.motivo = motivo
      }

      let veiculoId = veiculo?.id
      if (isEditing) {
        await api.patch(`/veiculos/${veiculo!.id}`, body)
      } else if (rascunhoId) {
        await api.patch(`/veiculos/${rascunhoId}`, body)
        veiculoId = rascunhoId
      } else {
        const criado = await api.post<{ id: string }>('/veiculos', body)
        veiculoId = criado.id
      }

      // Publica story se solicitado e tem foto
      if (publicarRedeSocial && veiculoId && midias.length > 0) {
        try {
          await api.post('/gestor/stories', { veiculo_id: veiculoId, legenda: legendaStory || null })
        } catch {
          // Story falhou mas veículo foi salvo — não bloqueia
        }
      }

      onSaved()
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao salvar veículo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass modal-veiculo" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Veículo' : 'Novo Veículo'}</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${aba === 'dados' ? 'active' : ''}`}
            onClick={() => setAba('dados')}
          >
            Dados Gerais
          </button>
          <button
            className={`modal-tab ${aba === 'custos' ? 'active' : ''}`}
            onClick={() => setAba('custos')}
            disabled={!isEditing}
            title={isEditing ? '' : 'Salve o veículo para lançar custos de preparação'}
            style={!isEditing ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            Histórico de Custos
            {custos.length > 0 && <span className="modal-tab-badge">{custos.length}</span>}
          </button>
          <button
            className={`modal-tab ${aba === 'venda' ? 'active' : ''}`}
            onClick={() => setAba('venda')}
            disabled={!isEditing}
            title={isEditing ? '' : 'Salve o veículo para acessar dados de venda'}
            style={!isEditing ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            Venda & Docs
            {vendaData?.documentos?.length ? <span className="modal-tab-badge">{vendaData.documentos.length}</span> : null}
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-form-col">
          <div className="veic-grid" style={aba === 'dados' ? {} : { display: 'none' }}>
            {/* ── Linha 1: Tipo · Placa (com Buscar) ── */}
            <div className="form-group veic-c5">
              <label>Tipo de veículo *</label>
              <select value={tipo} onChange={e => {
                const novoTipo = e.target.value
                if (novoTipo !== tipo) {
                  setMarca('')
                  setModelo('')
                  setVersao('')
                }
                setTipo(novoTipo)
              }}>
                <option value="">Selecione</option>
                {TIPOS_VEICULO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {regra.placa && (
              <div className="form-group veic-c7">
                <label>Placa <span className="veic-hint">— busca dados na KePlaca</span></label>
                <div className="placa-row">
                  <input
                    type="text"
                    placeholder="ABC1D23"
                    value={placa}
                    onChange={e => setPlaca(e.target.value.toUpperCase())}
                    maxLength={7}
                  />
                  <button type="button" className="btn-buscar" onClick={buscarPlaca} disabled={buscandoPlaca}>
                    {buscandoPlaca ? <span className="spinner" /> : '🔍 Buscar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Linha 2: Marca · Modelo · Ano ── */}
            <div className="veic-section">Identificação</div>
            <div className="form-group veic-c12">
              <VehicleIdentityFields
                modoBusca="autocomplete"
                ocultarTipo
                value={{ tipo, marca, modelo, ano_fabricacao: anoFab, ano_modelo: anoMod, fipe_marca_codigo: fipeMarcaCodigo, fipe_modelo_codigo: fipeModeloCodigo, fipe_ano_codigo: fipeAnoCodigo }}
                erros={{ marca: submetido, modelo: submetido }}
                onChange={(patch) => {
                  if (patch.marca !== undefined) setMarca(patch.marca)
                  if (patch.modelo !== undefined) setModelo(patch.modelo)
                  if (patch.ano_fabricacao !== undefined) setAnoFab(patch.ano_fabricacao)
                  if (patch.ano_modelo !== undefined) setAnoMod(patch.ano_modelo)
                  if ('fipe_marca_codigo' in patch) setFipeMarcaCodigo(patch.fipe_marca_codigo || '')
                  if ('fipe_modelo_codigo' in patch) setFipeModeloCodigo(patch.fipe_modelo_codigo || '')
                  if ('fipe_ano_codigo' in patch) setFipeAnoCodigo(patch.fipe_ano_codigo || '')
                }}
              />
            </div>

            {/* ── Linha 3: Versão · KM/Horas · Cor ── */}
            {regra.versao && (
              <div className="form-group veic-c6">
                <label>Versão</label>
                <input
                  type="text"
                  placeholder="Ex: 1.0 Turbo Premier"
                  value={versao}
                  onChange={e => setVersao(e.target.value)}
                />
              </div>
            )}

            {regra.km && (
              <div className="form-group veic-c3">
                <label>{regra.uso === 'horas' ? 'Horas de uso' : 'Quilometragem'}</label>
                <div className="inp-suffix">
                  <input
                    type="number"
                    min={0}
                    value={km}
                    onChange={e => {
                      const val = e.target.value
                      setKm(val === '' ? '' : Number(val))
                    }}
                  />
                  <span className="sfx">{regra.uso === 'horas' ? 'h' : 'km'}</span>
                </div>
              </div>
            )}

            <div className="form-group veic-c3">
              <label>Cor</label>
              <input
                type="text"
                placeholder="Ex: Prata"
                value={cor}
                onChange={e => setCor(e.target.value)}
              />
            </div>

            {/* ── Linha 4: Câmbio · Combustível · Portas ── */}
            {regra.cambio && (
              <div className="form-group veic-c4">
                <label>Câmbio</label>
                <select value={cambio} onChange={e => setCambio(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="cvt">CVT</option>
                  <option value="automatizado">Automatizado</option>
                </select>
              </div>
            )}

            {regra.combustivel && (
              <div className="form-group veic-c4">
                <label>Combustível</label>
                <select value={combustivel} onChange={e => setCombustivel(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="etanol">Etanol</option>
                  <option value="diesel">Diesel</option>
                  <option value="eletrico">Elétrico</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="gnv">GNV</option>
                </select>
              </div>
            )}

            {regra.portas && (
              <div className="form-group veic-c4">
                <label>Portas</label>
                <select value={portas} onChange={e => setPortas(Number(e.target.value))}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            )}

            {regra.carroceria && (
              <div className="form-group veic-c4">
                <label>Carroceria</label>
                <select value={carroceria} onChange={e => setCarroceria(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Hatch">Hatch</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Minivan">Minivan</option>
                  <option value="Conversível">Conversível</option>
                  <option value="Coupé">Coupé</option>
                  <option value="Perua">Perua / Station Wagon</option>
                  <option value="Furgão">Furgão</option>
                </select>
              </div>
            )}

            {/* ── Linha 5: Precificação ── */}
            <div className="veic-section">Precificação</div>
            <div className="form-group veic-c6">
              <label>Preço de Custo (R$)</label>
              <input
                type="text"
                value={precoCustoStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setPrecoCustoStr(masked)
                  setPrecoCusto(parseMoeda(masked))
                }}
              />
            </div>

            <div className="form-group veic-c6">
              <label>Preço de Venda (R$)</label>
              <input
                type="text"
                value={precoVendaStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setPrecoVendaStr(masked)
                  setPrecoVenda(parseMoeda(masked))
                }}
              />
            </div>

            {isEditing && useAuthStore.getState().user?.papel === 'vendedor' && precoVenda !== veiculo?.preco_venda && (
              <div className="form-group veic-c12" style={{ marginTop: '8px' }}>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--sv-warning)',
                  padding: '12px',
                  borderRadius: 'var(--sv-radius)',
                  fontSize: '13px',
                  color: 'var(--sv-warning)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: 600 }}>⚠️ Alterações de preço solicitadas por vendedores exigem aprovação do gestor.</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase' }}>
                      Motivo do Reajuste de Preço (Obrigatório)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Negociação com cliente, promoção especial..."
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      style={{
                        background: 'var(--sv-input-bg)',
                        border: '1px solid var(--sv-border)',
                        borderRadius: 'var(--sv-radius)',
                        color: 'var(--sv-text)',
                        height: '38px',
                        padding: '0 12px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Linha 6: Opcionais ── */}
            <div className="veic-section">Opcionais</div>
            <div className="form-group veic-c12">
              <div className="opcionais">
                {opcionais.map(o => (
                  <span key={o} className="opc-tag">
                    {o}
                    <button type="button" className="opc-x" onClick={() => removerOpcional(o)} title="Remover">✕</button>
                  </span>
                ))}
                <input
                  className="opc-input"
                  type="text"
                  placeholder="+ Adicionar opcional"
                  value={novoOpcional}
                  onChange={e => setNovoOpcional(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarOpcional() } }}
                  onBlur={adicionarOpcional}
                />
              </div>
            </div>

            {/* ── Linha 7: Rede Social ── */}
            <div className="veic-section" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>Rede Social</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, textTransform: 'none', color: 'var(--sv-text-dim)' }}>
                <input
                  type="checkbox"
                  checked={publicarRedeSocial}
                  onChange={e => setPublicarRedeSocial(e.target.checked)}
                  disabled={midias.length === 0}
                />
                Publicar no story + feed de repasses
              </label>
              {midias.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--sv-warning, #f59e0b)', textTransform: 'none', fontWeight: 400 }}>
                  (Adicione pelo menos 1 foto para publicar)
                </span>
              )}
            </div>

            {publicarRedeSocial && (
              <>
                <div className="form-group veic-c6">
                  <label>Legenda do story</label>
                  <input
                    type="text"
                    placeholder="Ex: Chegou! BMW 320i impecável..."
                    value={legendaStory}
                    onChange={e => setLendaStory(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="form-group veic-c6">
                  <label>Valor de repasse (B2B)</label>
                  <input
                    type="text"
                    placeholder="R$ 0,00"
                    value={valorRepasseStr}
                    onChange={e => {
                      const masked = mascararMoeda(e.target.value)
                      setValorRepasseStr(masked)
                      setValorRepasse(parseMoeda(masked))
                    }}
                    onBlur={() => setValorRepasseStr(mascararMoeda(valorRepasse))}
                  />
                </div>
              </>
            )}

            {/* Card FIPE (M016) — exibido ao editar quando há dado */}
            {isEditing && fipeData?.fipe_disponivel && (
              <div className="form-group veic-c12">
                <div className="custo-total-card" style={{ marginTop: 0 }}>
                  <div className="custo-total-row">
                    <span>Tabela FIPE</span>
                    <span style={{ fontWeight: 600 }}>{formatBRL(fipeData.fipe)}</span>
                  </div>
                  {fipeData.margem_sobre_fipe !== null && (
                    <div className="custo-total-row">
                      <span>Margem sobre FIPE</span>
                      <span style={{ color: fipeData.margem_sobre_fipe >= 0 ? 'var(--sv-success)' : 'var(--sv-error)', fontWeight: 500 }}>
                        {fipeData.margem_sobre_fipe > 0 ? '+' : ''}{fipeData.margem_sobre_fipe}%
                      </span>
                    </div>
                  )}
                  {fipeData.alerta_encalhe && (
                    <div className="custo-total-row" style={{ color: 'var(--sv-warning, #f59e0b)' }}>
                      <span>⚠ Encalhe</span>
                      <span>{fipeData.dias_no_estoque} dias em estoque</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── Aba: Histórico de Custos (Preparação) ── */}
          {aba === 'custos' && (
            <div>
              <div className="custos-head">
                <div>
                  <h4>Custos de preparação</h4>
                  <p>Cada custo vira uma despesa no Financeiro e soma ao custo do veículo. Toque num atalho para lançar rápido:</p>
                </div>
              </div>

              {/* Atalhos de categoria (chips) */}
              <div className="custo-chips">
                {CATEGORIAS_CUSTO.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className="custo-chip"
                    onClick={() => {
                      setCustoNovaCategoria(cat.value)
                      if (!custoNovaDesc.trim() && cat.value !== 'outro') setCustoNovaDesc(cat.label)
                      setCustoForm(true)
                    }}
                  >
                    <span className="plus">+</span> {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              {custos.length > 0 ? (
                <div className="custo-list">
                  {custos.map(c => (
                    <div key={c.id} className="custo-item">
                      <div className="custo-ico">{iconeCategoria(c.categoria)}</div>
                      <div className="custo-desc">
                        <strong>{c.descricao}</strong>
                        <span>{labelCategoria(c.categoria) ? `${labelCategoria(c.categoria)} · ` : ''}{formatData(c.data)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="custo-valor">− {formatBRL(c.valor)}</span>
                        <button className="custo-del" onClick={() => removerCusto(c.id)} title="Remover custo">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !custoForm && (
                  <div className="custos-empty">
                    Sem custos de preparação.<br />
                    Adicione mecânica, pintura, pneus etc. e some ao custo do veículo.
                  </div>
                )
              )}

              {custoForm && (
                <div className="custo-add-form">
                  <div className="form-group">
                    <label>Categoria</label>
                    <select value={custoNovaCategoria} onChange={e => setCustoNovaCategoria(e.target.value)}>
                      <option value="">Selecione</option>
                      {CATEGORIAS_CUSTO.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Descrição do custo</label>
                    <input
                      type="text"
                      placeholder="Ex: 4 pneus novos"
                      value={custoNovaDesc}
                      onChange={e => setCustoNovaDesc(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      value={custoNovoValorStr}
                      onChange={e => setCustoNovoValorStr(mascararMoeda(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-glass btn-sm"
                      onClick={() => { setCustoForm(false); setCustoNovaDesc(''); setCustoNovoValorStr(''); setCustoNovaCategoria('') }}
                    >
                      Cancelar
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={adicionarCusto} disabled={custoSaving}>
                      {custoSaving ? <span className="spinner" /> : 'Lançar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="custo-total-card">
                <div className="custo-total-row">
                  <span>Preço de compra original</span>
                  <span>{formatBRL(precoCompra)}</span>
                </div>
                {totalPreparacao > 0 && (
                  <div className="custo-total-row">
                    <span>+ Custos de preparação ({custos.length})</span>
                    <span style={{ color: 'var(--sv-error)' }}>{formatBRL(totalPreparacao)}</span>
                  </div>
                )}
                <div className="custo-total-row grand">
                  <span>Custo Total Acumulado</span>
                  <span className="custo-total-value">{formatBRL(precoCusto)}</span>
                </div>
              </div>

              {/* Lucro projetado (venda − custo total) */}
              {precoVenda > 0 && (() => {
                const lucro = precoVenda - precoCusto
                const margem = precoVenda > 0 ? (lucro / precoVenda) * 100 : 0
                const cor = lucro >= 0 ? 'var(--sv-success)' : 'var(--sv-error)'
                return (
                  <div className="custo-total-card" style={{ marginTop: 12 }}>
                    <div className="custo-total-row">
                      <span>Preço de venda</span>
                      <span>{formatBRL(precoVenda)}</span>
                    </div>
                    <div className="custo-total-row">
                      <span>− Custo total</span>
                      <span style={{ color: 'var(--sv-error)' }}>{formatBRL(precoCusto)}</span>
                    </div>
                    <div className="custo-total-row grand" style={{ background: 'transparent' }}>
                      <span>Lucro {veiculo?.status === 'vendido' ? 'realizado' : 'projetado'}</span>
                      <span className="custo-total-value" style={{ color: cor }}>
                        {formatBRL(lucro)} <span style={{ fontSize: 13 }}>({margem.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Aba: Venda & Documentos (M018) ── */}
          {aba === 'venda' && (
            <div>
              {/* Comprador vinculado */}
              <div className="custos-head">
                <div>
                  <h4>Comprador</h4>
                  <p>Indique qual cliente adquiriu este veículo pela plataforma.</p>
                </div>
              </div>

              {vendaData?.comprador_id ? (
                <div className="custo-total-card" style={{ marginBottom: 16 }}>
                  <div className="custo-total-row">
                    <span>{vendaData.comprador_nome}</span>
                    <button
                      className="custo-del"
                      title="Desvincular comprador"
                      onClick={async () => {
                        if (!veiculo) return
                        try {
                          await api.delete(`/veiculos/${veiculo.id}/venda/comprador`)
                          setVendaData(v => v ? { ...v, comprador_id: null, comprador_nome: null, comprador_telefone: null } : v)
                        } catch { /* ignore */ }
                      }}
                    >✕</button>
                  </div>
                  {vendaData.comprador_telefone && (
                    <div className="custo-total-row" style={{ fontSize: 13, color: 'var(--sv-text-secondary)' }}>
                      <span>{vendaData.comprador_telefone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <div className="input-icon-wrapper">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar cliente por nome..."
                        value={compradorSearch}
                        onChange={async e => {
                          setCompradorSearch(e.target.value)
                          if (!e.target.value.trim()) { setCompradorResults([]); return }
                          try {
                            const res = await api.get<{ items: any[] }>('/clientes', { q: e.target.value, per_page: '8' })
                            setCompradorResults(res.items || [])
                          } catch { /* ignore */ }
                        }}
                      />
                    </div>
                  </div>
                  {compradorResults.length > 0 && (
                    <div className="custo-list">
                      {compradorResults.map(c => (
                        <div
                          key={c.id}
                          className="custo-item"
                          style={{ cursor: 'pointer' }}
                          onClick={async () => {
                            if (!veiculo) return
                            setVendaSaving(true)
                            try {
                              const res = await api.put<VendaData>(`/veiculos/${veiculo.id}/venda/comprador`, { comprador_id: c.id })
                              setVendaData(v => v ? { ...v, ...res } : res)
                              setCompradorSearch('')
                              setCompradorResults([])
                            } catch { /* ignore */ } finally { setVendaSaving(false) }
                          }}
                        >
                          <div className="custo-desc">
                            <strong>{c.nome}</strong>
                            <span>{c.telefone || c.email || ''}</span>
                          </div>
                          {vendaSaving && <span className="spinner" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documentos */}
              <div className="custos-head" style={{ marginTop: 8 }}>
                <div>
                  <h4>Documentos</h4>
                  <p>Contrato, nota fiscal, garantia e outros arquivos vinculados a esta venda.</p>
                </div>
                <button className="btn btn-glass" style={{ fontSize: 13 }} onClick={() => setDocForm(f => !f)}>
                  + Adicionar
                </button>
              </div>

              {docForm && (
                <div className="custo-add-form" style={{ marginBottom: 12, gridTemplateColumns: '160px 1fr auto' }}>
                  <select value={novoDocTipo} onChange={e => setNovoDocTipo(e.target.value)}>
                    <option value="contrato">Contrato</option>
                    <option value="nota_fiscal">Nota Fiscal</option>
                    <option value="garantia">Garantia</option>
                    <option value="laudo">Laudo</option>
                    <option value="outro">Outro</option>
                  </select>
                  <label className="doc-upload-area" data-active={!!novoDocFile}>
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={e => setNovoDocFile(e.target.files?.[0] ?? null)}
                    />
                    {novoDocFile ? (
                      <span className="doc-upload-name">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {novoDocFile.name}
                      </span>
                    ) : (
                      <span className="doc-upload-placeholder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Selecionar PDF…
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sv-text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" id="doc-visivel" checked={novoDocVisivel} onChange={e => setNovoDocVisivel(e.target.checked)} />
                      Visível na vitrine
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                    <button className="btn btn-glass" onClick={() => { setDocForm(false); setNovoDocFile(null) }}>Cancelar</button>
                    <button
                      className="btn btn-primary"
                      disabled={vendaSaving || !novoDocFile}
                      onClick={async () => {
                        if (!veiculo || !novoDocFile) return
                        setVendaSaving(true)
                        try {
                          const fd = new FormData()
                          fd.append('file', novoDocFile)
                          fd.append('tipo', novoDocTipo)
                          fd.append('visivel_comprador', String(novoDocVisivel))
                          const doc = await api.post<VeiculoDocumento>(`/veiculos/${veiculo.id}/documentos/upload`, fd)
                          setVendaData(v => v ? { ...v, documentos: [...v.documentos, doc] } : v)
                          setNovoDocFile(null); setDocForm(false)
                        } catch { /* ignore */ } finally { setVendaSaving(false) }
                      }}
                    >
                      {vendaSaving ? <span className="spinner" /> : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}

              {vendaData?.documentos?.length ? (
                <div className="doc-list">
                  {vendaData.documentos.map(d => (
                    <div key={d.id} className="doc-item">
                      <svg className="doc-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="doc-item-info">
                        <div className="doc-item-name">{d.nome}</div>
                        <div className="doc-item-meta">{d.tipo} · {formatData(d.created_at)}</div>
                      </div>
                      <span className={`doc-badge ${d.visivel_comprador ? 'doc-badge-visible' : 'doc-badge-internal'}`}>
                        {d.visivel_comprador ? 'Visível' : 'Interno'}
                      </span>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ fontSize: 12, padding: '5px 12px' }}>Abrir</a>
                      <button
                        className="doc-del-btn"
                        title="Remover documento"
                        onClick={async () => {
                          if (!veiculo) return
                          await api.delete(`/veiculos/${veiculo.id}/documentos/${d.id}`)
                          setVendaData(v => v ? { ...v, documentos: v.documentos.filter(x => x.id !== d.id) } : v)
                        }}
                      ><TrashIcon /></button>
                    </div>
                  ))}
                </div>
              ) : (
                !docForm && <div className="custos-empty">Sem documentos. Adicione o contrato, nota fiscal ou garantia.</div>
              )}
            </div>
          )}
          </div>{/* fim modal-form-col */}

          {/* ── Coluna: Galeria de Mídia ── */}
          <div className="modal-gallery-col">
            <div className="modal-gallery-col-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Fotos & Vídeos</span>
              {!isEditing && rascunhoId && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em' }}>
                  RASCUNHO
                </span>
              )}
            </div>
            <div className="modal-gallery-col-body">
              {(isEditing && veiculo) || rascunhoId ? (
                <UploadMidia
                  veiculoId={(isEditing ? veiculo!.id : rascunhoId)!}
                  midias={midias}
                  onChange={(updated) => setMidias(updated)}
                  sidebar
                />
              ) : (
                <UploadMidia
                  veiculoId=""
                  midias={midias}
                  onChange={(updated) => setMidias(updated)}
                  sidebar
                  onRequestUpload={salvarRascunho}
                  salvandoRascunho={salvandoRascunho}
                />
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-glass" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : isEditing ? 'Salvar Alterações' : 'Cadastrar Veículo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL DE VENDA (VenderVeiculo)
   ══════════════════════════════════════════════════════════════ */

type PagamentoTroca = {
  tipo: 'troca'
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao?: number
  ano_modelo?: number
  placa?: string
  km?: number
  cor?: string
  valor: number
  keplaca: boolean
}
type PagamentoItem =
  | PagamentoTroca
  | { tipo: 'dinheiro'; valor: number }
  | { tipo: 'financiamento'; valor: number; parcelas?: number }

export function VenderModal({
  veiculo,
  onClose,
  onSaved,
  onError,
}: {
  veiculo: Veiculo
  onClose: () => void
  onSaved: (contratoId: string) => void
  onError: (msg: string) => void
}) {
  // ── Cliente: existente (busca) ou novo (cadastro rápido) ──
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [quickOpen, setQuickOpen] = useState(false)
  const [clienteNovo, setClienteNovo] = useState<{ nome: string; cpf: string; telefone: string } | null>(null)
  const [qNome, setQNome] = useState('')
  const [qCpf, setQCpf] = useState('')
  const [qTel, setQTel] = useState('')

  // ── Venda e pagamento composto ──
  const [valorStr, setValorStr] = useState(mascararMoeda(veiculo.preco_venda || 0))
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([])
  const [formAberto, setFormAberto] = useState<null | 'troca' | 'dinheiro' | 'financiamento'>(null)

  // Form de troca
  const [tPlaca, setTPlaca] = useState('')
  const [tMarca, setTMarca] = useState('')
  const [tModelo, setTModelo] = useState('')
  const [tAno, setTAno] = useState('')
  const [tKm, setTKm] = useState('')
  const [tValorStr, setTValorStr] = useState('')
  const [tCor, setTCor] = useState('')
  const [tKeplacaHit, setTKeplacaHit] = useState<string | null>(null)
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)

  // Forms de dinheiro / financiamento
  const [dValorStr, setDValorStr] = useState('')
  const [fValorStr, setFValorStr] = useState('')
  const [fParcelas, setFParcelas] = useState('')

  const [saving, setSaving] = useState(false)

  // Fetch clientes
  useEffect(() => {
    if (clienteNovo) return
    const t = setTimeout(async () => {
      try {
        const params: Record<string, string> = { per_page: '10' }
        if (clienteSearch) params.q = clienteSearch
        const res = await api.get<{ items: any[] }>('/clientes', params)
        setClientes(res.items || [])
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [clienteSearch, clienteNovo])

  const valorVenda = parseMoeda(valorStr) || 0
  const composto = Math.round(pagamentos.reduce((s, p) => s + p.valor, 0) * 100) / 100
  const falta = Math.round((valorVenda - composto) * 100) / 100
  const excedente = falta < 0 ? -falta : 0
  const temDinheiro = pagamentos.some(p => p.tipo === 'dinheiro')
  const temFinanciamento = pagamentos.some(p => p.tipo === 'financiamento')

  const fecharForm = () => {
    setFormAberto(null)
    setTPlaca(''); setTMarca(''); setTModelo(''); setTAno(''); setTKm(''); setTValorStr(''); setTCor('')
    setTKeplacaHit(null)
    setDValorStr(''); setFValorStr(''); setFParcelas('')
  }

  // ── Buscar dados da placa da troca (KePlaca, server-side) ──
  const buscarPlacaTroca = async () => {
    const p = tPlaca.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!p) { onError('Informe a placa para buscar.'); return }
    setBuscandoPlaca(true)
    try {
      const res = await api.get<any>(`/veiculos/consulta-placa/${p}`)
      if (!res?.encontrado) {
        setTKeplacaHit(null)
        onError(res?.mensagem || 'Placa não encontrada — preencha os dados manualmente.')
        return
      }
      if (res.marca) setTMarca(res.marca)
      if (res.modelo) setTModelo(res.modelo)
      if (res.ano_modelo) setTAno(String(res.ano_modelo))
      if (res.cor) setTCor(res.cor)
      setTKeplacaHit(
        `${res.marca || ''} ${res.modelo || ''}`.trim()
        + (res.ano_modelo ? ` · ${res.ano_fabricacao || res.ano_modelo}/${res.ano_modelo}` : '')
        + (res.cor ? ` · ${res.cor}` : '')
      )
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao consultar a placa.')
    } finally {
      setBuscandoPlaca(false)
    }
  }

  const adicionarTroca = () => {
    const valor = parseMoeda(tValorStr)
    if (!tMarca.trim() || !tModelo.trim()) { onError('Informe marca e modelo do veículo da troca.'); return }
    if (!valor || valor <= 0) { onError('Informe o valor de avaliação da troca.'); return }
    const ano = tAno ? parseInt(tAno) : undefined
    setPagamentos([...pagamentos, {
      tipo: 'troca',
      marca: tMarca.trim().toUpperCase(),
      modelo: tModelo.trim().toUpperCase(),
      ano_fabricacao: ano,
      ano_modelo: ano,
      placa: tPlaca.trim().toUpperCase() || undefined,
      km: tKm ? parseInt(tKm.replace(/\D/g, '')) : undefined,
      cor: tCor || undefined,
      valor,
      keplaca: !!tKeplacaHit,
    }])
    fecharForm()
  }

  const adicionarDinheiro = () => {
    const valor = parseMoeda(dValorStr)
    if (!valor || valor <= 0) { onError('Informe o valor em dinheiro.'); return }
    setPagamentos([...pagamentos, { tipo: 'dinheiro', valor }])
    fecharForm()
  }

  const adicionarFinanciamento = () => {
    const valor = parseMoeda(fValorStr)
    if (!valor || valor <= 0) { onError('Informe o valor financiado.'); return }
    setPagamentos([...pagamentos, { tipo: 'financiamento', valor, parcelas: fParcelas ? parseInt(fParcelas) : undefined }])
    fecharForm()
  }

  const removerPagamento = (idx: number) => setPagamentos(pagamentos.filter((_, i) => i !== idx))

  const usarClienteNovo = () => {
    if (!qNome.trim()) { onError('Informe ao menos o nome do cliente.'); return }
    setClienteNovo({ nome: qNome.trim(), cpf: qCpf, telefone: qTel })
    setQuickOpen(false)
    setClienteId('')
  }

  const handleSubmit = async () => {
    if (!clienteId && !clienteNovo) {
      onError('Selecione um cliente ou faça o cadastro rápido.')
      return
    }
    const trocas = pagamentos.filter((p): p is PagamentoTroca => p.tipo === 'troca')
    const dinheiro = pagamentos.filter(p => p.tipo === 'dinheiro').reduce((s, p) => s + p.valor, 0)
    const financiamento = pagamentos.find(p => p.tipo === 'financiamento') as { valor: number; parcelas?: number } | undefined
    setSaving(true)
    try {
      const res = await api.post<{ contrato_id: string; trocas_veiculo_ids: string[] }>(`/veiculos/${veiculo.id}/vender`, {
        cliente_id: clienteId || null,
        cliente_novo: clienteNovo ? {
          nome: clienteNovo.nome,
          cpf: clienteNovo.cpf || null,
          telefone: clienteNovo.telefone || null,
        } : null,
        valor_venda: valorVenda || null,
        pagamento_dinheiro: dinheiro || null,
        financiamento: financiamento ? { valor: financiamento.valor, parcelas: financiamento.parcelas || null } : null,
        trocas: trocas.map(t => ({
          marca: t.marca,
          modelo: t.modelo,
          versao: t.versao || null,
          ano_fabricacao: t.ano_fabricacao || null,
          ano_modelo: t.ano_modelo || null,
          placa: t.placa || null,
          km: t.km || 0,
          cor: t.cor || null,
          valor_avaliacao: t.valor,
        })),
      })
      onSaved(res.contrato_id)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao vender veículo')
    } finally {
      setSaving(false)
    }
  }

  const clienteSel = clientes.find(c => c.id === clienteId)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Fechar Venda</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Veículo sendo vendido + valor editável */}
          <div className="fv-veiculo-box">
            <div>
              <div className="fv-nome">{veiculo.marca} {veiculo.modelo}</div>
              <div className="fv-placa">Placa: {veiculo.placa || 'Sem placa'}</div>
            </div>
            <div className="fv-preco">
              <small>Valor da venda</small>
              <input
                type="text"
                value={valorStr}
                onChange={e => setValorStr(mascararMoeda(parseMoeda(e.target.value)))}
              />
            </div>
          </div>

          {/* Cliente / Comprador */}
          <div style={{ position: 'relative' }}>
            <div className="fv-sec-label">Cliente / Comprador</div>

            {clienteNovo ? (
              <div className="fv-cliente-sel">
                <div>
                  <div className="fv-nome">{clienteNovo.nome} <span className="fv-chip fv-chip-novo">novo</span></div>
                  <div className="fv-doc">
                    {[clienteNovo.telefone, clienteNovo.cpf ? `CPF: ${clienteNovo.cpf}` : 'sem CPF'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button type="button" className="fv-link-btn" onClick={() => { setClienteNovo(null); setQNome(''); setQCpf(''); setQTel('') }}>
                  Alterar
                </button>
              </div>
            ) : clienteId ? (
              <div className="fv-cliente-sel">
                <div>
                  <div className="fv-nome">{clienteSel?.nome || 'Cliente Selecionado'}</div>
                  <div className="fv-doc">{clienteSel?.cpf ? `CPF: ${clienteSel.cpf}` : (clienteSel?.telefone || '')}</div>
                </div>
                <button type="button" className="fv-link-btn" onClick={() => { setClienteId(''); setClienteSearch('') }}>
                  Alterar
                </button>
              </div>
            ) : (
              <>
                <div className="fv-field">
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome ou CPF..."
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                  />
                </div>
                {!quickOpen && clienteSearch && clientes.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--sv-surface-solid)', border: '1px solid var(--sv-border)', borderRadius: 6, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                    {clientes.map(c => (
                      <div
                        key={c.id}
                        style={{ cursor: 'pointer', padding: '8px 12px', borderBottom: '1px solid var(--sv-border)' }}
                        onClick={() => { setClienteId(c.id); setClientes([c]) }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>{c.nome}</strong>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>{c.cpf || c.telefone || 'Sem identificador'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!quickOpen && (
                  <div className="fv-hint">
                    Não achou? <button type="button" className="fv-link-btn" onClick={() => setQuickOpen(true)}>+ Cadastro rápido</button>
                  </div>
                )}
                {quickOpen && (
                  <div className="fv-inline-form">
                    <div className="fv-form-title">⚡ Cadastro rápido <span>— o resto completa depois</span></div>
                    <div className="fv-field">
                      <label>Nome completo *</label>
                      <input type="text" value={qNome} onChange={e => setQNome(capitalizarNome(e.target.value))} autoFocus />
                    </div>
                    <div className="fv-row">
                      <div className="fv-field">
                        <label>CPF</label>
                        <input type="text" placeholder="000.000.000-00" value={qCpf} onChange={e => setQCpf(mascararCPF(e.target.value))} />
                      </div>
                      <div className="fv-field">
                        <label>Telefone</label>
                        <input type="text" placeholder="(00) 00000-0000" value={qTel} onChange={e => setQTel(mascararTelefone(e.target.value))} />
                      </div>
                    </div>
                    <div className="fv-form-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuickOpen(false)}>Cancelar</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={usarClienteNovo}>Usar cliente</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagamento componível */}
          <div>
            <div className="fv-sec-label">Pagamento</div>
            <div className="fv-pay-adders">
              <button type="button" className="fv-pay-adder" onClick={() => setFormAberto('troca')}>🚗 Troca</button>
              <button type="button" className="fv-pay-adder" disabled={temDinheiro} onClick={() => setFormAberto('dinheiro')}>💵 Dinheiro</button>
              <button type="button" className="fv-pay-adder" disabled={temFinanciamento} onClick={() => setFormAberto('financiamento')}>🏦 Financiamento</button>
            </div>

            <div className="fv-pay-list">
              {pagamentos.map((p, idx) => (
                <div className="fv-pay-card" key={idx}>
                  <div className="fv-pay-ico">{p.tipo === 'troca' ? '🚗' : p.tipo === 'dinheiro' ? '💵' : '🏦'}</div>
                  <div className="fv-pay-info">
                    {p.tipo === 'troca' ? (
                      <>
                        <div className="fv-t">
                          Troca — {p.marca} {p.modelo}
                          {p.keplaca && <span className="fv-chip fv-chip-keplaca">KePlaca ✓</span>}
                        </div>
                        <div className="fv-s">
                          {[p.placa || 'sem placa', p.ano_modelo ? `${p.ano_fabricacao}/${p.ano_modelo}` : null, 'entra no estoque como rascunho'].filter(Boolean).join(' · ')}
                        </div>
                      </>
                    ) : p.tipo === 'dinheiro' ? (
                      <>
                        <div className="fv-t">Dinheiro / PIX</div>
                        <div className="fv-s">Entrada em espécie</div>
                      </>
                    ) : (
                      <>
                        <div className="fv-t">Financiamento</div>
                        <div className="fv-s">{p.parcelas ? `${p.parcelas}× · banco` : 'banco'}</div>
                      </>
                    )}
                  </div>
                  <div className="fv-pay-valor">{mascararMoeda(p.valor)}</div>
                  <button type="button" className="fv-pay-x" onClick={() => removerPagamento(idx)}>✕</button>
                </div>
              ))}

              {formAberto === 'troca' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">🚗 Adicionar troca</div>
                  <div className="fv-row">
                    <div className="fv-field" style={{ flex: 1.2 }}>
                      <label>Placa</label>
                      <input type="text" placeholder="ABC1D23" value={tPlaca} onChange={e => setTPlaca(e.target.value.toUpperCase())} autoFocus />
                    </div>
                    <div className="fv-field" style={{ flex: 0.9, display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={buscandoPlaca} onClick={buscarPlacaTroca}>
                        {buscandoPlaca ? 'Buscando...' : 'Buscar placa'}
                      </button>
                    </div>
                  </div>
                  {tKeplacaHit && <div className="fv-keplaca-hit">✓ KePlaca: {tKeplacaHit}</div>}
                  <div className="fv-row">
                    <div className="fv-field">
                      <label>Marca *</label>
                      <input type="text" value={tMarca} onChange={e => setTMarca(e.target.value)} />
                    </div>
                    <div className="fv-field">
                      <label>Modelo *</label>
                      <input type="text" value={tModelo} onChange={e => setTModelo(e.target.value)} />
                    </div>
                  </div>
                  <div className="fv-row">
                    <div className="fv-field">
                      <label>Ano</label>
                      <input type="number" placeholder="2020" value={tAno} onChange={e => setTAno(e.target.value)} />
                    </div>
                    <div className="fv-field">
                      <label>KM</label>
                      <input type="text" placeholder="0" value={tKm} onChange={e => setTKm(e.target.value)} />
                    </div>
                    <div className="fv-field">
                      <label>Valor de avaliação *</label>
                      <input type="text" placeholder="R$ 0,00" value={tValorStr} onChange={e => setTValorStr(mascararMoeda(parseMoeda(e.target.value)))} />
                    </div>
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarTroca}>Adicionar</button>
                  </div>
                </div>
              )}

              {formAberto === 'dinheiro' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">💵 Dinheiro / PIX</div>
                  <div className="fv-field">
                    <label>Valor *</label>
                    <input type="text" placeholder="R$ 0,00" value={dValorStr} onChange={e => setDValorStr(mascararMoeda(parseMoeda(e.target.value)))} autoFocus />
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarDinheiro}>Adicionar</button>
                  </div>
                </div>
              )}

              {formAberto === 'financiamento' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">🏦 Financiamento</div>
                  <div className="fv-row">
                    <div className="fv-field">
                      <label>Valor financiado *</label>
                      <input type="text" placeholder="R$ 0,00" value={fValorStr} onChange={e => setFValorStr(mascararMoeda(parseMoeda(e.target.value)))} autoFocus />
                    </div>
                    <div className="fv-field">
                      <label>Parcelas</label>
                      <input type="number" placeholder="Ex: 48" min="1" max="120" value={fParcelas} onChange={e => setFParcelas(e.target.value)} />
                    </div>
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarFinanciamento}>Adicionar</button>
                  </div>
                </div>
              )}

              {pagamentos.length === 0 && !formAberto && (
                <div className="fv-pay-empty">Nenhuma forma de pagamento adicionada ainda</div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé vivo: composto / falta / comissão */}
        <div className="fv-saldo-bar">
          <span className="fv-comp">Composto: <strong>{mascararMoeda(composto)}</strong> de {mascararMoeda(valorVenda)}</span>
          {excedente > 0 ? (
            <span className="fv-saldo-pill fv-pill-comissao">Comissão vendedor: {mascararMoeda(excedente)}</span>
          ) : falta > 0 ? (
            <span className="fv-saldo-pill fv-pill-falta">Falta {mascararMoeda(falta)}</span>
          ) : (
            <span className="fv-saldo-pill fv-pill-ok">✓ Fechado</span>
          )}
        </div>
        {excedente > 0 && (
          <div className="fv-saldo-note">O excedente é lançado como comissão do vendedor no financeiro.</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: 'var(--sv-success)' }}>
            {saving ? 'Registrando...' : 'Confirmar Venda'}
          </button>
        </div>
      </div>
    </div>
  )
}

