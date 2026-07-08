import React from 'react'
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipsRow, style]}
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
  chipsRow: { gap: spacing.xs, paddingVertical: 2 },
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
