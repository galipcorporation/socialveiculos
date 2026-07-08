import React from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'
import { iniciais } from '../../lib/format'

const AVATAR_CORES = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#db2777']

interface AvatarProps {
  nome?: string | null
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Avatar por iniciais — cor estável derivada do nome. */
export function Avatar({ nome, size = 40, style }: AvatarProps) {
  const hash = [...(nome ?? '?')].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const cor = AVATAR_CORES[hash % AVATAR_CORES.length]
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: cor + '2b',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Txt style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: cor }}>
        {iniciais(nome)}
      </Txt>
    </View>
  )
}

interface FabProps {
  icon?: keyof typeof Ionicons.glyphMap
  label?: string
  onPress: () => void
}

/** Botão flutuante — ação principal da tela, acima da tab bar. */
export function Fab({ icon = 'add', label, onPress }: FabProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        onPress()
      }}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          bottom: insets.bottom + spacing.md,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          paddingHorizontal: label ? 18 : 0,
          width: label ? undefined : 56,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.onPrimary} />
      {label ? (
        <Txt style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.onPrimary }}>{label}</Txt>
      ) : null}
    </Pressable>
  )
}

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  icon: keyof typeof Ionicons.glyphMap
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  loading?: boolean
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}

/** Cartão de indicador (KPI) — usado no Dashboard e Financeiro. */
export function KpiCard({ label, value, hint, icon, tone = 'primary', loading, style, onPress }: KpiCardProps) {
  const { colors, dark } = useTheme()
  const toneMap = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    neutral: colors.textDim,
  }
  const cor = toneMap[tone]
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.kpi,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
        !dark && styles.kpiShadow,
        style,
      ]}
    >
      <View style={[styles.kpiIcon, { backgroundColor: cor + '1c' }]}>
        <Ionicons name={icon} size={17} color={cor} />
      </View>
      <Txt variant="label" color="textDim" style={{ textTransform: 'uppercase' }} numberOfLines={1}>
        {label}
      </Txt>
      <Txt
        style={{ fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 26, color: colors.text }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {loading ? '—' : value}
      </Txt>
      {hint ? (
        <Txt variant="caption" color="textMuted" numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  kpi: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 3,
    minWidth: 150,
  },
  kpiShadow: {
    shadowColor: '#0f1f38',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
})
