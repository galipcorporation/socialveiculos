import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import { AppHeader, Avatar, Button, Card, Input, Screen, Txt, useToast } from '../../components/ui'
import { useAuthStore, type User } from '../../stores/authStore'
import { authService } from '../../services'
import { maskTelefoneInput } from '../../lib/format'

export default function EditarPerfilScreen() {
  const { colors } = useTheme()
  const toast = useToast()
  const nav = useNavigation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  // Mantém o cache de /auth/me alinhado para o Perfil não reverter a edição.
  const aplicar = (atualizado: User) => {
    setUser(atualizado)
    queryClient.setQueryData(['auth', 'me'], atualizado)
  }

  const [nome, setNome] = useState(user?.nome ?? '')
  const [telefone, setTelefone] = useState(maskTelefoneInput(user?.telefone ?? ''))
  const [erroNome, setErroNome] = useState<string | undefined>()

  const avatarMut = useMutation({
    mutationFn: (uri: string) => authService.enviarAvatar(uri),
    onSuccess: (atualizado) => {
      aplicar(atualizado)
      toast.show('success', 'Foto atualizada.')
    },
    onError: () => toast.show('error', 'Não foi possível enviar a foto.'),
  })

  const salvarMut = useMutation({
    mutationFn: () => authService.atualizarPerfil({ nome, telefone }),
    onSuccess: (atualizado) => {
      aplicar(atualizado)
      toast.show('success', 'Perfil atualizado.')
      nav.goBack()
    },
    onError: () => toast.show('error', 'Não foi possível salvar o perfil.'),
  })

  const escolherFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      toast.show('info', 'Libere o acesso às fotos para trocar seu avatar.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) avatarMut.mutate(res.assets[0].uri)
  }

  const salvar = () => {
    const limpo = nome.trim()
    if (limpo.length < 2) {
      setErroNome('Informe seu nome completo.')
      return
    }
    setErroNome(undefined)
    salvarMut.mutate()
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Editar perfil" back />
      <Screen padded style={{ gap: spacing.md }}>
        <Card style={{ alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={escolherFoto} disabled={avatarMut.isPending} style={{ opacity: avatarMut.isPending ? 0.6 : 1 }}>
            <Avatar nome={user?.nome} uri={user?.avatar_url} size={96} />
            <View
              style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: colors.bg,
              }}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <Txt variant="caption" color="textDim">
            {avatarMut.isPending ? 'Enviando foto…' : 'Toque na foto para trocar'}
          </Txt>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Input
            label="Nome"
            value={nome}
            onChangeText={(v) => { setNome(v); if (erroNome) setErroNome(undefined) }}
            placeholder="Seu nome"
            icon="person-outline"
            error={erroNome}
            autoCapitalize="words"
          />
          <Input
            label="Telefone"
            value={telefone}
            onChangeText={(v) => setTelefone(maskTelefoneInput(v))}
            placeholder="(00) 00000-0000"
            icon="call-outline"
            keyboardType="phone-pad"
            hint="As lojas usam este número para responder você."
          />
          <Input
            label="E-mail"
            value={user?.email ?? ''}
            icon="mail-outline"
            editable={false}
            hint="O e-mail da conta não pode ser alterado."
            style={{ color: colors.textDim }}
          />
        </Card>

        <Button
          title="Salvar alterações"
          icon="checkmark"
          loading={salvarMut.isPending}
          onPress={salvar}
          full
        />
      </Screen>
    </Screen>
  )
}
