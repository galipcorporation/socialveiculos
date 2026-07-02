import type { ReactNode } from 'react'

/** Página de módulo cujo backend ainda não existe — estado honesto, sem dados falsos. */
export function ModuloEmBreve({ titulo, descricao, icon }: { titulo: string; descricao: string; icon?: ReactNode }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>
      <div className="empty-state" style={{ maxWidth: 560 }}>
        {icon}
        <h3 style={{ marginTop: 12 }}>Em desenvolvimento</h3>
        <p>Este módulo ainda não está disponível. Você será avisado assim que ele entrar no ar.</p>
      </div>
    </div>
  )
}

