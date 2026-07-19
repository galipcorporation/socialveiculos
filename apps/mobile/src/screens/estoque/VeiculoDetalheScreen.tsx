import React, { useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  Badge, Button, Card, ErrorState, Input, OptionSheet, SelectField, Sheet, Skeleton,
  TONE_STATUS_VEICULO, Txt, useToast,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { RegistrarVendaSheet } from '../../components/RegistrarVendaSheet'
import { CATEGORIAS_CUSTO, veiculosService } from '../../services'
import {
  STATUS_VEICULO_LABEL, TIPOS_DOC_VENDA, type CategoriaCusto, type TipoDocumentoVenda,
  type TipoSolicitacao, type Veiculo, type VeiculoStatus,
} from '../../services/types'
import { formatBRL, formatKm, formatPlaca, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import type { RootScreenProps } from '../../navigation/types'

export default function VeiculoDetalheScreen({ route }: RootScreenProps<'VeiculoDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const gestor = user?.papel !== 'vendedor'

  const [statusAberto, setStatusAberto] = useState(false)
  const [vendaAberta, setVendaAberta] = useState(false)

  const q = useQuery({
    queryKey: ['veiculos', id],
    queryFn: () => veiculosService.obter(id),
  })
  const v = q.data

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['veiculos'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const statusMut = useMutation({
    mutationFn: (novo: VeiculoStatus) => veiculosService.alterarStatus(id, novo),
    onSuccess: (atualizado) => {
      invalidar()
      toast.show('success', `Status alterado para "${STATUS_VEICULO_LABEL[atualizado.status]}".`)
    },
    onError: () => toast.show('error', 'Não foi possível alterar o status.'),
  })

  const publicarMut = useMutation({
    mutationFn: (publicado: boolean) => veiculosService.alterarPublicacao(id, publicado),
    onSuccess: (atualizado) => {
      invalidar()
      toast.show(
        'success',
        atualizado.publicado_marketplace ? 'Publicado na vitrine.' : 'Removido da vitrine.'
      )
    },
  })

  const compartilhar = () => {
    if (!v) return
    const texto = `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''} ${v.ano_modelo}\n${
      v.km != null ? formatKm(v.km) + ' · ' : ''
    }${formatBRL(v.preco_venda)}\n\nFale com a gente para saber mais!`
    Share.share({ message: texto }).catch(() => {})
  }

  if (q.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ErrorState message="Veículo não encontrado." onRetry={() => navigation.goBack()} />
      </View>
    )
  }

  const margem =
    v?.preco_venda != null && v?.preco_custo != null ? v.preco_venda - v.preco_custo : null

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View>
          {v ? (
            <VehiclePhoto veiculo={v} height={250} borderRadius={0} />
          ) : (
            <Skeleton height={250} style={{ borderRadius: 0 }} />
          )}
          <View style={[styles.heroBar, { top: insets.top + spacing.xs }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.heroBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Pressable onPress={compartilhar} style={styles.heroBtn} hitSlop={8}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('VeiculoForm', { id })}
                style={styles.heroBtn}
                hitSlop={8}
              >
                <Ionicons name="pencil" size={19} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md }}>
          {/* Título + preço */}
          {v ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Badge label={STATUS_VEICULO_LABEL[v.status]} tone={TONE_STATUS_VEICULO[v.status]} />
                {v.publicado_marketplace && <Badge label="Na vitrine" tone="info" />}
              </View>
              <Txt style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text }}>
                {v.marca} {v.modelo}
              </Txt>
              {v.versao ? <Txt variant="body" color="textDim">{v.versao}</Txt> : null}
              <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 28, color: colors.primaryText }}>
                {formatBRL(v.preco_venda)}
              </Txt>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Skeleton width={120} height={22} round />
              <Skeleton width="80%" height={24} />
              <Skeleton width="45%" height={28} />
            </View>
          )}

          {/* Especificações */}
          {v && (
            <Card padded={false}>
              <View style={styles.specGrid}>
                <Spec icon="calendar-outline" label="Ano" value={
                  v.ano_fabricacao && v.ano_fabricacao !== v.ano_modelo
                    ? `${v.ano_fabricacao}/${v.ano_modelo}`
                    : String(v.ano_modelo)
                } />
                {v.km != null && <Spec icon="speedometer-outline" label="Quilometragem" value={formatKm(v.km)} />}
                {v.cambio && <Spec icon="cog-outline" label="Câmbio" value={v.cambio} />}
                {v.combustivel && <Spec icon="flash-outline" label="Combustível" value={v.combustivel} />}
                {v.cor && <Spec icon="color-palette-outline" label="Cor" value={v.cor} />}
                {v.portas != null && <Spec icon="albums-outline" label="Portas" value={String(v.portas)} />}
                {v.placa && <Spec icon="pricetag-outline" label="Placa" value={formatPlaca(v.placa)} />}
              </View>
            </Card>
          )}

          {/* Financeiro (só gestor) */}
          {v && gestor && v.preco_custo != null && (
            <Card>
              <Txt variant="title" style={{ marginBottom: spacing.xs }}>Financeiro</Txt>
              <Linha label="Preço de custo" valor={formatBRL(v.preco_custo)} />
              <Linha label="Preço de venda" valor={formatBRL(v.preco_venda)} />
              {margem != null && (
                <Linha
                  label="Margem bruta"
                  valor={formatBRL(margem)}
                  cor={margem >= 0 ? colors.success : colors.error}
                />
              )}
            </Card>
          )}

          {/* FIPE / precificação (só gestor) */}
          {v && gestor && v.preco_venda != null && <FipeCard veiculoId={v.id} />}

          {/* Custos de preparação (só gestor) */}
          {v && gestor && v.status !== 'vendido' && <CustosCard veiculo={v} />}

          {/* Documentos de venda */}
          {v && <DocumentosCard veiculo={v} />}

          {/* Ações de gestão (excluir / alterar preço) */}
          {v && <AcoesGestaoCard veiculo={v} gestor={gestor} />}

          {/* Opcionais / descrição */}
          {v?.opcionais ? (
            <Card>
              <Txt variant="title" style={{ marginBottom: spacing.xs }}>Opcionais</Txt>
              <View style={styles.chipsWrap}>
                {v.opcionais.split(',').map((o) => (
                  <View key={o} style={[styles.opcional, { backgroundColor: colors.overlaySoft, borderColor: colors.border }]}>
                    <Txt variant="caption" color="textDim">{o.trim()}</Txt>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
          {v?.descricao ? (
            <Card>
              <Txt variant="title" style={{ marginBottom: spacing.xs }}>Descrição</Txt>
              <Txt variant="body" color="textDim">{v.descricao}</Txt>
            </Card>
          ) : null}

          {/* Vitrine + status */}
          {v && (
            <Card>
              <View style={styles.vitrineRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">Publicar na vitrine</Txt>
                  <Txt variant="caption" color="textDim">Visível para clientes no marketplace</Txt>
                </View>
                <Switch
                  value={!!v.publicado_marketplace}
                  onValueChange={(val) => publicarMut.mutate(val)}
                  trackColor={{ false: colors.overlayStrong, true: colors.primary }}
                  thumbColor="#fff"
                  disabled={publicarMut.isPending || v.status === 'vendido'}
                />
              </View>
              <SelectField
                label="Status do veículo"
                value={STATUS_VEICULO_LABEL[v.status]}
                onPress={() => setStatusAberto(true)}
                icon="swap-horizontal-outline"
                containerStyle={{ marginTop: spacing.sm }}
              />
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Barra de ações fixa */}
      {v && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}
        >
          <Button
            title="Simular parcelas"
            variant="tonal"
            icon="calculator-outline"
            onPress={() => navigation.navigate('Simulador', { precoInicial: v.preco_venda })}
            style={{ flex: 1 }}
          />
          {v.status !== 'vendido' && (
            <Button
              title="Registrar venda"
              icon="checkmark-circle-outline"
              onPress={() => setVendaAberta(true)}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}

      {/* Sheets */}
      <OptionSheet
        visible={statusAberto}
        onClose={() => setStatusAberto(false)}
        title="Alterar status"
        selected={v?.status}
        options={(Object.keys(STATUS_VEICULO_LABEL) as VeiculoStatus[]).map((s) => ({
          value: s,
          label: STATUS_VEICULO_LABEL[s],
        }))}
        onSelect={(s) => statusMut.mutate(s)}
      />
      {v && (
        <RegistrarVendaSheet
          veiculo={v}
          visible={vendaAberta}
          onClose={() => setVendaAberta(false)}
        />
      )}
    </View>
  )
}

function Spec({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Txt variant="caption" color="textMuted">{label}</Txt>
        <Txt variant="bodyMedium" numberOfLines={1}>{value}</Txt>
      </View>
    </View>
  )
}

function Linha({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <View style={styles.linha}>
      <Txt variant="caption" color="textDim">{label}</Txt>
      <Txt variant="bodySemibold" style={cor ? { color: cor } : undefined}>{valor}</Txt>
    </View>
  )
}

function FipeCard({ veiculoId }: { veiculoId: string }) {
  const { colors } = useTheme()
  const q = useQuery({ queryKey: ['veiculos', veiculoId, 'precificacao'], queryFn: () => veiculosService.precificacao(veiculoId) })
  const p = q.data
  if (!p) return null
  return (
    <Card>
      <Txt variant="title" style={{ marginBottom: spacing.xs }}>Precificação (FIPE)</Txt>
      <Linha label="Valor FIPE (referência)" valor={formatBRL(p.fipe)} />
      {p.margem_sobre_fipe != null && (
        <Linha
          label="Margem sobre a FIPE"
          valor={`${p.margem_sobre_fipe >= 0 ? '+' : ''}${p.margem_sobre_fipe.toFixed(1)}%`}
          cor={p.margem_sobre_fipe >= 0 ? colors.success : colors.error}
        />
      )}
      <Linha label="Dias em estoque" valor={`${p.dias_estoque} dia(s)`} cor={p.encalhado ? colors.warning : undefined} />
      {p.encalhado && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warning + '14' }}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
          <Txt variant="caption" style={{ flex: 1, color: colors.warning }}>Veículo encalhado (+60 dias). Considere revisar o preço.</Txt>
        </View>
      )}
    </Card>
  )
}

function CustosCard({ veiculo }: { veiculo: Veiculo }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaCusto>('mecanica')
  const [catSheet, setCatSheet] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')

  const q = useQuery({ queryKey: ['veiculos', veiculo.id, 'custos'], queryFn: () => veiculosService.custos(veiculo.id) })
  const custos = q.data ?? []
  const totalCustos = custos.reduce((a, c) => a + c.valor, 0)
  const custoTotal = (veiculo.preco_custo ?? 0) + totalCustos
  const lucroProj = veiculo.preco_venda != null ? veiculo.preco_venda - custoTotal : null

  const addMut = useMutation({
    mutationFn: () => veiculosService.adicionarCusto(veiculo.id, { categoria, descricao: descricao.trim(), valor: parseMoedaInput(valor) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos', veiculo.id, 'custos'] })
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      toast.show('success', 'Custo adicionado (lançado no Financeiro).')
      setDescricao(''); setValor(''); setAberto(false)
    },
  })
  const remMut = useMutation({
    mutationFn: (id: string) => veiculosService.removerCusto(veiculo.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['veiculos', veiculo.id, 'custos'] }),
  })

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Txt variant="title">Custos de preparação</Txt>
        <Pressable onPress={() => setAberto(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {custos.length === 0 ? (
        <Txt variant="caption" color="textDim">Nenhum custo lançado. Adicione mecânica, pintura, pneus…</Txt>
      ) : (
        custos.map((c) => (
          <View key={c.id} style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Txt variant="captionMedium" numberOfLines={1}>{c.descricao}</Txt>
              <Txt variant="caption" color="textMuted">{CATEGORIAS_CUSTO.find((x) => x.value === c.categoria)?.label}</Txt>
            </View>
            <Txt variant="captionMedium">{formatBRL(c.valor)}</Txt>
            <Pressable onPress={() => remMut.mutate(c.id)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>
        ))
      )}
      {(totalCustos > 0 || veiculo.preco_custo != null) && (
        <View style={{ marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 }}>
          <Linha label="Custo total (compra + preparação)" valor={formatBRL(custoTotal)} />
          {lucroProj != null && <Linha label="Lucro projetado" valor={formatBRL(lucroProj)} cor={lucroProj >= 0 ? colors.success : colors.error} />}
        </View>
      )}

      <Sheet visible={aberto} onClose={() => setAberto(false)} title="Adicionar custo">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <SelectField label="Categoria" value={CATEGORIAS_CUSTO.find((x) => x.value === categoria)?.label} onPress={() => setCatSheet(true)} />
          <Input label="Descrição" placeholder="Ex.: Troca de pastilhas de freio" value={descricao} onChangeText={setDescricao} />
          <Input label="Valor" placeholder="0,00" keyboardType="numeric" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} icon="cash-outline" />
          <Button title="Adicionar custo" loading={addMut.isPending} disabled={descricao.trim().length < 2 || parseMoedaInput(valor) <= 0} onPress={() => addMut.mutate()} />
        </View>
        <OptionSheet
          visible={catSheet}
          onClose={() => setCatSheet(false)}
          title="Categoria do custo"
          selected={categoria}
          options={CATEGORIAS_CUSTO.map((c) => ({ value: c.value, label: c.label }))}
          onSelect={(v) => setCategoria(v as CategoriaCusto)}
        />
      </Sheet>
    </Card>
  )
}

function DocumentosCard({ veiculo }: { veiculo: Veiculo }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoDocumentoVenda>('contrato')
  const [tipoSheet, setTipoSheet] = useState(false)
  const [nome, setNome] = useState('')
  const [visivel, setVisivel] = useState(true)

  const q = useQuery({ queryKey: ['veiculos', veiculo.id, 'documentos'], queryFn: () => veiculosService.documentos(veiculo.id) })
  const docs = q.data ?? []

  const addMut = useMutation({
    mutationFn: () => veiculosService.adicionarDocumento(veiculo.id, { tipo, nome_arquivo: nome.trim(), visivel_comprador: visivel }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos', veiculo.id, 'documentos'] }); toast.show('success', 'Documento anexado.'); setNome(''); setAberto(false) },
  })
  const remMut = useMutation({
    mutationFn: (id: string) => veiculosService.removerDocumento(veiculo.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['veiculos', veiculo.id, 'documentos'] }),
  })

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Txt variant="title">Documentos de venda</Txt>
        <Pressable onPress={() => setAberto(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {docs.length === 0 ? (
        <Txt variant="caption" color="textDim">Nenhum documento. Anexe contrato, nota, garantia ou laudo.</Txt>
      ) : (
        docs.map((d) => (
          <View key={d.id} style={styles.linha}>
            <Ionicons name="document-text-outline" size={18} color={colors.textDim} />
            <View style={{ flex: 1 }}>
              <Txt variant="captionMedium" numberOfLines={1}>{d.nome_arquivo}</Txt>
              <Txt variant="caption" color="textMuted">
                {TIPOS_DOC_VENDA.find((t) => t.value === d.tipo)?.label}
                {d.visivel_comprador ? ' · visível ao comprador' : ' · interno'}
              </Txt>
            </View>
            <Pressable onPress={() => remMut.mutate(d.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>
        ))
      )}

      <Sheet visible={aberto} onClose={() => setAberto(false)} title="Anexar documento">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <SelectField label="Tipo" value={TIPOS_DOC_VENDA.find((t) => t.value === tipo)?.label} onPress={() => setTipoSheet(true)} />
          <Input label="Nome do arquivo" value={nome} onChangeText={setNome} placeholder="ex.: contrato-assinado.pdf" autoCapitalize="none" hint="No app real, aqui abre o seletor de arquivos." />
          <Pressable onPress={() => setVisivel((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4 }}>
            <Ionicons name={visivel ? 'checkbox' : 'square-outline'} size={22} color={visivel ? colors.primary : colors.textMuted} />
            <Txt variant="body">Visível ao comprador na Carteira</Txt>
          </Pressable>
          <Button title="Anexar documento" icon="document-attach-outline" loading={addMut.isPending} disabled={nome.trim().length < 3} onPress={() => addMut.mutate()} />
        </View>
        <OptionSheet
          visible={tipoSheet}
          onClose={() => setTipoSheet(false)}
          title="Tipo de documento"
          selected={tipo}
          options={TIPOS_DOC_VENDA.map((t) => ({ value: t.value, label: t.label }))}
          onSelect={(v) => setTipo(v as TipoDocumentoVenda)}
        />
      </Sheet>
    </Card>
  )
}

function AcoesGestaoCard({ veiculo, gestor }: { veiculo: Veiculo; gestor: boolean }) {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const [modo, setModo] = useState<TipoSolicitacao | null>(null)
  const [motivo, setMotivo] = useState('')
  const [novoPreco, setNovoPreco] = useState('')

  const excluirMut = useMutation({
    mutationFn: () => veiculosService.excluir(veiculo.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos'] }); toast.show('success', 'Veículo excluído.'); navigation.goBack() },
  })
  const precoMut = useMutation({
    mutationFn: (preco: number) => veiculosService.atualizarPreco(veiculo.id, preco),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos'] }); toast.show('success', 'Preço atualizado.'); setModo(null) },
  })
  const solicitarMut = useMutation({
    mutationFn: () => veiculosService.solicitarAprovacao(veiculo.id, {
      tipo: modo!,
      motivo: motivo.trim(),
      solicitante_nome: user?.nome ?? 'Vendedor',
      novo_preco: modo === 'alteracao_preco' ? parseMoedaInput(novoPreco) : undefined,
    }),
    onSuccess: () => { toast.show('success', 'Solicitação enviada ao gestor.'); setModo(null); setMotivo(''); setNovoPreco('') },
  })

  const confirmar = () => {
    if (gestor) {
      if (modo === 'exclusao') excluirMut.mutate()
      else if (modo === 'alteracao_preco') { const p = parseMoedaInput(novoPreco); if (p > 0) precoMut.mutate(p) }
    } else {
      if (motivo.trim().length < 5) { toast.show('error', 'Descreva o motivo (mín. 5 caracteres).'); return }
      if (modo === 'alteracao_preco' && parseMoedaInput(novoPreco) <= 0) { toast.show('error', 'Informe o novo preço.'); return }
      solicitarMut.mutate()
    }
  }

  return (
    <Card>
      <Txt variant="title" style={{ marginBottom: spacing.xs }}>Ações de gestão</Txt>
      {!gestor && (
        <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.sm }}>
          Como vendedor, exclusão e alteração de preço exigem aprovação do gestor.
        </Txt>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Alterar preço" variant="outline" icon="pricetag-outline" size="sm" onPress={() => { setModo('alteracao_preco'); setNovoPreco('') }} style={{ flex: 1 }} />
        <Button title="Excluir" variant="outline" icon="trash-outline" size="sm" onPress={() => setModo('exclusao')} style={{ flex: 1, borderColor: colors.error }} />
      </View>

      <Sheet visible={modo !== null} onClose={() => setModo(null)} title={modo === 'exclusao' ? 'Excluir veículo' : 'Alterar preço'}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {modo === 'alteracao_preco' && (
            <Input label="Novo preço de venda" value={novoPreco} onChangeText={(t) => setNovoPreco(maskMoedaInput(t))} keyboardType="numeric" placeholder={veiculo.preco_venda ? maskMoedaInput(String(Math.round(veiculo.preco_venda * 100))) : '0,00'} icon="cash-outline" />
          )}
          {!gestor && (
            <Input label="Motivo *" value={motivo} onChangeText={setMotivo} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder={modo === 'exclusao' ? 'Por que excluir este veículo?' : 'Por que alterar o preço?'} />
          )}
          {gestor && modo === 'exclusao' && (
            <Txt variant="caption" color="error">Esta ação é definitiva.</Txt>
          )}
          <Button
            title={gestor ? (modo === 'exclusao' ? 'Excluir agora' : 'Salvar preço') : 'Solicitar aprovação'}
            variant={gestor && modo === 'exclusao' ? 'danger' : 'primary'}
            loading={excluirMut.isPending || precoMut.isPending || solicitarMut.isPending}
            onPress={confirmar}
          />
          <Button title="Cancelar" variant="ghost" onPress={() => setModo(null)} />
        </View>
      </Sheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  heroBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.xs,
  },
  spec: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcional: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  vitrineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
})
