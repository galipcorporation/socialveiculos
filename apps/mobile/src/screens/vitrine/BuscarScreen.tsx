import React, { useCallback, useState } from 'react'
import { FlatList, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing } from '../../theme/tokens'
import { EmptyState, SearchBar, SegmentedControl, SkeletonCard, Button } from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { vitrineService } from '../../services'
import { useAuthStore } from '../../stores/authStore'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useToggleFavorito } from '../../hooks/useToggleFavorito'
import type { AnuncioVitrine } from '../../services/types'

type Modo = 'buscar' | 'favoritos'

export default function BuscarScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const comLogin = useGateLogin()
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const [modo, setModo] = useState<Modo>('buscar')
  const [busca, setBusca] = useState('')

  const buscaQ = useQuery({
    queryKey: ['vitrine', 'busca', busca],
    queryFn: () => vitrineService.feed('todos', busca),
    enabled: modo === 'buscar',
  })
  const favQ = useQuery({
    queryKey: ['vitrine', 'favoritos'],
    queryFn: () => vitrineService.favoritos(),
    enabled: modo === 'favoritos' && isAuth,
  })

  const favoritar = useToggleFavorito()

  const dados = modo === 'buscar' ? buscaQ.data ?? [] : favQ.data ?? []
  const carregando = modo === 'buscar' ? buscaQ.isLoading : favQ.isLoading

  const abrirDetalhe = useCallback((id: string) => navigation.navigate('CarroDetalhe', { id }), [navigation])
  const abrirLoja = useCallback((id: string) => navigation.navigate('PerfilLoja', { id }), [navigation])
  const favoritarItem = useCallback((id: string, favoritadoAtual: boolean) => favoritar(id, favoritadoAtual), [favoritar])

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xs }}>
        <SegmentedControl
          options={[{ value: 'buscar', label: 'Buscar' }, { value: 'favoritos', label: 'Favoritos' }]}
          selected={modo}
          onSelect={(v) => setModo(v as Modo)}
        />
        {modo === 'buscar' && (
          <SearchBar value={busca} onChangeText={setBusca} placeholder="Marca, modelo, cor…" />
        )}
      </View>

      {modo === 'favoritos' && !isAuth ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.lg }}>
          <EmptyState icon="heart-outline" title="Salve seus favoritos" subtitle="Entre para guardar os carros que você curtir e acessá-los depois." />
          <Button title="Entrar" icon="log-in-outline" onPress={() => comLogin('Entre para ver seus favoritos.', () => {})} />
        </View>
      ) : carregando ? (
        <View style={{ paddingHorizontal: spacing.md }}>{[0, 1].map((i) => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl, paddingTop: spacing.xs }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            modo === 'favoritos'
              ? <EmptyState icon="heart-outline" title="Sem favoritos ainda" subtitle="Toque no coração de um anúncio para salvá-lo." />
              : <EmptyState icon="search-outline" title="Nada encontrado" subtitle={busca ? `Sem resultados para "${busca}".` : 'Digite para buscar veículos.'} />
          }
          renderItem={({ item }) => (
            <BuscarItem
              item={item}
              abrirDetalhe={abrirDetalhe}
              abrirLoja={abrirLoja}
              favoritar={favoritarItem}
            />
          )}
        />
      )}
    </View>
  )
}

interface BuscarItemProps {
  item: AnuncioVitrine
  abrirDetalhe: (id: string) => void
  abrirLoja: (id: string) => void
  favoritar: (id: string, favoritadoAtual: boolean) => void
}

const BuscarItem = React.memo(function BuscarItem({ item, abrirDetalhe, abrirLoja, favoritar }: BuscarItemProps) {
  const onPress = useCallback(() => abrirDetalhe(item.id), [abrirDetalhe, item.id])
  const onLojaPress = useCallback(() => abrirLoja(item.loja_id), [abrirLoja, item.loja_id])
  const onFavorito = useCallback(() => favoritar(item.id, item.favoritado_por_mim), [favoritar, item.id, item.favoritado_por_mim])

  return <AnuncioCard anuncio={item} onPress={onPress} onLojaPress={onLojaPress} onFavorito={onFavorito} />
})
