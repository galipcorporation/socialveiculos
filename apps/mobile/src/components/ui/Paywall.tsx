import React from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import { Card } from './Card'
import { Txt } from './Txt'

/** Estado bloqueado por módulo pago não liberado — CTA honesto, sem ação fake. */
export function Paywall({ titulo, descricao }: { titulo: string; descricao: string }) {
  const { colors } = useTheme()
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: colors.primary + '1c',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="diamond-outline" size={30} color={colors.primary} />
      </View>
      <Txt variant="title" align="center">{titulo}</Txt>
      <Txt variant="caption" color="textDim" align="center">{descricao}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs }}>
        <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
        <Txt variant="caption" color="textMuted">Recurso Premium — fale com o suporte para liberar</Txt>
      </View>
    </Card>
  )
}
