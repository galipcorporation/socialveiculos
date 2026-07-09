import React, { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import { EmptyState, ErrorState, FilterChips, SkeletonCard, Txt } from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { vitrineService, FILTROS_FEED, type FiltroFeed } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'

export default function FeedScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const comLogin = useGateLogin()
  const [filtro, setFiltro] = useState<FiltroFeed>('todos')

  const q = useQuery({
    queryKey: ['vitrine', 'feed', filtro],
    queryFn: () => vitrineService.feed(filtro),
  })

  const favoritar = (id: string) =>
    comLogin('Entre para salvar seus favoritos.', async () => {
      await vitrineService.alternarFavorito(id)
      queryClient.invalidateQueries({ queryKey: ['vitrine'] })
    })

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 24, color: colors.text }}>Descobrir</Txt>
        <Txt variant="caption" color="textDim">Carros de lojas verificadas perto de você</Txt>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <FilterChips options={FILTROS_FEED} selected={filtro} onSelect={(v) => setFiltro(v as FiltroFeed)} />
      </View>

      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md }}>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vitrine', 'feed'] })}
          ListEmptyComponent={<EmptyState icon="car-outline" title="Nada por aqui" subtitle="Nenhum veículo neste filtro." />}
          renderItem={({ item }) => (
            <AnuncioCard
              anuncio={item}
              onPress={() => navigation.navigate('CarroDetalhe', { id: item.id })}
              onLojaPress={() => navigation.navigate('PerfilLoja', { id: item.loja_id })}
              onFavorito={() => favoritar(item.id)}
            />
          )}
        />
      )}
    </View>
  )
}
