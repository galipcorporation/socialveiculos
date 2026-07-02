import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { api } from '../lib/api'
import { LogIn, KeyRound, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'

export function Login() {
  const navigate = useNavigate()
  const loginStore = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const user = useAuthStore((state) => state.user)

  // Redireciona se já estiver autenticado
  React.useEffect(() => {
    if (isAuthenticated) {
      if (user?.papel === 'admin_plataforma') {
        navigate(`/${import.meta.env.VITE_ADMIN_PATH || 'painel-sv'}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [isAuthenticated, user, navigate])

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !senha) {
      setErro('Preencha todos os campos.')
      return
    }

    setLoading(true)
    setErro(null)

    try {
      const data: any = await api.post('/auth/login', { email, senha })
      
      // Armazena no Zustand (que persiste no localStorage)
      loginStore(data.access_token, data.refresh_token, data.user)

      // Admin da plataforma vai para o painel admin
      if (data.user?.papel === 'admin_plataforma') {
        navigate(`/${import.meta.env.VITE_ADMIN_PATH || 'painel-sv'}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setErro(err.message || 'Credenciais inválidas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* Elementos flutuantes de fundo do glassmorphism */}
      <div className="bg-glow bg-glow-primary"></div>
      <div className="bg-glow bg-glow-secondary"></div>
      
      <div className="login-card glass-card">
        <div className="login-brand">
          <div className="login-logo">SV</div>
          <h2>Social Veículos</h2>
          <p>Portal do Gestor</p>
        </div>

        {erro && (
          <div className="login-error-alert">
            <AlertCircle className="error-icon" size={18} />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">E-mail Corporativo</label>
            <div className="input-icon-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                placeholder="nome@autopremium.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                  }
                }}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha de Acesso</label>
            <div className="input-icon-wrapper">
              <KeyRound className="input-icon" size={18} />
              <input
                id="senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="forgot-password-link">
            <a href="#" onClick={(e) => {
              e.preventDefault()
              useUIStore.getState().showToast('A recuperação de senha foi configurada na API. Contate o administrador local para resetar via /v1/auth/forgot-password.', 'info')
            }}>
              Esqueceu sua senha?
            </a>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-login" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Acessar Painel</span>
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Acesso restrito a concessionárias parceiras.</p>
        </div>
      </div>
    </div>
  )
}
