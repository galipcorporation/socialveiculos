// apps/mobile/src/lib/ws.ts
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'

function deriveWsBase(): string {
  const explicit = process.env.EXPO_PUBLIC_WS_URL
  if (explicit) return explicit.replace(/\/$/, '')
  return API_BASE.replace(/^http/, 'ws').replace(/\/v1$/, '')
}

export function wsUrl(path: string): string {
  const base = deriveWsBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export interface ReconnectingSocket {
  send: (data: string | Record<string, unknown>) => boolean
  close: () => void
  readonly readyState: number
}

export interface ReconnectingSocketOptions {
  onMessage: (event: MessageEvent) => void
  onOpen?: () => void
  onStatusChange?: (connected: boolean) => void
  heartbeatMs?: number
  maxReconnectDelayMs?: number
}

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
    const delay = capped / 2 + Math.random() * (capped / 2)
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
