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
import { CATEGORIAS_CUSTO, equipeService, veiculosService } from '../../services'
import {
  STATUS_VEICULO_LABEL, type CategoriaCusto, type Veiculo, type VeiculoStatus,
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

          {/* Custos de preparação (só gestor) */}
          {v && gestor && v.status !== 'vendido' && <CustosCard veiculo={v} />}

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
  const { colors } = useTheme()
  return (
    <View style={styles.linha}>
      <Txt variant="caption" color="textDim">{label}</Txt>
      <Txt variant="bodySemibold" style={cor ? { color: cor } : undefined}>{valor}</Txt>
    </View>
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
    mutationFn: (id: string) => veiculosService.removerCusto(id),
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

function RegistrarVendaSheet({ veiculo, visible, onClose }: { veiculo: Veiculo; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)

  const [comprador, setComprador] = useState('')
  const [valor, setValor] = useState(veiculo.preco_venda ? maskMoedaInput(String(Math.round(veiculo.preco_venda * 100))) : '')
  const [vendedor, setVendedor] = useState(user?.nome ?? '')
  const [vendedorAberto, setVendedorAberto] = useState(false)

  // Pagamento composto (M058)
  const [dinheiro, setDinheiro] = useState('')
  const [financiado, setFinanciado] = useState('')
  const [troca, setTroca] = useState('')
  const [trocaDesc, setTrocaDesc] = useState('')

  const equipeQ = useQuery({ queryKey: ['equipe'], queryFn: () => equipeService.listar(), enabled: visible })

  const vTotal = parseMoedaInput(valor)
  const composto = parseMoedaInput(dinheiro) + parseMoedaInput(financiado) + parseMoedaInput(troca)
  const falta = vTotal - composto
  const fecha = vTotal > 0 && Math.abs(falta) < 1

  const vendaMut = useMutation({
    mutationFn: () =>
      veiculosService.registrarVenda(veiculo.id, {
        comprador_nome: comprador.trim(),
        valor_venda: vTotal,
        vendedor_nome: vendedor || undefined,
        valor_dinheiro: parseMoedaInput(dinheiro) || undefined,
        valor_financiado: parseMoedaInput(financiado) || undefined,
        valor_troca: parseMoedaInput(troca) || undefined,
        troca_descricao: trocaDesc.trim() || undefined,
      }),
    onSuccess: (esteira) => {
      queryClient.invalidateQueries()
      onClose()
      toast.show('success', 'Venda registrada! Esteira de pós-venda criada.')
      navigation.navigate('EsteiraDetalhe', { id: esteira.id })
    },
    onError: () => toast.show('error', 'Não foi possível registrar a venda.'),
  })

  // Comissão prevista (para transparência ao vendedor)
  const membro = (equipeQ.data ?? []).find((m) => m.nome === vendedor)
  const comissaoPct = membro?.percentual_comissao ?? null
  const comissaoPrev = comissaoPct ? (vTotal * comissaoPct) / 100 : null

  const valido = comprador.trim().length >= 3 && vTotal > 0

  return (
    <Sheet visible={visible} onClose={onClose} title="Registrar venda">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <Txt variant="caption" color="textDim">
          {veiculo.marca} {veiculo.modelo} · a venda abre a esteira de pós-venda.
        </Txt>
        <Input label="Nome do comprador" placeholder="Ex.: Maria da Silva" value={comprador} onChangeText={setComprador} icon="person-outline" />
        <Input label="Valor da venda" placeholder="0,00" keyboardType="numeric" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} icon="cash-outline" />

        {/* Composição do pagamento */}
        <View style={{ gap: spacing.sm }}>
          <Txt variant="captionMedium" color="textDim">Composição do pagamento (opcional)</Txt>
          <Input label="Dinheiro / à vista" placeholder="0,00" keyboardType="numeric" value={dinheiro} onChangeText={(t) => setDinheiro(maskMoedaInput(t))} icon="wallet-outline" />
          <Input label="Financiamento" placeholder="0,00" keyboardType="numeric" value={financiado} onChangeText={(t) => setFinanciado(maskMoedaInput(t))} icon="card-outline" />
          <Input label="Troca (valor avaliado)" placeholder="0,00" keyboardType="numeric" value={troca} onChangeText={(t) => setTroca(maskMoedaInput(t))} icon="swap-horizontal-outline" />
          {parseMoedaInput(troca) > 0 && (
            <Input label="Veículo da troca" placeholder="Ex.: Chevrolet Onix 2019" value={trocaDesc} onChangeText={setTrocaDesc} icon="car-outline" hint="Entra no estoque como rascunho (inativo) para avaliação." />
          )}
          {composto > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm, borderRadius: radius.md, backgroundColor: fecha ? colors.success + '14' : colors.warning + '14' }}>
              <Txt variant="caption" color={fecha ? 'success' : 'warning'}>
                {fecha ? '✓ Pagamento fecha com o valor' : falta > 0 ? `Falta ${formatBRL(falta)}` : `Excede ${formatBRL(-falta)}`}
              </Txt>
              <Txt variant="captionMedium" color={fecha ? 'success' : 'warning'}>{formatBRL(composto)}</Txt>
            </View>
          )}
        </View>

        <SelectField label="Vendedor responsável" value={vendedor} onPress={() => setVendedorAberto(true)} icon="people-outline" />
        {comissaoPrev != null && vTotal > 0 && (
          <Txt variant="caption" color="textMuted">Comissão prevista: {formatBRL(comissaoPrev)} ({comissaoPct}%).</Txt>
        )}

        <Button title="Confirmar venda" size="lg" loading={vendaMut.isPending} disabled={!valido} onPress={() => vendaMut.mutate()} />
      </View>
      <OptionSheet
        visible={vendedorAberto}
        onClose={() => setVendedorAberto(false)}
        title="Vendedor responsável"
        selected={vendedor}
        options={(equipeQ.data ?? []).filter((m) => m.ativo).map((m) => ({ value: m.nome, label: m.nome, sublabel: m.papel === 'gestor' ? 'Gestor' : 'Vendedor' }))}
        onSelect={setVendedor}
      />
    </Sheet>
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
