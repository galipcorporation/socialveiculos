import { useState, useCallback, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'
import { useTrackPageVisit } from '../lib/recentPages'
import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'
import { SeletorLojaGate } from './SeletorLoja'

function ImpersonarBanner() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const loja = sessionStorage.getItem('sv_impersonar_loja')
  if (!loja) return null

  const voltarAoAdmin = () => {
    sessionStorage.removeItem('sv_impersonar_loja')
    navigate('/admin', { replace: true })
  }

  const encerrar = () => {
    sessionStorage.removeItem('sv_impersonar_loja')
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
      color: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '7px 20px',
      fontSize: '0.85rem',
      fontWeight: 600,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🛡️</span>
        <span>Acessando como Gestor de: <strong>{loja}</strong> (Modo Suporte / Observação)</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={voltarAoAdmin}
          style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
        >
          🔙 Voltar ao Painel Admin
        </button>
        <button
          onClick={encerrar}
          style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.25)', color: '#000', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  useTrackPageVisit()

  const impersonando = typeof window !== 'undefined' && !!sessionStorage.getItem('sv_impersonar_loja')
  const location = useLocation()

  // Admin de plataforma (suporte) precisa escolher uma loja antes de operar o gestor.
  // Sem loja escolhida o backend responde 409 em toda rota B2B; aqui abrimos o seletor.
  const papel = useAuthStore((s) => s.user?.papel)
  const lojaId = useLojaAtivaStore((s) => s.lojaId)

  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), [])
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  // Close drawer on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Close drawer on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [mobileMenuOpen])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  if (papel === 'admin_plataforma' && !lojaId && !impersonando) {
    return <SeletorLojaGate />
  }

  return (
    <div className="app-layout" style={impersonando ? { paddingTop: 34 } : undefined}>
      {/* Aurora glow background effect */}
      <div className="aurora-glow" />

      <ImpersonarBanner />

      {/* Mobile overlay */}
      <div
        className={`mobile-sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`}
        onClick={closeMobileMenu}
      />

      <Sidebar isOpen={mobileMenuOpen} onClose={closeMobileMenu} />
      <CommandPalette />

      <div className="main-area">
        <Topbar onMenuToggle={openMobileMenu} />
        <Outlet />
      </div>
    </div>
  )
}

