import React from 'react'

export interface PaginationProps {
  pagina: number
  totalItens: number
  itensPorPagina: number
  onPaginaChange: (novaPagina: number) => void
  totalPaginas?: number
  compacto?: boolean
  nomeEntidade?: string
}

export function Pagination({
  pagina,
  totalItens,
  itensPorPagina,
  onPaginaChange,
  totalPaginas: totalPaginasProp,
  compacto = false,
  nomeEntidade = 'itens',
}: PaginationProps) {
  const totalPaginas = totalPaginasProp ?? Math.max(1, Math.ceil(totalItens / itensPorPagina))
  const inicio = totalItens === 0 ? 0 : (pagina - 1) * itensPorPagina + 1
  const fim = Math.min(totalItens, pagina * itensPorPagina)

  if (totalItens <= 0 && totalPaginas <= 1) return null

  const gerarPaginas = () => {
    const paginas: (number | string)[] = []
    const maxVisiveis = 5

    if (totalPaginas <= maxVisiveis) {
      for (let i = 1; i <= totalPaginas; i++) paginas.push(i)
    } else {
      paginas.push(1)
      let inicioJanela = Math.max(2, pagina - 1)
      let fimJanela = Math.min(totalPaginas - 1, pagina + 1)

      if (pagina <= 3) {
        inicioJanela = 2
        fimJanela = 4
      } else if (pagina >= totalPaginas - 2) {
        inicioJanela = totalPaginas - 3
        fimJanela = totalPaginas - 1
      }

      if (inicioJanela > 2) paginas.push('...')

      for (let i = inicioJanela; i <= fimJanela; i++) {
        paginas.push(i)
      }

      if (fimJanela < totalPaginas - 1) paginas.push('...')
      paginas.push(totalPaginas)
    }
    return paginas
  }

  return (
    <div
      className="pagination"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: compacto ? '6px 0' : '10px 0',
      }}
    >
      <div className="pagination-info" style={{ fontSize: '13px', color: 'var(--sv-text-muted)' }}>
        Mostrando <strong>{inicio}</strong>–<strong>{fim}</strong> de <strong>{totalItens}</strong> {nomeEntidade}
      </div>

      {totalPaginas > 1 && (
        <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="pagination-btn"
            disabled={pagina <= 1}
            onClick={() => onPaginaChange(pagina - 1)}
            title="Página anterior"
          >
            ‹
          </button>

          {gerarPaginas().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                type="button"
                className={`pagination-btn ${pagina === p ? 'active' : ''}`}
                onClick={() => onPaginaChange(p)}
              >
                {p}
              </button>
            ) : (
              <span key={idx} style={{ padding: '0 4px', color: 'var(--sv-text-muted)', fontSize: '12px' }}>
                ...
              </span>
            )
          )}

          <button
            type="button"
            className="pagination-btn"
            disabled={pagina >= totalPaginas}
            onClick={() => onPaginaChange(pagina + 1)}
            title="Próxima página"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
