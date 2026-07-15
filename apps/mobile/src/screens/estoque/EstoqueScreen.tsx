import React, { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MainTabsParamList } from '../../navigation/types'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Card, EmptyState, ErrorState, Fab, FilterChips, KpiCard, OptionSheet,
  SearchBar, SkeletonCard, TONE_STATUS_VEICULO, Txt,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { veiculosService } from '../../services'
import { STATUS_VEICULO_LABEL, type Veiculo, type VeiculoStatus } from '../../services/types'
import { formatBRL, formatKm, formatNumber } from '../../lib/format'

type FiltroStatus = VeiculoStatus | 'todos'
type Ordenacao = 'recentes' | 'preco_desc' | 'preco_asc' | 'km_asc' | 'ano_desc'

const ORDENACOES: { value: Ordenacao; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'preco_desc', label: 'Maior preço' },
  { value: 'preco_asc', label: 'Menor preço' },
  { value: 'km_asc', label: 'Menor km' },
  { value: 'ano_desc', label: 'Ano mais novo' },
]

export default function EstoqueScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainTabsParamList, 'Estoque'>>()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>(route.params?.statusInicial ?? 'todos')
  const [ordem, setOrdem] = useState<Ordenacao>('recentes')
  const [ordemSheet, setOrdemSheet] = useState(false)

  const listaQ = useQuery({
    queryKey: ['veiculos', 'lista'],
    queryFn: () => veiculosService.listar(),
  })

  const todos = listaQ.data ?? []

  const filtrados = useMemo(() => {
    let lista = [...todos]
    if (status !== 'todos') lista = lista.filter((v) => v.status === status)
    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter((v) =>
        [v.marca, v.modelo, v.versao, v.placa, v.cor, String(v.ano_modelo)]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q))
      )
    }
    if (ordem === 'preco_desc') lista.sort((a, b) => (b.preco_venda ?? 0) - (a.preco_venda ?? 0))
    else if (ordem === 'preco_asc') lista.sort((a, b) => (a.preco_venda ?? 0) - (b.preco_venda ?? 0))
    else if (ordem === 'km_asc') lista.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
    else if (ordem === 'ano_desc') lista.sort((a, b) => b.ano_modelo - a.ano_modelo)
    return lista
  }, [todos, status, busca, ordem])

  const disponiveis = todos.filter((v) => v.status === 'disponivel').length
  const naVitrine = todos.filter((v) => v.publicado_marketplace).length

  const contagem = (s: FiltroStatus) =>
    s === 'todos' ? todos.length : todos.filter((v) => v.status === s).length

  const chips = [
    { value: 'todos' as const, label: 'Todos', count: contagem('todos') },
    { value: 'disponivel' as const, label: 'Disponíveis', count: contagem('disponivel') },
    { value: 'reservado' as const, label: 'Reservados', count: contagem('reservado') },
    { value: 'vendido' as const, label: 'Vendidos', count: contagem('vendido') },
    { value: 'repasse' as const, label: 'Repasse', count: contagem('repasse') },
    { value: 'inativo' as const, label: 'Inativos', count: contagem('inativo') },
  ]

  const renderVeiculo = useCallback(({ item }: { item: Veiculo }) => (
    <VeiculoCard veiculo={item} onPress={() => navigation.navigate('VeiculoDetalhe', { id: item.id })} />
  ), [navigation])

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Estoque"
        subtitle={listaQ.isSuccess ? `${todos.length} veículos na loja` : undefined}
        bottom={
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <SearchBar value={busca} onChangeText={setBusca} placeholder="Marca, modelo, placa…" style={{ flex: 1 }} />
              <Pressable onPress={() => setOrdemSheet(true)} style={{ width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="swap-vertical" size={18} color={colors.textDim} />
              </Pressable>
            </View>
            <FilterChips options={chips} selected={status} onSelect={setStatus} />
          </View>
        }
      />

      {listaQ.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : listaQ.isError ? (
        <ErrorState onRetry={() => listaQ.refetch()} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <KpiCard label="Total" value={formatNumber(todos.length)} icon="car-sport" tone="primary" />
              <KpiCard label="Disponíveis" value={formatNumber(disponiveis)} icon="checkmark-circle" tone="success" />
              <KpiCard label="Na vitrine" value={formatNumber(naVitrine)} icon="globe" tone="primary" />
            </View>
          }
          renderItem={renderVeiculo}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={listaQ.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['veiculos'] })}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          getItemLayout={getItemLayout}
          ListEmptyComponent={
            busca || status !== 'todos' ? (
              <EmptyState
                icon="search-outline"
                title="Nada encontrado"
                subtitle="Ajuste a busca ou os filtros para ver mais veículos."
              />
            ) : (
              <EmptyState
                icon="car-sport-outline"
                title="Estoque vazio"
                subtitle="Cadastre o primeiro veículo da sua loja."
                actionLabel="Adicionar veículo"
                onAction={() => navigation.navigate('VeiculoForm')}
              />
            )
          }
        />
      )}

      <Fab icon="add" label="Veículo" onPress={() => navigation.navigate('VeiculoForm')} />
      <OptionSheet
        visible={ordemSheet}
        onClose={() => setOrdemSheet(false)}
        title="Ordenar por"
        selected={ordem}
        options={ORDENACOES.map((o) => ({ value: o.value, label: o.label }))}
        onSelect={(v) => setOrdem(v as Ordenacao)}
      />
    </View>
  )
}

// ── Altura fixa para getItemLayout (card 98px + padding + margem) ──
const ITEM_HEIGHT = 98 + 12 + 12 // foto + padding sm*2 + marginBottom sm
const keyExtractor = (v: Veiculo) => v.id
const getItemLayout = (_data: unknown, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
})

const VeiculoCard = React.memo(function VeiculoCard({ veiculo, onPress }: { veiculo: Veiculo; onPress: () => void }) {
  const { colors } = useTheme()
  const detalhes = [
    veiculo.ano_fabricacao && veiculo.ano_fabricacao !== veiculo.ano_modelo
      ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}`
      : String(veiculo.ano_modelo),
    veiculo.km != null ? formatKm(veiculo.km) : null,
    veiculo.cambio?.split(' ')[0],
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card onPress={onPress} padded={false} style={{ marginBottom: spacing.sm }}>
      <View style={styles.cardRow}>
        <VehiclePhoto veiculo={veiculo} width={98} height={98} borderRadius={radius.md} />
        <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="bodySemibold" numberOfLines={1} style={{ flex: 1 }}>
              {veiculo.marca} {veiculo.modelo}
            </Txt>
            {veiculo.publicado_marketplace && (
              <Ionicons name="globe-outline" size={14} color={colors.info} />
            )}
          </View>
          {veiculo.versao ? (
            <Txt variant="caption" color="textDim" numberOfLines={1}>{veiculo.versao}</Txt>
          ) : null}
          <Txt variant="caption" color="textMuted" numberOfLines={1}>{detalhes}</Txt>
          <View style={styles.precoRow}>
            <Txt style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>
              {formatBRL(veiculo.preco_venda)}
            </Txt>
            <Badge
              label={STATUS_VEICULO_LABEL[veiculo.status]}
              tone={TONE_STATUS_VEICULO[veiculo.status]}
              size="sm"
            />
          </View>
        </View>
      </View>
    </Card>
  )
})

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  precoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
})
