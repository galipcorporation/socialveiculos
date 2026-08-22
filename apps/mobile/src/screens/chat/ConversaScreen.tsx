import React, { useEffect, useRef, useState } from 'react'
import {
  FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View,
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
import { useChatSocket } from '../../hooks/useChatSocket'
import type { RootScreenProps } from '../../navigation/types'

const STATUS_NEGOCIACAO_LABEL: Record<string, string> = {
  pendente: 'Pendente', aceita: 'Aceita', rejeitada: 'Rejeitada', cancelada: 'Cancelada',
  em_negociacao: 'Em negociação', fechou: 'Fechou', nao_fechou: 'Não fechou',
}
const OPCOES_STATUS_MANUAL: Array<{ value: string; label: string }> = [
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'fechou', label: 'Fechou' },
  { value: 'nao_fechou', label: 'Não fechou' },
]

function corStatusNegociacao(status: string, colors: any): string {
  if (status === 'aceita' || status === 'fechou') return colors.success
  if (status === 'rejeitada' || status === 'cancelada' || status === 'nao_fechou') return colors.error
  return colors.warning
}

const MOTIVO_ARQUIVO_LABEL: Record<string, string> = {
  vendido: 'Veículo vendido',
  reservado: 'Veículo reservado',
  indisponivel: 'Veículo fora do anúncio',
}

export default function ConversaScreen({ route, navigation }: RootScreenProps<'Conversa'>) {
  const { id, nome, tipo, veiculoId, veiculoInteresse, veiculoFoto, temPropostaVinculada, arquivada, motivoArquivo } = route.params
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const listRef = useRef<FlatList<Mensagem>>(null)
  const [texto, setTexto] = useState('')
  const [statusNegociacao, setStatusNegociacao] = useState(route.params.statusNegociacao ?? null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [modalGerenciarVisivel, setModalGerenciarVisivel] = useState(false)

  const statusMut = useMutation({
    mutationFn: (novoStatus: string | null) => chatService.marcarStatusNegociacao(id, novoStatus),
    onSuccess: (convAtualizada) => {
      setStatusNegociacao(convAtualizada.status_negociacao ?? null)
      setSeletorAberto(false)
      queryClient.invalidateQueries({ queryKey: ['chat'] })
    },
  })

  const q = useQuery({
    queryKey: ['chat', 'mensagens', id],
    queryFn: () => chatService.mensagens(id),
    refetchInterval: 6000,
  })

  useChatSocket({
    conversaId: id,
    onNovaMensagem: (msg) => {
      queryClient.setQueryData<Mensagem[]>(['chat', 'mensagens', id], (old) => {
        if (!old) return [msg]
        if (old.some((m) => m.id === msg.id)) return old
        return [...old, msg]
      })
    },
  })

  useEffect(() => {
    chatService.marcarLidas(id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'nao-lidas'] })
    })
  }, [id, queryClient])

  const enviarMut = useMutation({
    mutationFn: (t: string) => chatService.enviar(id, t),
    onSuccess: (nova) => {
      queryClient.setQueryData<Mensagem[]>(['chat', 'mensagens', id], (old) => {
        if (!old) return [nova]
        if (old.some((m) => m.id === nova.id)) return old
        return [...old, nova]
      })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
    },
  })

  const enviar = () => {
    const t = texto.trim()
    if (!t || arquivada) return
    setTexto('')
    enviarMut.mutate(t)
  }

  const mensagens = q.data ?? []

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader
        title={nome ?? 'Conversa'}
        large={false}
        back
        right={
          <Pressable
            onPress={() => setModalGerenciarVisivel(true)}
            hitSlop={12}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        }
      />
      {(veiculoInteresse || veiculoFoto) ? (
        <View style={[styles.contexto, { borderBottomColor: colors.border }]}>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
            onPress={() => {
              if (veiculoId) {
                navigation.navigate('CarroDetalhe', { id: veiculoId })
              }
            }}
          >
            {veiculoFoto ? (
              <Image source={{ uri: veiculoFoto }} style={{ width: 32, height: 24, borderRadius: 4 }} />
            ) : (
              <Ionicons name="car-outline" size={18} color={colors.primary} />
            )}
            <Txt variant="caption" color="primary" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold }}>
              {veiculoInteresse ?? 'Ver veículo'}
            </Txt>
          </Pressable>
          {tipo === 'parceiro' && (
            temPropostaVinculada ? (
              statusNegociacao ? (
                <View style={[styles.statusBadge, { borderColor: corStatusNegociacao(statusNegociacao, colors) }]}>
                  <Txt style={{ fontSize: 11, fontFamily: fonts.bold, color: corStatusNegociacao(statusNegociacao, colors) }}>
                    {STATUS_NEGOCIACAO_LABEL[statusNegociacao] ?? statusNegociacao}
                  </Txt>
                </View>
              ) : null
            ) : (
              <Pressable onPress={() => setSeletorAberto((v) => !v)}>
                {statusNegociacao ? (
                  <View style={[styles.statusBadge, { borderColor: corStatusNegociacao(statusNegociacao, colors) }]}>
                    <Txt style={{ fontSize: 11, fontFamily: fonts.bold, color: corStatusNegociacao(statusNegociacao, colors) }}>
                      {STATUS_NEGOCIACAO_LABEL[statusNegociacao] ?? statusNegociacao}
                    </Txt>
                  </View>
                ) : (
                  <Txt variant="caption" color="primary">Marcar status…</Txt>
                )}
              </Pressable>
            )
          )}
        </View>
      ) : null}
      {seletorAberto ? (
        <View style={[styles.seletor, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {OPCOES_STATUS_MANUAL.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => statusMut.mutate(opt.value)}
              style={[styles.statusBadge, { borderColor: corStatusNegociacao(opt.value, colors) }]}
            >
              <Txt style={{ fontSize: 11, fontFamily: fonts.bold, color: corStatusNegociacao(opt.value, colors) }}>
                {opt.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

        {/* Conversa arquivada: o veículo saiu do estoque e o chat vira histórico.
            Oferecer outro carro é conversa nova, aberta pelo lead no CRM. */}
        {arquivada ? (
          <View style={[styles.arquivada, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
            <Ionicons name="archive-outline" size={20} color={colors.textDim} />
            <Txt variant="caption" color="textDim" style={{ flex: 1 }}>
              {motivoArquivo ? (MOTIVO_ARQUIVO_LABEL[motivoArquivo] ?? motivoArquivo) : 'Conversa arquivada'}. Histórico mantido para consulta.
            </Txt>
          </View>
        ) : (
          <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={texto}
              onChangeText={setTexto}
              placeholder="Digite sua mensagem…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              onPress={enviar}
              disabled={!texto.trim() || enviarMut.isPending}
              style={[
                styles.enviar,
                { backgroundColor: texto.trim() ? colors.primary : colors.overlay },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={texto.trim() ? colors.onPrimary : colors.textMuted}
              />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={modalGerenciarVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalGerenciarVisivel(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalGerenciarVisivel(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Txt variant="title" style={{ marginBottom: 4 }}>Gerenciar Conversa</Txt>
            <Txt variant="body" color="textDim" style={{ marginBottom: 20 }}>
              Escolha o que deseja fazer com a conversa de {nome ?? 'este contato'}:
            </Txt>

            <Pressable
              style={[styles.modalOption, { borderColor: colors.border }]}
              onPress={async () => {
                setModalGerenciarVisivel(false)
                try {
                  await chatService.arquivar(id)
                  queryClient.invalidateQueries({ queryKey: ['chat'] })
                  navigation.goBack()
                } catch {}
              }}
            >
              <Ionicons name="archive-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold">Arquivar Conversa</Txt>
                <Txt variant="caption" color="textDim">Move para a seção de conversas arquivadas.</Txt>
              </View>
            </Pressable>

            <Pressable
              style={[styles.modalOption, { borderColor: colors.error + '40' }]}
              onPress={async () => {
                setModalGerenciarVisivel(false)
                try {
                  await chatService.excluir(id)
                  queryClient.invalidateQueries({ queryKey: ['chat'] })
                  navigation.goBack()
                } catch {}
              }}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold" color="error">Excluir Conversa</Txt>
                <Txt variant="caption" color="textDim">Remove da sua listagem (soft delete no banco).</Txt>
              </View>
            </Pressable>

            <Pressable
              style={[styles.modalCancel, { backgroundColor: colors.overlay }]}
              onPress={() => setModalGerenciarVisivel(false)}
            >
              <Txt variant="bodySemibold" color="textDim">Cancelar</Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const Bolha = React.memo(function Bolha({ mensagem }: { mensagem: Mensagem }) {
  const { colors, dark } = useTheme()
  const minha = mensagem.autor === 'loja'

  // Aviso do sistema (veículo vendido/reservado): centralizado, sem dono.
  if (mensagem.sistema) {
    return (
      <View style={[styles.sistema, { backgroundColor: colors.overlay, borderColor: colors.border }]}>
        <Txt variant="caption" color="textDim" style={{ textAlign: 'center' }}>
          {mensagem.texto}
        </Txt>
      </View>
    )
  }

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
})

const styles = StyleSheet.create({
  contexto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  seletor: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bolha: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sistema: {
    alignSelf: 'center',
    maxWidth: '90%',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
  },
  arquivada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalCancel: {
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
})
