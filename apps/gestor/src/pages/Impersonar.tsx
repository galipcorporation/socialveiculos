import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'

/**
 * Rota /impersonar?code=...
 * Recebe um CÓDIGO de uso único (60s) do painel admin e o troca por uma
 * sessão num POST. O token nunca trafega na URL: query string vai parar no
 * histórico do navegador, no header Referer e nos logs de acesso do servidor
 * — e este token é sessão de gestor completa.
 *
 * M6: a troca (POST /admin/impersonar/trocar) já sobrescreve o cookie
 * httpOnly `sv_access` desta aba com o token de observação (15 min) — nada
 * pra guardar no JS além do nome da loja, que só serve pro banner de aviso.
 */
export function ImpersonarPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

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

      try {
        const res = await api.post<{ loja_nome: string }>('/admin/impersonar/trocar', { codigo })
        sessionStorage.setItem('sv_impersonar_loja', res.loja_nome)

        const user = await api.get<any>('/me')
        login(user)
      } catch (err) {
        console.error('Erro ao iniciar observação:', err)
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
