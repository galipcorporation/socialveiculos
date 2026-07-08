import { useState, useEffect, useCallback } from 'react'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, FlaskConical, Play, CheckCircle2, XCircle, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararTelefone } from '../lib/mascaras'

// ── Tipos ────────────────────────────────────────────────────────

interface LojaItem {
  id: string
  nome: string
  slug: string
  cidade?: string | null
  estado?: string | null
  telefone?: string | null
  whatsapp?: string | null
  whatsapp_pareado?: string | null
  whatsapp_divergente?: boolean
  ativa: boolean
  created_at: string
}

interface Stats {
  total_lojas: number
  lojas_ativas: number
  total_usuarios: number
  total_veiculos: number
  total_logs_auditoria: number
}

interface LogItem {
  id: string
  acao: string
  loja_id?: string | null
  ator_nome?: string | null
  entidade?: string | null
  entidade_id?: string | null
  detalhes?: string | null
  created_at: string
}

interface NovaLojaForm {
  nome: string
  cidade: string
  estado: string
  gestor_nome: string
  gestor_email: string
  gestor_senha: string
}

const EMPTY_FORM: NovaLojaForm = {
  nome: '',
  cidade: '',
  estado: '',
  gestor_nome: '',
  gestor_email: '',
  gestor_senha: '',
}

// ── Helpers ──────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Sub-componentes ──────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card" style={{ padding: 'var(--sv-space-6)', minWidth: 140 }}>
      <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', marginBottom: 'var(--sv-space-2)' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sv-text-primary)' }}>{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="empty-state" style={{ padding: 'var(--sv-space-12) 0' }}>
      <p style={{ color: 'var(--sv-text-muted)' }}>{msg}</p>
    </div>
  )
}

// ── Modal Nova Loja ──────────────────────────────────────────────

function ModalNovaLoja({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NovaLojaForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const set = (field: keyof NovaLojaForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    try {
      await api.post('/admin/lojas', form)
      onSaved()
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar loja.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Nova Loja</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)' }}>{erro}</p>}

          <div className="form-group">
            <label>Nome da Loja</label>
            <input className="form-input" value={form.nome} onChange={set('nome')} required placeholder="Auto Premium SP" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 'var(--sv-space-3)' }}>
            <div className="form-group">
              <label>Cidade</label>
              <input className="form-input" value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input className="form-input" value={form.estado} onChange={set('estado')} maxLength={2} placeholder="SP" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: 'var(--sv-space-2) 0' }} />
          <p style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-muted)', marginBottom: 0 }}>Gestor inicial</p>

          <div className="form-group">
            <label>Nome do Gestor</label>
            <input className="form-input" value={form.gestor_nome} onChange={set('gestor_nome')} required placeholder="João Silva" />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input className="form-input" type="email" value={form.gestor_email} onChange={set('gestor_email')} required placeholder="joao@loja.com.br" />
          </div>
          <div className="form-group">
            <label>Senha temporária</label>
            <input className="form-input" type="password" value={form.gestor_senha} onChange={set('gestor_senha')} required minLength={6} placeholder="••••••••" />
          </div>

          <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Criar Loja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Aba Overview ─────────────────────────────────────────────────

function AbaOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: 'var(--sv-text-muted)', padding: 'var(--sv-space-8)' }}>Carregando…</p>
  if (!stats) return <EmptyState msg="Não foi possível carregar as estatísticas." />

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sv-space-4)', marginTop: 'var(--sv-space-6)' }}>
      <StatCard label="Total de Lojas" value={stats.total_lojas} />
      <StatCard label="Lojas Ativas" value={stats.lojas_ativas} />
      <StatCard label="Veículos" value={stats.total_veiculos} />
      <StatCard label="Usuários" value={stats.total_usuarios} />
      <StatCard label="Logs de Auditoria" value={stats.total_logs_auditoria} />
    </div>
  )
}

// ── Aba Lojas ────────────────────────────────────────────────────

function AbaLojas() {
  const [lojas, setLojas] = useState<LojaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [lojaEditando, setLojaEditando] = useState<LojaItem | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<LojaItem[]>('/admin/lojas').then(setLojas).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const toggleStatus = async (loja: LojaItem) => {
    setToggleLoading(loja.id)
    try {
      await api.patch(`/admin/lojas/${loja.id}/status`, { ativa: !loja.ativa })
      carregar()
    } finally {
      setToggleLoading(null)
    }
  }

  const impersonar = async (loja: LojaItem) => {
    try {
      const res = await api.post<{ access_token: string; loja_nome: string }>(`/admin/lojas/${loja.id}/impersonar`, {})
      const url = `/impersonar?token=${encodeURIComponent(res.access_token)}&loja=${encodeURIComponent(res.loja_nome)}`
      window.open(url, '_blank')
    } catch (err: any) {
      useUIStore.getState().showError(err.message || 'Erro ao impersonar loja.')
    }
  }

  const lojasFiltradas = lojas.filter((l) =>
    l.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ marginTop: 'var(--sv-space-6)' }}>
      <div style={{ display: 'flex', gap: 'var(--sv-space-3)', marginBottom: 'var(--sv-space-4)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--sv-text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Buscar por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setModalAberto(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nova Loja
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : lojasFiltradas.length === 0 ? (
        <EmptyState msg={busca ? 'Nenhuma loja encontrada para essa busca.' : 'Nenhuma loja cadastrada.'} />
      ) : (
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                {['Nome', 'Cidade / UF', 'WhatsApp', 'Status', 'Criado em', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lojasFiltradas.map((loja) => (
                <tr key={loja.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontWeight: 500 }}>{loja.nome}</td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>
                    {loja.cidade && loja.estado ? `${loja.cidade} / ${loja.estado}` : loja.cidade || loja.estado || '—'}
                  </td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{loja.whatsapp || '—'}</span>
                      {loja.whatsapp_divergente && (
                        <span
                          title={`Número pareado no WhatsApp (${loja.whatsapp_pareado}) diverge do cadastrado`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '1px 8px', borderRadius: 999,
                            fontSize: 'var(--sv-text-xs)', fontWeight: 600,
                            background: 'color-mix(in srgb, var(--sv-warning) 15%, transparent)',
                            color: 'var(--sv-warning)',
                          }}
                        >
                          <AlertTriangle size={11} /> Divergente
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: 'var(--sv-text-xs)',
                      fontWeight: 600,
                      background: loja.ativa ? 'color-mix(in srgb, var(--sv-success) 15%, transparent)' : 'color-mix(in srgb, var(--sv-danger) 15%, transparent)',
                      color: loja.ativa ? 'var(--sv-success)' : 'var(--sv-danger)',
                    }}>
                      {loja.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{fmtData(loja.created_at)}</td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--sv-space-2)' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 'var(--sv-text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setLojaEditando(loja)}
                        title="Editar dados da loja"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 'var(--sv-text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => toggleStatus(loja)}
                        disabled={toggleLoading === loja.id}
                        title={loja.ativa ? 'Desativar' : 'Ativar'}
                      >
                        {loja.ativa ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {loja.ativa ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 'var(--sv-text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => impersonar(loja)}
                        title="Observar como gestor desta loja"
                      >
                        <Eye size={14} /> Observar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && <ModalNovaLoja onClose={() => setModalAberto(false)} onSaved={carregar} />}
      {lojaEditando && (
        <ModalEditarLoja
          loja={lojaEditando}
          onClose={() => setLojaEditando(null)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}

function ModalEditarLoja({ loja, onClose, onSaved }: { loja: LojaItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: loja.nome,
    cidade: loja.cidade || '',
    estado: loja.estado || '',
    telefone: loja.telefone || '',
    whatsapp: loja.whatsapp || '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    try {
      await api.patch(`/admin/lojas/${loja.id}`, form)
      onSaved()
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar loja.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Editar Loja</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)' }}>{erro}</p>}

          <div className="form-group">
            <label>Nome da Loja</label>
            <input className="form-input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 'var(--sv-space-3)' }}>
            <div className="form-group">
              <label>Cidade</label>
              <input className="form-input" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input className="form-input" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))} maxLength={2} style={{ textTransform: 'uppercase' }} />
            </div>
          </div>
          <div className="form-group">
            <label>Telefone</label>
            <input className="form-input" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: mascararTelefone(e.target.value) }))} placeholder="(11) 99999-9999" />
          </div>
          <div className="form-group">
            <label>WhatsApp</label>
            <input className="form-input" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: mascararTelefone(e.target.value) }))} placeholder="(11) 99999-9999" />
            {loja.whatsapp_divergente && (
              <p style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-warning)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Número pareado no WhatsApp ({loja.whatsapp_pareado}) diverge do cadastrado. Confirme qual usar — não é sobrescrito automaticamente.
              </p>
            )}
          </div>

          <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Aba Auditoria ────────────────────────────────────────────────

function AbaAuditoria() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const POR_PAG = 20

  useEffect(() => {
    api.get<LogItem[]>('/admin/auditoria?limit=200').then(setLogs).finally(() => setLoading(false))
  }, [])

  const inicio = (pagina - 1) * POR_PAG
  const paginas = Math.ceil(logs.length / POR_PAG)
  const slice = logs.slice(inicio, inicio + POR_PAG)

  return (
    <div style={{ marginTop: 'var(--sv-space-6)' }}>
      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : logs.length === 0 ? (
        <EmptyState msg="Nenhum log de auditoria registrado." />
      ) : (
        <>
          <div className="glass-card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  {['Ação', 'Entidade', 'Usuário', 'Data'].map((h) => (
                    <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                    <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)' }}>{log.acao}</td>
                    <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{log.entidade || '—'}</td>
                    <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{log.ator_nome || '—'}</td>
                    <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)' }}>{fmtData(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div style={{ display: 'flex', gap: 'var(--sv-space-2)', marginTop: 'var(--sv-space-4)', alignItems: 'center' }}>
              <button className="btn btn-secondary" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)' }}>{pagina} / {paginas}</span>
              <button className="btn btn-secondary" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Aba Erros ────────────────────────────────────────────────────

function fmtDetalhes(detalhes: string | null | undefined): { path?: string; status?: number } {
  if (!detalhes) return {}
  try { return JSON.parse(detalhes) } catch { return {} }
}

function AbaErros() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const POR_PAG = 20

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<LogItem[]>('/admin/erros?limit=200').then(setLogs).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const inicio = (pagina - 1) * POR_PAG
  const paginas = Math.ceil(logs.length / POR_PAG)
  const slice = logs.slice(inicio, inicio + POR_PAG)

  return (
    <div style={{ marginTop: 'var(--sv-space-6)' }}>
      {logs.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sv-space-2)',
          padding: 'var(--sv-space-3) var(--sv-space-4)',
          borderRadius: 'var(--sv-radius)',
          background: 'color-mix(in srgb, var(--sv-warning, #f59e0b) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--sv-warning, #f59e0b) 30%, transparent)',
          marginBottom: 'var(--sv-space-4)',
          fontSize: 'var(--sv-text-sm)',
          color: 'var(--sv-warning, #f59e0b)',
        }}>
          <AlertTriangle size={16} />
          <span>{logs.length} erro{logs.length !== 1 ? 's' : ''} de servidor registrado{logs.length !== 1 ? 's' : ''}. Verifique os logs abaixo.</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : logs.length === 0 ? (
        <EmptyState msg="Nenhum erro de servidor registrado." />
      ) : (
        <>
          <div className="glass-card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  {['Origem', 'Rota', 'Status', 'Request ID', 'Data'].map((h) => (
                    <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((log) => {
                  const det = fmtDetalhes(log.detalhes)
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                      <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 'var(--sv-text-xs)',
                          fontWeight: 600,
                          background: 'color-mix(in srgb, var(--sv-accent) 15%, transparent)',
                          color: 'var(--sv-accent)',
                        }}>
                          {log.entidade || '—'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)' }}>
                        {det.path || '—'}
                      </td>
                      <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 'var(--sv-text-xs)',
                          fontWeight: 700,
                          background: 'color-mix(in srgb, var(--sv-danger) 15%, transparent)',
                          color: 'var(--sv-danger)',
                        }}>
                          {det.status ?? '5xx'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)' }}>
                        {log.entidade_id || '—'}
                      </td>
                      <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)' }}>{fmtData(log.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div style={{ display: 'flex', gap: 'var(--sv-space-2)', marginTop: 'var(--sv-space-4)', alignItems: 'center' }}>
              <button className="btn btn-secondary" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)' }}>{pagina} / {paginas}</span>
              <button className="btn btn-secondary" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          )}
          <div style={{ marginTop: 'var(--sv-space-3)', textAlign: 'right' }}>
            <button className="btn btn-secondary" style={{ fontSize: 'var(--sv-text-xs)' }} onClick={carregar}>
              Atualizar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────

type Aba = 'overview' | 'lojas' | 'auditoria' | 'erros' | 'testes'

const ABAS: { id: Aba; label: string; Icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'lojas', label: 'Lojas', Icon: Building2 },
  { id: 'auditoria', label: 'Auditoria', Icon: ClipboardList },
  { id: 'erros', label: 'Erros', Icon: AlertTriangle },
  { id: 'testes', label: 'Testes', Icon: FlaskConical },
]

export function AdminPage() {
  const [aba, setAba] = useState<Aba>('overview')

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Painel de Administração</h2>
          <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', marginTop: 'var(--sv-space-1)' }}>
            Controle global da plataforma Social Veículos
          </p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--sv-border)', marginTop: 'var(--sv-space-4)' }}>
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sv-space-2)',
              padding: 'var(--sv-space-3) var(--sv-space-5)',
              background: 'none',
              border: 'none',
              borderBottom: aba === id ? '2px solid var(--sv-accent)' : '2px solid transparent',
              color: aba === id ? 'var(--sv-accent)' : 'var(--sv-text-muted)',
              fontWeight: aba === id ? 600 : 400,
              cursor: 'pointer',
              fontSize: 'var(--sv-text-sm)',
              transition: 'all .15s',
              marginBottom: -1,
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {aba === 'overview' && <AbaOverview />}
      {aba === 'lojas' && <AbaLojas />}
      {aba === 'auditoria' && <AbaAuditoria />}
      {aba === 'erros' && <AbaErros />}
      {aba === 'testes' && <AbaTestes />}
    </div>
  )
}

interface ResultadoTestes {
  ok: boolean
  passou: number
  falhou: number
  erros: number
  duracao_s: number
  resumo: string
  saida: string
}

function AbaTestes() {
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoTestes | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const rodar = async () => {
    setRodando(true)
    setErro(null)
    setResultado(null)
    try {
      const r = await api.post<ResultadoTestes>('/admin/testes/rodar')
      setResultado(r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao executar os testes.')
    } finally {
      setRodando(false)
    }
  }

  const cor = resultado?.ok ? '#34d399' : '#ef4444'

  return (
    <div style={{ marginTop: 'var(--sv-space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--sv-text-lg)' }}>Suíte de testes da API</h3>
          <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', marginTop: 4 }}>
            Roda o pytest do backend (auth multi-loja, boot, credenciais) e mostra o resultado.
          </p>
        </div>
        <button
          onClick={rodar}
          disabled={rodando}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 'var(--sv-radius)', border: 'none',
            background: 'var(--sv-primary)', color: '#fff', fontWeight: 600, fontSize: 'var(--sv-text-sm)',
            cursor: rodando ? 'wait' : 'pointer', opacity: rodando ? 0.7 : 1,
          }}
        >
          <Play size={16} />
          {rodando ? 'Rodando…' : 'Rodar testes'}
        </button>
      </div>

      {erro && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 'var(--sv-radius)', background: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444', fontSize: 'var(--sv-text-sm)' }}>
          {erro}
        </div>
      )}

      {rodando && !resultado && (
        <p style={{ marginTop: 20, color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)' }}>
          Executando a suíte (pode levar alguns segundos)…
        </p>
      )}

      {resultado && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 'var(--sv-radius)', border: `1px solid ${cor}`, background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
            {resultado.ok ? <CheckCircle2 size={24} color={cor} /> : <XCircle size={24} color={cor} />}
            <div>
              <div style={{ fontWeight: 700, color: cor }}>{resultado.ok ? 'Todos os testes passaram' : 'Há testes falhando'}</div>
              <div style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-dim)', marginTop: 2 }}>
                {resultado.passou} passou · {resultado.falhou} falhou · {resultado.erros} erro · {resultado.duracao_s}s
              </div>
            </div>
          </div>
          <pre style={{ marginTop: 16, padding: 16, borderRadius: 'var(--sv-radius)', background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', color: 'var(--sv-text-dim)', fontSize: 12, lineHeight: 1.5, maxHeight: 380, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {resultado.saida}
          </pre>
        </div>
      )}
    </div>
  )
}
