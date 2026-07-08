import React from 'react'
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/tokens'
import type { RootStackParamList } from './types'
import MainTabs from './MainTabs'
import LoginScreen from '../screens/auth/LoginScreen'
import VeiculoDetalheScreen from '../screens/estoque/VeiculoDetalheScreen'
import VeiculoFormScreen from '../screens/estoque/VeiculoFormScreen'
import LeadDetalheScreen from '../screens/crm/LeadDetalheScreen'
import LeadFormScreen from '../screens/crm/LeadFormScreen'
import ConversaScreen from '../screens/chat/ConversaScreen'
import PosVendaScreen from '../screens/posvenda/PosVendaScreen'
import EsteiraDetalheScreen from '../screens/posvenda/EsteiraDetalheScreen'
import ComissoesScreen from '../screens/comissoes/ComissoesScreen'
import FinanceiroScreen from '../screens/financeiro/FinanceiroScreen'
import EquipeScreen from '../screens/equipe/EquipeScreen'
import SimuladorScreen from '../screens/ferramentas/SimuladorScreen'
import ConfiguracoesScreen from '../screens/mais/ConfiguracoesScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { colors, dark } = useTheme()

  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
    fonts: {
      ...(dark ? DarkTheme.fonts : DefaultTheme.fonts),
      regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
      medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
      bold: { fontFamily: fonts.bold, fontWeight: '700' as const },
      heavy: { fontFamily: fonts.displayBold, fontWeight: '700' as const },
    },
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="VeiculoDetalhe" component={VeiculoDetalheScreen} />
            <Stack.Screen
              name="VeiculoForm"
              component={VeiculoFormScreen}
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen name="LeadDetalhe" component={LeadDetalheScreen} />
            <Stack.Screen
              name="LeadForm"
              component={LeadFormScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Conversa" component={ConversaScreen} />
            <Stack.Screen name="PosVenda" component={PosVendaScreen} />
            <Stack.Screen name="EsteiraDetalhe" component={EsteiraDetalheScreen} />
            <Stack.Screen name="Comissoes" component={ComissoesScreen} />
            <Stack.Screen name="Financeiro" component={FinanceiroScreen} />
            <Stack.Screen name="Equipe" component={EquipeScreen} />
            <Stack.Screen name="Simulador" component={SimuladorScreen} />
            <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
