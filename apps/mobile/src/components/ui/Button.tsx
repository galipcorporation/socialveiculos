import React, { useRef } from 'react'
import {
  ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

type Variant = 'primary' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  title: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  icon?: keyof typeof Ionicons.glyphMap
  loading?: boolean
  disabled?: boolean
  full?: boolean
  style?: StyleProp<ViewStyle>
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 46, lg: 52 }
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 }

export function Button({
  title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full, style,
}: ButtonProps) {
  const { colors } = useTheme()
  const scale = useRef(new Animated.Value(1)).current

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    tonal: { bg: colors.overlay, fg: colors.text },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderHover },
    ghost: { bg: 'transparent', fg: colors.primaryText },
    danger: { bg: colors.error, fg: '#ffffff' },
    success: { bg: colors.success, fg: colors.bg === '#121315' ? '#0c2912' : '#ffffff' },
  }
  const p = palette[variant]
  const inactive = disabled || loading

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start()

  return (
    <Animated.View style={[{ transform: [{ scale }] }, full && { alignSelf: 'stretch' }, style]}>
      <Pressable
        onPress={() => {
          if (inactive) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          onPress?.()
        }}
        onPressIn={() => !inactive && animate(0.96)}
        onPressOut={() => animate(1)}
        disabled={inactive}
        style={[
          styles.base,
          {
            height: HEIGHT[size],
            backgroundColor: p.bg,
            borderWidth: p.border ? 1 : 0,
            borderColor: p.border,
            opacity: inactive ? 0.55 : 1,
            paddingHorizontal: size === 'sm' ? spacing.sm : spacing.lg,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={p.fg} />
        ) : (
          <View style={styles.content}>
            {icon ? <Ionicons name={icon} size={FONT[size] + 3} color={p.fg} /> : null}
            <Txt
              style={{ fontFamily: fonts.semibold, fontSize: FONT[size], color: p.fg }}
              numberOfLines={1}
            >
              {title}
            </Txt>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
