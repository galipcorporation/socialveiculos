// Gate de login do comprador: se não autenticado como cliente, abre o LoginSheet
// (com a ação pendente) e retorna false. Autenticado → true, executa direto.

import { useAuthStore } from '../stores/authStore'
import { useLoginGateStore } from '../stores/loginGateStore'

export function useGateLogin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const abrir = useLoginGateStore((s) => s.abrir)

  /** Executa `acao` se logado; senão abre o gate e adia a ação para depois do login. */
  return function comLogin(motivo: string, acao: () => void): boolean {
    if (isAuthenticated) {
      acao()
      return true
    }
    abrir(motivo, acao)
    return false
  }
}
