import React, { useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

interface SliderProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  /** Valor já formatado, exibido ao lado do rótulo. */
  valorTexto?: string
  label?: string
  minTexto?: string
  maxTexto?: string
  containerStyle?: StyleProp<ViewStyle>
}

const ALTURA_TRILHO = 6
const POLEGAR = 24

/** Só a partir daqui o movimento conta como arrasto, e não como toque. */
const FOLGA_ARRASTO = 6

/**
 * Slider de valor único em RN puro (responder da própria `View`) — sem módulo
 * nativo, para não exigir novo build do dev client.
 *
 * Convive com o `ScrollView` do Sheet: aceita o toque, mas só segura o gesto
 * depois de um arrasto horizontal de verdade; enquanto isso o pai pode assumir
 * e rolar a tela normalmente (padrão nº "responder" do BUGS.md).
 */
export function Slider({
  min, max, step, value, onChange, valorTexto, label, minTexto, maxTexto, containerStyle,
}: SliderProps) {
  const { colors } = useTheme()
  const [largura, setLargura] = useState(0)
  const [inicioX, setInicioX] = useState(0)
  const [arrastando, setArrastando] = useState(false)

  function emitir(x: number) {
    if (largura <= 0) return
    const razao = Math.min(1, Math.max(0, x / largura))
    const bruto = min + razao * (max - min)
    const passo = Math.min(max, Math.max(min, Math.round(bruto / step) * step))
    if (passo !== value) onChange(passo)
  }

  const razao = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label || valorTexto ? (
        <View style={styles.topo}>
          {label ? <Txt variant="captionMedium" color="textDim">{label}</Txt> : <View />}
          {valorTexto ? (
            <Txt variant="captionMedium" style={{ color: colors.primary }}>{valorTexto}</Txt>
          ) : null}
        </View>
      ) : null}

      <View
        style={styles.area}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: valorTexto }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => setInicioX(e.nativeEvent.locationX)}
        // Enquanto for só toque, o ScrollView do sheet pode levar o gesto embora;
        // depois que o arrasto horizontal começou, ele é nosso.
        onResponderTerminationRequest={() => !arrastando}
        onResponderTerminate={() => setArrastando(false)}
        onResponderMove={(e) => {
          const x = e.nativeEvent.locationX
          if (!arrastando && Math.abs(x - inicioX) < FOLGA_ARRASTO) return
          if (!arrastando) setArrastando(true)
          emitir(x)
        }}
        onResponderRelease={(e) => {
          // Toque simples também posiciona — sem isto o usuário teria que arrastar.
          emitir(e.nativeEvent.locationX)
          setArrastando(false)
        }}
      >
        <View
          style={[styles.trilho, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        >
          <View
            style={[styles.preenchido, { backgroundColor: colors.primary, width: `${razao * 100}%` }]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.polegar,
            {
              backgroundColor: colors.primary,
              borderColor: colors.surface,
              left: `${razao * 100}%`,
              marginLeft: -POLEGAR / 2,
            },
          ]}
        />
      </View>

      {minTexto || maxTexto ? (
        <View style={styles.topo}>
          <Txt variant="caption" color="textMuted">{minTexto ?? ''}</Txt>
          <Txt variant="caption" color="textMuted">{maxTexto ?? ''}</Txt>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Altura confortável para o dedo, com o trilho centralizado dentro dela.
  area: { height: 40, justifyContent: 'center' },
  trilho: {
    height: ALTURA_TRILHO,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  preenchido: { height: '100%', borderRadius: radius.full },
  polegar: {
    position: 'absolute',
    width: POLEGAR,
    height: POLEGAR,
    borderRadius: radius.full,
    borderWidth: 3,
  },
})
