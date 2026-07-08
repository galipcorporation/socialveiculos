// apps/mobile/src/stores/lojaAtivaStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
    {
      name: 'sv-loja-ativa',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
