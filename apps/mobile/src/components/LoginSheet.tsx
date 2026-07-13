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
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)

  const finalizar = (res: { access_token: string; refresh_token: string; user: Parameters<typeof login>[2] }) => {
    login(res.access_token, res.refresh_token, res.user)
    setNome('')
    setEmail('')
    concluir() // fecha e executa a ação pendente
  }

  const cadastrar = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) return
    setEntrando(true)
    try {
      finalizar(await vitrineService.cadastrar(nome, email, senha))
    } finally {
      setEntrando(false)
    }
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
        <Input label="Senha" value={senha} onChangeText={setSenha} placeholder="Crie uma senha" secureTextEntry />

        <Button title="Criar conta e continuar" icon="person-add-outline" loading={entrando} onPress={cadastrar} full disabled={!nome.trim() || !email.trim() || !senha.trim()} />
      </View>
    </Sheet>
  )
}
