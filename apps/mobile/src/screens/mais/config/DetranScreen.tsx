import React, { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { spacing } from '../../../theme/tokens'
import { AppHeader, Button, Card, Input, Screen, Sheet, SkeletonCard, Txt, useToast } from '../../../components/ui'
import { configService } from '../../../services'

export default function DetranScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({ queryKey: ['config', 'detran'], queryFn: () => configService.detran() })
  const detran = q.data

  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [mostrarKey, setMostrarKey] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmRemover, setConfirmRemover] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    if (detran?.api_url) setUrl(detran.api_url)
  }, [detran?.api_url])

  const salvar = async () => {
    if (!url.trim() || !key.trim()) {
      toast.show('error', 'URL e chave do fornecedor são obrigatórias.')
      return
    }
    setSalvando(true)
    try {
      await configService.salvarDetran({ api_url: url.trim(), api_key: key.trim() })
      await queryClient.invalidateQueries({ queryKey: ['config', 'detran'] })
      toast.show('success', 'Fornecedor DETRAN salvo.')
      setKey('')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    setConfirmRemover(false)
    setRemovendo(true)
    try {
      await configService.removerDetran()
      await queryClient.invalidateQueries({ queryKey: ['config', 'detran'] })
      setUrl('')
      setKey('')
      toast.show('success', 'Fornecedor removido.')
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Consulta DETRAN" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Conecte o fornecedor de consulta veicular para exibir débitos (IPVA, licenciamento, multas) e a situação da transferência/ATPV-e na esteira de pós-venda. Sem fornecedor, essas consultas ficam indisponíveis.
        </Txt>

        {q.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : (
          <>
            {detran?.configurada && (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">Fornecedor configurado</Txt>
                  <Txt variant="caption" color="textDim" numberOfLines={1}>{detran.api_url}</Txt>
                </View>
                <Button title="Remover" variant="outline" size="sm" loading={removendo} onPress={() => setConfirmRemover(true)} />
              </Card>
            )}

            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>
                {detran?.configurada ? 'Atualizar fornecedor' : 'Conectar fornecedor'}
              </Txt>
              <Input label="URL base do fornecedor" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://api.seufornecedor.com/detran" />
              <Input
                label="Chave de API"
                value={key}
                onChangeText={setKey}
                secureTextEntry={!mostrarKey}
                autoCapitalize="none"
                placeholder={detran?.configurada ? '•••••• (deixe para manter a atual)' : 'Sua chave do fornecedor'}
                right={
                  <Pressable onPress={() => setMostrarKey((v) => !v)} hitSlop={8}>
                    <Ionicons name={mostrarKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </Pressable>
                }
              />
              <Button title="Salvar fornecedor" icon="checkmark" loading={salvando} onPress={salvar} full disabled={!url.trim() || !key.trim()} />
            </Card>
          </>
        )}
      </Screen>

      <Sheet visible={confirmRemover} onClose={() => setConfirmRemover(false)} title="Remover fornecedor DETRAN" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">As consultas de débitos e situação voltarão a ficar indisponíveis. Continuar?</Txt>
          <Button title="Remover" variant="danger" onPress={remover} />
          <Button title="Cancelar" variant="ghost" onPress={() => setConfirmRemover(false)} />
        </View>
      </Sheet>
    </Screen>
  )
}
