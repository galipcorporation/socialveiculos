import React, { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, EmptyState, ErrorState, FilterChips, SkeletonCard, Txt,
} from '../../components/ui'
import { Card } from '../../components/ui'
import { chatService } from '../../services'
import type { Conversa, TipoConversa } from '../../services/types'
import { formatRelativo } from '../../lib/format'

export default function ChatScreen() {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<TipoConversa>('cliente')

  const q = useQuery({
    queryKey: ['chat', 'conversas'],
    queryFn: () => chatService.conversas(),
  })

  const todas = q.data ?? []
  const conversas = todas.filter((c) => c.tipo === aba)
  const naoLidasCliente = todas.filter((c) => c.tipo === 'cliente').reduce((a, c) => a + c.nao_lidas, 0)
  const naoLidasParceiro = todas.filter((c) => c.tipo === 'parceiro').reduce((a, c) => a + c.nao_lidas, 0)
  const naoLidasAba = aba === 'cliente' ? naoLidasCliente : naoLidasParceiro

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Conversas"
        subtitle={
          q.isSuccess
            ? naoLidasAba > 0
              ? `${naoLidasAba} não lidas em ${aba === 'cliente' ? 'Clientes' : 'Parceiros'}`
              : 'Tudo respondido'
            : undefined
        }
      />
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <FilterChips
          options={[
            { value: 'cliente', label: 'Clientes', count: naoLidasCliente || undefined },
            { value: 'parceiro', label: 'Parceiros', count: naoLidasParceiro || undefined },
          ]}
          selected={aba}
          onSelect={(v) => setAba(v as TipoConversa)}
        />
      </View>
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
              onPress={() =>
                navigation.navigate('Conversa', {
                  id: item.id,
                  nome: item.tipo === 'parceiro' ? item.loja_parceira_nome ?? item.cliente_nome : item.cliente_nome,
                })
              }
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['chat'] })}
          ListEmptyComponent={
            aba === 'cliente' ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="Nenhuma conversa"
                subtitle="Quando clientes falarem com a loja pela vitrine ou WhatsApp, as conversas aparecem aqui."
              />
            ) : (
              <EmptyState
                icon="business-outline"
                title="Nenhum parceiro"
                subtitle="Conversas com lojas parceiras (repasses B2B) aparecem aqui."
              />
            )
          }
        />
      )}
    </View>
  )
}

function ConversaCard({ conversa, onPress }: { conversa: Conversa; onPress: () => void }) {
  const { colors } = useTheme()
  const temNaoLida = conversa.nao_lidas > 0
  const parceiro = conversa.tipo === 'parceiro'
  const nomePrincipal = parceiro ? conversa.loja_parceira_nome ?? conversa.cliente_nome : conversa.cliente_nome

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.xs }}>
      <View style={styles.row}>
        <View>
          <Avatar nome={nomePrincipal} size={48} />
          {parceiro ? (
            <View style={[styles.canal, { backgroundColor: colors.info, borderColor: colors.surface }]}>
              <Ionicons name="business" size={10} color="#fff" />
            </View>
          ) : conversa.canal === 'whatsapp' ? (
            <View style={[styles.canal, { backgroundColor: '#25D366', borderColor: colors.surface }]}>
              <Ionicons name="logo-whatsapp" size={10} color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topo}>
            <Txt variant="bodySemibold" numberOfLines={1} style={{ flex: 1 }}>
              {nomePrincipal}
            </Txt>
            <Txt variant="caption" color={temNaoLida ? 'primaryText' : 'textMuted'}>
              {formatRelativo(conversa.ultima_mensagem_em)}
            </Txt>
          </View>
          {parceiro ? (
            <Txt variant="caption" color="textDim" numberOfLines={1}>
              👤 {conversa.cliente_nome}
            </Txt>
          ) : conversa.veiculo_interesse ? (
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
