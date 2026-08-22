import { Link } from 'react-router-dom'
import type { SitePublicoResponse } from '../lib/api'

export function SiteHeader({ dados }: { dados: SitePublicoResponse }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
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
          {dados.site.sobre_texto && <Link to="/sobre">Sobre</Link>}
          <Link to="/financiamento">Financiamento</Link>
          <Link to="/contato">Contato</Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter({ dados }: { dados: SitePublicoResponse }) {
  return (
    <footer className="site-footer">
      <div className="site-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{dados.loja.nome}</div>
          {dados.loja.cidade && (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>
              {dados.loja.cidade}{dados.loja.estado ? ` - ${dados.loja.estado}` : ''}
              {dados.loja.whatsapp && ` · WhatsApp: ${dados.loja.whatsapp}`}
            </div>
          )}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, textAlign: 'right' }}>
          © {new Date().getFullYear()} {dados.loja.nome}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
