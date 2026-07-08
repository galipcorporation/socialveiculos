import React, { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Card, EmptyState, ErrorState, FilterChips, ProgressBar, SkeletonCard,
  TONE_ESTAGIO_ESTEIRA, Txt,
} from '../../components/ui'
import { esteiraService } from '../../services'
import { ESTAGIOS_ESTEIRA, type EstagioEsteira, type Esteira } from '../../services/types'
import { formatBRL, formatData } from '../../lib/format'

type Filtro = 'andamento' | EstagioEsteira

const LABEL_ESTAGIO: Record<EstagioEsteira, string> = {
  contrato: 'Contrato',
  pagamento: 'Pagamento',
  documentos: 'Documentos',
  transferencia: 'Transferência',
  concluido: 'Concluídas',
}

export default function PosVendaScreen() {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('andamento')

  const q = useQuery({ queryKey: ['esteiras'], queryFn: () => esteiraService.listar() })
  const todas = q.data ?? []
  const emAndamento = useMemo(() => todas.filter((e) => e.estagio !== 'concluido'), [todas])

  const filtradas = useMemo(
    () => (filtro === 'andamento' ? emAndamento : todas.filter((e) => e.estagio === filtro)),
    [todas, emAndamento, filtro]
  )

  const chips = [
    { value: 'andamento' as const, label: 'Em andamento', count: emAndamento.length },
    ...ESTAGIOS_ESTEIRA.map((e) => ({
      value: e.key as Filtro,
      label: e.label,
      count: todas.filter((x) => x.estagio === e.key).length,
    })),
    { value: 'concluido' as const, label: 'Concluídas', count: todas.filter((x) => x.estagio === 'concluido').length },
  ]

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Pós-venda"
        subtitle={q.isSuccess ? `${emAndamento.length} vendas em andamento` : undefined}
        back
        bottom={<FilterChips options={chips} selected={filtro} onSelect={setFiltro} />}
      />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <EsteiraCard
              esteira={item}
              onPress={() => navigation.navigate('EsteiraDetalhe', { id: item.id })}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['esteiras'] })}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-outline"
              title="Nada por aqui"
              subtitle="Registre uma venda no estoque para abrir a esteira de pós-venda."
            />
          }
        />
      )}
    </View>
  )
}

function EsteiraCard({ esteira, onPress }: { esteira: Esteira; onPress: () => void }) {
  const { colors } = useTheme()
  const total = esteira.itens.length
  const feitos = esteira.itens.filter((i) => i.status === 'concluido').length
  const vencidos = esteira.itens.filter((i) => i.vencido).length
  const proximo = esteira.itens.find((i) => i.status !== 'concluido' && i.status !== 'nao_aplicavel')

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <View style={styles.topo}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodySemibold" numberOfLines={1}>{esteira.veiculo_nome}</Txt>
          <Txt variant="caption" color="textDim" numberOfLines={1}>
            {esteira.comprador_nome} · {formatBRL(esteira.valor_venda)}
          </Txt>
        </View>
        <Badge label={LABEL_ESTAGIO[esteira.estagio]} tone={TONE_ESTAGIO_ESTEIRA[esteira.estagio]} size="sm" />
      </View>

      <ProgressBar
        progress={total ? feitos / total : 0}
        color={esteira.estagio === 'concluido' ? colors.success : colors.primary}
        style={{ marginTop: spacing.sm }}
      />
      <View style={styles.rodape}>
        <Txt variant="caption" color="textMuted">
          {feitos}/{total} etapas · aberta em {formatData(esteira.aberta_em)}
        </Txt>
        {vencidos > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="warning" size={13} color={colors.error} />
            <Txt variant="caption" color="error">{vencidos} vencido{vencidos > 1 ? 's' : ''}</Txt>
          </View>
        ) : proximo ? (
          <Txt variant="caption" color="textDim" numberOfLines={1} style={{ maxWidth: '55%' }}>
            Próximo: {proximo.titulo}
          </Txt>
        ) : null}
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
