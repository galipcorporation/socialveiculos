import { useState, useEffect, useCallback } from 'react'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, FlaskConical, Play, CheckCircle2, XCircle, Pencil, CreditCard, FileText, Check } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararTelefone, mascararMoeda, parseMoeda } from '../lib/mascaras'
import { RichEditor } from '../components/RichEditor'

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
  const [lojaAssinatura, setLojaAssinatura] = useState<LojaItem | null>(null)

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
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 'var(--sv-text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setLojaAssinatura(loja)}
                        title="Gerenciar assinatura desta loja"
                      >
                        <CreditCard size={14} /> Assinatura
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
      {lojaAssinatura && (
        <ModalAssinaturaLoja
          loja={lojaAssinatura}
          onClose={() => setLojaAssinatura(null)}
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

// ── Modal Assinatura ─────────────────────────────────────────────

interface PlanoItem {
  id: string
  nome: string
  descricao?: string | null
  preco_mensal: number
  ativo: boolean
}

interface PagamentoItem {
  id: string
  valor: number
  status: string
  metodo?: string | null
  data_pagamento?: string | null
  created_at: string
}

interface AssinaturaItem {
  id: string
  status: string
  valor_mensal?: number | null
  proximo_vencimento?: string | null
  contrato_versao?: string | null
}

interface AssinaturaDetalhe {
  assinatura: AssinaturaItem | null
  plano: PlanoItem | null
  pagamentos: PagamentoItem[]
  dias_para_vencer: number | null
}

const STATUS_ASSINATURA_LABEL: Record<string, string> = {
  ativa: 'Ativa',
  cancelada: 'Cancelada',
  suspensa: 'Suspensa',
  expirada: 'Expirada',
}

function corStatusAssinatura(status: string) {
  if (status === 'ativa') return 'var(--sv-success)'
  if (status === 'suspensa' || status === 'expirada') return 'var(--sv-danger)'
  return 'var(--sv-text-muted)'
}

function ModalAssinaturaLoja({ loja, onClose }: { loja: LojaItem; onClose: () => void }) {
  const [detalhe, setDetalhe] = useState<AssinaturaDetalhe | null>(null)
  const [planos, setPlanos] = useState<PlanoItem[]>([])
  const [contratoVigente, setContratoVigente] = useState<{ versao: string; conteudo_html: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<'ativar' | 'renovar' | 'suspender' | null>(null)
  const [verContrato, setVerContrato] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [det, listaPlanos] = await Promise.all([
        api.get<AssinaturaDetalhe>(`/admin/lojas/${loja.id}/assinatura`),
        api.get<PlanoItem[]>('/admin/planos'),
      ])
      setDetalhe(det)
      setPlanos(listaPlanos.filter((p) => p.ativo))
    } finally {
      setLoading(false)
    }
  }, [loja.id])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    api.get<{ versao: string; conteudo_html: string }>('/admin/contrato-assinatura/vigente')
      .then(setContratoVigente)
      .catch(() => setContratoVigente(null))
  }, [])

  const assinaturaAtiva = detalhe?.assinatura?.status === 'ativa'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">Assinatura — {loja.nome}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          {loading ? (
            <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
          ) : (
            <>
              {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)' }}>{erro}</p>}

              {detalhe?.assinatura ? (
                <div className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{detalhe.plano?.nome || 'Plano'}</strong>
                    <span style={{
                      padding: '2px 10px', borderRadius: 999, fontSize: 'var(--sv-text-xs)', fontWeight: 600,
                      background: `color-mix(in srgb, ${corStatusAssinatura(detalhe.assinatura.status)} 15%, transparent)`,
                      color: corStatusAssinatura(detalhe.assinatura.status),
                    }}>
                      {STATUS_ASSINATURA_LABEL[detalhe.assinatura.status] || detalhe.assinatura.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-secondary)' }}>
                    {detalhe.assinatura.valor_mensal != null && `R$ ${mascararMoeda(detalhe.assinatura.valor_mensal)}/mês`}
                    {detalhe.assinatura.proximo_vencimento && ` · Vence em ${fmtData(detalhe.assinatura.proximo_vencimento)}`}
                    {detalhe.dias_para_vencer != null && ` (${detalhe.dias_para_vencer >= 0 ? `${detalhe.dias_para_vencer} dias` : 'vencida'})`}
                  </p>
                  {detalhe.assinatura.contrato_versao && (
                    <p style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-muted)' }}>
                      Contrato aceito: versão {detalhe.assinatura.contrato_versao}
                    </p>
                  )}

                  {detalhe.pagamentos.length > 0 && (
                    <div style={{ marginTop: 'var(--sv-space-2)' }}>
                      <p style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-muted)', marginBottom: 4 }}>Histórico de pagamentos</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {detalhe.pagamentos.slice(0, 5).map((p) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-secondary)' }}>
                            <span>{fmtData(p.data_pagamento || p.created_at)} · {p.metodo || '—'}</span>
                            <span>R$ {mascararMoeda(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)' }}>Esta loja ainda não tem assinatura registrada.</p>
              )}

              {!modo && (
                <div style={{ display: 'flex', gap: 'var(--sv-space-2)' }}>
                  <button className="btn btn-primary" onClick={() => setModo('ativar')}>
                    {assinaturaAtiva ? 'Trocar plano' : 'Ativar assinatura'}
                  </button>
                  {assinaturaAtiva && (
                    <>
                      <button className="btn btn-secondary" onClick={() => setModo('renovar')}>Renovar</button>
                      <button className="btn btn-secondary" onClick={() => setModo('suspender')}>Suspender</button>
                    </>
                  )}
                </div>
              )}

              {modo === 'ativar' && (
                <FormAtivarAssinatura
                  loja={loja}
                  planos={planos}
                  contratoVigente={contratoVigente}
                  verContrato={verContrato}
                  onVerContrato={() => setVerContrato((v) => !v)}
                  onCancel={() => setModo(null)}
                  onSaved={() => { setModo(null); carregar() }}
                  onErro={setErro}
                />
              )}
              {modo === 'renovar' && detalhe?.assinatura && (
                <FormRenovarAssinatura
                  loja={loja}
                  assinatura={detalhe.assinatura}
                  onCancel={() => setModo(null)}
                  onSaved={() => { setModo(null); carregar() }}
                  onErro={setErro}
                />
              )}
              {modo === 'suspender' && (
                <FormSuspenderAssinatura
                  loja={loja}
                  onCancel={() => setModo(null)}
                  onSaved={() => { setModo(null); carregar() }}
                  onErro={setErro}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FormAtivarAssinatura({ loja, planos, contratoVigente, verContrato, onVerContrato, onCancel, onSaved, onErro }: {
  loja: LojaItem
  planos: PlanoItem[]
  contratoVigente: { versao: string; conteudo_html: string } | null
  verContrato: boolean
  onVerContrato: () => void
  onCancel: () => void
  onSaved: () => void
  onErro: (msg: string) => void
}) {
  const [planoId, setPlanoId] = useState(planos[0]?.id || '')
  const [valorStr, setValorStr] = useState(mascararMoeda(planos[0]?.preco_mensal || 0))
  const [meses, setMeses] = useState(1)
  const [formaPagamento, setFormaPagamento] = useState('pix_manual')
  const [referencia, setReferencia] = useState('')
  const [contratoAceito, setContratoAceito] = useState(false)
  const [contratoVersao, setContratoVersao] = useState(contratoVigente?.versao || '')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planoId) { onErro('Selecione um plano.'); return }
    if (!contratoAceito) { onErro('É obrigatório confirmar o aceite do contrato antes de ativar.'); return }
    setLoading(true)
    onErro('')
    try {
      await api.post(`/admin/lojas/${loja.id}/assinatura/ativar`, {
        plano_id: planoId,
        valor_mensal: parseMoeda(valorStr),
        meses,
        forma_pagamento: formaPagamento,
        referencia_pagamento: referencia || undefined,
        contrato_aceito: contratoAceito,
        contrato_versao: contratoVersao,
      })
      onSaved()
    } catch (err: any) {
      onErro(err.message || 'Erro ao ativar assinatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-3)' }}>
      <div className="form-group">
        <label>Plano</label>
        <select
          className="form-input"
          value={planoId}
          onChange={(e) => {
            setPlanoId(e.target.value)
            const p = planos.find((x) => x.id === e.target.value)
            if (p) setValorStr(mascararMoeda(p.preco_mensal))
          }}
          required
        >
          <option value="" disabled>Selecione…</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>{p.nome} — R$ {mascararMoeda(p.preco_mensal)}/mês</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 'var(--sv-space-3)' }}>
        <div className="form-group">
          <label>Valor mensal (R$)</label>
          <input className="form-input" value={valorStr} onChange={(e) => setValorStr(mascararMoeda(e.target.value))} required />
        </div>
        <div className="form-group">
          <label>Meses</label>
          <input type="number" className="form-input" min={1} max={12} value={meses} onChange={(e) => setMeses(Number(e.target.value))} required />
        </div>
      </div>
      <div className="form-group">
        <label>Forma de pagamento</label>
        <select className="form-input" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
          <option value="pix_manual">Pix manual</option>
          <option value="gateway">Gateway</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div className="form-group">
        <label>Referência do pagamento (opcional)</label>
        <input className="form-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="ID do comprovante Pix, etc." />
      </div>
      <div className="form-group">
        <label>Versão do contrato aceito</label>
        <input className="form-input" value={contratoVersao} onChange={(e) => setContratoVersao(e.target.value)} required maxLength={20} />
        {contratoVigente && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: 6, fontSize: 'var(--sv-text-xs)', padding: '4px 10px' }} onClick={onVerContrato}>
            {verContrato ? 'Ocultar texto do contrato' : 'Ver texto do contrato vigente'}
          </button>
        )}
        {verContrato && contratoVigente && (
          <div
            className="glass-card"
            style={{ marginTop: 8, padding: 'var(--sv-space-3)', maxHeight: 240, overflow: 'auto', fontSize: 'var(--sv-text-sm)' }}
            dangerouslySetInnerHTML={{ __html: contratoVigente.conteudo_html }}
          />
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sv-text-sm)' }}>
        <input type="checkbox" checked={contratoAceito} onChange={(e) => setContratoAceito(e.target.checked)} />
        Confirmo que o cliente aceitou o contrato de assinatura (nesta versão) antes de ativar.
      </label>

      <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Ativar'}
        </button>
      </div>
    </form>
  )
}

function FormRenovarAssinatura({ loja, assinatura, onCancel, onSaved, onErro }: {
  loja: LojaItem
  assinatura: AssinaturaItem
  onCancel: () => void
  onSaved: () => void
  onErro: (msg: string) => void
}) {
  const [valorStr, setValorStr] = useState(mascararMoeda(assinatura.valor_mensal || 0))
  const [meses, setMeses] = useState(1)
  const [formaPagamento, setFormaPagamento] = useState('pix_manual')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onErro('')
    try {
      await api.post(`/admin/lojas/${loja.id}/assinatura/renovar`, {
        valor_mensal: parseMoeda(valorStr),
        meses,
        forma_pagamento: formaPagamento,
        referencia_pagamento: referencia || undefined,
      })
      onSaved()
    } catch (err: any) {
      onErro(err.message || 'Erro ao renovar assinatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 'var(--sv-space-3)' }}>
        <div className="form-group">
          <label>Valor mensal (R$)</label>
          <input className="form-input" value={valorStr} onChange={(e) => setValorStr(mascararMoeda(e.target.value))} required />
        </div>
        <div className="form-group">
          <label>Meses</label>
          <input type="number" className="form-input" min={1} max={12} value={meses} onChange={(e) => setMeses(Number(e.target.value))} required />
        </div>
      </div>
      <div className="form-group">
        <label>Forma de pagamento</label>
        <select className="form-input" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
          <option value="pix_manual">Pix manual</option>
          <option value="gateway">Gateway</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div className="form-group">
        <label>Referência do pagamento (opcional)</label>
        <input className="form-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="ID do comprovante Pix, etc." />
      </div>
      <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Renovar'}
        </button>
      </div>
    </form>
  )
}

function FormSuspenderAssinatura({ loja, onCancel, onSaved, onErro }: {
  loja: LojaItem
  onCancel: () => void
  onSaved: () => void
  onErro: (msg: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onErro('')
    try {
      await api.post(`/admin/lojas/${loja.id}/assinatura/suspender`, { motivo: motivo || undefined })
      onSaved()
    } catch (err: any) {
      onErro(err.message || 'Erro ao suspender assinatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-3)' }}>
      <p style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-secondary)' }}>
        A loja perde acesso aos módulos premium imediatamente. Use para inadimplência ou cancelamento.
      </p>
      <div className="form-group">
        <label>Motivo (opcional)</label>
        <input className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: inadimplência, cancelamento a pedido…" />
      </div>
      <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'var(--sv-danger)' }}>
          {loading ? <span className="spinner" /> : 'Suspender'}
        </button>
      </div>
    </form>
  )
}

// ── Aba Contrato de Assinatura ────────────────────────────────────

interface ContratoVersaoItem {
  id: string
  versao: string
  conteudo_html: string
  vigente: boolean
  created_at: string
}

function AbaContrato() {
  const [versoes, setVersoes] = useState<ContratoVersaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editorAberto, setEditorAberto] = useState(false)
  const [tornarVigenteLoading, setTornarVigenteLoading] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<ContratoVersaoItem[]>('/admin/contrato-assinatura/versoes').then(setVersoes).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const tornarVigente = async (id: string) => {
    setTornarVigenteLoading(id)
    setErro(null)
    try {
      await api.patch(`/admin/contrato-assinatura/versoes/${id}/tornar-vigente`, {})
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao tornar a versão vigente.')
    } finally {
      setTornarVigenteLoading(null)
    }
  }

  return (
    <div style={{ marginTop: 'var(--sv-space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sv-space-4)' }}>
        <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', maxWidth: 480 }}>
          Texto do contrato de assinatura B2B (Social Veículos ↔ Loja). A versão vigente é a usada por padrão ao ativar uma nova assinatura.
        </p>
        <button className="btn btn-primary" onClick={() => setEditorAberto(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nova versão
        </button>
      </div>

      {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)', marginBottom: 'var(--sv-space-3)' }}>{erro}</p>}

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : versoes.length === 0 ? (
        <EmptyState msg="Nenhuma versão do contrato cadastrada ainda. Clique em “Nova versão” para colar o texto atual." />
      ) : (
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                {['Versão', 'Status', 'Criado em', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontWeight: 500 }}>{v.versao}</td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    {v.vigente ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 10px', borderRadius: 999, fontSize: 'var(--sv-text-xs)', fontWeight: 600,
                        background: 'color-mix(in srgb, var(--sv-success) 15%, transparent)', color: 'var(--sv-success)',
                      }}>
                        <Check size={11} /> Vigente
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-xs)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{fmtData(v.created_at)}</td>
                  <td style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    {!v.vigente && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 'var(--sv-text-xs)' }}
                        onClick={() => tornarVigente(v.id)}
                        disabled={tornarVigenteLoading === v.id}
                      >
                        Tornar vigente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorAberto && (
        <ModalNovaVersaoContrato
          versaoSugerida={versoes[0]?.versao}
          onClose={() => setEditorAberto(false)}
          onSaved={() => { setEditorAberto(false); carregar() }}
        />
      )}
    </div>
  )
}

function ModalNovaVersaoContrato({ versaoSugerida, onClose, onSaved }: { versaoSugerida?: string; onClose: () => void; onSaved: () => void }) {
  const [versao, setVersao] = useState('')
  const [conteudoHtml, setConteudoHtml] = useState('<p>Digite o texto do contrato aqui…</p>')
  const [tornarVigente, setTornarVigente] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    try {
      await api.post('/admin/contrato-assinatura/versoes', {
        versao,
        conteudo_html: conteudoHtml,
        tornar_vigente: tornarVigente,
      })
      onSaved()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar a versão do contrato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
        <div className="modal-header">
          <h3 className="modal-title">Nova versão do contrato</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)' }}>{erro}</p>}

          <div className="form-group">
            <label>Identificador da versão</label>
            <input
              className="form-input"
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder={versaoSugerida ? `Ex: ${versaoSugerida}` : 'Ex: 2026-07'}
              maxLength={20}
              required
            />
          </div>

          <div className="form-group">
            <label>Texto do contrato</label>
            <RichEditor
              value={conteudoHtml}
              onChange={setConteudoHtml}
              variaveis={[]}
              labels={{}}
              minHeight={320}
              placeholder="Digite o texto do contrato…"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sv-text-sm)' }}>
            <input type="checkbox" checked={tornarVigente} onChange={(e) => setTornarVigente(e.target.checked)} />
            Tornar esta a versão vigente
          </label>

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

type Aba = 'overview' | 'lojas' | 'contrato' | 'auditoria' | 'erros' | 'testes'

const ABAS: { id: Aba; label: string; Icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'lojas', label: 'Lojas', Icon: Building2 },
  { id: 'contrato', label: 'Contrato', Icon: FileText },
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
      {aba === 'contrato' && <AbaContrato />}
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
