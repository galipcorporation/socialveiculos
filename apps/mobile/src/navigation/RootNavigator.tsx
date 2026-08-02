import React, { lazy, Suspense, useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
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
import VeiculoDetalheScreen from '../screens/estoque/VeiculoDetalheScreen'
import VeiculoFormScreen from '../screens/estoque/VeiculoFormScreen'
import LeadDetalheScreen from '../screens/crm/LeadDetalheScreen'
import LeadFormScreen from '../screens/crm/LeadFormScreen'
import ClientesScreen from '../screens/crm/ClientesScreen'
import AprovacoesScreen from '../screens/estoque/AprovacoesScreen'
import ConversaScreen from '../screens/chat/ConversaScreen'
import ConfiguracoesScreen from '../screens/mais/ConfiguracoesScreen'
import AjudaScreen from '../screens/mais/AjudaScreen'
import PerfilLojaScreen from '../screens/mais/config/PerfilLojaScreen'
import CredenciaisBancoScreen from '../screens/mais/config/CredenciaisBancoScreen'
import CredenciaisIAScreen from '../screens/mais/config/CredenciaisIAScreen'
import RedesSociaisScreen from '../screens/mais/config/RedesSociaisScreen'
import DetranScreen from '../screens/mais/config/DetranScreen'
import { AssistiveTouch } from '../components/ui'

// Telas de módulos contratáveis (não-núcleo): carregadas sob demanda para não
// pesar no bundle inicial de quem não tem — ou ainda não abriu — o módulo.
// Núcleo (estoque/crm/chat/dashboard/config) continua eager acima.
const PosVendaScreen = lazy(() => import('../screens/posvenda/PosVendaScreen'))
const EsteiraDetalheScreen = lazy(() => import('../screens/posvenda/EsteiraDetalheScreen'))
const ComissoesScreen = lazy(() => import('../screens/comissoes/ComissoesScreen'))
const FinanceiroScreen = lazy(() => import('../screens/financeiro/FinanceiroScreen'))
const EquipeScreen = lazy(() => import('../screens/equipe/EquipeScreen'))
const SimuladorScreen = lazy(() => import('../screens/ferramentas/SimuladorScreen'))
const FiscalScreen = lazy(() => import('../screens/mais/config/FiscalScreen'))
const FipeScreen = lazy(() => import('../screens/ferramentas/FipeScreen'))
const ContratosScreen = lazy(() => import('../screens/ferramentas/ContratosScreen'))
const ContratoDocumentoScreen = lazy(() => import('../screens/ferramentas/ContratoDocumentoScreen'))
const NotasFiscaisScreen = lazy(() => import('../screens/ferramentas/NotasFiscaisScreen'))
const MeuSiteScreen = lazy(() => import('../screens/ferramentas/MeuSiteScreen'))
const MarketingScreen = lazy(() => import('../screens/ferramentas/MarketingScreen'))
const AnunciosScreen = lazy(() => import('../screens/ferramentas/AnunciosScreen'))
const AssistenteIAScreen = lazy(() => import('../screens/ferramentas/AssistenteIAScreen'))
const ConversaAssistenteScreen = lazy(() => import('../screens/ferramentas/ConversaAssistenteScreen'))
const AssistenteConfigScreen = lazy(() => import('../screens/ferramentas/AssistenteConfigScreen'))
const RedeSocialScreen = lazy(() => import('../screens/rede/RedeSocialScreen'))

const Stack = createNativeStackNavigator<RootStackParamList>()
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** Envolve uma tela lazy em Suspense — usado como `component` do Stack.Screen. */
function comSuspense<P extends object>(LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>) {
  return function TelaComSuspense(props: P) {
    const { colors } = useTheme()
    return (
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Criados uma única vez no módulo (não a cada render do RootNavigator) para o
// React Navigation não desmontar/remontar a tela lazy em todo re-render.
const PosVenda = comSuspense(PosVendaScreen)
const EsteiraDetalhe = comSuspense(EsteiraDetalheScreen)
const Comissoes = comSuspense(ComissoesScreen)
const Financeiro = comSuspense(FinanceiroScreen)
const Equipe = comSuspense(EquipeScreen)
const Simulador = comSuspense(SimuladorScreen)
const Fiscal = comSuspense(FiscalScreen)
const Fipe = comSuspense(FipeScreen)
const Contratos = comSuspense(ContratosScreen)
const ContratoDocumento = comSuspense(ContratoDocumentoScreen)
const NotasFiscais = comSuspense(NotasFiscaisScreen)
const MeuSite = comSuspense(MeuSiteScreen)
const Marketing = comSuspense(MarketingScreen)
const Anuncios = comSuspense(AnunciosScreen)
const AssistenteIA = comSuspense(AssistenteIAScreen)
const ConversaAssistente = comSuspense(ConversaAssistenteScreen)
const AssistenteConfig = comSuspense(AssistenteConfigScreen)
const RedeSocial = comSuspense(RedeSocialScreen)

/**
 * Ao tocar numa notificação, abre a tela correspondente:
 *   "chat:{conversaId}"                       → conversa do chat
 *   "assistente:{conversaId}:{nome do lead}"  → conversa do Assistente do Vendedor
 * O nome vai no próprio link porque a rota ConversaAssistente exige `nome` e o
 * push chega sem nenhum dado carregado.
 */
function abrirDeepLink(link?: unknown) {
  if (typeof link !== 'string' || !navigationRef.isReady()) return
  if (link.startsWith('chat:')) {
    const id = link.slice('chat:'.length)
    if (id) navigationRef.navigate('Conversa', { id })
    return
  }
  if (link.startsWith('assistente:')) {
    // O nome do lead pode conter ':', então só o primeiro separador divide.
    const resto = link.slice('assistente:'.length)
    const sep = resto.indexOf(':')
    const id = sep === -1 ? resto : resto.slice(0, sep)
    const nome = sep === -1 ? 'Lead' : resto.slice(sep + 1) || 'Lead'
    if (id) navigationRef.navigate('ConversaAssistente', { id, nome })
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

  // Aguarda a hidratação do modo de experiência (AsyncStorage) antes de decidir
  // a rota inicial (padrão: Vitrine). Splash neutro no ínterim.
  if (!hidratado) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {experiencia === 'comprador' ? (
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
            <Stack.Screen name="PosVenda" component={PosVenda} />
            <Stack.Screen name="EsteiraDetalhe" component={EsteiraDetalhe} />
            <Stack.Screen name="Comissoes" component={Comissoes} />
            <Stack.Screen name="Financeiro" component={Financeiro} />
            <Stack.Screen name="Equipe" component={Equipe} />
            <Stack.Screen name="Simulador" component={Simulador} />
            <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
            <Stack.Screen name="Ajuda" component={AjudaScreen} />
            <Stack.Screen name="PerfilLoja" component={PerfilLojaScreen} />
            <Stack.Screen name="CredenciaisBanco" component={CredenciaisBancoScreen} />
            <Stack.Screen name="CredenciaisIA" component={CredenciaisIAScreen} />
            <Stack.Screen name="RedesSociais" component={RedesSociaisScreen} />
            <Stack.Screen name="Detran" component={DetranScreen} />
            <Stack.Screen name="Fiscal" component={Fiscal} />
            <Stack.Screen name="Fipe" component={Fipe} />
            <Stack.Screen name="Contratos" component={Contratos} />
            <Stack.Screen name="ContratoDocumento" component={ContratoDocumento} />
            <Stack.Screen name="NotasFiscais" component={NotasFiscais} />
            <Stack.Screen name="MeuSite" component={MeuSite} />
            <Stack.Screen name="Marketing" component={Marketing} />
            <Stack.Screen name="Anuncios" component={Anuncios} />
            <Stack.Screen name="AssistenteIA" component={AssistenteIA} />
            <Stack.Screen name="ConversaAssistente" component={ConversaAssistente} />
            <Stack.Screen name="AssistenteConfig" component={AssistenteConfig} />
            <Stack.Screen name="RedeSocial" component={RedeSocial} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
      {lojistaLogado && experiencia === 'lojista' ? <AssistiveTouch /> : null}
    </NavigationContainer>
  )
}

