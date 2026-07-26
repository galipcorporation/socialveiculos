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
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-var': HTMLAttributes.chave,
        class: 'rich-var',
        contenteditable: 'false',
      }),
      HTMLAttributes.label || HTMLAttributes.chave,
    ]
  },
})

function toEditorHtml(saved: string, labels: Record<string, string>): string {
  return saved.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, chave) => {
    const label = labels[chave] || chave
    return `<span data-var="${chave}" contenteditable="false" class="rich-var">${label}</span>`
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

      let emExecucao = false
      const inserter = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        if (!editor || emExecucao) return
        emExecucao = true
        setTimeout(() => { emExecucao = false }, 300)

        document.getElementById('var-menu')!.classList.remove('open')
        medirAltura()

        editor.chain()
          .focus()
          .insertContent({ type: 'variavel', attrs: { chave: it.chave, label: it.label } })
          .insertContent(' ')
          .run()
      }

      chip.addEventListener('touchend', inserter)
      chip.addEventListener('click', inserter)

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

  const dispararComando = (cmd: string) => {
    if (!editor) return
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
  }

  document.querySelectorAll<HTMLElement>('[data-cmd]').forEach((btn) => {
    const fn = (e: Event) => {
      e.preventDefault()
      dispararComando(btn.dataset.cmd!)
    }
    btn.addEventListener('touchend', fn)
    btn.addEventListener('click', fn)
  })

  const toggleVarMenu = (e: Event) => {
    e.preventDefault()
    document.getElementById('var-menu')!.classList.toggle('open')
    medirAltura()
  }
  const closeVarMenu = (e: Event) => {
    e.preventDefault()
    document.getElementById('var-menu')!.classList.remove('open')
    medirAltura()
  }

  const varBtn = document.getElementById('var-btn')!
  varBtn.addEventListener('touchend', toggleVarMenu)
  varBtn.addEventListener('click', toggleVarMenu)

  const varClose = document.getElementById('var-close')!
  varClose.addEventListener('touchend', closeVarMenu)
  varClose.addEventListener('click', closeVarMenu)

  // Trata toque dentro do editor de texto e seleção de pílula de variável
  const tratarToqueNoEditor = (ev: Event) => {
    const target = ev.target as HTMLElement
    if (target.closest('.re-toolbar') || target.closest('.re-var-menu')) return

    const varEl = target.closest('.rich-var')
    if (varEl && editor) {
      ev.preventDefault()
      try {
        const pos = editor.view.posAtDOM(varEl, 0)
        if (typeof pos === 'number' && pos >= 0) {
          editor.chain().focus().setNodeSelection(pos).run()
          return
        }
      } catch {}
    }

    const pm = document.querySelector<HTMLElement>('.ProseMirror')
    if (pm) {
      pm.focus()
      if (editor && !editor.isFocused) {
        editor.commands.focus()
      }
    }
  }

  const elEditor = document.getElementById('editor')!
  elEditor.addEventListener('touchend', tratarToqueNoEditor)
  elEditor.addEventListener('click', tratarToqueNoEditor)

  observarAltura()
  postToRN({ type: 'ready' })
}

/** Informa a altura real do conteúdo pro lado nativo, que redimensiona a
 *  WebView. A toolbar quebra em 2 linhas em telas estreitas, então a altura
 *  fixa que o RN assumia cortava o fim do editor. */
let medirAltura = () => {}

function observarAltura() {
  const raiz = document.querySelector<HTMLElement>('.rich-editor')!
  let ultima = 0
  medirAltura = () => {
    const h = Math.ceil(raiz.getBoundingClientRect().height)
    if (h > 0 && h !== ultima) {
      ultima = h
      postToRN({ type: 'height', height: h })
    }
  }
  // Observa também os filhos: abrir o menu de variáveis muda a altura por
  // dentro e o observer só na raiz nem sempre dispara a tempo.
  const obs = new ResizeObserver(medirAltura)
  obs.observe(raiz)
  document.querySelectorAll<HTMLElement>('.re-toolbar, .re-var-menu, .re-content')
    .forEach((el) => obs.observe(el))
  medirAltura()
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
