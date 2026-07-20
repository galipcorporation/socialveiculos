import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const updateCoords = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width })
    }
    updateCoords()
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', updateCoords, true)
    window.addEventListener('resize', updateCoords)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
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

        {open && createPortal(
          <div
            className="status-dropdown"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              right: 'auto',
              minWidth: coords.width,
              maxHeight: '260px',
              overflowY: 'auto',
              zIndex: 1000,
            }}
          >
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
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
