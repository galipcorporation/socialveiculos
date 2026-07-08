import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, ErrorState, ProgressBar, Screen, Skeleton,
  TONE_ESTAGIO_ESTEIRA, Txt, useToast,
} from '../../components/ui'
import { esteiraService } from '../../services'
import {
  CATEGORIA_ITEM_LABEL, type CategoriaItemEsteira, type EstagioEsteira, type ItemChecklist,
} from '../../services/types'
import { formatBRL, formatData } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import type { RootScreenProps } from '../../navigation/types'

const LABEL_ESTAGIO: Record<EstagioEsteira, string> = {
  contrato: 'Contrato',
  pagamento: 'Pagamento',
  documentos: 'Documentos',
  transferencia: 'Transferência',
  concluido: 'Concluída',
}

const ORDEM: CategoriaItemEsteira[] = ['contrato', 'financeiro', 'documento', 'transferencia']

export default function EsteiraDetalheScreen({ route }: RootScreenProps<'EsteiraDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const gestor = user?.papel !== 'vendedor'

  const q = useQuery({ queryKey: ['esteiras', id], queryFn: () => esteiraService.obter(id) })
  const e = q.data

  const toggleMut = useMutation({
    mutationFn: (itemId: string) => esteiraService.alternarItem(id, itemId),
    onSuccess: (nova) => {
      queryClient.invalidateQueries({ queryKey: ['esteiras'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (nova.estagio === 'concluido') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        toast.show('success', 'Pós-venda concluído! 🎉')
      }
    },
  })

  const comissaoMut = useMutation({
    mutationFn: () => esteiraService.marcarComissaoPaga(id),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.show('success', 'Comissão marcada como paga.')
    },
  })

  if (q.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Venda não encontrada." onRetry={() => navigation.goBack()} />
      </Screen>
    )
  }

  const total = e?.itens.length ?? 0
  const feitos = e?.itens.filter((i) => i.status === 'concluido').length ?? 0

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Pós-venda" large={false} back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Resumo */}
        {e ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Txt variant="title">{e.veiculo_nome}</Txt>
                <Txt variant="caption" color="textDim" style={{ marginTop: 2 }}>
                  Comprador: {e.comprador_nome}
                </Txt>
                {e.vendedor_nome ? (
                  <Txt variant="caption" color="textDim">Vendedor: {e.vendedor_nome}</Txt>
                ) : null}
              </View>
              <Badge label={LABEL_ESTAGIO[e.estagio]} tone={TONE_ESTAGIO_ESTEIRA[e.estagio]} />
            </View>
            <View style={styles.valores}>
              <View>
                <Txt variant="caption" color="textMuted">Valor da venda</Txt>
                <Txt style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
                  {formatBRL(e.valor_venda)}
                </Txt>
              </View>
              {e.comissao_valor != null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption" color="textMuted">Comissão</Txt>
                  <Txt
                    style={{
                      fontFamily: fonts.displayBold,
                      fontSize: 20,
                      color: e.comissao_paga ? colors.success : colors.warning,
                    }}
                  >
                    {formatBRL(e.comissao_valor)}
                  </Txt>
                </View>
              )}
            </View>
            <ProgressBar
              progress={total ? feitos / total : 0}
              color={e.estagio === 'concluido' ? colors.success : colors.primary}
              style={{ marginTop: spacing.sm }}
            />
            <Txt variant="caption" color="textMuted" style={{ marginTop: 6 }}>
              {feitos} de {total} etapas concluídas · aberta em {formatData(e.aberta_em)}
            </Txt>
            {gestor && e.comissao_valor != null && e.comissao_paga === false && (
              <Button
                title="Marcar comissão como paga"
                variant="tonal"
                size="sm"
                icon="checkmark-done-outline"
                loading={comissaoMut.isPending}
                onPress={() => comissaoMut.mutate()}
                style={{ marginTop: spacing.sm }}
              />
            )}
          </Card>
        ) : (
          <Card style={{ gap: 8 }}>
            <Skeleton width="70%" height={18} />
            <Skeleton width="50%" height={13} />
            <Skeleton height={8} round />
          </Card>
        )}

        {/* Checklist por categoria */}
        {e &&
          ORDEM.map((cat) => {
            const itens = e.itens.filter((i) => i.categoria === cat)
            if (itens.length === 0) return null
            const concluidos = itens.filter((i) => i.status === 'concluido').length
            return (
              <Card key={cat} padded={false}>
                <View style={styles.catHeader}>
                  <Txt variant="title">{CATEGORIA_ITEM_LABEL[cat]}</Txt>
                  <Txt variant="caption" color="textMuted">
                    {concluidos}/{itens.length}
                  </Txt>
                </View>
                {itens.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleMut.mutate(item.id)}
                    disabled={toggleMut.isPending}
                  />
                ))}
              </Card>
            )
          })}
      </ScrollView>
    </Screen>
  )
}

function ItemRow({ item, onToggle, disabled }: { item: ItemChecklist; onToggle: () => void; disabled: boolean }) {
  const { colors } = useTheme()
  const feito = item.status === 'concluido'
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onToggle()
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.item,
        { borderTopColor: colors.border, backgroundColor: pressed ? colors.overlaySoft : 'transparent' },
      ]}
    >
      <View
        style={[
          styles.check,
          feito
            ? { backgroundColor: colors.success, borderColor: colors.success }
            : { borderColor: item.vencido ? colors.error : colors.borderHover },
        ]}
      >
        {feito && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt
          variant="body"
          style={feito ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}
        >
          {item.titulo}
        </Txt>
        <Txt variant="caption" color={item.vencido ? 'error' : 'textMuted'}>
          {item.vencido
            ? `Vencido — prazo ${formatData(item.prazo_em)}`
            : feito
              ? `Concluído em ${formatData(item.concluido_em)}`
              : item.prazo_em
                ? `Prazo: ${formatData(item.prazo_em)}`
                : item.responsavel === 'loja'
                  ? 'Responsável: loja'
                  : 'Responsável: comprador'}
        </Txt>
      </View>
      {item.responsavel === 'comprador' && (
        <Ionicons name="person-outline" size={15} color={colors.textMuted} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  valores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
