import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme, type ThemeMode } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Card, ListRow, Screen, Txt } from '../../components/ui'
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
})
