import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { spacing } from '../../../theme/tokens'
import {
  AppHeader, Button, Card, Input, Screen, SelectField, Sheet, SkeletonCard, Txt, useToast,
} from '../../../components/ui'
import { OptionSheet } from '../../../components/ui'
import { configService, PROVEDORES_IA, type ProvedorIA } from '../../../services'

export default function CredenciaisIAScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({ queryKey: ['config', 'credenciais-ia'], queryFn: () => configService.credenciaisIA() })
  const creds = q.data ?? []

  const [provedor, setProvedor] = useState<ProvedorIA>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState('')
  const [mostrarKey, setMostrarKey] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [provSheet, setProvSheet] = useState(false)
  const [removendo, setRemovendo] = useState<ProvedorIA | null>(null)
  const [confirmRemover, setConfirmRemover] = useState<ProvedorIA | null>(null)

  const provInfo = PROVEDORES_IA.find((p) => p.value === provedor)!

  const salvar = async () => {
    if (!apiKey.trim()) {
      toast.show('error', 'API Key é obrigatória.')
      return
    }
    setSalvando(true)
    try {
      await configService.salvarCredencialIA({ provedor, api_key: apiKey.trim(), modelo_padrao: modelo.trim() || undefined })
      await queryClient.invalidateQueries({ queryKey: ['config', 'credenciais-ia'] })
      toast.show('success', 'Chave de IA salva.')
      setApiKey('')
      setModelo('')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (prov: ProvedorIA) => {
    setConfirmRemover(null)
    setRemovendo(prov)
    try {
      await configService.removerCredencialIA(prov)
      await queryClient.invalidateQueries({ queryKey: ['config', 'credenciais-ia'] })
      toast.show('success', 'Chave removida.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Inteligência Artificial" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Configure sua própria chave (BYOK). O custo das chamadas é cobrado na sua conta do provedor. Sem chave, o Marketing usa a chave da plataforma.
        </Txt>

        {q.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : creds.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Configuradas</Txt>
            {creds.map((c) => (
              <View key={c.provedor} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium" style={{ textTransform: 'capitalize' }}>{c.provedor}</Txt>
                  <Txt variant="caption" color="textDim">
                    {c.modelo_padrao ? `${c.modelo_padrao} · ` : ''}✓ Configurada
                  </Txt>
                </View>
                <Button
                  title="Remover"
                  variant="outline"
                  size="sm"
                  loading={removendo === c.provedor}
                  onPress={() => setConfirmRemover(c.provedor)}
                />
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Adicionar / atualizar chave</Txt>
          <SelectField label="Provedor" value={provInfo.label} onPress={() => setProvSheet(true)} icon="sparkles-outline" />
          <Input
            label="API Key"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!mostrarKey}
            autoCapitalize="none"
            placeholder={provInfo.placeholder}
            right={
              <Pressable onPress={() => setMostrarKey((v) => !v)} hitSlop={8}>
                <Ionicons name={mostrarKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </Pressable>
            }
          />
          <Input label="Modelo padrão (opcional)" value={modelo} onChangeText={setModelo} autoCapitalize="none" placeholder="claude-haiku-4-5-20251001" />
          <Button title="Salvar chave" icon="checkmark" loading={salvando} onPress={salvar} full disabled={!apiKey.trim()} />
        </Card>
      </Screen>

      <OptionSheet
        visible={provSheet}
        onClose={() => setProvSheet(false)}
        title="Provedor de IA"
        options={PROVEDORES_IA.map((p) => ({ value: p.value, label: p.label }))}
        selected={provedor}
        onSelect={(v) => setProvedor(v as ProvedorIA)}
      />

      <Sheet visible={confirmRemover !== null} onClose={() => setConfirmRemover(null)} title="Remover credencial" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">Deseja remover a chave {confirmRemover}? O Marketing volta a usar a chave da plataforma.</Txt>
          <Button title="Remover" variant="danger" onPress={() => confirmRemover && remover(confirmRemover)} />
          <Button title="Cancelar" variant="ghost" onPress={() => setConfirmRemover(null)} />
        </View>
      </Sheet>
    </Screen>
  )
}
