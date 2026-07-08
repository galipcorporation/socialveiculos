import React, { useMemo, useState } from 'react'
import { Pressable, Share, StyleSheet, View } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Button, Card, Input, Screen, Txt } from '../../components/ui'
import { formatBRL, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const PARCELAS = [12, 24, 36, 48, 60]

export default function SimuladorScreen({ route }: RootScreenProps<'Simulador'>) {
  const { colors } = useTheme()
  const precoInicial = route.params?.precoInicial

  const [valor, setValor] = useState(
    precoInicial ? maskMoedaInput(String(Math.round(precoInicial * 100))) : ''
  )
  const [entrada, setEntrada] = useState('')
  const [parcelas, setParcelas] = useState(48)
  const [taxa, setTaxa] = useState('1,99')

  const resultado = useMemo(() => {
    const pv = parseMoedaInput(valor) - parseMoedaInput(entrada)
    const i = parseFloat(taxa.replace(',', '.')) / 100
    if (pv <= 0 || !i || i <= 0) return null
    const pmt = (pv * i) / (1 - Math.pow(1 + i, -parcelas))
    return {
      financiado: pv,
      parcela: pmt,
      total: pmt * parcelas,
      juros: pmt * parcelas - pv,
    }
  }, [valor, entrada, parcelas, taxa])

  const compartilhar = () => {
    if (!resultado) return
    Share.share({
      message:
        `Simulação de financiamento\n` +
        `Valor: ${formatBRL(parseMoedaInput(valor))}\n` +
        `Entrada: ${formatBRL(parseMoedaInput(entrada))}\n` +
        `${parcelas}x de ${formatBRL(resultado.parcela)}\n` +
        `Taxa: ${taxa}% a.m.\n\n` +
        `*Valores aproximados, sujeitos a análise de crédito.`,
    }).catch(() => {})
  }

  return (
    <Screen scroll={false} padded={false} keyboardAvoiding>
      <AppHeader title="Simulador" subtitle="Financiamento tabela Price" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Input
            label="Valor do veículo"
            placeholder="0,00"
            keyboardType="numeric"
            icon="car-sport-outline"
            value={valor}
            onChangeText={(t) => setValor(maskMoedaInput(t))}
          />
          <Input
            label="Entrada"
            placeholder="0,00"
            keyboardType="numeric"
            icon="cash-outline"
            value={entrada}
            onChangeText={(t) => setEntrada(maskMoedaInput(t))}
          />
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Número de parcelas</Txt>
            <View style={styles.parcelasRow}>
              {PARCELAS.map((p) => {
                const ativo = parcelas === p
                return (
                  <Pressable
                    key={p}
                    onPress={() => setParcelas(p)}
                    style={[
                      styles.parcelaChip,
                      {
                        backgroundColor: ativo ? colors.primary : colors.overlaySoft,
                        borderColor: ativo ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Txt
                      style={{
                        fontFamily: fonts.semibold,
                        fontSize: 14,
                        color: ativo ? colors.onPrimary : colors.textDim,
                      }}
                    >
                      {p}x
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <Input
            label="Taxa de juros (% ao mês)"
            placeholder="1,99"
            keyboardType="decimal-pad"
            icon="trending-up-outline"
            value={taxa}
            onChangeText={setTaxa}
          />
        </Card>

        {/* Resultado */}
        <Card
          style={{
            backgroundColor: resultado ? colors.primary + '14' : colors.surface,
            borderColor: resultado ? colors.primary + '40' : colors.border,
          }}
        >
          {resultado ? (
            <View style={{ gap: spacing.sm }}>
              <View>
                <Txt variant="caption" color="textDim">{parcelas} parcelas de</Txt>
                <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 34, color: colors.primaryText }}>
                  {formatBRL(resultado.parcela)}
                </Txt>
              </View>
              <View style={[styles.linha, { borderTopColor: colors.border }]}>
                <Txt variant="caption" color="textDim">Valor financiado</Txt>
                <Txt variant="bodySemibold">{formatBRL(resultado.financiado)}</Txt>
              </View>
              <View style={styles.linhaSimples}>
                <Txt variant="caption" color="textDim">Total a pagar</Txt>
                <Txt variant="bodySemibold">{formatBRL(resultado.total)}</Txt>
              </View>
              <View style={styles.linhaSimples}>
                <Txt variant="caption" color="textDim">Juros totais</Txt>
                <Txt variant="bodySemibold" color="warning">{formatBRL(resultado.juros)}</Txt>
              </View>
              <Txt variant="caption" color="textMuted">
                *Simulação aproximada (Price). Sujeita a análise de crédito e tarifas do banco.
              </Txt>
            </View>
          ) : (
            <Txt variant="body" color="textDim" align="center" style={{ paddingVertical: spacing.md }}>
              Informe o valor do veículo para ver a parcela estimada.
            </Txt>
          )}
        </Card>

        {resultado && (
          <Button title="Compartilhar simulação" icon="share-outline" variant="tonal" onPress={compartilhar} />
        )}
      </Screen>
    </Screen>
  )
}

const styles = StyleSheet.create({
  parcelasRow: { flexDirection: 'row', gap: spacing.xs },
  parcelaChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  linhaSimples: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
