import React, { useCallback } from 'react'
import { View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk'
import RootNavigator from './src/navigation/RootNavigator'
import { ThemeProvider, useTheme } from './src/theme/ThemeContext'
import { ToastProvider } from './src/components/ui'

SplashScreen.preventAutoHideAsync().catch(() => {})
// Sai da splash em fade em vez de corte seco: o fundo dela e o mesmo bg do tema,
// entao a marca dissolve sobre a primeira tela sem pulo de cor.
SplashScreen.setOptions({ duration: 350, fade: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
})

function AppInner({ fontsReady }: { fontsReady: boolean }) {
  const { colors, dark } = useTheme()

  // Esconder a splash no efeito de carregamento das fontes a derrubava antes do
  // primeiro layout do navigator, e o intervalo aparecia como um flash de fundo
  // vazio. Aqui ela so sai depois que a primeira tela ja desenhou.
  const aoDesenhar = useCallback(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {})
  }, [fontsReady])

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={aoDesenhar}>
      <ToastProvider>
        <RootNavigator />
        <StatusBar style={dark ? 'light' : 'dark'} />
      </ToastProvider>
    </View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  })

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AppInner fontsReady={fontsLoaded} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
