import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Loja que o admin de plataforma (suporte) escolheu operar no momento.
 * Enviada como header X-Loja-Id em toda request (ver lib/api.ts).
 * Gestores/vendedores não usam este store — o backend ignora o header para eles.
 */
interface LojaAtivaState {
  lojaId: string | null
  lojaNome: string | null
  setLoja: (id: string, nome: string) => void
  limpar: () => void
}

export const useLojaAtivaStore = create<LojaAtivaState>()(
  persist(
    (set) => ({
      lojaId: null,
      lojaNome: null,
      setLoja: (lojaId, lojaNome) => set({ lojaId, lojaNome }),
      limpar: () => set({ lojaId: null, lojaNome: null }),
    }),
    { name: 'sv-loja-ativa' }
  )
)
