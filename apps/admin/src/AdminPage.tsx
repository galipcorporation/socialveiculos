import { useState, useEffect, useCallback } from 'react'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, Users, Car, Mail, CheckCircle, EyeOff, RefreshCw } from 'lucide-react'
import { api } from './lib/api'
import { capitalizarNome, mascararCNPJ, validarCNPJ } from './lib/mascaras'

// ── Tipos ────────────────────────────────────────────────────────

interface LojaItem {
  id: string
  nome: string
  slug: string
  cidade?: string | null
  estado?: string | null
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
  visivel?: boolean
  ajusteia?: boolean
}

interface NovaLojaForm {
  nome: string
  cnpj: string
  cidade: string
  estado: string
  gestor_nome: string
  gestor_email: string
  gestor_senha: string
}

const EMPTY_FORM: NovaLojaForm = {
  nome: '',
  cnpj: '',
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

function StatCard({ label, value, Icon }: { label: string; value: number; Icon: any }) {
  return (
    <div className="kpi-card" style={{ flex: 1, minWidth: 200 }}>
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value.toLocaleString('pt-BR')}</p>
      </div>
      <div className="kpi-icon">
        <Icon size={24} />
      </div>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--sv-text-muted)', fontSize: '14px' }}>{msg}</p>
    </div>
  )
}

// ── Modal Nova Loja ──────────────────────────────────────────────

function ModalNovaLoja({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NovaLojaForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const set = (field: keyof NovaLojaForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (field === 'nome' || field === 'cidade' || field === 'gestor_nome') {
      val = capitalizarNome(val)
    } else if (field === 'cnpj') {
      val = mascararCNPJ(val)
    }
    setForm((f) => ({ ...f, [field]: val }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)

    if (form.cnpj && !validarCNPJ(form.cnpj)) {
      setErro('CNPJ inválido.')
      setLoading(false)
      return
    }

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
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h3 className="modal-title">Nova Loja</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
            <div className="form-group">
              <label>Nome da Loja</label>
              <input value={form.nome} onChange={set('nome')} required placeholder="Auto Premium SP" />
            </div>
            <div className="form-group">
              <label>CNPJ</label>
              <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
            <div className="form-group">
              <label>Cidade</label>
              <input value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input value={form.estado} onChange={set('estado')} maxLength={2} placeholder="SP" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 0 }}>Gestor inicial</p>

          <div className="form-group">
            <label>Nome do Gestor</label>
            <input value={form.gestor_nome} onChange={set('gestor_nome')} required placeholder="João Silva" />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={form.gestor_email} onChange={set('gestor_email')} required placeholder="joao@loja.com.br" />
          </div>
          <div className="form-group">
            <label>Senha temporária</label>
            <input type="password" value={form.gestor_senha} onChange={set('gestor_senha')} required minLength={6} placeholder="••••••••" />
          </div>

          <div className="modal-footer" style={{ paddingTop: '16px' }}>
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

  if (loading) return <p style={{ color: 'var(--sv-text-muted)', padding: '32px' }}>Carregando…</p>
  if (!stats) return <EmptyState msg="Não foi possível carregar as estatísticas." />

  return (
    <div className="kpi-grid" style={{ marginTop: '24px' }}>
      <StatCard label="Total de Lojas" value={stats.total_lojas} Icon={Building2} />
      <StatCard label="Lojas Ativas" value={stats.lojas_ativas} Icon={Building2} />
      <StatCard label="Veículos" value={stats.total_veiculos} Icon={Car} />
      <StatCard label="Usuários" value={stats.total_usuarios} Icon={Users} />
      <StatCard label="Logs de Auditoria" value={stats.total_logs_auditoria} Icon={ClipboardList} />
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
  const [erro, setErro] = useState<string | null>(null)

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
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const gestorBase = isDev ? 'http://localhost:5173' : window.location.origin.replace('admin.', 'app.').replace('/admin', '')
      const url = `${gestorBase}/impersonar?token=${encodeURIComponent(res.access_token)}&loja=${encodeURIComponent(res.loja_nome)}`
      window.open(url, '_blank')
    } catch (err: any) {
      setErro(err.message || 'Erro ao impersonar loja.')
      setTimeout(() => setErro(null), 6000)
    }
  }

  const lojasFiltradas = lojas.filter((l) =>
    l.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', background: 'color-mix(in srgb, var(--sv-error) 12%, var(--sv-surface))', border: '1px solid color-mix(in srgb, var(--sv-error) 30%, var(--sv-border))', borderLeft: '3px solid var(--sv-error)', borderRadius: 'var(--sv-radius)', fontSize: '14px', color: 'var(--sv-text)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--sv-error)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{erro}</span>
          <button onClick={() => setErro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sv-text-muted)', display: 'flex', padding: '2px' }}><X size={14} /></button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sv-text-muted)' }} />
          <input
            style={{
              width: '100%',
              height: '40px',
              padding: '0 16px 0 36px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--sv-border)',
              borderRadius: 'var(--sv-radius)',
              color: 'var(--sv-text)',
              fontSize: '14px',
              outline: 'none',
            }}
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
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Nome', 'Cidade / UF', 'Status', 'Criado em', 'Ações'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lojasFiltradas.map((loja) => (
                <tr key={loja.id}>
                  <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{loja.nome}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>
                    {loja.cidade && loja.estado ? `${loja.cidade} / ${loja.estado}` : loja.cidade || loja.estado || '—'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: '12px',
                      fontWeight: 600,
                      background: loja.ativa ? 'color-mix(in srgb, var(--sv-success) 15%, transparent)' : 'color-mix(in srgb, var(--sv-error) 15%, transparent)',
                      color: loja.ativa ? 'var(--sv-success)' : 'var(--sv-error)',
                    }}>
                      {loja.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{fmtData(loja.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => toggleStatus(loja)}
                        disabled={toggleLoading === loja.id}
                        title={loja.ativa ? 'Desativar' : 'Ativar'}
                      >
                        {loja.ativa ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {loja.ativa ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
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
    <div style={{ marginTop: '24px' }}>
      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : logs.length === 0 ? (
        <EmptyState msg="Nenhum log de auditoria registrado." />
      ) : (
        <>
          <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
            <table className="stock-table">
              <thead>
                <tr>
                  {['Ação', 'Entidade', 'Usuário', 'Data'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--sv-text)', fontFamily: 'monospace', fontSize: '12px' }}>{log.acao}</td>
                    <td style={{ color: 'var(--sv-text-dim)' }}>{log.entidade || '—'}</td>
                    <td style={{ color: 'var(--sv-text-dim)' }}>{log.ator_nome || '—'}</td>
                    <td style={{ color: 'var(--sv-text-dim)' }}>{fmtData(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button className="btn btn-secondary" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span style={{ color: 'var(--sv-text-muted)', fontSize: '14px' }}>{pagina} / {paginas}</span>
              <button className="btn btn-secondary" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Aba Erros ────────────────────────────────────────────────────

function fmtDetalhes(detalhes: string | null | undefined): {
  path?: string
  status?: number
  user_name?: string
  user_email?: string
} {
  if (!detalhes) return {}
  try { return JSON.parse(detalhes) } catch { return {} }
}

interface ErroSelecionado {
  id: string
  path: string
  status: number
  user_name: string
  user_email: string
  date: string
}

function ModalContatoErro({
  erro,
  onClose,
}: {
  erro: ErroSelecionado
  onClose: () => void
}) {
  const [template, setTemplate] = useState<'analise' | 'resolvido'>('analise')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (template === 'analise') {
      setMensagem(
        `Olá ${erro.user_name},\n\nIdentificamos que ocorreu um erro (status ${erro.status}) ao acessar a rota ${erro.path} no dia ${erro.date}.\n\nNossa equipe técnica já está analisando o problema para resolvê-lo o quanto antes. Agradecemos sua paciência!\n\nAtenciosamente,\nSuporte Social Veículos`
      )
    } else {
      setMensagem(
        `Olá ${erro.user_name},\n\nO erro (status ${erro.status}) que ocorreu ao acessar a rota ${erro.path} no dia ${erro.date} já foi resolvido pela nossa equipe técnica.\n\nVocê já pode tentar acessar novamente. Se o problema persistir, por favor nos avise.\n\nAtenciosamente,\nSuporte Social Veículos`
      )
    }
  }, [template, erro])

  const handleEnviar = () => {
    const subject = template === 'analise'
      ? 'Estamos analisando o erro relatado - Social Veículos'
      : 'Erro resolvido com sucesso - Social Veículos'

    const mailtoUrl = `mailto:${erro.user_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mensagem)}`
    window.location.href = mailtoUrl
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title">Entrar em Contato</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--sv-radius)', fontSize: '13px', border: '1px solid var(--sv-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
              <span style={{ color: 'var(--sv-text-muted)' }}>Usuário:</span>
              <strong style={{ color: 'var(--sv-text)' }}>{erro.user_name}</strong>
              
              <span style={{ color: 'var(--sv-text-muted)' }}>E-mail:</span>
              <span style={{ color: 'var(--sv-text-dim)', fontFamily: 'monospace' }}>{erro.user_email}</span>
              
              <span style={{ color: 'var(--sv-text-muted)' }}>Erro:</span>
              <span style={{ color: 'var(--sv-error)', fontWeight: 500 }}>Status {erro.status} em {erro.path}</span>
            </div>
          </div>

          <div className="form-group">
            <label style={{ marginBottom: '8px', display: 'block', color: 'var(--sv-text)' }}>Selecione o Template da Mensagem</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: 'var(--sv-text-dim)' }}>
                <input
                  type="radio"
                  name="template-tipo"
                  checked={template === 'analise'}
                  onChange={() => setTemplate('analise')}
                  style={{ cursor: 'pointer' }}
                />
                Em análise
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: 'var(--sv-text-dim)' }}>
                <input
                  type="radio"
                  name="template-tipo"
                  checked={template === 'resolvido'}
                  onChange={() => setTemplate('resolvido')}
                  style={{ cursor: 'pointer' }}
                />
                Resolvido / Corrigido
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Mensagem</label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--sv-border)',
                borderRadius: 'var(--sv-radius)',
                color: 'var(--sv-text)',
                padding: '10px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          <div className="modal-footer" style={{ paddingTop: '16px' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleEnviar}>
              Abrir no E-mail
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
  const [subAba, setSubAba] = useState<'ativos' | 'ocultados'>('ativos')
  const [erroSelecionado, setErroSelecionado] = useState<ErroSelecionado | null>(null)
  const POR_PAG = 20

  const carregar = useCallback(() => {
    setLoading(true)
    const endpoint = subAba === 'ativos' ? '/admin/erros?limit=200' : '/admin/erros/ocultados?limit=200'
    api.get<LogItem[]>(endpoint)
      .then(setLogs)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [subAba])

  useEffect(() => {
    setPagina(1)
    carregar()
  }, [carregar])

  const toggleVisibilidade = async (logId: string, atualVisivel: boolean) => {
    try {
      await api.patch(`/admin/erros/${logId}/visibilidade`, { visivel: !atualVisivel })
      setLogs((prev) => prev.filter((log) => log.id !== logId))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleAjusteIA = async (logId: string, atualAjuste: boolean) => {
    try {
      await api.patch(`/admin/erros/${logId}/ajusteia`, { ajusteia: !atualAjuste })
      setLogs((prev) => prev.map((log) => log.id === logId ? { ...log, ajusteia: !atualAjuste } : log))
    } catch (err) {
      console.error(err)
    }
  }

  const ocultarTodos = async () => {
    if (!window.confirm("Deseja ocultar todos os erros ativos desta visualização?")) return
    try {
      await api.post('/admin/erros/ocultar-todos', {})
      setLogs([])
    } catch (err) {
      console.error(err)
    }
  }

  const restaurarTodos = async () => {
    if (!window.confirm("Deseja restaurar todos os erros ocultados para a visualização ativa?")) return
    try {
      await api.post('/admin/erros/restaurar-todos', {})
      setLogs([])
    } catch (err) {
      console.error(err)
    }
  }

  const inicio = (pagina - 1) * POR_PAG
  const paginas = Math.ceil(logs.length / POR_PAG)
  const slice = logs.slice(inicio, inicio + POR_PAG)

  return (
    <div style={{ marginTop: '24px' }}>
      
      {/* Sub-abas & Ações em Lote */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div className="crm-tabs" style={{ margin: 0, padding: 0, background: 'transparent', border: 'none' }}>
          <button
            onClick={() => setSubAba('ativos')}
            className={`crm-tab-btn ${subAba === 'ativos' ? 'active' : ''}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Ativos
          </button>
          <button
            onClick={() => setSubAba('ocultados')}
            className={`crm-tab-btn ${subAba === 'ocultados' ? 'active' : ''}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Ocultados
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {subAba === 'ativos' && logs.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px 14px' }}
              onClick={ocultarTodos}
            >
              <EyeOff size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              Ocultar todos os ativos
            </button>
          )}
          {subAba === 'ocultados' && logs.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px 14px' }}
              onClick={restaurarTodos}
            >
              <Eye size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              Restaurar todos os ocultados
            </button>
          )}
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={carregar}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {subAba === 'ativos' && logs.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: 'var(--sv-radius)',
          background: 'color-mix(in srgb, var(--sv-warning) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--sv-warning) 30%, transparent)',
          marginBottom: '16px',
          fontSize: '14px',
          color: 'var(--sv-warning)',
        }}>
          <AlertTriangle size={16} />
          <span>{logs.length} erro{logs.length !== 1 ? 's' : ''} de servidor registrado{logs.length !== 1 ? 's' : ''}. Verifique os logs abaixo.</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : logs.length === 0 ? (
        <EmptyState msg={subAba === 'ativos' ? "Nenhum erro de servidor ativo registrado." : "Nenhum erro ocultado."} />
      ) : (
        <>
          <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
            <table className="stock-table">
              <thead>
                <tr>
                  {['Origem', 'Rota', 'Status', 'Usuário', 'Ajuste IA', 'Data', 'Ações'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((log) => {
                  const det = fmtDetalhes(log.detalhes)
                  const user_name = det.user_name || log.ator_nome
                  const user_email = det.user_email
                  return (
                    <tr key={log.id}>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'color-mix(in srgb, var(--sv-primary) 15%, transparent)',
                          color: 'var(--sv-primary)',
                        }}>
                          {log.entidade || '—'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--sv-text)', fontFamily: 'monospace', fontSize: '12px' }}>
                        {det.path || '—'}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '12px',
                          fontWeight: 700,
                          background: 'color-mix(in srgb, var(--sv-error) 15%, transparent)',
                          color: 'var(--sv-error)',
                        }}>
                          {det.status ?? '5xx'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--sv-text)' }}>
                        {user_name ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{user_name}</div>
                            {user_email && <div style={{ fontSize: '12px', color: 'var(--sv-text-dim)' }}>{user_email}</div>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sv-text-muted)' }}>Anônimo</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleAjusteIA(log.id, !!log.ajusteia)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: log.ajusteia ? 'var(--sv-success)' : 'var(--sv-text-muted)',
                            fontWeight: log.ajusteia ? 600 : 'normal',
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                          title={log.ajusteia ? "Marcar como pendente" : "Marcar como resolvido pela IA"}
                        >
                          {log.ajusteia ? (
                            <CheckCircle size={14} style={{ color: 'var(--sv-success)' }} />
                          ) : (
                            <AlertTriangle size={14} style={{ color: 'var(--sv-text-muted)' }} />
                          )}
                          <span>{log.ajusteia ? 'Resolvido (IA)' : 'Pendente'}</span>
                        </button>
                      </td>
                      <td style={{ color: 'var(--sv-text-dim)' }}>{fmtData(log.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {subAba === 'ativos' ? (
                            <>
                              {user_email && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => setErroSelecionado({
                                    id: log.id,
                                    path: det.path || '—',
                                    status: det.status ?? 500,
                                    user_name: user_name || 'Anônimo',
                                    user_email: user_email || '',
                                    date: fmtData(log.created_at)
                                  })}
                                  title="Entrar em contato com o usuário"
                                >
                                  <Mail size={14} /> Contato
                                </button>
                              )}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => toggleVisibilidade(log.id, true)}
                                title="Ocultar da listagem ativa"
                              >
                                <EyeOff size={14} /> Ocultar
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => toggleVisibilidade(log.id, false)}
                              title="Restaurar para listagem ativa"
                            >
                              <Eye size={14} /> Restaurar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button className="btn btn-secondary" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span style={{ color: 'var(--sv-text-muted)', fontSize: '14px' }}>{pagina} / {paginas}</span>
              <button className="btn btn-secondary" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}

      {erroSelecionado && (
        <ModalContatoErro
          erro={erroSelecionado}
          onClose={() => setErroSelecionado(null)}
        />
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────

type Aba = 'overview' | 'lojas' | 'auditoria' | 'erros'

const ABAS: { id: Aba; label: string; Icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'lojas', label: 'Lojas', Icon: Building2 },
  { id: 'auditoria', label: 'Auditoria', Icon: ClipboardList },
  { id: 'erros', label: 'Erros', Icon: AlertTriangle },
]

export function AdminPage() {
  const [aba, setAba] = useState<Aba>('overview')

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Painel de Administração</h2>
          <p style={{ color: 'var(--sv-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Controle global da plataforma Social Veículos
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="crm-tabs">
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`crm-tab-btn ${aba === id ? 'active' : ''}`}
          >
            <Icon size={16} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle', marginTop: '-2px' }} />
            <span style={{ verticalAlign: 'middle' }}>{label}</span>
          </button>
        ))}
      </div>

      {aba === 'overview' && <AbaOverview />}
      {aba === 'lojas' && <AbaLojas />}
      {aba === 'auditoria' && <AbaAuditoria />}
      {aba === 'erros' && <AbaErros />}
    </div>
  )
}
