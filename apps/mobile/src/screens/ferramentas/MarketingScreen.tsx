import React, { useState } from 'react'
import { Share, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, EmptyState, Paywall, Screen, SegmentedControl, SelectField,
  SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { OptionSheet } from '../../components/ui'
import { marketingService, modulosService, veiculosService, TONS_MARKETING, type TomMarketing } from '../../services'
import type { Veiculo } from '../../services/types'
import { formatBRL } from '../../lib/format'

export default function MarketingScreen() {
  const { colors } = useTheme()
  const toast = useToast()

  const gateQ = useQuery({ queryKey: ['modulo', 'marketing'], queryFn: () => modulosService.liberado('marketing') })
  const veiculosQ = useQuery({ queryKey: ['veiculos', 'marketing'], queryFn: () => veiculosService.listar({ status: 'disponivel' }), enabled: gateQ.data === true })

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [tom, setTom] = useState<TomMarketing>('entusiasmado')
  const [veiculoSheet, setVeiculoSheet] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [legenda, setLegenda] = useState('')

  const gerar = async () => {
    if (!veiculo) return
    setGerando(true)
    try {
      setLegenda(await marketingService.gerarLegenda(veiculo, tom))
    } finally {
      setGerando(false)
    }
  }

  const compartilhar = async () => {
    if (!legenda) return
    try {
      await Share.share({ message: legenda })
    } catch {
      toast.show('info', 'Não foi possível abrir o compartilhamento.')
    }
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Marketing IA" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Marketing IA" large={false} back />
        <Screen padded>
          <Paywall titulo="Marketing com IA" descricao="Gere legendas e posts prontos para redes sociais a partir do seu estoque. Módulo não incluído no plano atual." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Marketing IA" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Gere uma legenda pronta para Instagram/WhatsApp a partir de um veículo do estoque.
        </Txt>

        <Card style={{ gap: spacing.sm }}>
          <SelectField
            label="Veículo"
            value={veiculo ? `${veiculo.marca} ${veiculo.modelo}` : undefined}
            placeholder={veiculosQ.isLoading ? 'Carregando…' : 'Selecione um veículo'}
            icon="car-sport-outline"
            onPress={() => setVeiculoSheet(true)}
          />
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Tom da mensagem</Txt>
            <SegmentedControl
              options={TONS_MARKETING.map((t) => ({ value: t.value, label: t.label }))}
              selected={tom}
              onSelect={(v) => setTom(v as TomMarketing)}
            />
          </View>
          <Button title="Gerar legenda" icon="sparkles" loading={gerando} onPress={gerar} full disabled={!veiculo} />
        </Card>

        {legenda ? (
          <Card style={{ gap: spacing.sm }}>
            <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Legenda gerada</Txt>
            <View style={{ backgroundColor: colors.overlaySoft, borderRadius: radius.md, padding: spacing.sm }}>
              <Txt style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text }}>{legenda}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Compartilhar" icon="share-social-outline" onPress={compartilhar} style={{ flex: 1 }} />
              <Button title="Refazer" variant="outline" icon="refresh" onPress={gerar} loading={gerando} />
            </View>
          </Card>
        ) : null}
      </Screen>

      <OptionSheet
        visible={veiculoSheet}
        onClose={() => setVeiculoSheet(false)}
        title="Escolha o veículo"
        options={(veiculosQ.data ?? []).map((v) => ({
          value: v.id,
          label: `${v.marca} ${v.modelo}`,
          sublabel: [v.versao, formatBRL(v.preco_venda)].filter(Boolean).join(' · '),
        }))}
        selected={veiculo?.id}
        onSelect={(id) => setVeiculo((veiculosQ.data ?? []).find((v) => v.id === id) ?? null)}
      />
    </Screen>
  )
}
