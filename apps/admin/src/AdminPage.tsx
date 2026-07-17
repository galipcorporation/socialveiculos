import { useState, useEffect, useCallback } from 'react'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, Users, Car, Mail, CheckCircle, EyeOff, RefreshCw, Edit, CreditCard, Package, Upload } from 'lucide-react'
import { api } from './lib/api'
import { capitalizarNome, mascararCNPJ, validarCNPJ, mascararMoeda, parseMoeda } from './lib/mascaras'
import { useUIStore } from './stores/uiStore'

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
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
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

// ── Modal Editar Loja & Módulos ──────────────────────────────────

interface ModalEditarLojaProps {
  lojaId: string
  onClose: () => void
  onSaved: () => void
}

function ModalEditarLoja({ lojaId, onClose, onSaved }: ModalEditarLojaProps) {
  const [form, setForm] = useState({
    nome: '',
    cnpj: '',
    cidade: '',
    estado: '',
    telefone: '',
    whatsapp: '',
    modulos_ativos: [] as string[],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [enviandoLogo, setEnviandoLogo] = useState(false)

  useEffect(() => {
    api.get<any>(`/admin/lojas/${lojaId}`)
      .then((data) => {
        setForm({
          nome: data.nome || '',
          cnpj: data.cnpj || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
          telefone: data.telefone || '',
          whatsapp: data.whatsapp || '',
          modulos_ativos: data.modulos_ativos || [],
        })
        setLogoUrl(data.logo_url || null)
      })
      .catch((err) => setErro(err.message || 'Erro ao carregar detalhes da loja.'))
      .finally(() => setLoading(false))
  }, [lojaId])

  const handleUploadLogo = async (file: File) => {
    setEnviandoLogo(true)
    setErro(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await api.post<any>(`/admin/lojas/${lojaId}/logo`, fd)
      setLogoUrl(data.logo_url || null)
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar a logo.')
    } finally {
      setEnviandoLogo(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (field === 'nome' || field === 'cidade') {
      val = capitalizarNome(val)
    } else if (field === 'cnpj') {
      val = mascararCNPJ(val)
    }
    setForm((f) => ({ ...f, [field]: val }))
  }

  const toggleModulo = (modulo: string) => {
    setForm((f) => {
      const ativos = f.modulos_ativos.includes(modulo)
        ? f.modulos_ativos.filter((m) => m !== modulo)
        : [...f.modulos_ativos, modulo]
      return { ...f, modulos_ativos: ativos }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErro(null)

    try {
      await api.patch(`/admin/lojas/${lojaId}`, form)
      onSaved()
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar loja.')
    } finally {
      setSaving(false)
    }
  }

  const ALL_MODULES = [
    { key: 'contratos', label: 'Contratos', desc: 'Geração de termos e contratos com OCR.' },
    { key: 'simulador', label: 'Simulador', desc: 'Simulação multi-banco e impressão de PDF.' },
    { key: 'marketing', label: 'Marketing', desc: 'Geração de posts e criativos via IA.' },
    { key: 'assistente_ia', label: 'Assistente de IA', desc: 'Copiloto de vendas integrado ao WhatsApp.' },
    { key: 'fiscal', label: 'Fiscal / NF-e', desc: 'Emissão de nota fiscal integrada a contratos.' },
    { key: 'site', label: 'Meu Site / Vitrine', desc: 'Site exclusivo integrado com estoque.' },
  ]

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container glass-card" style={{ maxWidth: 560, padding: 32, textAlign: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando dados da loja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h3 className="modal-title">Editar Loja & Módulos</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
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

          {/* Logo da loja — usada em contratos, vitrine e marca-d'água padrão */}
          <div className="form-group">
            <label>Logo da loja</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {logoUrl && (
                <img src={logoUrl} alt="logo" style={{ width: 52, height: 52, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4, border: '1px solid var(--sv-border)' }} />
              )}
              <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Upload size={15} />
                {enviandoLogo ? 'Enviando…' : (logoUrl ? 'Trocar logo' : 'Enviar logo')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={enviandoLogo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); e.target.value = '' }}
                />
              </label>
              <span style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>PNG, JPG ou WEBP · até 2 MB</span>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Telefone</label>
              <input value={form.telefone} onChange={set('telefone')} placeholder="(11) 4002-8922" />
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="5511999999999" />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 0 }}>Módulos Habilitados</p>

          <div className="modulos-grid">
            {ALL_MODULES.map((m) => {
              const ativo = form.modulos_ativos.includes(m.key)
              return (
                <div
                  key={m.key}
                  onClick={() => toggleModulo(m.key)}
                  className={`modulo-item-row${ativo ? ' ativo' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={() => {}} // custom handled by container click
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sv-text)', margin: 0 }}>{m.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--sv-text-muted)', margin: 0 }}>{m.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="modal-footer" style={{ paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Assinaturas (ativação manual via Pix) ─────────────────────────

interface AssinaturaItem {
  id: string
  loja_id: string
  plano_id: string
  status: 'ativa' | 'cancelada' | 'suspensa' | 'expirada'
  inicio: string
  fim?: string | null
  valor_mensal?: number | null
  proximo_vencimento?: string | null
  contrato_aceito_em?: string | null
  contrato_versao?: string | null
  observacoes?: string | null
  criado_por_admin: boolean
  created_at: string
}

interface PagamentoItem {
  id: string
  valor: number
  status: string
  referencia?: string | null
  metodo?: string | null
  data_pagamento?: string | null
  created_at: string
}

interface PlanoItem {
  id: string
  nome: string
  descricao?: string | null
  preco_mensal: number
  modulos_incluidos?: string | null // JSON array string
  ativo: boolean
}

interface AssinaturaDetalhe {
  assinatura: AssinaturaItem | null
  plano: PlanoItem | null
  pagamentos: PagamentoItem[]
  dias_para_vencer: number | null
}

interface VencimentoItem {
  loja_id: string
  loja_nome: string
  assinatura_id: string
  plano_nome: string
  status: string
  valor_mensal?: number | null
  proximo_vencimento?: string | null
  dias_para_vencer?: number | null
}

const STATUS_ASSINATURA_LABEL: Record<string, string> = {
  ativa: 'Ativa', cancelada: 'Cancelada', suspensa: 'Suspensa', expirada: 'Expirada',
}

function corStatusAssinatura(status: string) {
  if (status === 'ativa') return 'var(--sv-success)'
  if (status === 'suspensa' || status === 'expirada') return 'var(--sv-warning)'
  return 'var(--sv-error)'
}

function fmtMoeda(v?: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDataHora(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function BadgeStatusAssinatura({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '12px', fontWeight: 600,
      background: `color-mix(in srgb, ${corStatusAssinatura(status)} 15%, transparent)`,
      color: corStatusAssinatura(status),
    }}>
      {STATUS_ASSINATURA_LABEL[status] || status}
    </span>
  )
}

interface ModalAssinaturaProps {
  lojaId: string
  lojaNome: string
  onClose: () => void
  onSaved: () => void
}

function ModalAssinatura({ lojaId, lojaNome, onClose, onSaved }: ModalAssinaturaProps) {
  const { prompt } = useUIStore()
  const [detalhe, setDetalhe] = useState<AssinaturaDetalhe | null>(null)
  const [planos, setPlanos] = useState<PlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [suspendendo, setSuspendendo] = useState(false)

  const hoje = new Date()
  const versaoContratoPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [form, setForm] = useState({
    plano_id: '',
    valor_mensal: mascararMoeda(99.90),
    meses: '1',
    forma_pagamento: 'pix_manual',
    referencia_pagamento: '',
    contrato_aceito: false,
    contrato_versao: versaoContratoPadrao,
    observacoes: '',
  })

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get<AssinaturaDetalhe>(`/admin/lojas/${lojaId}/assinatura`),
      api.get<PlanoItem[]>('/admin/planos'),
    ])
      .then(([det, todosPlanos]) => {
        const ativos = todosPlanos.filter((p) => p.ativo)
        setDetalhe(det)
        setPlanos(ativos)
        setForm((f) => ({
          ...f,
          plano_id: det.assinatura?.plano_id || ativos[0]?.id || '',
          valor_mensal: mascararMoeda(det.assinatura?.valor_mensal ?? ativos[0]?.preco_mensal ?? 99.90),
        }))
      })
      .catch((err) => setErro(err.message || 'Erro ao carregar assinatura.'))
      .finally(() => setLoading(false))
  }, [lojaId])

  useEffect(() => { carregar() }, [carregar])

  const temAssinaturaAtivavel = detalhe?.assinatura && detalhe.assinatura.status !== 'cancelada'

  const ativar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!form.contrato_aceito) {
      setErro('Confirme que o cliente aceitou o contrato antes de ativar.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/admin/lojas/${lojaId}/assinatura/ativar`, {
        plano_id: form.plano_id,
        valor_mensal: parseMoeda(form.valor_mensal),
        meses: parseInt(form.meses, 10),
        forma_pagamento: form.forma_pagamento,
        referencia_pagamento: form.referencia_pagamento || null,
        contrato_aceito: form.contrato_aceito,
        contrato_versao: form.contrato_versao,
        observacoes: form.observacoes || null,
      })
      onSaved()
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao ativar assinatura.')
    } finally {
      setSaving(false)
    }
  }

  const renovar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setSaving(true)
    try {
      await api.post(`/admin/lojas/${lojaId}/assinatura/renovar`, {
        valor_mensal: form.valor_mensal ? parseMoeda(form.valor_mensal) : null,
        meses: parseInt(form.meses, 10),
        forma_pagamento: form.forma_pagamento,
        referencia_pagamento: form.referencia_pagamento || null,
        observacoes: form.observacoes || null,
      })
      onSaved()
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao renovar assinatura.')
    } finally {
      setSaving(false)
    }
  }

  const suspender = async () => {
    const motivo = await prompt({
      title: 'Suspender assinatura',
      label: 'Motivo',
      placeholder: 'Ex: inadimplência, pedido do cliente...',
      confirmText: 'Suspender',
    }) || undefined
    setSuspendendo(true)
    setErro(null)
    try {
      await api.post(`/admin/lojas/${lojaId}/assinatura/suspender`, { motivo })
      onSaved()
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao suspender assinatura.')
    } finally {
      setSuspendendo(false)
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container glass-card" style={{ maxWidth: 680, padding: 32, textAlign: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando assinatura...</p>
        </div>
      </div>
    )
  }

  const assinatura = detalhe?.assinatura

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3 className="modal-title">Assinatura — {lojaNome}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '78vh', overflowY: 'auto' }}>
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          {/* Estado atual */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)' }}>
            {assinatura ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--sv-text)' }}>{detalhe?.plano?.nome}</span>
                  <BadgeStatusAssinatura status={assinatura.status} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', margin: '2px 0' }}>
                  Valor combinado: <strong>{fmtMoeda(assinatura.valor_mensal)}</strong>/mês
                </p>
                <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', margin: '2px 0' }}>
                  Vencimento: <strong>{fmtDataHora(assinatura.proximo_vencimento)}</strong>
                  {detalhe?.dias_para_vencer != null && (
                    <span style={{ color: detalhe.dias_para_vencer < 0 ? 'var(--sv-error)' : detalhe.dias_para_vencer <= 7 ? 'var(--sv-warning)' : 'var(--sv-text-muted)' }}>
                      {' '}({detalhe.dias_para_vencer < 0 ? `vencida há ${Math.abs(detalhe.dias_para_vencer)}d` : `em ${detalhe.dias_para_vencer}d`})
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', margin: '2px 0' }}>
                  Contrato aceito: {assinatura.contrato_aceito_em
                    ? <strong>{fmtDataHora(assinatura.contrato_aceito_em)} (v{assinatura.contrato_versao})</strong>
                    : <span style={{ color: 'var(--sv-error)' }}>não registrado</span>}
                </p>
                {assinatura.observacoes && (
                  <p style={{ fontSize: 13, color: 'var(--sv-text-muted)', margin: '6px 0 0', fontStyle: 'italic' }}>"{assinatura.observacoes}"</p>
                )}
                {assinatura.status === 'ativa' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: 10, padding: '4px 10px', fontSize: '12px', color: 'var(--sv-error)' }}
                    onClick={suspender}
                    disabled={suspendendo}
                  >
                    {suspendendo ? <span className="spinner" /> : 'Suspender assinatura'}
                  </button>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--sv-text-muted)', margin: 0 }}>Loja ainda não tem assinatura.</p>
            )}
          </div>

          {/* Histórico de pagamentos */}
          {detalhe && detalhe.pagamentos.length > 0 && (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Histórico de Pagamentos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detalhe.pagamentos.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sv-text-dim)', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                    <span>{fmtDataHora(p.data_pagamento || p.created_at)} · {p.metodo || 'gateway'} {p.referencia ? `(${p.referencia})` : ''}</span>
                    <span style={{ fontWeight: 600, color: 'var(--sv-text)' }}>{fmtMoeda(p.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '4px 0' }} />

          {/* Formulário: ativar (nova/cancelada) ou renovar (existente) */}
          <form onSubmit={temAssinaturaAtivavel ? renovar : ativar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
              {temAssinaturaAtivavel ? 'Registrar cobrança / renovar' : 'Ativar assinatura'}
            </p>

            {!temAssinaturaAtivavel && (
              <div className="form-group">
                <label>Plano</label>
                <select value={form.plano_id} onChange={(e) => setForm((f) => ({ ...f, plano_id: e.target.value }))} required>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} — {fmtMoeda(p.preco_mensal)}/mês (tabela)</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px' }}>
              <div className="form-group">
                <label>Valor combinado (R$/mês)</label>
                <input type="text" inputMode="numeric" value={form.valor_mensal} onChange={(e) => setForm((f) => ({ ...f, valor_mensal: mascararMoeda(e.target.value) }))} required={!temAssinaturaAtivavel} placeholder="99,90" />
              </div>
              <div className="form-group">
                <label>Meses pagos</label>
                <input type="number" min="1" max="12" value={form.meses} onChange={(e) => setForm((f) => ({ ...f, meses: e.target.value }))} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={form.forma_pagamento} onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}>
                  <option value="pix_manual">Pix manual</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="boleto">Boleto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Referência / comprovante</label>
                <input value={form.referencia_pagamento} onChange={(e) => setForm((f) => ({ ...f, referencia_pagamento: e.target.value }))} placeholder="ID do Pix (opcional)" />
              </div>
            </div>

            {!temAssinaturaAtivavel && (
              <div className="form-group">
                <label>Versão do contrato aceito</label>
                <input value={form.contrato_versao} onChange={(e) => setForm((f) => ({ ...f, contrato_versao: e.target.value }))} required placeholder="2026-07" />
              </div>
            )}

            <div className="form-group">
              <label>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Ex: fundadora 3x R$99,90, depois vai para R$299,90"
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            {!temAssinaturaAtivavel && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sv-text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.contrato_aceito}
                  onChange={(e) => setForm((f) => ({ ...f, contrato_aceito: e.target.checked }))}
                />
                Confirmo que o cliente aceitou os Termos de Uso e o contrato de assinatura.
              </label>
            )}

            <div className="modal-footer" style={{ paddingTop: '4px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Fechar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : temAssinaturaAtivavel ? 'Registrar pagamento' : 'Ativar assinatura'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Aba Assinaturas (vencimentos) ─────────────────────────────────

function AbaAssinaturas() {
  const [itens, setItens] = useState<VencimentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [janela, setJanela] = useState(30)
  const [lojaSelecionada, setLojaSelecionada] = useState<{ id: string; nome: string } | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<VencimentoItem[]>('/admin/assinaturas/vencendo', { dias: String(janela) })
      .then(setItens)
      .finally(() => setLoading(false))
  }, [janela])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <p style={{ color: 'var(--sv-text-dim)', fontSize: 14, margin: 0 }}>Janela:</p>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            className={`btn ${janela === d ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => setJanela(d)}
          >
            {d} dias
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : itens.length === 0 ? (
        <EmptyState msg="Nenhuma assinatura vencendo ou vencida nessa janela." />
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Loja', 'Plano', 'Valor', 'Vencimento', 'Situação', 'Ações'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => (
                <tr key={it.assinatura_id}>
                  <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{it.loja_nome}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{it.plano_nome}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{fmtMoeda(it.valor_mensal)}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{fmtDataHora(it.proximo_vencimento)}</td>
                  <td>
                    {it.dias_para_vencer != null && it.dias_para_vencer < 0 ? (
                      <span style={{ color: 'var(--sv-error)', fontWeight: 600, fontSize: 12 }}>Vencida há {Math.abs(it.dias_para_vencer)}d</span>
                    ) : (
                      <span style={{ color: 'var(--sv-warning)', fontWeight: 600, fontSize: 12 }}>Vence em {it.dias_para_vencer}d</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setLojaSelecionada({ id: it.loja_id, nome: it.loja_nome })}
                    >
                      <CreditCard size={14} /> Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lojaSelecionada && (
        <ModalAssinatura
          lojaId={lojaSelecionada.id}
          lojaNome={lojaSelecionada.nome}
          onClose={() => setLojaSelecionada(null)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}

// ── Planos (catálogo — CRUD completo) ─────────────────────────────

const TODOS_MODULOS = [
  { key: 'contratos', label: 'Contratos' },
  { key: 'simulador', label: 'Simulador' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'assistente_ia', label: 'Assistente de IA' },
  { key: 'fiscal', label: 'Fiscal / NF-e' },
  { key: 'site', label: 'Meu Site / Vitrine' },
]

interface ModalPlanoProps {
  planoId: string | null // null = criar novo
  onClose: () => void
  onSaved: () => void
}

function ModalPlano({ planoId, onClose, onSaved }: ModalPlanoProps) {
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco_mensal: '',
    modulos_incluidos: [] as string[],
    ativo: true,
  })
  const [loading, setLoading] = useState(!!planoId)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Carrega o plano específico a partir da lista (evita endpoint extra de detalhe)
  useEffect(() => {
    if (!planoId) { setLoading(false); return }
    setLoading(true)
    api.get<PlanoItem[]>('/admin/planos')
      .then((planos) => {
        const p = planos.find((x) => x.id === planoId)
        if (!p) { setErro('Plano não encontrado.'); return }
        setForm({
          nome: p.nome,
          descricao: p.descricao || '',
          preco_mensal: mascararMoeda(p.preco_mensal),
          modulos_incluidos: p.modulos_incluidos ? JSON.parse(p.modulos_incluidos) : [],
          ativo: p.ativo,
        })
      })
      .catch((err) => setErro(err.message || 'Erro ao carregar plano.'))
      .finally(() => setLoading(false))
  }, [planoId])

  const toggleModulo = (modulo: string) => {
    setForm((f) => {
      const ativos = f.modulos_incluidos.includes(modulo)
        ? f.modulos_incluidos.filter((m) => m !== modulo)
        : [...f.modulos_incluidos, modulo]
      return { ...f, modulos_incluidos: ativos }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErro(null)
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        preco_mensal: parseMoeda(form.preco_mensal),
        modulos_incluidos: form.modulos_incluidos,
        ativo: form.ativo,
      }
      if (planoId) {
        await api.patch(`/admin/planos/${planoId}`, payload)
      } else {
        await api.post('/admin/planos', payload)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container glass-card" style={{ maxWidth: 620, padding: 32, textAlign: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando plano...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3 className="modal-title">{planoId ? 'Editar Plano' : 'Novo Plano'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>
            <div className="form-group">
              <label>Nome do Plano</label>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required placeholder="Profissional" />
            </div>
            <div className="form-group">
              <label>Preço (R$/mês)</label>
              <input type="text" inputMode="numeric" value={form.preco_mensal} onChange={(e) => setForm((f) => ({ ...f, preco_mensal: mascararMoeda(e.target.value) }))} required placeholder="299,90" />
            </div>
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Gestão completa + módulos premium"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 0 }}>Módulos Incluídos</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {TODOS_MODULOS.map((m) => {
              const ativo = form.modulos_incluidos.includes(m.key)
              return (
                <div
                  key={m.key}
                  onClick={() => toggleModulo(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--sv-border)',
                    borderRadius: 'var(--sv-radius)', cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <input type="checkbox" checked={ativo} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                  <span style={{ fontSize: '14px', color: 'var(--sv-text)' }}>{m.label}</span>
                </div>
              )
            })}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sv-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Plano ativo (visível para contratação)
          </label>

          <div className="modal-footer" style={{ paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : planoId ? 'Salvar Alterações' : 'Criar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AbaPlanos() {
  const { confirm } = useUIStore()
  const [planos, setPlanos] = useState<PlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [planoEditandoId, setPlanoEditandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<PlanoItem[]>('/admin/planos').then(setPlanos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const toggleAtivo = async (plano: PlanoItem) => {
    setAcaoLoading(plano.id)
    try {
      await api.patch(`/admin/planos/${plano.id}`, { ativo: !plano.ativo })
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar plano.')
      setTimeout(() => setErro(null), 6000)
    } finally {
      setAcaoLoading(null)
    }
  }

  const excluir = async (plano: PlanoItem) => {
    const ok = await confirm({
      title: 'Excluir plano',
      message: `Excluir o plano "${plano.nome}" definitivamente? Só é possível se nenhuma loja estiver vinculada a ele.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    setAcaoLoading(plano.id)
    try {
      await api.delete(`/admin/planos/${plano.id}`)
      carregar()
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir plano.')
      setTimeout(() => setErro(null), 8000)
    } finally {
      setAcaoLoading(null)
    }
  }

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', background: 'color-mix(in srgb, var(--sv-error) 12%, var(--sv-surface))', border: '1px solid color-mix(in srgb, var(--sv-error) 30%, var(--sv-border))', borderLeft: '3px solid var(--sv-error)', borderRadius: 'var(--sv-radius)', fontSize: '14px', color: 'var(--sv-text)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--sv-error)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{erro}</span>
          <button onClick={() => setErro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sv-text-muted)', display: 'flex', padding: '2px' }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={() => { setPlanoEditandoId(null); setModalAberto(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--sv-text-muted)' }}>Carregando…</p>
      ) : planos.length === 0 ? (
        <EmptyState msg="Nenhum plano cadastrado ainda. Crie o primeiro para poder ativar assinaturas." />
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Nome', 'Preço', 'Módulos', 'Status', 'Ações'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => {
                const modulos: string[] = p.modulos_incluidos ? JSON.parse(p.modulos_incluidos) : []
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>
                      {p.nome}
                      {p.descricao && <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', fontWeight: 400, marginTop: 2 }}>{p.descricao}</div>}
                    </td>
                    <td style={{ color: 'var(--sv-text-dim)' }}>{fmtMoeda(p.preco_mensal)}</td>
                    <td style={{ color: 'var(--sv-text-dim)', fontSize: 13 }}>{modulos.length > 0 ? modulos.join(', ') : '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '12px', fontWeight: 600,
                        background: p.ativo ? 'color-mix(in srgb, var(--sv-success) 15%, transparent)' : 'color-mix(in srgb, var(--sv-text-muted) 15%, transparent)',
                        color: p.ativo ? 'var(--sv-success)' : 'var(--sv-text-muted)',
                      }}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => { setPlanoEditandoId(p.id); setModalAberto(true) }}
                        >
                          <Edit size={14} /> Editar
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => toggleAtivo(p)}
                          disabled={acaoLoading === p.id}
                          title={p.ativo ? 'Desativar (não pode mais ser contratado)' : 'Reativar'}
                        >
                          {p.ativo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {p.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--sv-error)' }}
                          onClick={() => excluir(p)}
                          disabled={acaoLoading === p.id}
                          title="Excluir definitivamente (só se nenhuma loja estiver vinculada)"
                        >
                          <X size={14} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <ModalPlano
          planoId={planoEditandoId}
          onClose={() => setModalAberto(false)}
          onSaved={carregar}
        />
      )}
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
  const [lojaEditandoId, setLojaEditandoId] = useState<string | null>(null)
  const [lojaAssinatura, setLojaAssinatura] = useState<{ id: string; nome: string } | null>(null)
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
                        onClick={() => setLojaEditandoId(loja.id)}
                        title="Editar loja e liberar módulos"
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setLojaAssinatura({ id: loja.id, nome: loja.nome })}
                        title="Ativar, renovar ou suspender assinatura (Pix manual)"
                      >
                        <CreditCard size={14} /> Assinatura
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
      {lojaEditandoId && <ModalEditarLoja lojaId={lojaEditandoId} onClose={() => setLojaEditandoId(null)} onSaved={carregar} />}
      {lojaAssinatura && (
        <ModalAssinatura
          lojaId={lojaAssinatura.id}
          lojaNome={lojaAssinatura.nome}
          onClose={() => setLojaAssinatura(null)}
          onSaved={carregar}
        />
      )}
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
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
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
  const { confirm } = useUIStore()
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
    const ok = await confirm({ title: 'Ocultar erros', message: 'Deseja ocultar todos os erros ativos desta visualização?', confirmText: 'Ocultar' })
    if (!ok) return
    try {
      await api.post('/admin/erros/ocultar-todos', {})
      setLogs([])
    } catch (err) {
      console.error(err)
    }
  }

  const restaurarTodos = async () => {
    const ok = await confirm({ title: 'Restaurar erros', message: 'Deseja restaurar todos os erros ocultados para a visualização ativa?', confirmText: 'Restaurar' })
    if (!ok) return
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

type Aba = 'overview' | 'lojas' | 'assinaturas' | 'planos' | 'auditoria' | 'erros'

const ABAS: { id: Aba; label: string; Icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'lojas', label: 'Lojas', Icon: Building2 },
  { id: 'assinaturas', label: 'Assinaturas', Icon: CreditCard },
  { id: 'planos', label: 'Planos', Icon: Package },
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
      {aba === 'assinaturas' && <AbaAssinaturas />}
      {aba === 'planos' && <AbaPlanos />}
      {aba === 'auditoria' && <AbaAuditoria />}
      {aba === 'erros' && <AbaErros />}
    </div>
  )
}
