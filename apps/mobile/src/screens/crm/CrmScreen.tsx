import React, { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Card, EmptyState, ErrorState, Fab, FilterChips, SkeletonCard,
  TONE_ETAPA_LEAD, Txt,
} from '../../components/ui'
import { leadsService } from '../../services'
import { ETAPAS_LEAD, ORIGEM_LEAD_LABEL, type EtapaLead, type Lead } from '../../services/types'
import { formatBRL, formatRelativo } from '../../lib/format'

type Filtro = EtapaLead | 'ativos'

export default function CrmScreen() {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('ativos')

  const leadsQ = useQuery({
    queryKey: ['leads', 'lista'],
    queryFn: () => leadsService.listar(),
  })

  const todos = leadsQ.data ?? []
  const ativos = useMemo(() => todos.filter((l) => l.etapa !== 'perdido'), [todos])

  const filtrados = useMemo(
    () => (filtro === 'ativos' ? ativos : todos.filter((l) => l.etapa === filtro)),
    [todos, ativos, filtro]
  )

  const chips = [
    { value: 'ativos' as const, label: 'Funil', count: ativos.length },
    ...ETAPAS_LEAD.map((e) => ({
      value: e.value,
      label: e.label,
      count: todos.filter((l) => l.etapa === e.value).length,
    })),
  ]

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="CRM"
        subtitle={leadsQ.isSuccess ? `${ativos.length} leads no funil` : undefined}
        bottom={<FilterChips options={chips} selected={filtro} onSelect={setFiltro} />}
      />

      {leadsQ.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : leadsQ.isError ? (
        <ErrorState onRetry={() => leadsQ.refetch()} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <LeadCard lead={item} onPress={() => navigation.navigate('LeadDetalhe', { id: item.id })} />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={leadsQ.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={filtro === 'ativos' ? 'Nenhum lead no funil' : 'Nenhum lead nesta etapa'}
              subtitle="Cadastre um novo lead para começar a negociar."
              actionLabel="Novo lead"
              onAction={() => navigation.navigate('LeadForm')}
            />
          }
        />
      )}

      <Fab icon="person-add" label="Lead" onPress={() => navigation.navigate('LeadForm')} />
    </View>
  )
}

function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const { colors } = useTheme()
  const etapa = ETAPAS_LEAD.find((e) => e.value === lead.etapa)

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <View style={styles.topo}>
        <Avatar nome={lead.cliente?.nome} size={42} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodySemibold" numberOfLines={1}>{lead.cliente?.nome ?? 'Cliente'}</Txt>
          <Txt variant="caption" color="textDim" numberOfLines={1}>
            {lead.veiculo
              ? `${lead.veiculo.marca} ${lead.veiculo.modelo}`
              : 'Sem veículo definido'}
          </Txt>
        </View>
        <Badge label={etapa?.label ?? lead.etapa} tone={TONE_ETAPA_LEAD[lead.etapa]} size="sm" />
      </View>
      <View style={styles.rodape}>
        <Txt variant="caption" color="textMuted">
          {ORIGEM_LEAD_LABEL[lead.origem]} · {formatRelativo(lead.updated_at)}
        </Txt>
        {lead.valor_proposta != null && (
          <Txt style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }}>
            {formatBRL(lead.valor_proposta)}
          </Txt>
        )}
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
    marginTop: spacing.sm,
  },
})
