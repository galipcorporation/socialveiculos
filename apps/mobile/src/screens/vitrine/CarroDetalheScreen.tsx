import React, { useRef } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { darkColors, fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, EmptyState, Screen, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { MediaCarousel } from '../../components/MediaCarousel'
import { vitrineService } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useToggleFavorito } from '../../hooks/useToggleFavorito'
import { extractErrorDetails } from '../../lib/api'
import { formatBRL, formatKm } from '../../lib/format'
import { abrirWhatsapp, abrirWhatsappComLead } from '../../lib/whatsapp'
import { compartilharVeiculo } from '../../lib/share'
import type { VitrineScreenProps } from '../../navigation/types'

export default function CarroDetalheScreen({ route }: VitrineScreenProps<'CarroDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const comLogin = useGateLogin()
  const favoritar = useToggleFavorito()
  const favScale = useRef(new Animated.Value(1)).current

  const q = useQuery({ queryKey: ['vitrine', 'detalhe', id], queryFn: () => vitrineService.detalhe(id) })
  const a = q.data

  const favoritarComAnimacao = () => {
    if (!a) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(favScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start()
    favoritar(id, a.favoritado_por_mim)
  }

  const opcionais: string[] = (() => {
    try {
      return a?.opcionais ? JSON.parse(a.opcionais) : []
    } catch {
      return []
    }
  })()

  const conversar = () =>
    comLogin('Entre para conversar com a loja.', async () => {
      if (!a) return
      try {
        const conv = await vitrineService.abrirConversa(a)
        queryClient.invalidateQueries({ queryKey: ['vitrine', 'conversas'] })
        navigation.navigate('ConversaVitrine', { id: conv.id, nome: conv.loja_nome })
      } catch (e) {
        toast.show('error', extractErrorDetails(e).message || 'Não foi possível iniciar a conversa com a loja.')
      }
    })

  const whatsapp = async () => {
    if (!a?.loja_whatsapp) { toast.show('info', 'Loja sem WhatsApp cadastrado.'); return }
    const texto = `Olá! Tenho interesse no ${a.marca} ${a.modelo} anunciado na Social Veículos.`
    await abrirWhatsappComLead(a.id, a.loja_whatsapp, texto)
  }

  const compartilhar = () => {
    if (!a) return
    compartilharVeiculo(a, true)
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title={a ? `${a.marca} ${a.modelo}` : 'Veículo'} large={false} back />
      {q.isLoading ? (
        <View style={{ padding: spacing.md }}><SkeletonCard /></View>
      ) : !a ? (
        <EmptyState icon="car-outline" title="Anúncio indisponível" subtitle="Este veículo não está mais disponível." />
      ) : (
        <>
          <Screen padded={false} style={{ paddingBottom: 0 }}>
            <View>
              <MediaCarousel veiculo={a} height={260} borderRadius={0} />
              <View style={styles.topActions}>
                <Pressable onPress={compartilhar} hitSlop={10} style={[styles.actionBtn, { backgroundColor: colors.backdrop }]}>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                </Pressable>
                <Pressable onPress={favoritarComAnimacao} hitSlop={10} style={[styles.actionBtn, { backgroundColor: colors.backdrop }]}>
                  <Animated.View style={{ transform: [{ scale: favScale }] }}>
                    <Ionicons name={a.favoritado_por_mim ? 'heart' : 'heart-outline'} size={20} color={a.favoritado_por_mim ? colors.error : '#fff'} />
                  </Animated.View>
                </Pressable>
              </View>
              <View style={styles.badges}>
                {a.novidade && <Badge label="Novo" tone="success" size="sm" />}
              </View>
            </View>

            <View style={{ padding: spacing.md, gap: spacing.md }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {a.oferta && <Badge label="Oferta" tone="error" size="sm" />}
                  <Txt style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, flex: 1 }}>{a.marca} {a.modelo}</Txt>
                </View>
                {a.versao ? <Txt variant="body" color="textDim">{a.versao}</Txt> : null}
              </View>

              {/* Preço — bloco grafite fixo (independe do tema): a dúvida real do comprador
                  é o valor à vista, em destaque. Sem dado de simulação/parcela nesta tela
                  (AnuncioVitrine não traz parcela), o bloco mostra só o preço à vista. */}
              <View style={[styles.precoBloco, { backgroundColor: darkColors.surface }]}>
                <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 9.5, letterSpacing: 0.6, color: darkColors.textMuted }}>
                  À VISTA
                </Txt>
                <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 28, color: darkColors.text, marginTop: 2 }}>
                  {a.preco_venda != null ? formatBRL(a.preco_venda) : 'Sob consulta'}
                </Txt>
              </View>

              {/* Specs */}
              <Card style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Spec icon="calendar-outline" label="Ano" valor={`${a.ano_fabricacao}/${a.ano_modelo}`} />
                {a.km != null && <Spec icon="speedometer-outline" label="KM" valor={formatKm(a.km)} />}
                {a.cambio && <Spec icon="cog-outline" label="Câmbio" valor={a.cambio} />}
                {a.combustivel && <Spec icon="water-outline" label="Combustível" valor={a.combustivel} />}
                {a.cor && <Spec icon="color-palette-outline" label="Cor" valor={a.cor} />}
                {a.portas != null && <Spec icon="car-outline" label="Portas" valor={String(a.portas)} />}
              </Card>

              {a.descricao ? (
                <Card>
                  <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Descrição</Txt>
                  <Txt variant="body" color="textDim">{a.descricao}</Txt>
                </Card>
              ) : null}

              {opcionais.length > 0 && (
                <Card>
                  <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase', marginBottom: spacing.xs }}>Opcionais</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {opcionais.map((o) => (
                      <View key={o} style={{ backgroundColor: colors.overlay, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Txt variant="caption" color="textDim">{o}</Txt>
                      </View>
                    ))}
                  </View>
                </Card>
              )}

              {/* Loja */}
              <Card onPress={() => navigation.navigate('PerfilLoja', { id: a.loja_id })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar nome={a.loja_nome} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Txt variant="bodySemibold" numberOfLines={1}>{a.loja_nome}</Txt>
                      {a.loja_verificada && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                    </View>
                    <Txt variant="caption" color="textDim">{a.loja_cidade}/{a.loja_estado}</Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            </View>
          </Screen>

          {/* Barra de ação fixa */}
          <View style={[styles.acoes, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.xs }]}>
            <Button title="Conversar" icon="chatbubble-outline" onPress={conversar} style={{ flex: 1 }} />
            <Button title="WhatsApp" variant="success" icon="logo-whatsapp" onPress={whatsapp} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </Screen>
  )
}

function Spec({ icon, label, valor }: { icon: keyof typeof Ionicons.glyphMap; label: string; valor: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 6 }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View>
        <Txt variant="caption" color="textMuted">{label}</Txt>
        <Txt variant="captionMedium" numberOfLines={1}>{valor}</Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topActions: { position: 'absolute', top: spacing.sm, right: spacing.sm, flexDirection: 'row', gap: spacing.xs, zIndex: 12, elevation: 6 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', gap: 4 },
  acoes: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  precoBloco: { borderRadius: radius.xl, padding: spacing.md },
})
