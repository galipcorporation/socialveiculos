import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '../../services/auth'
import { useAuthStore } from '../../stores/authStore'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { AssistiveTouch } from './AssistiveTouch'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { Txt } from './Txt'
import { useToast } from './Toast'

/**
 * Decide se o botão flutuante de ações rápidas aparece — e pergunta ao usuário
 * no primeiro acesso.
 *
 * A preferência é do USUÁRIO (coluna `usuario.botao_flutuante`), não do
 * aparelho: o mesmo celular de balcão é usado por vendedores diferentes, e cada
 * um encontra a sua escolha ao logar. Por isso a decisão não mora no
 * AsyncStorage.
 *
 * O modal só aparece enquanto `botao_flutuante_perguntar` for verdadeiro; o
 * checkbox "Não perguntar novamente" o desliga de vez.
 */
export function AssistiveTouchGate() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()
  const toast = useToast()

  // O usuário no store pode ter vindo de um login antigo, anterior a estes
  // campos. Buscar o /me garante a preferência atual antes de decidir qualquer
  // coisa — e é o mesmo cache que a tela de Perfil já usa.
  const meQ = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    staleTime: 5 * 60 * 1000,
  })
  const me = meQ.data

  useEffect(() => {
    if (me) setUser(me)
  }, [me, setUser])

  const [naoPerguntar, setNaoPerguntar] = useState(true)
  // Uma pergunta por sessão do app: responder ou fechar encerra o assunto até o
  // próximo início — sem isso um refetch do /me reabriria o sheet na cara do
  // usuário. A volta permanente é decidida pelo `botao_flutuante_perguntar`.
  const [encerrado, setEncerrado] = useState(false)
  const sheetVisivel = !encerrado && !!me && me.botao_flutuante_perguntar !== false

  const salvar = useMutation({
    mutationFn: authService.atualizarPreferencias,
    onSuccess: (atualizado) => {
      setUser(atualizado)
      queryClient.setQueryData(['auth', 'me'], atualizado)
    },
    onError: () => {
      toast.show('error', 'Não deu para salvar a preferência. Tente de novo em Configurações.')
    },
  })

  const responder = (querBotao: boolean) => {
    setEncerrado(true)
    // Aplica na hora no store: o botão some/aparece sem esperar a rede, e a
    // resposta do PATCH confirma (ou o toast avisa que não salvou).
    if (user) {
      setUser({
        ...user,
        botao_flutuante: querBotao,
        botao_flutuante_perguntar: !naoPerguntar,
      })
    }
    salvar.mutate({
      botao_flutuante: querBotao,
      botao_flutuante_perguntar: !naoPerguntar,
    })
  }

  // Sem resposta ainda (ou offline), mantém o comportamento de sempre: botão
  // visível. Só some quando a preferência diz explicitamente que não.
  const mostrarBotao = user?.botao_flutuante !== false

  return (
    <>
      {mostrarBotao ? <AssistiveTouch /> : null}
      <PerguntaBotaoFlutuante
        visible={sheetVisivel}
        naoPerguntar={naoPerguntar}
        onToggleNaoPerguntar={() => setNaoPerguntar((v) => !v)}
        onResponder={responder}
        // Fechar sem responder não grava nada: a pergunta volta no próximo
        // início do app, que é o combinado de quem não marcou o checkbox.
        onClose={() => setEncerrado(true)}
      />
    </>
  )
}

interface PerguntaProps {
  visible: boolean
  naoPerguntar: boolean
  onToggleNaoPerguntar: () => void
  onResponder: (querBotao: boolean) => void
  onClose: () => void
}

/** Modal de primeiro acesso: liga ou desliga o botão flutuante. */
function PerguntaBotaoFlutuante({
  visible,
  naoPerguntar,
  onToggleNaoPerguntar,
  onResponder,
  onClose,
}: PerguntaProps) {
  const { colors } = useTheme()

  return (
    <Sheet visible={visible} onClose={onClose} title="Botão de ações rápidas" scrollable={false}>
      <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
        {/* Prévia do que está sendo perguntado — sem isso o usuário precisa
            adivinhar qual botão é. */}
        <View style={[styles.previa, { backgroundColor: colors.overlaySoft, borderColor: colors.border }]}>
          <View style={[styles.botaoMock, { backgroundColor: colors.primary }]}>
            <Ionicons name="apps-sharp" size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyMedium">Atalho flutuante</Txt>
            <Txt variant="caption" color="textDim" style={{ lineHeight: 18 }}>
              Fica sobre as telas e abre contratos, FIPE, simulador, cadastro de veículo e mais.
              Você pode arrastá-lo para onde quiser.
            </Txt>
          </View>
        </View>

        <Txt variant="body" color="textDim" style={{ lineHeight: 20 }}>
          Quer manter esse botão na tela? Se preferir a tela limpa, é só desativar — todas as
          ferramentas continuam disponíveis em “Mais”.
        </Txt>

        <Pressable
          onPress={onToggleNaoPerguntar}
          hitSlop={6}
          style={({ pressed }) => [
            styles.checkboxRow,
            { backgroundColor: pressed ? colors.overlaySoft : 'transparent' },
          ]}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: naoPerguntar ? colors.primary : 'transparent',
                borderColor: naoPerguntar ? colors.primary : colors.borderHover,
              },
            ]}
          >
            {naoPerguntar ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
          </View>
          <Txt variant="body" style={{ flex: 1 }}>
            Não perguntar novamente
          </Txt>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <Button title="Sim, quero o botão" icon="checkmark-circle-outline" onPress={() => onResponder(true)} />
          <Button title="Não, prefiro sem" variant="tonal" onPress={() => onResponder(false)} />
        </View>

        <Txt variant="caption" color="textMuted" align="center">
          Dá para mudar quando quiser em Mais › Configurações › Aparência.
        </Txt>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  previa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  botaoMock: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderRadius: radius.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
