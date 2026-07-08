import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme, type ThemeMode } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { AppHeader, Button, Card, Screen, Sheet, Txt, useToast } from '../../components/ui'
import { resetDb } from '../../services'

const MODOS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
]

export default function ConfiguracoesScreen() {
  const { colors, mode, setMode } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [resetAberto, setResetAberto] = useState(false)
  const [resetando, setResetando] = useState(false)

  const resetar = async () => {
    setResetando(true)
    try {
      await resetDb()
      queryClient.clear()
      await queryClient.invalidateQueries()
      setResetAberto(false)
      toast.show('success', 'Dados de demonstração restaurados.')
    } finally {
      setResetando(false)
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Configurações" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {/* Tema */}
        <Card>
          <Txt variant="title" style={{ marginBottom: 4 }}>Aparência</Txt>
          <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.sm }}>
            Escolha o tema do aplicativo.
          </Txt>
          <View style={styles.modos}>
            {MODOS.map((m) => {
              const ativo = mode === m.value
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  style={[
                    styles.modo,
                    {
                      backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft,
                      borderColor: ativo ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={22}
                    color={ativo ? colors.primary : colors.textDim}
                  />
                  <Txt
                    style={{
                      fontFamily: ativo ? fonts.semibold : fonts.medium,
                      fontSize: 13,
                      color: ativo ? colors.primaryText : colors.textDim,
                    }}
                  >
                    {m.label}
                  </Txt>
                </Pressable>
              )
            })}
          </View>
        </Card>

        {/* Dados */}
        <Card>
          <Txt variant="title" style={{ marginBottom: 4 }}>Dados de demonstração</Txt>
          <Txt variant="caption" color="textDim" style={{ marginBottom: spacing.sm }}>
            O app funciona 100% offline com dados fictícios salvos neste aparelho. Quando o
            backend oficial for conectado, esta seção deixa de existir.
          </Txt>
          <Button
            title="Restaurar dados originais"
            variant="outline"
            icon="refresh-outline"
            onPress={() => setResetAberto(true)}
          />
        </Card>

        {/* Sobre */}
        <Card>
          <Txt variant="title" style={{ marginBottom: spacing.xs }}>Sobre</Txt>
          <Linha label="Versão" valor="0.1.0 (demo)" />
          <Linha label="Plataforma" valor="Social Veículos — Gestor" />
          <Linha label="Suporte" valor="suporte@socialveiculos.com.br" />
        </Card>
      </Screen>

      <Sheet visible={resetAberto} onClose={() => setResetAberto(false)} title="Restaurar dados" scrollable={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Txt variant="body" color="textDim">
            Isso descarta todas as alterações feitas (veículos, leads, vendas) e recarrega os
            dados originais de demonstração. Não afeta o seu login.
          </Txt>
          <Button title="Restaurar agora" variant="danger" loading={resetando} onPress={resetar} />
          <Button title="Cancelar" variant="ghost" onPress={() => setResetAberto(false)} />
        </View>
      </Sheet>
    </Screen>
  )
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.linha}>
      <Txt variant="caption" color="textDim">{label}</Txt>
      <Txt variant="captionMedium">{valor}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  modos: { flexDirection: 'row', gap: spacing.xs },
  modo: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
})
