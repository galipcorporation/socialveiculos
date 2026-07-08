import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Button, Input, Screen, Txt } from '../../components/ui'
import { authService } from '../../services'
import { useAuthStore } from '../../stores/authStore'
import { useLojaAtivaStore } from '../../stores/lojaAtivaStore'
import { LOJA_NOME } from '../../services/seed'
import { LOJA_ID } from '../../services/seed'

export default function LoginScreen() {
  const { colors } = useTheme()
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
      setLoja(res.user.loja_id ?? LOJA_ID, LOJA_NOME)
      login(res.access_token, res.refresh_token, res.user)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setCarregando(false)
    }
  }

  const entrarDemo = () => {
    const demo = authService.credenciaisDemo()
    setEmail(demo.email)
    setSenha(demo.senha)
    entrar(demo.email, demo.senha)
  }

  return (
    <Screen keyboardAvoiding style={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={styles.brand}>
        <LinearGradient
          colors={['#2563eb', '#1d4ed8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        >
          <Ionicons name="car-sport" size={34} color="#fff" />
        </LinearGradient>
        <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 26, color: colors.text }}>
          Social Veículos
        </Txt>
        <Txt variant="caption" color="textDim">
          Gestão da sua loja na palma da mão
        </Txt>
      </View>

      <View style={{ gap: spacing.md }}>
        {erro ? (
          <View style={[styles.erro, { backgroundColor: colors.error + '16', borderColor: colors.error + '55' }]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Txt variant="caption" color="error" style={{ flex: 1 }}>{erro}</Txt>
          </View>
        ) : null}

        <Input
          label="E-mail"
          icon="mail-outline"
          placeholder="voce@sualoja.com.br"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Senha"
          icon="lock-closed-outline"
          placeholder="Sua senha"
          secureTextEntry={!mostrarSenha}
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={() => email && senha && entrar(email, senha)}
          right={
            <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
              <Ionicons
                name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          }
        />

        <Button
          title="Entrar"
          size="lg"
          loading={carregando}
          disabled={!email.trim() || !senha.trim()}
          onPress={() => entrar(email, senha)}
          style={{ marginTop: spacing.xs }}
        />
        <Button title="Explorar com conta demo" variant="ghost" onPress={entrarDemo} disabled={carregando} />
      </View>

      <Txt variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xxl }}>
        Ambiente de demonstração — dados fictícios
      </Txt>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
