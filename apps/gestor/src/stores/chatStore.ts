import { create } from 'zustand'
import { api } from '../lib/api'

interface UnreadCountResponse {
  unread_b2b: number
  unread_b2c: number
}

interface ChatState {
  unreadB2B: number
  unreadB2C: number
  loading: boolean
  fetchUnreadCounts: () => Promise<void>
  setUnreadCounts: (b2b: number, b2c: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  unreadB2B: 0,
  unreadB2C: 0,
  loading: false,
  setUnreadCounts: (b2b, b2c) => set({ unreadB2B: b2b, unreadB2C: b2c }),
  fetchUnreadCounts: async () => {
    set({ loading: true })
    try {
      // Endpoint agregado (2 COUNTs no backend) — evita baixar as listas completas de conversas.
      const data = await api.get<UnreadCountResponse>('/b2b/chat/unread-count')
      set({ unreadB2B: data.unread_b2b, unreadB2C: data.unread_b2c })
    } catch (err) {
      console.error('[ChatStore] Erro ao buscar contagem de não lidas:', err)
    } finally {
      set({ loading: false })
    }
  }
}))
