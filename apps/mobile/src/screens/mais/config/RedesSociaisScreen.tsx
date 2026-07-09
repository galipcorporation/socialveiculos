import React, { useState } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { radius, spacing } from '../../../theme/tokens'
import { AppHeader, Button, Card, Screen, Sheet, SkeletonCard, Txt, useToast } from '../../../components/ui'
import { configService } from '../../../services'
import type { RedeSocialStatus } from '../../../services/types'
import { formatData } from '../../../lib/format'

type Rede = 'facebook' | 'instagram'

const META: Record<Rede, { nome: string; icon: keyof typeof Ionicons.glyphMap; cor: string }> = {
  facebook: { nome: 'Facebook', icon: 'logo-facebook', cor: '#1877F2' },
  instagram: { nome: 'Instagram Business', icon: 'logo-instagram', cor: '#E1306C' },
}

export default function RedesSociaisScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({ queryKey: ['config', 'redes'], queryFn: () => configService.redesSociais() })
  const redes = q.data ?? []

  const [conectando, setConectando] = useState<Rede | null>(null)
  const [confirmDesc, setConfirmDesc] = useState<Rede | null>(null)

  const conectar = async (rede: Rede) => {
    setConectando(rede)
    try {
      await configService.conectarRede(rede)
      await queryClient.invalidateQueries({ queryKey: ['config', 'redes'] })
      toast.show('success', `${META[rede].nome} conectado.`)
    } finally {
      setConectando(null)
    }
  }

  const desconectar = async (rede: Rede) => {
    setConfirmDesc(null)
    await configService.desconectarRede(rede)
    await queryClient.invalidateQueries({ queryKey: ['config', 'redes'] })
    toast.show('success', `${META[rede].nome} desconectado.`)
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Redes Sociais" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Conecte a página do Facebook e a conta do Instagram Business para automatizar a publicação de posts de marketing.
        </Txt>

        {q.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : (
          (['facebook', 'instagram'] as Rede[]).map((rede) => {
            const m = META[rede]
            const status = redes.find((r) => r.rede === rede)
            return (
              <Card key={rede} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={[styles_iconWrap, { backgroundColor: (status ? m.cor : colors.textMuted) + '22' }]}>
                    <Ionicons name={m.icon} size={22} color={status ? m.cor : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodySemibold">{m.nome}</Txt>
                    <Txt variant="caption" color={status ? 'success' : 'textMuted'}>
                      {status ? '✓ Conectado' : 'Não conectado'}
                    </Txt>
                  </View>
                </View>

                {status && (
                  <View style={{ gap: 2 }}>
                    <Txt variant="caption" color="textDim">
                      {rede === 'facebook' ? `ID da Página: ${status.page_id ?? 'N/A'}` : `ID da Conta: ${status.instagram_account_id ?? 'N/A'}`}
                    </Txt>
                    {status.token_expira_em && (
                      <Txt variant="caption" color="textDim">Expira em: {formatData(status.token_expira_em)}</Txt>
                    )}
                  </View>
                )}

                {status ? (
                  <Button title="Desconectar" variant="outline" icon="unlink-outline" size="sm" onPress={() => setConfirmDesc(rede)} />
                ) : (
                  <Button title="Conectar via Meta" icon="link-outline" size="sm" loading={conectando === rede} onPress={() => conectar(rede)} />
                )}
              </Card>
            )
          })
        )}
      </Screen>

      <Sheet visible={confirmDesc !== null} onClose={() => setConfirmDesc(null)} title="Desconectar rede" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Tem certeza que deseja desconectar o {confirmDesc && META[confirmDesc].nome}? As publicações automáticas serão interrompidas.
          </Txt>
          <Button title="Desconectar" variant="danger" onPress={() => confirmDesc && desconectar(confirmDesc)} />
          <Button title="Cancelar" variant="ghost" onPress={() => setConfirmDesc(null)} />
        </View>
      </Sheet>
    </Screen>
  )
}

const styles_iconWrap = {
  width: 44,
  height: 44,
  borderRadius: radius.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}
