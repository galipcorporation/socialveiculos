import React, { useState } from 'react'
import { FlatList, Linking, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, EmptyState, ErrorState, FilterChips, Input,
  Screen, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { repassesService } from '../../services'
import type { LojaParceira, PropostaRepasse, PublicacaoRepasse, StatusProposta } from '../../services/types'
import { STATUS_PROPOSTA_LABEL } from '../../services/types'
import { formatBRL, formatRelativo, formatKm, formatTelefone } from '../../lib/format'

type Aba = 'feed' | 'propostas' | 'parceiros'

const TONE_PROPOSTA: Record<StatusProposta, 'warning' | 'success' | 'error' | 'neutral'> = {
  pendente: 'warning',
  aceita: 'success',
  rejeitada: 'error',
  cancelada: 'neutral',
}

export default function RedeSocialScreen() {
  const [aba, setAba] = useState<Aba>('feed')

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Rede Social" subtitle="Repasses entre lojas parceiras" />
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <FilterChips
          options={[
            { value: 'feed', label: 'Feed' },
            { value: 'propostas', label: 'Propostas' },
            { value: 'parceiros', label: 'Parceiros' },
          ]}
          selected={aba}
          onSelect={(v) => setAba(v as Aba)}
        />
      </View>
      {aba === 'feed' && <FeedTab />}
      {aba === 'propostas' && <PropostasTab />}
      {aba === 'parceiros' && <ParceirosTab />}
    </View>
  )
}

// ── Feed ──────────────────────────────────────────────────
function FeedTab() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['repasses', 'feed'], queryFn: () => repassesService.feed() })

  const [proposta, setProposta] = useState<PublicacaoRepasse | null>(null)
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)

  const curtir = async (id: string) => {
    await repassesService.curtir(id)
    queryClient.invalidateQueries({ queryKey: ['repasses', 'feed'] })
  }

  const abrirProposta = (p: PublicacaoRepasse) => {
    setProposta(p)
    setValor(p.valor_repasse ? String(p.valor_repasse) : '')
    setObs('')
  }

  const enviarProposta = async () => {
    if (!proposta) return
    const v = parseInt(valor.replace(/\D/g, ''), 10) || 0
    if (v <= 0) { toast.show('error', 'Informe o valor da proposta.'); return }
    setEnviando(true)
    try {
      await repassesService.criarProposta({ loja_nome: proposta.loja_nome, veiculo_nome: proposta.veiculo_nome, valor: v, observacoes: obs.trim() || undefined })
      queryClient.invalidateQueries({ queryKey: ['repasses', 'propostas'] })
      toast.show('success', 'Proposta enviada.')
      setProposta(null)
    } finally {
      setEnviando(false)
    }
  }

  if (q.isLoading) return <View style={{ padding: spacing.md }}>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />

  return (
    <>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshing={q.isRefetching}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['repasses', 'feed'] })}
        ListEmptyComponent={<EmptyState icon="megaphone-outline" title="Feed vazio" subtitle="Veículos em repasse de parceiros aparecem aqui." />}
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar nome={item.loja_nome} size={40} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold" numberOfLines={1}>{item.loja_nome}</Txt>
                <Txt variant="caption" color="textMuted">{item.autor_nome} · {formatRelativo(item.created_at)}</Txt>
              </View>
              {item.valor_repasse != null && (
                <Badge label={formatBRL(item.valor_repasse)} tone="info" />
              )}
            </View>

            <View style={{ borderRadius: 10, backgroundColor: colors.overlaySoft, padding: spacing.sm }}>
              <Txt variant="bodyMedium" numberOfLines={1}>{item.veiculo_nome}</Txt>
              <Txt variant="caption" color="textDim">
                {[item.veiculo_ano, item.veiculo_km != null ? formatKm(item.veiculo_km) : null].filter(Boolean).join(' · ')}
              </Txt>
            </View>

            {item.conteudo ? <Txt variant="caption" color="textDim">{item.conteudo}</Txt> : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Pressable onPress={() => curtir(item.id)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={item.curtido_por_mim ? 'heart' : 'heart-outline'} size={18} color={item.curtido_por_mim ? colors.error : colors.textDim} />
                <Txt variant="caption" color="textDim">{item.curtidas}</Txt>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.textDim} />
                <Txt variant="caption" color="textDim">{item.comentarios}</Txt>
              </View>
              <View style={{ flex: 1 }} />
              <Button title="Propor repasse" size="sm" icon="pricetag-outline" onPress={() => abrirProposta(item)} />
            </View>
          </Card>
        )}
      />

      <Sheet visible={proposta !== null} onClose={() => setProposta(null)} title="Propor repasse">
        {proposta && (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            <Txt variant="caption" color="textDim">{proposta.loja_nome} · {proposta.veiculo_nome}</Txt>
            <Input label="Valor da proposta (R$)" value={valor} onChangeText={(v) => setValor(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" />
            <Input label="Observações (opcional)" value={obs} onChangeText={setObs} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder="Ex.: consigo buscar na sexta" />
            <Button title="Enviar proposta" icon="send" loading={enviando} onPress={enviarProposta} full />
          </View>
        )}
      </Sheet>
    </>
  )
}

// ── Propostas ─────────────────────────────────────────────
function PropostasTab() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['repasses', 'propostas'], queryFn: () => repassesService.propostas() })

  const responder = async (p: PropostaRepasse, aceitar: boolean) => {
    await repassesService.responderProposta(p.id, aceitar)
    queryClient.invalidateQueries({ queryKey: ['repasses', 'propostas'] })
    toast.show('success', aceitar ? 'Proposta aceita.' : 'Proposta rejeitada.')
  }

  const cancelar = async (p: PropostaRepasse) => {
    await repassesService.cancelarProposta(p.id)
    queryClient.invalidateQueries({ queryKey: ['repasses', 'propostas'] })
    toast.show('success', 'Proposta cancelada.')
  }

  if (q.isLoading) return <View style={{ padding: spacing.md }}>{[0, 1].map((i) => <SkeletonCard key={i} withImage={false} />)}</View>
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshing={q.isRefetching}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['repasses', 'propostas'] })}
      ListEmptyComponent={<EmptyState icon="swap-horizontal-outline" title="Sem propostas" subtitle="Propostas de repasse enviadas e recebidas aparecem aqui." />}
      renderItem={({ item }) => (
        <Card style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Badge label={item.direcao === 'enviada' ? 'Enviada' : 'Recebida'} tone={item.direcao === 'enviada' ? 'info' : 'primary'} size="sm" />
            <Badge label={STATUS_PROPOSTA_LABEL[item.status]} tone={TONE_PROPOSTA[item.status]} size="sm" />
            <View style={{ flex: 1 }} />
            <Txt variant="bodyMedium">{formatBRL(item.valor_proposta)}</Txt>
          </View>
          <Txt variant="bodyMedium" numberOfLines={1}>{item.veiculo_nome}</Txt>
          <Txt variant="caption" color="textDim">{item.loja_parceira_nome} · {formatRelativo(item.created_at)}</Txt>
          {item.observacoes ? <Txt variant="caption" color="textMuted">{item.observacoes}</Txt> : null}

          {item.status === 'pendente' && (
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
              {item.direcao === 'recebida' ? (
                <>
                  <Button title="Aceitar" variant="success" size="sm" onPress={() => responder(item, true)} style={{ flex: 1 }} />
                  <Button title="Rejeitar" variant="outline" size="sm" onPress={() => responder(item, false)} style={{ flex: 1 }} />
                </>
              ) : (
                <Button title="Cancelar proposta" variant="outline" size="sm" onPress={() => cancelar(item)} full />
              )}
            </View>
          )}
        </Card>
      )}
    />
  )
}

// ── Parceiros ─────────────────────────────────────────────
function ParceirosTab() {
  const { colors } = useTheme()
  const toast = useToast()
  const q = useQuery({ queryKey: ['repasses', 'parceiros'], queryFn: () => repassesService.parceiros() })

  const whatsapp = async (p: LojaParceira) => {
    if (!p.whatsapp) { toast.show('info', 'Loja sem WhatsApp cadastrado.'); return }
    const url = `https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`
    const ok = await Linking.canOpenURL(url)
    if (ok) Linking.openURL(url)
    else toast.show('info', 'Não foi possível abrir o WhatsApp.')
  }

  if (q.isLoading) return <View style={{ padding: spacing.md }}>{[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}</View>
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="business-outline" title="Sem parceiros" subtitle="Lojas parceiras da rede aparecem aqui." />}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Avatar nome={item.nome} size={44} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Txt variant="bodySemibold" numberOfLines={1}>{item.nome}</Txt>
                {item.verificada && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
              </View>
              <Txt variant="caption" color="textDim">
                {[item.cidade && item.estado ? `${item.cidade}/${item.estado}` : null, `${item.total_veiculos} veículos`].filter(Boolean).join(' · ')}
              </Txt>
              {item.telefone ? <Txt variant="caption" color="textMuted">{formatTelefone(item.telefone)}</Txt> : null}
            </View>
            <Button title="WhatsApp" size="sm" variant="outline" icon="logo-whatsapp" onPress={() => whatsapp(item)} />
          </View>
        </Card>
      )}
    />
  )
}
