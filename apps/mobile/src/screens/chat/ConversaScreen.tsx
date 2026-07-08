import React, { useEffect, useRef, useState } from 'react'
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Screen, Skeleton, Txt } from '../../components/ui'
import { chatService } from '../../services'
import type { Mensagem } from '../../services/types'
import { formatHora } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

export default function ConversaScreen({ route }: RootScreenProps<'Conversa'>) {
  const { id, nome } = route.params
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const listRef = useRef<FlatList<Mensagem>>(null)
  const [texto, setTexto] = useState('')

  const q = useQuery({
    queryKey: ['chat', 'mensagens', id],
    queryFn: () => chatService.mensagens(id),
  })

  useEffect(() => {
    chatService.marcarLidas(id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'nao-lidas'] })
    })
  }, [id, queryClient])

  const enviarMut = useMutation({
    mutationFn: (t: string) => chatService.enviar(id, t),
    onMutate: async (t) => {
      // Otimista: mostra a mensagem na hora
      const chave = ['chat', 'mensagens', id]
      await queryClient.cancelQueries({ queryKey: chave })
      const anteriores = queryClient.getQueryData<Mensagem[]>(chave)
      const otimista: Mensagem = {
        id: `tmp-${Date.now()}`,
        conversa_id: id,
        autor: 'loja',
        texto: t,
        created_at: new Date().toISOString(),
        lida: true,
      }
      queryClient.setQueryData<Mensagem[]>(chave, (velho) => [...(velho ?? []), otimista])
      return { anteriores }
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.anteriores) queryClient.setQueryData(['chat', 'mensagens', id], ctx.anteriores)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chat'] })
    },
  })

  const enviar = () => {
    const t = texto.trim()
    if (!t) return
    setTexto('')
    enviarMut.mutate(t)
  }

  const mensagens = q.data ?? []

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title={nome} large={false} back />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {q.isLoading ? (
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Skeleton width="60%" height={40} style={{ alignSelf: 'flex-start', borderRadius: 16 }} />
            <Skeleton width="55%" height={40} style={{ alignSelf: 'flex-end', borderRadius: 16 }} />
            <Skeleton width="70%" height={40} style={{ alignSelf: 'flex-start', borderRadius: 16 }} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={mensagens}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bolha mensagem={item} />}
            contentContainerStyle={{ padding: spacing.md, gap: 6 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Composer */}
        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.xs,
            },
          ]}
        >
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escreva uma mensagem…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            onPress={enviar}
            disabled={!texto.trim()}
            style={({ pressed }) => [
              styles.enviar,
              {
                backgroundColor: texto.trim() ? colors.primary : colors.overlay,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Ionicons name="send" size={18} color={texto.trim() ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  const { colors, dark } = useTheme()
  const minha = mensagem.autor === 'loja'
  return (
    <View
      style={[
        styles.bolha,
        minha
          ? { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 }
          : {
              alignSelf: 'flex-start',
              backgroundColor: dark ? colors.surfaceElevated : '#ffffff',
              borderBottomLeftRadius: 4,
              borderWidth: dark ? 0 : 1,
              borderColor: colors.border,
            },
      ]}
    >
      <Txt
        style={{
          fontFamily: fonts.regular,
          fontSize: 15,
          lineHeight: 20,
          color: minha ? colors.onPrimary : colors.text,
        }}
      >
        {mensagem.texto}
      </Txt>
      <Txt
        style={{
          fontFamily: fonts.regular,
          fontSize: 10,
          color: minha ? 'rgba(255,255,255,0.7)' : colors.textMuted,
          alignSelf: 'flex-end',
          marginTop: 2,
        }}
      >
        {formatHora(mensagem.created_at)}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  bolha: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
