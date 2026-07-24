import React, { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { radius } from '../theme/tokens'
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
  const webviewRef = useRef<WebView>(null)
  const [pronto, setPronto] = useState(false)
  // A toolbar quebra em 2 linhas em telas estreitas: assumir altura fixa cortava
  // o editor e o toque caía fora da área editável (teclado não subia).
  const [alturaConteudo, setAlturaConteudo] = useState(minHeight + 46)
  const valorInicial = useRef(value)
  const ultimoEnviado = useRef(value)

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'ready') {
        setPronto(true)
      } else if (msg.type === 'height') {
        setAlturaConteudo(msg.height)
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
      type: 'init', value: valorInicial.current, labels, variaveis, placeholder, compact, minHeight,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto])

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
    <View style={{ height: alturaConteudo, borderRadius: radius.md, overflow: 'hidden' }}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: RICH_EDITOR_HTML }}
        onMessage={onMessage}
        style={{ backgroundColor: 'transparent' }}
        // A WebView cresce junto com o conteúdo; quem rola é o Sheet. Scroll
        // interno aqui disputava o gesto com o ScrollView pai e escondia o
        // fim do editor.
        scrollEnabled={false}
        nestedScrollEnabled={false}
        hideKeyboardAccessoryView
        // iOS: permite que `editor.commands.focus()` abra o teclado sem um
        // toque direto no contenteditable.
        keyboardDisplayRequiresUserAction={false}
      />
    </View>
  )
}
