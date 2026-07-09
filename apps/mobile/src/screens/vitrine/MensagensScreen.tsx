import React from 'react'
import { FlatList, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Button, Card, EmptyState, SkeletonCard, Txt,
} from '../../components/ui'
import { vitrineService } from '../../services'
import { useAuthStore } from '../../stores/authStore'
import { useGateLogin } from '../../hooks/useGateLogin'
import { formatRelativo } from '../../lib/format'

export default function MensagensScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const comLogin = useGateLogin()

  const q = useQuery({
    queryKey: ['vitrine', 'conversas'],
    queryFn: () => vitrineService.conversas(),
    enabled: isAuth,
  })

  if (!isAuth) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader title="Mensagens" />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.lg }}>
          <EmptyState icon="chatbubbles-outline" title="Converse com as lojas" subtitle="Entre para tirar dúvidas e negociar direto pelo chat." />
          <Button title="Entrar" icon="log-in-outline" onPress={() => comLogin('Entre para conversar com as lojas.', () => {})} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Mensagens" />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vitrine', 'conversas'] })}
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" title="Nenhuma conversa" subtitle="Abra um anúncio e toque em Conversar para falar com a loja." />
          }
          renderItem={({ item }) => (
            <Card onPress={() => navigation.navigate('ConversaVitrine', { id: item.id, nome: item.loja_nome })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar nome={item.loja_nome} size={46} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Txt variant="bodySemibold" numberOfLines={1} style={{ flex: 1 }}>{item.loja_nome}</Txt>
                    {item.loja_verificada && <Ionicons name="checkmark-circle" size={13} color={colors.primary} />}
                    <Txt variant="caption" color="textMuted">{formatRelativo(item.ultima_mensagem_em)}</Txt>
                  </View>
                  {item.veiculo_interesse ? (
                    <Txt variant="caption" color="textDim" numberOfLines={1}>🚗 {item.veiculo_interesse}</Txt>
                  ) : null}
                  <Txt
                    variant="caption"
                    color={item.nao_lidas > 0 ? 'text' : 'textMuted'}
                    numberOfLines={1}
                    style={{ fontFamily: item.nao_lidas > 0 ? fonts.medium : fonts.regular }}
                  >
                    {item.ultima_mensagem}
                  </Txt>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}
