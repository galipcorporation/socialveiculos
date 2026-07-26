import React from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { spacing } from '../../theme/tokens'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

interface ConfirmSheetProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  /** Ações destrutivas ganham botão vermelho e ícone de alerta. */
  destructive?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}

/** Confirmação padrão do app — mesmo bottom sheet das demais ações, nunca Alert nativo. */
export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  destructive = false,
  icon,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} scrollable={false}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Txt variant="body" color="textDim">{message}</Txt>
        <Button
          title={confirmText}
          variant={destructive ? 'danger' : 'primary'}
          icon={icon ?? (destructive ? 'trash-outline' : undefined)}
          loading={loading}
          onPress={onConfirm}
        />
        <Button title={cancelText} variant="ghost" disabled={loading} onPress={onClose} />
      </View>
    </Sheet>
  )
}
