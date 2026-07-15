import React, { useMemo, useState } from 'react'
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Screen, SkeletonCard, Txt, useToast } from '../../components/ui'
import { assistenteService } from '../../services'
import type { MensagemAssistente } from '../../services/assistente'
import { formatHora } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

export default function ConversaAssistenteScreen({ route }: RootScreenProps<'ConversaAssistente'>) {
  const { id, nome } = route.params
  const { colors, dark } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({
    queryKey: ['assistente', 'mensagens', id],
    queryFn: () => assistenteService.mensagens(id),
    refetchInterval: 12000,
  })

  // A sugestão da IA vem anexada à última mensagem recebida do lead.
  const sugestao = useMemo(() => {
    const msgs = q.data ?? []
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].autor_tipo === 'lead' && msgs[i].sugestao_ia) return msgs[i].sugestao_ia as string
    }
    return null
  }, [q.data])

  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const texto = editando ? rascunho : (sugestao ?? '')

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['assistente', 'mensagens', id] })
    queryClient.invalidateQueries({ queryKey: ['assistente', 'conversas'] })
  }

  const enviarMut = useMutation({
    mutationFn: (t: string) => assistenteService.enviar(id, t),
    onSuccess: () => { setEditando(false); setRascunho(''); invalidar(); toast.show('success', 'Mensagem enviada.') },
    onError: (e: Error) => toast.show('error', e.message || 'Não foi possível enviar.'),
  })
  const audioMut = useMutation({
    mutationFn: (t: string) => assistenteService.enviarAudio(id, t),
    onSuccess: () => { setEditando(false); setRascunho(''); invalidar(); toast.show('success', 'Áudio enviado.') },
    onError: (e: Error) => toast.show('error', e.message || 'Não foi possível enviar o áudio.'),
  })
  const enviando = enviarMut.isPending || audioMut.isPending

  const bolha = (m: MensagemAssistente) => {
    const minha = m.autor_tipo === 'vendedor' || m.autor_tipo === 'ia'
    const ehAudio = m.midia_tipo === 'audio'
    return (
      <View
        key={m.id}
        style={[
          styles.bolha,
          minha
            ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
            : { alignSelf: 'flex-start', backgroundColor: dark ? colors.surfaceElevated : '#fff', borderWidth: dark ? 0 : 1, borderColor: colors.border },
        ]}
      >
        {ehAudio ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="mic" size={18} color={minha ? colors.onPrimary : colors.text} />
            <Txt style={{ color: minha ? colors.onPrimary : colors.text, fontFamily: fonts.regular, fontSize: 14 }}>Mensagem de voz</Txt>
          </View>
        ) : (
          <Txt style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: minha ? colors.onPrimary : colors.text }}>{m.conteudo}</Txt>
        )}
        <Txt style={{ fontSize: 9, opacity: 0.6, marginTop: 3, textAlign: 'right', color: minha ? colors.onPrimary : colors.textMuted }}>
          {formatHora(m.created_at)}{m.enviada_ia ? ' · IA' : ''}
        </Txt>
      </View>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title={nome} large={false} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={q.data ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => bolha(item)}
          contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={q.isLoading ? <SkeletonCard withImage={false} /> : (
            <Txt variant="caption" color="textMuted" style={{ textAlign: 'center', paddingTop: spacing.xl }}>
              Nenhuma mensagem nesta conversa ainda.
            </Txt>
          )}
        />

        {sugestao ? (
          <View style={[styles.sugpanel, { borderColor: colors.primary, backgroundColor: dark ? colors.overlaySoft : '#eff4ff', paddingBottom: insets.bottom + spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
              <Ionicons name="sparkles" size={14} color={colors.primaryText} />
              <Txt variant="label" style={{ color: colors.primaryText }}>SUGESTÃO DA IA · edite se quiser</Txt>
            </View>
            {editando ? (
              <TextInput
                value={rascunho}
                onChangeText={setRascunho}
                multiline
                autoFocus
                placeholder="Edite a resposta…"
                placeholderTextColor={colors.textMuted}
                style={[styles.editbox, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />
            ) : (
              <Txt style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text }}>{texto}</Txt>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
              {!editando && (
                <Pressable
                  onPress={() => { setRascunho(sugestao); setEditando(true) }}
                  style={[styles.btn, { backgroundColor: colors.overlay }]}
                >
                  <Ionicons name="pencil" size={15} color={colors.text} />
                  <Txt variant="captionMedium">Editar</Txt>
                </Pressable>
              )}
              <Pressable
                onPress={() => texto.trim() && enviarMut.mutate(texto.trim())}
                disabled={enviando || !texto.trim()}
                style={[styles.btn, { flex: 1, backgroundColor: texto.trim() && !enviando ? colors.primary : colors.overlay }]}
              >
                <Ionicons name="send" size={15} color={texto.trim() && !enviando ? colors.onPrimary : colors.textMuted} />
                <Txt variant="captionMedium" style={{ color: texto.trim() && !enviando ? colors.onPrimary : colors.textMuted }}>
                  {enviarMut.isPending ? 'Enviando…' : 'Enviar'}
                </Txt>
              </Pressable>
              <Pressable
                onPress={() => texto.trim() && audioMut.mutate(texto.trim())}
                disabled={enviando || !texto.trim()}
                style={[styles.btnAudio, { backgroundColor: texto.trim() && !enviando ? colors.secondary : colors.overlay }]}
              >
                <Ionicons name="mic" size={17} color={texto.trim() && !enviando ? '#1a1206' : colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.semSug, { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
            <Txt variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
              Sem sugestão pendente. Ela aparece quando o lead enviar uma nova mensagem.
            </Txt>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  bolha: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sugpanel: { borderTopWidth: 2, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  editbox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, minHeight: 70, maxHeight: 140, fontFamily: fonts.regular, fontSize: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: spacing.sm },
  btnAudio: { width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  semSug: { borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
