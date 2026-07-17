import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Shield, LogOut, AlertCircle } from 'lucide-react'
import { useAuthStore } from './stores/authStore'
import { api, ApiError } from './lib/api'
import { AdminPage } from './AdminPage'
import { UIProvider } from './components/UIProvider'

// ── Guard ────────────────────────────────────────────────────────

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, token, logout } = useAuthStore()

  useEffect(() => {
    if (token) {
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload.exp && payload.exp < Date.now() / 1000) {
            logout()
          }
        }
      } catch {
        logout()
      }
    }
  }, [token, logout])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.papel !== 'admin_plataforma') return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Login ────────────────────────────────────────────────────────

function LoginAdmin() {
  const navigate = useNavigate()
  const { login, isAuthenticated, user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated && user?.papel === 'admin_plataforma') {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    try {
      const data: any = await api.post('/auth/login', { email, senha })
      if (data.user?.papel !== 'admin_plataforma') {
        setErro('Acesso negado. Apenas administradores da plataforma.')
        return
      }
      login(data.access_token, data.refresh_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Credenciais inválidas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="bg-glow bg-glow-primary" />
      <div className="bg-glow bg-glow-secondary" />
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Shield size={26} />
          </div>
          <h2>Admin</h2>
          <p>Social Veículos — Plataforma</p>
        </div>

        {erro && (
          <div className="login-error-alert">
            <AlertCircle className="error-icon" size={16} />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="admin@socialveiculos.com.br"
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', height: 44, marginTop: 8 }}
          >
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Layout ───────────────────────────────────────────────────────

function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const sair = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sv-bg)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background Aurora Glows */}
      <div className="bg-glow bg-glow-primary" style={{ top: '10%', left: '10%', opacity: 0.12 }} />
      <div className="bg-glow bg-glow-secondary" style={{ bottom: '10%', right: '10%', opacity: 0.12 }} />

      <header className="topbar" style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} color="var(--sv-primary)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--sv-text)' }}>
            Social Veículos — Admin
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>
            {user?.nome || user?.email}
          </span>
          <button
            onClick={sair}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1px solid var(--sv-border)',
              borderRadius: 'var(--sv-radius)', padding: '4px 10px',
              cursor: 'pointer', color: 'var(--sv-text-dim)', fontSize: 12,
            }}
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 1200, width: '100%', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <AdminPage />
      </main>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginAdmin />} />
        <Route path="/" element={<RequireAdmin><AdminLayout /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UIProvider />
    </>
  )
}
