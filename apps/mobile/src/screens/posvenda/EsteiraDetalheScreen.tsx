import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, ErrorState, Input, ProgressBar, Screen, Sheet,
  Skeleton, TONE_ESTAGIO_ESTEIRA, Txt, useToast,
} from '../../components/ui'
import { esteiraService } from '../../services'
import {
  CATEGORIA_ITEM_LABEL, type CategoriaItemEsteira, type EstagioEsteira, type ItemChecklist,
} from '../../services/types'
import { formatBRL, formatData, maskMoedaInput, parseMoedaInput } from '../../lib/format'
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
    mutationFn: (p: { itemId: string; valor?: number }) => esteiraService.alternarItem(id, p.itemId, p.valor),
    onSuccess: (nova) => {
      queryClient.invalidateQueries({ queryKey: ['esteiras'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      setValorItem(null)
      if (nova.estagio === 'concluido') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        toast.show('success', 'Pós-venda concluído! 🎉')
      }
    },
  })

  // Ao concluir um item financeiro, pede o valor para lançar no financeiro.
  const [valorItem, setValorItem] = useState<ItemChecklist | null>(null)
  const onToggleItem = (item: ItemChecklist) => {
    const concluindo = item.status !== 'concluido'
    if (concluindo && item.categoria === 'financeiro') {
      setValorItem(item)
      return
    }
    toggleMut.mutate({ itemId: item.id })
  }

  const comissaoMut = useMutation({
    mutationFn: () => esteiraService.marcarComissaoPaga(id),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.show('success', 'Comissão marcada como paga.')
    },
  })

  const concluirMut = useMutation({
    mutationFn: () => esteiraService.concluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      toast.show('success', 'Pós-venda concluído e arquivado! 🎉')
    },
    onError: (err) => toast.show('error', err instanceof Error ? err.message : 'Não foi possível concluir.'),
  })

  const anexarMut = useMutation({
    mutationFn: (p: { itemId: string; nome: string }) => esteiraService.anexarDocumento(id, p.itemId, p.nome),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['esteiras'] }); toast.show('success', 'Documento anexado.') },
  })
  const addItemMut = useMutation({
    mutationFn: (p: { titulo: string; categoria: CategoriaItemEsteira; obrigatorio: boolean }) => esteiraService.adicionarItem(id, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['esteiras'] }); toast.show('success', 'Item adicionado.') },
  })
  const removeItemMut = useMutation({
    mutationFn: (itemId: string) => esteiraService.removerItem(id, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['esteiras'] }),
  })

  const [anexarItem, setAnexarItem] = useState<ItemChecklist | null>(null)
  const [addCat, setAddCat] = useState<CategoriaItemEsteira | null>(null)

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Txt variant="caption" color="textMuted">{concluidos}/{itens.length}</Txt>
                    {gestor && e.estagio !== 'concluido' && (
                      <Pressable onPress={() => setAddCat(cat)} hitSlop={8}>
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                      </Pressable>
                    )}
                  </View>
                </View>
                {itens.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    gestor={gestor}
                    onToggle={() => onToggleItem(item)}
                    onAnexar={() => setAnexarItem(item)}
                    onRemover={() => removeItemMut.mutate(item.id)}
                    disabled={toggleMut.isPending}
                  />
                ))}
                {cat === 'contrato' && (
                  <Button
                    title="Gerar contrato"
                    variant="outline"
                    icon="document-text-outline"
                    size="sm"
                    onPress={() => navigation.navigate('Contratos', { contratoId: e.contrato_id })}
                    style={{ margin: spacing.sm }}
                  />
                )}
                {cat === 'documento' && (
                  <Button
                    title="Emitir NF-e"
                    variant="outline"
                    icon="receipt-outline"
                    size="sm"
                    onPress={() => navigation.navigate('NotasFiscais', { contratoId: e.contrato_id })}
                    style={{ margin: spacing.sm }}
                  />
                )}
              </Card>
            )
          })}

        {/* Concluir esteira */}
        {e && e.estagio !== 'concluido' && (() => {
          const pendObrig = e.itens.filter((i) => i.obrigatorio && i.status !== 'concluido' && i.status !== 'nao_aplicavel').length
          return (
            <Button
              title={pendObrig > 0 ? `Restam ${pendObrig} item(ns) obrigatório(s)` : 'Concluir pós-venda'}
              icon="checkmark-done"
              variant="success"
              loading={concluirMut.isPending}
              disabled={pendObrig > 0}
              onPress={() => concluirMut.mutate()}
              full
            />
          )
        })()}
      </ScrollView>

      {/* Anexar documento */}
      {anexarItem && (
        <AnexarSheet
          item={anexarItem}
          onClose={() => setAnexarItem(null)}
          onConfirm={(nome) => { anexarMut.mutate({ itemId: anexarItem.id, nome }); setAnexarItem(null) }}
        />
      )}
      {/* Adicionar item */}
      {addCat && (
        <AddItemSheet
          categoria={addCat}
          onClose={() => setAddCat(null)}
          onConfirm={(titulo, obrigatorio) => { addItemMut.mutate({ titulo, categoria: addCat, obrigatorio }); setAddCat(null) }}
        />
      )}
      {/* Valor do lançamento ao concluir item financeiro */}
      {valorItem && (
        <ValorItemSheet
          item={valorItem}
          loading={toggleMut.isPending}
          onClose={() => setValorItem(null)}
          onConfirm={(valor) => toggleMut.mutate({ itemId: valorItem.id, valor })}
        />
      )}
    </Screen>
  )
}

function ValorItemSheet({
  item, loading, onClose, onConfirm,
}: { item: ItemChecklist; loading: boolean; onClose: () => void; onConfirm: (valor?: number) => void }) {
  const [valor, setValor] = useState('')
  const v = parseMoedaInput(valor)
  return (
    <Sheet visible onClose={onClose} title={item.titulo} scrollable={false}>
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Ao concluir este item, um lançamento é criado no financeiro. Informe o valor (ou pule para lançar R$ 0 e ajustar depois).
        </Txt>
        <Input
          label="Valor"
          placeholder="0,00"
          keyboardType="numeric"
          icon="cash-outline"
          value={valor}
          onChangeText={(t) => setValor(maskMoedaInput(t))}
        />
        <Button title="Concluir e lançar" icon="checkmark" loading={loading} onPress={() => onConfirm(v > 0 ? v : undefined)} />
        <Button title="Concluir sem valor" variant="ghost" onPress={() => onConfirm(undefined)} />
      </View>
    </Sheet>
  )
}

function AnexarSheet({ item, onClose, onConfirm }: { item: ItemChecklist; onClose: () => void; onConfirm: (nome: string) => void }) {
  const [nome, setNome] = useState(item.documento_nome ?? '')
  return (
    <Sheet visible onClose={onClose} title="Anexar documento">
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Txt variant="caption" color="textDim">{item.titulo}</Txt>
        <Input label="Nome do arquivo (PDF)" value={nome} onChangeText={setNome} placeholder="ex.: crlv-assinado.pdf" autoCapitalize="none" hint="No app real, aqui abre o seletor de arquivos." />
        <Button title="Anexar e concluir item" icon="document-attach-outline" disabled={nome.trim().length < 3} onPress={() => onConfirm(nome.trim())} />
      </View>
    </Sheet>
  )
}

function AddItemSheet({ categoria, onClose, onConfirm }: { categoria: CategoriaItemEsteira; onClose: () => void; onConfirm: (titulo: string, obrigatorio: boolean) => void }) {
  const { colors } = useTheme()
  const [titulo, setTitulo] = useState('')
  const [obrig, setObrig] = useState(true)
  return (
    <Sheet visible onClose={onClose} title={`Novo item · ${CATEGORIA_ITEM_LABEL[categoria]}`}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Input label="Título do item" value={titulo} onChangeText={setTitulo} placeholder="ex.: Enviar boleto de IPVA" />
        <Pressable onPress={() => setObrig((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4 }}>
          <Ionicons name={obrig ? 'checkbox' : 'square-outline'} size={22} color={obrig ? colors.primary : colors.textMuted} />
          <Txt variant="body">Item obrigatório para concluir</Txt>
        </Pressable>
        <Button title="Adicionar item" icon="add" disabled={titulo.trim().length < 3} onPress={() => onConfirm(titulo.trim(), obrig)} />
      </View>
    </Sheet>
  )
}

function ItemRow({ item, gestor, onToggle, onAnexar, onRemover, disabled }: {
  item: ItemChecklist; gestor: boolean; onToggle: () => void; onAnexar: () => void; onRemover: () => void; disabled: boolean
}) {
  const { colors } = useTheme()
  const feito = item.status === 'concluido'
  const podeAnexar = item.categoria === 'documento' && !feito
  return (
    <View style={[styles.item, { borderTopColor: colors.border }]}>
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle() }}
        disabled={disabled}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}
      >
        <View
          style={[
            styles.check,
            feito ? { backgroundColor: colors.success, borderColor: colors.success } : { borderColor: item.vencido ? colors.error : colors.borderHover },
          ]}
        >
          {feito && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="body" style={feito ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
            {item.titulo}{item.obrigatorio ? '' : ' (opcional)'}
          </Txt>
          <Txt variant="caption" color={item.vencido ? 'error' : 'textMuted'}>
            {item.documento_nome
              ? `📎 ${item.documento_nome}`
              : item.vencido
                ? `Vencido — prazo ${formatData(item.prazo_em)}`
                : feito
                  ? `Concluído em ${formatData(item.concluido_em)}`
                  : item.prazo_em
                    ? `Prazo: ${formatData(item.prazo_em)}`
                    : item.responsavel === 'loja' ? 'Responsável: loja' : 'Responsável: comprador'}
          </Txt>
        </View>
      </Pressable>
      {podeAnexar && (
        <Pressable onPress={onAnexar} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
        </Pressable>
      )}
      {gestor && (
        <Pressable onPress={onRemover} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
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
