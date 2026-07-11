import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  Avatar, Card, EmptyState, ErrorState, KpiCard, Screen, Sheet, Skeleton, Txt,
} from '../../components/ui'
import { BarChart } from '../../components/charts/BarChart'
import { dashboardService, esteiraService } from '../../services'
import { parseModulos } from '../../lib/modulos'
import { formatBRLCompact, formatNumber, formatRelativo } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function DashboardScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const lojaNome = useLojaAtivaStore((s) => s.lojaNome)
  const [alertasAbertos, setAlertasAbertos] = useState(false)

  const escopo = user?.papel === 'vendedor' ? 'vendedor' : 'loja'

  const kpisQ = useQuery({
    queryKey: ['dashboard', 'kpis', escopo],
    queryFn: () => dashboardService.kpis(escopo),
  })
  const alertasQ = useQuery({
    queryKey: ['dashboard', 'notificacoes'],
    queryFn: () => dashboardService.notificacoes(),
  })
  const esteirasQ = useQuery({
    queryKey: ['esteiras'],
    queryFn: () => esteiraService.listar(),
  })

  const kpis = kpisQ.data
  const alertas = alertasQ.data ?? []
  const esteirasAbertas = (esteirasQ.data ?? []).filter((e) => e.estagio !== 'concluido')
  const primeiroNome = user?.nome?.split(' ')[0] ?? ''

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const gestor = user?.papel === 'gestor'
  const modulos = parseModulos(user?.modulos)
  const simuladorLiberado = gestor || modulos.includes('simulador')

  const acoes: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: 'add-circle', label: 'Novo veículo', onPress: () => navigation.navigate('VeiculoForm') },
    { icon: 'person-add', label: 'Novo lead', onPress: () => navigation.navigate('LeadForm') },
    ...(simuladorLiberado ? [{ icon: 'calculator' as const, label: 'Simular', onPress: () => navigation.navigate('Simulador') }] : []),
    { icon: 'clipboard', label: 'Pós-venda', onPress: () => navigation.navigate('PosVenda') },
  ]

  const navegarPorLink = (link?: string | null) => {
    if (!link) return
    const [tipo, id] = link.split(':')
    if (tipo === 'esteira' && id) navigation.navigate('EsteiraDetalhe', { id })
    else if (tipo === 'lead' && id) navigation.navigate('LeadDetalhe', { id })
    else if (tipo === 'chat' && id) navigation.navigate('Conversa', { id })
  }

  return (
    <Screen scroll={false} padded={false}>
      {/* Header próprio: saudação + notificações */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color="textDim">
            {saudacao()},
          </Txt>
          <Txt style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text }} numberOfLines={1}>
            {primeiroNome} 👋
          </Txt>
          <Txt variant="caption" color="textMuted" numberOfLines={1}>
            {lojaNome ?? 'Sua loja'}
          </Txt>
        </View>
        <Pressable
          onPress={() => setAlertasAbertos(true)}
          hitSlop={8}
          style={[styles.sino, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
          {alertas.length > 0 && (
            <View style={[styles.sinoBadge, { backgroundColor: colors.error, borderColor: colors.bg }]}>
              <Txt style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{alertas.length}</Txt>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Mais' } as never)} hitSlop={8}>
          <Avatar nome={user?.nome} size={44} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {kpisQ.isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <>
            {escopo === 'vendedor' && (
              <View style={[styles.banner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primaryText} />
                <Txt variant="caption" color="primaryText" style={{ flex: 1 }}>
                  Você está vendo os seus números — vendas e comissões abaixo são apenas as suas.
                </Txt>
              </View>
            )}

            {/* KPIs */}
            <View style={styles.kpiGrid}>
              <KpiCard
                label="Estoque ativo"
                value={kpis ? formatNumber(kpis.estoque_ativo) : '—'}
                hint={kpis ? `${kpis.veiculos_publicados} na vitrine` : undefined}
                icon="car-sport"
                tone="primary"
                loading={kpisQ.isLoading}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Estoque', params: { statusInicial: 'disponivel' } } as never)}
              />
              {escopo === 'loja' ? (
                <KpiCard
                  label="Leads ativos"
                  value={kpis ? formatNumber(kpis.leads_ativos) : '—'}
                  hint="no funil de vendas"
                  icon="people"
                  tone="warning"
                  loading={kpisQ.isLoading}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'CRM' } as never)}
                />
              ) : (
                <KpiCard
                  label="A receber"
                  value={kpis ? formatBRLCompact(kpis.minhas_comissoes_pendentes) : '—'}
                  hint="comissões pendentes"
                  icon="time"
                  tone="warning"
                  loading={kpisQ.isLoading}
                  onPress={() => navigation.navigate('Comissoes')}
                />
              )}
              <KpiCard
                label={escopo === 'vendedor' ? 'Minhas vendas' : 'Vendas no mês'}
                value={kpis ? formatNumber(kpis.vendas_mes) : '—'}
                hint="neste mês"
                icon="trending-up"
                tone="success"
                loading={kpisQ.isLoading}
                onPress={() => navigation.navigate('PosVenda')}
              />
              {escopo === 'loja' ? (
                <KpiCard
                  label="Receita no mês"
                  value={kpis ? formatBRLCompact(kpis.receita_mes) : '—'}
                  hint="lançamentos de receita"
                  icon="cash"
                  tone="success"
                  loading={kpisQ.isLoading}
                  onPress={() => navigation.navigate('Financeiro')}
                />
              ) : (
                <KpiCard
                  label="Recebidas no mês"
                  value={kpis ? formatBRLCompact(kpis.minhas_comissoes_pagas_mes) : '—'}
                  hint="comissões pagas"
                  icon="cash"
                  tone="success"
                  loading={kpisQ.isLoading}
                  onPress={() => navigation.navigate('Comissoes')}
                />
              )}
            </View>

            {/* Ações rápidas */}
            <Txt variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              Ações rápidas
            </Txt>
            <View style={styles.acoesRow}>
              {acoes.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={({ pressed }) => [
                    styles.acao,
                    {
                      backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={a.icon} size={22} color={colors.primary} />
                  <Txt variant="caption" color="textDim" align="center" numberOfLines={1}>
                    {a.label}
                  </Txt>
                </Pressable>
              ))}
            </View>

            {/* Vendas em andamento */}
            {esteirasAbertas.length > 0 && (
              <Pressable
                onPress={() =>
                  esteirasAbertas.length === 1
                    ? navigation.navigate('EsteiraDetalhe', { id: esteirasAbertas[0].id })
                    : navigation.navigate('PosVenda')
                }
              >
                <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="car" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodySemibold">Vendas em andamento ({esteirasAbertas.length})</Txt>
                    <Txt variant="caption" color="textDim">Toque para acompanhar o pós-venda</Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              </Pressable>
            )}

            {/* Vendas por mês */}
            <Card style={{ marginTop: spacing.lg }}>
              <Txt variant="title">Vendas por mês</Txt>
              <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.md }}>
                Últimos 6 meses · toque para ver valores
              </Txt>
              {kpisQ.isLoading ? (
                <Skeleton height={140} />
              ) : (
                <BarChart data={(kpis?.vendas_por_mes ?? []).map((m) => ({ label: m.mes, value: m.total }))} />
              )}
            </Card>

            {/* Alertas resumidos */}
            <Card style={{ marginTop: spacing.md }} padded={false}>
              <View style={styles.alertHeader}>
                <Txt variant="title">Alertas</Txt>
                {alertas.length > 0 && (
                  <Pressable onPress={() => setAlertasAbertos(true)}>
                    <Txt variant="captionMedium" color="primaryText">Ver todos</Txt>
                  </Pressable>
                )}
              </View>
              {alertasQ.isLoading ? (
                <View style={{ padding: spacing.md, gap: spacing.xs }}>
                  <Skeleton height={14} />
                  <Skeleton height={14} width="70%" />
                </View>
              ) : alertas.length === 0 ? (
                <View style={{ paddingBottom: spacing.sm }}>
                  <EmptyState icon="checkmark-circle-outline" title="Tudo em dia" subtitle="Nenhum alerta no momento." />
                </View>
              ) : (
                alertas.slice(0, 3).map((al, i) => (
                  <View
                    key={al.id}
                    style={[
                      styles.alertRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyMedium" numberOfLines={1}>{al.titulo}</Txt>
                      <Txt variant="caption" color="textDim" numberOfLines={2}>{al.conteudo}</Txt>
                    </View>
                    <Txt variant="caption" color="textMuted">{formatRelativo(al.created_at)}</Txt>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Sheet de notificações */}
      <Sheet visible={alertasAbertos} onClose={() => setAlertasAbertos(false)} title="Notificações">
        {alertas.length === 0 ? (
          <EmptyState icon="notifications-off-outline" title="Sem notificações" subtitle="Você está em dia com tudo." />
        ) : (
          <View style={{ gap: spacing.xs, paddingBottom: spacing.md }}>
            {alertas.map((al) => (
              <Pressable
                key={al.id}
                onPress={() => {
                  dashboardService.marcarLida(al.id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['dashboard', 'notificacoes'] })
                  })
                  setAlertasAbertos(false)
                  navegarPorLink(al.link)
                }}
                style={({ pressed }) => [
                  styles.notif,
                  { backgroundColor: pressed ? colors.overlay : colors.overlaySoft },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">{al.titulo}</Txt>
                  <Txt variant="caption" color="textDim">{al.conteudo}</Txt>
                  <Txt variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                    {formatRelativo(al.created_at)} · toque para marcar como lida
                  </Txt>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sino: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sinoBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  acoesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  acao: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  notif: {
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
  },
})
