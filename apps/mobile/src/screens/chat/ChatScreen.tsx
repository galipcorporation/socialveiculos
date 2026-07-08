import React from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, EmptyState, ErrorState, SkeletonCard, Txt,
} from '../../components/ui'
import { Card } from '../../components/ui'
import { chatService } from '../../services'
import type { Conversa } from '../../services/types'
import { formatRelativo } from '../../lib/format'

export default function ChatScreen() {
  const navigation = useNavigation()
  const queryClient = useQueryClient()

  const q = useQuery({
    queryKey: ['chat', 'conversas'],
    queryFn: () => chatService.conversas(),
  })

  const conversas = q.data ?? []
  const naoLidas = conversas.reduce((acc, c) => acc + c.nao_lidas, 0)

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Conversas"
        subtitle={
          q.isSuccess
            ? naoLidas > 0
              ? `${naoLidas} mensagens não lidas`
              : 'Tudo respondido'
            : undefined
        }
      />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={conversas}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversaCard
              conversa={item}
              onPress={() => navigation.navigate('Conversa', { id: item.id, nome: item.cliente_nome })}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['chat'] })}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Nenhuma conversa"
              subtitle="Quando clientes falarem com a loja pela vitrine ou WhatsApp, as conversas aparecem aqui."
            />
          }
        />
      )}
    </View>
  )
}

function ConversaCard({ conversa, onPress }: { conversa: Conversa; onPress: () => void }) {
  const { colors } = useTheme()
  const temNaoLida = conversa.nao_lidas > 0

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.xs }}>
      <View style={styles.row}>
        <View>
          <Avatar nome={conversa.cliente_nome} size={48} />
          {conversa.canal === 'whatsapp' && (
            <View style={[styles.canal, { backgroundColor: '#25D366', borderColor: colors.surface }]}>
              <Ionicons name="logo-whatsapp" size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topo}>
            <Txt variant="bodySemibold" numberOfLines={1} style={{ flex: 1 }}>
              {conversa.cliente_nome}
            </Txt>
            <Txt variant="caption" color={temNaoLida ? 'primaryText' : 'textMuted'}>
              {formatRelativo(conversa.ultima_mensagem_em)}
            </Txt>
          </View>
          {conversa.veiculo_interesse ? (
            <Txt variant="caption" color="textDim" numberOfLines={1}>
              🚗 {conversa.veiculo_interesse}
            </Txt>
          ) : null}
          <View style={styles.topo}>
            <Txt
              variant="caption"
              color={temNaoLida ? 'text' : 'textMuted'}
              numberOfLines={1}
              style={{ flex: 1, fontFamily: temNaoLida ? fonts.medium : fonts.regular }}
            >
              {conversa.ultima_mensagem}
            </Txt>
            {temNaoLida && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Txt style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onPrimary }}>
                  {conversa.nao_lidas}
                </Txt>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  canal: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
})
