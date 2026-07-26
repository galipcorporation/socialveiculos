import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, ListRow, Screen, Sheet, Txt,
} from '../../components/ui'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'
import { useExperienciaStore } from '../../stores/experienciaStore'
import { useModulosLiberados } from '../../hooks/useModulosLiberados'
import { unregisterPush } from '../../lib/push'

import type { ModuloKey } from '../../lib/modulos'

export default function MaisScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)
  const logoutStore = useAuthStore((s) => s.logout)
  const logout = async () => { await unregisterPush(); logoutStore() }
  const lojaNome = useLojaAtivaStore((s) => s.lojaNome)
  const trocarExperiencia = useExperienciaStore((s) => s.trocar)
  const [sairAberto, setSairAberto] = useState(false)

  const { liberado, gestor } = useModulosLiberados()
  const sep = { borderTopWidth: 1, borderTopColor: colors.border }

  // Estado para exibir paywall/alerta de módulo bloqueado
  const [moduloBloqueado, setModuloBloqueado] = useState<string | null>(null)

  const atalhos: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: 'document-text-outline', label: 'Contratos', onPress: () => abrirFerramenta('contratos', 'Contratos') },
    { icon: 'calculator-outline', label: 'Simulador', onPress: () => abrirFerramenta('simulador', 'Simulador') },
    { icon: 'clipboard-outline', label: 'Pós-venda', onPress: () => navigation.navigate('PosVenda') },
    { icon: 'wallet-outline', label: 'Financeiro', onPress: () => abrirFerramenta('financeiro', 'Financeiro') },
    { icon: 'pricetags-outline', label: 'FIPE', onPress: () => navigation.navigate('Fipe') },
    { icon: 'help-circle-outline', label: 'Ajuda', onPress: () => navigation.navigate('Ajuda') },
  ]


  const abrirFerramenta = (chave: ModuloKey, screenName: string) => {
    if (liberado(chave)) {
      navigation.navigate(screenName as any)
    } else {
      setModuloBloqueado(chave)
    }
  }


  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Mais" />
      <Screen padded style={{ gap: spacing.md }}>
        {/* Atalhos */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {atalhos.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => ({
                flexBasis: '48%', flexGrow: 0,
                backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg,
                padding: spacing.md, gap: spacing.sm,
              })}
            >
              <View style={{
                width: 36, height: 36, borderRadius: radius.full,
                backgroundColor: colors.primary + '24', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={a.icon} size={18} color={colors.primary} />
              </View>
              <Txt variant="captionMedium" numberOfLines={1}>{a.label}</Txt>
            </Pressable>
          ))}
        </View>

        {/* Perfil */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Avatar nome={user?.nome} size={56} />
            <View style={{ flex: 1 }}>
              <Txt variant="title" numberOfLines={1}>{user?.nome}</Txt>
              <Txt variant="caption" color="textDim" numberOfLines={1}>{user?.email}</Txt>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <Badge label={gestor ? 'Gestor' : 'Vendedor'} tone="primary" size="sm" />
                {lojaNome ? <Badge label={lojaNome} tone="neutral" size="sm" /> : null}
              </View>
            </View>
          </View>
        </Card>

        {/* Gestão */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Gestão
          </Txt>
          <ListRow
            icon="clipboard-outline"
            iconColor={colors.primary}
            title="Pós-venda"
            subtitle="Esteira de contrato, pagamento e transferência"
            chevron
            onPress={() => navigation.navigate('PosVenda')}
          />
          <ListRow
            icon="ribbon-outline"
            iconColor={colors.warning}
            title="Minhas comissões"
            subtitle="Vendas e valores a receber"
            chevron
            onPress={() => navigation.navigate('Comissoes')}
          />
          <ListRow
            icon="wallet-outline"
            iconColor={colors.success}
            title="Financeiro"
            subtitle="Receitas, despesas e comissões da loja"
            chevron
            onPress={() => abrirFerramenta('financeiro', 'Financeiro')}
            right={!liberado('financeiro') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          {gestor && (
            <ListRow
              icon="people-outline"
              iconColor={colors.info}
              title="Equipe"
              subtitle="Membros, papéis e percentuais de comissão"
              chevron
              onPress={() => navigation.navigate('Equipe')}
            />
          )}
          {gestor && (
            <ListRow
              icon="shield-checkmark-outline"
              iconColor={colors.warning}
              title="Aprovações"
              subtitle="Solicitações de exclusão e alteração de preço"
              chevron
              onPress={() => navigation.navigate('Aprovacoes')}
            />
          )}
          <ListRow
            icon="git-network-outline"
            iconColor={colors.primary}
            title="Rede Social"
            subtitle="Feed de repasses, propostas e parceiros"
            chevron
            onPress={() => navigation.navigate('RedeSocial')}
          />
        </Card>

        {/* Ferramentas */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Ferramentas
          </Txt>
          <ListRow
            icon="document-text-outline"
            iconColor={colors.success}
            title="Contratos"
            subtitle="Contratos de compra e venda + PDF"
            chevron
            onPress={() => abrirFerramenta('contratos', 'Contratos')}
            style={{ borderTopWidth: 0 }}
            right={!liberado('contratos') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          <ListRow
            icon="calculator-outline"
            iconColor={colors.primary}
            title="Simulador de financiamento"
            subtitle="Calcule parcelas para o cliente na hora"
            chevron
            onPress={() => abrirFerramenta('simulador', 'Simulador')}
            style={sep}
            right={!liberado('simulador') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          <ListRow
            icon="pricetags-outline"
            iconColor={colors.info}
            title="Consulta FIPE"
            subtitle="Valor de referência por marca/modelo/ano"
            chevron
            onPress={() => navigation.navigate('Fipe')}
            style={sep}
          />
          <ListRow
            icon="receipt-outline"
            iconColor={colors.warning}
            title="Notas Fiscais"
            subtitle="Emitir e acompanhar NF-e de venda"
            chevron
            onPress={() => abrirFerramenta('fiscal', 'NotasFiscais')}
            style={sep}
            right={!liberado('fiscal') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          <ListRow
            icon="sparkles-outline"
            iconColor={colors.primary}
            title="Marketing IA"
            subtitle="Gere legendas para redes sociais"
            chevron
            onPress={() => abrirFerramenta('marketing', 'Marketing')}
            style={sep}
            right={!liberado('marketing') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          <ListRow
            icon="chatbubble-ellipses-outline"
            iconColor={colors.info}
            title="Assistente do Vendedor"
            subtitle="Copiloto de IA para abordagem e objeções"
            chevron
            onPress={() => abrirFerramenta('assistente_ia', 'AssistenteIA')}
            style={sep}
            right={!liberado('assistente_ia') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
          />
          {gestor && (
            <ListRow
              icon="globe-outline"
              iconColor={colors.success}
              title="Meu Site"
              subtitle="Construtor do site white-label da loja"
              chevron
              onPress={() => abrirFerramenta('site', 'MeuSite')}
              style={sep}
              right={!liberado('site') ? <Badge label="Bloqueado" tone="neutral" size="sm" /> : undefined}
            />
          )}
        </Card>

        {/* Sheet de Módulo Bloqueado */}
        <Sheet
          visible={!!moduloBloqueado}
          onClose={() => setModuloBloqueado(null)}
          title="Módulo Bloqueado 🔒"
          scrollable={false}
        >
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Txt variant="body" color="textDim">
              Este módulo faz parte da plataforma Social Veículos, mas não está liberado na assinatura ativa da sua loja ou para o seu perfil.
            </Txt>
            <Txt variant="caption" color="textMuted">
              Para liberar o acesso completo aos recursos de {moduloBloqueado?.toUpperCase()}, entre em contato com o administrador da sua loja ou com o suporte.
            </Txt>
            <Button
              title="Entendi"
              variant="primary"
              onPress={() => setModuloBloqueado(null)}
            />
          </View>
        </Sheet>


        {/* Conta & Suporte */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Conta & Suporte
          </Txt>
          <ListRow
            icon="help-circle-outline"
            iconColor={colors.info}
            title="Ajuda e Suporte"
            subtitle="Central de ajuda, dúvidas e atendimento"
            chevron
            onPress={() => navigation.navigate('Ajuda')}
          />
          <ListRow
            icon="settings-outline"
            title="Configurações"
            subtitle="Tema, preferências"
            chevron
            onPress={() => navigation.navigate('Configuracoes')}
            style={sep}
          />
          <ListRow
            icon="storefront-outline"
            iconColor={colors.primary}
            title="Ver como comprador"
            subtitle="Abrir a vitrine pública"
            chevron
            onPress={trocarExperiencia}
            style={sep}
          />
          <ListRow
            icon="log-out-outline"
            iconColor={colors.error}
            title="Sair da conta"
            onPress={() => setSairAberto(true)}
            style={sep}
          />
        </Card>


        <Txt variant="caption" color="textMuted" align="center">
          Social Veículos · v0.1
        </Txt>
      </Screen>

      <Sheet visible={sairAberto} onClose={() => setSairAberto(false)} title="Sair da conta" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Tem certeza que deseja sair? Seus dados locais permanecem salvos neste aparelho.
          </Txt>
          <Button title="Sair" variant="danger" icon="log-out-outline" onPress={logout} />
          <Button title="Cancelar" variant="ghost" onPress={() => setSairAberto(false)} />
        </View>
      </Sheet>
    </Screen>
  )
}
