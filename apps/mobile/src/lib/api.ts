// apps/mobile/src/lib/api.ts
import { useAuthStore } from '../stores/authStore'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'

type QueryParams = Record<string, string | number | boolean | undefined>

interface FetchOptions extends RequestInit {
  params?: QueryParams
}

/**
 * Natureza do erro, para a UI escolher o texto e decidir se "Tentar de novo"
 * faz sentido. Sem isso todo 403 de permissão virava "Algo deu errado" com um
 * botão de retry que nunca resolve — o usuário fica preso sem saber que falta
 * liberação, e não erro de rede (ver B-mobile: retorno genérico no ErrorState).
 */
export type ApiErrorTipo =
  | 'rede'
  | 'sessao'
  | 'permissao'
  | 'paywall'
  | 'nao_encontrado'
  | 'validacao'
  | 'limite'
  | 'servidor'
  | 'desconhecido'

export interface ApiErrorDetails {
  status: number
  path: string
  timestamp: string
  requestId?: string
  /** `code` do corpo padronizado da API (ex.: "INTERNAL_ERROR"), quando vier. */
  codigo?: string
  /** Módulo do paywall (header `X-Paywall-Modulo`) nos 402. */
  modulo?: string
}

export class ApiError extends Error {
  details: ApiErrorDetails
  tipo: ApiErrorTipo
  /** True quando repetir a mesma requisição pode dar certo sem nenhuma ação externa. */
  retentavel: boolean
  constructor(message: string, details: ApiErrorDetails, tipo: ApiErrorTipo = classificar(details.status)) {
    super(message)
    this.name = 'ApiError'
    this.details = details
    this.tipo = tipo
    this.retentavel = tipo === 'rede' || tipo === 'servidor' || tipo === 'limite'
  }
}

function classificar(status: number): ApiErrorTipo {
  if (status === 0) return 'rede'
  if (status === 401) return 'sessao'
  if (status === 402) return 'paywall'
  if (status === 403) return 'permissao'
  if (status === 404) return 'nao_encontrado'
  if (status === 422) return 'validacao'
  if (status === 429) return 'limite'
  if (status >= 500) return 'servidor'
  return 'desconhecido'
}

/**
 * `fetch` que converte falha de transporte (offline, DNS, timeout, TLS) em
 * `ApiError` tipo "rede". Sem isso o erro chegava na tela como um `TypeError`
 * cru ("Network request failed") e caía no mesmo texto genérico de um 403.
 */
async function fetchOuErroDeRede(url: string, init: RequestInit, path: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique sua internet e tente de novo.', {
      status: 0,
      path,
      timestamp: new Date().toISOString(),
    })
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

    // Queda de rede aqui não é sessão expirada: `fetchOuErroDeRede` lança
    // ApiError('rede') e o logout abaixo só roda quando o servidor de fato
    // recusou o refresh token.
    const refreshRes = await fetchOuErroDeRede(
      `${API_BASE}/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      '/auth/refresh'
    )

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

  /**
   * Executa a requisição já autenticada (Bearer + X-Loja-Id) e devolve a
   * `Response` crua — sem interpretar o corpo. Endpoints que não respondem JSON
   * (ex.: o HTML do contrato) precisam do mesmo cabeçalho e do mesmo retry de
   * 401 que os demais, então o transporte mora aqui e a leitura do corpo fica
   * com quem chamou.
   */
  private async fetchComAuth(path: string, options: FetchOptions = {}): Promise<Response> {
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

    const response = await fetchOuErroDeRede(url, { ...fetchOptions, headers }, path)

    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      const { refreshToken, user } = useAuthStore.getState()

      if (refreshToken && user) {
        const novoToken = await renovarToken()

        headers['Authorization'] = `Bearer ${novoToken}`
        return fetchOuErroDeRede(url, { ...fetchOptions, headers }, path)
      }
    }

    return response
  }

  private async erroDaResposta(response: Response, path: string): Promise<ApiError> {
    const body = await response.json().catch(() => ({}))
    const doServidor = typeof body.error === 'string' ? body.error : typeof body.detail === 'string' ? body.detail : undefined
    return new ApiError(friendlyHttpMessage(response.status, doServidor), {
      status: response.status,
      path,
      timestamp: new Date().toISOString(),
      requestId: response.headers.get('x-request-id') ?? undefined,
      codigo: typeof body.code === 'string' ? body.code : undefined,
      modulo: response.headers.get('x-paywall-modulo') ?? undefined,
    })
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const response = await this.fetchComAuth(path, options)

    if (!response.ok) {
      throw await this.erroDaResposta(response, path)
    }

    return response.status === 204 ? (undefined as T) : response.json()
  }

  /** GET que devolve o corpo como texto (HTML, CSV…) em vez de JSON. */
  async getText(path: string, params?: QueryParams): Promise<string> {
    const response = await this.fetchComAuth(path, { method: 'GET', params })

    if (!response.ok) {
      throw await this.erroDaResposta(response, path)
    }

    return response.text()
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
  // 402/403 preservam o texto da API: é ele que diz *qual* liberação falta
  // (vínculo inativo, papel sem a ação, módulo não contratado). Trocar por um
  // texto fixo apagava a única informação acionável da tela.
  if (status === 402) return serverMessage || 'Este módulo não está incluído no plano da loja.'
  if (status === 403) return serverMessage || 'Você não tem permissão para realizar esta ação.'
  if (status === 404) return serverMessage || 'O recurso solicitado não foi encontrado.'
  if (status === 422) return serverMessage || 'Os dados enviados são inválidos.'
  if (status === 429) return 'Muitas requisições. Aguarde um momento e tente de novo.'
  if (status >= 500) return 'Erro no servidor. Nossa equipe já foi notificada.'
  return serverMessage || 'Erro de comunicação com o servidor.'
}

export interface ErroApresentavel {
  tipo: ApiErrorTipo
  titulo: string
  mensagem: string
  icone: 'cloud-offline-outline' | 'lock-closed-outline' | 'sparkles-outline' | 'log-in-outline' | 'alert-circle-outline'
  /** Rótulo do botão, ou `null` quando repetir não leva a lugar nenhum. */
  acaoLabel: string | null
}

/**
 * Traduz um erro em título/mensagem/ícone para os estados de falha das telas.
 * Concentrado aqui para Início, Estoque, CRM etc. contarem a mesma história.
 */
export function descreverErro(err: unknown): ErroApresentavel {
  const { message } = extractErrorDetails(err)
  const tipo: ApiErrorTipo = err instanceof ApiError ? err.tipo : 'desconhecido'

  switch (tipo) {
    case 'rede':
      return {
        tipo,
        titulo: 'Sem conexão',
        mensagem: 'Não conseguimos falar com o servidor. Verifique sua internet e tente de novo.',
        icone: 'cloud-offline-outline',
        acaoLabel: 'Tentar de novo',
      }
    case 'permissao':
      return {
        tipo,
        titulo: 'Acesso não liberado',
        mensagem: message,
        icone: 'lock-closed-outline',
        // Quem libera é o gestor no painel; o retry serve para reconferir
        // depois disso, por isso o rótulo não promete que vai carregar.
        acaoLabel: 'Verificar novamente',
      }
    case 'paywall':
      return {
        tipo,
        titulo: 'Módulo não incluído no plano',
        mensagem: message,
        icone: 'sparkles-outline',
        acaoLabel: null,
      }
    case 'sessao':
      return {
        tipo,
        titulo: 'Sessão expirada',
        mensagem: 'Entre de novo para continuar.',
        icone: 'log-in-outline',
        acaoLabel: null,
      }
    case 'nao_encontrado':
      return { tipo, titulo: 'Não encontrado', mensagem: message, icone: 'alert-circle-outline', acaoLabel: null }
    case 'limite':
      return {
        tipo,
        titulo: 'Muitas requisições',
        mensagem: 'Aguarde alguns segundos antes de tentar de novo.',
        icone: 'alert-circle-outline',
        acaoLabel: 'Tentar de novo',
      }
    default:
      return {
        tipo: 'desconhecido',
        titulo: 'Não foi possível carregar',
        mensagem: message || 'Algo deu errado ao carregar os dados.',
        icone: 'cloud-offline-outline',
        acaoLabel: 'Tentar de novo',
      }
  }
}

export const api = new ApiClient(API_BASE)
