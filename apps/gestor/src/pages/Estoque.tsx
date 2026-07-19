import { useState, useEffect, useCallback, useRef } from 'react'
import { StatusSelect } from '../components/StatusSelect'
import { FilterStatusSelect } from '../components/FilterStatusSelect'
import { api, extractErrorDetails, type ApiErrorDetails } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { SimuladorModal } from '../components/SimuladorModal'
import { type Veiculo } from '../lib/veiculo'
import {
  CarIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon, ChevLeft, ChevRight, DollarIcon,
} from './estoque/icons'
import { VeiculoModal } from './estoque/VeiculoModal'
import { VenderModal } from './estoque/VenderModal'

/* ── Types ───────────────────────────────────────────────────── */

interface VeiculoListResponse {
  items: Veiculo[]
  total: number
  page: number
  per_page: number
  pages: number
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
  rascunho: 'Rascunho',
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
    if (newValue && (!veiculo.midias || veiculo.midias.length === 0)) {
      addToast('error', 'Adicione pelo menos 1 foto para publicar na vitrine.')
      return
    }
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
    // Ao publicar, exige pelo menos 1 foto (regra da vitrine)
    const elegivel = (v: Veiculo) =>
      v.status === 'disponivel' &&
      v.publicado_marketplace !== newValue &&
      (!newValue || (!!v.midias && v.midias.length > 0))
    const disponiveis = veiculos.filter(elegivel)
    if (disponiveis.length === 0) return

    // Optimistic UI Update
    setVeiculos(prev => prev.map(v =>
      elegivel(v) ? { ...v, publicado_marketplace: newValue } : v
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
        <FilterStatusSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1) }}
        />
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
          <div className="table-scroll">
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
                <th className="col-secondary">Margem</th>
                <th>Status</th>
                <th className="col-secondary">
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
                          <img src={v.midias[0].url} alt={`${v.marca} ${v.modelo}`} loading="lazy" decoding="async" />
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
                  <td className="col-secondary">
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
                  <td className="col-secondary">
                    <label
                      className={`toggle-publish ${v.publicado_marketplace ? 'is-on' : 'is-off'}`}
                      title={!v.publicado_marketplace && (!v.midias || v.midias.length === 0) ? 'Adicione pelo menos 1 foto para publicar' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={v.publicado_marketplace}
                        disabled={!v.publicado_marketplace && (v.status !== 'disponivel' || !v.midias || v.midias.length === 0)}
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
          </div>

          {/* View de cards para mobile */}
          <div className="mobile-vehicle-cards">
            {veiculos.map(v => (
              <div key={v.id} className="mobile-vehicle-card">
                <div className="mobile-vehicle-card-header">
                  {v.midias && v.midias.length > 0 ? (
                    <div className="vehicle-thumb">
                      <img src={v.midias[0].url} alt={`${v.marca} ${v.modelo}`} loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className="vehicle-thumb-placeholder">
                      <CarIcon />
                    </div>
                  )}
                  <div className="mobile-vehicle-card-info">
                    <h4>{v.marca} {v.modelo}</h4>
                    <p>{v.placa || 'Sem placa'} · {v.cor || '—'} · {v.combustivel || '—'}</p>
                  </div>
                </div>

                <div className="mobile-vehicle-card-stats">
                  <div className="mobile-vehicle-card-stat">
                    <span className="mobile-vehicle-card-stat-label">Ano</span>
                    <span className="mobile-vehicle-card-stat-value">{v.ano_fabricacao}/{v.ano_modelo}</span>
                  </div>
                  <div className="mobile-vehicle-card-stat">
                    <span className="mobile-vehicle-card-stat-label">KM</span>
                    <span className="mobile-vehicle-card-stat-value">{formatKm(v.km ?? 0)}</span>
                  </div>
                  <div className="mobile-vehicle-card-stat">
                    <span className="mobile-vehicle-card-stat-label">Preço</span>
                    <span className="mobile-vehicle-card-stat-value price">{formatCurrency(v.preco_venda)}</span>
                  </div>
                </div>

                <div className="mobile-vehicle-card-footer">
                  <StatusSelect
                    value={v.status || 'disponivel'}
                    onChange={newStatus => handleStatusChange(v, newStatus)}
                  />
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
                </div>
              </div>
            ))}
          </div>

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
