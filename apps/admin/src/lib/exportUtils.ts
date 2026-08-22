/**
 * Utilitário para exportação de dados em CSV no navegador com suporte a UTF-8 BOM.
 */

export interface ExportColumn<T> {
  header: string
  accessor: (item: T) => string | number | boolean | null | undefined
}

export function exportarParaCSV<T>(
  filename: string,
  data: T[],
  columns: ExportColumn<T>[]
) {
  if (!data || data.length === 0) return

  // Cabeçalho CSV
  const headerRow = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(';')

  // Linhas de dados
  const bodyRows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.accessor(row)
        if (val == null) return '""'
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      })
      .join(';')
  )

  // Conteúdo com BOM UTF-8 (\uFEFF) para garantir abertura correta no Excel / PT-BR
  const csvContent = '\uFEFF' + [headerRow, ...bodyRows].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
