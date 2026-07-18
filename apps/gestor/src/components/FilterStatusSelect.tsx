import { useState, useRef, useEffect } from 'react'

const OPTIONS: { value: string; label: string; color?: string }[] = [
  { value: '', label: 'Todos os Status' },
  { value: 'disponivel', label: 'Disponível', color: '#4ade80' },
  { value: 'reservado', label: 'Reservado', color: '#fb923c' },
  { value: 'vendido', label: 'Vendido', color: '#94a3b8' },
  { value: 'repasse', label: 'Repasse', color: '#a78bfa' },
  { value: 'inativo', label: 'Inativo', color: '#64748b' },
  { value: 'rascunho', label: 'Rascunho (não finalizados)', color: '#facc15' },
]

interface Props {
  value: string
  onChange: (value: string) => void
}

export function FilterStatusSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = OPTIONS.find(o => o.value === value) ?? OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="filter-select-root" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="filter-select-btn"
      >
        {current.color && <span className="status-dot" style={{ background: current.color }} />}
        <span>{current.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="status-dropdown" style={{ left: 0, right: 'auto', minWidth: '100%' }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.value || 'all'}
              type="button"
              className={`status-option ${opt.value === value ? 'active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={opt.color ? ({ '--opt-color': opt.color, '--opt-bg': `${opt.color}1f` } as React.CSSProperties) : undefined}
            >
              {opt.color ? <span className="status-dot" style={{ background: opt.color }} /> : <span className="status-dot" style={{ background: 'transparent' }} />}
              {opt.label}
              {opt.value === value && (
                <svg className="status-check" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
