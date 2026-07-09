import React, { useState } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { spacing } from '../theme/tokens'
import { Button, Input, Sheet, Txt } from './ui'
import { useAuthStore } from '../stores/authStore'
import { useLoginGateStore } from '../stores/loginGateStore'
import { vitrineService } from '../services'

/** Cadastro/login leve do comprador — montado uma vez na árvore da Vitrine. */
export function LoginSheet() {
  const { colors } = useTheme()
  const visivel = useLoginGateStore((s) => s.visivel)
  const motivo = useLoginGateStore((s) => s.motivo)
  const fechar = useLoginGateStore((s) => s.fechar)
  const concluir = useLoginGateStore((s) => s.concluir)
  const login = useAuthStore((s) => s.login)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [entrando, setEntrando] = useState(false)

  const finalizar = (user: ReturnType<typeof vitrineService.loginDemo>) => {
    login(`mock-access-${Date.now()}`, `mock-refresh-${Date.now()}`, user)
    setNome('')
    setEmail('')
    concluir() // fecha e executa a ação pendente
  }

  const cadastrar = () => {
    if (!nome.trim() || !email.trim()) return
    setEntrando(true)
    setTimeout(() => {
      finalizar(vitrineService.cadastrar(nome, email))
      setEntrando(false)
    }, 400)
  }

  const demo = () => {
    setEntrando(true)
    setTimeout(() => {
      finalizar(vitrineService.loginDemo())
      setEntrando(false)
    }, 300)
  }

  return (
    <Sheet visible={visivel} onClose={fechar} title="Entre para continuar">
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary + '14', borderRadius: 10, padding: spacing.sm }}>
          <Ionicons name="lock-open-outline" size={18} color={colors.primaryText} />
          <Txt variant="caption" color="primaryText" style={{ flex: 1 }}>{motivo}</Txt>
        </View>

        <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Como quer ser chamado" />
        <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" keyboardType="email-address" />

        <Button title="Criar conta e continuar" icon="person-add-outline" loading={entrando} onPress={cadastrar} full disabled={!nome.trim() || !email.trim()} />
        <Button title="Entrar com conta demo" variant="ghost" onPress={demo} disabled={entrando} />

        <Txt variant="caption" color="textMuted" align="center">
          Conta leve — só para salvar favoritos e conversar com as lojas.
        </Txt>
      </View>
    </Sheet>
  )
}
