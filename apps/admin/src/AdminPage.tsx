import { useState, useEffect, useCallback, Fragment } from 'react'
import { Shield, Building2, ClipboardList, AlertTriangle, Plus, ToggleLeft, ToggleRight, Eye, Search, X, Users, Car, Mail, CheckCircle, EyeOff, RefreshCw, Edit, CreditCard, Package, Upload, KeyRound, FileText, FlaskConical, Play, XCircle, Star, Download, Printer, Send, Copy, Check, Sparkles, Activity } from 'lucide-react'
import { api } from './lib/api'
import { capitalizarNome, mascararCNPJ, validarCNPJ, mascararMoeda, parseMoeda, mascararTelefone } from './lib/mascaras'
import { useUIStore } from './stores/uiStore'
import { RichEditor } from './components/RichEditor'
import { PasswordInput } from './components/PasswordInput'
import { CATALOGO_VARIAVEIS_ASSINATURA, LABELS_VARIAVEIS_ASSINATURA } from './lib/variaveisContratoAssinatura'

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
  destaque?: boolean
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

function LoadingState({ msg = 'Carregando…' }: { msg?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0', textAlign: 'center' }}>
      <span className="spinner" />
      <p style={{ color: 'var(--sv-text-muted)', fontSize: '14px', margin: 0 }}>{msg}</p>
    </div>
  )
}

function ErroAlerta({ msg, onFechar }: { msg: string; onFechar?: () => void }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', background: 'color-mix(in srgb, var(--sv-error) 12%, var(--sv-surface))', border: '1px solid color-mix(in srgb, var(--sv-error) 30%, var(--sv-border))', borderLeft: '3px solid var(--sv-error)', borderRadius: 'var(--sv-radius)', fontSize: '14px', color: 'var(--sv-text)' }}>
      <AlertTriangle size={16} style={{ color: 'var(--sv-error)', flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{msg}</span>
      {onFechar && (
        <button onClick={onFechar} aria-label="Fechar aviso" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sv-text-muted)', display: 'flex', padding: '2px' }}><X size={14} /></button>
      )}
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
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Nova Loja</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body modal-form-grid">
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <div className="form-group">
            <label>Nome da Loja</label>
            <input value={form.nome} onChange={set('nome')} required placeholder="Auto Premium SP" />
          </div>
          <div className="form-group">
            <label>CNPJ</label>
            <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
          </div>

          <div className="form-group">
            <label>Cidade</label>
            <input value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" />
          </div>
          <div className="form-group">
            <label>UF</label>
            <input value={form.estado} onChange={set('estado')} maxLength={2} placeholder="SP" style={{ textTransform: 'uppercase' }} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0 0' }} />
          <p className="form-section-title span-2">Gestor inicial</p>

          <div className="form-group span-2">
            <label>Nome do Gestor</label>
            <input value={form.gestor_nome} onChange={set('gestor_nome')} required placeholder="João Silva" />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={form.gestor_email} onChange={set('gestor_email')} required placeholder="joao@loja.com.br" />
          </div>
          <div className="form-group">
            <label>Senha temporária</label>
            <PasswordInput value={form.gestor_senha} onChange={set('gestor_senha')} required minLength={6} placeholder="••••••••" style={{ width: '100%' }} />
          </div>

          <div className="modal-footer">
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
  const [assinaturaEmDia, setAssinaturaEmDia] = useState(true)

  useEffect(() => {
    api.get<any>(`/admin/lojas/${lojaId}`)
      .then((data) => {
        setForm({
          nome: data.nome || '',
          cnpj: data.cnpj ? mascararCNPJ(data.cnpj) : '',
          cidade: data.cidade || '',
          estado: data.estado || '',
          telefone: data.telefone ? mascararTelefone(data.telefone) : '',
          whatsapp: data.whatsapp ? mascararTelefone(data.whatsapp) : '',
          modulos_ativos: data.modulos_ativos || [],
        })
        setLogoUrl(data.logo_url || null)
        setAssinaturaEmDia(data.assinatura_em_dia !== false)
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
    } else if (field === 'telefone' || field === 'whatsapp') {
      val = mascararTelefone(val)
    } else if (field === 'estado') {
      val = val.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)
    }
    setForm((f) => ({ ...f, [field]: val }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErro(null)

    try {
      // `modulos_ativos` fica de fora de propósito: os módulos são derivados do
      // plano (ver "Plano & Acesso"). Enviá-los aqui reescrevia a liberação
      // feita pelo plano, e as duas telas se sobrescreviam.
      const { modulos_ativos: _ignorado, ...dadosLoja } = form
      await api.patch(`/admin/lojas/${lojaId}`, dadosLoja)
      onSaved()
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar loja.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container glass-card modal-sm" style={{ padding: 32, textAlign: 'center', alignItems: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando dados da loja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Editar Loja & Módulos</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body modal-form-grid">
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <div className="form-group">
            <label>Nome da Loja</label>
            <input value={form.nome} onChange={set('nome')} required placeholder="Auto Premium SP" />
          </div>
          <div className="form-group">
            <label>CNPJ</label>
            <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
          </div>

          {/* Logo da loja — usada em contratos, vitrine e marca-d'água padrão */}
          <div className="form-group span-2">
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

          <div className="form-group">
            <label>Cidade</label>
            <input value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" />
          </div>
          <div className="form-group">
            <label>UF</label>
            <input value={form.estado} onChange={set('estado')} maxLength={2} placeholder="SP" style={{ textTransform: 'uppercase' }} />
          </div>

          <div className="form-group">
            <label>Telefone</label>
            <input value={form.telefone} onChange={set('telefone')} placeholder="(11) 4002-8922" />
          </div>
          <div className="form-group">
            <label>WhatsApp</label>
            <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999" />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0 0' }} />
          <p className="form-section-title span-2">Módulos</p>

          {/* Somente leitura: quem manda nos módulos é o plano contratado, editável
              em "Plano & Acesso". Editar aqui e lá ao mesmo tempo se sobrescrevia. */}
          <div className="span-2" style={{
            padding: '13px 15px', border: '1px solid var(--sv-border)',
            borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim, rgba(255,255,255,0.02))',
          }}>
            <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', margin: '0 0 9px', lineHeight: 1.55 }}>
              Os módulos seguem o <strong>plano contratado</strong>. Para trocar de plano ou liberar
              um extra de cortesia, use <strong>Plano &amp; Acesso</strong> na listagem de lojas.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.modulos_ativos.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>Nenhum módulo liberado.</span>
              )}
              {form.modulos_ativos.map((key) => (
                <span key={key} style={{
                  fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                  background: assinaturaEmDia
                    ? 'color-mix(in srgb, var(--sv-success) 15%, transparent)'
                    : 'color-mix(in srgb, var(--sv-warning) 15%, transparent)',
                  color: assinaturaEmDia ? 'var(--sv-success)' : 'var(--sv-warning)',
                }}>
                  {rotuloModulo(key)}
                </span>
              ))}
            </div>
            {!assinaturaEmDia && form.modulos_ativos.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--sv-warning)', margin: '9px 0 0' }}>
                Assinatura fora de dia — contratados, porém indisponíveis para o gestor até regularizar.
              </p>
            )}
          </div>

          <div className="modal-footer">
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

interface ModuloStatusItem {
  modulo: string
  ativo: boolean
  cortesia: boolean
  do_plano: boolean
  liberado: boolean
}

interface DiffModulos {
  liberados: string[]
  removidos: string[]
  mantidos_cortesia: string[]
  plano_id?: string // preenchido no cliente: qual plano gerou este diff
}

interface AssinaturaDetalhe {
  assinatura: AssinaturaItem | null
  plano: PlanoItem | null
  pagamentos: PagamentoItem[]
  dias_para_vencer: number | null
  acesso_liberado: boolean
  loja_ativa: boolean
  vencida: boolean
  modulos: ModuloStatusItem[]
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

// Catálogo único dos módulos premium — espelha o enum Modulo do backend.
const MODULOS_CATALOGO = [
  { key: 'contratos', label: 'Contratos', desc: 'Geração de termos e contratos com OCR.' },
  { key: 'simulador', label: 'Simulador', desc: 'Simulação multi-banco e impressão de PDF.' },
  { key: 'marketing', label: 'Marketing', desc: 'Geração de posts e criativos via IA.' },
  { key: 'assistente_ia', label: 'Assistente de IA', desc: 'Copiloto de vendas integrado ao WhatsApp.' },
  { key: 'fiscal', label: 'Fiscal / NF-e', desc: 'Emissão de nota fiscal integrada a contratos.' },
  { key: 'site', label: 'Meu Site / Vitrine', desc: 'Site exclusivo integrado com estoque.' },
]

const rotuloModulo = (key: string) =>
  MODULOS_CATALOGO.find((m) => m.key === key)?.label || key

const STATUS_ASSINATURA_LABEL: Record<string, string> = {
  ativa: 'Ativa', cancelada: 'Cancelada', suspensa: 'Suspensa', expirada: 'Expirada',
}

function modulosDoPlano(plano?: PlanoItem | null): string[] {
  if (!plano?.modulos_incluidos) return []
  try {
    const v = JSON.parse(plano.modulos_incluidos)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
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

// Logs precisam do horário, não só da data
function fmtDataHoraCompleta(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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

interface ModalFinanceiroProps {
  lojaId: string
  lojaNome: string
  onClose: () => void
  onSaved: () => void
}

function ModalFinanceiro({ lojaId, lojaNome, onClose, onSaved }: ModalFinanceiroProps) {
  const { prompt } = useUIStore()
  const [detalhe, setDetalhe] = useState<AssinaturaDetalhe | null>(null)
  const [planos, setPlanos] = useState<PlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [suspendendo, setSuspendendo] = useState(false)
  const [reativando, setReativando] = useState(false)
  const [planoSelecionado, setPlanoSelecionado] = useState('')
  const [diff, setDiff] = useState<DiffModulos | null>(null)
  const [mostrarPagamento, setMostrarPagamento] = useState(false)

  const hoje = new Date()
  const versaoContratoPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [form, setForm] = useState({
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
        setPlanoSelecionado(det.assinatura?.plano_id || ativos[0]?.id || '')
        setDiff(null)
        setForm((f) => ({
          ...f,
          valor_mensal: mascararMoeda(det.assinatura?.valor_mensal ?? ativos[0]?.preco_mensal ?? 149.90),
          observacoes: det.assinatura?.observacoes || '',
        }))
      })
      .catch((err) => {
        // Sem estado válido não dá para renderizar a tela: limpar evita que um
        // reload falho (executar() chama carregar() após cada ação) deixe o
        // modal montado em cima do detalhe anterior, já obsoleto.
        setDetalhe(null)
        setErro(err.message || 'Erro ao carregar o plano da loja.')
      })
      .finally(() => setLoading(false))
  }, [lojaId])

  useEffect(() => { carregar() }, [carregar])

  const assinatura = detalhe?.assinatura
  const statusAtual = assinatura?.status
  const semPlano = !assinatura || statusAtual === 'cancelada'
  const podeReativar = statusAtual === 'suspensa' || statusAtual === 'expirada'
  const planoAtualId = assinatura?.plano_id
  const trocandoPlano = !semPlano && planoSelecionado !== planoAtualId
  const planoEscolhido = planos.find((p) => p.id === planoSelecionado)

  // Prévia do efeito da troca — o admin vê o que muda antes de confirmar.
  // O diff é guardado junto do plano que o gerou para descartar resposta fora
  // de ordem sem precisar limpar o state num efeito.
  useEffect(() => {
    if (!trocandoPlano || !planoSelecionado) return
    let cancelado = false
    api.get<DiffModulos>(`/admin/lojas/${lojaId}/assinatura/previa-troca/${planoSelecionado}`)
      .then((d) => { if (!cancelado) setDiff({ ...d, plano_id: planoSelecionado }) })
      .catch(() => { if (!cancelado) setDiff(null) })
    return () => { cancelado = true }
  }, [lojaId, planoSelecionado, trocandoPlano])

  const diffVisivel = trocandoPlano && diff?.plano_id === planoSelecionado ? diff : null

  const executar = async (acao: () => Promise<unknown>, msgErro: string) => {
    setErro(null)
    setSaving(true)
    try {
      await acao()
      onSaved()
      carregar()
    } catch (err: any) {
      setErro(err.message || msgErro)
    } finally {
      setSaving(false)
    }
  }

  const ativar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contrato_aceito) {
      setErro('Confirme que o cliente aceitou o contrato antes de ativar.')
      return
    }
    return executar(() => api.post(`/admin/lojas/${lojaId}/assinatura/ativar`, {
      plano_id: planoSelecionado,
      valor_mensal: parseMoeda(form.valor_mensal),
      meses: parseInt(form.meses, 10),
      forma_pagamento: form.forma_pagamento,
      referencia_pagamento: form.referencia_pagamento || null,
      contrato_aceito: form.contrato_aceito,
      contrato_versao: form.contrato_versao,
      observacoes: form.observacoes || null,
    }), 'Erro ao ativar o plano.')
  }

  const registrarPagamento = (e: React.FormEvent) => {
    e.preventDefault()
    return executar(() => api.post(`/admin/lojas/${lojaId}/assinatura/renovar`, {
      plano_id: planoSelecionado || null,
      valor_mensal: form.valor_mensal ? parseMoeda(form.valor_mensal) : null,
      meses: parseInt(form.meses, 10),
      forma_pagamento: form.forma_pagamento,
      referencia_pagamento: form.referencia_pagamento || null,
      observacoes: form.observacoes || null,
    }), 'Erro ao registrar o pagamento.')
  }

  const salvarTrocaPlano = () => executar(
    () => api.post(`/admin/lojas/${lojaId}/assinatura/trocar-plano`, {
      plano_id: planoSelecionado,
      valor_mensal: form.valor_mensal ? parseMoeda(form.valor_mensal) : null,
      observacoes: form.observacoes || null,
    }),
    'Erro ao trocar o plano.',
  )

  const reativar = async () => {
    const motivo = await prompt({
      title: 'Reativar acesso',
      label: 'Motivo (opcional)',
      placeholder: 'Ex: pagamento confirmado por fora, suspensão indevida...',
      confirmText: 'Reativar',
    })
    if (motivo === null) return
    setReativando(true)
    try {
      await executar(
        () => api.post(`/admin/lojas/${lojaId}/assinatura/reativar`, { motivo: motivo || undefined }),
        'Erro ao reativar o acesso.',
      )
    } finally {
      setReativando(false)
    }
  }

  const suspender = async () => {
    const motivo = await prompt({
      title: 'Suspender acesso',
      label: 'Motivo',
      placeholder: 'Ex: inadimplência, pedido do cliente...',
      confirmText: 'Suspender',
    })
    if (motivo === null) return
    setSuspendendo(true)
    try {
      await executar(
        () => api.post(`/admin/lojas/${lojaId}/assinatura/suspender`, { motivo: motivo || undefined }),
        'Erro ao suspender o acesso.',
      )
    } finally {
      setSuspendendo(false)
    }
  }

  const cancelar = async () => {
    const motivo = await prompt({
      title: 'Cancelar plano',
      label: 'Motivo do cancelamento',
      placeholder: 'Ex: churn, encerrou a loja...',
      confirmText: 'Cancelar plano',
    })
    if (motivo === null) return
    await executar(
      () => api.post(`/admin/lojas/${lojaId}/assinatura/cancelar`, { motivo: motivo || undefined }),
      'Erro ao cancelar o plano.',
    )
  }

  const alternarCortesia = (modulo: string) => {
    const atuais = (detalhe?.modulos || []).filter((m) => m.cortesia).map((m) => m.modulo)
    const novas = atuais.includes(modulo)
      ? atuais.filter((m) => m !== modulo)
      : [...atuais, modulo]
    return executar(
      () => api.patch(`/admin/lojas/${lojaId}/modulos-cortesia`, { modulos: novas }),
      'Erro ao alterar a liberação de cortesia.',
    )
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container glass-card modal-sm" style={{ padding: 32, textAlign: 'center', alignItems: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando plano e acesso...</p>
        </div>
      </div>
    )
  }

  // Cor da faixa lateral do bloco de estado: verde liberado, laranja travado.
  const corEstado = !assinatura
    ? 'var(--sv-text-muted)'
    : detalhe?.acesso_liberado
      ? 'var(--sv-success)'
      : 'var(--sv-warning)'

  const modulosLiberados = (detalhe?.modulos || []).filter((m) => m.liberado).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Plano &amp; Acesso</h3>
            <p style={{ fontSize: 12, color: 'var(--sv-text-muted)', margin: '2px 0 0' }}>
              {lojaNome}
              {assinatura && ` · desde ${fmtDataHora(assinatura.inicio)}`}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          {/* Estado atual — o que a loja tem e se está valendo agora */}
          <div style={{
            padding: '16px 18px', background: 'var(--sv-surface-dim, rgba(255,255,255,0.02))',
            border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)',
            borderLeft: `3px solid ${corEstado}`,
          }}>
            {assinatura ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--sv-text)' }}>{detalhe?.plano?.nome || 'Plano removido'}</div>
                    <div style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginTop: 3 }}>
                      {fmtMoeda(assinatura.valor_mensal)}/mês
                      {detalhe?.plano && assinatura.valor_mensal != null && assinatura.valor_mensal !== detalhe.plano.preco_mensal && (
                        <span style={{ color: 'var(--sv-text-muted)' }}> · tabela {fmtMoeda(detalhe.plano.preco_mensal)}</span>
                      )}
                    </div>
                  </div>
                  <BadgeStatusAssinatura status={assinatura.status} />
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
                  paddingTop: 13, borderTop: '1px solid var(--sv-border)',
                }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sv-text-muted)', marginBottom: 4 }}>Paga até</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-text)' }}>
                      {fmtDataHora(assinatura.proximo_vencimento)}
                      {detalhe?.dias_para_vencer != null && (
                        <span style={{ fontWeight: 400, fontSize: 13, color: detalhe.dias_para_vencer < 0 ? 'var(--sv-error)' : detalhe.dias_para_vencer <= 7 ? 'var(--sv-warning)' : 'var(--sv-text-muted)' }}>
                          {' '}({detalhe.dias_para_vencer < 0 ? `venceu há ${Math.abs(detalhe.dias_para_vencer)}d` : `em ${detalhe.dias_para_vencer}d`})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sv-text-muted)', marginBottom: 4 }}>Contrato</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-text)' }}>
                      {assinatura.contrato_aceito_em
                        ? <>aceito <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--sv-text-dim)' }}>v{assinatura.contrato_versao}</span></>
                        : <span style={{ color: 'var(--sv-error)' }}>não registrado</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sv-text-muted)', marginBottom: 4 }}>Módulos liberados</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-text)' }}>
                      {modulosLiberados} <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--sv-text-dim)' }}>de {MODULOS_CATALOGO.length}</span>
                    </div>
                  </div>
                </div>

                {assinatura.observacoes && (
                  <p style={{ fontSize: 13, color: 'var(--sv-text-muted)', margin: '12px 0 0', fontStyle: 'italic' }}>"{assinatura.observacoes}"</p>
                )}

                {!detalhe?.acesso_liberado && (
                  <div style={{
                    marginTop: 14, padding: '11px 13px', borderRadius: 'var(--sv-radius)', fontSize: 13, lineHeight: 1.5,
                    display: 'flex', gap: 9, alignItems: 'flex-start',
                    background: 'color-mix(in srgb, var(--sv-warning) 11%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--sv-warning) 26%, transparent)',
                    color: 'var(--sv-warning)',
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      {detalhe?.loja_ativa === false
                        ? <>A loja está com o <strong>login bloqueado</strong>. Os módulos seguem contratados, mas ninguém acessa até reativar.</>
                        : detalhe?.vencida
                          ? <>A assinatura está <strong>vencida</strong> — os módulos premium estão bloqueados até registrar o pagamento.</>
                          : <>Os módulos premium estão <strong>bloqueados</strong> enquanto a assinatura não estiver ativa e em dia.</>}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
                  {podeReativar && (
                    <button
                      type="button" className="btn btn-primary"
                      style={{ padding: '6px 13px', fontSize: 12 }}
                      onClick={reativar} disabled={reativando || saving}
                    >
                      {reativando ? <span className="spinner" /> : '↻ Reativar acesso agora'}
                    </button>
                  )}
                  {!mostrarPagamento && (
                    <button
                      type="button" className="btn btn-secondary"
                      style={{ padding: '6px 13px', fontSize: 12 }}
                      onClick={() => setMostrarPagamento(true)} disabled={saving}
                    >
                      {podeReativar ? 'Reativar registrando pagamento' : 'Registrar pagamento'}
                    </button>
                  )}
                  {assinatura.status === 'ativa' && (
                    <button
                      type="button" className="btn btn-secondary"
                      style={{ padding: '6px 13px', fontSize: 12, color: 'var(--sv-error)' }}
                      onClick={suspender} disabled={suspendendo || saving}
                    >
                      {suspendendo ? <span className="spinner" /> : 'Suspender acesso'}
                    </button>
                  )}
                  <button
                    type="button" className="btn btn-secondary"
                    style={{ padding: '6px 13px', fontSize: 12, color: 'var(--sv-error)' }}
                    onClick={cancelar} disabled={saving}
                  >
                    Cancelar plano
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--sv-text-dim)' }}>Sem plano</div>
                    <div style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginTop: 3 }}>
                      A loja acessa o sistema básico, mas nenhum módulo premium está liberado.
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: 'color-mix(in srgb, var(--sv-text-muted) 18%, transparent)', color: 'var(--sv-text-dim)',
                  }}>Nenhum plano</span>
                </div>
                <div style={{
                  marginTop: 14, padding: '11px 13px', borderRadius: 'var(--sv-radius)', fontSize: 13, lineHeight: 1.5,
                  background: 'color-mix(in srgb, var(--sv-info) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--sv-info) 24%, transparent)',
                  color: 'var(--sv-info)',
                }}>
                  Escolha um plano abaixo e registre o primeiro pagamento para liberar o acesso.
                </div>
              </>
            )}
          </div>

          {/* Histórico de pagamentos */}
          {detalhe && (detalhe.pagamentos?.length ?? 0) > 0 && (
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

          {/* Seletor de plano — cards, com prévia do efeito nos módulos */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
              {semPlano ? 'Escolher plano' : 'Plano contratado'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--sv-text-muted)', margin: '0 0 13px', lineHeight: 1.55 }}>
              Trocar o plano religa os módulos automaticamente — você vê o que muda antes de salvar.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(planos.length || 1, 3)}, 1fr)`, gap: 11 }}>
              {planos.map((p) => {
                const sel = p.id === planoSelecionado
                const atual = p.id === planoAtualId
                return (
                  <button
                    key={p.id} type="button" onClick={() => setPlanoSelecionado(p.id)} disabled={saving}
                    style={{
                      position: 'relative', textAlign: 'left', cursor: saving ? 'not-allowed' : 'pointer',
                      border: `1.5px solid ${sel ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                      background: sel ? 'color-mix(in srgb, var(--sv-primary) 9%, transparent)' : 'var(--sv-surface-dim, rgba(255,255,255,0.02))',
                      borderRadius: 'var(--sv-radius-md)', padding: 14, transition: 'var(--sv-transition)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {atual && (
                      <span style={{
                        position: 'absolute', top: -8, left: 12, fontSize: 10, fontWeight: 700,
                        background: 'var(--sv-surface-hover)', border: '1px solid var(--sv-border)',
                        color: 'var(--sv-text-dim)', padding: '2px 8px', borderRadius: 999,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>plano atual</span>
                    )}
                    {sel && (
                      <span style={{
                        position: 'absolute', top: 11, right: 12, width: 19, height: 19,
                        background: 'var(--sv-primary)', color: '#fff', borderRadius: '50%', fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                      }}>✓</span>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sv-text)', marginBottom: 2 }}>{p.nome}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-primary-text, var(--sv-primary))', marginBottom: 9 }}>
                      {fmtMoeda(p.preco_mensal)}/mês
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', lineHeight: 1.65 }}>
                      {modulosDoPlano(p).map(rotuloModulo).join(' · ') || 'Sem módulos premium'}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Diff da troca */}
            {diffVisivel && (
              <div style={{
                marginTop: 13, padding: '13px 15px', borderRadius: 'var(--sv-radius)',
                border: '1px solid color-mix(in srgb, var(--sv-info) 24%, transparent)',
                background: 'color-mix(in srgb, var(--sv-info) 7%, transparent)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sv-info)', marginBottom: 9 }}>
                  ↔ Mudando de {detalhe?.plano?.nome} para {planoEscolhido?.nome}
                </div>
                {diffVisivel.liberados.map((m) => (
                  <div key={`add-${m}`} style={{ fontSize: 13, padding: '3px 0', color: 'var(--sv-text-dim)' }}>
                    <span style={{ color: 'var(--sv-success)', fontWeight: 700, display: 'inline-block', width: 14 }}>+</span>
                    {rotuloModulo(m)} <span style={{ color: 'var(--sv-text-muted)' }}>— será liberado</span>
                  </div>
                ))}
                {diffVisivel.removidos.map((m) => (
                  <div key={`rm-${m}`} style={{ fontSize: 13, padding: '3px 0', color: 'var(--sv-text-dim)' }}>
                    <span style={{ color: 'var(--sv-error)', fontWeight: 700, display: 'inline-block', width: 14 }}>−</span>
                    {rotuloModulo(m)} <span style={{ color: 'var(--sv-text-muted)' }}>— será bloqueado</span>
                  </div>
                ))}
                {diffVisivel.mantidos_cortesia.map((m) => (
                  <div key={`ct-${m}`} style={{ fontSize: 13, padding: '3px 0', color: 'var(--sv-text-dim)' }}>
                    <span style={{ color: 'var(--sv-warning)', fontWeight: 700, display: 'inline-block', width: 14 }}>=</span>
                    {rotuloModulo(m)} <span style={{ color: 'var(--sv-text-muted)' }}>— mantido por cortesia</span>
                  </div>
                ))}
                {!diffVisivel.liberados.length && !diffVisivel.removidos.length && (
                  <div style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Nenhuma mudança nos módulos.</div>
                )}
                {planoEscolhido && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--sv-border)', fontSize: 12, color: 'var(--sv-text-muted)' }}>
                    Valor de tabela passa a {fmtMoeda(planoEscolhido.preco_mensal)} — ajuste o valor combinado se houver desconto.
                  </div>
                )}
                {!semPlano && (
                  <button
                    type="button" className="btn btn-primary"
                    style={{ marginTop: 12, padding: '6px 13px', fontSize: 12 }}
                    onClick={salvarTrocaPlano} disabled={saving}
                  >
                    {saving ? <span className="spinner" /> : 'Aplicar troca de plano'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Módulos — o que a loja enxerga */}
          {detalhe && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--sv-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                O que a loja enxerga hoje
              </p>
              <p style={{ fontSize: 12, color: 'var(--sv-text-muted)', margin: '0 0 13px', lineHeight: 1.55 }}>
                Os módulos do plano ligam sozinhos. Você pode liberar um <strong>extra de cortesia</strong> — ele sobrevive à troca de plano.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 9 }}>
                {MODULOS_CATALOGO.map((cat) => {
                  const st = (detalhe.modulos || []).find((m) => m.modulo === cat.key)
                  const doPlano = !!st?.do_plano
                  const cortesia = !!st?.cortesia
                  const ligado = !!st?.ativo
                  const cor = doPlano ? 'var(--sv-success)' : cortesia ? 'var(--sv-warning)' : 'var(--sv-text-muted)'
                  return (
                    <div key={cat.key} style={{
                      display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
                      border: `1px solid ${ligado ? `color-mix(in srgb, ${cor} 32%, transparent)` : 'var(--sv-border)'}`,
                      borderRadius: 'var(--sv-radius)',
                      background: ligado ? `color-mix(in srgb, ${cor} 7%, transparent)` : 'var(--sv-surface-dim, rgba(255,255,255,0.02))',
                      opacity: ligado && !st?.liberado ? 0.62 : 1,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ligado ? cor : 'var(--sv-text-muted)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sv-text)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          {cat.label}
                          {doPlano && (
                            <span style={{
                              fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: 'color-mix(in srgb, var(--sv-primary) 20%, transparent)',
                              color: 'var(--sv-primary-text, var(--sv-primary))',
                            }}>plano</span>
                          )}
                          {cortesia && (
                            <span style={{
                              fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: 'color-mix(in srgb, var(--sv-warning) 20%, transparent)',
                              color: 'var(--sv-warning)',
                            }}>cortesia</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--sv-text-muted)', marginTop: 1 }}>
                          {doPlano
                            ? (st?.liberado ? cat.desc : 'Contratado · bloqueado pela assinatura')
                            : cortesia
                              ? (st?.liberado ? 'Liberado manualmente · fora do plano' : 'Cortesia · bloqueado pela assinatura')
                              : cat.desc}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => !doPlano && alternarCortesia(cat.key)}
                        disabled={doPlano || saving}
                        title={doPlano ? 'Incluído no plano — troque o plano para alterar' : cortesia ? 'Remover cortesia' : 'Liberar como cortesia'}
                        style={{
                          width: 36, height: 20, borderRadius: 999, flexShrink: 0, position: 'relative',
                          background: ligado ? `color-mix(in srgb, ${cor} 30%, transparent)` : 'var(--sv-input-bg)',
                          border: `1px solid ${ligado ? `color-mix(in srgb, ${cor} 50%, transparent)` : 'var(--sv-border)'}`,
                          cursor: doPlano || saving ? 'not-allowed' : 'pointer',
                          opacity: doPlano ? 0.45 : 1, padding: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 1, left: ligado ? 17 : 1, width: 14, height: 14, borderRadius: '50%',
                          background: ligado ? cor : 'var(--sv-text-muted)', transition: 'var(--sv-transition)',
                        }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pagamento — ativação (sem plano) ou renovação (colapsado) */}
          {(semPlano || mostrarPagamento) && (
            <form onSubmit={semPlano ? ativar : registrarPagamento} style={{
              display: 'flex', flexDirection: 'column', gap: 13,
              border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)', padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)' }}>
                    {semPlano ? 'Primeiro pagamento' : 'Registrar pagamento'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', marginTop: 2 }}>
                    {semPlano ? 'Obrigatório para ativar o plano' : 'Pix, dinheiro ou boleto — sem gateway ainda'}
                  </div>
                </div>
                {!semPlano && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setMostrarPagamento(false)} disabled={saving}>Ocultar</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 12 }}>
                <div className="form-group">
                  <label>Valor combinado (R$/mês)</label>
                  <input type="text" inputMode="numeric" value={form.valor_mensal}
                    onChange={(e) => setForm((f) => ({ ...f, valor_mensal: mascararMoeda(e.target.value) }))}
                    required={semPlano} placeholder="99,90" />
                </div>
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
                  <label>Meses</label>
                  <input type="number" min="1" max="12" value={form.meses}
                    onChange={(e) => setForm((f) => ({ ...f, meses: e.target.value }))} required />
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', borderRadius: 'var(--sv-radius)',
                background: 'color-mix(in srgb, var(--sv-primary) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--sv-primary) 25%, transparent)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>Total recebido</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--sv-primary-text, var(--sv-primary))' }}>
                  {fmtMoeda(parseMoeda(form.valor_mensal) * (parseInt(form.meses, 10) || 1))}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: semPlano ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr', gap: 12 }}>
                {semPlano && (
                  <div className="form-group">
                    <label>Versão do contrato aceito</label>
                    <input value={form.contrato_versao}
                      onChange={(e) => setForm((f) => ({ ...f, contrato_versao: e.target.value }))}
                      required placeholder="2026-07" />
                  </div>
                )}
                <div className="form-group">
                  <label>Referência / comprovante</label>
                  <input value={form.referencia_pagamento}
                    onChange={(e) => setForm((f) => ({ ...f, referencia_pagamento: e.target.value }))}
                    placeholder="ID do Pix (opcional)" />
                </div>
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Ex: fundadora 3x R$99,90, depois vai para R$299,90"
                  rows={2} style={{ resize: 'vertical' }} />
              </div>

              {semPlano && (
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.5,
                  color: 'var(--sv-text)', cursor: 'pointer', padding: '11px 13px',
                  background: 'var(--sv-surface-dim, rgba(255,255,255,0.02))',
                  border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)',
                }}>
                  <input type="checkbox" checked={form.contrato_aceito} style={{ marginTop: 2 }}
                    onChange={(e) => setForm((f) => ({ ...f, contrato_aceito: e.target.checked }))} />
                  <span>Confirmo que o cliente aceitou os <strong>Termos de Uso</strong> e o contrato de assinatura.</span>
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : semPlano ? 'Ativar plano' : 'Registrar pagamento'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>
            {assinatura?.criado_por_admin ? 'Cobrança manual (Pix) — sem gateway' : ''}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Aba Financeiro (cobrança e vencimentos) ───────────────────────

function AbaFinanceiro() {
  const [itens, setItens] = useState<VencimentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [janela, setJanela] = useState(30)
  const [lojaSelecionada, setLojaSelecionada] = useState<{ id: string; nome: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    setErro(null)
    api.get<VencimentoItem[]>('/admin/assinaturas/vencendo', { dias: String(janela) })
      .then(setItens)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar as assinaturas.'))
      .finally(() => setLoading(false))
  }, [janela])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && <ErroAlerta msg={erro} onFechar={() => setErro(null)} />}
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
        <LoadingState />
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
        <ModalFinanceiro
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

const TODOS_MODULOS = MODULOS_CATALOGO

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
        <div className="modal-container glass-card modal-sm" style={{ padding: 32, textAlign: 'center', alignItems: 'center' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12, color: 'var(--sv-text-dim)' }}>Carregando plano...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{planoId ? 'Editar Plano' : 'Novo Plano'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body modal-form-grid">
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <div className="form-group">
            <label>Nome do Plano</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required placeholder="Profissional" />
          </div>
          <div className="form-group">
            <label>Preço (R$/mês)</label>
            <input type="text" inputMode="numeric" value={form.preco_mensal} onChange={(e) => setForm((f) => ({ ...f, preco_mensal: mascararMoeda(e.target.value) }))} required placeholder="349,90" />
          </div>

          <div className="form-group span-2">
            <label>Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Gestão completa + módulos premium"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--sv-border)', margin: '8px 0 0' }} />
          <p className="form-section-title span-2">Módulos Incluídos</p>

          <div className="span-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
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

          <label className="span-2" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sv-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Plano ativo (visível para contratação)
          </label>

          <div className="modal-footer">
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
    api.get<PlanoItem[]>('/admin/planos')
      .then(setPlanos)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar os planos.'))
      .finally(() => setLoading(false))
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
        <ErroAlerta msg={erro} onFechar={() => setErro(null)} />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={() => { setPlanoEditandoId(null); setModalAberto(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      {loading ? (
        <LoadingState />
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
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.get<Stats>('/admin/stats')
      .then(setStats)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar as estatísticas.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (erro) return <div style={{ marginTop: '24px' }}><ErroAlerta msg={erro} /></div>
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
  const { confirm } = useUIStore()
  const [lojas, setLojas] = useState<LojaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [lojaEditandoId, setLojaEditandoId] = useState<string | null>(null)
  const [lojaFinanceiro, setLojaFinanceiro] = useState<{ id: string; nome: string } | null>(null)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [impersonarLoading, setImpersonarLoading] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<LojaItem[]>('/admin/lojas')
      .then(setLojas)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar as lojas.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const toggleStatus = async (loja: LojaItem) => {
    if (loja.ativa) {
      const ok = await confirm({
        title: 'Desativar loja',
        message: `Desativar "${loja.nome}"? Os usuários dela perdem o acesso ao sistema até a loja ser reativada.`,
        confirmText: 'Desativar',
        danger: true,
      })
      if (!ok) return
    }
    setToggleLoading(loja.id)
    setErro(null)
    try {
      await api.patch(`/admin/lojas/${loja.id}/status`, { ativa: !loja.ativa })
      carregar()
    } catch (err: any) {
      setErro(err?.message || 'Erro ao alterar o status da loja.')
      setTimeout(() => setErro(null), 6000)
    } finally {
      setToggleLoading(null)
    }
  }

  const impersonar = async (loja: LojaItem) => {
    setImpersonarLoading(loja.id)
    try {
      const res = await api.post<{ access_token: string; loja_nome: string }>(`/admin/lojas/${loja.id}/impersonar`, {})
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const gestorBase = isDev
        ? 'http://localhost:5173'
        : (import.meta.env.VITE_GESTOR_URL || window.location.origin.replace('admin.', 'app.').replace('/admin', ''))
      const url = `${gestorBase}/impersonar?token=${encodeURIComponent(res.access_token)}&loja=${encodeURIComponent(res.loja_nome)}`
      window.open(url, '_blank')
    } catch (err: any) {
      setErro(err.message || 'Erro ao impersonar loja.')
      setTimeout(() => setErro(null), 6000)
    } finally {
      setImpersonarLoading(null)
    }
  }

  const lojasFiltradas = lojas.filter((l) =>
    l.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && (
        <ErroAlerta msg={erro} onFechar={() => setErro(null)} />
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
        <LoadingState />
      ) : lojasFiltradas.length === 0 ? (
        <EmptyState msg={busca ? 'Nenhuma loja encontrada para essa busca.' : 'Nenhuma loja cadastrada.'} />
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Nome', 'Cidade / UF', 'WhatsApp', 'Status', 'Destaque', 'Criado em', 'Ações'].map((h) => (
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
                  <td style={{ color: 'var(--sv-text-dim)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{loja.whatsapp || '—'}</span>
                      {loja.whatsapp_divergente && (
                        <span
                          title={`Número pareado no WhatsApp (${loja.whatsapp_pareado}) diverge do cadastrado`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '1px 8px', borderRadius: 999,
                            fontSize: '12px', fontWeight: 600,
                            background: 'color-mix(in srgb, var(--sv-warning) 15%, transparent)',
                            color: 'var(--sv-warning)',
                          }}
                        >
                          <AlertTriangle size={11} /> Divergente
                        </span>
                      )}
                    </div>
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
                  <td>
                    {loja.destaque ? (
                      <span
                        title={loja.destaque_ate ? `Vence em ${fmtData(loja.destaque_ate)}` : 'Sem prazo definido'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 10px', borderRadius: 999,
                          fontSize: '12px', fontWeight: 600,
                          background: 'color-mix(in srgb, var(--sv-warning) 15%, transparent)',
                          color: 'var(--sv-warning)',
                        }}
                      >
                        <Star size={11} /> Destaque
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sv-text-muted)', fontSize: '12px' }}>—</span>
                    )}
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
                        onClick={() => setLojaFinanceiro({ id: loja.id, nome: loja.nome })}
                        title="Ativar, renovar ou suspender a cobrança (Pix manual)"
                      >
                        <CreditCard size={14} /> Financeiro
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => impersonar(loja)}
                        disabled={impersonarLoading === loja.id}
                        title="Observar como gestor desta loja"
                      >
                        <Eye size={14} /> {impersonarLoading === loja.id ? 'Abrindo…' : 'Observar'}
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
      {lojaFinanceiro && (
        <ModalFinanceiro
          lojaId={lojaFinanceiro.id}
          lojaNome={lojaFinanceiro.nome}
          onClose={() => setLojaFinanceiro(null)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}

// ── Aba Auditoria ────────────────────────────────────────────────

interface AuditoriaLogItem extends LogItem {
  ator_id?: string | null
  ip?: string | null
  loja_nome?: string | null
}

interface AuditoriaPage {
  itens: AuditoriaLogItem[]
  total: number
  limit: number
  offset: number
}

interface FacetaItem {
  valor: string
  label: string
  total: number
}

interface AuditoriaFacetas {
  acoes: FacetaItem[]
  modulos: FacetaItem[]
  entidades: FacetaItem[]
  atores: FacetaItem[]
  lojas: FacetaItem[]
}

interface FiltrosAuditoria {
  busca: string
  acao: string
  entidade: string
  ator: string
  loja_id: string
  data_de: string
  data_ate: string
}

const FILTROS_VAZIOS: FiltrosAuditoria = {
  busca: '', acao: '', entidade: '', ator: '', loja_id: '', data_de: '', data_ate: '',
}

/** Verbo final da ação ("veiculo.criar" → "criar") define a cor do badge. */
function corDaAcao(acao: string): { bg: string; cor: string } {
  const verbo = acao.split('.').pop() || ''
  if (/^(criar|cadastrar|adicionar|ativar|aprovar|login)/.test(verbo)) {
    return { bg: 'rgba(34, 197, 94, 0.12)', cor: '#4ade80' }
  }
  if (/^(excluir|deletar|remover|cancelar|desativar|recusar|reprovar|suspender)/.test(verbo)) {
    return { bg: 'rgba(239, 68, 68, 0.12)', cor: '#f87171' }
  }
  if (/^(editar|atualizar|alterar|mover|trocar|solicitar|reset)/.test(verbo)) {
    return { bg: 'rgba(245, 158, 11, 0.12)', cor: '#fbbf24' }
  }
  return { bg: 'rgba(148, 163, 184, 0.12)', cor: 'var(--sv-text-dim)' }
}

/** "Hoje 14:32" / "Ontem 09:10" / "23/07 16:05" — leitura rápida no dia a dia. */
function fmtDataRelativa(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const mesmoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (mesmoDia(d, hoje)) return `Hoje ${hora}`
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (mesmoDia(d, ontem)) return `Ontem ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

function isoDiasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function ModalDetalheLog({ log, onClose }: { log: AuditoriaLogItem; onClose: () => void }) {
  let detalhesFmt = log.detalhes || ''
  try {
    if (log.detalhes) detalhesFmt = JSON.stringify(JSON.parse(log.detalhes), null, 2)
  } catch { /* não é JSON: mostra cru */ }

  const linhas: [string, string][] = [
    ['Ação', log.acao],
    ['Data', fmtDataHoraCompleta(log.created_at)],
    ['Usuário', log.ator_nome || '—'],
    ['Loja', log.loja_nome || '—'],
    ['Entidade', log.entidade || '—'],
    ['ID da entidade', log.entidade_id || '—'],
    ['IP', log.ip || '—'],
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Detalhe do registro</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '14px' }}>
            {linhas.map(([label, valor]) => (
              <Fragment key={label}>
                <span style={{ color: 'var(--sv-text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--sv-text)', wordBreak: 'break-all' }}>{valor}</span>
              </Fragment>
            ))}
          </div>
          {detalhesFmt && (
            <div>
              <span style={{ color: 'var(--sv-text-muted)', fontSize: '14px' }}>Detalhes</span>
              <pre style={{
                marginTop: '6px', padding: '12px', maxHeight: '260px', overflow: 'auto',
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--sv-border)',
                borderRadius: 'var(--sv-radius)', color: 'var(--sv-text-dim)',
                fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>{detalhesFmt}</pre>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

const ESTILO_CAMPO_FILTRO: React.CSSProperties = {
  height: '40px',
  padding: '0 12px',
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid var(--sv-border)',
  borderRadius: 'var(--sv-radius)',
  color: 'var(--sv-text)',
  fontSize: '14px',
  outline: 'none',
}

const POR_PAG_AUDITORIA = 25

function AbaAuditoria() {
  const [logs, setLogs] = useState<AuditoriaLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [facetas, setFacetas] = useState<AuditoriaFacetas | null>(null)
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_VAZIOS)
  const [buscaInput, setBuscaInput] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<AuditoriaLogItem | null>(null)

  // Só os filtros preenchidos viram query string.
  const params = useCallback((extra?: Record<string, string>) => {
    const p: Record<string, string> = {}
    for (const [k, v] of Object.entries(filtros)) if (v) p[k] = v
    return { ...p, ...extra }
  }, [filtros])

  useEffect(() => {
    api.get<AuditoriaFacetas>('/admin/auditoria/facetas')
      .then(setFacetas)
      .catch(() => { /* filtros seguem utilizáveis sem as facetas */ })
  }, [])

  // Debounce só na busca textual; os selects aplicam na hora.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.busca === buscaInput ? f : { ...f, busca: buscaInput }))
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  useEffect(() => {
    setLoading(true)
    api.get<AuditoriaPage>('/admin/auditoria', params({
      limit: String(POR_PAG_AUDITORIA),
      offset: String((pagina - 1) * POR_PAG_AUDITORIA),
    }))
      .then((r) => { setLogs(r.itens); setTotal(r.total) })
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar os logs de auditoria.'))
      .finally(() => setLoading(false))
  }, [params, pagina])

  const set = (campo: keyof FiltrosAuditoria, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  const periodoRapido = (dias: number | null) => {
    setFiltros((f) => ({
      ...f,
      data_de: dias === null ? '' : isoDiasAtras(dias),
      data_ate: '',
    }))
    setPagina(1)
  }

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS)
    setBuscaInput('')
    setPagina(1)
  }

  const exportar = async () => {
    setExportando(true)
    try {
      await api.download('/admin/auditoria/export', params(), 'auditoria.csv')
    } catch (err: any) {
      setErro(err?.message || 'Erro ao exportar o CSV.')
    } finally {
      setExportando(false)
    }
  }

  const temFiltro = Object.values(filtros).some(Boolean)
  const paginas = Math.max(1, Math.ceil(total / POR_PAG_AUDITORIA))
  const periodoAtivo = (dias: number) => filtros.data_de === isoDiasAtras(dias) && !filtros.data_ate

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && <ErroAlerta msg={erro} onFechar={() => setErro(null)} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sv-text-muted)' }} />
          <input
            style={{ ...ESTILO_CAMPO_FILTRO, width: '100%', padding: '0 16px 0 36px' }}
            placeholder="Buscar por ação, usuário, ID, IP…"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
          />
        </div>

        <select style={ESTILO_CAMPO_FILTRO} value={filtros.acao} onChange={(e) => set('acao', e.target.value)}>
          <option value="">Todas as ações</option>
          {facetas?.modulos.map((m) => (
            <option key={m.valor} value={m.valor}>{m.label} ({m.total})</option>
          ))}
          {facetas?.acoes.length ? <option disabled>──────────</option> : null}
          {facetas?.acoes.map((a) => (
            <option key={a.valor} value={a.valor}>{a.label} ({a.total})</option>
          ))}
        </select>

        <select style={ESTILO_CAMPO_FILTRO} value={filtros.ator} onChange={(e) => set('ator', e.target.value)}>
          <option value="">Todos os usuários</option>
          {facetas?.atores.map((a) => (
            <option key={a.valor} value={a.valor}>{a.label} ({a.total})</option>
          ))}
        </select>

        <select style={ESTILO_CAMPO_FILTRO} value={filtros.loja_id} onChange={(e) => set('loja_id', e.target.value)}>
          <option value="">Todas as lojas</option>
          {facetas?.lojas.map((l) => (
            <option key={l.valor} value={l.valor}>{l.label} ({l.total})</option>
          ))}
        </select>

        <select style={ESTILO_CAMPO_FILTRO} value={filtros.entidade} onChange={(e) => set('entidade', e.target.value)}>
          <option value="">Todas as entidades</option>
          {facetas?.entidades.map((e2) => (
            <option key={e2.valor} value={e2.valor}>{e2.label} ({e2.total})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {[{ label: 'Hoje', dias: 0 }, { label: '7 dias', dias: 7 }, { label: '30 dias', dias: 30 }].map((p) => (
          <button
            key={p.label}
            className={periodoAtivo(p.dias) ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => periodoRapido(periodoAtivo(p.dias) ? null : p.dias)}
          >
            {p.label}
          </button>
        ))}

        <input
          type="date"
          style={{ ...ESTILO_CAMPO_FILTRO, height: '34px' }}
          value={filtros.data_de}
          max={filtros.data_ate || undefined}
          onChange={(e) => set('data_de', e.target.value)}
          title="Data inicial"
        />
        <span style={{ color: 'var(--sv-text-muted)', fontSize: '13px' }}>até</span>
        <input
          type="date"
          style={{ ...ESTILO_CAMPO_FILTRO, height: '34px' }}
          value={filtros.data_ate}
          min={filtros.data_de || undefined}
          onChange={(e) => set('data_ate', e.target.value)}
          title="Data final"
        />

        {temFiltro && (
          <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={limpar}>
            <X size={14} /> Limpar
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--sv-text-muted)', fontSize: '13px' }}>
            {total.toLocaleString('pt-BR')} {total === 1 ? 'registro' : 'registros'}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={exportar}
            disabled={exportando || total === 0}
            title="Baixar em CSV os registros que casam com os filtros atuais"
          >
            <Download size={14} /> {exportando ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState msg={temFiltro ? 'Nenhum registro para os filtros aplicados.' : 'Nenhum log de auditoria registrado.'} />
      ) : (
        <>
          <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
            <table className="stock-table">
              <thead>
                <tr>
                  {['Ação', 'Entidade', 'Usuário', 'Loja', 'Data', ''].map((h, i) => (
                    <th key={h || i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const { bg, cor } = corDaAcao(log.acao)
                  return (
                    <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelecionado(log)}>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: '6px',
                          background: bg, color: cor, fontFamily: 'monospace', fontSize: '12px',
                        }}>{log.acao}</span>
                      </td>
                      <td style={{ color: 'var(--sv-text-dim)' }}>{log.entidade || '—'}</td>
                      <td style={{ color: 'var(--sv-text-dim)' }}>{log.ator_nome || '—'}</td>
                      <td style={{ color: 'var(--sv-text-dim)' }}>{log.loja_nome || '—'}</td>
                      <td style={{ color: 'var(--sv-text-dim)', whiteSpace: 'nowrap' }} title={fmtDataHoraCompleta(log.created_at)}>
                        {fmtDataRelativa(log.created_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => { e.stopPropagation(); setSelecionado(log) }}
                          title="Ver detalhes do registro"
                        >
                          <Eye size={14} /> Detalhes
                        </button>
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
              <button className="btn btn-secondary" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}

      {selecionado && <ModalDetalheLog log={selecionado} onClose={() => setSelecionado(null)} />}
    </div>
  )
}

// ── Aba Erros ────────────────────────────────────────────────────

function fmtDetalhes(detalhes: string | null | undefined): {
  path?: string
  status?: number
  user_name?: string
  user_email?: string
  mensagem?: string
  timestamp?: string
} {
  if (!detalhes) return {}
  try { return JSON.parse(detalhes) } catch { return {} }
}

function formatarErroTexto(log: LogItem): string {
  const det = fmtDetalhes(log.detalhes)
  const user_name = det.user_name || log.ator_nome || 'Anônimo'
  const user_email = det.user_email || 'Não informado'
  const dataFormatada = fmtDataHoraCompleta(log.created_at)

  let txt = `[ERRO REGISTRADO - SOCIAL VEÍCULOS]
----------------------------------------
ID do Log: ${log.id}
Data: ${dataFormatada}
Origem: ${log.entidade || '—'}
Rota: ${det.path || '—'}
Status HTTP: ${det.status ?? '5xx'}
Usuário: ${user_name} (${user_email})
Request ID: ${log.entidade_id || '—'}
Status IA: ${log.ajusteia ? 'Resolvido (IA)' : 'Pendente'}`

  if (det.mensagem) {
    txt += `\nMensagem do Erro: ${det.mensagem}`
  }

  txt += `\n\n[Detalhes JSON]:\n${log.detalhes || '{}'}`
  return txt
}

function formatarListaErrosTexto(logs: LogItem[]): string {
  if (logs.length === 0) return 'Nenhum erro registrado.'
  let txt = `=== RELATÓRIO DE ERROS REGISTRADOS (${logs.length} item(ns)) ===\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n`
  logs.forEach((log, index) => {
    txt += `--- Erro #${index + 1} ---\n${formatarErroTexto(log)}\n\n`
  })
  return txt
}

function ModalDetalhesErro({
  log,
  onClose,
  onContato,
  onToggleAjusteIA,
}: {
  log: LogItem
  onClose: () => void
  onContato?: () => void
  onToggleAjusteIA?: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [copiadoJson, setCopiadoJson] = useState(false)
  const det = fmtDetalhes(log.detalhes)
  const user_name = det.user_name || log.ator_nome || 'Anônimo'
  const user_email = det.user_email

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--sv-error)' }} />
            <h3 className="modal-title">Detalhes do Erro</h3>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body modal-form-grid">
          <div className="span-2" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '16px',
            borderRadius: 'var(--sv-radius)',
            border: '1px solid var(--sv-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>ORIGEM</span>
              <span style={{ fontWeight: 600, color: 'var(--sv-primary)' }}>{log.entidade || '—'}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>ROTA</span>
              <code style={{ fontSize: '12px', color: 'var(--sv-text)', wordBreak: 'break-all' }}>{det.path || '—'}</code>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>STATUS</span>
              <span style={{ fontWeight: 700, color: 'var(--sv-error)' }}>HTTP {det.status ?? 500}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>DATA E HORA</span>
              <span style={{ fontSize: '13px', color: 'var(--sv-text-dim)' }}>{fmtDataHoraCompleta(log.created_at)}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>USUÁRIO</span>
              <span style={{ fontWeight: 600, color: 'var(--sv-text)', fontSize: '13px' }}>{user_name}</span>
              {user_email && <div style={{ fontSize: '12px', color: 'var(--sv-text-dim)' }}>{user_email}</div>}
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)', display: 'block' }}>REQUEST ID</span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--sv-text-dim)' }}>{log.entidade_id || '—'}</span>
            </div>
          </div>

          {det.mensagem && (
            <div className="span-2" style={{
              background: 'color-mix(in srgb, var(--sv-error) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--sv-error) 25%, transparent)',
              padding: '14px',
              borderRadius: 'var(--sv-radius)',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sv-error)', display: 'block', marginBottom: '4px' }}>
                MENSAGEM DE EXCEÇÃO
              </span>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--sv-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace'
              }}>
                {det.mensagem}
              </pre>
            </div>
          )}

          <div className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sv-text-dim)' }}>
                DADOS DO LOG (JSON)
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopiarJson}
                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copiadoJson ? <Check size={12} style={{ color: 'var(--sv-success)' }} /> : <Copy size={12} />}
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
              maxHeight: '220px',
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {JSON.stringify(det, null, 2)}
            </pre>
          </div>

          <div className="modal-footer span-2" style={{ justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {onToggleAjusteIA && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onToggleAjusteIA}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {log.ajusteia ? <CheckCircle size={14} style={{ color: 'var(--sv-success)' }} /> : <AlertTriangle size={14} />}
                  {log.ajusteia ? 'Resolvido (IA)' : 'Marcar Resolvido'}
                </button>
              )}
              {user_email && onContato && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { onClose(); onContato() }}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Mail size={14} /> Entrar em Contato
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
                {copiado ? 'Erro Copiado!' : 'Copiar Resumo de Erro'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
      <div className="modal-container glass-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Entrar em Contato</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body modal-form-grid">

          <div className="span-2" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--sv-radius)', fontSize: '13px', border: '1px solid var(--sv-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
              <span style={{ color: 'var(--sv-text-muted)' }}>Usuário:</span>
              <strong style={{ color: 'var(--sv-text)' }}>{erro.user_name}</strong>
              
              <span style={{ color: 'var(--sv-text-muted)' }}>E-mail:</span>
              <span style={{ color: 'var(--sv-text-dim)', fontFamily: 'monospace' }}>{erro.user_email}</span>
              
              <span style={{ color: 'var(--sv-text-muted)' }}>Erro:</span>
              <span style={{ color: 'var(--sv-error)', fontWeight: 500 }}>Status {erro.status} em {erro.path}</span>
            </div>
          </div>

          <div className="form-group span-2">
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

          <div className="form-group span-2">
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

          <div className="modal-footer">
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
  const [logDetalhes, setLogDetalhes] = useState<LogItem | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [copiadoTodos, setCopiadoTodos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null)
  const [loteLoading, setLoteLoading] = useState(false)
  const POR_PAG = 20

  const carregar = useCallback(() => {
    setLoading(true)
    setErro(null)
    const endpoint = subAba === 'ativos' ? '/admin/erros?limit=200' : '/admin/erros/ocultados?limit=200'
    api.get<LogItem[]>(endpoint)
      .then(setLogs)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar os registros de erro.'))
      .finally(() => setLoading(false))
  }, [subAba])

  useEffect(() => {
    setPagina(1)
    carregar()
  }, [carregar])

  const toggleVisibilidade = async (logId: string, atualVisivel: boolean) => {
    setAcaoLoading(logId)
    setErro(null)
    try {
      await api.patch(`/admin/erros/${logId}/visibilidade`, { visivel: !atualVisivel })
      setLogs((prev) => prev.filter((log) => log.id !== logId))
      if (logDetalhes?.id === logId) {
        setLogDetalhes(null)
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro ao alterar a visibilidade do registro.')
    } finally {
      setAcaoLoading(null)
    }
  }

  const toggleAjusteIA = async (logId: string, atualAjuste: boolean) => {
    setAcaoLoading(logId)
    setErro(null)
    try {
      await api.patch(`/admin/erros/${logId}/ajusteia`, { ajusteia: !atualAjuste })
      setLogs((prev) => prev.map((log) => log.id === logId ? { ...log, ajusteia: !atualAjuste } : log))
      if (logDetalhes?.id === logId) {
        setLogDetalhes((prev) => prev ? { ...prev, ajusteia: !atualAjuste } : null)
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro ao marcar o ajuste por IA.')
    } finally {
      setAcaoLoading(null)
    }
  }

  const ocultarTodos = async () => {
    const ok = await confirm({ title: 'Ocultar erros', message: 'Deseja ocultar todos os erros ativos desta visualização?', confirmText: 'Ocultar' })
    if (!ok) return
    setLoteLoading(true)
    setErro(null)
    try {
      await api.post('/admin/erros/ocultar-todos', {})
      setLogs([])
    } catch (err: any) {
      setErro(err?.message || 'Erro ao ocultar os registros.')
    } finally {
      setLoteLoading(false)
    }
  }

  const restaurarTodos = async () => {
    const ok = await confirm({ title: 'Restaurar erros', message: 'Deseja restaurar todos os erros ocultados para a visualização ativa?', confirmText: 'Restaurar' })
    if (!ok) return
    setLoteLoading(true)
    setErro(null)
    try {
      await api.post('/admin/erros/restaurar-todos', {})
      setLogs([])
    } catch (err: any) {
      setErro(err?.message || 'Erro ao restaurar os registros.')
    } finally {
      setLoteLoading(false)
    }
  }

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
    <div style={{ marginTop: '24px' }}>
      {erro && <ErroAlerta msg={erro} onFechar={() => setErro(null)} />}

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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {logs.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={copiarTodosErros}
              title="Copiar relatório formatado com todos os erros visíveis"
            >
              {copiadoTodos ? <Check size={14} style={{ color: 'var(--sv-success)' }} /> : <Copy size={14} />}
              {copiadoTodos ? 'Lista Copiada!' : 'Copiar Todos os Erros'}
            </button>
          )}

          {subAba === 'ativos' && logs.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px 14px' }}
              onClick={ocultarTodos}
              disabled={loteLoading}
            >
              <EyeOff size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              {loteLoading ? 'Ocultando…' : 'Ocultar todos os ativos'}
            </button>
          )}
          {subAba === 'ocultados' && logs.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px 14px' }}
              onClick={restaurarTodos}
              disabled={loteLoading}
            >
              <Eye size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              {loteLoading ? 'Restaurando…' : 'Restaurar todos os ocultados'}
            </button>
          )}
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={carregar} disabled={loading} title="Recarregar">
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
        <LoadingState />
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
                  const isCopiado = copiadoId === log.id

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
                          disabled={acaoLoading === log.id}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: acaoLoading === log.id ? 'wait' : 'pointer',
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
                      <td style={{ color: 'var(--sv-text-dim)' }}>{fmtDataHoraCompleta(log.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => copiarSingleLog(log)}
                            title="Copiar resumo do erro"
                          >
                            {isCopiado ? <Check size={14} style={{ color: 'var(--sv-success)' }} /> : <Copy size={14} />}
                            {isCopiado ? 'Copiado' : 'Copiar'}
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setLogDetalhes(log)}
                            title="Ver detalhes completos do erro"
                          >
                            <FileText size={14} /> Detalhes
                          </button>

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
                                    date: fmtDataHoraCompleta(log.created_at)
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
                                disabled={acaoLoading === log.id}
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
                              disabled={acaoLoading === log.id}
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

      {logDetalhes && (
        <ModalDetalhesErro
          log={logDetalhes}
          onClose={() => setLogDetalhes(null)}
          onToggleAjusteIA={() => toggleAjusteIA(logDetalhes.id, !!logDetalhes.ajusteia)}
          onContato={
            fmtDetalhes(logDetalhes.detalhes).user_email
              ? () => {
                  const det = fmtDetalhes(logDetalhes.detalhes)
                  setErroSelecionado({
                    id: logDetalhes.id,
                    path: det.path || '—',
                    status: det.status ?? 500,
                    user_name: det.user_name || logDetalhes.ator_nome || 'Anônimo',
                    user_email: det.user_email || '',
                    date: fmtDataHoraCompleta(logDetalhes.created_at)
                  })
                }
              : undefined
          }
        />
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

// ── Aba Usuários (reset de senha) ────────────────────────────────

interface UsuarioVinculo {
  membro_id: string
  loja_id: string
  loja_nome: string
  papel: string
  ativo: boolean
}

interface UsuarioItem {
  id: string
  nome: string
  email: string
  telefone?: string | null
  papel: string
  ativo: boolean
  lojas: string[]
  // Opcionais de propósito: a API só passa a mandá-los após o deploy do backend
  // (M121). Declarar como obrigatórios fazia o TS aceitar `.vinculos.some()`,
  // que quebrava a tela contra a API antiga.
  vinculos?: UsuarioVinculo[]
}

const PAPEL_LABELS: Record<string, string> = {
  admin_plataforma: 'Admin',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  cliente: 'Cliente',
}

function ModalResetSenha({ usuario, onClose }: { usuario: UsuarioItem; onClose: () => void }) {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha !== confirmar) {
      setErro('As senhas não conferem.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      await api.post(`/admin/usuarios/${usuario.id}/reset-senha`, { nova_senha: senha })
      setSucesso(true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao redefinir senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Redefinir senha</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {sucesso ? (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 24px', textAlign: 'center' }}>
            <CheckCircle size={40} style={{ color: 'var(--sv-success)' }} />
            <p style={{ color: 'var(--sv-text)', fontWeight: 600 }}>Senha redefinida</p>
            <p style={{ color: 'var(--sv-text-dim)', fontSize: '14px' }}>
              A senha de <strong>{usuario.email}</strong> foi alterada. Repasse a nova senha ao usuário e oriente a troca no primeiro acesso.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '8px' }}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={submit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {erro && (
              <div className="login-error-alert" style={{ margin: 0 }}>
                <AlertTriangle size={16} />
                <span>{erro}</span>
              </div>
            )}
            <p style={{ fontSize: '14px', color: 'var(--sv-text-dim)', margin: 0 }}>
              Nova senha para <strong style={{ color: 'var(--sv-text)' }}>{usuario.nome}</strong> ({usuario.email})
            </p>
            <div className="form-group">
              <label>Nova senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={{ width: '100%', paddingRight: '40px' }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMostrar((m) => !m)}
                  title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sv-text-muted)', display: 'flex' }}
                >
                  {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirmar senha</label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            <div className="modal-footer" style={{ paddingTop: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Redefinir senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const PAPEIS_VINCULO = ['gestor', 'vendedor'] as const

function ModalEditarUsuario({
  usuario,
  lojas,
  onClose,
  onSalvo,
}: {
  usuario: UsuarioItem
  lojas: { id: string; nome: string }[]
  onClose: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(usuario.nome)
  const [email, setEmail] = useState(usuario.email)
  const [telefone, setTelefone] = useState(usuario.telefone || '')
  const [papel, setPapel] = useState(usuario.papel)
  const [ativo, setAtivo] = useState(usuario.ativo)
  const [novaLoja, setNovaLoja] = useState('')
  const [novoPapel, setNovoPapel] = useState<string>('vendedor')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // API antiga (sem deploy do backend) não devolve `vinculos`: sem este default
  // o .some() abaixo quebra a tela inteira com "Cannot read properties of undefined".
  const vinculos = usuario.vinculos ?? []

  // Lojas em que ele ainda não está — evita 409 de vínculo duplicado no select.
  const lojasDisponiveis = lojas.filter(
    (l) => !vinculos.some((v) => v.loja_id === l.id),
  )

  const acao = async (fn: () => Promise<any>) => {
    setLoading(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await fn()
      if (r?.mensagem) setAviso(r.mensagem)
      onSalvo()
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível concluir a ação.')
    } finally {
      setLoading(false)
    }
  }

  const salvarDados = (e: React.FormEvent) => {
    e.preventDefault()
    acao(() =>
      api.patch(`/admin/usuarios/${usuario.id}`, {
        nome,
        email,
        telefone: telefone || null,
        papel,
        ativo,
      }),
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Editar usuário</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {erro && (
            <div className="login-error-alert" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <span>{erro}</span>
            </div>
          )}
          {aviso && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 'var(--sv-radius)', fontSize: '13px',
              background: 'color-mix(in srgb, var(--sv-success) 12%, transparent)',
              color: 'var(--sv-success)',
            }}>
              <CheckCircle size={15} />
              <span>{aviso}</span>
            </div>
          )}

          <form onSubmit={salvarDados} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>E-mail (login)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
              <div className="form-group">
                <label>Papel na plataforma</label>
                <select value={papel} onChange={(e) => setPapel(e.target.value)}>
                  {Object.entries(PAPEL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, fontSize: '14px', color: 'var(--sv-text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                Conta ativa
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
              {loading ? <span className="spinner" /> : 'Salvar dados'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--sv-border)', paddingTop: '18px' }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--sv-text)' }}>Lojas do usuário</h4>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--sv-text-muted)' }}>
              Define em qual loja o vendedor trabalha. Sem nenhuma loja ativa ele não consegue entrar no sistema.
            </p>

            {vinculos.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--sv-text-muted)', margin: '0 0 12px' }}>Nenhuma loja vinculada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {vinculos.map((v) => (
                  <div key={v.membro_id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '10px 12px', borderRadius: 'var(--sv-radius)',
                    border: '1px solid var(--sv-border)', background: 'rgba(255,255,255,0.02)',
                  }}>
                    <span style={{ flex: 1, minWidth: 120, color: 'var(--sv-text)', fontWeight: 600, fontSize: '14px' }}>
                      {v.loja_nome}
                    </span>
                    <div className="form-group" style={{ minWidth: 110 }}>
                      <select
                        value={v.papel}
                        disabled={loading}
                        onChange={(e) => acao(() =>
                          api.patch(`/admin/usuarios/${usuario.id}/vinculos/${v.membro_id}`, { papel: e.target.value }),
                        )}
                      >
                        {PAPEIS_VINCULO.map((p) => (
                          <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-secondary"
                      disabled={loading}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => acao(() =>
                        api.patch(`/admin/usuarios/${usuario.id}/vinculos/${v.membro_id}`, { ativo: !v.ativo }),
                      )}
                    >
                      {v.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={loading}
                      style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--sv-error)' }}
                      onClick={() => {
                        if (!confirm(`Remover ${usuario.nome} da loja ${v.loja_nome}?`)) return
                        acao(() => api.delete(`/admin/usuarios/${usuario.id}/vinculos/${v.membro_id}`))
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <select
                  value={novaLoja}
                  onChange={(e) => setNovaLoja(e.target.value)}
                  disabled={lojasDisponiveis.length === 0}
                >
                  <option value="">
                    {lojasDisponiveis.length === 0 ? 'Já está em todas as lojas' : 'Selecione a loja…'}
                  </option>
                  {lojasDisponiveis.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 110 }}>
                <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value)}>
                  {PAPEIS_VINCULO.map((p) => (
                    <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                disabled={loading || !novaLoja}
                onClick={() => acao(async () => {
                  const r = await api.post(`/admin/usuarios/${usuario.id}/vinculos`, {
                    loja_id: novaLoja,
                    papel: novoPapel,
                  })
                  setNovaLoja('')
                  return r
                })}
              >
                Vincular
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [usuarioReset, setUsuarioReset] = useState<UsuarioItem | null>(null)
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioItem | null>(null)
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setErro(null)
    return api.get<UsuarioItem[]>(`/admin/usuarios?busca=${encodeURIComponent(busca)}`)
      .then((lista) => {
        setUsuarios(lista)
        // Mantém o modal aberto refletindo o estado recém-salvo.
        setUsuarioEditar((atual) => (atual ? lista.find((u) => u.id === atual.id) || null : null))
      })
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar os usuários.'))
  }, [busca])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      carregar().finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [carregar])

  useEffect(() => {
    api.get<{ id: string; nome: string }[]>('/admin/lojas')
      .then((l) => setLojas(l.map((x) => ({ id: x.id, nome: x.nome }))))
      .catch(() => setLojas([]))
  }, [])

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && <ErroAlerta msg={erro} onFechar={() => setErro(null)} />}
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
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : usuarios.length === 0 ? (
        <EmptyState msg={busca ? 'Nenhum usuário encontrado para essa busca.' : 'Nenhum usuário cadastrado.'} />
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Nome', 'E-mail', 'Papel', 'Lojas', 'Status', 'Ações'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{u.nome}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{u.email}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{PAPEL_LABELS[u.papel] || u.papel}</td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{u.lojas.length > 0 ? u.lojas.join(', ') : '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: '12px',
                      fontWeight: 600,
                      background: u.ativo ? 'color-mix(in srgb, var(--sv-success) 15%, transparent)' : 'color-mix(in srgb, var(--sv-error) 15%, transparent)',
                      color: u.ativo ? 'var(--sv-success)' : 'var(--sv-error)',
                    }}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setUsuarioEditar(u)}
                        title="Editar dados e lojas deste usuário"
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setUsuarioReset(u)}
                        title="Redefinir a senha deste usuário"
                      >
                        <KeyRound size={14} />
                        Resetar senha
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usuarioReset && (
        <ModalResetSenha usuario={usuarioReset} onClose={() => setUsuarioReset(null)} />
      )}

      {usuarioEditar && (
        <ModalEditarUsuario
          usuario={usuarioEditar}
          lojas={lojas}
          onClose={() => setUsuarioEditar(null)}
          onSalvo={carregar}
        />
      )}
    </div>
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
  const { confirm } = useUIStore()
  const [versoes, setVersoes] = useState<ContratoVersaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editorAberto, setEditorAberto] = useState(false)
  const [tornarVigenteLoading, setTornarVigenteLoading] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Loja usada para preencher as variáveis ao gerar/imprimir/enviar o documento.
  const [lojas, setLojas] = useState<LojaItem[]>([])
  const [lojaSel, setLojaSel] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [enviarVersao, setEnviarVersao] = useState<ContratoVersaoItem | null>(null)

  useEffect(() => {
    api.get<LojaItem[]>('/admin/lojas')
      .then((ls) => setLojas(ls.filter((l) => l.ativa)))
      .catch(() => { /* opcional: sem loja o contrato sai com os campos em branco */ })
  }, [])

  const paramsDoc = (versaoId: string) => {
    const p: Record<string, string> = { versao_id: versaoId }
    if (lojaSel) p.loja_id = lojaSel
    return p
  }

  const baixarPdf = async (v: ContratoVersaoItem) => {
    setOcupado(`pdf-${v.id}`)
    setErro(null)
    try {
      await api.download('/admin/contrato-assinatura/documento', paramsDoc(v.id), `contrato-${v.versao}.pdf`)
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar o PDF.')
    } finally {
      setOcupado(null)
    }
  }

  // Impressão rápida: carrega o PDF num iframe oculto e dispara o print do
  // navegador — sem passar por download nem abrir aba nova.
  const imprimir = async (v: ContratoVersaoItem) => {
    setOcupado(`print-${v.id}`)
    setErro(null)
    let objectUrl: string | null = null
    try {
      objectUrl = await api.blobUrl('/admin/contrato-assinatura/documento', paramsDoc(v.id))
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.right = '0'
      frame.style.bottom = '0'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      frame.src = objectUrl
      frame.onload = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
        } catch {
          setErro('O navegador bloqueou a impressão. Baixe o PDF e imprima por ele.')
        }
        // Só limpa depois do diálogo de impressão abrir; remover antes cancela o print.
        window.setTimeout(() => {
          frame.remove()
          if (objectUrl) URL.revokeObjectURL(objectUrl)
        }, 60000)
      }
      document.body.appendChild(frame)
    } catch (err: any) {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setErro(err.message || 'Erro ao preparar a impressão.')
    } finally {
      setOcupado(null)
    }
  }

  const carregar = useCallback(() => {
    setLoading(true)
    api.get<ContratoVersaoItem[]>('/admin/contrato-assinatura/versoes')
      .then(setVersoes)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar as versões do contrato.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const tornarVigente = async (id: string, versao: string) => {
    const ok = await confirm({
      title: 'Tornar versão vigente',
      message: `A versão "${versao}" passará a ser usada por padrão em todas as novas assinaturas. Confirmar?`,
      confirmText: 'Tornar vigente',
    })
    if (!ok) return
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
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <p style={{ color: 'var(--sv-text-muted)', fontSize: '14px', maxWidth: 480 }}>
          Texto do contrato de assinatura B2B (Social Veículos ↔ Loja). A versão vigente é a usada por padrão ao ativar uma nova assinatura.
        </p>
        <button className="btn btn-primary" onClick={() => setEditorAberto(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nova versão
        </button>
      </div>

      {erro && (
        <ErroAlerta msg={erro} onFechar={() => setErro(null)} />
      )}

      {aviso && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16, background: 'color-mix(in srgb, var(--sv-success) 12%, var(--sv-surface))', border: '1px solid color-mix(in srgb, var(--sv-success) 30%, var(--sv-border))', borderLeft: '3px solid var(--sv-success)', borderRadius: 'var(--sv-radius)', fontSize: 14 }}>
          <CheckCircle size={16} style={{ color: 'var(--sv-success)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{aviso}</span>
          <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setAviso(null)}>Fechar</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: 'var(--sv-text-muted)' }}>Preencher com os dados de:</label>
        <select
          className="filter-select"
          value={lojaSel}
          onChange={(e) => setLojaSel(e.target.value)}
          style={{ maxWidth: 280 }}
        >
          <option value="">Nenhuma loja — campos em branco</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : versoes.length === 0 ? (
        <EmptyState msg="Nenhuma versão do contrato cadastrada ainda. Clique em “Nova versão” para colar o texto atual." />
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          <table className="stock-table">
            <thead>
              <tr>
                {['Versão', 'Status', 'Criado em', 'Ações'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id}>
                  <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{v.versao}</td>
                  <td>
                    {v.vigente ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 10px', borderRadius: 999, fontSize: '12px', fontWeight: 600,
                        background: 'color-mix(in srgb, var(--sv-success) 15%, transparent)', color: 'var(--sv-success)',
                      }}>
                        <CheckCircle size={11} /> Vigente
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sv-text-muted)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--sv-text-dim)' }}>{fmtData(v.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => baixarPdf(v)}
                        disabled={ocupado === `pdf-${v.id}`}
                        title="Baixar o contrato em PDF"
                      >
                        <Download size={14} /> {ocupado === `pdf-${v.id}` ? 'Gerando…' : 'PDF'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => imprimir(v)}
                        disabled={ocupado === `print-${v.id}`}
                        title="Imprimir agora"
                      >
                        <Printer size={14} /> {ocupado === `print-${v.id}` ? 'Abrindo…' : 'Imprimir'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => { setAviso(null); setEnviarVersao(v) }}
                        title="Enviar por e-mail para assinatura digital"
                      >
                        <Mail size={14} /> Enviar
                      </button>
                      {!v.vigente && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => tornarVigente(v.id, v.versao)}
                          disabled={tornarVigenteLoading === v.id}
                        >
                          {tornarVigenteLoading === v.id ? 'Aplicando…' : 'Tornar vigente'}
                        </button>
                      )}
                    </div>
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

      {enviarVersao && (
        <ModalEnviarContrato
          versao={enviarVersao}
          lojas={lojas}
          lojaInicial={lojaSel}
          onClose={() => setEnviarVersao(null)}
          onEnviado={(email) => {
            setEnviarVersao(null)
            setAviso(`Contrato enviado para ${email}. O lojista devolve o arquivo assinado respondendo ao e-mail.`)
          }}
        />
      )}
    </div>
  )
}

function ModalEnviarContrato({ versao, lojas, lojaInicial, onClose, onEnviado }: {
  versao: ContratoVersaoItem
  lojas: LojaItem[]
  lojaInicial: string
  onClose: () => void
  onEnviado: (email: string) => void
}) {
  const [lojaId, setLojaId] = useState(lojaInicial)
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lojaId) {
      setErro('Escolha a loja destinatária — o contrato é preenchido com os dados dela.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const r = await api.post<{ enviado: boolean; email: string }>('/admin/contrato-assinatura/enviar', {
        loja_id: lojaId,
        versao_id: versao.id,
        email: email.trim() || undefined,
        mensagem: mensagem.trim() || undefined,
      })
      onEnviado(r.email)
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar o contrato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Enviar contrato para assinatura</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body modal-form-grid">
          {erro && <p className="span-2" style={{ color: 'var(--sv-error)', fontSize: 14, margin: 0 }}>{erro}</p>}

          <p className="span-2" style={{ fontSize: 13, color: 'var(--sv-text-muted)', margin: 0 }}>
            O PDF da versão <strong>{versao.versao}</strong> vai em anexo, já preenchido com os dados da loja.
            O lojista assina digitalmente e devolve respondendo ao e-mail.
          </p>

          <div className="form-group span-2">
            <label>Loja destinatária</label>
            <select className="form-input" value={lojaId} onChange={(e) => setLojaId(e.target.value)} required>
              <option value="">Selecione…</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-group span-2">
            <label>E-mail (opcional)</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Em branco: usa o e-mail da loja ou do gestor"
              maxLength={200}
            />
          </div>

          <div className="form-group span-2">
            <label>Mensagem (opcional)</label>
            <textarea
              className="form-input"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Um recado curto que aparece no corpo do e-mail."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {loading ? <span className="spinner" /> : <><Send size={15} /> Enviar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface VariavelResolvida {
  chave: string
  label: string
  valor: string
}

interface VariaveisContratoResponse {
  loja_id?: string | null
  loja_nome?: string | null
  variaveis: VariavelResolvida[]
}

function ModalNovaVersaoContrato({ versaoSugerida, onClose, onSaved }: { versaoSugerida?: string; onClose: () => void; onSaved: () => void }) {
  const [versao, setVersao] = useState('')
  const [conteudoHtml, setConteudoHtml] = useState('<p>Digite o texto do contrato aqui…</p>')
  const [tornarVigente, setTornarVigente] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Loja de referência: as variáveis são resolvidas com os dados reais dela,
  // para o admin conferir como o contrato sai antes de salvar a versão.
  const [lojas, setLojas] = useState<LojaItem[]>([])
  const [lojaRef, setLojaRef] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    api.get<LojaItem[]>('/admin/lojas')
      .then((ls) => setLojas(ls.filter((l) => l.ativa)))
      .catch(() => { /* selector opcional — o editor funciona sem ele */ })
  }, [])

  useEffect(() => {
    api.get<VariaveisContratoResponse>('/admin/contrato-assinatura/variaveis', lojaRef ? { loja_id: lojaRef } : undefined)
      .then((r) => setValores(Object.fromEntries(r.variaveis.map((v) => [v.chave, v.valor]))))
      .catch(() => setValores({}))
  }, [lojaRef])

  const verPreview = async () => {
    setPreviewLoading(true)
    setErro(null)
    try {
      const r = await api.post<{ conteudo_html: string; nao_resolvidas: string[] }>(
        '/admin/contrato-assinatura/preview',
        { conteudo_html: conteudoHtml, loja_id: lojaRef || undefined },
      )
      setPreview(r.conteudo_html)
      if (r.nao_resolvidas.length) {
        setErro(`Variáveis desconhecidas (saem como texto cru): ${r.nao_resolvidas.join(', ')}`)
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar a pré-visualização.')
    } finally {
      setPreviewLoading(false)
    }
  }

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
      <div className="modal-container glass-card modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Nova versão do contrato</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-body modal-form-grid">
          {erro && <p className="span-2" style={{ color: 'var(--sv-error)', fontSize: '14px', margin: 0 }}>{erro}</p>}

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

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', alignSelf: 'end', paddingBottom: 10 }}>
            <input type="checkbox" checked={tornarVigente} onChange={(e) => setTornarVigente(e.target.checked)} />
            Tornar esta a versão vigente
          </label>

          <div className="form-group span-2">
            <label>Loja de referência (pré-visualização)</label>
            <select className="form-input" value={lojaRef} onChange={(e) => { setLojaRef(e.target.value); setPreview(null) }}>
              <option value="">Nenhuma — mostrar as variáveis em branco</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginTop: 4 }}>
              O texto é salvo com as variáveis; a loja escolhida serve só para conferir como fica preenchido.
            </span>
          </div>

          <div className="form-group span-2">
            <label>Texto do contrato</label>
            <RichEditor
              value={conteudoHtml}
              onChange={setConteudoHtml}
              variaveis={CATALOGO_VARIAVEIS_ASSINATURA}
              labels={LABELS_VARIAVEIS_ASSINATURA}
              minHeight={320}
              placeholder="Digite o texto do contrato…"
            />
          </div>

          {Object.keys(valores).length > 0 && (
            <details className="span-2" style={{ border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)', padding: '10px 12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--sv-text-muted)' }}>
                Valores das variáveis {lojaRef ? 'para a loja selecionada' : '(sem loja selecionada)'}
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginTop: 10 }}>
                {CATALOGO_VARIAVEIS_ASSINATURA.map((g) => (
                  <div key={g.grupo}>
                    <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--sv-text-dim)', margin: '0 0 4px' }}>{g.grupo}</p>
                    {g.itens.map((it) => (
                      <p key={it.chave} style={{ fontSize: 12, margin: '0 0 2px', color: 'var(--sv-text-muted)' }}>
                        {it.label}: <span style={{ color: 'var(--sv-text)' }}>{valores[it.chave] || '—'}</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}

          {preview && (
            <div className="span-2" style={{ border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)', padding: 16, background: 'var(--sv-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Pré-visualização</strong>
                <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setPreview(null)}>Fechar</button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="button" className="btn btn-secondary" onClick={verPreview} disabled={previewLoading || loading}>
              {previewLoading ? 'Gerando…' : 'Pré-visualizar'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Aba Testes ───────────────────────────────────────────────────

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

  const cor = resultado?.ok ? 'var(--sv-success)' : 'var(--sv-error)'

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--sv-text)' }}>Suíte de testes da API</h3>
          <p style={{ color: 'var(--sv-text-muted)', fontSize: '14px', marginTop: 4 }}>
            Roda o pytest do backend (auth multi-loja, boot, credenciais) e mostra o resultado.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={rodar}
          disabled={rodando}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: rodando ? 'wait' : 'pointer' }}
        >
          {rodando ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Play size={16} />}
          {rodando ? 'Rodando…' : 'Rodar testes'}
        </button>
      </div>

      {erro && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginTop: '20px', background: 'color-mix(in srgb, var(--sv-error) 12%, var(--sv-surface))', border: '1px solid color-mix(in srgb, var(--sv-error) 30%, var(--sv-border))', borderLeft: '3px solid var(--sv-error)', borderRadius: 'var(--sv-radius)', fontSize: '14px', color: 'var(--sv-text)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--sv-error)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{erro}</span>
        </div>
      )}

      {rodando && !resultado && (
        <LoadingState msg="Executando a suíte (pode levar alguns segundos)…" />
      )}

      {resultado && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 'var(--sv-radius)', border: `1px solid ${cor}`, background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
            {resultado.ok ? <CheckCircle size={24} color={cor} /> : <XCircle size={24} color={cor} />}
            <div>
              <div style={{ fontWeight: 700, color: cor }}>{resultado.ok ? 'Todos os testes passaram' : 'Há testes falhando'}</div>
              <div style={{ fontSize: '14px', color: 'var(--sv-text-dim)', marginTop: 2 }}>
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

// ── Consumo de IA ────────────────────────────────────────────────

interface ConsumoLoja {
  loja_id: string
  loja_nome: string
  chamadas: number
  tokens_input: number
  tokens_output: number
  tokens_total: number
}

interface ConsumoIA {
  dias: number
  desde: string
  total_chamadas: number
  total_tokens: number
  por_funcionalidade: Record<string, number>
  lojas: ConsumoLoja[]
}

const FUNCIONALIDADE_LABELS: Record<string, string> = {
  marketing: 'Geração de anúncios',
  triagem: 'Triagem de leads',
}

const PERIODOS = [
  { valor: 7, label: 'Últimos 7 dias' },
  { valor: 30, label: 'Últimos 30 dias' },
  { valor: 90, label: 'Últimos 90 dias' },
]

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR')
}

/** Abrevia só na casa dos milhões: misturar "12 mil" com "5.106" na mesma
 *  coluna quebra a comparação visual entre as linhas. */
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  return fmtNum(n)
}

function AbaConsumoIA() {
  const [dados, setDados] = useState<ConsumoIA | null>(null)
  const [dias, setDias] = useState(30)
  const [funcionalidade, setFuncionalidade] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    setErro(null)
    const params: Record<string, string> = { dias: String(dias) }
    if (funcionalidade) params.funcionalidade = funcionalidade
    api.get<ConsumoIA>('/admin/consumo-ia', params)
      .then(setDados)
      .catch((err: any) => setErro(err?.message || 'Erro ao carregar o consumo de IA.'))
      .finally(() => setLoading(false))
  }, [dias, funcionalidade])

  useEffect(() => { carregar() }, [carregar])

  // O maior consumo vira a régua das barras de proporção.
  const maiorTotal = dados?.lojas.length ? dados.lojas[0].tokens_total : 0

  return (
    <div style={{ marginTop: '24px' }}>
      {erro && <ErroAlerta msg={erro} onFechar={() => setErro(null)} />}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={ESTILO_CAMPO_FILTRO} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>{p.label}</option>
          ))}
        </select>

        <select style={ESTILO_CAMPO_FILTRO} value={funcionalidade} onChange={(e) => setFuncionalidade(e.target.value)}>
          <option value="">Todas as funcionalidades</option>
          <option value="marketing">{FUNCIONALIDADE_LABELS.marketing}</option>
          <option value="triagem">{FUNCIONALIDADE_LABELS.triagem}</option>
        </select>

        <button
          className="btn btn-secondary"
          onClick={carregar}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40 }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <LoadingState msg="Carregando consumo de IA…" />
      ) : !dados ? (
        <EmptyState msg="Não foi possível carregar o consumo." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <StatCard label="Chamadas à IA" value={dados.total_chamadas} Icon={Sparkles} />
            <StatCard label="Tokens consumidos" value={dados.total_tokens} Icon={Activity} />
            <StatCard label="Lojas usando IA" value={dados.lojas.length} Icon={Building2} />
          </div>

          {Object.keys(dados.por_funcionalidade).length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {Object.entries(dados.por_funcionalidade).map(([chave, tokens]) => (
                <div
                  key={chave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--sv-border)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--sv-text-dim)' }}>
                    {FUNCIONALIDADE_LABELS[chave] || chave}
                  </span>
                  <span style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{fmtNum(tokens)}</span>
                  <span style={{ color: 'var(--sv-text-muted)', fontSize: 12 }}>tokens</span>
                </div>
              ))}
            </div>
          )}

          {dados.lojas.length === 0 ? (
            <EmptyState msg="Nenhum consumo de IA registrado no período." />
          ) : (
            <div style={{ overflow: 'auto', borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Loja</th>
                    <th style={{ textAlign: 'right' }}>Chamadas</th>
                    <th style={{ textAlign: 'right' }}>Entrada</th>
                    <th style={{ textAlign: 'right' }}>Saída</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ width: '20%' }}>Proporção</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lojas.map((l, i) => (
                    <tr key={l.loja_id}>
                      <td style={{ color: 'var(--sv-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                      <td style={{ color: 'var(--sv-text)', fontWeight: 600 }}>{l.loja_nome}</td>
                      <td style={{ textAlign: 'right', color: 'var(--sv-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(l.chamadas)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--sv-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTokens(l.tokens_input)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--sv-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTokens(l.tokens_output)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--sv-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(l.tokens_total)}
                      </td>
                      <td>
                        <div
                          style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}
                          title={`${fmtNum(l.tokens_total)} tokens`}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${maiorTotal ? Math.max((l.tokens_total / maiorTotal) * 100, 2) : 0}%`,
                              background: 'var(--sv-primary)',
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ color: 'var(--sv-text-muted)', fontSize: 12, marginTop: 12 }}>
            O consumo é atribuído à loja dona do veículo ou da conversa — operações do
            suporte dentro de uma loja não distorcem o ranking.
          </p>
        </>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────

type Aba = 'overview' | 'lojas' | 'financeiro' | 'planos' | 'contrato' | 'auditoria' | 'erros' | 'usuarios' | 'testes' | 'consumo-ia'

const ABAS: { id: Aba; label: string; Icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'lojas', label: 'Lojas', Icon: Building2 },
  { id: 'usuarios', label: 'Usuários', Icon: Users },
  { id: 'financeiro', label: 'Financeiro', Icon: CreditCard },
  { id: 'planos', label: 'Planos', Icon: Package },
  { id: 'contrato', label: 'Contrato', Icon: FileText },
  { id: 'consumo-ia', label: 'Consumo IA', Icon: Sparkles },
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
      {aba === 'usuarios' && <AbaUsuarios />}
      {aba === 'financeiro' && <AbaFinanceiro />}
      {aba === 'planos' && <AbaPlanos />}
      {aba === 'contrato' && <AbaContrato />}
      {aba === 'consumo-ia' && <AbaConsumoIA />}
      {aba === 'auditoria' && <AbaAuditoria />}
      {aba === 'erros' && <AbaErros />}
      {aba === 'testes' && <AbaTestes />}
    </div>
  )
}
