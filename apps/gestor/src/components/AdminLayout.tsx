import { Outlet, useNavigate } from 'react-router-dom'
import { Shield, LogOut } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const sair = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--sv-bg-base)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--sv-space-6)',
        height: 56,
        borderBottom: '1px solid var(--sv-border)',
        background: 'var(--sv-bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sv-space-2)' }}>
          <Shield size={18} color="var(--sv-accent)" />
          <span style={{ fontWeight: 700, fontSize: 'var(--sv-text-sm)', color: 'var(--sv-text-primary)', letterSpacing: '0.02em' }}>
            Social Veículos — Admin
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sv-space-4)' }}>
          <span style={{ fontSize: 'var(--sv-text-xs)', color: 'var(--sv-text-muted)' }}>
            {user?.nome || user?.email}
          </span>
          <button
            onClick={sair}
            title="Sair"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: '1px solid var(--sv-border)',
              borderRadius: 'var(--sv-radius)',
              padding: '4px 10px',
              cursor: 'pointer',
              color: 'var(--sv-text-muted)',
              fontSize: 'var(--sv-text-xs)',
            }}
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: 'var(--sv-space-8) var(--sv-space-6)', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
