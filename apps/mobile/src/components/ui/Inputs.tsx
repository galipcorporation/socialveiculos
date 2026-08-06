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
  warning?: boolean
  warningText?: string
  hint?: string
  icon?: keyof typeof Ionicons.glyphMap
  right?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

export function Input({ label, error, warning, warningText, hint, icon, right, containerStyle, style, ...rest }: InputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const [senhaVisivel, setSenhaVisivel] = useState(false)

  const borderColor = error ? colors.error : warning ? colors.warning : focused ? colors.primary : colors.border
  // Campo de senha sem "right" próprio ganha o olho automaticamente.
  const olhoAutomatico = !!rest.secureTextEntry && !right
  const secureTextEntry = olhoAutomatico ? !senhaVisivel : rest.secureTextEntry

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label || warning ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {label ? <Txt variant="captionMedium" color="textDim">{label}</Txt> : <View />}
          {warning ? (
            <Txt variant="caption" style={{ color: colors.warning }}>
              {warningText ?? '(Em branco)'}
            </Txt>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.inputBg, borderColor, borderWidth: focused || error || warning ? 1.5 : 1 },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e) }}
          style={[styles.input, { color: colors.text }, style]}
          {...rest}
          secureTextEntry={secureTextEntry}
        />
        {olhoAutomatico ? (
          <Pressable
            onPress={() => setSenhaVisivel((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Ionicons
              name={senhaVisivel ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={colors.textMuted}
            />
          </Pressable>
        ) : (
          right
        )}
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
  warning?: boolean
  warningText?: string
  icon?: keyof typeof Ionicons.glyphMap
  containerStyle?: StyleProp<ViewStyle>
}

export function SelectField({ label, value, placeholder = 'Selecionar…', onPress, error, warning, warningText, icon, containerStyle }: SelectFieldProps) {
  const { colors } = useTheme()
  const borderColor = error ? colors.error : warning ? colors.warning : colors.border

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label || warning ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {label ? <Txt variant="captionMedium" color="textDim">{label}</Txt> : <View />}
          {warning ? (
            <Txt variant="caption" style={{ color: colors.warning }}>
              {warningText ?? '(Em branco)'}
            </Txt>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.inputWrap,
          {
            backgroundColor: pressed ? colors.overlay : colors.inputBg,
            borderColor,
            borderWidth: error || warning ? 1.5 : 1,
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
