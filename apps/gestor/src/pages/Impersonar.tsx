import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'

/**
 * Rota /impersonar?token=...&loja=...
 * Salva o token em sessionStorage e redireciona para o dashboard normal.
 * Um banner fixo no AppLayout exibe o aviso de impersonação.
 */
export function ImpersonarPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)

  useEffect(() => {
    const token = params.get('token')
    const loja = params.get('loja')

    if (!token) {
      navigate('/', { replace: true })
      return
    }

    const iniciar = async () => {
      // Salvar em sessionStorage para que o banner de impersonação persista só nesta aba
      sessionStorage.setItem('sv_impersonar_token', token)
      sessionStorage.setItem('sv_impersonar_loja', loja ?? '')

      // Substituir o token temporariamente para fazer a chamada
      setToken(token)

      try {
        const user = await api.get<any>('/me')
        useAuthStore.setState({
          token,
          user,
          isAuthenticated: true,
          refreshToken: null,
        })
      } catch (err) {
        console.error('Erro ao obter perfil impersonado:', err)
      } finally {
        navigate('/', { replace: true })
      }
    }

    iniciar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--sv-text-muted)' }}>
      Iniciando observação…
    </div>
  )
}
