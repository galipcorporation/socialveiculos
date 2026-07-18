import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  minWidth?: string
}

export function SelectField({ label, value, options, onChange, placeholder, minWidth }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="form-group" style={{ minWidth, position: 'relative' }}>
      <label>{label}</label>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="filter-select-btn"
        >
          <span>{current?.label ?? placeholder ?? 'Selecione'}</span>
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
          <div className="status-dropdown" style={{ left: 0, right: 'auto', minWidth: '100%', maxHeight: '260px', overflowY: 'auto' }}>
            {options.map(opt => (
              <button
                key={opt.value || '__empty'}
                type="button"
                className={`status-option ${opt.value === value ? 'active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false) }}
              >
                {opt.label}
                {opt.value === value && (
                  <svg className="status-check" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
