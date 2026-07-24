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
import { parseModulos } from '../../lib/modulos'
import { unregisterPush } from '../../lib/push'

export default function MaisScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)
  const logoutStore = useAuthStore((s) => s.logout)
  const logout = async () => { await unregisterPush(); logoutStore() }
  const lojaNome = useLojaAtivaStore((s) => s.lojaNome)
  const trocarExperiencia = useExperienciaStore((s) => s.trocar)
  const [sairAberto, setSairAberto] = useState(false)

  const gestor = user?.papel === 'gestor'
  const modulos = parseModulos(user?.modulos)
  const liberado = (chave: ReturnType<typeof parseModulos>[number]) => gestor || modulos.includes(chave)
  const sep = { borderTopWidth: 1, borderTopColor: colors.border }

  const atalhos: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = gestor
    ? [
        { icon: 'wallet-outline', label: 'Financeiro', onPress: () => navigation.navigate('Financeiro') },
        { icon: 'people-outline', label: 'Equipe', onPress: () => navigation.navigate('Equipe') },
        { icon: 'clipboard-outline', label: 'Pós-venda', onPress: () => navigation.navigate('PosVenda') },
        { icon: 'sparkles-outline', label: 'Marketing', onPress: () => navigation.navigate('Marketing') },
      ]
    : [
        ...(liberado('simulador')
          ? [{ icon: 'calculator-outline' as const, label: 'Simulador', onPress: () => navigation.navigate('Simulador') }]
          : []),
        ...(liberado('assistente_ia')
          ? [{ icon: 'chatbubble-ellipses-outline' as const, label: 'Assistente IA', onPress: () => navigation.navigate('AssistenteIA') }]
          : []),
        { icon: 'ribbon-outline', label: 'Comissões', onPress: () => navigation.navigate('Comissoes') },
        { icon: 'pricetags-outline', label: 'FIPE', onPress: () => navigation.navigate('Fipe') },
      ]

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
                flexBasis: '48%', flexGrow: 1,
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
          {liberado('financeiro') && (
            <ListRow
              icon="wallet-outline"
              iconColor={colors.success}
              title="Financeiro"
              subtitle="Receitas, despesas e comissões da loja"
              chevron
              onPress={() => navigation.navigate('Financeiro')}
            />
          )}
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
          {liberado('simulador') && (
            <ListRow
              icon="calculator-outline"
              iconColor={colors.primary}
              title="Simulador de financiamento"
              subtitle="Calcule parcelas para o cliente na hora"
              chevron
              onPress={() => navigation.navigate('Simulador')}
              style={{ borderTopWidth: 0 }}
            />
          )}
          <ListRow
            icon="pricetags-outline"
            iconColor={colors.info}
            title="Consulta FIPE"
            subtitle="Valor de referência por marca/modelo/ano"
            chevron
            onPress={() => navigation.navigate('Fipe')}
            style={sep}
          />
          {liberado('contratos') && (
            <ListRow
              icon="document-text-outline"
              iconColor={colors.success}
              title="Contratos"
              subtitle="Contratos de compra e venda + PDF"
              chevron
              onPress={() => navigation.navigate('Contratos')}
              style={sep}
            />
          )}
          {liberado('fiscal') && (
            <ListRow
              icon="receipt-outline"
              iconColor={colors.warning}
              title="Notas Fiscais"
              subtitle="Emitir e acompanhar NF-e de venda"
              chevron
              onPress={() => navigation.navigate('NotasFiscais')}
              style={sep}
            />
          )}
          {liberado('marketing') && (
            <ListRow
              icon="sparkles-outline"
              iconColor={colors.primary}
              title="Marketing IA"
              subtitle="Gere legendas para redes sociais"
              chevron
              onPress={() => navigation.navigate('Marketing')}
              style={sep}
            />
          )}
          {liberado('assistente_ia') && (
            <ListRow
              icon="chatbubble-ellipses-outline"
              iconColor={colors.info}
              title="Assistente do Vendedor"
              subtitle="Copiloto de IA para abordagem e objeções"
              chevron
              onPress={() => navigation.navigate('AssistenteIA')}
              style={sep}
            />
          )}
          {gestor && (
            <ListRow
              icon="globe-outline"
              iconColor={colors.success}
              title="Meu Site"
              subtitle="Construtor do site white-label da loja"
              chevron
              onPress={() => navigation.navigate('MeuSite')}
              style={sep}
            />
          )}
        </Card>

        {/* Conta */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Conta
          </Txt>
          <ListRow
            icon="settings-outline"
            title="Configurações"
            subtitle="Tema, preferências"
            chevron
            onPress={() => navigation.navigate('Configuracoes')}
          />
          <ListRow
            icon="storefront-outline"
            iconColor={colors.primary}
            title="Ver como comprador"
            subtitle="Abrir a vitrine pública (B2C)"
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
