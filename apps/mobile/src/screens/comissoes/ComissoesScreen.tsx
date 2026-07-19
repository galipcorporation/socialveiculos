import React, { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Card, EmptyState, ErrorState, SegmentedControl, SkeletonCard, Txt,
} from '../../components/ui'
import { comissoesService } from '../../services'
import type { MinhaVenda } from '../../services/types'
import { formatBRL, formatData } from '../../lib/format'

type Filtro = 'todas' | 'pendentes' | 'pagas'

export default function ComissoesScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const q = useQuery({ queryKey: ['comissoes'], queryFn: () => comissoesService.minhasVendas() })
  const vendas = q.data ?? []

  const filtradas = useMemo(() => {
    if (filtro === 'pendentes') return vendas.filter((v) => v.comissao_paga === false)
    if (filtro === 'pagas') return vendas.filter((v) => v.comissao_paga === true)
    return vendas
  }, [vendas, filtro])

  const pendente = vendas
    .filter((v) => v.comissao_paga === false)
    .reduce((acc, v) => acc + (v.comissao_valor ?? 0), 0)
  const recebido = vendas
    .filter((v) => v.comissao_paga === true)
    .reduce((acc, v) => acc + (v.comissao_valor ?? 0), 0)

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Minhas comissões" back />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(v) => v.esteira_id}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Card style={{ flex: 1 }}>
                  <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>A receber</Txt>
                  <Txt style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.warning }}>
                    {formatBRL(pendente)}
                  </Txt>
                </Card>
                <Card style={{ flex: 1 }}>
                  <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Recebido</Txt>
                  <Txt style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.success }}>
                    {formatBRL(recebido)}
                  </Txt>
                </Card>
              </View>
              <SegmentedControl
                options={[
                  { value: 'todas', label: 'Todas' },
                  { value: 'pendentes', label: 'Pendentes' },
                  { value: 'pagas', label: 'Pagas' },
                ]}
                selected={filtro}
                onSelect={setFiltro}
              />
            </View>
          }
          renderItem={({ item }) => (
            <VendaCard
              venda={item}
              onPress={() => navigation.navigate('EsteiraDetalhe', { id: item.esteira_id })}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['comissoes'] })}
          ListEmptyComponent={
            <EmptyState
              icon="ribbon-outline"
              title="Nenhuma venda sua ainda"
              subtitle="Quando você registrar vendas, suas comissões aparecem aqui."
            />
          }
        />
      )}
    </View>
  )
}

function percentual(v: MinhaVenda): string {
  if (v.comissao_percentual) return `${v.comissao_percentual}%`
  if (v.comissao_valor) return 'excedente da troca'
  return '—'
}

function VendaCard({ venda, onPress }: { venda: MinhaVenda; onPress: () => void }) {
  const { colors } = useTheme()
  const definir = venda.comissao_paga == null || (!venda.comissao_valor && !venda.comissao_paga)

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <View style={styles.topo}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodySemibold" numberOfLines={1}>{venda.veiculo_nome ?? 'Veículo'}</Txt>
          <Txt variant="caption" color="textDim">
            Venda {formatBRL(venda.valor_venda)} · {formatData(venda.aberta_em)}
          </Txt>
        </View>
        {definir ? (
          <Badge label="Definir %" tone="error" size="sm" />
        ) : venda.comissao_paga ? (
          <Badge label="Paga" tone="success" size="sm" />
        ) : (
          <Badge label="Pendente" tone="warning" size="sm" />
        )}
      </View>
      <View style={styles.rodape}>
        <Txt variant="caption" color="textMuted">Comissão ({percentual(venda)})</Txt>
        <Txt
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 17,
            color: venda.comissao_paga ? colors.success : colors.text,
          }}
        >
          {formatBRL(venda.comissao_valor)}
        </Txt>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
})
