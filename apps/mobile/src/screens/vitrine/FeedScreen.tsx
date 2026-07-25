import React, { useCallback, useState } from 'react'
import { FlatList, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import { EmptyState, ErrorState, FilterChips, SearchBar, SkeletonCard, Txt } from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { vitrineService, FILTROS_FEED, type FiltroFeed } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useToggleFavorito } from '../../hooks/useToggleFavorito'
import { useDebounce } from '../../hooks/useDebounce'
import { abrirWhatsapp } from '../../lib/whatsapp'
import type { AnuncioVitrine } from '../../services/types'

export default function FeedScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const comLogin = useGateLogin()
  const favoritar = useToggleFavorito()
  const [filtro, setFiltro] = useState<FiltroFeed>('todos')
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 400)

  const q = useQuery({
    queryKey: ['vitrine', 'feed', filtro, buscaDebounced],
    queryFn: () => vitrineService.feed(filtro, buscaDebounced),
  })

  const seguirLoja = useCallback((lojaId: string, seguindoAgora: boolean) =>
    comLogin('Entre para seguir lojas.', async () => {
      await vitrineService.alternarSeguir(lojaId, seguindoAgora)
      queryClient.invalidateQueries({ queryKey: ['vitrine'] })
    }), [comLogin, queryClient])

  const whatsapp = useCallback(async (a: AnuncioVitrine) => {
    if (!a.loja_whatsapp) return
    const texto = `Olá! Tenho interesse no ${a.marca} ${a.modelo} anunciado na Social Veículos.`
    await abrirWhatsapp(a.loja_whatsapp, texto)
  }, [])

  const abrirDetalhe = useCallback((id: string) => navigation.navigate('CarroDetalhe', { id }), [navigation])
  const abrirLoja = useCallback((id: string) => navigation.navigate('PerfilLoja', { id }), [navigation])
  const favoritarItem = useCallback(
    (id: string, favoritadoAtual: boolean) => favoritar(id, favoritadoAtual),
    [favoritar]
  )

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 24, color: colors.text }}>Descobrir</Txt>
        <Txt variant="caption" color="textDim">Carros de lojas verificadas perto de você</Txt>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <SearchBar value={busca} onChangeText={setBusca} placeholder="Buscar marca, modelo…" style={{ marginBottom: spacing.xs }} />
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
            <FeedItem
              item={item}
              abrirDetalhe={abrirDetalhe}
              abrirLoja={abrirLoja}
              favoritar={favoritarItem}
              seguirLoja={seguirLoja}
              whatsapp={whatsapp}
            />
          )}
        />
      )}
    </View>
  )
}

interface FeedItemProps {
  item: AnuncioVitrine
  abrirDetalhe: (id: string) => void
  abrirLoja: (id: string) => void
  favoritar: (id: string, favoritadoAtual: boolean) => void
  seguirLoja: (lojaId: string, seguindoAgora: boolean) => void
  whatsapp: (a: AnuncioVitrine) => void
}

const FeedItem = React.memo(function FeedItem({ item, abrirDetalhe, abrirLoja, favoritar, seguirLoja, whatsapp }: FeedItemProps) {
  const onPress = useCallback(() => abrirDetalhe(item.id), [abrirDetalhe, item.id])
  const onLojaPress = useCallback(() => abrirLoja(item.loja_id), [abrirLoja, item.loja_id])
  const onFavorito = useCallback(() => favoritar(item.id, item.favoritado_por_mim), [favoritar, item.id, item.favoritado_por_mim])
  const onSeguirLoja = useCallback(() => seguirLoja(item.loja_id, false), [seguirLoja, item.loja_id])
  const onWhatsapp = useCallback(() => whatsapp(item), [whatsapp, item])

  return (
    <AnuncioCard
      anuncio={item}
      onPress={onPress}
      onLojaPress={onLojaPress}
      onFavorito={onFavorito}
      onSeguirLoja={onSeguirLoja}
      onWhatsapp={item.loja_whatsapp ? onWhatsapp : undefined}
    />
  )
})
