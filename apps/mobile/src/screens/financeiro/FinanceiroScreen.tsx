import React, { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, ErrorState, Fab, FilterChips, Input, KpiCard,
  OptionSheet, Sheet, SegmentedControl, SelectField, SkeletonCard, TONE_TIPO_LANCAMENTO, Txt, useToast,
} from '../../components/ui'
import { financeiroService, veiculosService } from '../../services'
import type { PeriodoFinanceiro } from '../../services/financeiro'
import type { Lancamento, TipoLancamento } from '../../services/types'
import { formatBRL, formatBRLCompact, formatData, maskMoedaInput, parseMoedaInput } from '../../lib/format'

type Filtro = TipoLancamento | 'todos'

const TIPO_LABEL: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  comissao: 'Comissão',
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function FinanceiroScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [novoAberto, setNovoAberto] = useState(false)
  const [periodo, setPeriodo] = useState<PeriodoFinanceiro>({ mes: new Date().getMonth(), ano: new Date().getFullYear() })
  const [periodoSheet, setPeriodoSheet] = useState(false)
  const [acaoLanc, setAcaoLanc] = useState<Lancamento | null>(null)
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [lixeiraAberta, setLixeiraAberta] = useState(false)

  const chave = `${periodo.ano}-${periodo.mes}`
  const resumoQ = useQuery({ queryKey: ['financeiro', 'resumo', chave], queryFn: () => financeiroService.resumo(periodo) })
  const listaQ = useQuery({
    queryKey: ['financeiro', 'lancamentos', filtro, chave],
    queryFn: () => financeiroService.lancamentos(filtro, periodo),
  })

  const togglePagMut = useMutation({
    mutationFn: (idL: string) => financeiroService.alternarPagamento(idL),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financeiro'] }); setAcaoLanc(null); toast.show('success', 'Status atualizado.') },
  })
  const excluirMut = useMutation({
    mutationFn: (p: { id: string; motivo: string }) => financeiroService.excluir(p.id, p.motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      setExcluindo(null); setMotivo(''); setAcaoLanc(null)
      toast.show('success', 'Lançamento movido para a lixeira.')
    },
    onError: () => toast.show('error', 'Não foi possível excluir o lançamento.'),
  })

  const lixeiraQ = useQuery({
    queryKey: ['financeiro', 'lixeira'],
    queryFn: () => financeiroService.lixeira(),
    enabled: lixeiraAberta,
  })
  const restaurarMut = useMutation({
    mutationFn: (idL: string) => financeiroService.restaurar(idL),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financeiro'] }); toast.show('success', 'Lançamento restaurado.') },
    onError: () => toast.show('error', 'Não foi possível restaurar o lançamento.'),
  })

  const confirmarExclusao = () => {
    if (!excluindo) return
    if (motivo.trim().length < 3) { toast.show('info', 'Informe o motivo da exclusão (mín. 3 caracteres).'); return }
    excluirMut.mutate({ id: excluindo.id, motivo: motivo.trim() })
  }

  const periodoLabel = periodo.mes === 'todos' ? `${periodo.ano}` : `${MESES[periodo.mes as number]} ${periodo.ano}`
  const r = resumoQ.data

  const chips = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'receita' as const, label: 'Receitas' },
    { value: 'despesa' as const, label: 'Despesas' },
    { value: 'comissao' as const, label: 'Comissões' },
  ]

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Financeiro" subtitle={periodoLabel} back />
      {listaQ.isError ? (
        <ErrorState onRetry={() => listaQ.refetch()} />
      ) : (
        <FlatList
          data={listaQ.data ?? []}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <SelectField label="Período" value={periodoLabel} icon="calendar-outline" onPress={() => setPeriodoSheet(true)} />
                </View>
                <Button title="Lixeira" size="sm" variant="ghost" icon="trash-outline" onPress={() => setLixeiraAberta(true)} />
              </View>
              {/* Saldo do período */}
              <Card>
                <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>
                  Saldo do período
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
          renderItem={({ item }) => <LancamentoRow lancamento={item} onPress={() => setAcaoLanc(item)} />}
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

      {/* Período (mês + ano) */}
      <OptionSheet
        visible={periodoSheet}
        onClose={() => setPeriodoSheet(false)}
        title="Período"
        selected={periodo.mes === 'todos' ? 'todos' : String(periodo.mes)}
        options={[
          { value: 'todos', label: `Ano inteiro (${periodo.ano})` },
          ...MESES.map((m, i) => ({ value: String(i), label: `${m} ${periodo.ano}` })),
        ]}
        onSelect={(v) => setPeriodo((p) => ({ ...p, mes: v === 'todos' ? 'todos' : Number(v) }))}
      />

      {/* Ações do lançamento */}
      <Sheet visible={acaoLanc !== null} onClose={() => setAcaoLanc(null)} title={acaoLanc?.descricao} scrollable={false}>
        {acaoLanc && (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            <Txt variant="caption" color="textDim">{formatBRL(acaoLanc.valor)} · {acaoLanc.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}</Txt>
            <Button
              title={acaoLanc.status_pagamento === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}
              variant="tonal"
              icon="swap-horizontal-outline"
              loading={togglePagMut.isPending}
              onPress={() => togglePagMut.mutate(acaoLanc.id)}
            />
            <Button title="Excluir lançamento" variant="danger" icon="trash-outline" onPress={() => { setExcluindo(acaoLanc); setMotivo(''); setAcaoLanc(null) }} />
            <Button title="Cancelar" variant="ghost" onPress={() => setAcaoLanc(null)} />
          </View>
        )}
      </Sheet>

      {/* Excluir: motivo obrigatório (soft delete) */}
      <Sheet visible={excluindo !== null} onClose={() => { setExcluindo(null); setMotivo('') }} title="Excluir lançamento" scrollable={false}>
        {excluindo && (
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Txt variant="caption" color="textDim">
              {excluindo.descricao} · {formatBRL(excluindo.valor)}. O lançamento vai para a lixeira e pode ser restaurado.
            </Txt>
            <Input
              label="Motivo da exclusão"
              placeholder="Ex.: lançamento duplicado"
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <Button title="Confirmar exclusão" variant="danger" icon="trash-outline" loading={excluirMut.isPending} disabled={motivo.trim().length < 3} onPress={confirmarExclusao} />
            <Button title="Cancelar" variant="ghost" onPress={() => { setExcluindo(null); setMotivo('') }} />
          </View>
        )}
      </Sheet>

      {/* Lixeira: lançamentos excluídos + restaurar */}
      <Sheet visible={lixeiraAberta} onClose={() => setLixeiraAberta(false)} title="Lixeira">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {lixeiraQ.isLoading ? (
            <Txt variant="caption" color="textDim">Carregando…</Txt>
          ) : (lixeiraQ.data ?? []).length === 0 ? (
            <EmptyState icon="trash-outline" title="Lixeira vazia" subtitle="Lançamentos excluídos aparecem aqui e podem ser restaurados." />
          ) : (
            (lixeiraQ.data ?? []).map((l) => (
              <Card key={l.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium" numberOfLines={1}>{l.descricao}</Txt>
                    <Txt variant="caption" color="textMuted">
                      {formatBRL(l.valor)} · excluído por {l.deletado_por_nome ?? '—'}
                    </Txt>
                    {l.motivo_exclusao && (
                      <Txt variant="caption" color="textDim" numberOfLines={2}>Motivo: {l.motivo_exclusao}</Txt>
                    )}
                  </View>
                  <Button title="Restaurar" size="sm" variant="tonal" icon="refresh-outline" loading={restaurarMut.isPending && restaurarMut.variables === l.id} onPress={() => restaurarMut.mutate(l.id)} />
                </View>
              </Card>
            ))
          )}
        </View>
      </Sheet>
    </View>
  )
}

function LancamentoRow({ lancamento, onPress }: { lancamento: Lancamento; onPress: () => void }) {
  const { colors } = useTheme()
  const negativo = lancamento.tipo !== 'receita'
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.xs }}>
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
  const [veiculoNome, setVeiculoNome] = useState<string | undefined>(undefined)
  const [veicSheet, setVeicSheet] = useState(false)

  const veiculosQ = useQuery({ queryKey: ['veiculos', 'financeiro'], queryFn: () => veiculosService.listar(), enabled: visible })

  const mut = useMutation({
    mutationFn: () =>
      financeiroService.criar({
        tipo,
        descricao: descricao.trim(),
        valor: parseMoedaInput(valor),
        status_pagamento: status,
        veiculo_nome: veiculoNome,
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
        <SelectField
          label="Veículo (opcional)"
          value={veiculoNome}
          placeholder="Vincular a um veículo"
          icon="car-sport-outline"
          onPress={() => setVeicSheet(true)}
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
      <OptionSheet
        visible={veicSheet}
        onClose={() => setVeicSheet(false)}
        title="Vincular veículo"
        selected={veiculoNome}
        options={[
          { value: '', label: 'Nenhum' },
          ...(veiculosQ.data ?? []).map((v) => ({ value: `${v.marca} ${v.modelo}`, label: `${v.marca} ${v.modelo}`, sublabel: v.placa })),
        ]}
        onSelect={(val) => setVeiculoNome(val || undefined)}
      />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: spacing.sm },
  lancRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
