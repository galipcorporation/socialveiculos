import { Alert, Linking } from 'react-native'

/**
 * Normaliza um telefone BR para o formato aceito por wa.me: só dígitos,
 * com DDI 55. Já aceita números que já vêm com 55 (evita "5555...").
 */
function normalizarNumero(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length > 11) return digitos
  return `55${digitos}`
}

/**
 * Abre o WhatsApp em conversa com `numero`, opcionalmente com uma
 * mensagem pré-preenchida. Único ponto de construção do link wa.me do
 * app — sempre confere `canOpenURL` antes de abrir e avisa o usuário
 * quando o WhatsApp não está instalado.
 */
export async function abrirWhatsapp(numero: string, mensagem?: string): Promise<void> {
  const numeroLimpo = normalizarNumero(numero)
  if (!numeroLimpo) {
    Alert.alert('WhatsApp', 'Número de telefone inválido.')
    return
  }
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  const url = `https://wa.me/${numeroLimpo}${texto}`
  try {
    const ok = await Linking.canOpenURL(url)
    if (ok) {
      await Linking.openURL(url)
    } else {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp. Verifique se ele está instalado.')
    }
  } catch {
    Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp. Verifique se ele está instalado.')
  }
}
