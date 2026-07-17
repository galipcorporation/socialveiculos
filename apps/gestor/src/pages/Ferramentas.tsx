import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, extractErrorDetails, type ApiErrorDetails } from '../lib/api'
import { useUIStore } from '../stores/uiStore'

/* ── Types ───────────────────────────────────────────────────── */

interface ModuloStatus {
  modulo: 'contratos' | 'simulador' | 'marketing' | 'assistente_ia' | 'fiscal' | 'site'
  contratado: boolean
  liberado: boolean
  cta_upgrade?: string | null
}

interface Plano {
  id: string
  nome: string
  descricao?: string
  preco_mensal: number
  modulos_incluidos?: string // JSON array string
  ativo: boolean
}

interface Assinatura {
  id: string
  loja_id: string
  plano_id: string
  status: 'ativa' | 'cancelada' | 'suspensa' | 'expirada'
  inicio: string
  fim?: string
  created_at: string
}

interface MinhaAssinatura {
  assinatura?: Assinatura | null
  plano?: Plano | null
  em_dia: boolean
  modulos_ativos: string[]
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

const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
)

const CreditCardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const ModuloIcons: Record<string, ReactElement> = {
  contratos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  simulador: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="14" y1="14" x2="16" y2="14" />
    </svg>
  ),
  marketing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
    </svg>
  ),
  assistente_ia: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  ),
  fiscal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <path d="M9 2h6l5 5v13a2 2 0 01-2 2H9a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  site: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
}

const MODULO_INFO: Record<string, { titulo: string; desc: string }> = {
  contratos: {
    titulo: 'Contratos',
    desc: 'Gere contratos e termos de garantia, e leia documentos com OCR — tudo dentro do Gestor.',
  },
  simulador: {
    titulo: 'Simulador',
    desc: 'Simulação de financiamento multi-banco com impressão de proposta para o cliente.',
  },
  marketing: {
    titulo: 'Marketing',
    desc: 'Gere posts e criativos a partir do seu estoque com um clique.',
  },
  assistente_ia: {
    titulo: 'Assistente de IA',
    desc: 'Conecte seu WhatsApp pessoal ou comercial e deixe a IA responder ou sugerir mensagens (copiloto) para seus leads.',
  },
  fiscal: {
    titulo: 'Fiscal / NF-e',
    desc: 'Emita nota fiscal de venda direto do contrato, com impostos calculados automaticamente.',
  },
  site: {
    titulo: 'Meu Site / Vitrine',
    desc: 'Crie e personalize um site exclusivo para a sua loja com o seu estoque integrado em tempo real.',
  },
}

function formatCurrency(value?: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_ASSINATURA: Record<string, { label: string; cls: string }> = {
  ativa: { label: 'Ativa', cls: 'success' },
  suspensa: { label: 'Inadimplente', cls: 'warning' },
  expirada: { label: 'Expirada', cls: 'error' },
  cancelada: { label: 'Cancelada', cls: 'error' },
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */

export function Ferramentas() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, details?: ApiErrorDetails) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message, details }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="page-content">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="page-header">
        <h2>Ferramentas & Módulos Premium</h2>
        <p>Acesse os módulos habilitados para a sua loja.</p>
      </div>

      <ModulosTab addToast={addToast} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MÓDULOS TAB — cards com paywall + abertura via SSO
   ══════════════════════════════════════════════════════════════ */

function ModulosTab({
  addToast,
}: {
  addToast: (type: ToastType, message: string, details?: any) => void
}) {
  const [modulos, setModulos] = useState<ModuloStatus[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchModulos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<ModuloStatus[]>('/assinaturas/modulos')
      setModulos(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar módulos', details)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchModulos() }, [fetchModulos])

  // Cada módulo abre sua página dedicada (rota própria), não mais modal.
  const ROTA_MODULO: Record<string, string> = {
    simulador: '/ferramentas/simulador',
    contratos: '/ferramentas/contratos',
    marketing: '/ferramentas/marketing',
    assistente_ia: '/assistente',
    fiscal: '/ferramentas/notas-fiscais',
    site: '/ferramentas/meu-site',
  }

  const abrirModulo = (modulo: string) => {
    const rota = ROTA_MODULO[modulo]
    if (rota) navigate(rota)
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p style={{ marginTop: 16 }}>Carregando módulos…</p>
      </div>
    )
  }

  return (
    <div className="modulos-grid">
      {modulos.map(m => {
        const info = MODULO_INFO[m.modulo] || { titulo: m.modulo, desc: 'Módulo premium.' }
        return (
          <div key={m.modulo} className={`modulo-card ${m.liberado ? '' : 'locked'}`}>
            <div className="modulo-card-top">
              <div className="modulo-icon">{ModuloIcons[m.modulo] || <WrenchIcon />}</div>
              {m.liberado ? (
                <span className="modulo-badge success"><CheckIcon /> Ativo</span>
              ) : (
                <span className="modulo-badge muted"><LockIcon /> Bloqueado</span>
              )}
            </div>

            <h3 className="modulo-title">{info.titulo}</h3>
            <p className="modulo-desc">{info.desc}</p>

            <div className="modulo-card-footer">
              {m.liberado ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => abrirModulo(m.modulo)}
                >
                  Abrir módulo <ArrowRightIcon />
                </button>
              ) : (
                <div className="paywall-cta">
                  <p className="paywall-text">
                    Este módulo não está ativo para a sua loja. Contate o seu consultor ou o suporte para habilitar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
