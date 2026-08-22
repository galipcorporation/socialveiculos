import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'

/**
 * Destino do redirect feito por `GET /v1/auth/google/callback` (login social)
 * e por `GET /v1/auth/sso/vitrine/resgatar` (SSO Gestor→Vitrine, M6). Os
 * tokens (ou o challenge de MFA) vêm no fragmento da URL (#...), que nunca é
 * enviado ao servidor — evita vazar o token em logs de acesso.
 *
 * M6: cookie é por origem, então só esta página (rodando na origem da
 * Vitrine) pode "adotar" os tokens do fragmento como cookie httpOnly aqui —
 * a API só redireciona com tokens no fragmento, nunca seta cookie de um
 * domínio no redirect para outro.
 */
export function GoogleCallback() {
  const navigate = useNavigate()
  const loginStore = useAuthStore((state) => state.login)
  const [erro, setErro] = useState<string | null>(null)
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null)
  const [mfaCodigo, setMfaCodigo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const erroParam = params.get('erro')
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const challenge = params.get('mfa_challenge_token')

    if (erroParam) {
      setErro(
        erroParam === 'conta_inativa'
          ? 'Esta conta está inativa.'
          : 'Não foi possível concluir o login com o Google.'
      )
      return
    }

    if (challenge) {
      setMfaChallengeToken(challenge)
      return
    }

    if (accessToken && refreshToken) {
      finalizarComToken(accessToken, refreshToken)
    } else {
      setErro('Resposta inválida do login com Google.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finalizarComToken(accessToken: string, refreshToken: string) {
    try {
      // Adota os tokens do fragmento como cookie httpOnly nesta origem antes
      // de qualquer chamada autenticada — depois disso o front nunca mais
      // vê o token em si, só o resultado de /auth/me.
      await api.post('/auth/adotar-cookie', { access_token: accessToken, refresh_token: refreshToken })
      const me: any = await api.get('/auth/me')
      loginStore(me)
      navigate('/', { replace: true })
    } catch {
      setErro('Não foi possível concluir o login com o Google.')
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaChallengeToken || mfaCodigo.length !== 6) return
    setLoading(true)
    setErro(null)
    try {
      const data: any = await api.post('/auth/mfa/verify-login', {
        mfa_challenge_token: mfaChallengeToken,
        codigo: mfaCodigo,
      })
      // /auth/mfa/verify-login já seta o cookie na resposta (chamado via
      // api.post, mesma origem) — só falta guardar o `user` no store.
      loginStore(data.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setErro(err.message || 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  if (erro) {
    return (
      <div className="vt-callback-page">
        <p>{erro}</p>
        <button className="vt-btn vt-btn-primary" onClick={() => navigate('/', { replace: true })}>
          Voltar ao início
        </button>
      </div>
    )
  }

  if (mfaChallengeToken) {
    return (
      <div className="vt-callback-page">
        <form onSubmit={handleMfaSubmit} className="vt-modal-form">
          <label>Código do autenticador</label>
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
          <button type="submit" className="vt-btn vt-btn-primary" disabled={loading || mfaCodigo.length !== 6}>
            {loading ? 'Confirmando...' : 'Confirmar código'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="vt-callback-page">
      <p>Concluindo login com Google...</p>
    </div>
  )
}
