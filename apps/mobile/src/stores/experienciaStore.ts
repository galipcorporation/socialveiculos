// apps/mobile/src/stores/experienciaStore.ts
// Modo de experiência do app: comprador (Vitrine B2C) x lojista (Gestor B2B).
// Todo boot abre em 'comprador' (Vitrine); só troca para 'lojista' por ação
// explícita do usuário (pós-login como gestor/vendedor, ou via Perfil).

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Experiencia = 'comprador' | 'lojista'

interface ExperienciaState {
  experiencia: Experiencia
  hidratado: boolean
  escolher: (e: Experiencia) => void
  trocar: () => void
}

export const useExperienciaStore = create<ExperienciaState>()(
  persist(
    (set) => ({
      experiencia: 'comprador',
      hidratado: false,
      escolher: (experiencia) => set({ experiencia }),
      trocar: () => set({ experiencia: 'comprador' }),
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
