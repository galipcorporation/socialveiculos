import { Link } from 'react-router-dom'
import { ThemeConfig } from '../lib/theme'
import '../styles/site-footer.css'

interface SiteFooterProps {
  config: ThemeConfig
}

export function SiteFooter({ config }: SiteFooterProps) {
  const { tipo, paleta, logo, footerText } = config
  const currentYear = new Date().getFullYear()

  return (
    <footer className="vt-footer" style={{ backgroundColor: paleta?.background || '#f5f5f5' }}>
      <div className="vt-footer-content">
        {tipo === 'white-label' && (
          <div className="vt-footer-section">
            {logo && <img src={logo} alt="Logo" className="vt-footer-logo" />}
            {footerText && <p className="vt-footer-about">{footerText}</p>}
          </div>
        )}

        <div className="vt-footer-section">
          <h4 style={{ color: paleta?.primary || '#0066cc' }}>Navegação</h4>
          <ul>
            <li>
              <Link to="/">Estoque</Link>
            </li>
            {tipo === 'white-label' && (
              <>
                <li>
                  <Link to="/sobre">Sobre</Link>
                </li>
                <li>
                  <Link to="/contato">Contato</Link>
                </li>
              </>
            )}
            <li>
              <Link to="/termos">Termos</Link>
            </li>
            <li>
              <Link to="/privacidade">Privacidade</Link>
            </li>
          </ul>
        </div>

        {tipo === 'marketplace' && (
          <div className="vt-footer-section">
            <h4 style={{ color: paleta?.primary || '#0066cc' }}>Sobre</h4>
            <ul>
              <li>
                <Link to="/anuncie">Anuncie aqui</Link>
              </li>
              <li>
                <a href="mailto:suporte@socialveiculos.com.br">Suporte</a>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div
        className="vt-footer-bottom"
        style={{ borderTopColor: paleta?.primary || '#0066cc' }}
      >
        <p>
          © {currentYear} {tipo === 'white-label' ? 'Social Veículos' : 'Social Veículos'}. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  )
}
