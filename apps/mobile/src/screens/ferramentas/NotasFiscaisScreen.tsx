import React, { useState } from 'react'
import { FlatList, Linking, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, Input, OptionSheet, Paywall, Screen, Sheet,
  SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { useTheme } from '../../theme/ThemeContext'
import { contratosService, modulosService, notasFiscaisService } from '../../services'
import type { Contrato, NotaFiscal, StatusNota } from '../../services/types'
import { STATUS_NOTA_LABEL } from '../../services/types'
import { formatBRL, formatData } from '../../lib/format'

const TONE: Record<StatusNota, 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  autorizada: 'success',
  processando: 'info',
  processando_cancelamento: 'warning',
  rejeitada: 'error',
  erro: 'error',
  cancelada: 'neutral',
}

export default function NotasFiscaisScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { colors } = useTheme()

  const gateQ = useQuery({ queryKey: ['modulo', 'fiscal'], queryFn: () => modulosService.liberado('fiscal') })
  const notasQ = useQuery({ queryKey: ['notas-fiscais'], queryFn: () => notasFiscaisService.lista(), enabled: gateQ.data === true })
  const contratosQ = useQuery({ queryKey: ['contratos'], queryFn: () => contratosService.lista(), enabled: gateQ.data === true })

  const [emitirAberto, setEmitirAberto] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [cancelar, setCancelar] = useState<NotaFiscal | null>(null)
  const [menuNota, setMenuNota] = useState<NotaFiscal | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [cancelando, setCancelando] = useState(false)

  // Só contratos assinados/aguardando ainda sem nota autorizada.
  const contratosEmissiveis = (contratosQ.data ?? []).filter((c) => c.status === 'assinado' || c.status === 'aguardando')

  const emitir = async (contrato: Contrato) => {
    setEmitindo(true)
    try {
      await notasFiscaisService.emitir(contrato)
      await queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      toast.show('success', 'NF-e enviada para emissão — acompanhe o status.')
      setEmitirAberto(false)
      // Reflete a autorização assíncrona.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] }), 3000)
    } finally {
      setEmitindo(false)
    }
  }

  const abrirUrl = async (url?: string) => {
    if (!url) return
    const ok = await Linking.canOpenURL(url)
    if (ok) Linking.openURL(url)
    else toast.show('error', 'Não foi possível abrir o documento.')
  }

  const confirmarCancelamento = async () => {
    if (!cancelar || justificativa.trim().length < 15) {
      toast.show('error', 'A justificativa deve ter ao menos 15 caracteres.')
      return
    }
    setCancelando(true)
    try {
      await notasFiscaisService.cancelar(cancelar.id, justificativa.trim())
      await queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      toast.show('success', 'Cancelamento solicitado.')
      setCancelar(null)
      setJustificativa('')
    } finally {
      setCancelando(false)
    }
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Notas Fiscais" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Notas Fiscais" large={false} back />
        <Screen padded>
          <Paywall titulo="Emissor de NF-e" descricao="O módulo Fiscal não está ativo no seu plano. Emita NF-e de venda sem precisar de um sistema fiscal à parte." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Notas Fiscais" large={false} back />
      <FlatList
        data={notasQ.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshing={notasQ.isRefetching}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <Button title="Emitir NF-e de um contrato" icon="add" onPress={() => setEmitirAberto(true)} full />
          </View>
        }
        ListEmptyComponent={
          notasQ.isLoading
            ? <SkeletonCard withImage={false} />
            : <EmptyState icon="receipt-outline" title="Nenhuma nota" subtitle="Emita a primeira NF-e a partir de um contrato." />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Txt variant="bodySemibold">{item.numero ? `NF-e ${item.numero}` : 'NF-e (rascunho)'}</Txt>
                  <Badge label={STATUS_NOTA_LABEL[item.status]} tone={TONE[item.status]} size="sm" />
                </View>
                <Txt variant="caption" color="textDim" numberOfLines={1}>{item.veiculo_nome} · {item.cliente_nome}</Txt>
                {item.chave_acesso && (
                  <Txt variant="caption" color="textMuted" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                    {item.chave_acesso}
                  </Txt>
                )}
                {item.status === 'cancelada' && item.justificativa_cancelamento && (
                  <Txt variant="caption" color="error" numberOfLines={2}>Cancelada: {item.justificativa_cancelamento}</Txt>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Txt variant="bodyMedium">{formatBRL(item.valor_total)}</Txt>
              </View>
            </View>
            {item.status === 'autorizada' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                {item.danfe_pdf_url && (
                  <Button title="DANFE" icon="document-text-outline" variant="outline" size="sm" onPress={() => abrirUrl(item.danfe_pdf_url)} />
                )}
                {item.xml_url && (
                  <Button title="XML" icon="download-outline" variant="outline" size="sm" onPress={() => abrirUrl(item.xml_url)} />
                )}
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => setMenuNota(item)}
                  hitSlop={8}
                  accessibilityLabel="Mais ações da nota"
                  style={({ pressed }) => ({
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: pressed ? colors.overlaySoft : 'transparent',
                  })}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={colors.textDim} />
                </Pressable>
              </View>
            )}
          </Card>
        )}
      />

      {/* Emitir a partir de contrato */}
      <Sheet visible={emitirAberto} onClose={() => setEmitirAberto(false)} title="Emitir NF-e">
        <View style={{ gap: spacing.xs, paddingBottom: spacing.md }}>
          <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.xs }}>
            Selecione o contrato para emitir a nota de venda (ambiente de homologação).
          </Txt>
          {contratosEmissiveis.length === 0 ? (
            <EmptyState icon="document-outline" title="Sem contratos" subtitle="Nenhum contrato assinado disponível para emissão." />
          ) : (
            contratosEmissiveis.map((c) => (
              <Card key={c.id} onPress={emitindo ? undefined : () => emitir(c)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium">{c.numero}</Txt>
                    <Txt variant="caption" color="textDim" numberOfLines={1}>{c.veiculo_nome} · {c.cliente_nome}</Txt>
                  </View>
                  <Txt variant="captionMedium">{formatBRL(c.valor_venda)}</Txt>
                </View>
              </Card>
            ))
          )}
        </View>
      </Sheet>

      {/* Menu de ações da nota */}
      <OptionSheet
        visible={menuNota !== null}
        onClose={() => setMenuNota(null)}
        title={menuNota ? `NF-e ${menuNota.numero ?? ''}` : 'Nota fiscal'}
        options={[{ value: 'cancelar', label: 'Cancelar NF-e', sublabel: 'Cancela a nota na SEFAZ. Ação definitiva.', icon: 'close-circle-outline', tone: colors.error }]}
        onSelect={() => {
          const n = menuNota
          setMenuNota(null)
          if (n) setCancelar(n)
        }}
      />

      {/* Cancelamento */}
      <Sheet visible={cancelar !== null} onClose={() => setCancelar(null)} title="Cancelar NF-e">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
            <Txt variant="caption" color="error" style={{ flex: 1 }}>
              O cancelamento é definitivo e não pode ser desfeito. Informe uma justificativa (mín. 15 caracteres).
            </Txt>
          </View>
          <Input
            label="Justificativa"
            value={justificativa}
            onChangeText={setJustificativa}
            placeholder="Motivo do cancelamento"
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }}
            hint={`${justificativa.trim().length}/15 caracteres mínimos`}
          />
          <Button title="Confirmar cancelamento" variant="danger" loading={cancelando} onPress={confirmarCancelamento} disabled={justificativa.trim().length < 15} />
          <Button title="Voltar" variant="ghost" onPress={() => setCancelar(null)} />
        </View>
      </Sheet>
    </Screen>
  )
}
