// Gate de login do comprador (M045 fase 2). Controla o LoginSheet global e
// executa a ação pendente após o login. Usado pelo hook useGateLogin.

import { create } from 'zustand'

interface LoginGateState {
  visivel: boolean
  motivo: string
  acaoPendente: (() => void) | null
  abrir: (motivo: string, acaoPendente?: () => void) => void
  fechar: () => void
  concluir: () => void
}

export const useLoginGateStore = create<LoginGateState>((set, get) => ({
  visivel: false,
  motivo: '',
  acaoPendente: null,
  abrir: (motivo, acaoPendente) => set({ visivel: true, motivo, acaoPendente: acaoPendente ?? null }),
  fechar: () => set({ visivel: false, acaoPendente: null }),
  concluir: () => {
    const acao = get().acaoPendente
    set({ visivel: false, acaoPendente: null })
    if (acao) acao()
  },
}))
