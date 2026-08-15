import React from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme, type ThemeMode } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Card, ListRow, Screen, Txt, useToast } from '../../components/ui'
import { authService } from '../../services/auth'
import { useAuthStore } from '../../stores/authStore'
import { useModulosLiberados } from '../../hooks/useModulosLiberados'
import type { ModuloKey } from '../../lib/modulos'
import type { RootStackParamList } from '../../navigation/types'

const MODOS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
]

type ItemConfigLoja = {
  screen: keyof RootStackParamList
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  /** Módulo dono desta configuração. Sem ele, a tela configura o núcleo da loja. */
  modulo?: ModuloKey
  /** Configuração da loja inteira — vendedor não mexe. */
  soGestor?: boolean
}

const CONFIG_LOJA: ItemConfigLoja[] = [
  { screen: 'PerfilLoja', icon: 'storefront-outline', title: 'Perfil da Loja', subtitle: 'Dados cadastrais e comissão padrão', soGestor: true },
  { screen: 'CredenciaisBanco', icon: 'card-outline', title: 'Credenciais Bancárias', subtitle: 'Bancos e financeiras do Simulador', modulo: 'simulador' },
  { screen: 'CredenciaisIA', icon: 'sparkles-outline', title: 'Inteligência Artificial', subtitle: 'Sua chave de IA (BYOK)', modulo: 'assistente_ia' },
  { screen: 'RedesSociais', icon: 'share-social-outline', title: 'Redes Sociais', subtitle: 'Instagram e Facebook para marketing', modulo: 'marketing', soGestor: true },
  { screen: 'Detran', icon: 'document-text-outline', title: 'Consulta DETRAN', subtitle: 'Fornecedor de consultas veiculares', modulo: 'estoque', soGestor: true },
  { screen: 'Fiscal', icon: 'receipt-outline', title: 'Fiscal / NF-e', subtitle: 'Dados fiscais e certificado A1', modulo: 'fiscal', soGestor: true },
]

export default function ConfiguracoesScreen() {
  const { colors, mode, setMode } = useTheme()
  const navigation = useNavigation()
  const { liberado, gestor } = useModulosLiberados()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()
  const toast = useToast()

  // Botão flutuante: preferência por usuário, gravada no servidor. Quem
  // respondeu "não" no primeiro acesso volta por aqui — é a única saída depois
  // de marcar "não perguntar novamente".
  const botaoFlutuante = user?.botao_flutuante !== false
  const salvarBotao = useMutation({
    mutationFn: authService.atualizarPreferencias,
    onSuccess: (atualizado) => {
      setUser(atualizado)
      queryClient.setQueryData(['auth', 'me'], atualizado)
    },
    onError: (_erro, variaveis) => {
      // Desfaz o otimismo. O valor anterior vem das variáveis da própria
      // mutação — o `user` do store já foi atualizado e não serve de referência.
      const atual = useAuthStore.getState().user
      if (atual && variaveis.botao_flutuante !== undefined) {
        setUser({ ...atual, botao_flutuante: !variaveis.botao_flutuante })
      }
      toast.show('error', 'Não deu para salvar. Verifique a conexão e tente de novo.')
    },
  })

  const alternarBotaoFlutuante = (valor: boolean) => {
    if (user) setUser({ ...user, botao_flutuante: valor })
    salvarBotao.mutate({ botao_flutuante: valor })
  }

  // Só entra o que o usuário realmente acessa: se o módulo não está no plano da
  // loja ou o gestor não liberou para este vendedor, a configuração dele não
  // aparece aqui — do mesmo jeito que não aparece no fluxo.
  const itens = CONFIG_LOJA.filter(
    (i) => (gestor || !i.soGestor) && (!i.modulo || liberado(i.modulo)),
  )

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Configurações" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {/* Configurações da loja (M048) — só os módulos que o usuário acessa */}
        {itens.length > 0 && (
          <Card padded={false}>
            <Txt variant="label" color="textMuted" style={{ padding: spacing.md, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
              {gestor ? 'Loja' : 'Minhas credenciais'}
            </Txt>
            {itens.map((item, i) => (
              <ListRow
                key={item.screen}
                icon={item.icon}
                iconColor={colors.primary}
                title={item.title}
                subtitle={item.subtitle}
                chevron
                onPress={() => navigation.navigate(item.screen as never)}
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
              />
            ))}
          </Card>
        )}

        {/* Tema */}
        <Card>
          <Txt variant="title" style={{ marginBottom: 4 }}>Aparência</Txt>
          <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.sm }}>
            Escolha o tema do aplicativo.
          </Txt>
          <View style={styles.modos}>
            {MODOS.map((m) => {
              const ativo = mode === m.value
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  style={[
                    styles.modo,
                    {
                      backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft,
                      borderColor: ativo ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={22}
                    color={ativo ? colors.primary : colors.textDim}
                  />
                  <Txt
                    style={{
                      fontFamily: ativo ? fonts.semibold : fonts.medium,
                      fontSize: 13,
                      color: ativo ? colors.primaryText : colors.textDim,
                    }}
                  >
                    {m.label}
                  </Txt>
                </Pressable>
              )
            })}
          </View>

          {/* Botão flutuante de ações rápidas — mesma preferência perguntada no
              primeiro acesso. */}
          <View style={[styles.linhaSwitch, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyMedium">Botão de ações rápidas</Txt>
              <Txt variant="caption" color="textDim" style={{ marginTop: 2, lineHeight: 18 }}>
                Atalho flutuante que fica sobre as telas e abre as ferramentas da plataforma.
              </Txt>
            </View>
            <Switch
              value={botaoFlutuante}
              onValueChange={alternarBotaoFlutuante}
              trackColor={{ false: colors.overlayStrong, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {/* Sobre */}
        <Card>
          <Txt variant="title" style={{ marginBottom: spacing.xs }}>Sobre</Txt>
          <Linha label="Versão" valor="0.1.0" />
          <Linha label="Plataforma" valor="Social Veículos — Gestor" />
          <Linha label="Suporte" valor="suporte@socialveiculos.com.br" />
        </Card>
      </Screen>

    </Screen>
  )
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.linha}>
      <Txt variant="caption" color="textDim">{label}</Txt>
      <Txt variant="captionMedium">{valor}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  modos: { flexDirection: 'row', gap: spacing.xs },
  modo: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
})
