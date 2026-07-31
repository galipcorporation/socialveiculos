import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { radius } from '../theme/tokens'
import { useTheme } from '../theme/ThemeContext'
import { RICH_EDITOR_HTML } from './RichEditorHtml'

export interface VarGroup {
  grupo: string
  itens: { chave: string; label: string }[]
}

interface RichEditorProps {
  value: string                       // HTML salvo (com {{chave}})
  onChange: (savedHtml: string) => void
  variaveis: VarGroup[]               // catálogo p/ o menu "+ Variável"
  labels: Record<string, string>      // chave → rótulo (p/ pintar as pílulas)
  minHeight?: number
  placeholder?: string
  compact?: boolean
  onAddCampoPersonalizado?: (chave: string, label: string) => void
  onRemoveCampoPersonalizado?: (chave: string) => void
}

/** Editor rico de contrato — TipTap embarcado via WebView (mesma serialização
 *  {{chave}} ⇄ pílula de apps/gestor/src/components/RichEditor.tsx). Fonte do
 *  bundle: apps/mobile/webview-editor/src/. */
export function RichEditor({
  value, onChange, variaveis, labels, minHeight = 220, placeholder, compact,
  onAddCampoPersonalizado, onRemoveCampoPersonalizado,
}: RichEditorProps) {
  const { colors } = useTheme()
  const { height: alturaJanela } = useWindowDimensions()
  const webviewRef = useRef<WebView>(null)
  const [pronto, setPronto] = useState(false)

  // O Sheet ocupa no máximo 85% da tela e ainda abriga nome, switch e botão:
  // 55% é o quanto o editor pode tomar sem empurrar o "Salvar" para fora.
  const alturaMaxima = Math.round(alturaJanela * 0.55)

  // As CSS vars do editor eram dark fixas: no tema claro o editor virava um
  // bloco escuro no meio da tela branca. Os nomes espelham `:root` do
  // webview-editor/src/index.html.
  const tema = useMemo(() => ({
    'bg': colors.surface,
    'input-bg': colors.surfaceElevated,
    'text': colors.text,
    'text-dim': colors.textDim,
    'text-muted': colors.textMuted,
    'border': colors.border,
    'primary': colors.primary,
    'primary-text': colors.primary,
    'primary-glow': colors.overlaySoft,
    'overlay-soft': colors.overlaySoft,
    'error': colors.error,
  }), [colors])
  // A toolbar quebra em 2 linhas em telas estreitas: assumir altura fixa cortava
  // o editor e o toque caía fora da área editável (teclado não subia).
  const [alturaConteudo, setAlturaConteudo] = useState(minHeight + 46)
  // Acima do teto o editor rola por dentro; abaixo, quem rola é o Sheet.
  const [atingiuTeto, setAtingiuTeto] = useState(false)
  const valorInicial = useRef(value)
  const ultimoEnviado = useRef(value)

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'ready') {
        setPronto(true)
      } else if (msg.type === 'height') {
        // Teto: sem ele um contrato de duas páginas faz a WebView crescer além
        // da tela, e como o scroll dela está desligado o fim do texto fica
        // inalcançável — o Sheet rola até o fim do painel, não do documento.
        // Acima do teto o editor passa a rolar por dentro.
        setAlturaConteudo(Math.min(msg.height, alturaMaxima))
        setAtingiuTeto(msg.height > alturaMaxima)
      } else if (msg.type === 'change') {
        ultimoEnviado.current = msg.html
        onChange(msg.html)
      } else if (msg.type === 'addCampoPersonalizado') {
        onAddCampoPersonalizado?.(msg.chave, msg.label)
      } else if (msg.type === 'removeCampoPersonalizado') {
        onRemoveCampoPersonalizado?.(msg.chave)
      }
    } catch {
      // mensagem não reconhecida, ignora
    }
  }

  useEffect(() => {
    if (!pronto) return
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'init', value: valorInicial.current, labels, variaveis, placeholder, compact, minHeight, tema,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto])

  // Troca de tema com o editor aberto (o app segue o modo do sistema).
  useEffect(() => {
    if (!pronto) return
    webviewRef.current?.postMessage(JSON.stringify({ type: 'setTema', tema }))
  }, [pronto, tema])

  // Reenvia o catálogo quando os campos personalizados mudam (não reidrata o conteúdo).
  useEffect(() => {
    if (!pronto) return
    webviewRef.current?.postMessage(JSON.stringify({ type: 'setVariaveis', labels, variaveis }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, variaveis])

  // Reidrata o conteúdo só se `value` mudou por fora (ex: trocou de modelo), não
  // quando a própria WebView disparou o onChange (senão o cursor pula pro início).
  useEffect(() => {
    if (!pronto || value === ultimoEnviado.current) return
    ultimoEnviado.current = value
    webviewRef.current?.postMessage(JSON.stringify({ type: 'setContent', value, labels }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pronto])

  return (
    // O editor vive dentro do `Sheet`, que envolve o conteúdo em dois `Pressable`
    // (backdrop + stopPropagation). `Pressable` é um responder e captura o toque
    // no release: sem reivindicar o gesto aqui, o `touchend` morre no Sheet e
    // NADA dentro da WebView responde — nem o texto, nem as pílulas, nem a
    // toolbar. Ser filha não basta quando o pai é responder.
    //
    // Mas reivindicar TODO gesto (o antigo `onStartShouldSetResponder`) matava a
    // rolagem do Sheet. As duas coisas se separam: aceitamos o toque no start e
    // DESISTIMOS assim que ele vira arrasto vertical (`onMoveShouldSetResponder`
    // false + `onResponderTerminationRequest` true), devolvendo o gesto ao
    // ScrollView. Toque curto edita; arrasto rola.
    <View
      style={{ height: alturaConteudo, borderRadius: radius.md, overflow: 'hidden' }}
      onStartShouldSetResponder={() => true}
      // Arrasto não é nosso: deixa o ScrollView do Sheet assumir.
      onMoveShouldSetResponder={() => false}
      // Enquanto o editor rola por dentro, o pai não deve roubar o gesto.
      onResponderTerminationRequest={() => !atingiuTeto}
    >
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: RICH_EDITOR_HTML }}
        onMessage={onMessage}
        style={{ backgroundColor: 'transparent' }}
        // Enquanto cabe, quem rola é o Sheet (uma área rolável só, sem disputa
        // de arrasto). Passando do teto o editor assume o próprio scroll, senão
        // o texto além do limite ficaria inalcançável.
        scrollEnabled={atingiuTeto}
        nestedScrollEnabled
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        androidLayerType="hardware"
        domStorageEnabled
        javaScriptEnabled
        textZoom={100}
        overScrollMode="never"
      />
    </View>
  )
}

