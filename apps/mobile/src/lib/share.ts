// apps/mobile/src/lib/share.ts
import { Share } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { formatBRL, formatKm } from './format'
import { midiaCapa, type AnuncioVitrine, type Veiculo } from '../services/types'

/**
 * Retorna a URL pública do anúncio na vitrine
 */
export function getVitrineUrl(veiculoId: string): string {
  if (process.env.EXPO_PUBLIC_VITRINE_URL) {
    return `${process.env.EXPO_PUBLIC_VITRINE_URL.replace(/\/$/, '')}/carro/${veiculoId}`
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'
  const baseUrl = apiUrl
    .replace(/:\d+\/v1\/?$/, ':5174')
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '')
  return `${baseUrl}/carro/${veiculoId}`
}

/**
 * Compartilha as informações do veículo com imagem principal e link da vitrine.
 */
export async function compartilharVeiculo(
  veiculo: Veiculo | AnuncioVitrine,
  publicadoNaVitrine?: boolean
): Promise<void> {
  const estaNaVitrine =
    publicadoNaVitrine ??
    ('publicado_marketplace' in veiculo ? !!veiculo.publicado_marketplace : true)

  const linkVitrine = getVitrineUrl(veiculo.id)
  const capa = midiaCapa(veiculo.midias)
  const fotoUrl = capa?.url

  const detalhes = [
    veiculo.km != null ? formatKm(veiculo.km) : null,
    veiculo.cor,
    veiculo.combustivel,
  ]
    .filter(Boolean)
    .join(' · ')

  const versaoStr = veiculo.versao ? ` ${veiculo.versao}` : ''
  const titulo = `${veiculo.marca} ${veiculo.modelo}${versaoStr} ${veiculo.ano_modelo}`
  const precoStr =
    veiculo.preco_venda != null ? formatBRL(veiculo.preco_venda) : 'Sob consulta'

  const linhas = [
    titulo,
    detalhes || null,
    precoStr,
    fotoUrl ? `📷 Foto: ${fotoUrl}` : null,
    '',
    estaNaVitrine
      ? `Confira o veículo na vitrine:\n${linkVitrine}`
      : 'Fale com a gente para saber mais!',
  ].filter((l): l is string => l !== null)

  const message = linhas.join('\n')

  // Se houver foto e o recurso de compartilhamento de arquivo estiver disponível no dispositivo
  if (fotoUrl && (await Sharing.isAvailableAsync())) {
    try {
      let localUri = fotoUrl
      if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
        const fileExt = fotoUrl.split('.').pop()?.split('?')[0] || 'jpg'
        const filename = `veiculo_${veiculo.id}.${fileExt}`
        const targetPath = `${FileSystem.cacheDirectory}${filename}`

        const downloadResult = await FileSystem.downloadAsync(fotoUrl, targetPath)
        localUri = downloadResult.uri
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'image/jpeg',
        dialogTitle: `Compartilhar ${titulo}`,
      })
      return
    } catch {
      // Se o compartilhamento nativo de arquivo falhar, cai no fallback de texto
    }
  }

  // Fallback para o diálogo nativo do React Native com texto, foto e link
  await Share.share(
    {
      message,
      url: estaNaVitrine ? linkVitrine : fotoUrl,
      title: titulo,
    },
    {
      dialogTitle: `Compartilhar ${titulo}`,
    }
  ).catch(() => {})
}
