import React, { useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Paywall, Screen, SkeletonCard, Txt } from '../../components/ui'
import { modulosService } from '../../services'

interface Msg { id: string; autor: 'user' | 'ia'; texto: string }

const SUGESTOES = [
  'Como abordar um cliente indeciso?',
  'Argumentos para vender um seminovo com km alto',
  'Resposta para "tá caro"',
]

// Respostas mock (o app real chamaria Groq/Llama — ver memória stack-ia-assistente-vs-marketing).
function respostaMock(pergunta: string): string {
  const p = pergunta.toLowerCase()
  if (p.includes('caro')) {
    return 'Reforce o valor, não o preço: destaque procedência, garantia e o custo-benefício frente à FIPE. Ofereça simular o financiamento na hora para trazer a conversa para a parcela que cabe no bolso do cliente.'
  }
  if (p.includes('km') || p.includes('quilmetragem') || p.includes('quilometragem')) {
    return 'Transforme o km em confiança: mostre o histórico de revisões e o laudo cautelar, explique que rodagem em estrada desgasta menos e reforce a garantia da loja. Ancore no valor abaixo da FIPE.'
  }
  return 'Ouça primeiro para entender a real objeção, personalize a abordagem ao perfil do cliente e conduza para um test drive — a experiência de dirigir é o maior gatilho de decisão.'
}

export default function AssistenteIAScreen() {
  const { colors, dark } = useTheme()
  const insets = useSafeAreaInsets()
  const gateQ = useQuery({ queryKey: ['modulo', 'assistente'], queryFn: () => modulosService.liberado('assistente') })

  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')

  const enviar = (t: string) => {
    const pergunta = t.trim()
    if (!pergunta) return
    setTexto('')
    const idU = `u-${Date.now()}`
    setMsgs((m) => [...m, { id: idU, autor: 'user', texto: pergunta }])
    setTimeout(() => {
      setMsgs((m) => [...m, { id: `i-${Date.now()}`, autor: 'ia', texto: respostaMock(pergunta) }])
    }, 500)
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Assistente do Vendedor" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Assistente do Vendedor" large={false} back />
        <Screen padded>
          <Paywall titulo="Assistente do Vendedor (IA)" descricao="Um copiloto de IA para tirar dúvidas de abordagem, contornar objeções e treinar argumentos de venda. Módulo não incluído no plano atual." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Assistente do Vendedor" large={false} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            msgs.length === 0 ? (
              <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
                <Txt variant="caption" color="textDim">Peça ajuda com abordagens, objeções e argumentos. Experimente:</Txt>
                {SUGESTOES.map((s) => (
                  <Pressable key={s} onPress={() => enviar(s)} style={[styles.sugestao, { backgroundColor: colors.overlaySoft, borderColor: colors.border }]}>
                    <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                    <Txt variant="caption" color="textDim" style={{ flex: 1 }}>{s}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const minha = item.autor === 'user'
            return (
              <View
                style={[
                  styles.bolha,
                  minha
                    ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
                    : { alignSelf: 'flex-start', backgroundColor: dark ? colors.surfaceElevated : '#fff', borderWidth: dark ? 0 : 1, borderColor: colors.border },
                ]}
              >
                <Txt style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: minha ? colors.onPrimary : colors.text }}>{item.texto}</Txt>
              </View>
            )
          }}
        />
        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.xs }]}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Pergunte ao assistente…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
          <Pressable onPress={() => enviar(texto)} disabled={!texto.trim()} style={[styles.enviar, { backgroundColor: texto.trim() ? colors.primary : colors.overlay }]}>
            <Ionicons name="send" size={18} color={texto.trim() ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  sugestao: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  bolha: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.sm, paddingTop: 10, paddingBottom: 10, maxHeight: 110, fontFamily: fonts.regular, fontSize: 15 },
  enviar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
})
