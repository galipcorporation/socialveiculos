import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, type ThemeMode } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Avatar, Badge, Button, Card, ListRow, Screen, Sheet, Txt } from '../../components/ui'
import { useAuthStore } from '../../stores/authStore'
import { useExperienciaStore } from '../../stores/experienciaStore'
import { useLoginGateStore } from '../../stores/loginGateStore'

const MODOS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
]

export default function PerfilScreen() {
  const { colors, mode, setMode } = useTheme()
  const user = useAuthStore((s) => s.user)
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const abrirLogin = useLoginGateStore((s) => s.abrir)
  const trocarExperiencia = useExperienciaStore((s) => s.trocar)
  const [sairAberto, setSairAberto] = useState(false)
  const [trocarAberto, setTrocarAberto] = useState(false)

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Perfil" />
      <Screen padded style={{ gap: spacing.md }}>
        {/* Conta */}
        {isAuth ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar nome={user?.nome} size={56} />
              <View style={{ flex: 1 }}>
                <Txt variant="title" numberOfLines={1}>{user?.nome}</Txt>
                <Txt variant="caption" color="textDim" numberOfLines={1}>{user?.email}</Txt>
                <Badge label="Comprador" tone="primary" size="sm" style={{ marginTop: 6 }} />
              </View>
            </View>
          </Card>
        ) : (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1c' }]}>
                <Ionicons name="person-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySemibold">Entre na sua conta</Txt>
                <Txt variant="caption" color="textDim">Salve favoritos e converse com as lojas.</Txt>
              </View>
            </View>
            <Button title="Entrar / criar conta" icon="log-in-outline" onPress={() => abrirLogin('Entre para acessar sua conta.')} full />
          </Card>
        )}

        {/* Aparência */}
        <Card>
          <Txt variant="title" style={{ marginBottom: 4 }}>Aparência</Txt>
          <View style={styles.modos}>
            {MODOS.map((m) => {
              const ativo = mode === m.value
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  style={[styles.modo, { backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft, borderColor: ativo ? colors.primary : colors.border }]}
                >
                  <Ionicons name={m.icon} size={22} color={ativo ? colors.primary : colors.textDim} />
                  <Txt style={{ fontFamily: ativo ? fonts.semibold : fonts.medium, fontSize: 13, color: ativo ? colors.primaryText : colors.textDim }}>{m.label}</Txt>
                </Pressable>
              )
            })}
          </View>
        </Card>

        {/* Ações */}
        <Card padded={false}>
          <ListRow icon="business-outline" iconColor={colors.info} title="Sou lojista" subtitle="Acessar o painel de gestão da loja" chevron onPress={() => setTrocarAberto(true)} />
          {isAuth && (
            <ListRow icon="log-out-outline" iconColor={colors.error} title="Sair da conta" onPress={() => setSairAberto(true)} style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          )}
        </Card>

        <Txt variant="caption" color="textMuted" align="center">Social Veículos · Vitrine</Txt>
      </Screen>

      <Sheet visible={sairAberto} onClose={() => setSairAberto(false)} title="Sair da conta" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">Você continuará navegando no feed, mas perderá acesso aos favoritos e às conversas até entrar de novo.</Txt>
          <Button title="Sair" variant="danger" icon="log-out-outline" onPress={() => { logout(); setSairAberto(false) }} />
          <Button title="Cancelar" variant="ghost" onPress={() => setSairAberto(false)} />
        </View>
      </Sheet>

      <Sheet visible={trocarAberto} onClose={() => setTrocarAberto(false)} title="Trocar de experiência" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">Ir para o painel do lojista (Gestor). Você pode voltar para a vitrine quando quiser.</Txt>
          <Button title="Ir para o painel do lojista" icon="business" onPress={() => { setTrocarAberto(false); trocarExperiencia() }} />
          <Button title="Cancelar" variant="ghost" onPress={() => setTrocarAberto(false)} />
        </View>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  modos: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  modo: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
})
