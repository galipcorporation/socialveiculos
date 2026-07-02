/**
 * Resolve a URL base de WebSocket.
 *
 * Em dev, o WS trafega pelo mesmo host do front (proxy do Vite → backend).
 * Em produção (Vercel), o rewrite do Vercel NÃO proxeia WebSocket, então o
 * front precisa falar direto com o backend (Fly). Defina VITE_WS_URL no painel
 * da Vercel com o host do backend, ex.: wss://sv-api.fly.dev
 *
 * Sem VITE_WS_URL, cai no comportamento antigo (mesmo host) — correto em dev.
 */
export function wsUrl(path: string): string {
  const base = (import.meta.env.VITE_WS_URL as string | undefined)?.trim()
  const p = path.startsWith('/') ? path : `/${path}`
  if (base) return `${base.replace(/\/$/, '')}${p}`
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${p}`
}

/**
 * Socket resiliente para o chat. Imita o WebSocket nativo o suficiente para os
 * consumidores atuais (send/close/readyState), acrescentando robustez de produção.
 */
export interface ReconnectingSocket {
  send: (data: string | Record<string, unknown>) => boolean
  close: () => void
  readonly readyState: number
}

export interface ReconnectingSocketOptions {
  /** Chamado a cada mensagem recebida do servidor. */
  onMessage: (event: MessageEvent) => void
  /** Chamado quando a conexão abre. */
  onOpen?: () => void
  /** Notifica mudanças de conectividade (true = conectado). */
  onStatusChange?: (connected: boolean) => void
  /** Intervalo do heartbeat de aplicação, em ms. Padrão: 25s. */
  heartbeatMs?: number
  /** Teto do backoff de reconexão, em ms. Padrão: 30s. */
  maxReconnectDelayMs?: number
}

/**
 * Cria um WebSocket resiliente para o chat:
 *  - reconexão automática com backoff exponencial + jitter (após queda de rede,
 *    restart do backend, ou sleep/wake do dispositivo);
 *  - heartbeat de aplicação ({"type":"ping"}) para não morrer em timeouts de
 *    proxy/idle — o backend ignora mensagens sem `conversa_id`+`conteudo`, então
 *    o ping é inofensivo e não exige mudança no servidor;
 *  - teardown limpo via close(): cancela timers e NÃO reconecta.
 */
export function createReconnectingSocket(
  path: string,
  opts: ReconnectingSocketOptions,
): ReconnectingSocket {
  const heartbeatMs = opts.heartbeatMs ?? 25000
  const maxDelay = opts.maxReconnectDelayMs ?? 30000

  let ws: WebSocket | null = null
  let closedByUser = false
  let attempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* ignora */ }
      }
    }, heartbeatMs)
  }

  const scheduleReconnect = () => {
    if (closedByUser || reconnectTimer !== null) return
    attempt += 1
    const capped = Math.min(1000 * 2 ** (attempt - 1), maxDelay)
    const delay = capped / 2 + Math.random() * (capped / 2) // jitter evita thundering herd
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, delay)
  }

  const connect = () => {
    if (closedByUser) return
    let socket: WebSocket
    try {
      socket = new WebSocket(wsUrl(path))
    } catch {
      scheduleReconnect()
      return
    }
    ws = socket
    socket.onopen = () => {
      attempt = 0
      startHeartbeat()
      opts.onStatusChange?.(true)
      opts.onOpen?.()
    }
    socket.onmessage = (event) => opts.onMessage(event)
    socket.onclose = () => {
      stopHeartbeat()
      opts.onStatusChange?.(false)
      scheduleReconnect()
    }
    socket.onerror = () => { try { socket.close() } catch { /* onclose reconecta */ } }
  }

  connect()

  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data))
        return true
      }
      return false
    },
    close: () => {
      closedByUser = true
      if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null }
      stopHeartbeat()
      try { ws?.close() } catch { /* noop */ }
      ws = null
    },
    get readyState() {
      return ws ? ws.readyState : WebSocket.CLOSED
    },
  }
}
