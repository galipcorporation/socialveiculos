import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { useQuery } from '@tanstack/react-query'
import { AppHeader, ErrorState, Screen } from '../../components/ui'
import { contratosService } from '../../services'
import { extractErrorDetails } from '../../lib/api'
import { useTheme } from '../../theme/ThemeContext'
import type { RootScreenProps } from '../../navigation/types'

// O documento vem do backend com layout de folha (fundo branco, texto preto):
// ele é impresso/assinado, então não segue o tema do app. `baseUrl` faz o
// logotipo e demais imagens com caminho relativo resolverem contra a API.
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/v1'

function origemDaApi(): string {
  const semBarra = API_BASE.replace(/\/+$/, '')
  const fim = semBarra.indexOf('/', semBarra.indexOf('//') + 2)
  return fim === -1 ? semBarra : semBarra.slice(0, fim)
}

/**
 * Visualizador do contrato dentro do app.
 *
 * A rota `/contratos/{id}/pdf` é autenticada (Bearer + X-Loja-Id): abrir a URL
 * no navegador do celular só mostrava o 401 da API. Aqui o HTML chega pelo
 * cliente autenticado e é renderizado numa WebView, sem depender do navegador.
 */
export default function ContratoDocumentoScreen({ route }: RootScreenProps<'ContratoDocumento'>) {
  const { colors } = useTheme()
  const { contratoId, numero } = route.params

  const q = useQuery({
    queryKey: ['contrato-documento', contratoId],
    queryFn: () => contratosService.documentoHtml(contratoId),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title={numero ? `Contrato ${numero}` : 'Contrato'} large={false} back />
      {q.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : q.isError ? (
        <ErrorState message={extractErrorDetails(q.error).message} onRetry={() => q.refetch()} />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: q.data ?? '', baseUrl: origemDaApi() }}
          style={{ flex: 1, backgroundColor: '#fff' }}
          javaScriptEnabled
          domStorageEnabled
          androidLayerType="hardware"
          // Documento de leitura: pinça para ampliar as cláusulas, sem o zoom
          // automático do Android encolhendo a folha.
          setBuiltInZoomControls
          displayZoomControls={false}
          scalesPageToFit
        />
      )}
    </Screen>
  )
}
