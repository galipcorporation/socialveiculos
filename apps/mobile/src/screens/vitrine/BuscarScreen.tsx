import React, { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, spacing } from '../../theme/tokens'
import { useTheme } from '../../theme/ThemeContext'
import { EmptyState, SearchBar, SegmentedControl, SkeletonCard, Button, Txt } from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { FiltrosBuscaSheet } from './FiltrosBuscaSheet'
import { contarFiltrosAtivos, vitrineService, type FiltrosAvancados } from '../../services'
import { formatBRLCompact, formatNumber } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useToggleFavorito } from '../../hooks/useToggleFavorito'
import type { AnuncioVitrine } from '../../services/types'

type Modo = 'buscar' | 'favoritos'

const ROTULO_ORDENACAO: Record<NonNullable<FiltrosAvancados['ordenacao']>, string> = {
  relevancia: 'Relevância',
  preco_asc: 'Menor preço',
  preco_desc: 'Maior preço',
  km_asc: 'Menor km',
  ano_desc: 'Mais novo',
}

export default function BuscarScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const comLogin = useGateLogin()
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const [modo, setModo] = useState<Modo>('buscar')
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<FiltrosAvancados>({})
  // Cada abertura incrementa a key do sheet, remontando-o com o filtro atual.
  const [aberturaFiltros, setAberturaFiltros] = useState(0)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  const qtdFiltros = contarFiltrosAtivos(filtros)

  const buscaQ = useQuery({
    queryKey: ['vitrine', 'busca', busca, filtros],
    queryFn: () => vitrineService.feed('todos', busca, filtros),
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

  // Chips do que está filtrado — cada um remove só o próprio critério.
  const resumoFiltros = useMemo(() => {
    const itens: { chave: string; label: string; limpar: Partial<FiltrosAvancados> }[] = []
    if (filtros.tipo) itens.push({ chave: 'tipo', label: filtros.tipo, limpar: { tipo: undefined } })
    if (filtros.carroceria) itens.push({ chave: 'carroceria', label: filtros.carroceria, limpar: { carroceria: undefined } })
    if (filtros.preco_min != null) itens.push({ chave: 'preco_min', label: `a partir de ${formatBRLCompact(filtros.preco_min)}`, limpar: { preco_min: undefined } })
    if (filtros.preco_max != null) itens.push({ chave: 'preco_max', label: `até ${formatBRLCompact(filtros.preco_max)}`, limpar: { preco_max: undefined } })
    if (filtros.ano_min != null) itens.push({ chave: 'ano_min', label: `de ${filtros.ano_min}`, limpar: { ano_min: undefined } })
    if (filtros.ano_max != null) itens.push({ chave: 'ano_max', label: `até ${filtros.ano_max}`, limpar: { ano_max: undefined } })
    if (filtros.km_max != null) itens.push({ chave: 'km_max', label: `até ${formatNumber(filtros.km_max)} km`, limpar: { km_max: undefined } })
    if (filtros.cambio) itens.push({ chave: 'cambio', label: filtros.cambio, limpar: { cambio: undefined } })
    // Combustível e cor são multiescolha: um chip por opção, cada um tirando só
    // a sua (o critério some quando a última é removida).
    for (const chave of ['combustivel', 'cor'] as const) {
      for (const v of filtros[chave] ?? []) {
        const resto = (filtros[chave] ?? []).filter((x) => x !== v)
        itens.push({
          chave: `${chave}:${v}`,
          label: v,
          limpar: { [chave]: resto.length > 0 ? resto : undefined },
        })
      }
    }
    if (filtros.ordenacao) itens.push({ chave: 'ordenacao', label: ROTULO_ORDENACAO[filtros.ordenacao], limpar: { ordenacao: undefined } })
    return itens
  }, [filtros])

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
          <>
            <View style={styles.buscaRow}>
              <SearchBar value={busca} onChangeText={setBusca} placeholder="Marca, modelo, cor…" style={{ flex: 1 }} />
              <Pressable
                onPress={() => { setAberturaFiltros((n) => n + 1); setFiltrosAbertos(true) }}
                accessibilityRole="button"
                accessibilityLabel={qtdFiltros > 0 ? `Filtros (${qtdFiltros} ativos)` : 'Filtros'}
                style={[
                  styles.btnFiltro,
                  {
                    backgroundColor: qtdFiltros > 0 ? colors.primary : colors.inputBg,
                    borderColor: qtdFiltros > 0 ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="options-outline"
                  size={19}
                  color={qtdFiltros > 0 ? colors.onPrimary : colors.textDim}
                />
                {qtdFiltros > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                    <Txt style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primaryText }}>
                      {qtdFiltros}
                    </Txt>
                  </View>
                )}
              </Pressable>
            </View>

            {resumoFiltros.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resumoRow}>
                {resumoFiltros.map((r) => (
                  <Pressable
                    key={r.chave}
                    onPress={() => setFiltros((f) => ({ ...f, ...r.limpar }))}
                    style={[styles.chipAtivo, { backgroundColor: colors.primary + '1c', borderColor: colors.primary + '55' }]}
                  >
                    <Txt style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primaryText }}>{r.label}</Txt>
                    <Ionicons name="close" size={13} color={colors.primaryText} />
                  </Pressable>
                ))}
                <Pressable onPress={() => setFiltros({})} style={styles.limparTudo}>
                  <Txt style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim }}>Limpar tudo</Txt>
                </Pressable>
              </ScrollView>
            )}
          </>
        )}
      </View>

      <FiltrosBuscaSheet
        key={aberturaFiltros}
        visible={filtrosAbertos}
        onClose={() => setFiltrosAbertos(false)}
        valor={filtros}
        onAplicar={setFiltros}
      />

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
              : qtdFiltros > 0
                ? <EmptyState icon="options-outline" title="Nada com esses filtros" subtitle="Tente afrouxar algum critério ou limpar os filtros." />
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

const styles = StyleSheet.create({
  buscaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  btnFiltro: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  resumoRow: { gap: spacing.xs, alignItems: 'center', paddingRight: spacing.sm },
  chipAtivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  limparTudo: { paddingHorizontal: 8, height: 28, justifyContent: 'center' },
})
