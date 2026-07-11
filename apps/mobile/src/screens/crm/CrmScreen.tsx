import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Card, EmptyState, ErrorState, Fab, FilterChips, OptionSheet,
  SearchBar, SkeletonCard, TONE_ETAPA_LEAD, Txt, useToast,
} from '../../components/ui'
import { leadsService } from '../../services'
import { ETAPAS_LEAD, ORIGEM_LEAD_LABEL, type EtapaLead, type Lead } from '../../services/types'
import { formatBRL, formatRelativo } from '../../lib/format'

type Filtro = EtapaLead | 'ativos'

export default function CrmScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [busca, setBusca] = useState('')
  const [etapaLead, setEtapaLead] = useState<Lead | null>(null)

  const leadsQ = useQuery({
    queryKey: ['leads', 'lista'],
    queryFn: () => leadsService.listar(),
  })

  const etapaMut = useMutation({
    mutationFn: (p: { id: string; etapa: EtapaLead }) => leadsService.moverEtapa(p.id, p.etapa),
    onSuccess: (l) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const label = ETAPAS_LEAD.find((e) => e.value === l.etapa)?.label
      toast.show('success', `Lead movido para "${label}".`)
    },
  })

  const todos = leadsQ.data ?? []
  const ativos = useMemo(() => todos.filter((l) => l.etapa !== 'perdido'), [todos])

  const filtradosPorEtapa = useMemo(
    () => (filtro === 'ativos' ? ativos : todos.filter((l) => l.etapa === filtro)),
    [todos, ativos, filtro]
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return filtradosPorEtapa
    return filtradosPorEtapa.filter((l) =>
      (l.cliente?.nome ?? '').toLowerCase().includes(q) ||
      (l.veiculo ? `${l.veiculo.marca} ${l.veiculo.modelo}`.toLowerCase().includes(q) : false) ||
      (l.cliente?.telefone ?? '').includes(q)
    )
  }, [filtradosPorEtapa, busca])

  const chips = [
    { value: 'ativos' as const, label: 'Ativos', count: ativos.length },
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
        bottom={
          <View style={{ gap: spacing.sm }}>
            <SearchBar value={busca} onChangeText={setBusca} placeholder="Buscar por nome, veículo ou telefone" />
            <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
              <Pressable
                onPress={() => navigation.navigate('Clientes')}
                style={[styles.chipFixo, { backgroundColor: colors.success + '24', borderColor: colors.success + '4d' }]}
              >
                <Ionicons name="person-outline" size={14} color={colors.success} />
                <Txt style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.success }}>Clientes</Txt>
              </Pressable>
              <FilterChips options={chips} selected={filtro} onSelect={setFiltro} style={{ paddingVertical: 0 }} />
            </View>
          </View>
        }
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
            <LeadCard
              lead={item}
              onPress={() => navigation.navigate('LeadDetalhe', { id: item.id })}
              onLongPress={() => {
                Haptics.selectionAsync().catch(() => {})
                setEtapaLead(item)
              }}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={leadsQ.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={busca ? 'Nenhum lead encontrado' : filtro === 'ativos' ? 'Nenhum lead no funil' : 'Nenhum lead nesta etapa'}
              subtitle="Cadastre um novo lead para começar a negociar."
              actionLabel="Novo lead"
              onAction={() => navigation.navigate('LeadForm')}
            />
          }
        />
      )}

      <Fab icon="person-add" label="Lead" onPress={() => navigation.navigate('LeadForm')} />

      <OptionSheet
        visible={etapaLead !== null}
        onClose={() => setEtapaLead(null)}
        title="Mover para etapa"
        selected={etapaLead?.etapa}
        options={ETAPAS_LEAD.map((e) => ({ value: e.value, label: e.label }))}
        onSelect={(e) => {
          if (etapaLead) etapaMut.mutate({ id: etapaLead.id, etapa: e })
          setEtapaLead(null)
        }}
      />
    </View>
  )
}

function LeadCard({ lead, onPress, onLongPress }: { lead: Lead; onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme()
  const etapa = ETAPAS_LEAD.find((e) => e.value === lead.etapa)

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={{ marginBottom: spacing.sm }}>
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
  chipFixo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: radius.full, borderWidth: 1,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
})
