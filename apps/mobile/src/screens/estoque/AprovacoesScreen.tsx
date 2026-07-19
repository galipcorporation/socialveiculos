import React from 'react'
import { FlatList, View } from 'react-native'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, FilterChips, Screen, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { veiculosService } from '../../services'
import type { SolicitacaoAprovacao, StatusSolicitacao } from '../../services/types'
import { formatBRL, formatRelativo } from '../../lib/format'
import { useState } from 'react'

const TONE: Record<StatusSolicitacao, 'warning' | 'success' | 'error'> = {
  pendente: 'warning',
  aprovada: 'success',
  rejeitada: 'error',
}

export default function AprovacoesScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<StatusSolicitacao>('pendente')

  const q = useQuery({ queryKey: ['solicitacoes', filtro], queryFn: () => veiculosService.solicitacoes(filtro) })

  const resolverMut = useMutation({
    mutationFn: (p: { id: string; aprovar: boolean }) => veiculosService.resolverSolicitacao(p.id, p.aprovar),
    onSuccess: (_r, p) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
      toast.show('success', p.aprovar ? 'Solicitação aprovada.' : 'Solicitação rejeitada.')
    },
  })

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader
        title="Aprovações"
        large={false}
        back
        bottom={
          <FilterChips
            options={[
              { value: 'pendente', label: 'Pendentes' },
              { value: 'aprovada', label: 'Aprovadas' },
              { value: 'rejeitada', label: 'Rejeitadas' },
            ]}
            selected={filtro}
            onSelect={(v) => setFiltro(v as StatusSolicitacao)}
          />
        }
      />
      {q.isLoading ? (
        <View style={{ padding: spacing.md }}>{[0, 1].map((i) => <SkeletonCard key={i} withImage={false} />)}</View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="Nada por aqui" subtitle={filtro === 'pendente' ? 'Sem solicitações pendentes.' : 'Nenhuma solicitação neste filtro.'} />}
          renderItem={({ item }) => <SolicitacaoCard sol={item} onResolver={(aprovar) => resolverMut.mutate({ id: item.id, aprovar })} loading={resolverMut.isPending} />}
        />
      )}
    </Screen>
  )
}

function SolicitacaoCard({ sol, onResolver, loading }: { sol: SolicitacaoAprovacao; onResolver: (aprovar: boolean) => void; loading: boolean }) {
  const { colors } = useTheme()
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Badge label={sol.tipo === 'exclusao' ? 'Exclusão' : 'Alteração de preço'} tone={sol.tipo === 'exclusao' ? 'error' : 'warning'} size="sm" />
        <Badge label={sol.status === 'pendente' ? 'Pendente' : sol.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'} tone={TONE[sol.status]} size="sm" />
        <View style={{ flex: 1 }} />
        <Txt variant="caption" color="textMuted">{formatRelativo(sol.created_at)}</Txt>
      </View>
      <Txt variant="bodySemibold" numberOfLines={1}>{sol.veiculo_nome}</Txt>
      {sol.tipo === 'alteracao_preco' && (
        <Txt variant="caption" color="textDim">
          {formatBRL(sol.preco_atual)} → <Txt variant="captionMedium" style={{ color: colors.primaryText }}>{formatBRL(sol.novo_preco)}</Txt>
        </Txt>
      )}
      <Txt variant="caption" color="textDim">Solicitante: {sol.solicitante_nome}</Txt>
      <Txt variant="caption" color="textMuted">Motivo: {sol.motivo}</Txt>
      {sol.status === 'pendente' && (
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
          <Button title="Aprovar" variant="success" size="sm" icon="checkmark" loading={loading} onPress={() => onResolver(true)} style={{ flex: 1 }} />
          <Button title="Rejeitar" variant="outline" size="sm" onPress={() => onResolver(false)} style={{ flex: 1, borderColor: colors.error }} />
        </View>
      )}
    </Card>
  )
}
