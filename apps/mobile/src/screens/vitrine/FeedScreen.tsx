import React, { useCallback, useState } from 'react'
import { FlatList, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import { EmptyState, ErrorState, FilterChips, SearchBar, SkeletonCard, Txt, useToast } from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { vitrineService, FILTROS_FEED, type FiltroFeed } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useToggleFavorito } from '../../hooks/useToggleFavorito'
import { useDebounce } from '../../hooks/useDebounce'
import { abrirWhatsapp, abrirWhatsappComLead } from '../../lib/whatsapp'
import { extractErrorDetails } from '../../lib/api'
import type { AnuncioVitrine } from '../../services/types'

export default function FeedScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const comLogin = useGateLogin()
  const favoritar = useToggleFavorito()
  const toast = useToast()
  const [filtro, setFiltro] = useState<FiltroFeed>('todos')
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 400)

  const q = useQuery({
    queryKey: ['vitrine', 'feed', filtro, buscaDebounced],
    queryFn: () => vitrineService.feed(filtro, buscaDebounced),
  })

  // A tela fica montada o tempo todo na tab bar, então sem isso o status
  // "Seguindo" pode ficar desatualizado após seguir/deixar de seguir em
  // outra tela (ex.: "Lojas que sigo") sem o usuário sair e voltar ao app.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['vitrine', 'feed'] })
    }, [queryClient])
  )

  const seguirLoja = useCallback((lojaId: string, seguindoAgora: boolean) =>
    comLogin('Entre para seguir lojas.', async () => {
      try {
        const novoEstado = await vitrineService.alternarSeguir(lojaId, seguindoAgora)
        queryClient.setQueryData<AnuncioVitrine[]>(['vitrine', 'feed', filtro, buscaDebounced], (ant) =>
          (ant ?? []).map((a) => (a.loja_id === lojaId ? { ...a, seguindo_loja: novoEstado } : a))
        )
        queryClient.invalidateQueries({ queryKey: ['vitrine'] })
      } catch (e) {
        toast.show('error', extractErrorDetails(e).message || 'Não foi possível atualizar o status de seguir.')
      }
    }), [comLogin, queryClient, filtro, buscaDebounced, toast])

  const whatsapp = useCallback(async (a: AnuncioVitrine) => {
    if (!a.loja_whatsapp) return
    const texto = `Olá! Tenho interesse no ${a.marca} ${a.modelo} anunciado na Social Veículos.`
    await abrirWhatsappComLead(a.id, a.loja_whatsapp, texto)
  }, [])

  const conversar = useCallback((a: AnuncioVitrine) =>
    comLogin('Entre para conversar com a loja.', async () => {
      try {
        const conv = await vitrineService.abrirConversa(a)
        queryClient.invalidateQueries({ queryKey: ['vitrine', 'conversas'] })
        navigation.navigate('ConversaVitrine', { id: conv.id, nome: conv.loja_nome })
      } catch (e) {
        toast.show('error', extractErrorDetails(e).message || 'Não foi possível iniciar a conversa com a loja.')
      }
    }), [comLogin, queryClient, navigation, toast])

  const abrirDetalhe = useCallback((id: string) => navigation.navigate('CarroDetalhe', { id }), [navigation])
  const abrirLoja = useCallback((id: string) => navigation.navigate('PerfilLoja', { id }), [navigation])
  const favoritarItem = useCallback(
    (id: string, favoritadoAtual: boolean) => favoritar(id, favoritadoAtual),
    [favoritar]
  )

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 24, color: colors.text }}>Feed</Txt>
        <Txt variant="caption" color="textDim">Carros de lojas verificadas perto de você</Txt>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <SearchBar value={busca} onChangeText={setBusca} placeholder="Buscar marca, modelo…" style={{ marginBottom: spacing.xs }} />
        <FilterChips options={FILTROS_FEED} selected={filtro} onSelect={(v) => setFiltro(v as FiltroFeed)} />
      </View>

      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md }}>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews
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
              conversar={conversar}
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
  conversar: (a: AnuncioVitrine) => void
}

const FeedItem = React.memo(function FeedItem({ item, abrirDetalhe, abrirLoja, favoritar, seguirLoja, whatsapp, conversar }: FeedItemProps) {
  const onPress = useCallback(() => abrirDetalhe(item.id), [abrirDetalhe, item.id])
  const onLojaPress = useCallback(() => abrirLoja(item.loja_id), [abrirLoja, item.loja_id])
  const onFavorito = useCallback(() => favoritar(item.id, item.favoritado_por_mim), [favoritar, item.id, item.favoritado_por_mim])
  const onSeguirLoja = useCallback(() => seguirLoja(item.loja_id, !!item.seguindo_loja), [seguirLoja, item.loja_id, item.seguindo_loja])
  const onWhatsapp = useCallback(() => whatsapp(item), [whatsapp, item])
  const onConversar = useCallback(() => conversar(item), [conversar, item])

  return (
    <AnuncioCard
      anuncio={item}
      onPress={onPress}
      onLojaPress={onLojaPress}
      onFavorito={onFavorito}
      onSeguirLoja={onSeguirLoja}
      seguindoLoja={item.seguindo_loja}
      onWhatsapp={item.loja_whatsapp ? onWhatsapp : undefined}
      onConversar={onConversar}
    />
  )
})
