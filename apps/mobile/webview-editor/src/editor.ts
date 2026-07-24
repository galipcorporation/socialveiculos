// Editor de contrato embarcado na WebView do app mobile — TipTap "vanilla"
// (sem @tiptap/react, que é DOM/React específico). Espelha
// apps/gestor/src/components/RichEditor.tsx: mesma serialização {{chave}} ⇄
// pílula, mesmo node customizado `variavel`.
import { Editor, Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'

interface VarItem { chave: string; label: string }
interface VarGroup { grupo: string; itens: VarItem[] }

interface InitMessage {
  type: 'init'
  value: string
  labels: Record<string, string>
  variaveis: VarGroup[]
  placeholder?: string
  compact?: boolean
  minHeight?: number
}

const Variavel = Node.create({
  name: 'variavel',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      chave: { default: '' },
      label: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-var]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-var': HTMLAttributes.chave, class: 'rich-var' }), HTMLAttributes.label || HTMLAttributes.chave]
  },
})

function toEditorHtml(saved: string, labels: Record<string, string>): string {
  return saved.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, chave) => {
    const label = labels[chave] || chave
    return `<span data-var="${chave}">${label}</span>`
  })
}

function toSavedHtml(html: string): string {
  return html.replace(/<span[^>]*data-var="([^"]+)"[^>]*>.*?<\/span>/g, (_m, chave) => `{{${chave}}}`)
}

function postToRN(payload: unknown) {
  // @ts-expect-error injetado pelo react-native-webview
  window.ReactNativeWebView?.postMessage(JSON.stringify(payload))
}

let editor: Editor | null = null
let currentLabels: Record<string, string> = {}

function montarToolbar(compact: boolean) {
  document.querySelectorAll<HTMLElement>('[data-compact-hide]').forEach((el) => {
    el.style.display = compact ? 'none' : ''
  })
}

function atualizarBotoesAtivos() {
  const ed = editor
  if (!ed) return
  document.querySelectorAll<HTMLElement>('[data-cmd]').forEach((btn) => {
    const cmd = btn.dataset.cmd!
    let ativo = false
    if (cmd === 'bold') ativo = ed.isActive('bold')
    else if (cmd === 'italic') ativo = ed.isActive('italic')
    else if (cmd === 'strike') ativo = ed.isActive('strike')
    else if (cmd === 'bulletList') ativo = ed.isActive('bulletList')
    else if (cmd === 'orderedList') ativo = ed.isActive('orderedList')
    else if (cmd === 'alignLeft') ativo = ed.isActive({ textAlign: 'left' })
    else if (cmd === 'alignCenter') ativo = ed.isActive({ textAlign: 'center' })
    else if (cmd === 'alignJustify') ativo = ed.isActive({ textAlign: 'justify' })
    else if (cmd === 'table') ativo = ed.isActive('table')
    btn.classList.toggle('on', ativo)
  })
}

function renderVariaveis(grupos: VarGroup[]) {
  const body = document.getElementById('var-menu-body')!
  body.innerHTML = ''
  for (const g of grupos) {
    const wrap = document.createElement('div')
    wrap.className = 're-var-group'
    const label = document.createElement('div')
    label.className = 're-var-group-label'
    label.textContent = g.grupo
    wrap.appendChild(label)
    const chips = document.createElement('div')
    chips.className = 're-var-chips'
    const isPersonalizado = g.grupo === 'Personalizados deste modelo'
    for (const it of g.itens) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 're-var-chip' + (isPersonalizado ? ' custom' : '')
      chip.textContent = it.label
      chip.onclick = () => {
        editor?.chain().focus().insertContent({ type: 'variavel', attrs: { chave: it.chave, label: it.label } }).run()
        document.getElementById('var-menu')!.classList.remove('open')
      }
      if (isPersonalizado) {
        const rm = document.createElement('span')
        rm.className = 'rm'
        rm.textContent = '×'
        rm.onclick = (e) => {
          e.stopPropagation()
          postToRN({ type: 'removeCampoPersonalizado', chave: it.chave })
        }
        chip.appendChild(rm)
      }
      chips.appendChild(chip)
    }
    wrap.appendChild(chips)

    if (isPersonalizado || g === grupos[grupos.length - 1]) {
      const add = document.createElement('div')
      add.className = 're-var-add'
      const inputChave = document.createElement('input')
      inputChave.placeholder = 'chave (garantia_meses)'
      const inputLabel = document.createElement('input')
      inputLabel.placeholder = 'rótulo (Meses de garantia)'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 're-var-add-btn'
      btn.textContent = '+'
      btn.onclick = () => {
        const chave = inputChave.value.trim()
        const label = inputLabel.value.trim()
        if (!chave || !label) return
        postToRN({ type: 'addCampoPersonalizado', chave, label })
        inputChave.value = ''
        inputLabel.value = ''
      }
      add.append(inputChave, inputLabel, btn)
      wrap.appendChild(add)
    }
    body.appendChild(wrap)
  }
}

function iniciar(msg: InitMessage) {
  currentLabels = msg.labels
  if (msg.minHeight) {
    document.documentElement.style.setProperty('--min-content', `${msg.minHeight}px`)
  }
  montarToolbar(!!msg.compact)
  renderVariaveis(msg.variaveis)

  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit,
      Variavel,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: msg.placeholder || 'Digite o texto…' }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: toEditorHtml(msg.value, msg.labels),
    onUpdate: ({ editor: ed }) => {
      postToRN({ type: 'change', html: toSavedHtml(ed.getHTML()) })
    },
    onSelectionUpdate: atualizarBotoesAtivos,
    onTransaction: atualizarBotoesAtivos,
  })

  document.querySelectorAll<HTMLElement>('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!editor) return
      const cmd = btn.dataset.cmd!
      const chain = editor.chain().focus()
      switch (cmd) {
        case 'bold': chain.toggleBold().run(); break
        case 'italic': chain.toggleItalic().run(); break
        case 'strike': chain.toggleStrike().run(); break
        case 'bulletList': chain.toggleBulletList().run(); break
        case 'orderedList': chain.toggleOrderedList().run(); break
        case 'alignLeft': chain.setTextAlign('left').run(); break
        case 'alignCenter': chain.setTextAlign('center').run(); break
        case 'alignJustify': chain.setTextAlign('justify').run(); break
        case 'table': chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break
        case 'undo': chain.undo().run(); break
        case 'redo': chain.redo().run(); break
      }
      atualizarBotoesAtivos()
    })
  })

  document.getElementById('var-btn')!.addEventListener('click', () => {
    document.getElementById('var-menu')!.classList.toggle('open')
  })
  document.getElementById('var-close')!.addEventListener('click', () => {
    document.getElementById('var-menu')!.classList.remove('open')
  })

  // Tocar em qualquer ponto da área de conteúdo abre o teclado. Sem isso, o
  // toque no padding (fora da caixa do ProseMirror) não foca nada e o teclado
  // nunca sobe — que é como o editor parecia "morto" no celular.
  document.getElementById('editor')!.addEventListener('pointerdown', (ev) => {
    if (!editor || editor.isFocused) return
    // Só trata o toque em área vazia; dentro do texto o próprio ProseMirror
    // posiciona o cursor onde o dedo caiu.
    if ((ev.target as HTMLElement).closest('.ProseMirror')) return
    ev.preventDefault()
    // Foca o nó do DOM primeiro: em WebView o `focus()` do elemento é o que
    // efetivamente abre o teclado; o comando do TipTap só posiciona o cursor.
    document.querySelector<HTMLElement>('.ProseMirror')?.focus()
    editor.commands.focus('end')
  })

  observarAltura()
  postToRN({ type: 'ready' })
}

/** Informa a altura real do conteúdo pro lado nativo, que redimensiona a
 *  WebView. A toolbar quebra em 2 linhas em telas estreitas, então a altura
 *  fixa que o RN assumia cortava o fim do editor. */
function observarAltura() {
  const raiz = document.querySelector<HTMLElement>('.rich-editor')!
  let ultima = 0
  const medir = () => {
    const h = Math.ceil(raiz.getBoundingClientRect().height)
    if (h > 0 && h !== ultima) {
      ultima = h
      postToRN({ type: 'height', height: h })
    }
  }
  new ResizeObserver(medir).observe(raiz)
  medir()
}

window.addEventListener('message', (ev) => {
  handleMessage(ev.data)
})
// Android entrega a mensagem em document, não em window.
document.addEventListener('message', ((ev: any) => handleMessage(ev.data)) as EventListener)

function handleMessage(raw: unknown) {
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (msg.type === 'init') {
      iniciar(msg)
    } else if (msg.type === 'setVariaveis') {
      currentLabels = msg.labels
      renderVariaveis(msg.variaveis)
    } else if (msg.type === 'setContent') {
      if (editor) editor.commands.setContent(toEditorHtml(msg.value, currentLabels))
    }
  } catch {
    // mensagem não reconhecida, ignora
  }
}
