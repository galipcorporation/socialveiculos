import { Outlet, useNavigate } from 'react-router-dom'
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

  const encerrar = () => {
    sessionStorage.removeItem('sv_impersonar_token')
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
      zIndex: 9999,
      background: 'var(--sv-warning, #f59e0b)',
      color: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '6px 16px',
      fontSize: '0.8rem',
      fontWeight: 600,
    }}>
      <span>⚠ Observando como <strong>{loja}</strong> — sessão temporária (15 min)</span>
      <button
        onClick={encerrar}
        style={{ background: 'var(--sv-surface-hover)', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontWeight: 700 }}
      >
        Encerrar
      </button>
    </div>
  )
}

export function AppLayout() {
  useTrackPageVisit()

  const impersonando = typeof window !== 'undefined' && !!sessionStorage.getItem('sv_impersonar_loja')

  // Admin de plataforma (suporte) precisa escolher uma loja antes de operar o gestor.
  // Sem loja escolhida o backend responde 409 em toda rota B2B; aqui abrimos o seletor.
  const papel = useAuthStore((s) => s.user?.papel)
  const lojaId = useLojaAtivaStore((s) => s.lojaId)
  if (papel === 'admin_plataforma' && !lojaId && !impersonando) {
    return <SeletorLojaGate />
  }

  return (
    <div className="app-layout" style={impersonando ? { paddingTop: 34 } : undefined}>
      {/* Aurora glow background effect */}
      <div className="aurora-glow" />

      <ImpersonarBanner />
      <Sidebar />
      <CommandPalette />

      <div className="main-area">
        <Topbar />
        <Outlet />
      </div>
    </div>
  )
}
