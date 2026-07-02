import { useState, useRef, useEffect } from 'react'

const STATUS_CONFIG = {
  disponivel: { label: 'Disponível', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)' },
  reservado:  { label: 'Reservado',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  vendido:    { label: 'Vendido',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)' },
  repasse:    { label: 'Repasse',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  inativo:    { label: 'Inativo',    color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.2)' },
} as const

type Status = keyof typeof STATUS_CONFIG

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function StatusSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = STATUS_CONFIG[value as Status] ?? STATUS_CONFIG.disponivel

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="status-select-root" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="status-chip-btn"
        style={{
          background: current.bg,
          color: current.color,
          border: `1px solid ${current.border}`,
        }}
      >
        {current.label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10" height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="status-dropdown">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              className={`status-option ${key === value ? 'active' : ''}`}
              onClick={() => { onChange(key); setOpen(false) }}
              style={{ '--opt-color': cfg.color, '--opt-bg': cfg.bg } as React.CSSProperties}
            >
              <span className="status-dot" style={{ background: cfg.color }} />
              {cfg.label}
              {key === value && (
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
