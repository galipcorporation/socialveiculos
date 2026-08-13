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
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <Shield size={18} color="var(--sv-accent)" />
          <span>Social Veículos — Admin</span>
        </div>
        <div className="admin-topbar-user">
          <span className="admin-topbar-user-name">
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
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--sv-text-muted)',
              fontSize: 'var(--sv-text-xs)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
