import { Link } from 'react-router-dom'
import type { SitePublicoResponse } from '../lib/api'

export function SiteHeader({ dados }: { dados: SitePublicoResponse }) {
  return (
    <header className="site-header">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {dados.site.logo_url ? (
          <img src={dados.site.logo_url} alt={dados.loja.nome} className="site-header-logo" />
        ) : (
          <span className="site-header-nome">{dados.loja.nome}</span>
        )}
      </Link>
      <nav className="site-header-nav">
        <Link to="/">Início</Link>
        <Link to="/estoque">Estoque</Link>
        <Link to="/contato">Contato</Link>
      </nav>
    </header>
  )
}

export function SiteFooter({ dados }: { dados: SitePublicoResponse }) {
  return (
    <footer className="site-footer">
      © {new Date().getFullYear()} {dados.loja.nome}. Todos os direitos reservados.
    </footer>
  )
}
