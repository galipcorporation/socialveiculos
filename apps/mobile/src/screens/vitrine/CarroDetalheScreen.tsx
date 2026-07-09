import React from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, EmptyState, Screen, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { vitrineService } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'
import { formatBRL, formatKm } from '../../lib/format'
import type { VitrineScreenProps } from '../../navigation/types'

export default function CarroDetalheScreen({ route }: VitrineScreenProps<'CarroDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const comLogin = useGateLogin()

  const q = useQuery({ queryKey: ['vitrine', 'detalhe', id], queryFn: () => vitrineService.detalhe(id) })
  const a = q.data

  const favoritar = () =>
    comLogin('Entre para salvar seus favoritos.', async () => {
      await vitrineService.alternarFavorito(id)
      queryClient.invalidateQueries({ queryKey: ['vitrine'] })
    })

  const conversar = () =>
    comLogin('Entre para conversar com a loja.', async () => {
      if (!a) return
      const conv = await vitrineService.abrirConversa(a)
      queryClient.invalidateQueries({ queryKey: ['vitrine', 'conversas'] })
      navigation.navigate('ConversaVitrine', { id: conv.id, nome: conv.loja_nome })
    })

  const whatsapp = async () => {
    if (!a?.loja_whatsapp) { toast.show('info', 'Loja sem WhatsApp cadastrado.'); return }
    const texto = encodeURIComponent(`Olá! Tenho interesse no ${a.marca} ${a.modelo} anunciado na Social Veículos.`)
    const url = `https://wa.me/55${a.loja_whatsapp.replace(/\D/g, '')}?text=${texto}`
    const ok = await Linking.canOpenURL(url)
    if (ok) Linking.openURL(url)
    else toast.show('info', 'Não foi possível abrir o WhatsApp.')
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
              <VehiclePhoto veiculo={a} height={260} borderRadius={0} />
              <Pressable onPress={favoritar} hitSlop={10} style={[styles.fav, { backgroundColor: colors.backdrop }]}>
                <Ionicons name={a.favoritado_por_mim ? 'heart' : 'heart-outline'} size={22} color={a.favoritado_por_mim ? colors.error : '#fff'} />
              </Pressable>
              <View style={styles.badges}>
                {a.oferta && <Badge label="Oferta" tone="error" size="sm" />}
                {a.novidade && <Badge label="Novo" tone="success" size="sm" />}
              </View>
            </View>

            <View style={{ padding: spacing.md, gap: spacing.md }}>
              <View>
                <Txt style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>{a.marca} {a.modelo}</Txt>
                {a.versao ? <Txt variant="body" color="textDim">{a.versao}</Txt> : null}
                <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 26, color: colors.primaryText, marginTop: 6 }}>
                  {formatBRL(a.preco_venda)}
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
  fav: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', gap: 4 },
  acoes: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
})
