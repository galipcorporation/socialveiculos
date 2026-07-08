import React, { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, Input, OptionSheet, Screen, SelectField, Txt, useToast,
} from '../../components/ui'
import { veiculosService, type VeiculoInput } from '../../services'
import { ANOS, REGRAS_TIPO, TIPOS_VEICULO, type TipoVeiculo } from '../../services/types'
import { formatNumber, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const CAMBIOS = ['Manual', 'Automático', 'Automático CVT', 'Automatizado']
const COMBUSTIVEIS = ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'Híbrido', 'Elétrico']

interface FormState {
  tipo: TipoVeiculo
  placa: string
  marca: string
  modelo: string
  versao: string
  anoModelo: number | null
  cor: string
  km: string
  cambio: string
  combustivel: string
  portas: string
  precoVenda: string
  precoCusto: string
  opcionais: string
  descricao: string
  publicado: boolean
  fotos: string[]
}

const VAZIO: FormState = {
  tipo: 'carro', placa: '', marca: '', modelo: '', versao: '', anoModelo: null, cor: '',
  km: '', cambio: '', combustivel: '', portas: '4', precoVenda: '', precoCusto: '',
  opcionais: '', descricao: '', publicado: false, fotos: [],
}

export default function VeiculoFormScreen({ route }: RootScreenProps<'VeiculoForm'>) {
  const id = route.params?.id
  const editando = !!id
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(VAZIO)
  const [erros, setErros] = useState<Partial<Record<keyof FormState, string>>>({})
  const [sheet, setSheet] = useState<'ano' | 'cambio' | 'combustivel' | null>(null)

  const existenteQ = useQuery({
    queryKey: ['veiculos', id],
    queryFn: () => veiculosService.obter(id!),
    enabled: editando,
  })

  useEffect(() => {
    const v = existenteQ.data
    if (!v) return
    setForm({
      tipo: v.tipo,
      placa: v.placa ?? '',
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao ?? '',
      anoModelo: v.ano_modelo,
      cor: v.cor ?? '',
      km: v.km != null ? String(v.km) : '',
      cambio: v.cambio ?? '',
      combustivel: v.combustivel ?? '',
      portas: v.portas != null ? String(v.portas) : '4',
      precoVenda: v.preco_venda != null ? maskMoedaInput(String(Math.round(v.preco_venda * 100))) : '',
      precoCusto: v.preco_custo != null ? maskMoedaInput(String(Math.round(v.preco_custo * 100))) : '',
      opcionais: v.opcionais ?? '',
      descricao: v.descricao ?? '',
      publicado: !!v.publicado_marketplace,
      fotos: (v.midias ?? []).filter((m) => m.tipo === 'imagem').map((m) => m.url),
    })
  }, [existenteQ.data])

  const regra = REGRAS_TIPO[form.tipo]
  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const escolherFotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.8,
    })
    if (!res.canceled) {
      set('fotos', [...form.fotos, ...res.assets.map((a) => a.uri)].slice(0, 8))
    }
  }

  const validar = (): boolean => {
    const novo: typeof erros = {}
    if (!form.marca.trim()) novo.marca = 'Informe a marca.'
    if (!form.modelo.trim()) novo.modelo = 'Informe o modelo.'
    if (!form.anoModelo) novo.anoModelo = 'Selecione o ano.'
    if (!form.precoVenda || parseMoedaInput(form.precoVenda) <= 0) novo.precoVenda = 'Informe o preço de venda.'
    setErros(novo)
    return Object.keys(novo).length === 0
  }

  const montarInput = (): VeiculoInput => ({
    tipo: form.tipo,
    marca: form.marca.trim(),
    modelo: form.modelo.trim(),
    versao: form.versao.trim() || undefined,
    placa: regra.placa && form.placa.trim() ? form.placa.trim().toUpperCase() : undefined,
    ano_modelo: form.anoModelo!,
    cor: form.cor.trim() || undefined,
    km: regra.km && form.km ? parseInt(form.km.replace(/\D/g, ''), 10) || 0 : undefined,
    cambio: regra.cambio && form.cambio ? form.cambio : undefined,
    combustivel: regra.combustivel && form.combustivel ? form.combustivel : undefined,
    portas: regra.portas && form.portas ? parseInt(form.portas, 10) || undefined : undefined,
    preco_venda: parseMoedaInput(form.precoVenda),
    preco_custo: form.precoCusto ? parseMoedaInput(form.precoCusto) : undefined,
    opcionais: form.opcionais.trim() || undefined,
    descricao: form.descricao.trim() || undefined,
    publicado_marketplace: form.publicado,
    fotos: form.fotos,
  })

  const salvarMut = useMutation({
    mutationFn: () =>
      editando ? veiculosService.atualizar(id!, montarInput()) : veiculosService.criar(montarInput()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.show('success', editando ? 'Veículo atualizado.' : 'Veículo cadastrado no estoque.')
      navigation.goBack()
    },
    onError: () => toast.show('error', 'Não foi possível salvar. Tente novamente.'),
  })

  const salvar = () => {
    if (!validar()) {
      toast.show('error', 'Revise os campos destacados.')
      return
    }
    salvarMut.mutate()
  }

  const usoLabel = regra.uso === 'horas' ? 'Horas de uso' : 'Quilometragem'

  return (
    <Screen scroll={false} padded={false} keyboardAvoiding>
      <AppHeader title={editando ? 'Editar veículo' : 'Novo veículo'} large={false} back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.md }}>
          {/* Tipo */}
          <Card>
            <Txt variant="title" style={{ marginBottom: spacing.sm }}>Tipo de veículo</Txt>
            <View style={styles.tipoGrid}>
              {TIPOS_VEICULO.map((t) => {
                const ativo = form.tipo === t.value
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => set('tipo', t.value)}
                    style={[
                      styles.tipoChip,
                      {
                        backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft,
                        borderColor: ativo ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Txt
                      style={{
                        fontFamily: ativo ? fonts.semibold : fonts.medium,
                        fontSize: 13,
                        color: ativo ? colors.primaryText : colors.textDim,
                      }}
                    >
                      {t.label}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
          </Card>

          {/* Identificação */}
          <Card style={{ gap: spacing.md }}>
            <Txt variant="title">Identificação</Txt>
            {regra.placa && (
              <Input
                label="Placa"
                placeholder="ABC1D23"
                autoCapitalize="characters"
                maxLength={8}
                value={form.placa}
                onChangeText={(t) => set('placa', t)}
                hint="Opcional — usada para consultas e documentos"
              />
            )}
            <View style={styles.row2}>
              <Input
                label="Marca *"
                placeholder="Ex.: Toyota"
                value={form.marca}
                onChangeText={(t) => set('marca', t)}
                error={erros.marca}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Modelo *"
                placeholder="Ex.: Corolla"
                value={form.modelo}
                onChangeText={(t) => set('modelo', t)}
                error={erros.modelo}
                containerStyle={{ flex: 1 }}
              />
            </View>
            {regra.versao && (
              <Input
                label="Versão"
                placeholder="Ex.: XEi 2.0 Flex"
                value={form.versao}
                onChangeText={(t) => set('versao', t)}
              />
            )}
            <View style={styles.row2}>
              <SelectField
                label="Ano modelo *"
                value={form.anoModelo ? String(form.anoModelo) : undefined}
                onPress={() => setSheet('ano')}
                error={erros.anoModelo}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Cor"
                placeholder="Ex.: Prata"
                value={form.cor}
                onChangeText={(t) => set('cor', t)}
                containerStyle={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Detalhes técnicos */}
          <Card style={{ gap: spacing.md }}>
            <Txt variant="title">Detalhes</Txt>
            {regra.km && (
              <Input
                label={usoLabel}
                placeholder="Ex.: 45.000"
                keyboardType="numeric"
                value={form.km ? formatNumber(parseInt(form.km.replace(/\D/g, ''), 10) || 0) : ''}
                onChangeText={(t) => set('km', t.replace(/\D/g, ''))}
              />
            )}
            <View style={styles.row2}>
              {regra.cambio && (
                <SelectField
                  label="Câmbio"
                  value={form.cambio || undefined}
                  onPress={() => setSheet('cambio')}
                  containerStyle={{ flex: 1 }}
                />
              )}
              {regra.combustivel && (
                <SelectField
                  label="Combustível"
                  value={form.combustivel || undefined}
                  onPress={() => setSheet('combustivel')}
                  containerStyle={{ flex: 1 }}
                />
              )}
            </View>
            {regra.portas && (
              <Input
                label="Portas"
                keyboardType="numeric"
                maxLength={1}
                value={form.portas}
                onChangeText={(t) => set('portas', t.replace(/\D/g, ''))}
                containerStyle={{ width: 120 }}
              />
            )}
          </Card>

          {/* Preços */}
          <Card style={{ gap: spacing.md }}>
            <Txt variant="title">Valores</Txt>
            <Input
              label="Preço de venda *"
              placeholder="0,00"
              keyboardType="numeric"
              value={form.precoVenda}
              onChangeText={(t) => set('precoVenda', maskMoedaInput(t))}
              error={erros.precoVenda}
              icon="cash-outline"
            />
            <Input
              label="Preço de custo"
              placeholder="0,00"
              keyboardType="numeric"
              value={form.precoCusto}
              onChangeText={(t) => set('precoCusto', maskMoedaInput(t))}
              hint="Visível apenas para gestores — usado no cálculo de margem"
              icon="wallet-outline"
            />
          </Card>

          {/* Fotos */}
          <Card>
            <Txt variant="title" style={{ marginBottom: spacing.sm }}>Fotos</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              <Pressable
                onPress={escolherFotos}
                style={[styles.addFoto, { borderColor: colors.borderHover, backgroundColor: colors.overlaySoft }]}
              >
                <Ionicons name="camera-outline" size={24} color={colors.textDim} />
                <Txt variant="caption" color="textDim">Adicionar</Txt>
              </Pressable>
              {form.fotos.map((uri, i) => (
                <View key={uri + i}>
                  <Image source={{ uri }} style={styles.foto} />
                  <Pressable
                    onPress={() => set('fotos', form.fotos.filter((_, idx) => idx !== i))}
                    style={styles.removerFoto}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Card>

          {/* Extras */}
          <Card style={{ gap: spacing.md }}>
            <Txt variant="title">Informações adicionais</Txt>
            <Input
              label="Opcionais"
              placeholder="Separados por vírgula: teto solar, multimídia…"
              value={form.opcionais}
              onChangeText={(t) => set('opcionais', t)}
              multiline
            />
            <Input
              label="Descrição"
              placeholder="Detalhes do veículo, histórico, condição…"
              value={form.descricao}
              onChangeText={(t) => set('descricao', t)}
              multiline
              style={{ minHeight: 70, textAlignVertical: 'top' }}
            />
            <View style={styles.publicarRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyMedium">Publicar na vitrine</Txt>
                <Txt variant="caption" color="textDim">O veículo aparece no marketplace público</Txt>
              </View>
              <Switch
                value={form.publicado}
                onValueChange={(v) => set('publicado', v)}
                trackColor={{ false: colors.overlayStrong, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </Card>

          <Button
            title={editando ? 'Salvar alterações' : 'Cadastrar veículo'}
            size="lg"
            loading={salvarMut.isPending}
            onPress={salvar}
          />
          <Button title="Cancelar" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'ano'}
        onClose={() => setSheet(null)}
        title="Ano modelo"
        selected={form.anoModelo ? String(form.anoModelo) : undefined}
        options={ANOS.map((a) => ({ value: String(a), label: String(a) }))}
        onSelect={(a) => set('anoModelo', parseInt(a, 10))}
      />
      <OptionSheet
        visible={sheet === 'cambio'}
        onClose={() => setSheet(null)}
        title="Câmbio"
        selected={form.cambio || undefined}
        options={CAMBIOS.map((c) => ({ value: c, label: c }))}
        onSelect={(c) => set('cambio', c)}
      />
      <OptionSheet
        visible={sheet === 'combustivel'}
        onClose={() => setSheet(null)}
        title="Combustível"
        selected={form.combustivel || undefined}
        options={COMBUSTIVEIS.map((c) => ({ value: c, label: c }))}
        onSelect={(c) => set('combustivel', c)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tipoChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row2: { flexDirection: 'row', gap: spacing.sm },
  addFoto: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  foto: { width: 84, height: 84, borderRadius: radius.md },
  removerFoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
