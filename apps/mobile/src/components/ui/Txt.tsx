import React from 'react'
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'
import { typography, type ThemeColors } from '../../theme/tokens'

type Variant = keyof typeof typography
type ColorKey = keyof ThemeColors

interface TxtProps extends TextProps {
  variant?: Variant
  color?: ColorKey | string
  align?: TextStyle['textAlign']
  style?: StyleProp<TextStyle>
}

/** Texto tematizado. Sempre usar no lugar de <Text> para manter tipografia/cores consistentes. */
export function Txt({ variant = 'body', color = 'text', align, style, children, ...rest }: TxtProps) {
  const { colors } = useTheme()
  const resolved = (colors as unknown as Record<string, string>)[color] ?? color
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: resolved, textAlign: align }, style]}
    >
      {children}
    </Text>
  )
}
