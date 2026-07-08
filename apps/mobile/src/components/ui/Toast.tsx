import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

type ToastType = 'success' | 'error' | 'info'

interface ToastContextValue {
  show: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let toastSeq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (type: ToastType, message: string) => {
      if (timer.current) clearTimeout(timer.current)
      setToast({ id: ++toastSeq, type, message })
      Haptics.notificationAsync(
        type === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : type === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning
      ).catch(() => {})
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setToast(null)
        )
      }, 2600)
    },
    [opacity]
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <ToastView toast={toast} opacity={opacity} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, opacity }: { toast: ToastItem; opacity: Animated.Value }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const cfg = {
    success: { icon: 'checkmark-circle' as const, cor: colors.success },
    error: { icon: 'alert-circle' as const, cor: colors.error },
    info: { icon: 'information-circle' as const, cor: colors.info },
  }[toast.type]

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.cor} />
        <Txt style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text, flexShrink: 1 }}>
          {toast.message}
        </Txt>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
})
