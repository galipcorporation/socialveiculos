import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, Screen, SearchBar, Txt,
} from '../../components/ui'
import { abrirWhatsapp } from '../../lib/whatsapp'

const FAQ_ITEMS = [
  {
    pergunta: 'Como cadastrar um veículo no estoque?',
    resposta: 'Na aba "Estoque", toque no botão "+" flutuante no canto inferior direito. Preencha as informações básicas, preço de venda, fotos e opcionais do veículo. Ao salvar, ele ficará disponível no seu estoque e na sua vitrine.'
  },
  {
    pergunta: 'Como funciona o fluxo de Pós-venda?',
    resposta: 'Após mover um lead para a etapa de "Fechamento" ou registrar uma venda no estoque, uma esteira de pós-venda é aberta. Nela você acompanha as etapas de Contrato, Pagamento, Documentos e Transferência do veículo até a entrega.'
  },
  {
    pergunta: 'Como gerar contratos de compra e venda?',
    resposta: 'Acesse "Contratos" na aba "Mais". Você pode criar um novo contrato associado a uma venda, preencher os dados do comprador, vendedor e veículo, e exportar um PDF pronto para assinatura.'
  },
  {
    pergunta: 'Como usar a Inteligência Artificial para vendas?',
    resposta: 'O "Assistente do Vendedor" oferece um copiloto de IA treinado para ajudar na abordagem de leads, contorno de objeções e negociação. Acesse pela aba "Mais" ou direto na tela do lead.'
  },
  {
    pergunta: 'Quem tem acesso ao Financeiro e Equipe?',
    resposta: 'Módulos como "Financeiro" e "Equipe" são restritos a usuários com nível de acesso "Gestor". Vendedores têm visualização apenas de suas próprias comissões e dos leads sob sua responsabilidade.'
  },
  {
    pergunta: 'Como editar as informações da minha loja?',
    resposta: 'Se você for um Gestor, vá na aba "Mais", clique em "Configurações" (ícone de engrenagem) e selecione "Perfil da Loja". Lá você pode alterar nome, telefone, logo e outras configurações gerais.'
  }
]

export default function AjudaScreen() {
  const { colors } = useTheme()
  const [busca, setBusca] = useState('')
  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({})

  const toggleExpandir = (index: number) => {
    setExpandidos((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const faqsFiltrados = FAQ_ITEMS.filter(
    (item) =>
      item.pergunta.toLowerCase().includes(busca.toLowerCase()) ||
      item.resposta.toLowerCase().includes(busca.toLowerCase())
  )

  const falarSuporteWhatsApp = () => {
    abrirWhatsapp('5511999999999', 'Olá, preciso de suporte com o aplicativo Social Veículos.')
  }

  const enviarEmailSuporte = () => {
    Linking.openURL('mailto:suporte@socialveiculos.com.br?subject=Suporte%20App%20Social%20Veiculos').catch(() => {})
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Ajuda e Suporte" large={false} back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contato Rápido */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="bodySemibold">Como prefere falar conosco?</Txt>
          <Txt variant="caption" color="textDim">
            Nosso time de suporte está disponível de segunda a sexta, das 9h às 18h.
          </Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title="WhatsApp"
              icon="logo-whatsapp"
              onPress={falarSuporteWhatsApp}
              style={{ flex: 1, backgroundColor: '#25D366' }}
            />
            <Button
              title="E-mail"
              icon="mail-outline"
              variant="outline"
              onPress={enviarEmailSuporte}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* FAQs */}
        <View style={{ gap: spacing.sm }}>
          <Txt variant="bodySemibold">Dúvidas Frequentes</Txt>
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            placeholder="Digite sua dúvida..."
          />

          {faqsFiltrados.length === 0 ? (
            <Card style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Txt variant="body" color="textDim" style={{ marginTop: spacing.sm }}>
                Nenhum resultado encontrado para "{busca}"
              </Txt>
            </Card>
          ) : (
            faqsFiltrados.map((item, index) => {
              const aberto = !!expandidos[index]
              return (
                <Card
                  key={index}
                  padded={false}
                  style={{ overflow: 'hidden' }}
                >
                  <Pressable
                    onPress={() => toggleExpandir(index)}
                    style={({ pressed }) => [
                      styles.faqHeader,
                      { backgroundColor: pressed ? colors.overlaySoft : 'transparent' }
                    ]}
                  >
                    <Txt variant="bodySemibold" style={{ flex: 1, color: colors.text }}>
                      {item.pergunta}
                    </Txt>
                    <Ionicons
                      name={aberto ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  {aberto && (
                    <View style={[styles.faqBody, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <Txt variant="body" color="textDim">
                        {item.resposta}
                      </Txt>
                    </View>
                  )}
                </Card>
              )
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  faqBody: {
    padding: spacing.md,
  },
})
