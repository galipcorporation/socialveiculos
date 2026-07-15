import React from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Paywall, Screen, SkeletonCard, Txt } from '../../components/ui'
import { assistenteService, modulosService } from '../../services'
import type { ConversaAssistente, StatusSessao } from '../../services/assistente'
import { formatHora } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const STATUS_INFO: Record<StatusSessao, { label: string; cor: keyof ReturnType<typeof useTheme>['colors'] }> = {
  connected: { label: 'WhatsApp conectado', cor: 'success' },
  connecting: { label: 'Conectando…', cor: 'warning' },
  disconnected: { label: 'WhatsApp desconectado', cor: 'textMuted' },
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

export default function AssistenteIAScreen({ navigation }: RootScreenProps<'AssistenteIA'>) {
  const { colors } = useTheme()
  const gateQ = useQuery({ queryKey: ['modulo', 'assistente'], queryFn: () => modulosService.liberado('assistente') })
  const liberado = gateQ.data === true

  const sessaoQ = useQuery({
    queryKey: ['assistente', 'sessao'],
    queryFn: () => assistenteService.sessao(),
    enabled: liberado,
    refetchInterval: 15000,
  })
  const convQ = useQuery({
    queryKey: ['assistente', 'conversas'],
    queryFn: () => assistenteService.conversas(),
    enabled: liberado,
    refetchInterval: 20000,
  })

  const header = (
    <AppHeader
      title="Assistente"
      large={false}
      back
      right={
        <Pressable onPress={() => navigation.navigate('AssistenteConfig')} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textDim} />
        </Pressable>
      }
    />
  )

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <Screen padded>
          <Paywall
            titulo="Assistente do Vendedor (IA)"
            descricao="Copiloto de WhatsApp: a IA lê as conversas dos seus leads e sugere respostas prontas para você aprovar e enviar — inclusive por áudio na sua voz. Módulo não incluído no plano atual."
          />
        </Screen>
      </Screen>
    )
  }

  const status = sessaoQ.data?.status ?? 'disconnected'
  const info = STATUS_INFO[status]

  const StatusBar = () => (
    <View style={[styles.statusbar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: colors[info.cor] }]} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodySemibold">{info.label}</Txt>
        {status === 'connected' && sessaoQ.data?.numero ? (
          <Txt variant="caption" color="textMuted" style={{ marginTop: 2 }}>{sessaoQ.data.numero} · sincronizado</Txt>
        ) : (
          <Txt variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {status === 'connecting' ? 'aguarde…' : 'não pareado'}
          </Txt>
        )}
      </View>
    </View>
  )

  const Hint = () => (
    <View style={[styles.hint, { backgroundColor: colors.overlaySoft, borderColor: colors.border }]}>
      <Ionicons name="desktop-outline" size={15} color={colors.textMuted} />
      <Txt variant="caption" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
        A conexão do WhatsApp é feita no computador (Gestor → Assistente IA → ler QR). Aqui você acompanha e responde.
      </Txt>
    </View>
  )

  const renderConversa = ({ item }: { item: ConversaAssistente }) => {
    return (
      <Pressable
        onPress={() => navigation.navigate('ConversaAssistente', { id: item.id, nome: item.contato_nome })}
        style={[styles.conv, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.overlay }]}>
          <Txt style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primaryText }}>{iniciais(item.contato_nome)}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="bodySemibold" numberOfLines={1} style={{ flex: 1 }}>{item.contato_nome}</Txt>
            {item.ultima_mensagem_data ? (
              <Txt variant="caption" color="textMuted">{formatHora(item.ultima_mensagem_data)}</Txt>
            ) : null}
          </View>
          <Txt variant="caption" color="textDim" numberOfLines={1} style={{ marginTop: 3 }}>
            {item.ultima_mensagem ?? 'Sem mensagens'}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      {header}
      <FlatList
        data={convQ.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={renderConversa}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshing={convQ.isRefetching}
        onRefresh={() => convQ.refetch()}
        ListHeaderComponent={
          <View>
            <StatusBar />
            <Hint />
          </View>
        }
        ListEmptyComponent={
          convQ.isLoading ? (
            <SkeletonCard withImage={false} />
          ) : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
              <Txt variant="body" color="textDim" style={{ textAlign: 'center' }}>
                Nenhuma conversa ainda.{'\n'}Elas aparecem aqui quando um lead escrever no WhatsApp conectado.
              </Txt>
            </View>
          )
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  statusbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  conv: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.xs + 2 },
  avatar: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
})
