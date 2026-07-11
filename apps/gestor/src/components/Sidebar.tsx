import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { parseModulos, podeAcessarModulo, PATH_TO_MODULO } from '../lib/modulos'
import { api } from '../lib/api'
import { useChatStore } from '../stores/chatStore'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const FerramentasIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
)

/* Módulos premium = filhos de Ferramentas (páginas dedicadas). */
const FERRAMENTAS_CHILDREN = [
  { path: '/ferramentas/simulador', label: 'Simulador' },
  { path: '/ferramentas/contratos', label: 'Contratos' },
  { path: '/ferramentas/marketing', label: 'Marketing' },
  { path: '/ferramentas/fipe', label: 'Consulta FIPE' },
  { path: '/assistente', label: 'Assistente IA' },
  { path: '/ferramentas/notas-fiscais', label: 'Notas Fiscais' },
  { path: '/ferramentas/meu-site', label: 'Meu Site' },
]

const ADMIN_NAV_ITEMS = [
  {
    path: `/${import.meta.env.VITE_ADMIN_PATH || 'painel-sv'}`,
    label: 'Administração',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
]

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: '/rede-social',
    label: 'Rede Social',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    path: '/crm',
    label: 'Clientes (CRM)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    path: '/estoque',
    label: 'Estoque',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    path: '/pos-venda',
    label: 'Pós-venda',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    path: '/minhas-comissoes',
    label: 'Minhas Comissões',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" />
        <line x1="12" y1="6" x2="12" y2="8" />
        <line x1="12" y1="16" x2="12" y2="18" />
      </svg>
    ),
  },
  {
    path: '/aprovacoes',
    label: 'Aprovações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    path: '/equipe',
    label: 'Equipe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [lojaNome, setLojaNome] = useState<string>('')
  const { unreadB2B, unreadB2C, fetchUnreadCounts } = useChatStore()
  const totalUnread = unreadB2B + unreadB2C

  useEffect(() => {
    const fetchLoja = async () => {
      try {
        const res = await api.get<{ loja?: { nome: string } }>('/me/loja')
        if (res.loja?.nome) {
          setLojaNome(res.loja.nome)
        }
      } catch (err) {
        console.error(err)
      }
    }
    if (user?.loja_id) {
      fetchLoja()
    }
  }, [user])

  const isAdmin = user?.papel === 'admin_plataforma'

  useEffect(() => {
    if (user && !isAdmin) {
      fetchUnreadCounts()
      const interval = setInterval(fetchUnreadCounts, 20000)
      return () => clearInterval(interval)
    }
  }, [user, isAdmin])

  const modulos = parseModulos(user?.modulos)
  const podeVer = (path: string) => {
    if (path === '/' || path === '/dashboard') return true
    const mod = PATH_TO_MODULO[path]
    if (!mod) return true // rota não controlada por módulo (ex.: Dashboards, Rede Social)
    return podeAcessarModulo(user?.papel, modulos, mod)
  }

  const visibleFerramentasChildren = FERRAMENTAS_CHILDREN.filter((c) => podeVer(c.path))
  const ferramentasAtiva = location.pathname === '/ferramentas' || visibleFerramentasChildren.some((c) => location.pathname === c.path)
  const [ferramentasAberto, setFerramentasAberto] = useState(ferramentasAtiva)

  const visibleNavItems = isAdmin
    ? ADMIN_NAV_ITEMS
    : NAV_ITEMS.filter((item) => {
        if (item.path === '/' || item.path === '/dashboard') return true
        // Aprovações e Equipe são exclusivos de gestor.
        if (item.path === '/aprovacoes' || item.path === '/equipe') {
          return user?.papel === 'gestor'
        }
        // Minhas Comissões é exclusivo de vendedor (gestor acompanha pelo Financeiro).
        if (item.path === '/minhas-comissoes') {
          return user?.papel === 'vendedor'
        }
        return podeVer(item.path)
      })

  // Navigate and close drawer on mobile
  const handleNav = (path: string) => {
    navigate(path)
    onClose?.()
  }

  const handleFerramentasClick = () => {
    if (window.innerWidth <= 1024) {
      handleNav('/ferramentas')
    } else {
      setFerramentasAberto((v) => !v)
    }
  }

  return (
    <nav className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Close button (mobile drawer) */}
      <button className="sidebar-close-btn" onClick={onClose} aria-label="Fechar menu">
        ✕
      </button>

      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">SV</div>
        <div className="sidebar-brand-text">
          <h1>SocialVeículos</h1>
          <span>{isAdmin ? 'Administração' : (lojaNome || 'Elite Automotive')}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {visibleNavItems.map((item) => (
          <div
            key={item.path}
            className={`sidebar-nav-item ${(location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard')) ? 'active' : ''}`}
            onClick={() => handleNav(item.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleNav(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.path === '/rede-social' && totalUnread > 0 && (
              <span className="sidebar-nav-badge">{totalUnread}</span>
            )}
          </div>
        ))}

        {/* Ferramentas — grupo expansível com módulos premium (oculto para admin) */}
        {!isAdmin && visibleFerramentasChildren.length > 0 && (
        <>
        <div
          className={`sidebar-nav-item ${ferramentasAtiva ? 'active' : ''}`}
          onClick={handleFerramentasClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleFerramentasClick()}
          aria-expanded={ferramentasAberto}
        >
          {FerramentasIcon}
          <span>Ferramentas</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="sidebar-chevron"
            style={{ marginLeft: 'auto', transform: ferramentasAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {ferramentasAberto && (
          <div className="sidebar-submenu">
            {visibleFerramentasChildren.map((child) => (
              <div
                key={child.path}
                className={`sidebar-nav-item sidebar-subitem ${location.pathname === child.path ? 'active' : ''}`}
                onClick={() => handleNav(child.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleNav(child.path)}
              >
                <span>{child.label}</span>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Footer — Ajuda (separado visualmente do menu principal) */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-divider" />
        <div
          className={`sidebar-nav-item ${location.pathname === '/ajuda' ? 'active' : ''}`}
          onClick={() => handleNav('/ajuda')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleNav('/ajuda')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Ajuda</span>
        </div>
      </div>

    </nav>
  )
}
