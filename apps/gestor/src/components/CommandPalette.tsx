import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { parseModulos, podeAcessarModulo, type ModuloKey } from '../lib/modulos'

interface PaletteItem {
  path: string
  label: string
  modulo?: ModuloKey
}

const ALL_ITEMS: PaletteItem[] = [
  { path: '/', label: 'Dashboards' },
  { path: '/rede-social', label: 'Rede Social' },
  { path: '/crm', label: 'Clientes (CRM)', modulo: 'crm' },
  { path: '/estoque', label: 'Estoque', modulo: 'estoque' },
  { path: '/pos-venda', label: 'Pós-venda' },
  { path: '/financeiro', label: 'Financeiro', modulo: 'financeiro' },
  { path: '/minhas-comissoes', label: 'Minhas Comissões' },
  { path: '/aprovacoes', label: 'Aprovações' },
  { path: '/equipe', label: 'Equipe' },
  { path: '/ferramentas', label: 'Ferramentas' },
  { path: '/ferramentas/simulador', label: 'Simulador de Crédito', modulo: 'simulador' },
  { path: '/ferramentas/contratos', label: 'Contratos', modulo: 'contratos' },
  { path: '/ferramentas/marketing', label: 'Marketing', modulo: 'marketing' },
  { path: '/ferramentas/fipe', label: 'Consulta FIPE' },
  { path: '/assistente', label: 'Assistente IA', modulo: 'assistente_ia' },
  { path: '/ferramentas/notas-fiscais', label: 'Notas Fiscais', modulo: 'fiscal' },
  { path: '/ferramentas/meu-site', label: 'Meu Site', modulo: 'site' },
  { path: '/configuracoes', label: 'Configurações' },
  { path: '/ajuda', label: 'Ajuda' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key === 'k' || e.key === 'K'
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo(() => {
    const modulos = parseModulos(user?.modulos)
    const isAdmin = user?.papel === 'admin_plataforma'
    const visible = ALL_ITEMS.filter((item) => {
      if (isAdmin) return item.path === '/'
      if (!item.modulo) return true
      return podeAcessarModulo(user?.papel, modulos, item.modulo)
    })
    if (!query.trim()) return visible
    const q = query.trim().toLowerCase()
    return visible.filter((item) => item.label.toLowerCase().includes(q))
  }, [query, user])

  if (!open) return null

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div
      className="command-palette-overlay"
      onClick={() => setOpen(false)}
    >
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Buscar uma seção ou funcionalidade..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelected((s) => Math.min(s + 1, items.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelected((s) => Math.max(s - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const item = items[selected]
              if (item) go(item.path)
            }
          }}
        />
        <div className="command-palette-list">
          {items.length === 0 && (
            <div className="command-palette-empty">Nenhum resultado encontrado.</div>
          )}
          {items.map((item, idx) => (
            <div
              key={item.path}
              className={`command-palette-item ${idx === selected ? 'active' : ''}`}
              onMouseEnter={() => setSelected(idx)}
              onClick={() => go(item.path)}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
