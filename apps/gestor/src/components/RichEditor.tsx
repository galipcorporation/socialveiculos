import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignJustify, Image as ImageIcon,
  Undo2, Redo2, Plus, X,
} from 'lucide-react'

/* ── Catálogo de variáveis (mesmo do backend) ─────────────────── */

export interface VarGroup {
  grupo: string
  itens: { chave: string; label: string }[]
}

/* ── Node custom: pílula de variável ({{chave}}) ──────────────── */

function VariavelComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="rich-var" contentEditable={false} data-var={node.attrs.chave}>
      {node.attrs.label || node.attrs.chave}
    </NodeViewWrapper>
  )
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
    return ['span', mergeAttributes(HTMLAttributes, { 'data-var': HTMLAttributes.chave }), HTMLAttributes.label || HTMLAttributes.chave]
  },
  addNodeView() {
    return ReactNodeViewRenderer(VariavelComponent)
  },
})

/* ── Serialização: HTML do TipTap ⇄ {{chave}} do backend ──────── */

// Converte o HTML salvo (com {{chave}}) em HTML que o TipTap entende (pílulas).
function toEditorHtml(saved: string, labels: Record<string, string>): string {
  return saved.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, chave) => {
    const label = labels[chave] || chave
    return `<span data-var="${chave}">${label}</span>`
  })
}

// Converte o HTML do editor (pílulas) de volta em {{chave}} para o backend.
function toSavedHtml(html: string): string {
  return html.replace(/<span[^>]*data-var="([^"]+)"[^>]*>.*?<\/span>/g, (_m, chave) => `{{${chave}}}`)
}

/* ── Toolbar ──────────────────────────────────────────────────── */

interface RichEditorProps {
  value: string                       // HTML salvo (com {{chave}})
  onChange: (savedHtml: string) => void
  variaveis: VarGroup[]               // catálogo p/ o popover "+ Variável"
  labels: Record<string, string>      // chave → rótulo (p/ pintar as pílulas)
  minHeight?: number
  placeholder?: string
  compact?: boolean                   // toolbar reduzida (cabeçalho/rodapé)
}

export function RichEditor({ value, onChange, variaveis, labels, minHeight = 200, placeholder, compact }: RichEditorProps) {
  const [varMenuOpen, setVarMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef(value)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Variavel,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Digite o texto…' }),
    ],
    content: toEditorHtml(initialRef.current, labels),
    onUpdate: ({ editor }) => onChange(toSavedHtml(editor.getHTML())),
  })

  // Reidrata quando trocar de registro (ex: editar outro modelo) — mas não quando
  // `value` mudou só porque o próprio editor disparou onChange (senão o cursor
  // volta pro início a cada tecla digitada, embaralhando o texto).
  useEffect(() => {
    if (editor && value !== initialRef.current && value !== toSavedHtml(editor.getHTML())) {
      initialRef.current = value
      editor.commands.setContent(toEditorHtml(value, labels))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  // Fecha o popover ao clicar fora.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as any)) setVarMenuOpen(false)
    }
    if (varMenuOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [varMenuOpen])

  const inserirVariavel = useCallback((chave: string, label: string) => {
    editor?.chain().focus().insertContent({ type: 'variavel', attrs: { chave, label } }).run()
    setVarMenuOpen(false)
  }, [editor])

  const inserirImagem = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => editor?.chain().focus().setImage({ src: reader.result as string }).run()
      reader.readAsDataURL(f)
    }
    input.click()
  }, [editor])

  if (!editor) return null

  const Btn = ({ on, onClick, title, children }: any) => (
    <button
      type="button"
      className={`re-tb ${on ? 'on' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
    >
      {children}
    </button>
  )

  return (
    <div className="rich-editor">
      <div className="re-toolbar">
        {!compact && (
          <>
            <select
              className="re-select"
              value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : 'p'}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'p') editor.chain().focus().setParagraph().run()
                else editor.chain().focus().toggleHeading({ level: v === 'h1' ? 1 : 2 }).run()
              }}
            >
              <option value="p">Parágrafo</option>
              <option value="h1">Título 1</option>
              <option value="h2">Título 2</option>
            </select>
            <span className="re-sep" />
          </>
        )}
        <Btn on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold size={15} /></Btn>
        <Btn on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic size={15} /></Btn>
        <Btn on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><UnderlineIcon size={15} /></Btn>
        {!compact && (
          <>
            <span className="re-sep" />
            <Btn on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List size={15} /></Btn>
            <Btn on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={15} /></Btn>
          </>
        )}
        <span className="re-sep" />
        <Btn on={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda"><AlignLeft size={15} /></Btn>
        <Btn on={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar"><AlignCenter size={15} /></Btn>
        <Btn on={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar"><AlignJustify size={15} /></Btn>
        <span className="re-sep" />
        <Btn onClick={inserirImagem} title="Inserir imagem"><ImageIcon size={15} /></Btn>

        {/* + Variável (popover) */}
        <div className="re-var-wrap" ref={menuRef}>
          <button
            type="button"
            className="re-tb re-var-btn"
            onMouseDown={(e) => { e.preventDefault(); setVarMenuOpen((v) => !v) }}
            title="Inserir variável"
          >
            <Plus size={14} /> Variável
          </button>
          {varMenuOpen && (
            <div className="re-var-menu">
              <div className="re-var-menu-head">
                Inserir variável
                <button type="button" className="re-var-close" onClick={() => setVarMenuOpen(false)}><X size={14} /></button>
              </div>
              <div className="re-var-menu-body">
                {variaveis.map((g) => (
                  <div key={g.grupo} className="re-var-group">
                    <div className="re-var-group-label">{g.grupo}</div>
                    <div className="re-var-chips">
                      {g.itens.map((it) => (
                        <button key={it.chave} type="button" className="re-var-chip" onClick={() => inserirVariavel(it.chave, it.label)}>
                          {it.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!compact && (
          <>
            <span className="re-sep" />
            <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo2 size={15} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo2 size={15} /></Btn>
          </>
        )}
      </div>

      <EditorContent editor={editor} className="re-content" style={{ minHeight }} />
    </div>
  )
}
