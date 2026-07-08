import React from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  padded?: boolean
}

export function Card({ children, onPress, style, padded = true }: CardProps) {
  const { colors, dark } = useTheme()
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark
      ? {}
      : {
          shadowColor: '#0f1f38',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 1,
        }),
  }
  if (!onPress) {
    return <View style={[base, padded && styles.padded, style]}>{children}</View>
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        padded && styles.padded,
        pressed && { backgroundColor: colors.surfaceElevated, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  iconBg?: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  chevron?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/** Linha de lista padrão (menu Mais, configurações, itens simples). */
export function ListRow({ icon, iconColor, iconBg, title, subtitle, right, chevron, onPress, style }: ListRowProps) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.overlaySoft },
        style,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg ?? colors.overlaySoft }]}>
          <Ionicons name={icon} size={19} color={iconColor ?? colors.textDim} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyMedium" numberOfLines={1}>{title}</Txt>
        {subtitle ? (
          <Txt variant="caption" color="textDim" numberOfLines={1} style={{ marginTop: 1 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  padded: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
