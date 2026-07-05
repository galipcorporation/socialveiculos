import { useState } from 'react'
import { api } from '../lib/api'

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
      <div className="vt-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="vt-modal-close" onClick={onClose}>×</button>
        <div className="vt-modal-header">
          <h3>Verificação em duas etapas</h3>
          <p>Adicione uma camada extra de segurança usando um app autenticador (Google Authenticator, Authy).</p>
        </div>

        {erro && (
          <div className="vt-modal-error"><span>{erro}</span></div>
        )}

        {etapa === 'inicial' && !mfaAtivo && (
          <button className="vt-btn vt-btn-primary vt-btn-block" onClick={iniciarEnroll} disabled={loading}>
            {loading ? 'Gerando...' : 'Ativar verificação em duas etapas'}
          </button>
        )}

        {etapa === 'inicial' && mfaAtivo && (
          <button className="vt-btn vt-btn-outline vt-btn-block" onClick={() => setEtapa('desativar')} disabled={loading}>
            Desativar verificação em duas etapas
          </button>
        )}

        {etapa === 'enroll' && qrCode && (
          <form onSubmit={confirmarEnroll} className="vt-modal-form">
            <img
              src={`data:image/png;base64,${qrCode}`}
              alt="QR Code do autenticador"
              style={{ width: 200, height: 200, alignSelf: 'center', background: '#fff', padding: 8, borderRadius: 8 }}
            />
            <div className="vt-form-group">
              <label>Código do autenticador</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={loading || codigo.length !== 6}>
              {loading ? 'Confirmando...' : 'Confirmar e ativar'}
            </button>
          </form>
        )}

        {etapa === 'desativar' && (
          <form onSubmit={desativar} className="vt-modal-form">
            <div className="vt-form-group">
              <label>Confirme sua senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={loading || !senha}>
              {loading ? 'Desativando...' : 'Desativar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
