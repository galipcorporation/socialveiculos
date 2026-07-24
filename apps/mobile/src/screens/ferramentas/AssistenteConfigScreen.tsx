import React, { useEffect, useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { AppHeader, Button, FilterChips, Paywall, Screen, SkeletonCard, Txt, useToast } from '../../components/ui'
import { assistenteService, modulosService, TONS_ASSISTENTE } from '../../services'
import type { TomAssistente } from '../../services/assistente'
import { formatData } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

export default function AssistenteConfigScreen({ navigation }: RootScreenProps<'AssistenteConfig'>) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const gateQ = useQuery({ queryKey: ['modulo', 'assistente_ia'], queryFn: () => modulosService.liberado('assistente_ia') })
  const liberado = gateQ.data === true

  const q = useQuery({
    queryKey: ['assistente', 'config'],
    queryFn: () => assistenteService.config(),
    enabled: liberado,
  })

  const [tom, setTom] = useState<TomAssistente>('amigavel')
  const [voz, setVoz] = useState(false)

  useEffect(() => {
    if (q.data) { setTom(q.data.tom); setVoz(q.data.consentimento_voz) }
  }, [q.data])

  const salvarMut = useMutation({
    mutationFn: () => assistenteService.salvarConfig(tom, voz),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistente', 'config'] })
      toast.show('success', 'Configurações salvas.')
      navigation.goBack()
    },
    onError: (e: Error) => toast.show('error', e.message || 'Não foi possível salvar.'),
  })

  const vozConfigurada = !!q.data?.audio_url && voz

  if (gateQ.isLoading) {
    return (
      <Screen padded={false}>
        <AppHeader title="Configurar IA" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen padded={false}>
        <AppHeader title="Configurar IA" large={false} back />
        <Screen padded>
          <Paywall
            titulo="Assistente do Vendedor (IA)"
            descricao="Copiloto de WhatsApp: a IA lê as conversas dos seus leads e sugere respostas prontas para você aprovar e enviar — inclusive por áudio na sua voz. Módulo não incluído no plano atual."
          />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen padded={false}>
      <AppHeader title="Configurar IA" large={false} back />
      {q.isLoading ? (
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      ) : (
        <View style={{ padding: spacing.md, gap: spacing.lg }}>
          <View>
            <Txt variant="label" color="textMuted" style={{ marginBottom: spacing.xs }}>TOM DAS RESPOSTAS</Txt>
            <FilterChips
              options={TONS_ASSISTENTE.map((t) => ({ value: t.value, label: t.label }))}
              selected={tom}
              onSelect={setTom}
            />
          </View>

          <View>
            <Txt variant="label" color="textMuted" style={{ marginBottom: spacing.xs }}>VOZ CLONADA (ÁUDIO)</Txt>
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold">Responder com minha voz</Txt>
                <Txt variant="caption" color="textDim" style={{ marginTop: 4, lineHeight: 18 }}>
                  Permite enviar as sugestões como nota de voz sintetizada na sua voz.
                </Txt>
              </View>
              <Switch
                value={voz}
                onValueChange={setVoz}
                trackColor={{ false: colors.overlayStrong, true: colors.success }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.lgpd, { backgroundColor: colors.overlaySoft }]}>
              <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
              <Txt variant="caption" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
                LGPD: ao ativar, você autoriza o uso da sua voz gravada para sintetizar áudios. O treino da voz (upload de amostra) é feito no computador. Pode revogar a qualquer momento — a voz é apagada.
              </Txt>
            </View>
          </View>

          {q.data?.audio_url ? (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold" style={{ color: vozConfigurada ? colors.success : colors.textDim }}>
                  {vozConfigurada ? '✓ Voz configurada' : 'Voz desativada'}
                </Txt>
                {q.data.consentimento_timestamp ? (
                  <Txt variant="caption" color="textDim" style={{ marginTop: 4 }}>
                    Autorizado em {formatData(q.data.consentimento_timestamp)}
                  </Txt>
                ) : null}
              </View>
            </View>
          ) : null}

          <Button title="Salvar configurações" onPress={() => salvarMut.mutate()} loading={salvarMut.isPending} full />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  lgpd: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
})
