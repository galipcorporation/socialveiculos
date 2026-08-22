import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'

const API_BASE = '/v1'

interface FetchOptions extends RequestInit {
  params?: Record<string, string>
}

export interface ApiErrorDetails {
  status: number
  path: string
  timestamp: string
  requestId?: string
}

export class ApiError extends Error {
  details: ApiErrorDetails
  constructor(message: string, details: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.details = details
  }
}

let isRefreshing = false

// ── Cache curto de GETs ──────────────────────────────────────────
// Torna a alternação de telas fluida: voltar a uma página dentro do TTL
// renderiza na hora com os dados já carregados, sem spinner. Segurança:
// qualquer mutação (POST/PUT/PATCH/DELETE) limpa o cache inteiro, e
// endpoints "vivos" (polling de notificações, chat, assistente) nunca
// são cacheados. A chave inclui usuário e loja ativa (multi-loja/admin).
const GET_CACHE_TTL_MS = 15_000
const GET_CACHE_MAX = 80
const CACHE_EXCLUDE = /\/(notificacoes|assistente|chat)\b|unread/
const getCache = new Map<string, { ts: number; data: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

function limparCacheGet() {
  getCache.clear()
}

// Sessão inválida (conta desativada ou expirada): limpa o auth e leva ao login.
// Usa window.location para funcionar mesmo fora do contexto do React Router.
function forcarLogin(reason: string) {
  useAuthStore.getState().logout(reason)
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options

    let url = `${this.baseUrl}${path}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers: Record<string, string> = {}
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    Object.assign(headers, (fetchOptions.headers as Record<string, string>) || {})

    // Admin de plataforma (suporte): envia a loja escolhida. O backend ignora
    // este header para gestor/vendedor, então é seguro sempre anexá-lo.
    const { lojaId } = useLojaAtivaStore.getState()
    if (lojaId && !headers['X-Loja-Id']) {
      headers['X-Loja-Id'] = lojaId
    }

    // M6: sessão vai por cookie httpOnly (sv_access/sv_refresh), não mais
    // por header Authorization montado a partir do Zustand. `credentials:
    // 'include'` manda o cookie mesmo com o proxy do vercel.json reescrevendo
    // /v1 para outro host — do ponto de vista do browser ainda é same-origin.
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })

    // Se 401, tentar dar refresh transparente
    if (response.status === 401 && !isRefreshing && path !== '/auth/login' && path !== '/auth/refresh') {
      const { user } = useAuthStore.getState()

      // Sem usuário no store: nunca esteve autenticado nesta aba. Expulsa para o login.
      if (!user) {
        forcarLogin('Sua sessão terminou. Faça login novamente.')
        throw new ApiError('Sessão expirada. Faça login novamente.', {
          status: 401,
          path,
          timestamp: new Date().toISOString(),
        })
      }

      isRefreshing = true
      try {
        // Sem body: o refresh token vem do cookie sv_refresh.
        const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })

        if (refreshRes.ok) {
          // A resposta já rotacionou o cookie sv_access/sv_refresh — nada a
          // guardar no JS, só refazer a requisição original.
          isRefreshing = false

          const retryRes = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'include',
          })

          if (!retryRes.ok) {
            const error = await retryRes.json().catch(() => ({}))
            throw new ApiError(friendlyHttpMessage(retryRes.status, error.error), {
              status: retryRes.status,
              path,
              timestamp: new Date().toISOString(),
            })
          }

          return retryRes.json()
        } else {
          // Refresh também rejeitado: conta desativada ou sessão revogada/expirada.
          isRefreshing = false
          forcarLogin('Seu acesso foi encerrado. Faça login novamente.')
          throw new ApiError('Sessão expirada. Faça login novamente.', {
            status: 401,
            path,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (err) {
        isRefreshing = false
        forcarLogin('Seu acesso foi encerrado. Faça login novamente.')
        throw err
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const ts = new Date().toISOString()
      const requestId = response.headers.get('x-request-id') ?? undefined
      if (response.status >= 500 && response.status !== 503) {
        const erroMsg = typeof body.detail === 'string' ? body.detail : (body.error ?? (body.detail ? JSON.stringify(body.detail) : undefined))
        void reportarErroServidor({ path, status: response.status, timestamp: ts, requestId, origem: 'gestor', mensagem: erroMsg })
      }
      throw new ApiError(friendlyHttpMessage(response.status, body.error ?? body.detail), {
        status: response.status,
        path,
        timestamp: ts,
        requestId,
      })
    }

    return response.json()
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    if (CACHE_EXCLUDE.test(path)) {
      return this.request<T>(path, { method: 'GET', params })
    }

    const { user } = useAuthStore.getState()
    const { lojaId } = useLojaAtivaStore.getState()
    const key = `${user?.id ?? ''}|${lojaId ?? ''}|${path}|${params ? new URLSearchParams(params).toString() : ''}`

    const cached = getCache.get(key)
    if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
      return Promise.resolve(cached.data as T)
    }

    const pending = inflight.get(key)
    if (pending) {
      return pending as Promise<T>
    }

    const req = this.request<T>(path, { method: 'GET', params })
      .then((data) => {
        getCache.set(key, { ts: Date.now(), data })
        // Descarta a entrada mais antiga quando estoura o teto
        if (getCache.size > GET_CACHE_MAX) {
          const oldest = getCache.keys().next().value
          if (oldest !== undefined) getCache.delete(oldest)
        }
        return data
      })
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, req)
    return req
  }

  post<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    limparCacheGet()
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options
    })
  }

  put<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    limparCacheGet()
    return this.request<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options
    })
  }

  patch<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    limparCacheGet()
    return this.request<T>(path, {
      method: 'PATCH',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options
    })
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    limparCacheGet()
    return this.request<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    })
  }
}

export function extractErrorDetails(err: unknown): { message: string; details?: ApiErrorDetails } {
  if (err instanceof ApiError) {
    return { message: err.message, details: err.details }
  }
  if (err instanceof Error) {
    return { message: err.message }
  }
  return { message: 'Erro inesperado.' }
}

function reportarErroServidor(data: {
  path: string
  status: number
  timestamp: string
  requestId?: string
  origem: string
  mensagem?: string
}) {
  const { user } = useAuthStore.getState()
  const payload = {
    ...data,
    user_name: user?.nome || undefined,
    user_email: user?.email || undefined,
  }
  return fetch(`${API_BASE}/admin/erros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

function friendlyHttpMessage(status: number, serverMessage?: string): string {
  if (status === 401) return 'Sessão expirada. Faça login novamente.'
  // 402/403 preservam o texto da API: é ele que diz qual liberação falta
  // (vínculo inativo, papel sem a ação, módulo não contratado).
  if (status === 402) return serverMessage || 'Este módulo não está incluído no plano da loja.'
  if (status === 403) return serverMessage || 'Você não tem permissão para realizar esta ação.'
  if (status === 404) return serverMessage || 'O recurso solicitado não foi encontrado.'
  if (status === 422) return serverMessage || 'Os dados enviados são inválidos.'
  if (status === 429) return 'Muitas requisições. Aguarde um momento e tente de novo.'
  if (status === 503) return serverMessage || 'Serviço indisponível no momento. Tente novamente em instantes.'
  if (status >= 500) return 'Erro no servidor. Nossa equipe já foi notificada.'
  return serverMessage || 'Erro de comunicação com o servidor.'
}

export const api = new ApiClient(API_BASE)

