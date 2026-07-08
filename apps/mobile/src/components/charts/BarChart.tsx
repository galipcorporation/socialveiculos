import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import { Txt } from '../ui/Txt'

interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  /** Formata o valor exibido no rótulo (ex.: unidades, R$). */
  formatValue?: (v: number) => string
}

/**
 * Barras de série única — marca fina, topo arredondado (data-end), base plana.
 * Meses passados em tom suave; o último período (atual) em cor cheia com rótulo
 * direto. Tocar numa barra seleciona e mostra o valor (tooltip mobile).
 */
export function BarChart({ data, height = 140, formatValue = String }: BarChartProps) {
  const { colors } = useTheme()
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const areaBarras = height - 34 // espaço p/ rótulo em cima e label embaixo

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height }}>
      {data.map((d, i) => {
        const ultimo = i === data.length - 1
        const ativo = selecionado === i || (selecionado === null && ultimo)
        const alturaBarra = Math.max(4, (d.value / max) * areaBarras)
        return (
          <Pressable
            key={`${d.label}-${i}`}
            onPress={() => setSelecionado(selecionado === i ? null : i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}
          >
            <View style={{ height: 18, justifyContent: 'flex-end' }}>
              {ativo && (
                <Txt style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.text }}>
                  {formatValue(d.value)}
                </Txt>
              )}
            </View>
            <View
              style={{
                width: '62%',
                maxWidth: 34,
                height: alturaBarra,
                backgroundColor: ativo ? colors.primary : colors.primary + '55',
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              }}
            />
            <Txt
              variant="caption"
              color={ativo ? 'textDim' : 'textMuted'}
              style={{ marginTop: 6, fontSize: 11 }}
            >
              {d.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}
