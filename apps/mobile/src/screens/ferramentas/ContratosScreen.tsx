import React, { useState } from 'react'
import { FlatList, Linking, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, ErrorState, Screen, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { contratosService } from '../../services'
import type { Contrato, StatusContrato } from '../../services/types'
import { STATUS_CONTRATO_LABEL } from '../../services/types'
import { formatBRL, formatData } from '../../lib/format'

const TONE: Record<StatusContrato, 'success' | 'warning' | 'neutral' | 'error'> = {
  assinado: 'success',
  aguardando: 'warning',
  rascunho: 'neutral',
  cancelado: 'error',
}

export default function ContratosScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [selecionado, setSelecionado] = useState<Contrato | null>(null)
  const [abrindoPdf, setAbrindoPdf] = useState(false)

  const q = useQuery({ queryKey: ['contratos'], queryFn: () => contratosService.lista() })

  const abrirPdf = async (c: Contrato) => {
    setAbrindoPdf(true)
    try {
      const url = await contratosService.pdfUrl(c.id)
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
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl }}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['contratos'] })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nenhum contrato" subtitle="Contratos de compra e venda aparecem aqui." />}
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

      <Sheet visible={selecionado !== null} onClose={() => setSelecionado(null)} title={selecionado?.numero}>
        {selecionado && (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            <Badge
              label={STATUS_CONTRATO_LABEL[selecionado.status]}
              tone={TONE[selecionado.status]}
            />
            <Linha label="Tipo" valor={selecionado.tipo === 'compra_venda' ? 'Compra e venda' : 'Compra'} />
            <Linha label="Veículo" valor={selecionado.veiculo_nome ?? '—'} />
            <Linha label="Cliente" valor={selecionado.cliente_nome ?? '—'} />
            <Linha label="Valor da venda" valor={formatBRL(selecionado.valor_venda)} />
            {selecionado.valor_entrada != null && <Linha label="Entrada" valor={formatBRL(selecionado.valor_entrada)} />}
            {selecionado.parcelas ? <Linha label="Parcelas" valor={`${selecionado.parcelas}x`} /> : null}
            <Linha label="Criado em" valor={formatData(selecionado.created_at)} />
            <Button title="Abrir PDF do contrato" icon="document-outline" loading={abrindoPdf} onPress={() => abrirPdf(selecionado)} full style={{ marginTop: spacing.xs }} />
          </View>
        )}
      </Sheet>
    </Screen>
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
