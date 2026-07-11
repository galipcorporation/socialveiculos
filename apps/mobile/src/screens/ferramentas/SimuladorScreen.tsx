import React, { useMemo, useState } from 'react'
import { Pressable, Share, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, Input, Paywall, Screen, SelectField, Sheet,
  SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { OptionSheet } from '../../components/ui'
import {
  modulosService, simuladorService, veiculosService, BANCOS_SIM,
} from '../../services'
import type { ResultadoBanco } from '../../services'
import type { Veiculo } from '../../services/types'
import { formatBRL, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const PARCELAS = [12, 24, 36, 48, 60]

export default function SimuladorScreen({ route }: RootScreenProps<'Simulador'>) {
  const { colors } = useTheme()
  const toast = useToast()
  const precoInicial = route.params?.precoInicial

  const gateQ = useQuery({ queryKey: ['modulo', 'simulador'], queryFn: () => modulosService.liberado('simulador') })
  const veiculosQ = useQuery({
    queryKey: ['veiculos', 'simulador'],
    queryFn: () => veiculosService.listar({ status: 'disponivel' }),
    enabled: gateQ.data === true,
  })

  const [valor, setValor] = useState(precoInicial ? maskMoedaInput(String(Math.round(precoInicial * 100))) : '')
  const [entrada, setEntrada] = useState('')
  const [parcelas, setParcelas] = useState(48)
  const [taxa, setTaxa] = useState('1,99')
  const [bancos, setBancos] = useState<string[]>(['bv', 'c6'])
  const [clienteNome, setClienteNome] = useState('')
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [veiculoSheet, setVeiculoSheet] = useState(false)

  const [simulando, setSimulando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoBanco[] | null>(null)
  const [resultadosAberto, setResultadosAberto] = useState(false)

  const resultado = useMemo(() => {
    const pv = parseMoedaInput(valor) - parseMoedaInput(entrada)
    const i = parseFloat(taxa.replace(',', '.')) / 100
    if (pv <= 0 || !i || i <= 0) return null
    const pmt = (pv * i) / (1 - Math.pow(1 + i, -parcelas))
    return { financiado: pv, parcela: pmt, total: pmt * parcelas, juros: pmt * parcelas - pv }
  }, [valor, entrada, parcelas, taxa])

  const toggleBanco = (cod: string) =>
    setBancos((prev) => (prev.includes(cod) ? prev.filter((c) => c !== cod) : [...prev, cod]))

  const escolherVeiculo = (v: Veiculo) => {
    setVeiculo(v)
    if (v.preco_venda) {
      setValor(maskMoedaInput(String(Math.round(v.preco_venda * 100))))
      setEntrada(maskMoedaInput(String(Math.round(v.preco_venda * 0.2 * 100))))
    }
  }

  const simularBancos = async () => {
    if (bancos.length === 0) { toast.show('error', 'Selecione ao menos um banco.'); return }
    const v = parseMoedaInput(valor)
    if (v <= 0) { toast.show('error', 'Informe o valor do veículo.'); return }
    setSimulando(true)
    setResultados(null)
    setResultadosAberto(true)
    try {
      const res = await simuladorService.simular({
        bancos, valor: v, entrada: parseMoedaInput(entrada), parcelas, cliente_nome: clienteNome.trim(),
      })
      setResultados(res)
    } finally {
      setSimulando(false)
    }
  }

  const compartilhar = () => {
    if (!resultado) return
    Share.share({
      message:
        `Simulação de financiamento\n` +
        `Valor: ${formatBRL(parseMoedaInput(valor))}\n` +
        `Entrada: ${formatBRL(parseMoedaInput(entrada))}\n` +
        `${parcelas}x de ${formatBRL(resultado.parcela)}\n` +
        `Taxa: ${taxa}% a.m.\n\n*Valores aproximados, sujeitos a análise de crédito.`,
    }).catch(() => {})
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Simulador" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }
  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Simulador de Crédito" large={false} back />
        <Screen padded>
          <Paywall titulo="Simulador de Crédito" descricao="Simule financiamento em múltiplos bancos ao mesmo tempo (BV, C6, Itaú, Santander). Módulo não incluído no plano atual." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false} keyboardAvoiding>
      <AppHeader title="Simulador de Crédito" subtitle="Multi-banco + tabela Price" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {/* 1. Bancos */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>1 · Financeiras</Txt>
          <View style={styles.bancosRow}>
            {BANCOS_SIM.map((b) => {
              const ativo = bancos.includes(b.codigo)
              return (
                <Pressable
                  key={b.codigo}
                  onPress={() => toggleBanco(b.codigo)}
                  style={[styles.bancoChip, { backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft, borderColor: ativo ? colors.primary : colors.border }]}
                >
                  <Ionicons name={ativo ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ativo ? colors.primary : colors.textMuted} />
                  <Txt style={{ fontFamily: fonts.semibold, fontSize: 13, color: ativo ? colors.primaryText : colors.textDim }}>{b.nome}</Txt>
                </Pressable>
              )
            })}
          </View>
        </Card>

        {/* 2. Cliente + Veículo */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>2 · Cliente e veículo</Txt>
          <Input label="Nome do cliente (opcional)" value={clienteNome} onChangeText={setClienteNome} placeholder="Para a proposta" />
          <SelectField
            label="Veículo do estoque (opcional)"
            value={veiculo ? `${veiculo.marca} ${veiculo.modelo}` : undefined}
            placeholder={veiculosQ.isLoading ? 'Carregando…' : 'Escolher do estoque'}
            icon="car-sport-outline"
            onPress={() => setVeiculoSheet(true)}
          />
        </Card>

        {/* 3. Valores */}
        <Card style={{ gap: spacing.md }}>
          <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>3 · Valores</Txt>
          <Input label="Valor do veículo" placeholder="0,00" keyboardType="numeric" icon="pricetag-outline" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} />
          <Input label="Entrada" placeholder="0,00" keyboardType="numeric" icon="cash-outline" value={entrada} onChangeText={(t) => setEntrada(maskMoedaInput(t))} />
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Número de parcelas</Txt>
            <View style={styles.parcelasRow}>
              {PARCELAS.map((p) => {
                const ativo = parcelas === p
                return (
                  <Pressable key={p} onPress={() => setParcelas(p)} style={[styles.parcelaChip, { backgroundColor: ativo ? colors.primary : colors.overlaySoft, borderColor: ativo ? colors.primary : colors.border }]}>
                    <Txt style={{ fontFamily: fonts.semibold, fontSize: 14, color: ativo ? colors.onPrimary : colors.textDim }}>{p}x</Txt>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <Input label="Taxa p/ estimativa local (% ao mês)" placeholder="1,99" keyboardType="decimal-pad" icon="trending-up-outline" value={taxa} onChangeText={setTaxa} hint="Usada na estimativa Price abaixo; cada banco usa a própria taxa." />
        </Card>

        {/* Estimativa local (Price) */}
        <Card style={{ backgroundColor: resultado ? colors.primary + '14' : colors.surface, borderColor: resultado ? colors.primary + '40' : colors.border }}>
          {resultado ? (
            <View style={{ gap: spacing.sm }}>
              <View>
                <Txt variant="caption" color="textDim">Estimativa local · {parcelas} parcelas de</Txt>
                <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 32, color: colors.primaryText }}>{formatBRL(resultado.parcela)}</Txt>
              </View>
              <View style={[styles.linha, { borderTopColor: colors.border }]}>
                <Txt variant="caption" color="textDim">Valor financiado</Txt>
                <Txt variant="bodySemibold">{formatBRL(resultado.financiado)}</Txt>
              </View>
              <View style={styles.linhaSimples}>
                <Txt variant="caption" color="textDim">Juros totais</Txt>
                <Txt variant="bodySemibold" color="warning">{formatBRL(resultado.juros)}</Txt>
              </View>
            </View>
          ) : (
            <Txt variant="body" color="textDim" align="center" style={{ paddingVertical: spacing.md }}>Informe o valor para ver a estimativa.</Txt>
          )}
        </Card>

        <Button title="Simular nos bancos" icon="git-compare-outline" loading={simulando} onPress={simularBancos} full />
        {resultado && <Button title="Compartilhar estimativa" icon="share-outline" variant="tonal" onPress={compartilhar} />}
      </Screen>

      <OptionSheet
        visible={veiculoSheet}
        onClose={() => setVeiculoSheet(false)}
        title="Veículo do estoque"
        options={(veiculosQ.data ?? []).map((v) => ({ value: v.id, label: `${v.marca} ${v.modelo}`, sublabel: [v.versao, formatBRL(v.preco_venda)].filter(Boolean).join(' · ') }))}
        selected={veiculo?.id}
        onSelect={(id) => { const v = (veiculosQ.data ?? []).find((x) => x.id === id); if (v) escolherVeiculo(v) }}
      />

      {/* Resultados por banco */}
      <Sheet visible={resultadosAberto} onClose={() => setResultadosAberto(false)} title="Resultado da simulação">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {simulando ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
              <SkeletonCard withImage={false} />
              <Txt variant="caption" color="textDim">Consultando os bancos selecionados…</Txt>
            </View>
          ) : (resultados ?? []).length === 0 ? (
            <Txt variant="body" color="textDim" align="center" style={{ paddingVertical: spacing.md }}>Nenhum resultado.</Txt>
          ) : (
            (resultados ?? []).map((r) => (
              <Card key={r.banco} style={{ gap: 6, borderColor: r.status === 'aprovado' ? colors.success + '55' : colors.error + '55' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Txt variant="bodySemibold" style={{ flex: 1 }}>{r.banco_nome}</Txt>
                  <Badge label={r.status === 'aprovado' ? 'Aprovado' : 'Negado'} tone={r.status === 'aprovado' ? 'success' : 'error'} size="sm" />
                </View>
                {r.status === 'aprovado' ? (
                  <>
                    <View style={styles.linhaSimples}>
                      <Txt variant="caption" color="textDim">Parcela</Txt>
                      <Txt variant="bodySemibold" color="success">{r.prazo}x {formatBRL(r.parcela)}</Txt>
                    </View>
                    <View style={styles.linhaSimples}>
                      <Txt variant="caption" color="textDim">Taxa</Txt>
                      <Txt variant="captionMedium">{r.taxa}% a.m.</Txt>
                    </View>
                    <View style={styles.linhaSimples}>
                      <Txt variant="caption" color="textDim">Total financiado</Txt>
                      <Txt variant="captionMedium">{formatBRL(r.total)}</Txt>
                    </View>
                  </>
                ) : (
                  <Txt variant="caption" color="error">{r.erro ?? 'Não aprovado.'}</Txt>
                )}
              </Card>
            ))
          )}
          {!simulando && (resultados ?? []).some((r) => r.status === 'aprovado') && (
            <Button
              title="Compartilhar proposta"
              icon="share-outline"
              variant="tonal"
              onPress={() => {
                const aprovados = (resultados ?? []).filter((r) => r.status === 'aprovado')
                const linhas = aprovados.map((r) => `${r.banco_nome}: ${r.prazo}x de ${formatBRL(r.parcela)} (${r.taxa}% a.m.)`).join('\n')
                Share.share({
                  message: `Proposta de financiamento${clienteNome ? ` — ${clienteNome}` : ''}\n${veiculo ? `${veiculo.marca} ${veiculo.modelo}\n` : ''}Valor: ${formatBRL(parseMoedaInput(valor))} · Entrada: ${formatBRL(parseMoedaInput(entrada))}\n\n${linhas}\n\n*Sujeito a análise de crédito.`,
                }).catch(() => {})
              }}
            />
          )}
        </View>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  bancosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bancoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: radius.md, borderWidth: 1 },
  parcelasRow: { flexDirection: 'row', gap: spacing.xs },
  parcelaChip: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1 },
  linhaSimples: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
