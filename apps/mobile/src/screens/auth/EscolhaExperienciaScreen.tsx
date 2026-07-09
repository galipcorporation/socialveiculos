import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Screen, Txt } from '../../components/ui'
import { useExperienciaStore, type Experiencia } from '../../stores/experienciaStore'

const OPCOES: {
  value: Experiencia
  titulo: string
  descricao: string
  icon: keyof typeof Ionicons.glyphMap
  gradiente: [string, string]
}[] = [
  {
    value: 'comprador',
    titulo: 'Sou comprador',
    descricao: 'Explorar carros de várias lojas, favoritar e conversar direto.',
    icon: 'search',
    gradiente: ['#2563eb', '#1d4ed8'],
  },
  {
    value: 'lojista',
    titulo: 'Sou lojista',
    descricao: 'Gerir minha loja: estoque, CRM, vendas e pós-venda.',
    icon: 'business',
    gradiente: ['#0f766e', '#115e59'],
  },
]

export default function EscolhaExperienciaScreen() {
  const { colors } = useTheme()
  const escolher = useExperienciaStore((s) => s.escolher)

  return (
    <Screen style={{ justifyContent: 'center', flexGrow: 1, gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
        <LinearGradient colors={['#2563eb', '#1d4ed8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Ionicons name="car-sport" size={32} color="#fff" />
        </LinearGradient>
        <Txt style={{ fontFamily: fonts.displayExtraBold, fontSize: 26, color: colors.text }}>Social Veículos</Txt>
        <Txt variant="caption" color="textDim" align="center">Como você quer usar o app?</Txt>
      </View>

      <View style={{ gap: spacing.sm }}>
        {OPCOES.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => escolher(o.value)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <LinearGradient colors={o.gradiente} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
              <Ionicons name={o.icon} size={24} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Txt variant="title">{o.titulo}</Txt>
              <Txt variant="caption" color="textDim">{o.descricao}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Txt variant="caption" color="textMuted" align="center">
        Você pode trocar depois nas configurações.
      </Txt>
    </Screen>
  )
}

const styles = StyleSheet.create({
  logo: { width: 68, height: 68, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  cardIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
