import React, { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import { X, Mail, KeyRound, User, Phone, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { mascararTelefone, capitalizarNome } from '../lib/mascaras'

export function LoginModal() {
  const isOpen = useAuthStore((state) => state.isLoginModalOpen)
  const tab = useAuthStore((state) => state.loginModalTab)
  const setTab = useAuthStore((state) => state.openLoginModal)
  const close = useAuthStore((state) => state.closeLoginModal)
  const loginStore = useAuthStore((state) => state.login)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)
  const [showPasswordRegister, setShowPasswordRegister] = useState(false)
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null)
  const [mfaCodigo, setMfaCodigo] = useState('')

  if (!isOpen) return null

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !senha) return
    setLoading(true)
    setErro(null)

    try {
      const data: any = await api.post('/auth/login', { email, senha })
      if (data.mfa_required) {
        setMfaChallengeToken(data.mfa_challenge_token)
        return
      }
      loginStore(data.access_token, data.refresh_token, data.user)
      close()
    } catch (err: any) {
      setErro(err.message || 'E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaChallengeToken || mfaCodigo.length !== 6) return
    setLoading(true)
    setErro(null)

    try {
      const data: any = await api.post('/auth/mfa/verify-login', {
        mfa_challenge_token: mfaChallengeToken,
        codigo: mfaCodigo,
      })
      loginStore(data.access_token, data.refresh_token, data.user)
      close()
    } catch (err: any) {
      setErro(err.message || 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome || !email || !senha) return
    setLoading(true)
    setErro(null)

    try {
      // 1. Cadastra Cliente B2C
      await api.post('/auth/register-b2c', { nome, email, senha, telefone: telefone || undefined })
      
      // 2. Faz login imediatamente após o cadastro
      const data: any = await api.post('/auth/login', { email, senha })
      loginStore(data.access_token, data.refresh_token, data.user)
      close()
    } catch (err: any) {
      setErro(err.message || 'Falha ao realizar cadastro. Tente outro e-mail.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vt-modal-overlay" onClick={close}>
      <div className="vt-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="vt-modal-close" onClick={close}>
          <X size={20} />
        </button>

        <div className="vt-modal-header">
          <h3>Sua jornada automotiva começa aqui</h3>
          <p>Conecte-se para favoritar veículos, enviar propostas e conversar diretamente com as concessionárias.</p>
        </div>

        {/* Abas */}
        <div className="vt-modal-tabs">
          <button
            className={`vt-modal-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setErro(null)
              setSenha('')
              setShowPasswordLogin(false)
              setShowPasswordRegister(false)
              setTab('login')
            }}
            disabled={loading}
          >
            Entrar
          </button>
          <button
            className={`vt-modal-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setErro(null)
              setSenha('')
              setShowPasswordLogin(false)
              setShowPasswordRegister(false)
              setTab('register')
            }}
            disabled={loading}
          >
            Cadastrar
          </button>
        </div>

        {erro && (
          <div className="vt-modal-error">
            <AlertCircle size={16} />
            <span>{erro}</span>
          </div>
        )}

        {/* Segundo fator (MFA) — aparece após o login por senha indicar que é exigido */}
        {mfaChallengeToken ? (
          <form onSubmit={handleMfaSubmit} className="vt-modal-form">
            <div className="vt-form-group">
              <label>Código do autenticador</label>
              <div className="vt-input-wrapper">
                <KeyRound className="vt-input-icon" size={16} />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={mfaCodigo}
                  onChange={(e) => setMfaCodigo(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>
            <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={loading || mfaCodigo.length !== 6}>
              {loading ? <span className="spinner"></span> : 'Confirmar código'}
            </button>
            <button
              type="button"
              className="vt-btn vt-btn-social"
              onClick={() => { setMfaChallengeToken(null); setMfaCodigo(''); setErro(null) }}
              disabled={loading}
            >
              Voltar
            </button>
          </form>
        ) : tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="vt-modal-form">
            <div className="vt-form-group">
              <label>E-mail</label>
              <div className="vt-input-wrapper">
                <Mail className="vt-input-icon" size={16} />
                <input
                  type="email"
                  placeholder="Seu e-mail"
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

            <div className="vt-form-group">
              <label>Senha</label>
              <div className="vt-input-wrapper">
                <KeyRound className="vt-input-icon" size={16} />
                <input
                  type={showPasswordLogin ? 'text' : 'password'}
                  className="vt-input-password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="vt-btn-toggle-password"
                  onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                  tabIndex={-1}
                >
                  {showPasswordLogin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Acessar Conta'}
            </button>
          </form>
        ) : (
          /* Formulário de Cadastro */
          <form onSubmit={handleRegisterSubmit} className="vt-modal-form">
            <div className="vt-form-group">
              <label>Nome Completo</label>
              <div className="vt-input-wrapper">
                <User className="vt-input-icon" size={16} />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(capitalizarNome(e.target.value))}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="vt-form-group">
              <label>E-mail</label>
              <div className="vt-input-wrapper">
                <Mail className="vt-input-icon" size={16} />
                <input
                  type="email"
                  placeholder="Seu e-mail"
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

            <div className="vt-form-group">
              <label>Telefone (opcional)</label>
              <div className="vt-input-wrapper">
                <Phone className="vt-input-icon" size={16} />
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="vt-form-group">
              <label>Senha de Acesso</label>
              <div className="vt-input-wrapper">
                <KeyRound className="vt-input-icon" size={16} />
                <input
                  type={showPasswordRegister ? 'text' : 'password'}
                  className="vt-input-password"
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="vt-btn-toggle-password"
                  onClick={() => setShowPasswordRegister(!showPasswordRegister)}
                  tabIndex={-1}
                >
                  {showPasswordRegister ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Criar minha Conta'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
