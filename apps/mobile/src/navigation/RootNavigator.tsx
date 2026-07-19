import React, { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../stores/authStore'
import { registerForPush } from '../lib/push'
import { useExperienciaStore } from '../stores/experienciaStore'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/tokens'
import type { RootStackParamList } from './types'
import MainTabs from './MainTabs'
import VitrineNavigator from './VitrineNavigator'
import LoginScreen from '../screens/auth/LoginScreen'
import EscolhaExperienciaScreen from '../screens/auth/EscolhaExperienciaScreen'
import VeiculoDetalheScreen from '../screens/estoque/VeiculoDetalheScreen'
import VeiculoFormScreen from '../screens/estoque/VeiculoFormScreen'
import LeadDetalheScreen from '../screens/crm/LeadDetalheScreen'
import LeadFormScreen from '../screens/crm/LeadFormScreen'
import ClientesScreen from '../screens/crm/ClientesScreen'
import AprovacoesScreen from '../screens/estoque/AprovacoesScreen'
import ConversaScreen from '../screens/chat/ConversaScreen'
import PosVendaScreen from '../screens/posvenda/PosVendaScreen'
import EsteiraDetalheScreen from '../screens/posvenda/EsteiraDetalheScreen'
import ComissoesScreen from '../screens/comissoes/ComissoesScreen'
import FinanceiroScreen from '../screens/financeiro/FinanceiroScreen'
import EquipeScreen from '../screens/equipe/EquipeScreen'
import SimuladorScreen from '../screens/ferramentas/SimuladorScreen'
import ConfiguracoesScreen from '../screens/mais/ConfiguracoesScreen'
import PerfilLojaScreen from '../screens/mais/config/PerfilLojaScreen'
import CredenciaisBancoScreen from '../screens/mais/config/CredenciaisBancoScreen'
import CredenciaisIAScreen from '../screens/mais/config/CredenciaisIAScreen'
import RedesSociaisScreen from '../screens/mais/config/RedesSociaisScreen'
import DetranScreen from '../screens/mais/config/DetranScreen'
import FiscalScreen from '../screens/mais/config/FiscalScreen'
import FipeScreen from '../screens/ferramentas/FipeScreen'
import ContratosScreen from '../screens/ferramentas/ContratosScreen'
import NotasFiscaisScreen from '../screens/ferramentas/NotasFiscaisScreen'
import MeuSiteScreen from '../screens/ferramentas/MeuSiteScreen'
import MarketingScreen from '../screens/ferramentas/MarketingScreen'
import AssistenteIAScreen from '../screens/ferramentas/AssistenteIAScreen'
import ConversaAssistenteScreen from '../screens/ferramentas/ConversaAssistenteScreen'
import AssistenteConfigScreen from '../screens/ferramentas/AssistenteConfigScreen'
import RedeSocialScreen from '../screens/rede/RedeSocialScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** Ao tocar numa notificação (link "chat:{conversaId}"), abre a conversa. */
function abrirDeepLink(link?: unknown) {
  if (typeof link !== 'string' || !navigationRef.isReady()) return
  if (link.startsWith('chat:')) {
    const id = link.slice('chat:'.length)
    if (id) navigationRef.navigate('Conversa', { id })
  }
}

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const papel = useAuthStore((state) => state.user?.papel)
  const experiencia = useExperienciaStore((state) => state.experiencia)
  const hidratado = useExperienciaStore((state) => state.hidratado)
  const { colors, dark } = useTheme()

  // Lojista só entra no painel se autenticado como gestor/vendedor (não cliente).
  const lojistaLogado = isAuthenticated && papel !== 'cliente'

  // Push: registra o token quando o usuário fica autenticado. O unregister no
  // logout é disparado pela tela de configurações (onde a ação existe).
  useEffect(() => {
    if (isAuthenticated) registerForPush()
  }, [isAuthenticated])

  // Tap numa notificação → abre a conversa (funciona com o app aberto e ao
  // ser aberto por um push com o app fechado, via getLastNotificationResponse).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      abrirDeepLink(resp.notification.request.content.data?.link)
    })
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) abrirDeepLink(resp.notification.request.content.data?.link)
    })
    return () => sub.remove()
  }, [])

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

  // Aguarda a hidratação do modo de experiência (AsyncStorage) para não piscar
  // a tela de escolha em quem já escolheu. Splash neutro no ínterim.
  if (!hidratado) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {experiencia === null ? (
          <Stack.Screen name="EscolhaExperiencia" component={EscolhaExperienciaScreen} options={{ animation: 'fade' }} />
        ) : experiencia === 'comprador' ? (
          <Stack.Screen name="Vitrine" component={VitrineNavigator} />
        ) : lojistaLogado ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="VeiculoDetalhe" component={VeiculoDetalheScreen} />
            <Stack.Screen
              name="VeiculoForm"
              component={VeiculoFormScreen}
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen name="LeadDetalhe" component={LeadDetalheScreen} />
            <Stack.Screen name="Clientes" component={ClientesScreen} />
            <Stack.Screen name="Aprovacoes" component={AprovacoesScreen} />
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
            <Stack.Screen name="PerfilLoja" component={PerfilLojaScreen} />
            <Stack.Screen name="CredenciaisBanco" component={CredenciaisBancoScreen} />
            <Stack.Screen name="CredenciaisIA" component={CredenciaisIAScreen} />
            <Stack.Screen name="RedesSociais" component={RedesSociaisScreen} />
            <Stack.Screen name="Detran" component={DetranScreen} />
            <Stack.Screen name="Fiscal" component={FiscalScreen} />
            <Stack.Screen name="Fipe" component={FipeScreen} />
            <Stack.Screen name="Contratos" component={ContratosScreen} />
            <Stack.Screen name="NotasFiscais" component={NotasFiscaisScreen} />
            <Stack.Screen name="MeuSite" component={MeuSiteScreen} />
            <Stack.Screen name="Marketing" component={MarketingScreen} />
            <Stack.Screen name="AssistenteIA" component={AssistenteIAScreen} />
            <Stack.Screen name="ConversaAssistente" component={ConversaAssistenteScreen} />
            <Stack.Screen name="AssistenteConfig" component={AssistenteConfigScreen} />
            <Stack.Screen name="RedeSocial" component={RedeSocialScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
