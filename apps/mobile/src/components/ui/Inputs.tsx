import React, { useState } from 'react'
import {
  Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Txt } from './Txt'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  icon?: keyof typeof Ionicons.glyphMap
  right?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

export function Input({ label, error, hint, icon, right, containerStyle, style, ...rest }: InputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)

  const borderColor = error ? colors.error : focused ? colors.primary : colors.border

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <Txt variant="captionMedium" color="textDim">{label}</Txt> : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.inputBg, borderColor, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e) }}
          style={[styles.input, { color: colors.text }, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Txt variant="caption" color="error">{error}</Txt>
      ) : hint ? (
        <Txt variant="caption" color="textMuted">{hint}</Txt>
      ) : null}
    </View>
  )
}

interface SearchBarProps {
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  style?: StyleProp<ViewStyle>
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar…', style }: SearchBarProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }, style]}>
      <Ionicons name="search" size={17} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={17} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

/** Campo que parece input mas abre um seletor (Sheet) ao toque. */
interface SelectFieldProps {
  label?: string
  value?: string
  placeholder?: string
  onPress: () => void
  error?: string
  icon?: keyof typeof Ionicons.glyphMap
  containerStyle?: StyleProp<ViewStyle>
}

export function SelectField({ label, value, placeholder = 'Selecionar…', onPress, error, icon, containerStyle }: SelectFieldProps) {
  const { colors } = useTheme()
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <Txt variant="captionMedium" color="textDim">{label}</Txt> : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.inputWrap,
          {
            backgroundColor: pressed ? colors.overlay : colors.inputBg,
            borderColor: error ? colors.error : colors.border,
            borderWidth: 1,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
        <Txt
          variant="body"
          color={value ? 'text' : 'textMuted'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {value || placeholder}
        </Txt>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      {error ? <Txt variant="caption" color="error">{error}</Txt> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 42,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    paddingVertical: 10,
  },
})
