import React, { useState } from 'react'
import { FlatList, Linking, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, ErrorState, Fab, Input, OptionSheet, Screen,
  SegmentedControl, SelectField, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { contratosService } from '../../services'
import type { ContratoInput } from '../../services/contratos'
import type { Contrato, StatusContrato } from '../../services/types'
import { STATUS_CONTRATO_LABEL } from '../../services/types'
import { formatBRL, formatData, maskMoedaInput, parseMoedaInput } from '../../lib/format'

const TONE: Record<StatusContrato, 'success' | 'warning' | 'neutral' | 'error'> = {
  assinado: 'success',
  aguardando: 'warning',
  rascunho: 'neutral',
  cancelado: 'error',
}

export default function ContratosScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [selecionado, setSelecionado] = useState<Contrato | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const q = useQuery({ queryKey: ['contratos'], queryFn: () => contratosService.lista() })

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Contratos" large={false} back />
      {q.isLoading ? (
        <View style={{ padding: spacing.md }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: 110 }}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['contratos'] })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nenhum contrato" subtitle="Gere um contrato de compra e venda." actionLabel="Novo contrato" onAction={() => setNovoAberto(true)} />}
          renderItem={({ item }) => (
            <Card onPress={() => setSelecionado(item)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Txt variant="bodySemibold">{item.numero}</Txt>
                    <Badge label={STATUS_CONTRATO_LABEL[item.status]} tone={TONE[item.status]} size="sm" />
                  </View>
                  <Txt variant="caption" color="textDim" numberOfLines={1}>{item.veiculo_nome}</Txt>
                  <Txt variant="caption" color="textMuted" numberOfLines={1}>{item.cliente_nome}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="bodyMedium">{formatBRL(item.valor_venda)}</Txt>
                  <Txt variant="caption" color="textMuted">{formatData(item.created_at)}</Txt>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
              </View>
            </Card>
          )}
        />
      )}

      <Fab icon="add" label="Contrato" onPress={() => setNovoAberto(true)} />
      {selecionado && <DetalheSheet contrato={selecionado} onClose={() => setSelecionado(null)} />}
      <NovoContratoSheet visible={novoAberto} onClose={() => setNovoAberto(false)} />
    </Screen>
  )
}

function DetalheSheet({ contrato, onClose }: { contrato: Contrato; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigation = useNavigation<any>()
  const [abrindoPdf, setAbrindoPdf] = useState(false)
  const [statusSheet, setStatusSheet] = useState(false)

  const statusMut = useMutation({
    mutationFn: (s: StatusContrato) => contratosService.alterarStatus(contrato.id, s),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contratos'] }); toast.show('success', 'Status atualizado.'); onClose() },
  })

  const abrirPdf = async () => {
    setAbrindoPdf(true)
    try {
      const url = await contratosService.pdfUrl(contrato.id)
      const ok = await Linking.canOpenURL(url)
      if (ok) await Linking.openURL(url)
      else toast.show('info', 'Ambiente de demonstração — PDF não disponível offline.')
    } catch {
      toast.show('info', 'Ambiente de demonstração — PDF não disponível offline.')
    } finally {
      setAbrindoPdf(false)
    }
  }

  return (
    <Sheet visible onClose={onClose} title={contrato.numero}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Badge label={STATUS_CONTRATO_LABEL[contrato.status]} tone={TONE[contrato.status]} />
        <Linha label="Tipo" valor={contrato.tipo === 'compra_venda' ? 'Compra e venda' : 'Compra'} />
        <Linha label="Veículo" valor={contrato.veiculo_nome ?? '—'} />
        <Linha label="Cliente" valor={contrato.cliente_nome ?? '—'} />
        <Linha label="Valor da venda" valor={formatBRL(contrato.valor_venda)} />
        {contrato.valor_entrada != null && <Linha label="Entrada" valor={formatBRL(contrato.valor_entrada)} />}
        {contrato.parcelas ? <Linha label="Parcelas" valor={`${contrato.parcelas}x`} /> : null}
        <Linha label="Criado em" valor={formatData(contrato.created_at)} />

        <SelectField label="Status" value={STATUS_CONTRATO_LABEL[contrato.status]} onPress={() => setStatusSheet(true)} icon="swap-horizontal-outline" containerStyle={{ marginTop: spacing.xs }} />
        <Button title="Abrir PDF do contrato" icon="document-outline" loading={abrindoPdf} onPress={abrirPdf} full />
        {contrato.tipo === 'compra_venda' && (
          <Button title="Emitir NF-e deste contrato" variant="tonal" icon="receipt-outline" onPress={() => { onClose(); navigation.navigate('NotasFiscais') }} full />
        )}
      </View>

      <OptionSheet
        visible={statusSheet}
        onClose={() => setStatusSheet(false)}
        title="Status do contrato"
        selected={contrato.status}
        options={(Object.keys(STATUS_CONTRATO_LABEL) as StatusContrato[]).map((s) => ({ value: s, label: STATUS_CONTRATO_LABEL[s] }))}
        onSelect={(s) => statusMut.mutate(s as StatusContrato)}
      />
    </Sheet>
  )
}

function NovoContratoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tipo, setTipo] = useState<'compra_venda' | 'compra'>('compra_venda')
  const [veiculo, setVeiculo] = useState('')
  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [entrada, setEntrada] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!veiculo.trim() || !cliente.trim()) { toast.show('error', 'Informe veículo e cliente.'); return }
    setSalvando(true)
    try {
      const input: ContratoInput = {
        tipo,
        veiculo_nome: veiculo.trim(),
        cliente_nome: cliente.trim(),
        valor_venda: parseMoedaInput(valor) || undefined,
        valor_entrada: parseMoedaInput(entrada) || undefined,
        parcelas: parseInt(parcelas.replace(/\D/g, ''), 10) || undefined,
        observacoes: obs.trim() || undefined,
      }
      await contratosService.criar(input)
      await queryClient.invalidateQueries({ queryKey: ['contratos'] })
      toast.show('success', 'Contrato criado.')
      setVeiculo(''); setCliente(''); setValor(''); setEntrada(''); setParcelas(''); setObs('')
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Novo contrato">
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <SegmentedControl
          options={[{ value: 'compra_venda', label: 'Compra e venda' }, { value: 'compra', label: 'Compra' }]}
          selected={tipo}
          onSelect={(v) => setTipo(v as 'compra_venda' | 'compra')}
        />
        <Input label="Veículo" value={veiculo} onChangeText={setVeiculo} placeholder="Ex.: Toyota Corolla Cross" />
        <Input label="Cliente" value={cliente} onChangeText={setCliente} placeholder="Nome do cliente" />
        <Input label="Valor" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} keyboardType="numeric" placeholder="0,00" icon="cash-outline" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="Entrada" value={entrada} onChangeText={(t) => setEntrada(maskMoedaInput(t))} keyboardType="numeric" placeholder="0,00" containerStyle={{ flex: 1 }} />
          <Input label="Parcelas" value={parcelas} onChangeText={(t) => setParcelas(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="48" containerStyle={{ width: 90 }} />
        </View>
        <Input label="Observações" value={obs} onChangeText={setObs} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
        <Button title="Criar contrato" icon="checkmark" loading={salvando} onPress={salvar} full />
      </View>
    </Sheet>
  )
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Txt variant="caption" color="textDim">{label}</Txt>
      <Txt variant="captionMedium" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>{valor}</Txt>
    </View>
  )
}
