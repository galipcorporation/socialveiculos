import React, { useEffect, useRef } from 'react'
import {
  Animated, Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

interface SheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Altura máxima em fração da tela (0-1). */
  maxHeight?: number
  scrollable?: boolean
}

/** Bottom sheet base — backdrop com fade, painel com slide. */
export function Sheet({ visible, onClose, title, children, maxHeight = 0.85, scrollable = true }: SheetProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { height: alturaJanela } = useWindowDimensions()
  const slide = useRef(new Animated.Value(0)).current
  const [alturaTeclado, setAlturaTeclado] = React.useState(0)

  useEffect(() => {
    if (visible) {
      slide.setValue(0)
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start()
    }
  }, [visible, slide])

  // `statusBarTranslucent` desliga o adjustResize do Android dentro do Modal, então
  // medimos o teclado na mão e encolhemos só o teto do painel — o conteúdo continua
  // rolável em vez de ser esmagado (era o que sumia com o editor de contrato).
  useEffect(() => {
    const mostrar = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setAlturaTeclado(e.endCoordinates.height),
    )
    const esconder = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setAlturaTeclado(0),
    )
    return () => {
      mostrar.remove()
      esconder.remove()
    }
  }, [])

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height * 0.3, 0],
  })

  const Body = scrollable ? ScrollView : View

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.backdrop }]} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: colors.surfaceElevated,
                // Com teclado aberto o safe-area de baixo já está coberto por ele.
                paddingBottom: (alturaTeclado > 0 ? 0 : insets.bottom) + spacing.md,
                marginBottom: alturaTeclado,
                maxHeight: (alturaJanela - alturaTeclado) * (alturaTeclado > 0 ? 1 : maxHeight),
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.overlayStrong }]} />
            {title ? (
              <View style={styles.titleRow}>
                <Txt variant="title">{title}</Txt>
                <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: colors.overlaySoft }]}>
                  <Ionicons name="close" size={18} color={colors.textDim} />
                </Pressable>
              </View>
            ) : null}
            <Body
              {...(scrollable
                ? {
                    keyboardShouldPersistTaps: 'handled' as const,
                    showsVerticalScrollIndicator: true,
                    // O painel tem altura limitada (maxHeight): sem `flexShrink` o
                    // ScrollView pede a altura toda do conteúdo e o corte acontece
                    // fora da área rolável, deixando o fim do formulário inalcançável.
                    style: { flexShrink: 1 },
                    // Padding vai no CONTENT, não no frame: em `style` ele entra na
                    // conta da viewport e não na do conteúdo, bagunçando a extensão
                    // do scroll. Todo o resto do app já usa contentContainerStyle.
                    contentContainerStyle: { paddingHorizontal: spacing.md },
                  }
                : { style: { paddingHorizontal: spacing.md } })}
            >
              {children}
            </Body>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export interface SheetOption<T extends string = string> {
  value: T
  label: string
  sublabel?: string
  icon?: keyof typeof Ionicons.glyphMap
  tone?: string
}

interface OptionSheetProps<T extends string> {
  visible: boolean
  onClose: () => void
  title: string
  options: SheetOption<T>[]
  selected?: T
  onSelect: (value: T) => void
  /** Exibe campo de busca no topo — para listas longas (marcas/modelos FIPE). */
  buscavel?: boolean
  buscaPlaceholder?: string
  /** Mostra "Carregando…" no lugar da lista. */
  carregando?: boolean
  /** Texto quando não há nenhuma opção. */
  vazioTexto?: string
  /**
   * Permite aproveitar o texto digitado que não casa com nenhuma opção — ex.: vender
   * para um comprador que ainda não está na carteira. Recebe o termo já trimado.
   */
  onUsarBusca?: (texto: string) => void
  /** Rótulo do botão de `onUsarBusca`. Recebe o termo digitado. */
  usarBuscaLabel?: (texto: string) => string
}

/** Seletor de opções em bottom sheet — substituto mobile do <select>. */
export function OptionSheet<T extends string>({
  visible, onClose, title, options, selected, onSelect,
  buscavel, buscaPlaceholder = 'Buscar…', carregando, vazioTexto = 'Nenhuma opção disponível.',
  onUsarBusca, usarBuscaLabel = (t) => `Usar “${t}”`,
}: OptionSheetProps<T>) {
  const { colors } = useTheme()
  const [busca, setBusca] = React.useState('')

  // Cada abertura começa com a lista inteira.
  useEffect(() => { if (visible) setBusca('') }, [visible])

  const filtradas = React.useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.sublabel ?? ''}`.toLowerCase().includes(q))
  }, [options, busca])

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {buscavel ? (
        <View
          style={[styles.buscaWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={buscaPlaceholder}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            style={[styles.buscaInput, { color: colors.text }]}
          />
          {busca ? (
            <Pressable onPress={() => setBusca('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {carregando ? (
        <View style={styles.optionEstado}>
          <Txt variant="body" color="textDim">Carregando…</Txt>
        </View>
      ) : filtradas.length === 0 ? (
        <View style={styles.optionEstado}>
          <Txt variant="body" color="textDim" align="center">
            {busca.trim() ? 'Nada encontrado para esta busca.' : vazioTexto}
          </Txt>
          {onUsarBusca && busca.trim() ? (
            <Pressable
              onPress={() => {
                onUsarBusca(busca.trim())
                onClose()
              }}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: pressed ? colors.overlaySoft : colors.primary + '1c', marginTop: spacing.sm },
              ]}
            >
              <Ionicons name="add-circle-outline" size={19} color={colors.primary} />
              <Txt variant="bodyMedium" color="primaryText">{usarBuscaLabel(busca.trim())}</Txt>
            </Pressable>
          ) : null}
        </View>
      ) : (
      <View style={{ gap: 4, paddingBottom: spacing.xs }}>
        {filtradas.map((opt) => {
          const ativo = opt.value === selected
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                onSelect(opt.value)
                onClose()
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: ativo
                    ? colors.primary + '1c'
                    : pressed
                      ? colors.overlaySoft
                      : 'transparent',
                },
              ]}
            >
              {opt.icon ? (
                <Ionicons name={opt.icon} size={19} color={ativo ? colors.primary : colors.textDim} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Txt variant="bodyMedium" color={ativo ? 'primaryText' : 'text'}>
                  {opt.label}
                </Txt>
                {opt.sublabel ? (
                  <Txt variant="caption" color="textDim">{opt.sublabel}</Txt>
                ) : null}
              </View>
              {ativo ? <Ionicons name="checkmark" size={19} color={colors.primary} /> : null}
            </Pressable>
          )
        })}
      </View>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 42,
    marginBottom: spacing.xs,
  },
  buscaInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    paddingVertical: 8,
  },
  optionEstado: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    minHeight: 50,
  },
})
