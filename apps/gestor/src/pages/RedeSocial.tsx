import React, { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { api, extractErrorDetails, type ApiErrorDetails } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { mascararMoeda, parseMoeda } from '../lib/mascaras'
import { createReconnectingSocket, type ReconnectingSocket } from '../lib/ws'

/* ── Types ───────────────────────────────────────────────────── */

interface Midia { id: string; tipo: string; url: string; ordem: number }

interface Veiculo {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao: number
  ano_modelo: number
  km: number
  cor?: string
  preco_venda: number
  status: string
  midias: Midia[]
}

interface Curtida {
  id: string
  publicacao_id: string
  usuario_id: string
  created_at: string
}

interface Comentario {
  id: string
  publicacao_id: string
  autor_id: string
  autor_nome: string
  conteudo: string
  created_at: string
}

interface PublicacaoB2B {
  id: string
  loja_id: string
  loja_nome: string
  veiculo_id: string
  veiculo: Veiculo
  autor_id?: string
  autor_nome: string
  conteudo?: string
  valor_repasse?: number
  ativa: boolean
  created_at: string
  updated_at: string
  comentarios: Comentario[]
  curtidas: Curtida[]
  curtido_por_mim: boolean
}

interface PropostaRepasse {
  id: string
  loja_proponente_id: string
  loja_proponente_nome: string
  loja_destino_id: string
  loja_destino_nome: string
  veiculo_id: string
  veiculo: Veiculo
  valor_proposta: number
  status: 'pendente' | 'aceita' | 'rejeitada' | 'cancelada'
  observacoes?: string
  created_at: string
  updated_at: string
}

interface LojaParceira {
  id: string
  nome: string
  slug: string
  logo_url?: string
  telefone?: string
  whatsapp?: string
  email?: string
  cidade?: string
  estado?: string
  verificada: boolean
}

interface Conversa {
  id: string
  tipo: 'b2c' | 'b2b'
  loja_a_id: string
  loja_a_nome: string
  loja_b_id: string
  loja_b_nome: string
  ativa: boolean
  created_at: string
  updated_at: string
  ultima_mensagem?: string
  ultima_mensagem_data?: string
}

interface Mensagem {
  id: string
  conversa_id: string
  autor_id: string
  autor_nome: string
  conteudo: string
  lida: boolean
  created_at: string
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

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <rect x="1" y="6" width="22" height="10" rx="3" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M5 6L7 2h10l2 4" />
  </svg>
)

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCurrency(value?: number) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function RedeSocial() {
  const [activeTab, setActiveTab] = useState<'feed' | 'propostas' | 'parceiros' | 'chat' | 'clientes'>('feed')
  const [initialConversaId, setInitialConversaId] = useState<string | undefined>(undefined)
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const addToast = useCallback((type: ToastType, message: string, details?: ApiErrorDetails) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message, details }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="page-header" style={{ marginBottom: 20 }}>
        <h2>Rede de Repasses</h2>
        <p>Negocie veículos de repasse e conecte-se com garagens parceiras.</p>
      </div>

      {/* Tabs */}
      <div className="filter-bar" style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <button
          className={`btn ${activeTab === 'feed' ? 'btn-primary' : 'quick-action-btn'}`}
          onClick={() => setActiveTab('feed')}
        >
          Feed de Repasses
        </button>
        <button
          className={`btn ${activeTab === 'propostas' ? 'btn-primary' : 'quick-action-btn'}`}
          onClick={() => setActiveTab('propostas')}
        >
          Propostas de Repasse
        </button>
        <button
          className={`btn ${activeTab === 'parceiros' ? 'btn-primary' : 'quick-action-btn'}`}
          onClick={() => setActiveTab('parceiros')}
        >
          Diretório de Parceiros
        </button>
        <button
          className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'quick-action-btn'}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat de Parceiros
        </button>
        <button
          className={`btn ${activeTab === 'clientes' ? 'btn-primary' : 'quick-action-btn'}`}
          onClick={() => setActiveTab('clientes')}
        >
          Chat Clientes
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'feed' && <FeedTab addToast={addToast} onStartChat={(id) => { setInitialConversaId(id); setActiveTab('chat') }} />}
        {activeTab === 'propostas' && <PropostasTab addToast={addToast} />}
        {activeTab === 'parceiros' && <ParceirosTab addToast={addToast} onStartChat={(id) => { setInitialConversaId(id); setActiveTab('chat') }} />}
        {activeTab === 'chat' && <ChatTab token={token} user={user} addToast={addToast} initialConversaId={initialConversaId} />}
        {activeTab === 'clientes' && <ChatClientesTab token={token} user={user} addToast={addToast} />}
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────
   TAB 1: FEED DE REPASSES
   ─────────────────────────────────────────────────────────────── */

function FeedTab({ addToast, onStartChat }: { addToast: (t: ToastType, m: string, details?: any) => void, onStartChat: (conversaId: string) => void }) {
  const user = useAuthStore((state) => state.user)
  const [repasses, setRepasses] = useState<PublicacaoB2B[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState<Record<string, string>>({})
  
  // Modal Proposta
  const [proposalPub, setProposalPub] = useState<PublicacaoB2B | null>(null)
  const [proposalVal, setProposalVal] = useState(0)
  const [proposalValStr, setProposalValStr] = useState('')
  const [proposalObs, setProposalObs] = useState('')

  const fetchRepasses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<PublicacaoB2B[]>('/b2b/repasses')
      setRepasses(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar feed', details)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchRepasses()
  }, [fetchRepasses])

  const handleLike = async (pubId: string) => {
    try {
      await api.post(`/b2b/repasses/${pubId}/curtir`)
      setRepasses(prev => prev.map(pub => {
        if (pub.id === pubId) {
          const liked = !pub.curtido_por_mim
          return {
            ...pub,
            curtido_por_mim: liked,
            curtidas: liked
              ? [...pub.curtidas, { id: 'temp', publicacao_id: pubId, usuario_id: 'me', created_at: '' }]
              : pub.curtidas.filter(c => c.usuario_id !== 'me')
          }
        }
        return pub
      }))
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao curtir', details)
    }
  }

  const handleSendDirectMessage = async (pub: PublicacaoB2B) => {
    const content = newMessage[pub.id]?.trim()
    if (!content) return
    try {
      const conv = await api.post<{ id: string }>('/b2b/chat/conversas', { outra_loja_id: pub.loja_id })
      await api.post(`/b2b/chat/conversas/${conv.id}/mensagens`, { conteudo: content })
      addToast('success', 'Mensagem enviada com sucesso no Chat B2B!')
      setNewMessage(prev => ({ ...prev, [pub.id]: '' }))
      onStartChat(conv.id)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao enviar mensagem', details)
    }
  }

  const handleOpenProposal = (pub: PublicacaoB2B) => {
    setProposalPub(pub)
    const val = pub.valor_repasse || pub.veiculo?.preco_venda || 0
    setProposalVal(val)
    setProposalValStr(mascararMoeda(val))
    setProposalObs('')
  }

  const handleSendProposal = async () => {
    if (!proposalPub) return
    try {
      await api.post('/b2b/propostas', {
        veiculo_id: proposalPub.veiculo_id,
        valor_proposta: proposalVal,
        observacoes: proposalObs
      })
      addToast('success', 'Proposta de repasse enviada com sucesso!')
      setProposalPub(null)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao enviar proposta', details)
    }
  }

  const handleDirectChat = async (lojaId: string) => {
    try {
      const res = await api.post<{ id: string }>('/b2b/chat/conversas', { outra_loja_id: lojaId })
      onStartChat(res.id)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao iniciar chat', details)
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Carregando feed de repasses...</p>
      </div>
    )
  }

  if (repasses.length === 0) {
    return (
      <div className="empty-state">
        <CarIcon />
        <h3>Feed Vazio</h3>
        <p>Nenhuma loja parceira publicou veículos para repasse no momento.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20, overflowY: 'auto', maxHeight: '100%', paddingBottom: 20 }}>
      {repasses.map(pub => (
        <div key={pub.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="topbar-user-avatar">{pub.loja_nome[0]}</div>
              <div>
                <h4 style={{ margin: 0 }}>{pub.loja_nome}</h4>
                <span style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>Postado por {pub.autor_nome} em {formatDate(pub.created_at)}</span>
              </div>
            </div>
            {pub.loja_id !== user?.loja_id && (
              <button className="btn quick-action-btn" onClick={() => handleDirectChat(pub.loja_id)}>Chat</button>
            )}
          </div>

          {/* Media & Vehicle details */}
          <div style={{ display: 'flex', gap: 12, background: 'var(--sv-surface-dim)', padding: 10, borderRadius: 'var(--sv-radius-md)' }}>
            <div style={{ width: 100, height: 75, background: 'var(--sv-surface-dim)', borderRadius: 'var(--sv-radius)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {pub.veiculo?.midias && pub.veiculo.midias.length > 0 ? (
                <img src={pub.veiculo.midias[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <CarIcon />
              )}
            </div>
            {pub.veiculo ? (
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>{pub.veiculo.marca} {pub.veiculo.modelo}</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--sv-text-dim)' }}>
                  {pub.veiculo.ano_fabricacao}/{pub.veiculo.ano_modelo} · {pub.veiculo.km.toLocaleString('pt-BR')} km
                </p>
                <div style={{ marginTop: 4, fontWeight: 'bold', color: 'var(--sv-success)', fontSize: 14 }}>
                  Repasse: {formatCurrency(pub.valor_repasse || pub.veiculo.preco_venda)}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--sv-text-dim)' }}>Veículo não disponível</h4>
                <div style={{ marginTop: 4, fontWeight: 'bold', color: 'var(--sv-success)', fontSize: 14 }}>
                  Repasse: {formatCurrency(pub.valor_repasse)}
                </div>
              </div>
            )}
          </div>

          {/* Text content */}
          {pub.conteudo && <p style={{ margin: 0, fontSize: 13 }}>{pub.conteudo}</p>}

          {/* Engagement counts & Action Buttons */}
          <div style={{ display: 'flex', gap: 15, borderTop: '1px solid var(--sv-border)', borderBottom: '1px solid var(--sv-border)', padding: '8px 0' }}>
            <button
              onClick={() => handleLike(pub.id)}
              style={{ background: 'none', border: 'none', color: pub.curtido_por_mim ? 'var(--sv-error)' : 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <HeartIcon filled={pub.curtido_por_mim} />
              <span>{pub.curtidas.length}</span>
            </button>
            {pub.loja_id !== user?.loja_id ? (
              <button
                onClick={() => handleOpenProposal(pub)}
                className="btn btn-primary"
                style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
              >
                Enviar Proposta
              </button>
            ) : (
              <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '11px', color: 'var(--sv-primary-text)', fontWeight: 'bold', textTransform: 'uppercase', background: 'var(--sv-surface-hover)', padding: '4px 8px', borderRadius: '4px' }}>
                Meu Repasse
              </span>
            )}
          </div>

          {/* Enviar mensagem direta no chat (somente para carros de terceiros) */}
          {pub.loja_id !== user?.loja_id && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enviar mensagem no Chat B2B..."
                className="topbar-search"
                style={{ flex: 1, height: 32, padding: '0 10px', fontSize: 12, border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', color: 'var(--sv-text)' }}
                value={newMessage[pub.id] || ''}
                onChange={e => setNewMessage(prev => ({ ...prev, [pub.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSendDirectMessage(pub)}
              />
              <button
                className="btn"
                style={{ padding: '0 12px', height: 32, fontSize: 12 }}
                onClick={() => handleSendDirectMessage(pub)}
              >
                Enviar
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Proposal Modal */}
      {proposalPub && (
        <div className="modal-overlay" onClick={() => setProposalPub(null)}>
          <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Proposta de Repasse</h3>
              <button className="modal-close" onClick={() => setProposalPub(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0 }}>Você está fazendo uma proposta para o veículo <strong>{proposalPub.veiculo?.marca || 'Veículo'} {proposalPub.veiculo?.modelo || ''}</strong> da loja <strong>{proposalPub.loja_nome}</strong>.</p>
              
              <div className="form-group">
                <label>Valor da Proposta (R$)</label>
                <input
                  type="text"
                  value={proposalValStr}
                  onChange={e => {
                    const masked = mascararMoeda(e.target.value)
                    setProposalValStr(masked)
                    setProposalVal(parseMoeda(masked))
                  }}
                  style={{ width: '100%', height: 40, padding: 10, background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', borderRadius: 6, color: 'var(--sv-text)' }}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Observações / Condições</label>
                  <span style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>{proposalObs.length}/155</span>
                </div>
                <textarea
                  value={proposalObs}
                  onChange={e => setProposalObs(e.target.value)}
                  maxLength={155}
                  placeholder="Ex: Pagamento à vista via PIX, busca do carro amanhã."
                  style={{ width: '100%', height: 80, padding: 10, background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', borderRadius: 6, color: 'var(--sv-text)', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn quick-action-btn" style={{ flex: 1 }} onClick={() => setProposalPub(null)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSendProposal}>Enviar Proposta</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────
   TAB 2: PROPOSTAS
   ─────────────────────────────────────────────────────────────── */

function PropostasTab({ addToast }: { addToast: (t: ToastType, m: string, details?: any) => void }) {
  const [subTab, setSubTab] = useState<'recebidas' | 'enviadas'>('recebidas')
  const [propostas, setPropostas] = useState<PropostaRepasse[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPropostas = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = subTab === 'recebidas' ? '/b2b/propostas/recebidas' : '/b2b/propostas/enviadas'
      const data = await api.get<PropostaRepasse[]>(endpoint)
      setPropostas(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao carregar propostas', details)
    } finally {
      setLoading(false)
    }
  }, [subTab, addToast])

  useEffect(() => {
    fetchPropostas()
  }, [fetchPropostas])

  const handleStatusChange = async (propId: string, newStatus: string) => {
    const ok = await useUIStore.getState().confirm({
      title: 'Alterar Status da Proposta',
      message: `Deseja realmente alterar o status desta proposta para "${newStatus}"?`,
      confirmText: 'Alterar',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.patch(`/b2b/propostas/${propId}/status`, { status: newStatus })
      addToast('success', `Proposta ${newStatus === 'aceita' ? 'aceita!' : 'rejeitada/cancelada'}.`)
      fetchPropostas()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      addToast('error', message || 'Erro ao processar proposta', details)
    }
  }

  const STATUS_THEME: Record<string, string> = {
    pendente: 'orange',
    aceita: 'var(--sv-success)',
    rejeitada: 'var(--sv-error)',
    cancelada: 'var(--sv-text-muted)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub tabs */}
      <div className="sv-segmented" role="tablist" aria-label="Filtrar propostas">
        <button
          role="tab"
          aria-selected={subTab === 'recebidas'}
          onClick={() => setSubTab('recebidas')}
          className="sv-segmented__item"
        >
          Recebidas
        </button>
        <button
          role="tab"
          aria-selected={subTab === 'enviadas'}
          onClick={() => setSubTab('enviadas')}
          className="sv-segmented__item"
        >
          Enviadas
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Carregando propostas...</p>
        </div>
      ) : propostas.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhuma proposta</h3>
          <p>Você não tem propostas {subTab} no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, overflowY: 'auto', flex: 1, paddingBottom: 20, alignItems: 'start' }}>
          {propostas.map(p => (
            <div key={p.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between' }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    {p.veiculo ? (
                      <>
                        <h4 style={{ margin: 0, fontSize: 15 }}>{p.veiculo.marca} {p.veiculo.modelo}</h4>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>
                          Valor original: {formatCurrency(p.veiculo.preco_venda)}
                        </span>
                      </>
                    ) : (
                      <h4 style={{ margin: 0, fontSize: 15, color: 'var(--sv-text-dim)', fontStyle: 'italic' }}>Veículo Excluído</h4>
                    )}
                  </div>
                  <span
                    style={{
                      color: STATUS_THEME[p.status],
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: 10,
                      background: 'var(--sv-surface-hover)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Details */}
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--sv-text-dim)' }}>{subTab === 'recebidas' ? 'Proponente:' : 'Proprietário:'}</span>
                    <span style={{ fontWeight: 500 }}>{subTab === 'recebidas' ? p.loja_proponente_nome : p.loja_destino_nome}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--sv-text-dim)' }}>Data:</span>
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ color: 'var(--sv-text-dim)' }}>Valor Oferecido:</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--sv-success)', fontSize: 16 }}>{formatCurrency(p.valor_proposta)}</span>
                  </div>
                </div>

                {/* Observações / Comentários */}
                {p.observacoes && (
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--sv-surface-dim)', borderRadius: 'var(--sv-radius)', fontSize: 12, borderLeft: '3px solid var(--sv-primary)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--sv-text-dim)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observações / Condições:</div>
                    <div style={{ fontStyle: 'italic', color: 'var(--sv-text)' }}>"{p.observacoes}"</div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {p.status === 'pendente' && (
                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--sv-border)', paddingTop: 10, marginTop: 4 }}>
                  {subTab === 'recebidas' ? (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleStatusChange(p.id, 'aceita')}
                      >
                        Aceitar
                      </button>
                      <button
                        className="btn danger"
                        style={{ flex: 1, padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleStatusChange(p.id, 'rejeitada')}
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn danger"
                      style={{ flex: 1, padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleStatusChange(p.id, 'cancelada')}
                    >
                      Cancelar Proposta
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────
   TAB 3: DIRETÓRIO DE PARCEIROS
   ─────────────────────────────────────────────────────────────── */

function ParceirosTab({ addToast, onStartChat }: { addToast: (t: ToastType, m: string, details?: any) => void, onStartChat: (conversaId: string) => void }) {
  const [parceiros, setParceiros] = useState<LojaParceira[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [mostrarApenasFavoritos, setMostrarApenasFavoritos] = useState(false)

  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sv-parceiros-favoritos')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const toggleFavorito = (lojaId: string) => {
    setFavoritos(prev => {
      const next = prev.includes(lojaId)
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
      localStorage.setItem('sv-parceiros-favoritos', JSON.stringify(next))
      return next
    })
  }

  const getVitrineUrl = (lojaId: string) => {
    const isLocal = window.location.hostname === 'localhost'
    const base = isLocal ? 'http://localhost:5174' : `${window.location.protocol}//${window.location.host.replace('gestor', 'vitrine')}`
    return `${base}/loja/${lojaId}`
  }

  const fetchParceiros = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.q = search
      if (cidade) params.cidade = cidade
      if (estado) params.estado = estado

      const data = await api.get<LojaParceira[]>('/b2b/parceiros', params)
      setParceiros(data)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar diretório')
    } finally {
      setLoading(false)
    }
  }, [search, cidade, estado, addToast])

  useEffect(() => {
    fetchParceiros()
  }, [fetchParceiros])

  const handleStartConversation = async (lojaId: string) => {
    try {
      const res = await api.post<{ id: string }>('/b2b/chat/conversas', { outra_loja_id: lojaId })
      onStartChat(res.id)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao iniciar conversa')
    }
  }

  const parceirosFiltrados = parceiros.filter(p => {
    if (mostrarApenasFavoritos) {
      return favoritos.includes(p.id)
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search and Filters */}
      <div className="filter-bar" style={{ marginBottom: 15 }}>
        <div className="search-wrapper" style={{ flex: '1 1 200px', maxWidth: 300 }}>
          <SearchIcon />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input
          type="text"
          placeholder="Cidade"
          className="search-input"
          style={{ width: 150, height: 40, padding: '0 16px', background: 'var(--sv-input-bg)', border: '1px solid var(--sv-border)', borderRadius: 20, color: 'var(--sv-text)', flex: 'none' }}
          value={cidade}
          onChange={e => setCidade(e.target.value)}
        />
        <input
          type="text"
          placeholder="UF"
          maxLength={2}
          className="search-input"
          style={{ width: 80, height: 40, padding: '0 16px', background: 'var(--sv-input-bg)', border: '1px solid var(--sv-border)', borderRadius: 20, color: 'var(--sv-text)', textTransform: 'uppercase', flex: 'none' }}
          value={estado}
          onChange={e => setEstado(e.target.value.toUpperCase())}
        />
        <button className="btn btn-primary" onClick={fetchParceiros}>Filtrar</button>
        <button
          className={`btn ${mostrarApenasFavoritos ? 'btn-primary' : 'btn-glass'}`}
          onClick={() => setMostrarApenasFavoritos(!mostrarApenasFavoritos)}
          style={{ height: 40, padding: '0 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <HeartIcon filled={mostrarApenasFavoritos} />
          <span>Favoritos</span>
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Carregando parceiros...</p>
        </div>
      ) : parceirosFiltrados.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum parceiro encontrado</h3>
          <p>Tente ajustar os filtros de busca.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, paddingBottom: 20 }}>
          {parceirosFiltrados.map(p => (
            <div key={p.id} className="glass-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, padding: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: '250px' }}>
                <div className="topbar-user-avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>{p.nome[0]}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16, margin: 0 }}>{p.nome}</h3>
                    <button
                      onClick={() => toggleFavorito(p.id)}
                      style={{ background: 'none', border: 'none', color: favoritos.includes(p.id) ? 'var(--sv-error)' : 'var(--sv-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      title={favoritos.includes(p.id) ? 'Remover dos Favoritos' : 'Favoritar Parceiro'}
                    >
                      <HeartIcon filled={favoritos.includes(p.id)} />
                    </button>
                  </div>
                  <p style={{ margin: '4px 0 8px 0', fontSize: 12, color: 'var(--sv-text-dim)' }}>
                    📍 {p.cidade || 'Sem cidade'} - {p.estado || 'UF'}
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--sv-text-dim)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {p.telefone && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>📞 {p.telefone}</div>}
                    {p.whatsapp && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>💬 {p.whatsapp} (WhatsApp)</div>}
                    {p.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>✉️ {p.email}</div>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <a
                  href={getVitrineUrl(p.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-glass"
                  style={{ fontSize: 13, padding: '10px 20px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Ver Vitrine
                </a>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '10px 20px' }} onClick={() => handleStartConversation(p.id)}>
                  Abrir Chat B2B
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────
   TAB 4: CHAT B2B (REALTIME WEBSOCKET)
   ─────────────────────────────────────────────────────────────── */

function ChatTab({ token, user, addToast, initialConversaId }: { token: string | null, user: any, addToast: (t: ToastType, m: string, details?: any) => void, initialConversaId?: string }) {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [filtered, setFiltered] = useState<Conversa[]>([])
  const [search, setSearch] = useState('')
  const [activeConversa, setActiveConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [loadingMensagens, setLoadingMensagens] = useState(false)

  const wsRef = useRef<ReconnectingSocket | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchConversas = useCallback(async () => {
    setLoadingConversas(true)
    try {
      const data = await api.get<Conversa[]>('/b2b/chat/conversas')
      setConversas(data)
      setFiltered(data)
      if (initialConversaId) {
        const target = data.find(c => c.id === initialConversaId)
        if (target) { setActiveConversa(target); return target.id }
      }
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar conversas')
    } finally {
      setLoadingConversas(false)
    }
  }, [addToast, initialConversaId])

  const fetchMensagens = useCallback(async (convId: string) => {
    setLoadingMensagens(true)
    try {
      const data = await api.get<Mensagem[]>(`/b2b/chat/conversas/${convId}/mensagens`)
      setMensagens(data)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar mensagens')
    } finally {
      setLoadingMensagens(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchConversas().then(selectedId => { if (selectedId) fetchMensagens(selectedId) })
  }, [fetchConversas])

  useEffect(() => {
    if (!token) return
    const sock = createReconnectingSocket(`/v1/b2b/chat/ws?token=${token}`, {
      onMessage: (event) => {
        try {
          const msg = JSON.parse(event.data) as Mensagem
          if (activeConversa && msg.conversa_id === activeConversa.id) {
            setMensagens(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          }
          setConversas(prev => prev.map(conv =>
            conv.id === msg.conversa_id
              ? { ...conv, ultima_mensagem: msg.conteudo, ultima_mensagem_data: msg.created_at }
              : conv
          ))
        } catch {}
      },
    })
    wsRef.current = sock
    return () => { sock.close(); wsRef.current = null }
  }, [token, activeConversa])

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  const handleSearch = (q: string) => {
    setSearch(q)
    const lower = q.toLowerCase()
    setFiltered(conversas.filter(c => {
      const dest = c.loja_a_id === user?.loja_id ? c.loja_b_nome : c.loja_a_nome
      return dest?.toLowerCase().includes(lower) || (c.ultima_mensagem ?? '').toLowerCase().includes(lower)
    }))
  }

  const handleSelectConversa = (conv: Conversa) => {
    setActiveConversa(conv)
    fetchMensagens(conv.id)
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSend = async () => {
    if (!activeConversa || !newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ conversa_id: activeConversa.id, conteudo: content }))
    } else {
      try {
        const res = await api.post<Mensagem>(`/b2b/chat/conversas/${activeConversa.id}/mensagens`, { conteudo: content })
        setMensagens(prev => [...prev, res])
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao enviar mensagem')
      }
    }
  }

  const destName = (conv: Conversa) =>
    conv.loja_a_id === user?.loja_id ? conv.loja_b_nome : conv.loja_a_nome

  function gcInitials(nome?: string) {
    if (!nome) return '?'
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  }

  return (
    <div className="gc-chat-shell">
      {/* Sidebar */}
      <div className="gc-chat-sidebar">
        <div className="gc-chat-sidebar-head">
          <h2>Parceiros</h2>
          <div className="gc-chat-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Buscar conversa…" value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
        </div>
        <div className="gc-conv-list">
          {loadingConversas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--sv-text-dim)', fontSize: 13 }}>
              {search ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </div>
          ) : filtered.map(conv => (
            <div
              key={conv.id}
              className={`gc-conv-item${activeConversa?.id === conv.id ? ' active' : ''}`}
              onClick={() => handleSelectConversa(conv)}
            >
              <div className="gc-conv-avatar">{gcInitials(destName(conv))}</div>
              <div className="gc-conv-info">
                <div className="gc-conv-name">{destName(conv)}</div>
                <div className="gc-conv-preview">{conv.ultima_mensagem || 'Sem mensagens.'}</div>
              </div>
              <div className="gc-conv-meta">
                <span className="gc-conv-time">{formatDate(conv.ultima_mensagem_data ?? '')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="gc-chat-area">
        {activeConversa ? (
          <>
            <div className="gc-chat-head">
              <div className="gc-chat-head-left">
                <div className="gc-chat-head-avatar">{gcInitials(destName(activeConversa))}</div>
                <div className="gc-chat-head-info">
                  <h4>{destName(activeConversa)}</h4>
                  <span>Parceiro</span>
                </div>
              </div>
            </div>

            <div className="gc-chat-messages">
              {loadingMensagens ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
              ) : mensagens.map((msg, i) => {
                const mine = msg.autor_id === user?.id
                const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(mensagens[i - 1].created_at).toDateString()
                return (
                  <Fragment key={msg.id}>
                    {showDate && (
                      <div className="gc-msg-date">
                        {new Date(msg.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                    )}
                    <div className={`gc-msg-row${mine ? ' me' : ' other'}`}>
                      {!mine && <div className="gc-msg-avatar">{gcInitials(msg.autor_nome)}</div>}
                      <div>
                        <div className="gc-msg-bubble">{msg.conteudo}</div>
                        <div className="gc-msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
              <div ref={messageEndRef} />
            </div>

            <div className="gc-chat-input-bar">
              <div className="gc-chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Mensagem…"
                  value={newMessage}
                  onChange={e => { setNewMessage(e.target.value); autoResize() }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                />
              </div>
              <button className="gc-chat-send" onClick={handleSend} disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="gc-chat-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────
   TAB 5: CHAT CLIENTES (B2C — leads da vitrine com triagem IA)
   ─────────────────────────────────────────────────────────────── */

interface LeadTriagem {
  conversa_id: string
  score: number
  classificacao: 'quente' | 'ruido'
  justificativa?: string
}

function ChatClientesTab({ token, user, addToast }: { token: string | null, user: any, addToast: (t: ToastType, m: string, details?: any) => void }) {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [triagens, setTriagens] = useState<Record<string, LeadTriagem>>({})
  const [filtered, setFiltered] = useState<Conversa[]>([])
  const [search, setSearch] = useState('')
  const [activeConversa, setActiveConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [filtroRuido, setFiltroRuido] = useState(false)
  const [triandoId, setTriandoId] = useState<string | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wsRef = useRef<ReconnectingSocket | null>(null)

  const fetchConversas = useCallback(async () => {
    setLoadingConversas(true)
    try {
      const data = await api.get<Conversa[]>('/vitrine/chat/conversas')
      setConversas(data)
      setFiltered(data)
      const tData = await api.get<LeadTriagem[]>('/gestor/triagem')
      const tMap: Record<string, LeadTriagem> = {}
      tData.forEach(t => { tMap[t.conversa_id] = t })
      setTriagens(tMap)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar conversas de clientes')
    } finally {
      setLoadingConversas(false)
    }
  }, [addToast])

  const fetchMensagens = useCallback(async (convId: string) => {
    setLoadingMensagens(true)
    try {
      const data = await api.get<Mensagem[]>(`/vitrine/chat/conversas/${convId}/mensagens`)
      setMensagens(data)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar mensagens')
    } finally {
      setLoadingMensagens(false)
    }
  }, [addToast])

  useEffect(() => { fetchConversas() }, [fetchConversas])
  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  useEffect(() => {
    if (!token) return
    const sock = createReconnectingSocket(`/v1/vitrine/chat/ws?token=${token}`, {
      onMessage: (event) => {
        try {
          const msg = JSON.parse(event.data) as Mensagem
          if (activeConversa && msg.conversa_id === activeConversa.id)
            setMensagens(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        } catch {}
      },
    })
    wsRef.current = sock
    return () => { sock.close(); wsRef.current = null }
  }, [token, activeConversa])

  const applyFilter = (list: Conversa[], ruido: boolean, q: string) => {
    let r = ruido ? list.filter(c => triagens[c.id]?.classificacao === 'ruido') : list
    if (q) {
      const lower = q.toLowerCase()
      r = r.filter(c =>
        ((c as any).cliente_nome ?? 'Cliente').toLowerCase().includes(lower) ||
        ((c as any).ultima_mensagem ?? '').toLowerCase().includes(lower)
      )
    }
    return r
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setFiltered(applyFilter(conversas, filtroRuido, q))
  }

  const toggleRuido = () => {
    const next = !filtroRuido
    setFiltroRuido(next)
    setFiltered(applyFilter(conversas, next, search))
  }

  const handleSelectConversa = (conv: Conversa) => {
    setActiveConversa(conv)
    fetchMensagens(conv.id)
  }

  const handleTriar = async (convId: string) => {
    setTriandoId(convId)
    try {
      const t = await api.post<LeadTriagem>(`/gestor/triagem/${convId}`, {})
      setTriagens(prev => ({ ...prev, [convId]: t }))
      addToast('success', `Triagem: ${t.classificacao === 'quente' ? '🔥 Lead quente' : '❄️ Ruído'}`)
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao triar lead')
    } finally {
      setTriandoId(null)
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSend = async () => {
    if (!activeConversa || !newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ conversa_id: activeConversa.id, conteudo: content }))
    } else {
      try {
        const res = await api.post<Mensagem>(`/vitrine/chat/conversas/${activeConversa.id}/mensagens`, { conteudo: content })
        setMensagens(prev => [...prev, res])
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao enviar mensagem')
      }
    }
  }

  function gcInitials(nome?: string) {
    if (!nome) return '?'
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  }

  const clienteNome = (conv: Conversa) => (conv as any).cliente_nome || 'Cliente'
  const activeTriagem = activeConversa ? triagens[activeConversa.id] : null

  return (
    <div className="gc-chat-shell">
      {/* Sidebar */}
      <div className="gc-chat-sidebar">
        <div className="gc-chat-sidebar-head">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Clientes</h2>
            <button
              className={`btn${filtroRuido ? ' btn-primary' : ' quick-action-btn'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={toggleRuido}
            >
              {filtroRuido ? 'Todos' : '❄️ Ruídos'}
            </button>
          </div>
          <div className="gc-chat-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Buscar cliente…" value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
        </div>
        <div className="gc-conv-list">
          {loadingConversas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--sv-text-dim)', fontSize: 13 }}>
              {filtroRuido ? 'Nenhum ruído encontrado.' : 'Nenhuma conversa de cliente.'}
            </div>
          ) : filtered.map(conv => {
            const triagem = triagens[conv.id]
            return (
              <div
                key={conv.id}
                className={`gc-conv-item${activeConversa?.id === conv.id ? ' active' : ''}`}
                onClick={() => handleSelectConversa(conv)}
              >
                <div className="gc-conv-avatar">{gcInitials(clienteNome(conv))}</div>
                <div className="gc-conv-info">
                  <div className="gc-conv-name">{clienteNome(conv)}</div>
                  <div className="gc-conv-preview">{(conv as any).ultima_mensagem || 'Sem mensagens.'}</div>
                </div>
                <div className="gc-conv-meta">
                  {triagem && (
                    <span className={triagem.classificacao === 'quente' ? 'gc-conv-lead-hot' : 'gc-conv-lead-cold'}>
                      {triagem.classificacao === 'quente' ? '🔥' : '❄️'} {triagem.score}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="gc-chat-area">
        {activeConversa ? (
          <>
            <div className="gc-chat-head">
              <div className="gc-chat-head-left">
                <div className="gc-chat-head-avatar">{gcInitials(clienteNome(activeConversa))}</div>
                <div className="gc-chat-head-info">
                  <h4>{clienteNome(activeConversa)}</h4>
                  {activeTriagem && (
                    <span style={{ color: activeTriagem.classificacao === 'quente' ? '#ef4444' : 'var(--sv-text-muted)', fontSize: 11 }}>
                      {activeTriagem.classificacao === 'quente' ? '🔥 Lead quente' : '❄️ Possível ruído'}
                      {activeTriagem.justificativa && ` — ${activeTriagem.justificativa}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="gc-chat-head-actions">
                <button
                  className="btn quick-action-btn"
                  style={{ fontSize: 12 }}
                  disabled={triandoId === activeConversa.id}
                  onClick={() => handleTriar(activeConversa.id)}
                >
                  {triandoId === activeConversa.id ? 'Analisando...' : '✨ Triar com IA'}
                </button>
              </div>
            </div>

            <div className="gc-chat-messages">
              {loadingMensagens ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
              ) : mensagens.map((msg, i) => {
                const mine = msg.autor_id === user?.id
                const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(mensagens[i - 1].created_at).toDateString()
                return (
                  <Fragment key={msg.id}>
                    {showDate && (
                      <div className="gc-msg-date">
                        {new Date(msg.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                    )}
                    <div className={`gc-msg-row${mine ? ' me' : ' other'}`}>
                      {!mine && <div className="gc-msg-avatar">{gcInitials(msg.autor_nome)}</div>}
                      <div>
                        <div className="gc-msg-bubble">{msg.conteudo}</div>
                        <div className="gc-msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
              <div ref={messageEndRef} />
            </div>

            <div className="gc-chat-input-bar">
              <div className="gc-chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Responder ao cliente…"
                  value={newMessage}
                  onChange={e => { setNewMessage(e.target.value); autoResize() }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                />
              </div>
              <button className="gc-chat-send" onClick={handleSend} disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="gc-chat-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>Selecione um cliente para ver o histórico</p>
          </div>
        )}
      </div>
    </div>
  )
}
