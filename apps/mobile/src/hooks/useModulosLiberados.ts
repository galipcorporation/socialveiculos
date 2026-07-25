// Fonte única do "este usuário pode ver este módulo?" no mobile.
//
// São dois gates independentes, e ambos precisam passar:
//   1. contratado — o ADMIN habilitou o módulo para a loja (assinatura em dia);
//   2. liberado ao membro — o GESTOR marcou o módulo para aquele vendedor.
//
// O núcleo (estoque/crm/financeiro) não é contratável, então só passa pelo (2).
// O gestor não passa pelo (2): enxerga tudo que a loja contratou.
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { MODULOS_BASE, parseModulos, type ModuloKey } from '../lib/modulos'
import { modulosService } from '../services'
import type { Modulo } from '../services/types'

export interface ModulosLiberados {
  /** true se o módulo deve aparecer para o usuário atual. */
  liberado: (chave: ModuloKey) => boolean
  /** O gate de contratação ainda está carregando (esconde em vez de piscar). */
  carregando: boolean
  gestor: boolean
}

export function useModulosLiberados(): ModulosLiberados {
  const user = useAuthStore((s) => s.user)
  const gestor = user?.papel === 'gestor'
  const doMembro = parseModulos(user?.modulos)

  const { data: contratados, isPending } = useQuery({
    queryKey: ['modulos'],
    queryFn: () => modulosService.todos(),
  })

  const contratado = (chave: ModuloKey): boolean => {
    if (MODULOS_BASE.includes(chave)) return true
    // Enquanto carrega, esconde: melhor o item aparecer um instante depois do
    // que piscar uma ferramenta que a loja não tem.
    if (!contratados) return false
    return contratados.some((m) => m.modulo === (chave as Modulo) && m.liberado)
  }

  return {
    liberado: (chave) => contratado(chave) && (gestor || doMembro.includes(chave)),
    carregando: isPending,
    gestor,
  }
}
