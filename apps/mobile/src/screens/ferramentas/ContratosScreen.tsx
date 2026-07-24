import React, { useEffect, useRef, useState } from 'react'
import { FlatList, Linking, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, ErrorState, Fab, Input, OptionSheet, Screen,
  SegmentedControl, SelectField, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { clientesService, contratosService, veiculosService } from '../../services'
import type { CampoExtraTemplate, ContratoInput, TemplateContrato } from '../../services/contratos'
import { CATALOGO_VARIAVEIS, labelsDe } from '../../services/contratos'
import { RichEditor } from '../../components/RichEditor'
import type { Contrato, StatusContrato } from '../../services/types'
import { STATUS_CONTRATO_LABEL } from '../../services/types'
import { formatBRL, formatData, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const TONE: Record<StatusContrato, 'success' | 'warning' | 'neutral' | 'error'> = {
  assinado: 'success',
  aguardando: 'warning',
  rascunho: 'neutral',
  cancelado: 'error',
}

export default function ContratosScreen({ route }: RootScreenProps<'Contratos'>) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [selecionado, setSelecionado] = useState<Contrato | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [aba, setAba] = useState<'contratos' | 'modelos'>('contratos')
  const contratoId = route.params?.contratoId
  const listRef = useRef<FlatList<Contrato>>(null)

  const q = useQuery({ queryKey: ['contratos'], queryFn: () => contratosService.lista() })

  useEffect(() => {
    if (!contratoId || !q.data) return
    const idx = q.data.findIndex((c) => c.id === contratoId)
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 })
    }
  }, [contratoId, q.data])

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader
        title="Contratos"
        large={false}
        back
        bottom={
          <SegmentedControl
            options={[{ value: 'contratos', label: 'Contratos' }, { value: 'modelos', label: 'Modelos' }]}
            selected={aba}
            onSelect={(v) => setAba(v as 'contratos' | 'modelos')}
          />
        }
      />
      {aba === 'modelos' ? (
        <ModelosTab />
      ) : q.isLoading ? (
        <View style={{ padding: spacing.md }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          ref={listRef}
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: 110 }}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['contratos'] })}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nenhum contrato" subtitle="Gere um contrato de compra e venda." actionLabel="Novo contrato" onAction={() => setNovoAberto(true)} />}
          renderItem={({ item }) => (
            <Card
              onPress={() => setSelecionado(item)}
              style={item.id === contratoId ? { borderWidth: 2, borderColor: colors.primary } : undefined}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt variant="bodySemibold" numberOfLines={1}>{item.numero}</Txt>
                  <Txt variant="caption" color="textDim" numberOfLines={1}>{item.veiculo_nome}</Txt>
                  <Txt variant="caption" color="textMuted" numberOfLines={1}>{item.cliente_nome}</Txt>
                  <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                    <Badge label={STATUS_CONTRATO_LABEL[item.status]} tone={TONE[item.status]} size="sm" />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  <Txt variant="bodyMedium" numberOfLines={1}>{formatBRL(item.valor_venda)}</Txt>
                  <Txt variant="caption" color="textMuted">{formatData(item.created_at)}</Txt>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
              </View>
            </Card>
          )}
        />
      )}

      {aba === 'contratos' && <Fab icon="add" label="Contrato" onPress={() => setNovoAberto(true)} />}
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
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)

  const statusMut = useMutation({
    mutationFn: (s: StatusContrato) => contratosService.alterarStatus(contrato.id, s),
    onSuccess: (_data, s) => {
      // Cancelar compra e venda desfaz a venda no backend: além dos contratos,
      // invalida estoque, esteiras, financeiro e dashboard.
      queryClient.invalidateQueries()
      setConfirmarCancelamento(false)
      toast.show(
        'success',
        s === 'cancelado' && contrato.tipo === 'compra_venda'
          ? 'Contrato cancelado — veículo voltou ao estoque.'
          : 'Status atualizado.',
      )
      onClose()
    },
    onError: () => toast.show('error', 'Não foi possível alterar o status.'),
  })

  // Cancelar um contrato de compra e venda desfaz a venda — pede confirmação.
  const escolherStatus = (s: StatusContrato) => {
    if (s === contrato.status) { setStatusSheet(false); return }
    if (s === 'cancelado' && contrato.tipo === 'compra_venda') {
      setStatusSheet(false)
      setConfirmarCancelamento(true)
      return
    }
    statusMut.mutate(s)
  }

  const abrirPdf = async () => {
    setAbrindoPdf(true)
    try {
      const url = await contratosService.pdfUrl(contrato.id)
      const ok = await Linking.canOpenURL(url)
      if (ok) await Linking.openURL(url)
      else toast.show('info', 'PDF não disponível offline.')
    } catch {
      toast.show('info', 'PDF não disponível offline.')
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
        onSelect={(s) => escolherStatus(s as StatusContrato)}
      />

      {/* Confirmação: cancelar compra e venda desfaz a venda */}
      <Sheet visible={confirmarCancelamento} onClose={() => setConfirmarCancelamento(false)} title="Cancelar contrato" scrollable={false}>
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <Txt variant="body">Cancelar o contrato {contrato.numero}?</Txt>
          <Txt variant="caption" color="textDim">
            O veículo{contrato.veiculo_nome ? ` "${contrato.veiculo_nome}"` : ''} volta ao estoque como disponível e a esteira
            pós-venda é encerrada. A venda continua registrada no histórico.
          </Txt>
          <Button
            title="Cancelar contrato e desfazer a venda"
            variant="danger"
            icon="close-circle-outline"
            loading={statusMut.isPending}
            onPress={() => statusMut.mutate('cancelado')}
            full
          />
          <Button title="Voltar" variant="ghost" onPress={() => setConfirmarCancelamento(false)} full />
        </View>
      </Sheet>
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
  const [veiculoSheet, setVeiculoSheet] = useState(false)
  const [clienteSheet, setClienteSheet] = useState(false)

  const veiculosQ = useQuery({
    queryKey: ['veiculos', 'contratos'],
    queryFn: () => veiculosService.listar({ status: 'disponivel' }),
    enabled: visible,
  })
  const clientesQ = useQuery({
    queryKey: ['clientes', 'contratos'],
    queryFn: () => clientesService.listar(),
    enabled: visible,
  })

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
        <SelectField
          label="Veículo"
          value={veiculo || undefined}
          placeholder={veiculosQ.isLoading ? 'Carregando…' : 'Escolher do estoque'}
          icon="car-sport-outline"
          onPress={() => setVeiculoSheet(true)}
        />
        <SelectField
          label="Cliente"
          value={cliente || undefined}
          placeholder={clientesQ.isLoading ? 'Carregando…' : 'Escolher cliente'}
          icon="person-outline"
          onPress={() => setClienteSheet(true)}
        />
        <Input label="Valor" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} keyboardType="numeric" placeholder="0,00" icon="cash-outline" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="Entrada" value={entrada} onChangeText={(t) => setEntrada(maskMoedaInput(t))} keyboardType="numeric" placeholder="0,00" containerStyle={{ flex: 1 }} />
          <Input label="Parcelas" value={parcelas} onChangeText={(t) => setParcelas(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="48" containerStyle={{ width: 90 }} />
        </View>
        <Input label="Observações" value={obs} onChangeText={setObs} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
        <Button title="Criar contrato" icon="checkmark" loading={salvando} onPress={salvar} full />
      </View>

      <OptionSheet
        visible={veiculoSheet}
        onClose={() => setVeiculoSheet(false)}
        title="Veículo do estoque"
        options={(veiculosQ.data ?? []).map((v) => ({
          value: v.id,
          label: `${v.marca} ${v.modelo}${v.versao ? ` ${v.versao}` : ''}`,
          sublabel: [v.placa, formatBRL(v.preco_venda)].filter(Boolean).join(' · '),
        }))}
        onSelect={(id) => {
          const v = (veiculosQ.data ?? []).find((x) => x.id === id)
          if (!v) return
          setVeiculo(`${v.marca} ${v.modelo}${v.versao ? ` ${v.versao}` : ''}`)
          if (!valor && v.preco_venda) setValor(maskMoedaInput(String(Math.round(v.preco_venda * 100))))
        }}
      />

      <OptionSheet
        visible={clienteSheet}
        onClose={() => setClienteSheet(false)}
        title="Cliente"
        options={(clientesQ.data ?? []).map((c) => ({
          value: c.id,
          label: c.nome,
          sublabel: [c.telefone, c.cpf].filter(Boolean).join(' · '),
        }))}
        onSelect={(id) => {
          const c = (clientesQ.data ?? []).find((x) => x.id === id)
          if (c) setCliente(c.nome)
        }}
      />
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

function ModelosTab() {
  const queryClient = useQueryClient()
  const [selecionado, setSelecionado] = useState<TemplateContrato | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const toast = useToast()

  const q = useQuery({
    queryKey: ['templates'],
    queryFn: () => contratosService.templates(),
  })

  const dupMut = useMutation({
    mutationFn: (id: string) => contratosService.duplicarTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.show('success', 'Modelo duplicado.')
    },
    onError: (err: any) => {
      toast.show('error', err.message || 'Erro ao duplicar.')
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => contratosService.removerTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.show('success', 'Modelo removido.')
    },
    onError: (err: any) => {
      toast.show('error', err.message || 'Erro ao remover.')
    },
  })

  if (q.isLoading) {
    return (
      <View style={{ padding: spacing.md }}>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} withImage={false} />
        ))}
      </View>
    )
  }

  if (q.isError) {
    return <ErrorState onRetry={() => q.refetch()} />
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: 110 }}
        refreshing={q.isRefetching}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['templates'] })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="Nenhum modelo"
            subtitle="Crie modelos de contrato personalizados."
            actionLabel="Novo modelo"
            onAction={() => setNovoAberto(true)}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => setSelecionado(item)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold">{item.nome}</Txt>
                <Txt variant="caption" color="textDim" numberOfLines={2}>
                  {item.corpo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Button
                  title=""
                  variant="ghost"
                  icon="copy-outline"
                  onPress={() => dupMut.mutate(item.id)}
                  style={{ minWidth: 40, paddingHorizontal: 0 }}
                />
                <Button
                  title=""
                  variant="ghost"
                  icon="trash-outline"
                  onPress={() => delMut.mutate(item.id)}
                  style={{ minWidth: 40, paddingHorizontal: 0 }}
                />
              </View>
            </View>
          </Card>
        )}
      />
      <Fab icon="add" label="Modelo" onPress={() => setNovoAberto(true)} />
      {selecionado && (
        <EditorModeloSheet
          template={selecionado}
          onClose={() => setSelecionado(null)}
        />
      )}
      {novoAberto && (
        <EditorModeloSheet
          onClose={() => setNovoAberto(false)}
        />
      )}
    </View>
  )
}

function EditorModeloSheet({ template, onClose }: { template?: TemplateContrato; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [nome, setNome] = useState(template?.nome || '')
  const [corpo, setCorpo] = useState(template?.corpo || '')
  const [camposExtras, setCamposExtras] = useState<CampoExtraTemplate[]>(template?.camposExtras ?? [])
  const [usarIdentidadeLoja, setUsarIdentidadeLoja] = useState(template?.usarIdentidadeLoja ?? true)
  const [salvando, setSalvando] = useState(false)

  const grupos = camposExtras.length > 0
    ? [...CATALOGO_VARIAVEIS, { grupo: 'Personalizados deste modelo', itens: camposExtras }]
    : CATALOGO_VARIAVEIS
  const labels = labelsDe(grupos)

  const salvar = async () => {
    if (!nome.trim() || !corpo.trim()) {
      toast.show('error', 'Preencha nome e corpo do modelo.')
      return
    }
    setSalvando(true)
    try {
      await contratosService.salvarTemplate({
        id: template?.id,
        nome: nome.trim(),
        corpo,
        camposExtras,
        usarIdentidadeLoja,
      })
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.show('success', 'Modelo salvo.')
      onClose()
    } catch (err: any) {
      toast.show('error', err.message || 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const adicionarCampoPersonalizado = (chave: string, label: string) => {
    if (camposExtras.some((c) => c.chave === chave)) return
    setCamposExtras((prev) => [...prev, { chave, label }])
  }

  const removerCampoPersonalizado = (chave: string) => {
    setCamposExtras((prev) => prev.filter((c) => c.chave !== chave))
  }

  return (
    <Sheet visible onClose={onClose} title={template ? 'Editar Modelo' : 'Novo Modelo'}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Input
          label="Nome do modelo"
          value={nome}
          onChangeText={setNome}
          placeholder="Ex: Compra e venda padrão"
        />

        <Txt variant="captionMedium" color="textDim">Texto do contrato</Txt>
        <RichEditor
          value={corpo}
          onChange={setCorpo}
          variaveis={grupos}
          labels={labels}
          minHeight={220}
          placeholder="Digite o corpo do contrato…"
          onAddCampoPersonalizado={adicionarCampoPersonalizado}
          onRemoveCampoPersonalizado={removerCampoPersonalizado}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Txt variant="captionMedium">Usar identidade da loja</Txt>
            <Txt variant="caption" color="textMuted">Aplica cabeçalho, rodapé e marca-d'água configurados nas Configurações da loja.</Txt>
          </View>
          <Switch value={usarIdentidadeLoja} onValueChange={setUsarIdentidadeLoja} />
        </View>

        <Button
          title={template ? 'Salvar Alterações' : 'Criar Modelo'}
          icon="checkmark"
          loading={salvando}
          onPress={salvar}
          full
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </Sheet>
  )
}
