import type { SitePublicoResponse } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

export function Sobre({ dados }: { dados: SitePublicoResponse }) {
  const { site, loja } = dados
  const local = [loja.cidade, loja.estado].filter(Boolean).join(' - ')

  return (
    <>
      <SiteHeader dados={dados} />
      <div className="site-container">
        <section className="site-section" style={{ borderTop: 'none' }}>
          <h2 className="site-section-titulo">Sobre {loja.nome}</h2>
          {site.sobre_texto ? (
            <p>{site.sobre_texto}</p>
          ) : (
            <p className="site-empty">Loja ainda não adicionou uma descrição.</p>
          )}
          <ul style={{ marginTop: 24, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {local && <li>📍 {local}</li>}
            {loja.verificada && <li>✅ Loja verificada</li>}
            {typeof loja.total_veiculos === 'number' && (
              <li>🚗 {loja.total_veiculos} veículo(s) disponível(is)</li>
            )}
            {loja.whatsapp && <li>📞 {loja.whatsapp}</li>}
          </ul>
        </section>
      </div>
      <SiteFooter dados={dados} />
    </>
  )
}
