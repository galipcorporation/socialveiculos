import React, { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Card, EmptyState, ErrorState, Fab, FilterChips, SearchBar, SkeletonCard,
  TONE_STATUS_VEICULO, Txt,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { veiculosService } from '../../services'
import { STATUS_VEICULO_LABEL, type Veiculo, type VeiculoStatus } from '../../services/types'
import { formatBRL, formatKm } from '../../lib/format'

type FiltroStatus = VeiculoStatus | 'todos'

export default function EstoqueScreen() {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('todos')

  const listaQ = useQuery({
    queryKey: ['veiculos', 'lista'],
    queryFn: () => veiculosService.listar(),
  })

  const todos = listaQ.data ?? []

  const filtrados = useMemo(() => {
    let lista = todos
    if (status !== 'todos') lista = lista.filter((v) => v.status === status)
    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter((v) =>
        [v.marca, v.modelo, v.versao, v.placa, v.cor, String(v.ano_modelo)]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q))
      )
    }
    return lista
  }, [todos, status, busca])

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

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Estoque"
        subtitle={listaQ.isSuccess ? `${todos.length} veículos na loja` : undefined}
        bottom={
          <View style={{ gap: spacing.sm }}>
            <SearchBar value={busca} onChangeText={setBusca} placeholder="Marca, modelo, placa…" />
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
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <VeiculoCard veiculo={item} onPress={() => navigation.navigate('VeiculoDetalhe', { id: item.id })} />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={listaQ.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['veiculos'] })}
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
    </View>
  )
}

function VeiculoCard({ veiculo, onPress }: { veiculo: Veiculo; onPress: () => void }) {
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
}

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
