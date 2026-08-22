import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface PaginationProps {
  pagina: number
  totalItens: number
  itensPorPagina: number
  onPaginaChange: (novaPagina: number) => void
  onItensPorPaginaChange?: (novoLimite: number) => void
  opcoesItensPorPagina?: number[]
}

export function Pagination({
  pagina,
  totalItens,
  itensPorPagina,
  onPaginaChange,
  onItensPorPaginaChange,
  opcoesItensPorPagina = [10, 15, 25, 50, 100],
}: PaginationProps) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina))
  const inicio = totalItens === 0 ? 0 : (pagina - 1) * itensPorPagina + 1
  const fim = Math.min(totalItens, pagina * itensPorPagina)

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
    <div className="sv-pagination-container">
      <div className="sv-pagination-info">
        <span>
          Mostrando <strong>{inicio.toLocaleString('pt-BR')}</strong> a <strong>{fim.toLocaleString('pt-BR')}</strong> de <strong>{totalItens.toLocaleString('pt-BR')}</strong> registros
        </span>

        {onItensPorPaginaChange && (
          <div className="sv-pagination-limit">
            <label htmlFor="itens-por-pagina">Exibir:</label>
            <select
              id="itens-por-pagina"
              className="sv-pagination-select"
              value={itensPorPagina}
              onChange={(e) => onItensPorPaginaChange(Number(e.target.value))}
            >
              {opcoesItensPorPagina.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / pág.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="sv-pagination-controls">
          <button
            className="btn btn-secondary sv-pagination-btn"
            disabled={pagina <= 1}
            onClick={() => onPaginaChange(1)}
            title="Primeira página"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            className="btn btn-secondary sv-pagination-btn"
            disabled={pagina <= 1}
            onClick={() => onPaginaChange(pagina - 1)}
            title="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="sv-pagination-numbers">
            {gerarPaginas().map((p, idx) =>
              typeof p === 'number' ? (
                <button
                  key={idx}
                  className={`btn sv-pagination-num ${p === pagina ? 'active' : 'btn-secondary'}`}
                  onClick={() => onPaginaChange(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={idx} className="sv-pagination-ellipsis">
                  ...
                </span>
              )
            )}
          </div>

          <button
            className="btn btn-secondary sv-pagination-btn"
            disabled={pagina >= totalPaginas}
            onClick={() => onPaginaChange(pagina + 1)}
            title="Próxima página"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn btn-secondary sv-pagination-btn"
            disabled={pagina >= totalPaginas}
            onClick={() => onPaginaChange(totalPaginas)}
            title="Última página"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
