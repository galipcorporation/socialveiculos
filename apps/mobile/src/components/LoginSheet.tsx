import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { radius, spacing } from '../theme/tokens'
import { Button, Input, Sheet, Txt } from './ui'
import { useAuthStore } from '../stores/authStore'
import { useLoginGateStore } from '../stores/loginGateStore'
import { useExperienciaStore } from '../stores/experienciaStore'
import { authService } from '../services/auth'
import { vitrineService } from '../services'
import { extractErrorDetails } from '../lib/api'

type Modo = 'entrar' | 'criar'

/** Login/cadastro do comprador — montado uma vez na árvore da Vitrine. */
export function LoginSheet() {
  const { colors } = useTheme()
  const visivel = useLoginGateStore((s) => s.visivel)
  const motivo = useLoginGateStore((s) => s.motivo)
  const fechar = useLoginGateStore((s) => s.fechar)
  const concluir = useLoginGateStore((s) => s.concluir)
  const login = useAuthStore((s) => s.login)
  const escolherExperiencia = useExperienciaStore((s) => s.escolher)

  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState('')
  const [perguntaLojista, setPerguntaLojista] = useState(false)

  const trocarModo = (novo: Modo) => {
    setModo(novo)
    setErro('')
  }

  const finalizar = (res: { access_token: string; refresh_token: string; user: Parameters<typeof login>[2] }) => {
    login(res.access_token, res.refresh_token, res.user)
    setNome('')
    setEmail('')
    setSenha('')
    // Só oferece o painel para quem tem vínculo ativo com uma loja.
    if (!!res.user.loja_id && (res.user.papel === 'gestor' || res.user.papel === 'vendedor')) {
      setPerguntaLojista(true) // pergunta painel x vitrine antes de concluir o gate
    } else {
      concluir() // fecha e executa a ação pendente
    }
  }

  const confirmar = async () => {
    if (!email.trim() || !senha.trim()) return
    if (modo === 'criar' && !nome.trim()) return
    setEntrando(true)
    setErro('')
    try {
      const res = modo === 'entrar'
        ? await authService.login(email, senha)
        : await vitrineService.cadastrar(nome, email, senha)
      finalizar(res)
    } catch (e) {
      setErro(extractErrorDetails(e).message)
    } finally {
      setEntrando(false)
    }
  }

  const desabilitado = !email.trim() || !senha.trim() || (modo === 'criar' && !nome.trim())

  const irParaPainel = () => {
    setPerguntaLojista(false)
    escolherExperiencia('lojista')
    concluir()
  }

  const continuarNaVitrine = () => {
    setPerguntaLojista(false)
    concluir()
  }

  return (
    <>
      <Sheet visible={visivel && !perguntaLojista} onClose={fechar} title="Entre para continuar">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary + '14', borderRadius: 10, padding: spacing.sm }}>
            <Ionicons name="lock-open-outline" size={18} color={colors.primaryText} />
            <Txt variant="caption" color="primaryText" style={{ flex: 1 }}>{motivo}</Txt>
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: colors.overlay, borderRadius: radius.md, padding: 4, gap: 4 }}>
            <Pressable
              onPress={() => trocarModo('entrar')}
              style={{
                flex: 1, paddingVertical: spacing.xs, borderRadius: radius.sm, alignItems: 'center',
                backgroundColor: modo === 'entrar' ? colors.bg : 'transparent',
              }}
            >
              <Txt variant="label" color={modo === 'entrar' ? 'text' : 'textMuted'}>Entrar</Txt>
            </Pressable>
            <Pressable
              onPress={() => trocarModo('criar')}
              style={{
                flex: 1, paddingVertical: spacing.xs, borderRadius: radius.sm, alignItems: 'center',
                backgroundColor: modo === 'criar' ? colors.bg : 'transparent',
              }}
            >
              <Txt variant="label" color={modo === 'criar' ? 'text' : 'textMuted'}>Criar conta</Txt>
            </Pressable>
          </View>

          {modo === 'criar' && (
            <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Como quer ser chamado" />
          )}
          <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" keyboardType="email-address" />
          <Input
            label="Senha"
            value={senha}
            onChangeText={setSenha}
            placeholder={modo === 'entrar' ? 'Sua senha' : 'Crie uma senha'}
            secureTextEntry
          />

          {!!erro && <Txt variant="caption" color="error">{erro}</Txt>}

          <Button
            title={modo === 'entrar' ? 'Entrar' : 'Criar conta e continuar'}
            icon={modo === 'entrar' ? 'log-in-outline' : 'person-add-outline'}
            loading={entrando}
            onPress={confirmar}
            full
            disabled={desabilitado}
          />
        </View>
      </Sheet>

      <Sheet visible={perguntaLojista} onClose={continuarNaVitrine} title="Bem-vindo de volta">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Sua conta também gerencia uma loja. Para onde você quer ir agora?
          </Txt>
          <Button title="Ir para o painel da loja" icon="business" onPress={irParaPainel} full />
          <Button title="Continuar na vitrine" variant="ghost" onPress={continuarNaVitrine} full />
        </View>
      </Sheet>
    </>
  )
}
