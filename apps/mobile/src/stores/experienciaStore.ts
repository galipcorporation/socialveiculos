// apps/mobile/src/stores/experienciaStore.ts
// Modo de experiência do app: comprador (Vitrine B2C) x lojista (Gestor B2B).
// Escolhido no primeiro boot; trocável depois. Persistido.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Experiencia = 'comprador' | 'lojista'

interface ExperienciaState {
  experiencia: Experiencia | null
  hidratado: boolean
  escolher: (e: Experiencia) => void
  trocar: () => void
}

export const useExperienciaStore = create<ExperienciaState>()(
  persist(
    (set) => ({
      experiencia: null,
      hidratado: false,
      escolher: (experiencia) => set({ experiencia }),
      trocar: () => set({ experiencia: null }),
    }),
    {
      name: 'sv-experiencia',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.hidratado = true
      },
    },
  ),
)
