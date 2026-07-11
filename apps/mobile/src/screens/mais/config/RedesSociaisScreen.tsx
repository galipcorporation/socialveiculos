import React, { useEffect, useState } from 'react'
import { Linking, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { radius, spacing } from '../../../theme/tokens'
import { AppHeader, Button, Card, Screen, Sheet, SkeletonCard, Txt, useToast } from '../../../components/ui'
import { configService } from '../../../services'
import { formatData } from '../../../lib/format'

type Rede = 'facebook' | 'instagram'

const META: Record<Rede, { nome: string; icon: keyof typeof Ionicons.glyphMap; cor: string }> = {
  facebook: { nome: 'Facebook', icon: 'logo-facebook', cor: '#1877F2' },
  instagram: { nome: 'Instagram Business', icon: 'logo-instagram', cor: '#E1306C' },
}

type PaginaMeta = { page_id: string; name: string; instagram_account_id?: string }

export default function RedesSociaisScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({ queryKey: ['config', 'redes'], queryFn: () => configService.redesSociais() })
  const redes = q.data ?? []

  const [conectando, setConectando] = useState<Rede | null>(null)
  const [confirmDesc, setConfirmDesc] = useState<Rede | null>(null)
  const [paginas, setPaginas] = useState<PaginaMeta[] | null>(null)
  const [nonceAtual, setNonceAtual] = useState<string | null>(null)
  const [confirmandoPagina, setConfirmandoPagina] = useState(false)

  // Retorno do OAuth Meta via deep link: socialveiculos://meta-callback[?escolher=<nonce>]
  useEffect(() => {
    const tratarUrl = async (url: string | null) => {
      if (!url || !url.includes('meta-callback')) return
      const nonce = new URL(url).searchParams.get('escolher')
      if (nonce) {
        try {
          const lista = await configService.metaPaginasPendentes(nonce)
          setPaginas(lista)
          setNonceAtual(nonce)
        } catch {
          toast.show('error', 'Sessão de conexão expirada. Tente novamente.')
        }
      } else {
        await queryClient.invalidateQueries({ queryKey: ['config', 'redes'] })
        toast.show('success', 'Conectado com sucesso.')
      }
    }
    Linking.getInitialURL().then(tratarUrl)
    const sub = Linking.addEventListener('url', ({ url }) => tratarUrl(url))
    return () => sub.remove()
  }, [])

  const conectar = async (rede: Rede) => {
    setConectando(rede)
    try {
      const { oauth_url } = await configService.conectarRede(rede)
      if (oauth_url) await Linking.openURL(oauth_url)
    } catch {
      toast.show('error', 'Não foi possível iniciar a conexão.')
    } finally {
      setConectando(null)
    }
  }

  const confirmarPagina = async (pageId: string) => {
    if (!nonceAtual) return
    setConfirmandoPagina(true)
    try {
      await configService.metaConfirmarPagina(nonceAtual, pageId)
      await queryClient.invalidateQueries({ queryKey: ['config', 'redes'] })
      toast.show('success', 'Página conectada com sucesso.')
    } catch {
      toast.show('error', 'Erro ao confirmar página.')
    } finally {
      setConfirmandoPagina(false)
      setPaginas(null)
      setNonceAtual(null)
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

        <Card style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
            <Txt variant="bodySemibold">Como conectar</Txt>
          </View>
          <Txt variant="caption" color="textDim">
            1. Certifique-se de que sua conta do Instagram é Business/Creator e está vinculada à Página do Facebook que você administra.{"\n"}
            2. Toque em "Conectar via Meta" no Facebook/Instagram.{"\n"}
            3. Faça login no Facebook e selecione a Página e Conta do Instagram que deseja utilizar.{"\n"}
            4. Se houver mais de uma página, selecione a desejada para concluir.
          </Txt>
          <Txt variant="caption" color="textMuted">
            Nota: A publicação direta requer que a loja/plataforma tenha o App da Meta configurado e as permissões aprovadas em App Review pela Meta.
          </Txt>
        </Card>
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

      <Sheet visible={paginas !== null} onClose={() => { setPaginas(null); setNonceAtual(null) }} title="Selecione a página" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Sua conta tem mais de uma página do Facebook. Escolha qual conectar (e a conta do Instagram vinculada a ela, se houver).
          </Txt>
          {(paginas ?? []).map((p) => (
            <Button
              key={p.page_id}
              title={p.instagram_account_id ? `${p.name} (+ Instagram)` : p.name}
              variant="outline"
              icon="business-outline"
              loading={confirmandoPagina}
              onPress={() => confirmarPagina(p.page_id)}
            />
          ))}
          <Button title="Cancelar" variant="ghost" onPress={() => { setPaginas(null); setNonceAtual(null) }} />
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
