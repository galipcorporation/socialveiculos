import React, { useState } from 'react'
import { Pressable, Share, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import { useTheme, type ThemeMode } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Avatar, Badge, Button, Card, ListRow, Screen, Sheet, Txt, useToast } from '../../components/ui'
import { useAuthStore } from '../../stores/authStore'
import { useExperienciaStore } from '../../stores/experienciaStore'
import { useLoginGateStore } from '../../stores/loginGateStore'
import { lgpdService } from '../../services'
import { unregisterPush } from '../../lib/push'

const MODOS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
]

export default function PerfilScreen() {
  const { colors, mode, setMode } = useTheme()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const logoutStore = useAuthStore((s) => s.logout)
  const logout = async () => { await unregisterPush(); logoutStore() }
  const abrirLogin = useLoginGateStore((s) => s.abrir)
  const escolherExperiencia = useExperienciaStore((s) => s.escolher)
  // "Sou lojista" só para quem está logado E tem vínculo com uma loja.
  const ehLojista = isAuth && !!user?.loja_id && (user.papel === 'gestor' || user.papel === 'vendedor')
  const [sairAberto, setSairAberto] = useState(false)
  const [trocarAberto, setTrocarAberto] = useState(false)
  const [excluirAberto, setExcluirAberto] = useState(false)

  const exportarMut = useMutation({
    mutationFn: () => lgpdService.exportar(),
    onSuccess: async (dados) => {
      try {
        await Share.share({
          title: 'Meus dados — Social Veículos',
          message: JSON.stringify(dados, null, 2),
        })
      } catch {
        toast.show('info', 'Não foi possível abrir o compartilhamento.')
      }
    },
    onError: () => toast.show('error', 'Não foi possível exportar seus dados.'),
  })

  const excluirMut = useMutation({
    mutationFn: () => lgpdService.excluirConta(),
    onSuccess: async () => {
      setExcluirAberto(false)
      await unregisterPush()
      toast.show('success', 'Conta excluída. Seus dados foram anonimizados.')
      logoutStore()
    },
    onError: () => toast.show('error', 'Não foi possível excluir a conta.'),
  })

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

        {/* Privacidade e dados (LGPD) */}
        {isAuth && (
          <Card padded={false}>
            <ListRow
              icon="download-outline"
              iconColor={colors.info}
              title="Exportar meus dados"
              subtitle="Baixe tudo o que guardamos sobre você"
              chevron
              onPress={() => exportarMut.mutate()}
            />
            <ListRow
              icon="trash-outline"
              iconColor={colors.error}
              title="Excluir minha conta"
              subtitle="Apaga e anonimiza seus dados. Irreversível."
              chevron
              onPress={() => setExcluirAberto(true)}
              style={{ borderTopWidth: 1, borderTopColor: colors.border }}
            />
          </Card>
        )}

        {/* Ações */}
        <Card padded={false}>
          {ehLojista && (
            <ListRow icon="business-outline" iconColor={colors.info} title="Sou lojista" subtitle="Acessar o painel de gestão da loja" chevron onPress={() => setTrocarAberto(true)} />
          )}
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

      <Sheet visible={excluirAberto} onClose={() => setExcluirAberto(false)} title="Excluir minha conta" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Isto apaga seus favoritos, conversas e sessões, e anonimiza seu cadastro de forma permanente. Não dá para desfazer.
          </Txt>
          <Button
            title="Excluir conta definitivamente"
            variant="danger"
            icon="trash-outline"
            loading={excluirMut.isPending}
            onPress={() => excluirMut.mutate()}
          />
          <Button title="Cancelar" variant="ghost" onPress={() => setExcluirAberto(false)} />
        </View>
      </Sheet>

      <Sheet visible={trocarAberto} onClose={() => setTrocarAberto(false)} title="Trocar de experiência" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">Ir para o painel do lojista (Gestor). Você pode voltar para a vitrine quando quiser.</Txt>
          <Button title="Ir para o painel do lojista" icon="business" onPress={() => { setTrocarAberto(false); escolherExperiencia('lojista') }} />
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
