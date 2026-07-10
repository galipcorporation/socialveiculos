// apps/mobile/src/lib/api.ts
import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'

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

    if (response.status === 401 && !isRefreshing && path !== '/auth/login' && path !== '/auth/refresh') {
      const { refreshToken, user, login, logout } = useAuthStore.getState()

      if (refreshToken && user) {
        isRefreshing = true
        try {
          const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })

          if (refreshRes.ok) {
            const data = await refreshRes.json()
            login(data.access_token, data.refresh_token, user)
            isRefreshing = false

            headers['Authorization'] = `Bearer ${data.access_token}`
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
          } else {
            isRefreshing = false
            logout()
            throw new ApiError('Sessão expirada. Faça login novamente.', {
              status: 401,
              path,
              timestamp: new Date().toISOString(),
            })
          }
        } catch (err) {
          isRefreshing = false
          logout()
          throw err
        }
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

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
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

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
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
