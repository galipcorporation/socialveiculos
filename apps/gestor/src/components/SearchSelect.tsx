import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

export interface SearchSelectOption {
  id: string
  label: string
  sub?: string
}

interface Props {
  label: string
  placeholder?: string
  value: string          // id selecionado
  displayValue: string   // texto exibido no input
  options: SearchSelectOption[]
  onSearch: (q: string) => void
  onSelect: (id: string, label: string) => void
  loading?: boolean
  erro?: boolean
  required?: boolean
  action?: React.ReactNode  // botão "+" opcional ao lado
}

export function SearchSelect({
  label, placeholder, value, displayValue, options, onSearch, onSelect,
  loading, erro, required, action,
}: Props) {
  const [query, setQuery] = useState(displayValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sincroniza query quando displayValue muda externamente
  useEffect(() => { setQuery(displayValue) }, [displayValue])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const erroStyle = erro && !value
    ? { borderColor: 'rgba(239,68,68,0.6)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' }
    : {}

  return (
    <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={ref}>
      <label>{label}{required && ' *'}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="autocomplete-wrapper" style={{ flex: 1, position: 'relative' }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 10, top: 13, color: 'var(--sv-text-dim)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={placeholder || `Buscar ${label.toLowerCase()}...`}
            value={query}
            style={{ width: '100%', paddingLeft: 30, ...erroStyle }}
            onChange={e => {
              setQuery(e.target.value)
              onSearch(e.target.value)
              onSelect('', '')
              setOpen(true)
            }}
            onFocus={() => { onSearch(query); setOpen(true) }}
          />
          {open && options.length > 0 && (
            <div className="autocomplete-dropdown">
              {loading && <div className="autocomplete-item" style={{ color: 'var(--sv-text-dim)', fontSize: 13 }}>Buscando…</div>}
              {options.map(o => (
                <div
                  key={o.id}
                  className="autocomplete-item"
                  onClick={() => {
                    setQuery(o.label)
                    onSelect(o.id, o.label)
                    setOpen(false)
                  }}
                >
                  <span>{o.label}</span>
                  {o.sub && <span style={{ color: 'var(--sv-text-dim)', fontSize: 12, marginLeft: 6 }}>{o.sub}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}
