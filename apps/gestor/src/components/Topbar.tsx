import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import { SeletorLojaSwitcher } from './SeletorLoja'

type Theme = 'dark' | 'light'

interface PageItem {
  label: string
  path: string
  tags: string[]
  category: string
}

const PAGES: PageItem[] = [
  { label: 'Dashboards', path: '/', tags: ['dashboard', 'painel', 'inicio', 'home', 'indicadores', 'graficos'], category: 'Módulo' },
  { label: 'Rede Social', path: '/rede-social', tags: ['rede social', 'parceiros', 'b2b', 'diretorio', 'lojas', 'conversas'], category: 'Módulo' },
  { label: 'CRM', path: '/crm', tags: ['crm', 'clientes', 'leads', 'vendas', 'funil', 'negociacoes', 'atendimentos'], category: 'Módulo' },
  { label: 'Estoque', path: '/estoque', tags: ['estoque', 'veiculos', 'carros', 'cadastrar carro', 'carros cadastrados', 'km', 'preco'], category: 'Módulo' },
  { label: 'Financeiro', path: '/financeiro', tags: ['financeiro', 'caixa', 'lancamentos', 'fluxo de caixa', 'comissoes', 'despesas', 'receitas'], category: 'Módulo' },
  { label: 'Aprovações', path: '/aprovacoes', tags: ['aprovacoes', 'solicitacoes', 'vendas', 'descontos', 'exclusoes', 'autorizacoes'], category: 'Módulo' },
  { label: 'Equipe', path: '/equipe', tags: ['equipe', 'membros', 'vendedores', 'convidar', 'permissoes', 'usuarios'], category: 'Módulo' },
  { label: 'Simulador de Crédito', path: '/ferramentas/simulador', tags: ['simulador', 'financiamento', 'credito', 'simular', 'bancos', 'parcelas', 'entrada'], category: 'Ferramenta' },
  { label: 'Contratos', path: '/ferramentas/contratos', tags: ['contratos', 'documentos', 'gerar contrato', 'pdf', 'modelo', 'compra', 'venda'], category: 'Ferramenta' },
  { label: 'Marketing', path: '/ferramentas/marketing', tags: ['marketing', 'posts', 'artes', 'gerador de posts', 'promover', 'redes', 'imagem'], category: 'Ferramenta' },
  { label: 'Consulta FIPE', path: '/ferramentas/fipe', tags: ['fipe', 'consulta fipe', 'precos', 'valor de mercado', 'tabela', 'carros', 'motos'], category: 'Ferramenta' },
  { label: 'Assistente IA', path: '/assistente', tags: ['ia', 'assistente', 'chatgpt', 'gemini', 'inteligencia artificial', 'copilot', 'conversar'], category: 'Inteligência Artificial' },
  { label: 'Configurações', path: '/configuracoes', tags: ['configuracoes', 'perfil', 'loja', 'senha', 'dados', 'configurar', 'dados da loja'], category: 'Sistema' },
  { label: 'Ajuda (Manual)', path: '/ajuda', tags: ['ajuda', 'suporte', 'faq', 'manual', 'tutoriais', 'duvidas', 'como usar'], category: 'Sistema' },
]

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('sv-theme')
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

export function Topbar() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Notificações
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifPopover, setShowNotifPopover] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!user) return
    try {
      const data = await api.get<any[]>('/notificacoes')
      setNotifications(data)
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [user])

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notificacoes/ler-todas')
      setNotifications([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleReadNotif = async (notif: any) => {
    try {
      await api.post(`/notificacoes/${notif.id}/ler`)
      setNotifications(prev => prev.filter(n => n.id !== notif.id))
      setShowNotifPopover(false)
      if (notif.link) {
        navigate(notif.link)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Estados de busca global
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken })
      }
    } catch (e) {
      console.error('Falha ao deslogar no servidor:', e)
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPopover(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAberto(false)
        setSearchFocused(false)
        setShowNotifPopover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [menuAberto])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sv-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // Iniciais do nome do usuário
  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }

  // Emoji e Rótulo do cargo
  const getRoleDisplay = (papel?: string) => {
    switch (papel) {
      case 'admin_plataforma':
        return { emoji: '🛡️', label: 'Admin' }
      case 'gestor':
        return { emoji: '👑', label: 'Gestor' }
      case 'vendedor':
        return { emoji: '💼', label: 'Vendedor' }
      default:
        return { emoji: '👤', label: 'Cliente' }
    }
  }

  const role = getRoleDisplay(user?.papel)
  const initials = getInitials(user?.nome)

  // Filtro de buscas
  const searchResults = PAGES.filter((p) => {
    if (!searchQuery) return false
    const q = searchQuery.toLowerCase()
    return (
      p.label.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q))
    )
  })

  return (
    <header className="topbar" style={{ position: 'relative', zIndex: 999 }}>
      {/* Search */}
      <div className="topbar-search" ref={searchRef} style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar ferramentas, contratos, simulador ou páginas..."
          id="global-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          autoComplete="off"
        />

        {/* Dropdown de Resultados da Lupa */}
        {searchFocused && searchQuery && (
          <div
            className="glass-card"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              maxHeight: '320px',
              overflowY: 'auto',
              zIndex: 9999,
              padding: '8px 0',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(20px)',
              background: 'var(--sv-surface-solid)',
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--sv-text-muted)', fontSize: '13px', textAlign: 'center' }}>
                Nenhuma ferramenta ou página encontrada.
              </div>
            ) : (
              searchResults.map((p) => (
                <div
                  key={p.path}
                  onClick={() => {
                    setSearchQuery('')
                    setSearchFocused(false)
                    navigate(p.path)
                  }}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ color: 'var(--sv-text)', fontSize: '14px', fontWeight: 500 }}>
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--sv-primary)',
                      background: 'color-mix(in srgb, var(--sv-primary) 12%, transparent)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}
                  >
                    {p.category}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        {/* Seletor de loja — só para admin de plataforma (suporte) */}
        {user?.papel === 'admin_plataforma' && <SeletorLojaSwitcher />}

        {/* Theme toggle */}
        <button
          className="topbar-btn"
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label="Alternar tema"
          id="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            className="topbar-btn"
            title="Notificações"
            id="notifications-btn"
            onClick={() => setShowNotifPopover(!showNotifPopover)}
            style={{ position: 'relative' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="badge" style={{ position: 'absolute', top: 0, right: 0, background: 'var(--sv-error)', color: 'white', borderRadius: '50%', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 'bold', padding: '2px' }}>
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifPopover && (
            <div
              className="glass-card"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 320,
                maxHeight: 400,
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                background: 'var(--sv-surface-solid)',
                padding: '12px 0',
                borderRadius: 8,
                border: '1px solid var(--sv-border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px 16px', borderBottom: '1px solid var(--sv-border)' }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Notificações</h4>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: 'var(--sv-primary)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--sv-text-muted)', fontSize: 13 }}>
                    Nenhuma nova notificação
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleReadNotif(notif)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--sv-border-dim)',
                        transition: 'background 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sv-surface-hover)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: 12, color: 'var(--sv-text)' }}>
                        {notif.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', lineHeight: '1.3' }}>
                        {notif.conteudo}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--sv-text-muted)', marginTop: 2 }}>
                        {new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-divider" />

        {/* User */}
        <div className="topbar-user-wrapper" ref={menuRef}>
          <div
            className="topbar-user"
            id="user-menu"
            title={user?.email}
            onClick={() => setMenuAberto((v) => !v)}
            role="button"
            tabIndex={0}
            aria-haspopup="true"
            aria-expanded={menuAberto}
            onKeyDown={(e) => e.key === 'Enter' && setMenuAberto((v) => !v)}
          >
            <div className="topbar-user-role">
              <span>{role.emoji}</span>
              <span>{role.label}</span>
            </div>
            <div className="topbar-user-avatar">{initials}</div>
            <svg className="topbar-user-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {menuAberto && (
            <div className="topbar-user-dropdown" role="menu">
              <div className="topbar-user-dropdown-header">
                <span className="topbar-user-dropdown-name">{user?.nome ?? 'Usuário'}</span>
                <span className="topbar-user-dropdown-email">{user?.email}</span>
              </div>
              <div className="topbar-user-dropdown-divider" />
              <button
                className="topbar-user-dropdown-item"
                role="menuitem"
                onClick={() => { setMenuAberto(false); navigate('/configuracoes') }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 a2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                Configurações
              </button>
              <div className="topbar-user-dropdown-divider" />
              <button
                className="topbar-user-dropdown-item topbar-user-dropdown-item--danger"
                role="menuitem"
                onClick={() => { setMenuAberto(false); handleLogout() }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
