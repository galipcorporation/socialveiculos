import { useState } from 'react'
import { api } from '../lib/api'
import { X, ShieldCheck, KeyRound, Lock, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react'

interface Props {
  mfaAtivo: boolean
  onClose: () => void
  onChange: (ativo: boolean) => void
}

/**
 * Modal de ativação/desativação de MFA (TOTP) nas configurações da conta.
 * Fluxo de ativação: enroll (gera QR) -> usuário escaneia -> confirm (código).
 */
export function MfaSettingsModal({ mfaAtivo, onClose, onChange }: Props) {
  const [etapa, setEtapa] = useState<'inicial' | 'enroll' | 'desativar'>('inicial')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function iniciarEnroll() {
    setLoading(true)
    setErro(null)
    try {
      const data: any = await api.post('/auth/mfa/enroll', {})
      setQrCode(data.qr_code_base64)
      setEtapa('enroll')
    } catch (err: any) {
      setErro(err.message || 'Não foi possível iniciar a ativação do MFA.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmarEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (codigo.length !== 6) return
    setLoading(true)
    setErro(null)
    try {
      await api.post('/auth/mfa/confirm', { codigo })
      onChange(true)
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  async function desativar(e: React.FormEvent) {
    e.preventDefault()
    if (!senha) return
    setLoading(true)
    setErro(null)
    try {
      await api.post('/auth/mfa/disable', { senha })
      onChange(false)
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Senha incorreta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal-card" style={{ maxWidth: 440, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="vt-modal-close" onClick={onClose} aria-label="Fechar modal">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="vt-modal-header" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--vt-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3>Verificação em duas etapas</h3>
            <p>Proteja sua conta utilizando um aplicativo autenticador como Google Authenticator ou Authy.</p>
          </div>
        </div>

        {erro && (
          <div className="vt-modal-error">
            <AlertCircle size={16} />
            <span>{erro}</span>
          </div>
        )}

        {/* Initial Stage */}
        {etapa === 'inicial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--vt-radius)',
                background: 'var(--vt-surface-hover)',
                border: '1px solid var(--vt-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {mfaAtivo ? (
                  <span className="vt-badge vt-badge-success">
                    <CheckCircle2 size={13} /> Proteção Ativa
                  </span>
                ) : (
                  <span className="vt-badge vt-badge-muted">Proteção Desativada</span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--vt-text-dim)', margin: 0, lineHeight: 1.45 }}>
                {mfaAtivo
                  ? 'Sua conta está protegida. Sempre que fizer login, um código de verificação temporário será solicitado.'
                  : 'Sua conta possui apenas autenticação por senha. Ative o 2FA para garantir maior segurança contra acessos não autorizados.'}
              </p>
            </div>

            {!mfaAtivo ? (
              <button className="vt-btn vt-btn-primary vt-btn-block" onClick={iniciarEnroll} disabled={loading}>
                {loading ? 'Gerando QR Code…' : 'Ativar verificação em duas etapas'}
              </button>
            ) : (
              <button
                className="vt-btn vt-btn-danger-outline vt-btn-block"
                onClick={() => setEtapa('desativar')}
                disabled={loading}
              >
                Desativar verificação em duas etapas
              </button>
            )}
          </div>
        )}

        {/* Enroll Stage (Scan QR & Verify) */}
        {etapa === 'enroll' && qrCode && (
          <form onSubmit={confirmarEnroll} className="vt-modal-form">
            <div style={{ fontSize: '13px', color: 'var(--vt-text-dim)', lineHeight: 1.4 }}>
              <strong>1.</strong> Escaneie o QR Code abaixo no seu aplicativo autenticador:
            </div>

            <div className="vt-qr-frame">
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="QR Code do autenticador"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div className="vt-form-group">
              <label>2. Digite o código de 6 dígitos gerado</label>
              <div className="vt-input-wrapper">
                <KeyRound className="vt-input-icon" size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  className="vt-input vt-code-input"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="vt-btn vt-btn-secondary"
                onClick={() => {
                  setEtapa('inicial')
                  setErro(null)
                }}
                disabled={loading}
                style={{ gap: '6px' }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>

              <button
                type="submit"
                className="vt-btn vt-btn-primary"
                style={{ flex: 1 }}
                disabled={loading || codigo.length !== 6}
              >
                {loading ? 'Confirmando...' : 'Confirmar e ativar'}
              </button>
            </div>
          </form>
        )}

        {/* Disable Stage (Confirm Password) */}
        {etapa === 'desativar' && (
          <form onSubmit={desativar} className="vt-modal-form">
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--vt-radius)',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--vt-error)',
                fontSize: '13px',
              }}
            >
              Atenção: Ao desativar o 2FA, sua conta perderá a camada extra de segurança.
            </div>

            <div className="vt-form-group">
              <label>Confirme sua senha para continuar</label>
              <div className="vt-input-wrapper">
                <Lock className="vt-input-icon" size={18} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha atual"
                  className="vt-input vt-input-password"
                  required
                  autoFocus
                  disabled={loading}
                />
                <button
                  type="button"
                  className="vt-btn-toggle-password"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="vt-btn vt-btn-secondary"
                onClick={() => {
                  setEtapa('inicial')
                  setErro(null)
                }}
                disabled={loading}
                style={{ gap: '6px' }}
              >
                <ArrowLeft size={16} /> Cancelar
              </button>

              <button
                type="submit"
                className="vt-btn vt-btn-danger-outline"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={loading || !senha}
              >
                {loading ? 'Desativando...' : 'Desativar 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
