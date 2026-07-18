import { useLocation, useNavigate } from 'react-router-dom'

const ITEMS = [
  {
    path: '/',
    label: 'Explorar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, marginBottom: 2 }}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    path: '/favoritos',
    label: 'Favoritos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, marginBottom: 2 }}>
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    path: '/mensagens',
    label: 'Mensagens',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, marginBottom: 2 }}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="vt-mobile-nav" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '64px',
      background: 'var(--vt-surface)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid var(--vt-border)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 999,
      padding: '0 10px',
    }}>
      {ITEMS.map(item => {
        const active = location.pathname === item.path
        return (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: active ? 'var(--vt-primary)' : 'var(--vt-text-dim)', cursor: 'pointer', fontSize: 11 }}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
