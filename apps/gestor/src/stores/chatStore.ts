import { create } from 'zustand'
import { api } from '../lib/api'

interface Conversa {
  id: string
  mensagens_nao_lidas?: number
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
      // Buscar B2B
      const b2bData = await api.get<Conversa[]>('/b2b/chat/conversas')
      const totalB2B = b2bData.reduce((acc, c) => acc + (c.mensagens_nao_lidas || 0), 0)

      // Buscar B2C
      const b2cData = await api.get<Conversa[]>('/vitrine/chat/conversas')
      const totalB2C = b2cData.reduce((acc, c) => acc + (c.mensagens_nao_lidas || 0), 0)

      set({ unreadB2B: totalB2B, unreadB2C: totalB2C })
    } catch (err) {
      console.error('[ChatStore] Erro ao buscar contagem de não lidas:', err)
    } finally {
      set({ loading: false })
    }
  }
}))
