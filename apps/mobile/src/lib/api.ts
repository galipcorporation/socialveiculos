// apps/mobile/src/lib/api.ts
import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'

type QueryParams = Record<string, string | number | boolean | undefined>

interface FetchOptions extends RequestInit {
  params?: QueryParams
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

// Promise compartilhada do refresh em andamento — requisições 401 concorrentes
// aguardam a mesma renovação em vez de cada uma tentar (e invalidar) o refresh
// token rotativo (single-use) uma por vez.
let refreshPromise: Promise<string> | null = null

function renovarToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { refreshToken, user, login, logout } = useAuthStore.getState()
    if (!refreshToken || !user) {
      logout()
      throw new ApiError('Sessão expirada. Faça login novamente.', {
        status: 401,
        path: '/auth/refresh',
        timestamp: new Date().toISOString(),
      })
    }

    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!refreshRes.ok) {
      logout()
      throw new ApiError('Sessão expirada. Faça login novamente.', {
        status: 401,
        path: '/auth/refresh',
        timestamp: new Date().toISOString(),
      })
    }

    const data = await refreshRes.json()
    login(data.access_token, data.refresh_token, user)
    return data.access_token as string
  })()

  refreshPromise.finally(() => {
    refreshPromise = null
  })

  return refreshPromise
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
      const pairs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      if (pairs.length) url += `?${pairs.join('&')}`
    }

    const { token } = useAuthStore.getState()
    const headers: Record<string, string> = {}
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    Object.assign(headers, (fetchOptions.headers as Record<string, string>) || {})

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const { lojaId } = useLojaAtivaStore.getState()
    if (lojaId && !headers['X-Loja-Id']) {
      headers['X-Loja-Id'] = lojaId
    }

    const response = await fetch(url, { ...fetchOptions, headers })

    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      const { refreshToken, user } = useAuthStore.getState()

      if (refreshToken && user) {
        const novoToken = await renovarToken()

        headers['Authorization'] = `Bearer ${novoToken}`
        const retryRes = await fetch(url, { ...fetchOptions, headers })

        if (!retryRes.ok) {
          const error = await retryRes.json().catch(() => ({}))
          throw new ApiError(friendlyHttpMessage(retryRes.status, error.error), {
            status: retryRes.status,
            path,
            timestamp: new Date().toISOString(),
          })
        }

        return retryRes.status === 204 ? (undefined as T) : retryRes.json()
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const ts = new Date().toISOString()
      const requestId = response.headers.get('x-request-id') ?? undefined
      throw new ApiError(friendlyHttpMessage(response.status, body.error ?? body.detail), {
        status: response.status,
        path,
        timestamp: ts,
        requestId,
      })
    }

    return response.status === 204 ? (undefined as T) : response.json()
  }

  get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>(path, { method: 'GET', params })
  }

  post<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options,
    })
  }

  put<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options,
    })
  }

  patch<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options,
    })
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
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

function friendlyHttpMessage(status: number, serverMessage?: string): string {
  if (status === 401) return 'Sessão expirada. Faça login novamente.'
  if (status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (status === 404) return 'O recurso solicitado não foi encontrado.'
  if (status === 422) return serverMessage || 'Os dados enviados são inválidos.'
  if (status === 429) return 'Muitas requisições. Aguarde um momento e tente de novo.'
  if (status >= 500) return 'Erro no servidor. Nossa equipe já foi notificada.'
  return serverMessage || 'Erro de comunicação com o servidor.'
}

export const api = new ApiClient(API_BASE)
