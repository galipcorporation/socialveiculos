import React from 'react'
import { Link } from 'react-router-dom'

/** Casca comum das páginas institucionais (Sobre, Termos, Privacidade, Anuncie). */
export function InstitucionalLayout({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <div className="vt-institucional">
      <Link to="/" className="vt-inst-back">← Voltar ao feed</Link>
      <h1>{titulo}</h1>
      {subtitulo && <p className="vt-inst-sub">{subtitulo}</p>}
      {children}
    </div>
  )
}
