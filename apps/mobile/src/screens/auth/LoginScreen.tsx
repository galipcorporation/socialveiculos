import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { darkColors, fonts, radius, spacing } from '../../theme/tokens'
import { Button, Txt } from '../../components/ui'
import { authService } from '../../services'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'

// Login e onboarding usam a tela escura fixa (independente do tema claro/escuro
// do usuário) — marca a fronteira antes do painel claro do resto do app.
const colors = darkColors

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const login = useAuthStore((s) => s.login)
  const setLoja = useLojaAtivaStore((s) => s.setLoja)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const entrar = async (emailFinal: string, senhaFinal: string) => {
    setErro(null)
    setCarregando(true)
    try {
      const res = await authService.login(emailFinal, senhaFinal)
      if (res.user.loja_id) setLoja(res.user.loja_id, res.user.nome)
      login(res.access_token, res.refresh_token, res.user)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <View style={styles.logoMark} />
            </View>
            <Txt style={{ fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34, color: colors.text, letterSpacing: -0.4 }}>
              Social{'\n'}Veículos
            </Txt>
            <Txt style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textDim, maxWidth: 250, marginTop: 4 }}>
              Gestão da loja, estoque e clientes em um só lugar.
            </Txt>
          </View>

          <View style={{ gap: spacing.sm }}>
            {erro ? (
              <View style={[styles.erro, { backgroundColor: colors.error + '16', borderColor: colors.error + '55' }]}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Txt style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.error }}>{erro}</Txt>
              </View>
            ) : null}

            <DarkField label="E-MAIL">
              <View style={{ flex: 1 }}>
                <TxtInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="voce@sualoja.com.br"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
              </View>
            </DarkField>

            <DarkField label="SENHA" active>
              <View style={{ flex: 1 }}>
                <TxtInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  secureTextEntry={!mostrarSenha}
                  onSubmitEditing={() => email && senha && entrar(email, senha)}
                />
              </View>
              <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
                <Ionicons
                  name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </DarkField>

            <Button
              title="Entrar"
              size="lg"
              icon="arrow-forward"
              loading={carregando}
              disabled={!email.trim() || !senha.trim()}
              onPress={() => entrar(email, senha)}
              style={{ marginTop: spacing.xs, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}
            />

            <Txt style={{ textAlign: 'center', fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: spacing.xs }}>
              Esqueci minha senha
            </Txt>
          </View>

          <View style={styles.footer}>
            <View>
              <Txt style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textDim }}>
                Só quero ver os carros
              </Txt>
              <Txt style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                Entrar na vitrine sem login
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function DarkField({ label, active, children }: { label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[
        styles.field,
        { borderColor: active ? colors.primary : colors.border, borderWidth: active ? 1.5 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: active ? colors.primaryText : colors.textMuted }}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>{children}</View>
      </View>
    </View>
  )
}

function TxtInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, padding: 0 }}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xxl },
  brand: { gap: 4 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.bg,
    transform: [{ rotate: '45deg' }],
  },
  field: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
