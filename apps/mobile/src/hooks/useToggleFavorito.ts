// Alterna favorito com atualização otimista: o coração muda de estado na hora,
// sem esperar o round-trip nem refazer o feed inteiro. Em caso de erro, reverte.

import { useQueryClient } from '@tanstack/react-query'
import { vitrineService } from '../services'
import { useGateLogin } from './useGateLogin'
import type { AnuncioVitrine } from '../services/types'

/** Aplica o novo estado de favorito em qualquer cache ['vitrine', ...] que contenha o anúncio. */
function patchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  favoritado: boolean,
) {
  queryClient.setQueriesData({ queryKey: ['vitrine'] }, (old: unknown) => {
    const aplicar = (a: AnuncioVitrine): AnuncioVitrine =>
      a.id !== id
        ? a
        : {
            ...a,
            favoritado_por_mim: favoritado,
            total_favoritos: Math.max(0, a.total_favoritos + (favoritado ? 1 : -1)),
          }
    if (Array.isArray(old)) return old.map(aplicar)
    if (old && typeof old === 'object' && 'id' in old) return aplicar(old as AnuncioVitrine)
    return old
  })
}

export function useToggleFavorito() {
  const queryClient = useQueryClient()
  const comLogin = useGateLogin()

  /** Alterna o favorito do anúncio, otimista. `favoritadoAgora` é o estado atual (do card). */
  return function toggleFavorito(id: string, favoritadoAgora: boolean) {
    comLogin('Entre para salvar seus favoritos.', async () => {
      patchCaches(queryClient, id, !favoritadoAgora) // otimista
      try {
        await vitrineService.alternarFavorito(id, favoritadoAgora)
        // Sincroniza a lista de favoritos (que pode ter ganho/perdido item) sem travar a UI.
        queryClient.invalidateQueries({ queryKey: ['vitrine', 'favoritos'] })
      } catch (e) {
        patchCaches(queryClient, id, favoritadoAgora) // reverte
        throw e
      }
    })
  }
}
