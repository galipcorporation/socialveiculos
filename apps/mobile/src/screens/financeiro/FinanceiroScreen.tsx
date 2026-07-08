import React, { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, ErrorState, Fab, FilterChips, Input, KpiCard,
  Sheet, SegmentedControl, SkeletonCard, TONE_TIPO_LANCAMENTO, Txt, useToast,
} from '../../components/ui'
import { financeiroService } from '../../services'
import type { Lancamento, TipoLancamento } from '../../services/types'
import { formatBRL, formatBRLCompact, formatData, maskMoedaInput, parseMoedaInput } from '../../lib/format'

type Filtro = TipoLancamento | 'todos'

const TIPO_LABEL: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  comissao: 'Comissão',
}

export default function FinanceiroScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [novoAberto, setNovoAberto] = useState(false)

  const resumoQ = useQuery({ queryKey: ['financeiro', 'resumo'], queryFn: () => financeiroService.resumo() })
  const listaQ = useQuery({
    queryKey: ['financeiro', 'lancamentos', filtro],
    queryFn: () => financeiroService.lancamentos(filtro),
  })

  const r = resumoQ.data

  const chips = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'receita' as const, label: 'Receitas' },
    { value: 'despesa' as const, label: 'Despesas' },
    { value: 'comissao' as const, label: 'Comissões' },
  ]

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Financeiro" subtitle="Movimentações do mês" back />
      {listaQ.isError ? (
        <ErrorState onRetry={() => listaQ.refetch()} />
      ) : (
        <FlatList
          data={listaQ.data ?? []}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              {/* Saldo do mês */}
              <Card>
                <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>
                  Saldo do mês
                </Txt>
                <Txt
                  style={{
                    fontFamily: fonts.displayExtraBold,
                    fontSize: 30,
                    color: (r?.saldo ?? 0) >= 0 ? colors.success : colors.error,
                  }}
                >
                  {resumoQ.isLoading ? '—' : formatBRL(r?.saldo)}
                </Txt>
                <Txt variant="caption" color="textDim">
                  Receitas − despesas − comissões (mês corrente)
                </Txt>
              </Card>
              <View style={styles.kpis}>
                <KpiCard label="Receitas" value={formatBRLCompact(r?.receitas)} icon="trending-up" tone="success" loading={resumoQ.isLoading} />
                <KpiCard label="Despesas" value={formatBRLCompact(r?.despesas)} icon="trending-down" tone="error" loading={resumoQ.isLoading} />
              </View>
              <View style={styles.kpis}>
                <KpiCard label="Custo do estoque" value={formatBRLCompact(r?.custo_estoque)} icon="car-sport" tone="neutral" loading={resumoQ.isLoading} />
                <KpiCard label="Comissões pendentes" value={formatBRLCompact(r?.comissoes_pendentes)} icon="time" tone="warning" loading={resumoQ.isLoading} />
              </View>
              <FilterChips options={chips} selected={filtro} onSelect={setFiltro} />
            </View>
          }
          renderItem={({ item }) => <LancamentoRow lancamento={item} />}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={listaQ.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['financeiro'] })}
          ListEmptyComponent={
            listaQ.isLoading ? (
              <View>{[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}</View>
            ) : (
              <EmptyState
                icon="wallet-outline"
                title="Sem lançamentos"
                subtitle="Registre receitas e despesas para acompanhar o caixa."
                actionLabel="Novo lançamento"
                onAction={() => setNovoAberto(true)}
              />
            )
          }
        />
      )}

      <Fab icon="add" label="Lançamento" onPress={() => setNovoAberto(true)} />
      <NovoLancamentoSheet visible={novoAberto} onClose={() => setNovoAberto(false)} />
    </View>
  )
}

function LancamentoRow({ lancamento }: { lancamento: Lancamento }) {
  const { colors } = useTheme()
  const negativo = lancamento.tipo !== 'receita'
  return (
    <Card style={{ marginBottom: spacing.xs }}>
      <View style={styles.lancRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyMedium" numberOfLines={1}>{lancamento.descricao}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Badge label={TIPO_LABEL[lancamento.tipo]} tone={TONE_TIPO_LANCAMENTO[lancamento.tipo]} size="sm" />
            {lancamento.status_pagamento === 'pendente' && <Badge label="Pendente" tone="neutral" size="sm" />}
            <Txt variant="caption" color="textMuted">{formatData(lancamento.data)}</Txt>
          </View>
        </View>
        <Txt
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 16,
            color: negativo ? colors.error : colors.success,
          }}
        >
          {negativo ? '−' : '+'} {formatBRL(lancamento.valor)}
        </Txt>
      </View>
    </Card>
  )
}

function NovoLancamentoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tipo, setTipo] = useState<TipoLancamento>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago')

  const mut = useMutation({
    mutationFn: () =>
      financeiroService.criar({
        tipo,
        descricao: descricao.trim(),
        valor: parseMoedaInput(valor),
        status_pagamento: status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDescricao('')
      setValor('')
      onClose()
      toast.show('success', 'Lançamento registrado.')
    },
    onError: () => toast.show('error', 'Não foi possível salvar o lançamento.'),
  })

  const valido = descricao.trim().length >= 3 && parseMoedaInput(valor) > 0

  return (
    <Sheet visible={visible} onClose={onClose} title="Novo lançamento">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'receita', label: 'Receita' },
            { value: 'despesa', label: 'Despesa' },
            { value: 'comissao', label: 'Comissão' },
          ]}
          selected={tipo}
          onSelect={setTipo}
        />
        <Input
          label="Descrição"
          placeholder="Ex.: Lavagem e enceramento — Onix"
          value={descricao}
          onChangeText={setDescricao}
        />
        <Input
          label="Valor"
          placeholder="0,00"
          keyboardType="numeric"
          icon="cash-outline"
          value={valor}
          onChangeText={(t) => setValor(maskMoedaInput(t))}
        />
        <SegmentedControl
          options={[
            { value: 'pago', label: 'Pago' },
            { value: 'pendente', label: 'Pendente' },
          ]}
          selected={status}
          onSelect={setStatus}
        />
        <Button title="Salvar lançamento" loading={mut.isPending} disabled={!valido} onPress={() => mut.mutate()} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: spacing.sm },
  lancRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
