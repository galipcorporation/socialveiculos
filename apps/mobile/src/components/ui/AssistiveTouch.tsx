import React, { useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useModulosLiberados } from '../../hooks/useModulosLiberados'
import { navigationRef } from '../../navigation/RootNavigator'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const BUTTON_SIZE = 56
const MARGIN = 16

export function AssistiveTouch() {
  const { colors } = useTheme()
  const { liberado, gestor } = useModulosLiberados()
  const [modalVisible, setModalVisible] = useState(false)

  // Posição inicial: Canto inferior direito (~65% da altura)
  const pan = useRef(
    new Animated.ValueXY({ x: SCREEN_WIDTH - BUTTON_SIZE - MARGIN, y: SCREEN_HEIGHT * 0.65 })
  ).current
  const dragDistance = useRef(0)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3
      },
      onPanResponderGrant: () => {
        dragDistance.current = 0
        pan.setOffset({
          // @ts-ignore offset privado do Animated.ValueXY
          x: pan.x._value,
          // @ts-ignore offset privado do Animated.ValueXY
          y: pan.y._value,
        })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: (_, gestureState) => {
        dragDistance.current = Math.hypot(gestureState.dx, gestureState.dy)
        pan.x.setValue(gestureState.dx)
        pan.y.setValue(gestureState.dy)
      },
      onPanResponderRelease: () => {
        pan.flattenOffset()

        // Se arrastou quase nada (< 6px), considera toque simples para abrir o menu
        if (dragDistance.current < 6) {
          setModalVisible(true)
          return
        }

        // Snap suave para a borda lateral mais próxima (esquerda ou direita)
        // @ts-ignore valor atual
        const currentX = pan.x._value
        const targetX = currentX + BUTTON_SIZE / 2 < SCREEN_WIDTH / 2 ? MARGIN : SCREEN_WIDTH - BUTTON_SIZE - MARGIN

        // Limita a posição vertical dentro da área útil da tela (evita esconder sob statusbar ou navbar)
        // @ts-ignore valor atual
        const currentY = pan.y._value
        const minY = 60
        const maxY = SCREEN_HEIGHT - 120
        const targetY = Math.min(Math.max(currentY, minY), maxY)

        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          speed: 16,
          bounciness: 6,
        }).start()
      },
    })
  ).current

  const navegarPara = (screenName: string, params?: object) => {
    setModalVisible(false)
    if (navigationRef.isReady()) {
      // @ts-ignore tipagem genérica da navegação
      navigationRef.navigate(screenName, params)
    }
  }

  const todasAcoes = [
    {
      id: 'rede_social',
      label: 'Rede Social (B2B)',
      sublabel: 'Feed de repasses, propostas e parceiros',
      icon: 'git-network-outline' as const,
      color: '#6366f1',
      visible: true,
      action: () => navegarPara('RedeSocial'),
    },
    {
      id: 'fipe',
      label: 'Consulta FIPE',
      sublabel: 'Valores de referência por modelo/ano',
      icon: 'pricetags-outline' as const,
      color: '#0ea5e9',
      visible: true,
      action: () => navegarPara('Fipe'),
    },
    {
      id: 'simulador',
      label: 'Simulador',
      sublabel: 'Calcule parcelas para o cliente na hora',
      icon: 'calculator-outline' as const,
      color: '#06b6d4',
      visible: liberado('simulador'),
      action: () => navegarPara('Simulador'),
    },
    {
      id: 'veiculo',
      label: 'Cadastrar Veículo',
      sublabel: 'Novo carro no estoque da loja',
      icon: 'car-sport-outline' as const,
      color: '#10b981',
      visible: liberado('estoque'),
      action: () => navegarPara('VeiculoForm'),
    },
    {
      id: 'lead',
      label: 'Novo Lead (CRM)',
      sublabel: 'Cadastrar interessado ou proposta',
      icon: 'person-add-outline' as const,
      color: '#f59e0b',
      visible: liberado('crm'),
      action: () => navegarPara('LeadForm'),
    },
    {
      id: 'posvenda',
      label: 'Pós-venda',
      sublabel: 'Esteira de contrato, pagamento e transferência',
      icon: 'clipboard-outline' as const,
      color: '#3b82f6',
      visible: true,
      action: () => navegarPara('PosVenda'),
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      sublabel: 'Receitas, despesas e comissões da loja',
      icon: 'wallet-outline' as const,
      color: '#ec4899',
      visible: liberado('financeiro'),
      action: () => navegarPara('Financeiro'),
    },
    {
      id: 'assistente_ia',
      label: 'Assistente IA',
      sublabel: 'Copiloto para abordagem e objeções',
      icon: 'chatbubble-ellipses-outline' as const,
      color: '#8b5cf6',
      visible: liberado('assistente_ia'),
      action: () => navegarPara('AssistenteIA'),
    },
    {
      id: 'contratos',
      label: 'Contratos',
      sublabel: 'Contratos de compra e venda + PDF',
      icon: 'document-text-outline' as const,
      color: '#10b981',
      visible: liberado('contratos'),
      action: () => navegarPara('Contratos'),
    },
    {
      id: 'fiscal',
      label: 'Notas Fiscais',
      sublabel: 'Emitir e acompanhar NF-e de venda',
      icon: 'receipt-outline' as const,
      color: '#f59e0b',
      visible: liberado('fiscal'),
      action: () => navegarPara('NotasFiscais'),
    },
    {
      id: 'marketing',
      label: 'Marketing IA',
      sublabel: 'Gere legendas para redes sociais',
      icon: 'sparkles-outline' as const,
      color: '#8b5cf6',
      visible: liberado('marketing'),
      action: () => navegarPara('Marketing'),
    },
    {
      id: 'site',
      label: 'Meu Site',
      sublabel: 'Construtor do site white-label da loja',
      icon: 'globe-outline' as const,
      color: '#10b981',
      visible: gestor && liberado('site'),
      action: () => navegarPara('MeuSite'),
    },
  ]

  const acoes = todasAcoes.filter((a) => a.visible)

  return (
    <>
      <Animated.View
        style={[
          styles.floatingBtn,
          {
            transform: pan.getTranslateTransform(),
            backgroundColor: colors.primary,
            shadowColor: '#000',
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={() => setModalVisible(true)}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="apps-sharp" size={26} color="#ffffff" />
        </Pressable>
      </Animated.View>

      <Sheet visible={modalVisible} onClose={() => setModalVisible(false)} title="Ações & Ferramentas Rápidas">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Txt variant="caption" color="textDim">
            Acesso rápido às ferramentas principais da plataforma.
          </Txt>

          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {acoes.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.action}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    backgroundColor: pressed ? colors.overlaySoft : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color + '1f' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">{item.label}</Txt>
                  <Txt variant="caption" color="textDim">
                    {item.sublabel}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    zIndex: 9999,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
