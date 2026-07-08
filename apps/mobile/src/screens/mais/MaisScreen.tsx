import React, { useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, ListRow, Screen, Sheet, Txt,
} from '../../components/ui'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'

export default function MaisScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const lojaNome = useLojaAtivaStore((s) => s.lojaNome)
  const [sairAberto, setSairAberto] = useState(false)

  const gestor = user?.papel !== 'vendedor'

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Mais" />
      <Screen padded style={{ gap: spacing.md }}>
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
          {gestor && (
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
        </Card>

        {/* Ferramentas */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Ferramentas
          </Txt>
          <ListRow
            icon="calculator-outline"
            iconColor={colors.primary}
            title="Simulador de financiamento"
            subtitle="Calcule parcelas para o cliente na hora"
            chevron
            onPress={() => navigation.navigate('Simulador')}
          />
        </Card>

        {/* Conta */}
        <Card padded={false}>
          <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
            Conta
          </Txt>
          <ListRow
            icon="settings-outline"
            title="Configurações"
            subtitle="Tema, dados de demonstração"
            chevron
            onPress={() => navigation.navigate('Configuracoes')}
          />
          <ListRow
            icon="log-out-outline"
            iconColor={colors.error}
            title="Sair da conta"
            onPress={() => setSairAberto(true)}
          />
        </Card>

        <Txt variant="caption" color="textMuted" align="center">
          Social Veículos · v0.1 · ambiente de demonstração
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
