import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'

/* ── Interfaces ──────────────────────────────────────────────── */

interface Conversa {
  id: string
  contato_nome: string
  contato_numero: string
  conversa_whatsapp_id: string
  autonomia: 'copiloto' | 'automatico'
  created_at: string
  updated_at: string
  ultima_mensagem?: string | null
  ultima_mensagem_data?: string | null
}

interface Mensagem {
  id: string
  autor_tipo: 'lead' | 'vendedor' | 'ia'
  conteudo: string
  midia_url?: string | null
  midia_tipo?: string | null
  sugestao_ia?: string | null
  enviada_ia: boolean
  created_at: string
}

interface AssistenteConfig {
  tom: 'formal' | 'amigavel' | 'direto' | 'consultivo' | 'descontraido'
  audio_url?: string | null
  estilo_resumo?: string | null
  consentimento_voz: boolean
  consentimento_timestamp?: string | null
}

export function AssistenteIA() {
  const [loading, setLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState<number | null>(null) // 402 = paywall, 403 = sem permissao
  
  // Estado de conexão do WhatsApp
  const [conexaoStatus, setConexaoStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  
  // Estado do Chat
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [textoMensagem, setTextoMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  
  // Modais
  const [mostrarConfigModal, setMostrarConfigModal] = useState(false)
  
  const showToast = useUIStore((state) => state.showToast)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Polling de conexão e mensagens
  const pollingRef = useRef<any>(null)
  const chatPollingRef = useRef<any>(null)

  // 1. Verificar status de conexão geral e carregar conversas
  const carregarStatusEConversas = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      // Checar sessao
      const sessaoRes = await api.get<{ status: 'connected' | 'disconnected' | 'connecting'; qr: string | null }>('/assistente/sessao')
      setConexaoStatus(sessaoRes.status)
      if (sessaoRes.qr) setQrCodeUrl(sessaoRes.qr)

      // Se conectado, carregar conversas
      if (sessaoRes.status === 'connected') {
        const conversasRes = await api.get<Conversa[]>('/assistente/conversas')
        setConversas(conversasRes)
      }
    } catch (err: any) {
      console.error(err)
      if (err.status === 402 || err.status === 403) {
        setErrorStatus(err.status)
      } else {
        showToast('Erro ao carregar dados do Assistente de IA.', 'error')
      }
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    carregarStatusEConversas()
    
    // Polling de status a cada 4 segundos
    pollingRef.current = setInterval(() => {
      carregarStatusEConversas(true)
    }, 4000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (chatPollingRef.current) clearInterval(chatPollingRef.current)
    }
  }, [carregarStatusEConversas])

  // 2. Conectar WhatsApp
  const handleConectar = async () => {
    setConexaoStatus('connecting')
    try {
      const res = await api.post<{ status: string; qr: string | null }>('/assistente/sessao/conectar')
      if (res.qr) {
        setQrCodeUrl(res.qr)
        showToast('QR Code gerado! Escaneie com seu celular no WhatsApp Web.', 'info')
      }
    } catch (err) {
      console.error(err)
      showToast('Erro ao solicitar conexao com o WhatsApp.', 'error')
      setConexaoStatus('disconnected')
    }
  }

  // 3. Desconectar WhatsApp
  const handleDesconectar = async () => {
    const ok = await useUIStore.getState().confirm({
      title: 'Desconectar WhatsApp',
      message: 'Deseja realmente desconectar seu WhatsApp do assistente?',
      confirmText: 'Desconectar',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.post('/assistente/sessao/desconectar')
      setConexaoStatus('disconnected')
      setQrCodeUrl(null)
      setConversas([])
      setConversaAtiva(null)
      setMensagens([])
      showToast('WhatsApp desconectado com sucesso.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Erro ao desconectar WhatsApp.', 'error')
    }
  }

  // 4. Carregar mensagens da conversa ativa
  const carregarMensagens = useCallback(async (convId: string, silencioso = false) => {
    try {
      const res = await api.get<Mensagem[]>(`/assistente/conversas/${convId}/mensagens`)
      setMensagens(res)
    } catch (err) {
      console.error(err)
      if (!silencioso) showToast('Erro ao carregar mensagens.', 'error')
    }
  }, [showToast])

  // Scroll para o fim do chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Efeito ao selecionar conversa ativa
  useEffect(() => {
    if (chatPollingRef.current) clearInterval(chatPollingRef.current)
    
    if (conversaAtiva) {
      carregarMensagens(conversaAtiva.id)
      
      // Polling de novas mensagens na conversa ativa a cada 2.5 segundos
      chatPollingRef.current = setInterval(() => {
        carregarMensagens(conversaAtiva.id, true)
      }, 2500)
    } else {
      setMensagens([])
    }

    return () => {
      if (chatPollingRef.current) clearInterval(chatPollingRef.current)
    }
  }, [conversaAtiva, carregarMensagens])

  // 5. Enviar Mensagem
  const handleEnviar = async (e?: React.FormEvent, textoCustomizado?: string) => {
    if (e) e.preventDefault()
    const msg = textoCustomizado || textoMensagem
    if (!msg.trim() || !conversaAtiva || enviando) return

    setEnviando(true)
    try {
      const novaMsg = await api.post<Mensagem>(`/assistente/conversas/${conversaAtiva.id}/mensagens`, {
        conteudo: msg.trim()
      })
      setMensagens((prev) => [...prev, novaMsg])
      setTextoMensagem('')
      
      // Atualizar lista de conversas
      setConversas((prev) => 
        prev.map((c) => c.id === conversaAtiva.id ? { ...c, ultima_mensagem: msg.trim(), ultima_mensagem_data: new Date().toISOString() } : c)
      )
    } catch (err) {
      console.error(err)
      showToast('Erro ao enviar mensagem. Confirme a conexao do WhatsApp.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  // 6. Atualizar autonomia de uma conversa específica
  const handleToggleAutonomia = async (c: Conversa) => {
    const novoStatus = c.autonomia === 'copiloto' ? 'automatico' : 'copiloto'
    try {
      const res = await api.put<Conversa>(`/assistente/conversas/${c.id}/autonomia`, {
        autonomia: novoStatus
      })
      setConversas((prev) => prev.map((item) => item.id === c.id ? { ...item, autonomia: res.autonomia } : item))
      setConversaAtiva((prev) => prev && prev.id === c.id ? { ...prev, autonomia: res.autonomia } : prev)
      showToast(`Autonomia alterada para: ${novoStatus === 'automatico' ? 'Automático (IA responde)' : 'Copiloto (IA sugere)'}`, 'success')
    } catch (err) {
      console.error(err)
      showToast('Erro ao alterar autonomia da conversa.', 'error')
    }
  }

  // Renderizar Paywall (402)
  if (errorStatus === 402) {
    return (
      <div className="page-content empty-state glass-card" style={{ maxWidth: 600, margin: '64px auto', padding: '40px', textAlign: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-primary)" strokeWidth="1.5" style={{ width: 64, height: 64, marginBottom: 16 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Módulo Premium Bloqueado</h2>
        <p style={{ color: 'var(--sv-text-dim)', marginBottom: 24, fontSize: 14 }}>
          O módulo <strong>Assistente de IA do Vendedor</strong> não está contratado na assinatura atual da sua loja. Regularize seu plano de assinatura para destravar esta funcionalidade.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/ferramentas'}>
          Ir para Ferramentas & Planos
        </button>
      </div>
    )
  }

  // Renderizar Sem Permissão (403)
  if (errorStatus === 403) {
    return (
      <div className="page-content empty-state glass-card" style={{ maxWidth: 600, margin: '64px auto', padding: '40px', textAlign: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-error)" strokeWidth="1.5" style={{ width: 64, height: 64, marginBottom: 16 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Acesso Negado</h2>
        <p style={{ color: 'var(--sv-text-dim)', marginBottom: 24, fontSize: 14 }}>
          Você não possui permissão para acessar o Assistente de IA do WhatsApp. Solicite liberação para o gestor da sua loja.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-content empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: 16, color: 'var(--sv-text-dim)' }}>Carregando Assistente de IA...</p>
      </div>
    )
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', padding: 0 }}>
      {/* Top Header */}
      <div className="page-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--sv-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sv-surface)', marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Assistente de IA (WhatsApp)</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--sv-text-dim)' }}>Atenda leads do seu WhatsApp pessoal com o auxílio da Inteligência Artificial.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setMostrarConfigModal(true)}>
            Configurações da IA
          </button>
          {conexaoStatus === 'connected' && (
            <button className="btn btn-danger btn-sm" onClick={handleDesconectar}>
              Desconectar WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Main Connection / Chat Container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {conexaoStatus !== 'connected' ? (
          // Interface de Conexão (QR Code)
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div className="glass-card" style={{ maxWidth: 450, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--sv-success)" strokeWidth="1.5" style={{ width: 64, height: 64 }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <h3>Conecte seu WhatsApp</h3>
              <p style={{ color: 'var(--sv-text-dim)', fontSize: 13, lineHeight: 1.5 }}>
                Para habilitar o assistente, você deve ler o QR Code com o aplicativo do WhatsApp no seu celular (Menu &gt; Aparelhos conectados &gt; Conectar um aparelho).
              </p>

              {conexaoStatus === 'disconnected' && (
                <button className="btn btn-primary" onClick={handleConectar} style={{ width: '100%' }}>
                  Gerar QR Code de Conexão
                </button>
              )}

              {conexaoStatus === 'connecting' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  {qrCodeUrl ? (
                    <div style={{ background: 'white', padding: 12, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                      <img src={qrCodeUrl} alt="WhatsApp QR Code" style={{ width: 220, height: 220, display: 'block' }} />
                    </div>
                  ) : (
                    <div className="spinner"></div>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--sv-text-muted)', margin: 0 }}>
                    Aguardando leitura do QR Code...
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Interface do Chat de WhatsApp Conectado
          <>
            {/* Lista de Conversas (Esquerda) */}
            <div style={{ width: 320, borderRight: '1px solid var(--sv-border)', display: 'flex', flexDirection: 'column', background: 'var(--sv-surface-dim)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sv-border)' }}>
                <strong style={{ fontSize: 14, color: 'var(--sv-text)' }}>Suas Conversas</strong>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {conversas.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--sv-text-muted)', fontSize: 13 }}>
                    Nenhuma conversa ativa no WhatsApp.
                  </div>
                ) : (
                  conversas.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setConversaAtiva(c)}
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--sv-border)',
                        cursor: 'pointer',
                        background: conversaAtiva?.id === c.id ? 'var(--sv-surface-hover)' : 'transparent',
                        transition: 'background 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: conversaAtiva?.id === c.id ? 'var(--sv-primary)' : 'var(--sv-text)' }}>
                          {c.contato_nome}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--sv-success)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {c.autonomia === 'automatico' ? 'Auto' : 'Copiloto'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>+{c.contato_numero}</span>
                      {c.ultima_mensagem && (
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--sv-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.ultima_mensagem}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Painel do Chat (Direita) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--sv-bg)' }}>
              {conversaAtiva ? (
                <>
                  {/* Cabeçalho da Conversa Ativa */}
                  <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--sv-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sv-surface)' }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>{conversaAtiva.contato_nome}</strong>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--sv-text-muted)' }}>+{conversaAtiva.contato_numero}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Autonomia da Conversa:</span>
                      <button
                        onClick={() => handleToggleAutonomia(conversaAtiva)}
                        className={`btn ${conversaAtiva.autonomia === 'automatico' ? 'btn-primary' : 'quick-action-btn'}`}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        {conversaAtiva.autonomia === 'automatico' ? 'Robô Responde Direct' : 'Copiloto (Sugerir)'}
                      </button>
                    </div>
                  </div>

                  {/* Histórico de Mensagens */}
                  <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {mensagens.map((m) => {
                      const isMe = m.autor_tipo === 'vendedor' || m.autor_tipo === 'ia';
                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '65%',
                            background: isMe ? 'color-mix(in srgb, var(--sv-primary) 15%, var(--sv-surface))' : 'var(--sv-surface)',
                            border: '1px solid var(--sv-border)',
                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                            padding: '12px 16px',
                            position: 'relative'
                          }}
                        >
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--sv-text)', whiteSpace: 'pre-wrap' }}>
                            {m.conteudo}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 9, color: 'var(--sv-text-muted)' }}>
                              {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {m.autor_tipo === 'ia' && (
                              <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: 4, color: 'var(--sv-success)', fontWeight: 600 }}>
                                IA AUTO
                              </span>
                            )}
                            {m.enviada_ia && (
                              <span style={{ fontSize: 9, color: 'var(--sv-success)' }}>✓ Enviada</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Painel Copiloto: Exibe sugestão da IA */}
                  {conversaAtiva.autonomia === 'copiloto' && mensagens.length > 0 && mensagens[mensagens.length - 1].autor_tipo === 'lead' && mensagens[mensagens.length - 1].sugestao_ia && (
                    <div style={{ margin: '0 24px 12px 24px', background: 'rgba(124, 77, 255, 0.08)', border: '1px solid rgba(124, 77, 255, 0.3)', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          ✨ Sugestão de Resposta da IA
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setTextoMensagem(mensagens[mensagens.length - 1].sugestao_ia || '')}
                          >
                            Copiar p/ Editar
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={() => handleEnviar(undefined, mensagens[mensagens.length - 1].sugestao_ia || '')}
                            disabled={enviando}
                          >
                            Enviar direto
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--sv-text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{mensagens[mensagens.length - 1].sugestao_ia}"
                      </p>
                    </div>
                  )}

                  {/* Barra de Digitação */}
                  <form onSubmit={handleEnviar} style={{ padding: '16px 24px', borderTop: '1px solid var(--sv-border)', display: 'flex', gap: 10, background: 'var(--sv-surface)' }}>
                    <input
                      type="text"
                      value={textoMensagem}
                      onChange={(e) => setTextoMensagem(e.target.value)}
                      placeholder="Digite sua resposta..."
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: 'var(--sv-surface-dim)',
                        border: '1px solid var(--sv-border)',
                        borderRadius: 8,
                        color: 'var(--sv-text)',
                        outline: 'none'
                      }}
                    />
                    <button className="btn btn-primary" type="submit" disabled={!textoMensagem.trim() || enviando}>
                      {enviando ? 'Enviando...' : 'Enviar'}
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--sv-text-muted)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48, marginBottom: 12 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Selecione uma conversa para começar a atender.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de Configurações da IA */}
      {mostrarConfigModal && (
        <ConfigAssistenteModal onClose={() => setMostrarConfigModal(false)} showToast={showToast} />
      )}
    </div>
  )
}

/* ── Componente: ConfigAssistenteModal ─────────────────────────── */

function ConfigAssistenteModal({ onClose, showToast }: { onClose: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void }) {
  const [config, setConfig] = useState<AssistenteConfig>({ tom: 'amigavel', consentimento_voz: false })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  
  // Controle de Áudio
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [enviandoAudio, setEnviandoAudio] = useState(false)

  useEffect(() => {
    const carregarConfig = async () => {
      setLoading(true)
      try {
        const res = await api.get<AssistenteConfig>('/assistente/config')
        setConfig(res)
      } catch (err) {
        console.error(err)
        showToast('Erro ao carregar configuracoes do assistente.', 'error')
      } finally {
        setLoading(false)
      }
    }
    carregarConfig()
  }, [showToast])

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const res = await api.put<AssistenteConfig>('/assistente/config', {
        tom: config.tom,
        consentimento_voz: config.consentimento_voz
      })
      setConfig(res)
      showToast('Configurações salvas com sucesso!', 'success')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Erro ao salvar configurações.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const handleUploadAudio = async () => {
    if (!audioFile) return
    setEnviandoAudio(true)
    showToast('Processando áudio com Whisper (transcrição) e ElevenLabs (clonagem)...', 'info')
    
    const formData = new FormData()
    formData.append('file', audioFile)
    
    try {
      const res = await api.post<any>('/assistente/config/audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setConfig((prev) => ({
        ...prev,
        audio_url: res.audio_url,
        estilo_resumo: res.estilo_resumo
      }))
      showToast('Treino de voz e escrita concluídos com sucesso!', 'success')
      setAudioFile(null)
    } catch (err) {
      console.error(err)
      showToast('Erro ao treinar IA com o áudio.', 'error')
    } finally {
      setEnviandoAudio(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 500, width: 'min(500px, 92vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configurações do Assistente de IA</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {/* Tom da IA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Tom de Atendimento (Claude Prompt)</label>
                <select
                  value={config.tom}
                  onChange={(e) => setConfig({ ...config, tom: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="amigavel">Amigável (Acolhedor e simpático)</option>
                  <option value="formal">Formal (Respeitoso e profissional)</option>
                  <option value="direto">Direto (Objetivo e focado em fechar negócio)</option>
                  <option value="consultivo">Consultivo (Didático, tira dúvidas tecnicamente)</option>
                  <option value="descontraido">Descontraído (Usa gírias leves e descontraído)</option>
                </select>
              </div>

              {/* Consentimento LGPD */}
              <div style={{ background: 'var(--sv-surface-hover)', padding: '14px', borderRadius: 8, border: '1px solid var(--sv-border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={config.consentimento_voz}
                    onChange={(e) => setConfig({ ...config, consentimento_voz: e.target.checked })}
                    style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--sv-text)' }}>Consentimento de Clonagem de Voz (LGPD)</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--sv-text-dim)', lineHeight: 1.4 }}>
                      Autorizo a plataforma a transcrever meus áudios para copiar meu estilo de escrita e clonar minha voz para enviar áudios automatizados para leads.
                    </p>
                    {config.consentimento_timestamp && (
                      <span style={{ fontSize: 9, color: 'var(--sv-success)', display: 'block', marginTop: 4 }}>
                        Autorizado em: {new Date(config.consentimento_timestamp).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload de áudio para treino */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--sv-surface-hover)', padding: 14, borderRadius: 8, border: '1px solid var(--sv-border)' }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Treinar IA com seu Áudio (Gravar amostra de 30-60s)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 12, flex: 1, minWidth: 0 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleUploadAudio}
                    disabled={!audioFile || enviandoAudio}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {enviandoAudio ? 'Processando...' : 'Treinar IA'}
                  </button>
                </div>
                {config.estilo_resumo && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--sv-border)', paddingTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sv-primary)' }}>Estilo Analisado:</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--sv-text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {config.estilo_resumo}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '6px',
  background: 'var(--sv-input-bg)',
  border: '1px solid var(--sv-border)',
  color: 'var(--sv-text)',
  outline: 'none',
}
