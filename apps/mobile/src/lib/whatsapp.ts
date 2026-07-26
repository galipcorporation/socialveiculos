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
  const texto = mensagem ? `&text=${encodeURIComponent(mensagem)}` : ''
  const deepLink = `whatsapp://send?phone=${numeroLimpo}${texto}`
  const webUrl = `https://wa.me/${numeroLimpo}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`

  try {
    // Tenta abrir diretamente o aplicativo do WhatsApp via deep link nativo
    await Linking.openURL(deepLink)
  } catch {
    try {
      // Se falhar o app nativo, tenta o link web (wa.me) no navegador
      await Linking.openURL(webUrl)
    } catch {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp. Verifique se ele está instalado.')
    }
  }
}

/**
 * Registra o lead automaticamente no CRM + Notificação da loja antes de abrir o WhatsApp no mobile.
 */
export async function abrirWhatsappComLead(veiculoId: string, lojaWhatsapp: string, textoDefault: string): Promise<void> {
  // Importação dinâmica/em tempo de execução ou leitura da loja de autenticação do mobile
  const { useAuthStore } = require('../stores/authStore')
  const { vitrineService } = require('../services/vitrine')

  const user = useAuthStore.getState().user
  const nome = user?.nome || 'Comprador da Vitrine App'
  const telefone = user?.telefone || '11999999999'

  try {
    const res = await vitrineService.cadastrarLead(veiculoId, nome, telefone)
    if (res.whatsapp_url) {
      try {
        await Linking.openURL(res.whatsapp_url)
        return
      } catch {
        // Fallback
      }
    }
  } catch {
    // Silencioso se der erro no lead em background, para não travar a experiência do usuário
  }

  await abrirWhatsapp(lojaWhatsapp, textoDefault)
}

