import { useSiteConfig } from '../lib/SiteContext'
import { api } from '../lib/api'
import { useState, useEffect } from 'react'
import '../styles/sobre-white-label.css'

interface LojaInfo {
  id: string
  nome: string
  slug: string
  logo_url?: string
  cidade: string
  estado: string
  descricao?: string
  verificada: boolean
  total_veiculos: number
  whatsapp?: string
}

export function SobreWhiteLabel() {
  const { isWhiteLabel, lojaId, config } = useSiteConfig()
  const [loja, setLoja] = useState<LojaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isWhiteLabel || !lojaId) {
      setLoading(false)
      return
    }

    api.get<LojaInfo>(`/marketplace/lojas/${lojaId}`)
      .then(setLoja)
      .catch((err) => console.error('Erro ao carregar info da loja:', err))
      .finally(() => setLoading(false))
  }, [isWhiteLabel, lojaId])

  if (!isWhiteLabel) {
    return (
      <div className="sobre-container">
        <div className="sobre-header">
          <h1>Sobre o Social Veículos</h1>
        </div>
        <div className="sobre-content">
          <p>O maior marketplace de veículos com lojas verificadas.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="sobre-container">Carregando...</div>
  }

  if (!loja) {
    return <div className="sobre-container">Loja não encontrada</div>
  }

  return (
    <div className="sobre-container">
      <div
        className="sobre-header"
        style={{ backgroundColor: config?.paleta?.primary || '#0066cc', color: '#fff' }}
      >
        {loja.logo_url && <img src={loja.logo_url} alt={loja.nome} className="sobre-logo" />}
        <h1>{loja.nome}</h1>
        {loja.verificada && <span className="sobre-verificada">✓ Verificada</span>}
      </div>

      <div className="sobre-content">
        <div className="sobre-info-grid">
          <div className="sobre-info-item">
            <span className="sobre-label">Localização</span>
            <p>
              {loja.cidade}, {loja.estado}
            </p>
          </div>
          <div className="sobre-info-item">
            <span className="sobre-label">Veículos em estoque</span>
            <p>{loja.total_veiculos}</p>
          </div>
          {loja.whatsapp && (
            <div className="sobre-info-item">
              <span className="sobre-label">WhatsApp</span>
              <a href={`https://wa.me/${loja.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                {loja.whatsapp}
              </a>
            </div>
          )}
        </div>

        {loja.descricao && (
          <div className="sobre-descricao">
            <h2>Sobre</h2>
            <p>{loja.descricao}</p>
          </div>
        )}

        {config?.footerText && (
          <div className="sobre-extra">
            <h2>Informações Adicionais</h2>
            <p>{config.footerText}</p>
          </div>
        )}

        <div className="sobre-cta">
          <a href="/" className="sobre-button" style={{ backgroundColor: config?.paleta?.primary || '#0066cc' }}>
            Ver estoque completo
          </a>
        </div>
      </div>
    </div>
  )
}
