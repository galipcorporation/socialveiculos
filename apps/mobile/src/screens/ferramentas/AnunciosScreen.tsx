import React, { useCallback, useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, ConfirmSheet, EmptyState, FilterChips, Paywall, Screen,
  SearchBar, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { anunciosService, modulosService } from '../../services'
import type {
  CelulaAnuncio, LinhaAnuncio, Portal, StatusAnuncio,
} from '../../services/anuncios'
import { formatBRL } from '../../lib/format'

/** Cor e rótulo de cada estado — mesma leitura da grade do gestor. */
const VISUAL: Record<StatusAnuncio, { rotulo: string; tone: 'success' | 'info' | 'error' | 'warning' | 'neutral' }> = {
  publicado: { rotulo: 'No ar', tone: 'success' },
  sincronizando: { rotulo: 'Enviando', tone: 'info' },
  erro: { rotulo: 'Erro', tone: 'error' },
  baixa_pendente: { rotulo: 'Baixar', tone: 'warning' },
  despublicado: { rotulo: 'Fora', tone: 'neutral' },
  nao_publicado: { rotulo: 'Fora', tone: 'neutral' },
}

const FILTROS: { value: string; label: string }[] = [
  { value: 'baixa_pendente', label: 'Pendentes' },
  { value: 'erro', label: 'Com erro' },
  { value: 'publicado', label: 'Publicados' },
  { value: '', label: 'Todos' },
]

export default function AnunciosScreen() {
  const { colors } = useTheme()
  const toast = useToast()
  const queryClient = useQueryClient()

  const gateQ = useQuery({
    queryKey: ['modulo', 'marketing'],
    queryFn: () => modulosService.liberado('marketing'),
  })
  const liberado = gateQ.data === true

  const [filtro, setFiltro] = useState<string>('baixa_pendente')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState<{ celula: CelulaAnuncio; rotulo: string } | null>(null)

  const portaisQ = useQuery({
    queryKey: ['anuncios', 'portais'],
    queryFn: () => anunciosService.portais(),
    enabled: liberado,
  })
  const gradeQ = useQuery({
    queryKey: ['anuncios', 'grade', filtro, busca],
    queryFn: () => anunciosService.grade({ status: filtro as StatusAnuncio | '', busca, limit: 40 }),
    enabled: liberado,
  })
  const pendQ = useQuery({
    queryKey: ['anuncios', 'pendencias'],
    queryFn: () => anunciosService.pendencias(),
    enabled: liberado,
  })

  const portais = useMemo(() => portaisQ.data ?? [], [portaisQ.data])
  const linhas = gradeQ.data?.itens ?? []
  const pendencias = pendQ.data ?? []

  const porNome = useMemo(
    () => Object.fromEntries(portais.map((p) => [p.nome, p])) as Record<string, Portal>,
    [portais],
  )

  const recarregar = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['anuncios'] })
  }, [queryClient])

  async function alternar(linha: LinhaAnuncio, celula: CelulaAnuncio, portal: Portal) {
    if (!portal.disponivel) {
      toast.show('info', portal.motivo || `${portal.rotulo} ainda não está integrado.`)
      return
    }
    if (celula.status === 'baixa_pendente' && celula.id) {
      setConfirmar({ celula, rotulo: portal.rotulo })
      return
    }
    if (linha.vendido) {
      toast.show('info', 'Veículo vendido — não é possível publicar.')
      return
    }

    setOcupado(true)
    try {
      const publicando = celula.status !== 'publicado'
      const r = publicando
        ? await anunciosService.publicar([linha.veiculo_id], [portal.nome])
        : await anunciosService.despublicar([linha.veiculo_id], [portal.nome])

      if (r.enfileirados > 0) {
        toast.show('success', publicando ? `Enviando para ${portal.rotulo}…` : `Removendo de ${portal.rotulo}…`)
      } else if (r.ignorados?.length) {
        toast.show('error', r.ignorados[0])
      }
      await recarregar()
    } catch {
      toast.show('error', 'Não foi possível concluir a ação.')
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarBaixa() {
    if (!confirmar?.celula.id) return
    setOcupado(true)
    try {
      await anunciosService.confirmarBaixa(confirmar.celula.id)
      toast.show('success', `Baixa confirmada em ${confirmar.rotulo}.`)
      setConfirmar(null)
      await recarregar()
    } catch {
      toast.show('error', 'Não foi possível confirmar a baixa.')
    } finally {
      setOcupado(false)
    }
  }

  if (gateQ.isLoading) {
    return (
      <Screen>
        <AppHeader title="Anúncios" />
        <SkeletonCard />
      </Screen>
    )
  }

  if (!liberado) {
    return (
      <Screen>
        <AppHeader title="Anúncios" />
        <Paywall
          titulo="Marketing"
          descricao="Publique seus veículos nos portais de anúncio e controle onde cada carro está no ar."
        />
      </Screen>
    )
  }

  const carregando = gradeQ.isLoading || portaisQ.isLoading

  return (
    <Screen>
      <AppHeader
        title="Anúncios"
        subtitle={pendencias.length > 0 ? `${pendencias.length} baixa(s) pendente(s)` : undefined}
      />

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por marca, modelo ou placa"
        />
        <FilterChips
          options={FILTROS.map((f) => ({
            value: f.value,
            label: f.value === 'baixa_pendente' && pendencias.length > 0
              ? `${f.label} (${pendencias.length})`
              : f.label,
          }))}
          selected={filtro}
          onSelect={setFiltro}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={gradeQ.isFetching} onRefresh={recarregar} tintColor={colors.primary} />
        }
      >
        {/* Portais sem integração: aviso honesto, uma vez só */}
        {portais.some((p) => !p.disponivel) && filtro === '' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
            padding: spacing.sm, borderRadius: radius.md,
            backgroundColor: colors.warning + '18',
            borderWidth: 1, borderColor: colors.warning + '44',
          }}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Txt variant="caption" style={{ flex: 1, color: colors.textDim }}>
              {portais.filter((p) => !p.disponivel).map((p) => p.rotulo).join(', ')} ainda não
              {portais.filter((p) => !p.disponivel).length > 1 ? ' estão integrados' : ' está integrado'} —
              publique manualmente nesses sites.
            </Txt>
          </View>
        )}

        {carregando && <SkeletonCard />}

        {!carregando && linhas.length === 0 && (
          <EmptyState
            icon="megaphone-outline"
            title={filtro === 'baixa_pendente' ? 'Nenhuma baixa pendente' : 'Nenhum veículo'}
            subtitle={
              filtro === 'baixa_pendente'
                ? 'Quando um veículo for vendido, os portais sem remoção automática aparecem aqui.'
                : 'Nenhum veículo encontrado com este filtro.'
            }
          />
        )}

        {!carregando && linhas.map((linha) => (
          <View
            key={linha.veiculo_id}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: linha.vendido ? colors.error + '55' : colors.border,
              padding: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {linha.foto ? (
                <Image
                  source={{ uri: linha.foto }}
                  style={{ width: 56, height: 42, borderRadius: radius.sm }}
                />
              ) : (
                <View style={{
                  width: 56, height: 42, borderRadius: radius.sm,
                  backgroundColor: colors.surfaceDim,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="car-outline" size={18} color={colors.textMuted} />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
                  <Txt variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>
                    {linha.titulo}
                  </Txt>
                  {linha.vendido && <Badge label="Vendido" tone="error" size="sm" />}
                </View>
                <Txt variant="caption" style={{ color: colors.textMuted }}>
                  {linha.placa || 'sem placa'} · {formatBRL(linha.preco_venda ?? 0)}
                </Txt>
              </View>
            </View>

            {/* Chips de portal: tocar alterna publicar/retirar */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
              {portais.map((portal) => {
                const celula = linha.celulas.find((c) => c.portal === portal.nome)
                  ?? { portal: portal.nome, status: 'nao_publicado' as StatusAnuncio }
                const v = VISUAL[celula.status] ?? VISUAL.nao_publicado
                const bloqueado = !portal.disponivel
                const inativo = bloqueado
                  || ocupado
                  || (linha.vendido && (celula.status === 'nao_publicado' || celula.status === 'despublicado'))

                return (
                  <Pressable
                    key={portal.nome}
                    onPress={() => alternar(linha, celula, porNome[portal.nome])}
                    disabled={ocupado}
                    accessibilityRole="button"
                    accessibilityLabel={`${portal.rotulo}: ${bloqueado ? 'aguardando integração' : v.rotulo}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingVertical: 5, paddingHorizontal: spacing.xs,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: bloqueado ? colors.border : colors[v.tone === 'neutral' ? 'border' : v.tone] + '55',
                      backgroundColor: bloqueado || v.tone === 'neutral'
                        ? 'transparent'
                        : colors[v.tone] + '1A',
                      opacity: inativo ? 0.45 : pressed ? 0.6 : 1,
                    })}
                  >
                    {bloqueado ? (
                      <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                    ) : (
                      <View style={{
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: v.tone === 'neutral' ? colors.textMuted : colors[v.tone],
                      }} />
                    )}
                    <Txt variant="caption" style={{
                      fontSize: 11,
                      color: bloqueado || v.tone === 'neutral' ? colors.textMuted : colors[v.tone],
                    }}>
                      {portal.rotulo}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>

            {/* Motivo do erro/baixa direto no card — sem tela de detalhe */}
            {linha.celulas.filter((c) => c.erro && (c.status === 'erro' || c.status === 'baixa_pendente')).map((c) => (
              <Txt key={c.portal} variant="caption" style={{ color: colors.textMuted, fontSize: 11 }}>
                {porNome[c.portal]?.rotulo ?? c.portal}: {c.erro}
              </Txt>
            ))}
          </View>
        ))}
      </ScrollView>

      <ConfirmSheet
        visible={!!confirmar}
        title="Confirmar baixa"
        message={`Você já removeu este anúncio do ${confirmar?.rotulo}? Não conseguimos verificar por lá — a confirmação fica registrada em seu nome.`}
        confirmText="Já removi"
        cancelText="Ainda não"
        icon="alert-circle-outline"
        loading={ocupado}
        onConfirm={confirmarBaixa}
        onClose={() => setConfirmar(null)}
      />
    </Screen>
  )
}
