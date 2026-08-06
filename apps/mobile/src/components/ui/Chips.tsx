import React, { useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

export interface ChipOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

interface FilterChipsProps<T extends string> {
  options: ChipOption<T>[]
  selected: T
  onSelect: (value: T) => void
  style?: StyleProp<ViewStyle>
}

/** Chips horizontais de filtro — padrão de segmentação das listas. */
export function FilterChips<T extends string>({ options, selected, onSelect, style }: FilterChipsProps<T>) {
  const { colors } = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const [scrollX, setScrollX] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [layoutWidth, setLayoutWidth] = useState(0)

  const canScrollRight = contentWidth > layoutWidth + 5 && scrollX < contentWidth - layoutWidth - 10
  const canScrollLeft = scrollX > 10

  const handleScrollRight = () => {
    Haptics.selectionAsync().catch(() => {})
    scrollRef.current?.scrollTo({ x: scrollX + 160, animated: true })
  }

  const handleScrollLeft = () => {
    Haptics.selectionAsync().catch(() => {})
    scrollRef.current?.scrollTo({ x: Math.max(0, scrollX - 160), animated: true })
  }

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      {canScrollLeft && (
        <Pressable
          onPress={handleScrollLeft}
          style={[
            styles.arrowButton,
            styles.arrowLeft,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Rolar para esquerda"
        >
          <Ionicons name="chevron-back" size={13} color={colors.text} />
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        onContentSizeChange={(w) => setContentWidth(w)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.chipsRow,
          style,
          canScrollLeft && { paddingLeft: spacing.lg },
          canScrollRight && { paddingRight: spacing.lg },
        ]}
      >
        {options.map((opt) => {
          const ativo = opt.value === selected
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (!ativo) Haptics.selectionAsync().catch(() => {})
                onSelect(opt.value)
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: ativo ? colors.primary : colors.surface,
                  borderColor: ativo ? colors.primary : colors.border,
                },
              ]}
            >
              <Txt
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  color: ativo ? colors.onPrimary : colors.textDim,
                }}
              >
                {opt.label}
              </Txt>
              {opt.count != null && (
                <View
                  style={[
                    styles.count,
                    { backgroundColor: ativo ? 'rgba(255,255,255,0.25)' : colors.overlay },
                  ]}
                >
                  <Txt
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 11,
                      color: ativo ? colors.onPrimary : colors.textDim,
                    }}
                  >
                    {opt.count}
                  </Txt>
                </View>
              )}
            </Pressable>
          )
        })}
      </ScrollView>

      {canScrollRight && (
        <Pressable
          onPress={handleScrollRight}
          style={[
            styles.arrowButton,
            styles.arrowRight,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Rolar para direita"
        >
          <Ionicons name="chevron-forward" size={13} color={colors.text} />
        </Pressable>
      )}
    </View>
  )
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  selected: T
  onSelect: (value: T) => void
  style?: StyleProp<ViewStyle>
}

/** Controle segmentado (2-3 opções fixas, largura total). */
export function SegmentedControl<T extends string>({ options, selected, onSelect, style }: SegmentedProps<T>) {
  const { colors } = useTheme()
  return (
    <View style={[styles.segmented, { backgroundColor: colors.overlaySoft, borderColor: colors.border }, style]}>
      {options.map((opt) => {
        const ativo = opt.value === selected
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.segment,
              ativo && { backgroundColor: colors.surface, ...shadow },
            ]}
          >
            <Txt
              style={{
                fontFamily: ativo ? fonts.semibold : fonts.medium,
                fontSize: 13,
                color: ativo ? colors.text : colors.textDim,
              }}
            >
              {opt.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  chipsRow: { gap: spacing.xs, paddingVertical: 2 },
  arrowButton: {
    position: 'absolute',
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  arrowLeft: {
    left: 0,
  },
  arrowRight: {
    right: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

