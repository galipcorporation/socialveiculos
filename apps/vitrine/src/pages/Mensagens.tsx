import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { createReconnectingSocket, type ReconnectingSocket } from '../lib/ws'
import { useAuthStore } from '../stores/authStore'
import { LoginModal } from '../components/LoginModal'
import { BottomNav } from '../components/BottomNav'

interface Conversa {
  id: string
  tipo: string
  loja_id: string
  loja_nome: string
  veiculo_id?: string
  veiculo_modelo?: string
  veiculo_marca?: string
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

function formatTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function initials(nome: string) {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export function Mensagens() {
  const { isAuthenticated, token, openLoginModal } = useAuthStore()
  const userId = useAuthStore.getState().user?.id
  const location = useLocation()
  const initialConversaId = (location.state as { conversaId?: string } | null)?.conversaId

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [filtered, setFiltered] = useState<Conversa[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)

  const socketRef = useRef<ReconnectingSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const fetchConversas = async () => {
    if (!isAuthenticated) { setLoadingConversas(false); return }
    setLoadingConversas(true)
    try {
      const data = await api.get<Conversa[]>('/vitrine/conversas')
      setConversas(data)
      setFiltered(data)
      if (initialConversaId) {
        const target = data.find(c => c.id === initialConversaId)
        if (target) selectConversa(target)
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err)
    } finally {
      setLoadingConversas(false)
    }
  }

  const fetchMensagens = async (conversaId: string) => {
    setLoadingMsgs(true)
    try {
      const data = await api.get<Mensagem[]>(`/vitrine/conversas/${conversaId}/mensagens`)
      setMensagens(data)
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err)
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => { fetchConversas() }, [isAuthenticated])

  // WebSocket
  useEffect(() => {
    if (!isAuthenticated || !token || !selected) {
      socketRef.current?.close(); socketRef.current = null; return
    }
    const sock = createReconnectingSocket(`/v1/vitrine/chat/ws?token=${token}`, {
      onMessage: (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.conversa_id === selected.id) {
            setMensagens(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          }
          fetchConversas()
        } catch { /* ignora */ }
      },
    })
    socketRef.current = sock
    return () => { sock.close(); socketRef.current = null }
  }, [isAuthenticated, token, selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const selectConversa = (c: Conversa) => {
    setSelected(c)
    fetchMensagens(c.id)
    setSidebarHidden(true)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    const lower = q.toLowerCase()
    setFiltered(conversas.filter(c =>
      c.loja_nome.toLowerCase().includes(lower) ||
      (c.ultima_mensagem ?? '').toLowerCase().includes(lower) ||
      (c.veiculo_modelo ?? '').toLowerCase().includes(lower)
    ))
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const content = newMsg.trim()
    if (!content || !selected) return
    setNewMsg('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ conversa_id: selected.id, conteudo: content }))
    } else {
      try {
        await api.post(`/vitrine/conversas/${selected.id}/mensagens`, {
          veiculo_id: selected.veiculo_id || '',
          loja_id: selected.loja_id,
          mensagem: content,
        })
        fetchMensagens(selected.id)
      } catch (err) {
        console.error('Erro ao enviar mensagem:', err)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 56, height: 56, color: 'var(--vt-text-muted)', opacity: .4 }}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Faça login para ver suas mensagens</h2>
        <p style={{ color: 'var(--vt-text-dim)', fontSize: 14 }}>Converse direto com as lojas sobre os veículos de seu interesse.</p>
        <button className="vt-btn vt-btn-primary" onClick={() => openLoginModal('login')}>Entrar / Cadastrar</button>
        <LoginModal />
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="vt-chat-shell">
      {/* Sidebar */}
      <div className={`vt-chat-sidebar${sidebarHidden ? ' hidden' : ''}`}>
        <div className="vt-chat-sidebar-head">
          <h2>Mensagens</h2>
          <div className="vt-chat-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar conversa…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="vt-conv-list">
          {loadingConversas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--vt-text-dim)', fontSize: 14 }}>
              {search ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </div>
          ) : filtered.map(c => (
            <div
              key={c.id}
              className={`vt-conv-item${selected?.id === c.id ? ' active' : ''}`}
              onClick={() => selectConversa(c)}
            >
              <div className="vt-conv-avatar">{initials(c.loja_nome)}</div>
              <div className="vt-conv-info">
                <div className="vt-conv-name">{c.loja_nome}</div>
                {c.veiculo_modelo && (
                  <div className="vt-conv-sub">{c.veiculo_marca} {c.veiculo_modelo}</div>
                )}
                <div className="vt-conv-preview">{c.ultima_mensagem || 'Nenhuma mensagem.'}</div>
              </div>
              <div className="vt-conv-meta">
                <span className="vt-conv-time">{formatTime(c.ultima_mensagem_data)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área de chat */}
      <div className="vt-chat-area">
        {selected ? (
          <>
            {/* Header */}
            <div className="vt-chat-head">
              <div className="vt-chat-head-left">
                <button className="vt-chat-back" onClick={() => setSidebarHidden(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="vt-chat-head-avatar">{initials(selected.loja_nome)}</div>
                <div className="vt-chat-head-info">
                  <h4>{selected.loja_nome}</h4>
                  <span>Loja parceira</span>
                </div>
              </div>
            </div>

            {/* Contexto do veículo */}
            {selected.veiculo_modelo && (
              <div className="vt-chat-vehicle">
                <div className="vt-chat-vehicle-thumb">
                  <div style={{ width: '100%', height: '100%', background: 'var(--vt-surface-hover)' }} />
                </div>
                <div className="vt-chat-vehicle-info">
                  <strong>{selected.veiculo_marca} {selected.veiculo_modelo}</strong>
                  <span>Ver anúncio</span>
                </div>
              </div>
            )}

            {/* Mensagens */}
            <div className="vt-chat-messages">
              {loadingMsgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div className="spinner" />
                </div>
              ) : mensagens.map((m, i) => {
                const isMe = m.autor_id === userId
                const prevIsMe = i > 0 && mensagens[i - 1].autor_id === userId
                const showDate = i === 0 || new Date(m.created_at).toDateString() !== new Date(mensagens[i - 1].created_at).toDateString()
                return (
                  <React.Fragment key={m.id}>
                    {showDate && (
                      <div className="vt-msg-date">
                        {new Date(m.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                    )}
                    <div className={`vt-msg-row${isMe ? ' me' : ' other'}`} style={{ marginTop: (!isMe && prevIsMe) || (isMe && !prevIsMe) ? 8 : 0 }}>
                      {!isMe && <div className="vt-msg-avatar">{initials(m.autor_nome)}</div>}
                      <div>
                        <div className="vt-msg-bubble">{m.conteudo}</div>
                        <div className="vt-msg-time">
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="vt-chat-input-bar">
              <div className="vt-chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Mensagem…"
                  value={newMsg}
                  onChange={e => { setNewMsg(e.target.value); autoResize() }}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <button className="vt-chat-send" onClick={() => handleSend()} disabled={!newMsg.trim()}>
                <SendIcon />
              </button>
            </div>
          </>
        ) : (
          <div className="vt-chat-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>

      <LoginModal />
      <BottomNav />
    </div>
  )
}

export default Mensagens
