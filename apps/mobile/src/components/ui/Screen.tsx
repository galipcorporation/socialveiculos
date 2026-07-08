import React from 'react'
import {
  KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View,
  type StyleProp, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import { Txt } from './Txt'

interface ScreenProps {
  children: React.ReactNode
  /** scroll=false para telas com FlatList própria */
  scroll?: boolean
  padded?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  style?: StyleProp<ViewStyle>
  keyboardAvoiding?: boolean
}

export function Screen({
  children, scroll = true, padded = true, refreshing, onRefresh, style, keyboardAvoiding,
}: ScreenProps) {
  const { colors } = useTheme()
  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: spacing.xxl }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.padded, style]}>{children}</View>
  )

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  )

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>{body}</View>
}

interface AppHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  large?: boolean
  right?: React.ReactNode
  /** Conteúdo abaixo do título (ex.: busca) */
  bottom?: React.ReactNode
}

/** Header padrão das telas — título grande estilo iOS, back opcional, ação à direita. */
export function AppHeader({ title, subtitle, back, large = true, right, bottom }: AppHeaderProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.xs,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.bg,
      }}
    >
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.xs }}>
          {back && (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={({ pressed }) => [
                styles.backBtn,
                { backgroundColor: pressed ? colors.overlay : colors.overlaySoft },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Txt variant={large ? 'displayLg' : 'display'} numberOfLines={1}>
              {title}
            </Txt>
            {subtitle ? (
              <Txt variant="caption" color="textDim" numberOfLines={1} style={{ marginTop: 2 }}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
        </View>
        {right}
      </View>
      {bottom ? <View style={{ marginTop: spacing.sm }}>{bottom}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
