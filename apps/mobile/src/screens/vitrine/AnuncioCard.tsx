import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Avatar, Badge, Button, Card, Txt } from '../../components/ui'
import { MediaCarousel } from '../../components/MediaCarousel'
import type { AnuncioVitrine } from '../../services/types'
import { formatBRL, formatKm } from '../../lib/format'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  anuncio: AnuncioVitrine
  onPress: () => void
  onLojaPress?: () => void
  onFavorito: () => void
  onSeguirLoja?: () => void
  seguindoLoja?: boolean
  onWhatsapp?: () => void
}

export function AnuncioCard({ anuncio: a, onPress, onLojaPress, onFavorito, onSeguirLoja, seguindoLoja, onWhatsapp }: Props) {
  const { colors } = useTheme()
  const aceitaTroca = !!a.descricao && semAcento(a.descricao).includes('troca')

  return (
    <Card onPress={onPress} padded={false} style={{ overflow: 'hidden' }}>
      {/* Loja */}
      <Pressable
        onPress={onLojaPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm }}
      >
        <Avatar nome={a.loja_nome} size={28} />
        <Txt variant="captionMedium" numberOfLines={1} style={{ flex: 1 }}>{a.loja_nome}</Txt>
        {a.loja_verificada && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
        <Txt variant="caption" color="textMuted">{a.loja_cidade}/{a.loja_estado}</Txt>
        {onSeguirLoja && (
          <Pressable onPress={onSeguirLoja} hitSlop={8} style={{ marginLeft: 4 }}>
            <Txt variant="captionMedium" color={seguindoLoja ? 'textMuted' : 'primaryText'}>
              {seguindoLoja ? 'Seguindo' : 'Seguir'}
            </Txt>
          </Pressable>
        )}
      </Pressable>

      {/* Mídia */}
      <View>
        <MediaCarousel veiculo={a} height={200} borderRadius={0} />
        <Pressable onPress={onFavorito} hitSlop={10} style={[styles.fav, { backgroundColor: colors.backdrop }]}>
          <Ionicons
            name={a.favoritado_por_mim ? 'heart' : 'heart-outline'}
            size={20}
            color={a.favoritado_por_mim ? colors.error : '#fff'}
          />
        </Pressable>
        <View style={styles.badges}>
          {a.oferta && <Badge label="Oferta" tone="error" size="sm" />}
          {a.novidade && <Badge label="Novo" tone="success" size="sm" />}
          {aceitaTroca && <Badge label="Aceita troca" tone="info" size="sm" />}
        </View>
      </View>

      {/* Info */}
      <View style={{ padding: spacing.sm, gap: 2 }}>
        <Txt variant="bodySemibold" numberOfLines={1}>{a.marca} {a.modelo}</Txt>
        {a.versao ? <Txt variant="caption" color="textDim" numberOfLines={1}>{a.versao}</Txt> : null}
        <Txt variant="caption" color="textMuted" numberOfLines={1}>
          {[a.ano_modelo, a.km != null ? formatKm(a.km) : null, a.cor].filter(Boolean).join(' · ')}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Txt style={{ fontFamily: fonts.displayBold, fontSize: 19, color: colors.primaryText }}>
            {a.preco_venda != null ? formatBRL(a.preco_venda) : 'Sob consulta'}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="heart" size={13} color={colors.textMuted} />
            <Txt variant="caption" color="textMuted">{a.total_favoritos}</Txt>
          </View>
        </View>
        {onWhatsapp && (
          <Button title="WhatsApp" variant="success" size="sm" icon="logo-whatsapp" onPress={onWhatsapp} full style={{ marginTop: spacing.xs }} />
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  fav: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  badges: { position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', gap: 4 },
})
