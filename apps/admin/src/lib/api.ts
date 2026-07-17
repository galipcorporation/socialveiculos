import { useAuthStore } from '../stores/authStore'

const API_BASE = '/v1'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function parseDetail(detail: any): string {
  if (Array.isArray(detail)) {
    return detail.map(d => {
      const field = d.loc ? d.loc[d.loc.length - 1] : ''
      const fieldLabel = field ? `Campo "${field}": ` : ''
      
      let msg = d.msg || 'valor inválido'
      if (msg.includes('is not among the defined enum values')) {
        return `${fieldLabel}O valor inserido não é uma opção permitida.`
      }
      if (msg.includes('value is not a valid email')) {
        return `${fieldLabel}O e-mail informado não é válido.`
      }
      if (msg.includes('field required')) {
        return `${fieldLabel}Este campo é obrigatório.`
      }
      return `${fieldLabel}${msg}`
    }).join('; ')
  }
  if (typeof detail === 'string') {
    if (detail.includes('is not among the defined enum values')) {
      return 'O valor selecionado não faz parte das opções válidas.'
    }
    return detail
  }
  return ''
}

function friendlyHttpMessage(status: number, serverMessage?: string): string {
  if (status === 401) return 'Sessão expirada. Faça login novamente.'
  if (status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (status === 404) return 'O recurso solicitado não foi encontrado.'
  if (status === 422) return serverMessage || 'Os dados enviados são inválidos.'
  if (status === 429) return 'Muitas requisições. Aguarde um momento e tente de novo.'
  if (status >= 500) return 'Erro interno no servidor. Tente novamente mais tarde.'
  return serverMessage || 'Erro de comunicação com o servidor.'
}

class ApiClient {
  private baseUrl: string
  constructor(baseUrl: string) { this.baseUrl = baseUrl }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { token } = useAuthStore.getState()
    const headers: Record<string, string> = {}
    // FormData: deixa o browser definir o Content-Type (com boundary).
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers })

    if (response.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      throw new ApiError('Sessão expirada.', 401)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const serverMessage = parseDetail(body.detail) || body.error || ''
      const finalMessage = friendlyHttpMessage(response.status, serverMessage)
      throw new ApiError(finalMessage, response.status)
    }

    return response.json()
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path
    return this.request<T>(url, { method: 'GET' })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    const payload = body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined)
    return this.request<T>(path, { method: 'POST', body: payload })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_BASE)
