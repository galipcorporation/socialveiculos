import { useState, useEffect, useCallback } from 'react'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { SearchSelect } from '../../components/SearchSelect'
import { FileSignature } from 'lucide-react'

/* ── Types ───────────────────────────────────────────────────── */

interface ContratoItem {
  id: string
  loja_id: string
  veiculo_id?: string
  cliente_id?: string
  tipo: string
  status: string
  numero: string
  valor_venda?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
  dados_ocr?: string
  created_at: string
  updated_at: string
  veiculo_nome?: string
  cliente_nome?: string
}

interface ContratoListResponse {
  items: ContratoItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

interface ClienteItem {
  id: string
  nome: string
  cpf?: string
  telefone?: string
}

interface VeiculoItem {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao: number
  ano_modelo: number
  placa?: string
  preco_venda?: number
}

/* ── Helpers ──────────────────────────────────────────────────── */

const formatBRL = (v?: number | null) => {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatData = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()

  if (isToday) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (isYesterday) return `Ontem, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('pt-BR')
}

const TIPO_LABELS: Record<string, string> = {
  compra_venda: 'Compra e Venda',
  consignacao: 'Consignação',
  garantia: 'Garantia',
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
}

const STATUS_CLASSES: Record<string, string> = {
  rascunho: 'status-rascunho',
  aguardando: 'status-aguardando',
  assinado: 'status-assinado',
  cancelado: 'status-cancelado',
}

/* ── Icons ───────────────────────────────────────────────────── */

const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const PdfIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
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

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT — Contratos Page
   ══════════════════════════════════════════════════════════════ */

export function ContratosPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [contratos, setContratos] = useState<ContratoItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  // Modal novo contrato
  const [showModal, setShowModal] = useState(false)

  const toast = (type: 'success' | 'error' | 'info', message: string) => useUIStore.getState().showToast(message, type)

  // ── Fetch contratos ──
  const fetchContratos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), per_page: '20' }
      if (statusFilter) params.status = statusFilter
      if (search) params.q = search
      const data = await api.get<ContratoListResponse>('/contratos', params)
      setContratos(data.items)
      setTotal(data.total)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao carregar contratos', details)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => { fetchContratos() }, [fetchContratos])

  // Auto-open if navigated with contrato_id param
  useEffect(() => {
    const id = searchParams.get('id')
    if (id) {
      // Could scroll-to or highlight the contract
    }
  }, [searchParams])

  // ── Actions ──
  const handleDownloadPdf = async (contrato: ContratoItem) => {
    try {
      const { token } = useAuthStore.getState()
      const { lojaId } = useLojaAtivaStore.getState()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (lojaId) headers['X-Loja-Id'] = lojaId

      const res = await fetch(`/v1/contratos/${contrato.id}/pdf`, { headers })
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch {
      toast('error', 'Erro ao gerar PDF')
    }
  }

  const handleShareWhatsApp = (contrato: ContratoItem) => {
    const texto = `Contrato ${contrato.numero} - ${TIPO_LABELS[contrato.tipo] || contrato.tipo}${contrato.cliente_nome ? ` — ${contrato.cliente_nome}` : ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const handleStatusChange = async (contrato: ContratoItem, newStatus: string) => {
    try {
      await api.patch(`/contratos/${contrato.id}`, { status: newStatus })
      toast('success', `Status alterado para "${STATUS_LABELS[newStatus]}"`)
      fetchContratos()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao alterar status', details)
    }
  }

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>Gestão de Contratos</h2>
          <p>Crie, gerencie e compartilhe contratos de compra e venda, consignação e garantia.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusIcon /> Novo Contrato
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Total</div>
            <div className="kpi-value">{total}</div>
          </div>
          <div className="kpi-icon"><DocIcon /></div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Aguardando</div>
            <div className="kpi-value">{contratos.filter(c => c.status === 'aguardando').length}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'color-mix(in srgb, var(--sv-warning, #f59e0b) 14%, transparent)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-warning, #f59e0b)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Assinados</div>
            <div className="kpi-value">{contratos.filter(c => c.status === 'assinado').length}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'color-mix(in srgb, var(--sv-success) 14%, transparent)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-success)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por número ou observações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'rascunho', 'aguardando', 'assinado'].map(s => (
            <button
              key={s}
              className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {s ? STATUS_LABELS[s] : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Carregando contratos...</p>
        </div>
      ) : contratos.length === 0 ? (
        <div className="empty-state">
          <DocIcon />
          <h3>Nenhum contrato encontrado</h3>
          <p>Crie seu primeiro contrato clicando em "Novo Contrato" ou vendendo um veículo no Estoque.</p>
        </div>
      ) : (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: c.status === 'assinado'
                        ? 'color-mix(in srgb, var(--sv-success) 14%, transparent)'
                        : c.status === 'aguardando'
                          ? 'color-mix(in srgb, var(--sv-warning, #f59e0b) 14%, transparent)'
                          : 'var(--sv-input-bg)',
                      color: c.status === 'assinado' ? 'var(--sv-success)' : c.status === 'aguardando' ? 'var(--sv-warning, #f59e0b)' : 'var(--sv-text-muted)',
                    }}>
                      <PdfIcon />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {TIPO_LABELS[c.tipo] || c.tipo}{c.veiculo_nome ? ` — ${c.veiculo_nome}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>{c.numero}</div>
                    </div>
                  </div>
                </td>
                <td>{c.cliente_nome || '—'}</td>
                <td style={{ color: 'var(--sv-text-muted)' }}>{formatData(c.created_at)}</td>
                <td style={{ fontWeight: 600 }}>{formatBRL(c.valor_venda)}</td>
                <td>
                  <select
                    className={`status-select ${STATUS_CLASSES[c.status] || ''}`}
                    value={c.status}
                    onChange={e => handleStatusChange(c, e.target.value)}
                    style={{ minWidth: 120 }}
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="actions-cell">
                    <button
                      className="action-btn"
                      title="Baixar / Imprimir"
                      onClick={() => handleDownloadPdf(c)}
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      className="action-btn"
                      title="Compartilhar via WhatsApp"
                      onClick={() => handleShareWhatsApp(c)}
                      style={{ color: '#25D366' }}
                    >
                      <WhatsAppIcon />
                    </button>
                    {c.tipo === 'compra_venda' && (
                      <button
                        className="action-btn"
                        title="Emitir NF-e"
                        onClick={() => navigate(`/ferramentas/notas-fiscais?contrato=${c.id}`)}
                      >
                        <FileSignature style={{ width: 18, height: 18 }} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Modal Novo Contrato ── */}
      {showModal && (
        <NovoContratoModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            toast('success', 'Contrato criado com sucesso!')
            fetchContratos()
          }}
        />
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   MODAL — Novo Contrato
   ══════════════════════════════════════════════════════════════ */

function NovoContratoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState('compra_venda')
  const [clienteId, setClienteId] = useState('')
  const [clienteDisplay, setClienteDisplay] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [veiculoDisplay, setVeiculoDisplay] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [entradaStr, setEntradaStr] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)

  // Busca de clientes e veículos
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([])
  const [clienteSearch, setClienteSearch] = useState('')
  const [veiculoSearch, setVeiculoSearch] = useState('')

  const toast = (type: 'success' | 'error' | 'info', message: string) => useUIStore.getState().showToast(message, type)

  // Fetch clientes
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params: Record<string, string> = { per_page: '10' }
        if (clienteSearch) params.q = clienteSearch
        const res = await api.get<{ items: ClienteItem[] }>('/clientes', params)
        setClientes(res.items || [])
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [clienteSearch])

  // Fetch veículos
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params: Record<string, string> = { per_page: '10', status: 'disponivel' }
        if (veiculoSearch) params.q = veiculoSearch
        const res = await api.get<{ items: VeiculoItem[] }>('/veiculos', params)
        setVeiculos(res.items || [])
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [veiculoSearch])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await api.post('/contratos', {
        tipo,
        cliente_id: clienteId || null,
        veiculo_id: veiculoId || null,
        valor_venda: parseMoeda(valorStr) || null,
        valor_entrada: parseMoeda(entradaStr) || null,
        parcelas: parcelas ? parseInt(parcelas) : null,
        observacoes: observacoes || null,
      })
      onSaved()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao criar contrato', details)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Novo Contrato</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            {/* Tipo */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Tipo de Contrato</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="compra_venda">Compra e Venda</option>
                <option value="consignacao">Consignação</option>
                <option value="garantia">Garantia</option>
              </select>
            </div>

            {/* Cliente */}
            <SearchSelect
              label="Cliente"
              placeholder="Buscar por nome ou CPF..."
              value={clienteId}
              displayValue={clienteDisplay}
              options={clientes.map(c => ({ id: c.id, label: c.nome, sub: c.cpf || undefined }))}
              onSearch={setClienteSearch}
              onSelect={(id, label) => { setClienteId(id); setClienteDisplay(label) }}
            />

            {/* Veículo */}
            <SearchSelect
              label="Veículo"
              placeholder="Buscar por marca, modelo ou placa..."
              value={veiculoId}
              displayValue={veiculoDisplay}
              options={veiculos.map(v => ({
                id: v.id,
                label: `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''} (${v.ano_fabricacao}/${v.ano_modelo})`,
                sub: v.placa || undefined,
              }))}
              onSearch={setVeiculoSearch}
              onSelect={(id, label) => { setVeiculoId(id); setVeiculoDisplay(label) }}
            />

            {/* Valores */}
            <div className="form-group">
              <label>Valor da Venda</label>
              <input
                type="text"
                placeholder="R$ 0,00"
                value={valorStr}
                onChange={e => setValorStr(mascararMoeda(parseMoeda(e.target.value)))}
              />
            </div>
            <div className="form-group">
              <label>Entrada</label>
              <input
                type="text"
                placeholder="R$ 0,00"
                value={entradaStr}
                onChange={e => setEntradaStr(mascararMoeda(parseMoeda(e.target.value)))}
              />
            </div>
            <div className="form-group">
              <label>Parcelas</label>
              <input
                type="number"
                placeholder="Ex: 48"
                value={parcelas}
                onChange={e => setParcelas(e.target.value)}
                min="1"
                max="120"
              />
            </div>

            {/* Observações */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Observações</label>
              <textarea
                placeholder="Condições, observações, cláusulas adicionais..."
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar Contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}
