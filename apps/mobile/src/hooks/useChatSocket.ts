// apps/mobile/src/hooks/useChatSocket.ts
// Liga o mobile aos WebSockets de chat do backend (/v1/b2b/chat/ws e
// /v1/vitrine/chat/ws). Sem isso as telas só buscavam mensagens ao montar,
// e uma resposta do outro lado só aparecia ao sair e voltar da conversa.
//
// O backend faz broadcast do objeto de mensagem cru (sem envelope de tipo)
// para todos os participantes da conversa — inclusive quem enviou.
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { createReconnectingSocket, type ReconnectingSocket } from '../lib/ws'
import { useAuthStore } from '../stores/authStore'
import type { Mensagem } from '../services/types'

/** Payload transmitido por manager.broadcast_to_conversation (b2b.py / vitrine_interativo.py). */
interface MensagemBroadcast {
  id: string
  conversa_id: string
  autor_id?: string | null
  autor_nome?: string | null
  conteudo: string
  lida?: boolean
  created_at?: string | null
}

function ehMensagem(v: unknown): v is MensagemBroadcast {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return typeof m.id === 'string' && typeof m.conversa_id === 'string' && typeof m.conteudo === 'string'
}

export type CanalChat = 'b2b' | 'vitrine'

interface UseChatSocketOptions {
  /** Canal do backend: 'b2b' (loja↔loja) ou 'vitrine' (loja↔cliente). */
  canal: CanalChat
  /**
   * Chave da query de mensagens da conversa aberta. Quando informada, a
   * mensagem recebida entra direto na lista, sem ida ao servidor.
   */
  chaveMensagens?: readonly unknown[]
  /** Conversa aberta na tela; mensagens de outras conversas só invalidam a lista. */
  conversaId?: string
  /** Chaves invalidadas a cada mensagem (listas de conversas, badges). */
  chavesInvalidar?: readonly (readonly unknown[])[]
  /** Como o autor da mensagem recebida deve ser exibido nesta tela. */
  autorRemoto?: Mensagem['autor']
  autorProprio?: Mensagem['autor']
  enabled?: boolean
}

/**
 * Mantém uma conexão WebSocket viva enquanto a tela está montada e o app em
 * primeiro plano, aplicando as mensagens recebidas no cache do react-query.
 */
export function useChatSocket({
  canal,
  chaveMensagens,
  conversaId,
  chavesInvalidar,
  autorRemoto = 'cliente',
  autorProprio = 'loja',
  enabled = true,
}: UseChatSocketOptions): void {
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const usuarioId = useAuthStore((s) => s.user?.id)

  // Refs para não derrubar e reabrir o socket a cada render da tela.
  const optsRef = useRef({ chaveMensagens, conversaId, chavesInvalidar, autorRemoto, autorProprio, usuarioId })
  useEffect(() => {
    optsRef.current = { chaveMensagens, conversaId, chavesInvalidar, autorRemoto, autorProprio, usuarioId }
  })

  useEffect(() => {
    if (!enabled || !token) return

    let sock: ReconnectingSocket | null = null

    const abrir = () => {
      if (sock) return
      sock = createReconnectingSocket(`/v1/${canal}/chat/ws?token=${encodeURIComponent(token)}`, {
        onMessage: (event) => {
          let payload: unknown
          try {
            payload = JSON.parse(String((event as MessageEvent).data))
          } catch {
            return
          }
          if (!ehMensagem(payload)) return

          const o = optsRef.current
          const propria = !!payload.autor_id && payload.autor_id === o.usuarioId
          const nova: Mensagem = {
            id: payload.id,
            conversa_id: payload.conversa_id,
            autor: propria ? o.autorProprio : o.autorRemoto,
            texto: payload.conteudo,
            created_at: payload.created_at ?? new Date().toISOString(),
            lida: payload.lida ?? false,
          }

          if (o.chaveMensagens && payload.conversa_id === o.conversaId) {
            queryClient.setQueryData<Mensagem[]>(o.chaveMensagens, (velho) => {
              const lista = velho ?? []
              if (lista.some((m) => m.id === nova.id)) return lista
              // Envio otimista já pintou a bolha com id temporário: troca pelo
              // registro real em vez de duplicar a mensagem na tela.
              if (propria) {
                const idx = lista.findIndex((m) => m.id.startsWith('tmp-') && m.texto === nova.texto)
                if (idx >= 0) {
                  const copia = [...lista]
                  copia[idx] = nova
                  return copia
                }
              }
              return [...lista, nova]
            })
          }

          for (const chave of o.chavesInvalidar ?? []) {
            queryClient.invalidateQueries({ queryKey: chave as unknown[] })
          }
        },
      })
    }

    const fechar = () => {
      sock?.close()
      sock = null
    }

    abrir()

    // Em background o SO derruba o socket; ao voltar, reconecta e sincroniza o
    // que chegou enquanto o app esteve fora.
    const onAppState = (estado: AppStateStatus) => {
      if (estado === 'active') {
        abrir()
        const o = optsRef.current
        if (o.chaveMensagens) queryClient.invalidateQueries({ queryKey: o.chaveMensagens as unknown[] })
        for (const chave of o.chavesInvalidar ?? []) {
          queryClient.invalidateQueries({ queryKey: chave as unknown[] })
        }
      } else {
        fechar()
      }
    }
    const sub = AppState.addEventListener('change', onAppState)

    return () => {
      sub.remove()
      fechar()
    }
  }, [canal, token, enabled, queryClient])
}
