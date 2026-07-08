import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'
import { Button } from './Button'

interface SkeletonProps {
  width?: DimensionValue
  height?: number
  round?: boolean
  style?: StyleProp<ViewStyle>
}

/** Bloco skeleton com pulso suave. */
export function Skeleton({ width = '100%', height = 16, round, style }: SkeletonProps) {
  const { colors } = useTheme()
  const pulse = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: round ? height / 2 : radius.sm,
          backgroundColor: colors.skeleton,
          opacity: pulse,
        },
        style,
      ]}
    />
  )
}

/** Skeleton de card de lista (foto + linhas) — usado em Estoque/CRM/Chat. */
export function SkeletonCard({ withImage = true }: { withImage?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {withImage && <Skeleton width={92} height={92} style={{ borderRadius: radius.md }} />}
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <Skeleton width="70%" height={15} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="55%" height={12} />
      </View>
    </View>
  )
}

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = 'file-tray-outline', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.overlaySoft }]}>
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
      <Txt variant="title" align="center">{title}</Txt>
      {subtitle ? (
        <Txt variant="caption" color="textDim" align="center" style={{ maxWidth: 280 }}>
          {subtitle}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="sm" style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Algo deu errado ao carregar os dados.', onRetry }: ErrorStateProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.error + '1a' }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.error} />
      </View>
      <Txt variant="title" align="center">Não foi possível carregar</Txt>
      <Txt variant="caption" color="textDim" align="center" style={{ maxWidth: 280 }}>
        {message}
      </Txt>
      {onRetry ? (
        <Button title="Tentar de novo" onPress={onRetry} variant="tonal" size="sm" icon="refresh" style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  )
}

interface ProgressBarProps {
  /** 0 a 1 */
  progress: number
  color?: string
  height?: number
  style?: StyleProp<ViewStyle>
}

export function ProgressBar({ progress, color, height = 6, style }: ProgressBarProps) {
  const { colors } = useTheme()
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, progress)), duration: 500, useNativeDriver: false }).start()
  }, [progress, anim])
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: colors.overlay, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? colors.primary,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  skeletonCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
})
