import { useState, useEffect, useCallback, useRef } from 'react'
import DOMPurify from 'dompurify'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, FlaskConical, Play, CheckCircle2, XCircle, Pencil, CreditCard, FileText, Check, Star, StarOff, Copy } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararTelefone, mascararMoeda, parseMoeda } from '../lib/mascaras'
import { RichEditor } from '../components/RichEditor'
import { PasswordInput } from '../components/PasswordInput'
import { Pagination } from '../components/Pagination'

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
  destaque: boolean
  destaque_ate?: string | null
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
  visivel?: boolean
  ajusteia?: boolean
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
    <div className="glass-card" style={{ padding: 'var(--sv-space-5)', minWidth: 0 }}>
      <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', marginBottom: 'var(--sv-space-2)' }}>{label}</p>
      <p style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, color: 'var(--sv-text-primary)' }}>{value.toLocaleString('pt-BR')}</p>
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
      <div className="modal-container modal-sm glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Nova Loja</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
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
            <PasswordInput className="form-input" value={form.gestor_senha} onChange={set('gestor_senha')} required minLength={6} placeholder="••••••••" style={{ width: '100%' }} />
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
    <div className="admin-stats-grid">
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
  const [lojaDestaque, setLojaDestaque] = useState<LojaItem | null>(null)

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
      // Código de uso único (60s); o token nunca vai na URL (histórico/Referer/logs).
      const res = await api.post<{ codigo: string; loja_nome: string }>(`/admin/lojas/${loja.id}/impersonar`, {})
      const url = `/impersonar?code=${encodeURIComponent(res.codigo)}`
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
      <div className="admin-toolbar">
        <div className="admin-search">
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
        <div className="glass-card admin-table-card">
          <table className="responsive-table" style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                {['Nome', 'Cidade / UF', 'WhatsApp', 'Status', 'Destaque', 'Criado em', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lojasFiltradas.map((loja) => (
                <tr key={loja.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  <td className="cell-title" data-label="Nome" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontWeight: 500 }}>{loja.nome}</td>
                  <td data-label="Cidade / UF" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>
                    {loja.cidade && loja.estado ? `${loja.cidade} / ${loja.estado}` : loja.cidade || loja.estado || '—'}
                  </td>
                  <td data-label="WhatsApp" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                  <td data-label="Status" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
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
                  <td data-label="Destaque" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    {loja.destaque ? (
                      <span
                        title={loja.destaque_ate ? `Vence em ${fmtData(loja.destaque_ate)}` : 'Sem prazo definido'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 10px', borderRadius: 999,
                          fontSize: 'var(--sv-text-xs)', fontWeight: 600,
                          background: 'color-mix(in srgb, #f5a623 15%, transparent)',
                          color: '#f5a623',
                        }}>
                        <Star size={11} /> Patrocinada
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-xs)' }}>—</span>
                    )}
                  </td>
                  <td data-label="Criado em" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{fmtData(loja.created_at)}</td>
                  <td className="cell-actions" data-label="Ações" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--sv-space-2)', flexWrap: 'wrap' }}>
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
                        onClick={() => setLojaDestaque(loja)}
                        title="Gerenciar destaque (patrocínio) desta loja na vitrine"
                      >
                        {loja.destaque ? <StarOff size={14} /> : <Star size={14} />}
                        Destaque
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
      {lojaDestaque && (
        <ModalDestaqueLoja
          loja={lojaDestaque}
          onClose={() => setLojaDestaque(null)}
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
      <div className="modal-container modal-sm glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Editar Loja</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
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
      <div className="modal-container modal-md glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Assinatura — {loja.nome}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contratoVigente.conteudo_html) }}
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

// ── Modal Destaque (patrocínio na vitrine) ────────────────────────

interface DestaquePagamentoItem {
  id: string
  valor: number
  meses: number
  status: string
  metodo?: string | null
  data_pagamento?: string | null
  destaque_ate_resultante?: string | null
  created_at: string
}

interface DestaqueDetalhe {
  destaque: boolean
  destaque_ate?: string | null
  dias_para_vencer: number | null
  pagamentos: DestaquePagamentoItem[]
}

function ModalDestaqueLoja({ loja, onClose, onSaved }: { loja: LojaItem; onClose: () => void; onSaved: () => void }) {
  const [detalhe, setDetalhe] = useState<DestaqueDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<'ativar' | 'desativar' | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const det = await api.get<DestaqueDetalhe>(`/admin/lojas/${loja.id}/destaque`)
      setDetalhe(det)
    } finally {
      setLoading(false)
    }
  }, [loja.id])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Destaque na vitrine — {loja.nome}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-4)' }}>
          {loading ? (
            <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
          ) : (
            <>
              {erro && <p style={{ color: 'var(--sv-danger)', fontSize: 'var(--sv-text-sm)' }}>{erro}</p>}

              {detalhe?.destaque ? (
                <div className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Star size={14} color="#f5a623" /> Patrocinada</strong>
                    <span style={{
                      padding: '2px 10px', borderRadius: 999, fontSize: 'var(--sv-text-xs)', fontWeight: 600,
                      background: 'color-mix(in srgb, #f5a623 15%, transparent)', color: '#f5a623',
                    }}>
                      Ativo
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-secondary)' }}>
                    {detalhe.destaque_ate ? `Vence em ${fmtData(detalhe.destaque_ate)}` : 'Sem prazo definido'}
                    {detalhe.dias_para_vencer != null && ` (${detalhe.dias_para_vencer >= 0 ? `${detalhe.dias_para_vencer} dias` : 'vencido'})`}
                  </p>

                  {detalhe.pagamentos.length > 0 && (
                    <div style={{ marginTop: 'var(--sv-space-2)' }}>
                      <p style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-muted)', marginBottom: 4 }}>Histórico de pagamentos</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {detalhe.pagamentos.slice(0, 5).map((p) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-secondary)' }}>
                            <span>{fmtData(p.data_pagamento || p.created_at)} · {p.metodo || '—'} · {p.meses}m</span>
                            <span>R$ {mascararMoeda(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)' }}>Esta loja não tem destaque ativo no momento.</p>
              )}

              {!modo && (
                <div style={{ display: 'flex', gap: 'var(--sv-space-2)' }}>
                  <button className="btn btn-primary" onClick={() => setModo('ativar')}>
                    {detalhe?.destaque ? 'Estender destaque' : 'Ativar destaque'}
                  </button>
                  {detalhe?.destaque && (
                    <button className="btn btn-secondary" onClick={() => setModo('desativar')}>Remover destaque</button>
                  )}
                </div>
              )}

              {modo === 'ativar' && (
                <FormAtivarDestaque
                  loja={loja}
                  onCancel={() => setModo(null)}
                  onSaved={() => { setModo(null); carregar(); onSaved() }}
                  onErro={setErro}
                />
              )}
              {modo === 'desativar' && (
                <FormDesativarDestaque
                  loja={loja}
                  onCancel={() => setModo(null)}
                  onSaved={() => { setModo(null); carregar(); onSaved() }}
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

function FormAtivarDestaque({ loja, onCancel, onSaved, onErro }: {
  loja: LojaItem
  onCancel: () => void
  onSaved: () => void
  onErro: (msg: string) => void
}) {
  const [valorStr, setValorStr] = useState(mascararMoeda(0))
  const [meses, setMeses] = useState(1)
  const [formaPagamento, setFormaPagamento] = useState('pix_manual')
  const [referencia, setReferencia] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onErro('')
    try {
      await api.post(`/admin/lojas/${loja.id}/destaque/ativar`, {
        valor: parseMoeda(valorStr),
        meses,
        forma_pagamento: formaPagamento,
        referencia_pagamento: referencia || undefined,
        observacoes: observacoes || undefined,
      })
      onSaved()
    } catch (err: any) {
      onErro(err.message || 'Erro ao ativar destaque.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 'var(--sv-space-3)' }}>
        <div className="form-group">
          <label>Valor cobrado (R$)</label>
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
        <label>Observações (opcional)</label>
        <input className="form-input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <p style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-muted)' }}>
        O prazo é somado a partir do vencimento atual (se ainda não expirou) ou de hoje. Os veículos da loja passam a aparecer priorizados no feed público imediatamente.
      </p>
      <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Confirmar cobrança e ativar'}
        </button>
      </div>
    </form>
  )
}

function FormDesativarDestaque({ loja, onCancel, onSaved, onErro }: {
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
      await api.post(`/admin/lojas/${loja.id}/destaque/desativar`, { motivo: motivo || undefined })
      onSaved()
    } catch (err: any) {
      onErro(err.message || 'Erro ao remover destaque.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: 'var(--sv-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sv-space-3)' }}>
      <p style={{ fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-secondary)' }}>
        A loja perde a priorização no feed público imediatamente. Use para cancelamento antes do vencimento.
      </p>
      <div className="form-group">
        <label>Motivo (opcional)</label>
        <input className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: cancelamento a pedido…" />
      </div>
      <div className="modal-footer" style={{ paddingTop: 'var(--sv-space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'var(--sv-danger)' }}>
          {loading ? <span className="spinner" /> : 'Remover destaque'}
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
      <div className="admin-section-head">
        <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', maxWidth: 480, minWidth: 0 }}>
          Texto do contrato de assinatura (Social Veículos ↔ Loja). A versão vigente é a usada por padrão ao ativar uma nova assinatura.
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
        <div className="glass-card admin-table-card">
          <table className="responsive-table" style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
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
                  <td className="cell-title" data-label="Versão" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontWeight: 500 }}>{v.versao}</td>
                  <td data-label="Status" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
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
                  <td data-label="Criado em" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{fmtData(v.created_at)}</td>
                  <td className="cell-actions" data-label="Ações" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
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
      <div className="modal-container modal-lg glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Nova versão do contrato</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
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
          <Pagination
            pagina={pagina}
            totalItens={logs.length}
            itensPorPagina={POR_PAG}
            totalPaginas={paginas}
            onPaginaChange={setPagina}
            nomeEntidade="logs"
            compacto
          />
          <div className="glass-card admin-table-card">
            <table className="responsive-table" style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
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
                    <td className="cell-title" data-label="Ação" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)', wordBreak: 'break-word' }}>{log.acao}</td>
                    <td data-label="Entidade" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{log.entidade || '—'}</td>
                    <td data-label="Usuário" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-secondary)' }}>{log.ator_nome || '—'}</td>
                    <td data-label="Data" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)' }}>{fmtData(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            pagina={pagina}
            totalItens={logs.length}
            itensPorPagina={POR_PAG}
            totalPaginas={paginas}
            onPaginaChange={setPagina}
            nomeEntidade="logs"
          />
        </>
      )}
    </div>
  )
}

// ── Aba Erros ────────────────────────────────────────────────────

function fmtDetalhes(detalhes: string | null | undefined): {
  path?: string
  method?: string
  status?: number
  user_name?: string
  user_email?: string
  mensagem?: string
  tipo_excecao?: string
  detalhe_tecnico?: string
  traceback?: string
  stack?: string
  timestamp?: string
} {
  if (!detalhes) return {}
  try { return JSON.parse(detalhes) } catch { return {} }
}

function formatarErroTexto(log: LogItem): string {
  const det = fmtDetalhes(log.detalhes)
  const user_name = det.user_name || log.ator_nome || 'Anônimo'
  const user_email = det.user_email || 'Não informado'

  let txt = `[ERRO REGISTRADO - SOCIAL VEÍCULOS]
----------------------------------------
ID do Log: ${log.id}
Data: ${new Date(log.created_at).toLocaleString('pt-BR')}
Origem: ${log.entidade || '—'}
Rota: ${det.path || '—'}
Status HTTP: ${det.status ?? '5xx'}
Tipo Exceção: ${det.tipo_excecao || '—'}
Usuário: ${user_name} (${user_email})
Request ID: ${log.entidade_id || '—'}
Status IA: ${log.ajusteia ? 'Resolvido (IA)' : 'Pendente'}`

  if (det.detalhe_tecnico || det.mensagem) {
    txt += `\nMensagem: ${det.detalhe_tecnico || det.mensagem}`
  }

  if (det.traceback || det.stack) {
    txt += `\n\n[Traceback / Pilha Técnica]:\n${det.traceback || det.stack}`
  }

  txt += `\n\n[Detalhes JSON]:\n${log.detalhes || '{}'}`
  return txt
}

function formatarListaErrosTexto(logs: LogItem[]): string {
  if (logs.length === 0) return 'Nenhum erro registrado.'
  let txt = `=== RELATÓRIO DE ERROS REGISTRADOS (${logs.length} item(ns)) ===
Gerado em: ${new Date().toLocaleString('pt-BR')}

`
  logs.forEach((log, index) => {
    txt += `--- Erro #${index + 1} ---\n${formatarErroTexto(log)}\n\n`
  })
  return txt
}

function ModalDetalhesErro({
  log,
  onClose,
  onToggleAjusteIA,
}: {
  log: LogItem
  onClose: () => void
  onToggleAjusteIA?: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [copiadoJson, setCopiadoJson] = useState(false)
  const [copiadoTb, setCopiadoTb] = useState(false)
  const [mostrarTraceback, setMostrarTraceback] = useState(true)
  const det = fmtDetalhes(log.detalhes)
  const user_name = det.user_name || log.ator_nome || 'Anônimo'
  const user_email = det.user_email
  const pilhaTecnica = det.traceback || det.stack

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(formatarErroTexto(log))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const handleCopiarJson = () => {
    const raw = JSON.stringify({
      id: log.id,
      acao: log.acao,
      entidade: log.entidade,
      request_id: log.entidade_id,
      detalhes: det,
      created_at: log.created_at,
    }, null, 2)
    navigator.clipboard.writeText(raw)
    setCopiadoJson(true)
    setTimeout(() => setCopiadoJson(false), 2000)
  }

  const handleCopiarTraceback = () => {
    if (!pilhaTecnica) return
    navigator.clipboard.writeText(pilhaTecnica)
    setCopiadoTb(true)
    setTimeout(() => setCopiadoTb(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--sv-danger, #ef4444)' }} />
            <h3 className="modal-title">Detalhes do Erro</h3>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body modal-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '16px',
            borderRadius: 'var(--sv-radius)',
            border: '1px solid var(--sv-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>ORIGEM</span>
              <span style={{ fontWeight: 600, color: 'var(--sv-primary)' }}>{log.entidade || '—'}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>ROTA</span>
              <code style={{ fontSize: '12px', color: 'var(--sv-text-primary)', wordBreak: 'break-all' }}>{det.path || '—'}</code>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>STATUS</span>
              <span style={{ fontWeight: 700, color: 'var(--sv-danger, #ef4444)' }}>HTTP {det.status ?? 500}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>TIPO DA EXCEÇÃO</span>
              <span style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 600,
                color: det.tipo_excecao ? 'var(--sv-danger, #ef4444)' : 'var(--sv-text-muted)',
                background: det.tipo_excecao ? 'color-mix(in srgb, var(--sv-danger) 12%, transparent)' : 'transparent',
                padding: det.tipo_excecao ? '2px 6px' : '0',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                {det.tipo_excecao || '—'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>DATA E HORA</span>
              <span style={{ fontSize: '13px', color: 'var(--sv-text-muted)' }}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>USUÁRIO</span>
              <span style={{ fontWeight: 600, color: 'var(--sv-text-primary)', fontSize: '13px' }}>{user_name}</span>
              {user_email && <div style={{ fontSize: '12px', color: 'var(--sv-text-muted)' }}>{user_email}</div>}
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>REQUEST ID</span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--sv-text-muted)' }}>{log.entidade_id || '—'}</span>
            </div>
          </div>

          {(det.detalhe_tecnico || det.mensagem) && (
            <div style={{
              background: 'color-mix(in srgb, var(--sv-danger, #ef4444) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--sv-danger, #ef4444) 25%, transparent)',
              padding: '14px',
              borderRadius: 'var(--sv-radius)',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sv-danger, #ef4444)', display: 'block', marginBottom: '4px' }}>
                MENSAGEM DE EXCEÇÃO
              </span>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--sv-text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace'
              }}>
                {det.detalhe_tecnico || det.mensagem}
              </pre>
            </div>
          )}

          {pilhaTecnica && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setMostrarTraceback(v => !v)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--sv-danger, #ef4444)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{mostrarTraceback ? '▼' : '▶'}</span>
                  <span>TRACEBACK / PILHA TÉCNICA</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopiarTraceback}
                  style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {copiadoTb ? <Check size={12} style={{ color: 'var(--sv-success, #10b981)' }} /> : <Copy size={12} />}
                  {copiadoTb ? 'Traceback Copiado!' : 'Copiar Traceback'}
                </button>
              </div>
              {mostrarTraceback && (
                <pre style={{
                  background: '#0d1117',
                  border: '1px solid color-mix(in srgb, var(--sv-danger, #ef4444) 30%, transparent)',
                  padding: '12px',
                  borderRadius: 'var(--sv-radius)',
                  fontSize: '11px',
                  color: '#f87171',
                  fontFamily: 'monospace',
                  maxHeight: '240px',
                  overflow: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {pilhaTecnica}
                </pre>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sv-text-muted)' }}>
                DADOS DO LOG (JSON)
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopiarJson}
                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copiadoJson ? <Check size={12} style={{ color: 'var(--sv-success, #10b981)' }} /> : <Copy size={12} />}
                {copiadoJson ? 'JSON Copiado!' : 'Copiar JSON'}
              </button>
            </div>
            <pre style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--sv-border)',
              padding: '12px',
              borderRadius: 'var(--sv-radius)',
              fontSize: '12px',
              color: '#34d399',
              fontFamily: 'monospace',
              maxHeight: '180px',
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {JSON.stringify(det, null, 2)}
            </pre>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
          <div>
            {onToggleAjusteIA && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onToggleAjusteIA}
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {log.ajusteia ? <CheckCircle2 size={14} style={{ color: 'var(--sv-success, #10b981)' }} /> : <AlertTriangle size={14} />}
                {log.ajusteia ? 'Resolvido (IA)' : 'Marcar Resolvido'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopiarTexto}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />}
              {copiado ? 'Copiado!' : 'Copiar Resumo'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '12px' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AbaErros() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [logDetalhes, setLogDetalhes] = useState<LogItem | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [copiadoTodos, setCopiadoTodos] = useState(false)
  const POR_PAG = 20

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<LogItem[]>('/admin/erros?limit=200').then(setLogs).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const copiarSingleLog = (log: LogItem) => {
    navigator.clipboard.writeText(formatarErroTexto(log))
    setCopiadoId(log.id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  const copiarTodosErros = () => {
    navigator.clipboard.writeText(formatarListaErrosTexto(logs))
    setCopiadoTodos(true)
    setTimeout(() => setCopiadoTodos(false), 2000)
  }

  const inicio = (pagina - 1) * POR_PAG
  const paginas = Math.ceil(logs.length / POR_PAG)
  const slice = logs.slice(inicio, inicio + POR_PAG)

  return (
    <div style={{ marginTop: 'var(--sv-space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sv-space-4)', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0, color: 'var(--sv-text-primary)', fontSize: 'var(--sv-text-base)', fontWeight: 600 }}>Erros de Servidor Registrados</h4>
        {logs.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 'var(--sv-text-xs)', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={copiarTodosErros}
            title="Copiar todos os erros em formato de texto"
          >
            {copiadoTodos ? <Check size={14} style={{ color: 'var(--sv-success, #10b981)' }} /> : <Copy size={14} />}
            {copiadoTodos ? 'Lista Copiada!' : 'Copiar Todos os Erros'}
          </button>
        )}
      </div>

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
          <Pagination
            pagina={pagina}
            totalItens={logs.length}
            itensPorPagina={POR_PAG}
            totalPaginas={paginas}
            onPaginaChange={setPagina}
            nomeEntidade="erros"
            compacto
          />
          <div className="glass-card admin-table-card">
            <table className="responsive-table" style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 'var(--sv-text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sv-border)' }}>
                  {['Origem', 'Rota', 'Status', 'Request ID', 'Data', 'Ações'].map((h) => (
                    <th key={h} style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', textAlign: 'left', color: 'var(--sv-text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((log) => {
                  const det = fmtDetalhes(log.detalhes)
                  const isCopiado = copiadoId === log.id

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--sv-border)' }}>
                      <td data-label="Origem" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
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
                      <td data-label="Rota" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-primary)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)', wordBreak: 'break-all' }}>
                        {det.path || '—'}
                      </td>
                      <td data-label="Status" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
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
                      <td data-label="Request ID" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)', fontFamily: 'monospace', fontSize: 'var(--sv-text-xs)', wordBreak: 'break-all' }}>
                        {log.entidade_id || '—'}
                      </td>
                      <td data-label="Data" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)', color: 'var(--sv-text-muted)' }}>{fmtData(log.created_at)}</td>
                      <td className="cell-actions" data-label="Ações" style={{ padding: 'var(--sv-space-3) var(--sv-space-4)' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: 'var(--sv-text-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => copiarSingleLog(log)}
                            title="Copiar resumo do erro"
                          >
                            {isCopiado ? <Check size={13} style={{ color: 'var(--sv-success, #10b981)' }} /> : <Copy size={13} />}
                            {isCopiado ? 'Copiado' : 'Copiar'}
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: 'var(--sv-text-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setLogDetalhes(log)}
                            title="Ver detalhes do erro"
                          >
                            <FileText size={13} /> Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            pagina={pagina}
            totalItens={logs.length}
            itensPorPagina={POR_PAG}
            totalPaginas={paginas}
            onPaginaChange={setPagina}
            nomeEntidade="erros"
          />
          <div style={{ marginTop: 'var(--sv-space-3)', textAlign: 'right' }}>
            <button className="btn btn-secondary" style={{ fontSize: 'var(--sv-text-xs)' }} onClick={carregar}>
              Atualizar
            </button>
          </div>
        </>
      )}

      {logDetalhes && (
        <ModalDetalhesErro
          log={logDetalhes}
          onClose={() => setLogDetalhes(null)}
          onToggleAjusteIA={() => {
            api.patch(`/admin/erros/${logDetalhes.id}/ajusteia`, { ajusteia: !logDetalhes.ajusteia })
              .then(() => {
                setLogDetalhes({ ...logDetalhes, ajusteia: !logDetalhes.ajusteia })
                carregar()
              })
              .catch(() => {})
          }}
        />
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

      {/* Abas — rolam na horizontal quando não cabem (mobile) */}
      <div className="admin-tabs" role="tablist">
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`admin-tab${aba === id ? ' is-active' : ''}`}
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

interface ItemTeste {
  id: string
  arquivo: string
  nome: string
  categoria: string
  descricao: string
}

type TestStatus = 'idle' | 'running' | 'passed' | 'failed'

function AbaTestes() {
  const [itens, setItens] = useState<ItemTeste[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [statusMap, setStatusMap] = useState<Record<string, { status: TestStatus; resultado?: ResultadoTestes; erro?: string }>>({})
  const [executandoGeral, setExecutandoGeral] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [itemInspecao, setItemInspecao] = useState<{ item: ItemTeste; resultado?: ResultadoTestes; erro?: string } | null>(null)
  const cancelarRef = useRef(false)

  // Carrega a lista de testes disponíveis no backend
  const carregarLista = useCallback(async () => {
    setLoadingLista(true)
    try {
      const data = await api.get<ItemTeste[]>('/admin/testes/lista')
      setItens(data)
    } catch {
      // Fallback estático caso endpoint não responda
      setItens([
        { id: 'test_smoke.py', arquivo: 'test_smoke.py', nome: 'Smoke Tests (Boot e Rotas)', categoria: 'Núcleo', descricao: 'Valida boot da API, OpenAPI e rotas essenciais' },
        { id: 'test_auth_multiloja.py', arquivo: 'test_auth_multiloja.py', nome: 'Autenticação Multi-loja', categoria: 'Segurança', descricao: 'Valida JWT, isolamento de login e roles' },
        { id: 'test_tenant_isolation.py', arquivo: 'test_tenant_isolation.py', nome: 'Isolamento Tenant Multi-loja', categoria: 'Segurança', descricao: 'Garante que nenhuma concessionária acesse dados de outra' },
        { id: 'test_mfa.py', arquivo: 'test_mfa.py', nome: 'Autenticação em Duas Etapas (MFA)', categoria: 'Segurança', descricao: 'Validação de 2FA TOTP e backup codes' },
      ])
    } finally {
      setLoadingLista(false)
    }
  }, [])

  useEffect(() => {
    carregarLista()
  }, [carregarLista])

  // Executa um teste individual
  const executarItem = async (item: ItemTeste) => {
    setStatusMap(prev => ({
      ...prev,
      [item.id]: { status: 'running' }
    }))

    try {
      const r = await api.post<ResultadoTestes>('/admin/testes/executar_item', { arquivo: item.arquivo })
      setStatusMap(prev => ({
        ...prev,
        [item.id]: {
          status: r.ok ? 'passed' : 'failed',
          resultado: r
        }
      }))
      return r
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na execução.'
      setStatusMap(prev => ({
        ...prev,
        [item.id]: {
          status: 'failed',
          erro: msg
        }
      }))
      return null
    }
  }

  // Executa todos os testes sequencialmente em checklist
  const executarTodosSequencial = async (listaAlvo?: ItemTeste[]) => {
    const lista = listaAlvo || itens
    if (lista.length === 0) return

    setExecutandoGeral(true)
    cancelarRef.current = false

    for (const item of lista) {
      if (cancelarRef.current) break
      await executarItem(item)
    }

    setExecutandoGeral(false)
  }

  const cancelarExecucao = () => {
    cancelarRef.current = true
    setExecutandoGeral(false)
  }

  // Estatísticas do checklist
  const categorias = ['todos', ...Array.from(new Set(itens.map(i => i.categoria)))]
  const totalItens = itens.length
  const concluidos = Object.values(statusMap).filter(s => s.status === 'passed' || s.status === 'failed').length
  const totalPassou = Object.values(statusMap).reduce((acc, s) => acc + (s.resultado?.passou || 0), 0)
  const totalFalhou = Object.values(statusMap).reduce((acc, s) => acc + (s.resultado?.falhou || 0) + (s.resultado?.erros || 0), 0)
  const percentual = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0

  const itensFiltrados = itens.filter(i => {
    const matchCat = filtroCategoria === 'todos' || i.categoria === filtroCategoria
    const matchBusca = !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.arquivo.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  })

  return (
    <div style={{ marginTop: 'var(--sv-space-5)' }}>
      {/* Header com resumo e ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--sv-text-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
            Checklist de Testes Automatizados
            <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: 'var(--sv-primary)' }}>
              {totalItens} módulos
            </span>
          </h3>
          <p style={{ color: 'var(--sv-text-muted)', fontSize: 'var(--sv-text-sm)', marginTop: 4 }}>
            Execução individualizada teste por teste para validação contínua sem tempo de espera ou timeout.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {executandoGeral ? (
            <button
              onClick={cancelarExecucao}
              className="btn btn-danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <X size={16} /> Pausar Execução
            </button>
          ) : (
            <>
              <button
                onClick={() => executarTodosSequencial(itens.filter(i => i.arquivo === 'test_smoke.py' || i.arquivo === 'test_auth_multiloja.py'))}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                title="Executar apenas smoke tests essenciais"
              >
                ⚡ Smoke Tests (Rápido)
              </button>
              <button
                onClick={() => executarTodosSequencial()}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Play size={16} /> Iniciar Checklist Completo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra de Progresso e Métricas */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--sv-text)' }}>
              Progresso: {concluidos} de {totalItens} ({percentual}%)
            </span>
            <span style={{ color: 'var(--sv-success)', fontWeight: 600 }}>
              ✅ {totalPassou} asserções passaram
            </span>
            {totalFalhou > 0 && (
              <span style={{ color: 'var(--sv-danger)', fontWeight: 600 }}>
                ❌ {totalFalhou} falha(s)
              </span>
            )}
          </div>
          {executandoGeral && (
            <span style={{ fontSize: 12, color: 'var(--sv-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="spinner" style={{ width: 14, height: 14 }} /> Executando checklist item a item...
            </span>
          )}
        </div>

        {/* Linha de progresso */}
        <div style={{ width: '100%', height: 8, background: 'var(--sv-border)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${percentual}%`,
              height: '100%',
              background: totalFalhou > 0 ? 'var(--sv-danger)' : 'var(--sv-primary)',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`btn btn-sm ${filtroCategoria === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '4px 10px', textTransform: 'capitalize' }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-wrapper" style={{ width: 260 }}>
          <Search size={14} />
          <input
            className="search-input"
            type="text"
            placeholder="Filtrar por nome ou arquivo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ padding: '6px 10px 6px 32px', fontSize: 12 }}
          />
        </div>
      </div>

      {/* Lista / Checklist */}
      {loadingLista ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Carregando catálogo de testes...</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {itensFiltrados.map((item, idx) => {
              const info = statusMap[item.id]
              const st = info?.status || 'idle'
              const res = info?.resultado

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderTop: idx > 0 ? '1px solid var(--sv-border)' : 'none',
                    background: st === 'running' ? 'rgba(59,130,246,0.06)' : st === 'failed' ? 'rgba(239,68,68,0.06)' : 'transparent',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    {/* Status Icon */}
                    <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {st === 'idle' && (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--sv-text-muted)', opacity: 0.5 }} />
                      )}
                      {st === 'running' && (
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                      )}
                      {st === 'passed' && (
                        <CheckCircle2 size={18} color="var(--sv-success)" />
                      )}
                      {st === 'failed' && (
                        <XCircle size={18} color="var(--sv-danger)" />
                      )}
                    </div>

                    {/* Test Info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--sv-text)' }}>
                          {item.nome}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--sv-surface)', border: '1px solid var(--sv-border)', color: 'var(--sv-text-dim)' }}>
                          {item.categoria}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-muted)', fontFamily: 'monospace' }}>
                          {item.arquivo}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginTop: 2 }}>
                        {item.descricao}
                      </div>
                    </div>
                  </div>

                  {/* Right actions and stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {res && (
                      <span style={{ fontSize: 12, color: res.ok ? 'var(--sv-success)' : 'var(--sv-danger)', fontWeight: 500 }}>
                        {res.resumo} ({res.duracao_s}s)
                      </span>
                    )}

                    {info?.erro && (
                      <span style={{ fontSize: 12, color: 'var(--sv-danger)' }}>
                        {info.erro}
                      </span>
                    )}

                    {res?.saida && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setItemInspecao({ item, resultado: res })}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Ver log de execução"
                      >
                        <FileText size={13} /> Log
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => executarItem(item)}
                      disabled={st === 'running' || executandoGeral}
                      style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Play size={12} /> {st === 'passed' ? 'Reexecutar' : 'Testar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de Detalhes / Log do Teste */}
      {itemInspecao && (
        <div className="modal-overlay" onClick={() => setItemInspecao(null)}>
          <div className="modal-glass" style={{ maxWidth: 700, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{itemInspecao.item.nome}</h3>
                <span style={{ fontSize: 12, color: 'var(--sv-text-dim)', fontFamily: 'monospace' }}>
                  {itemInspecao.item.arquivo}
                </span>
              </div>
              <button className="modal-close" onClick={() => setItemInspecao(null)} aria-label="Fechar"><X /></button>
            </div>

            <div className="modal-body">
              {itemInspecao.resultado && (
                <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 12,
                    background: itemInspecao.resultado.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: itemInspecao.resultado.ok ? 'var(--sv-success)' : 'var(--sv-danger)',
                  }}>
                    {itemInspecao.resultado.ok ? 'PASSED' : 'FAILED'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
                    {itemInspecao.resultado.resumo} · Duração: {itemInspecao.resultado.duracao_s}s
                  </span>
                </div>
              )}

              <pre style={{
                margin: 0,
                padding: 14,
                borderRadius: 'var(--sv-radius)',
                background: 'var(--sv-bg)',
                border: '1px solid var(--sv-border)',
                color: 'var(--sv-text-dim)',
                fontSize: 12,
                lineHeight: 1.5,
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {itemInspecao.resultado?.saida || itemInspecao.erro || 'Sem saída registrada.'}
              </pre>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setItemInspecao(null)}>Fechar</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  executarItem(itemInspecao.item).then(res => {
                    if (res) setItemInspecao({ item: itemInspecao.item, resultado: res })
                  })
                }}
              >
                Reexecutar Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
