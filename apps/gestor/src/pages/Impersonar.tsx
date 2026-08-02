import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'

/**
 * Rota /impersonar?code=...
 * Recebe um CÓDIGO de uso único (60s) do painel admin e o troca pelo token num
 * POST. O token nunca trafega na URL: query string vai parar no histórico do
 * navegador, no header Referer e nos logs de acesso do servidor — e este token
 * é sessão de gestor completa.
 * Salva o token em sessionStorage e redireciona para o dashboard normal.
 * Um banner fixo no AppLayout exibe o aviso de impersonação.
 */
export function ImpersonarPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)

  useEffect(() => {
    const codigo = params.get('code')

    if (!codigo) {
      navigate('/', { replace: true })
      return
    }

    const iniciar = async () => {
      // Tira o código da barra de endereço antes de qualquer await: mesmo de uso
      // único, não há motivo para ele ficar visível ou ser copiado/colado.
      window.history.replaceState({}, '', '/impersonar')

      let token: string
      let loja: string
      try {
        const res = await api.post<{ access_token: string; loja_nome: string }>(
          '/admin/impersonar/trocar',
          { codigo },
        )
        token = res.access_token
        loja = res.loja_nome
      } catch (err) {
        console.error('Erro ao trocar o código de observação:', err)
        navigate('/', { replace: true })
        return
      }

      // Salvar em sessionStorage para que o banner de impersonação persista só nesta aba
      sessionStorage.setItem('sv_impersonar_token', token)
      sessionStorage.setItem('sv_impersonar_loja', loja)

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
