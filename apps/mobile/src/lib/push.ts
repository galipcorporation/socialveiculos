// Push notifications (Expo) — permissão, token e registro no backend.
//
// Fluxo: após o login, chamamos registerForPush() → pede permissão, obtém o
// Expo push token e o registra em /v1/notificacoes/dispositivo. No logout,
// unregisterPush() remove o token do backend. O token fica cacheado no
// AsyncStorage para sabermos o que desregistrar mesmo sem re-obter.
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from './api'

const TOKEN_KEY = 'sv-push-token'

// Notificação recebida com o app em primeiro plano: mostra banner + som.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function obterExpoToken(): Promise<string | null> {
  if (!Device.isDevice) return null // simulador não recebe push

  const { status: atual } = await Notifications.getPermissionsAsync()
  let status = atual
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    return data
  } catch {
    return null
  }
}

/** Pede permissão, obtém o token e registra no backend. Silencioso em falha. */
export async function registerForPush(): Promise<void> {
  try {
    const token = await obterExpoToken()
    if (!token) return
    await api.post('/notificacoes/dispositivo', {
      token,
      plataforma: Platform.OS,
    })
    await AsyncStorage.setItem(TOKEN_KEY, token)
  } catch {
    // push é best-effort; nunca quebra o fluxo de login
  }
}

/** Remove o token deste aparelho no backend (logout). */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY)
    if (!token) return
    await api.delete(`/notificacoes/dispositivo?token=${encodeURIComponent(token)}`)
    await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignora — se o backend já não tem, tudo bem
  }
}
