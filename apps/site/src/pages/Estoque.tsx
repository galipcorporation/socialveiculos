import { useEffect, useState } from 'react'
import { fetchEstoqueLoja, type SitePublicoResponse, type VeiculoB2C } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

function formatBRL(v?: number | null) {
  if (v == null) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function Estoque({ dados }: { dados: SitePublicoResponse }) {
  const [veiculos, setVeiculos] = useState<VeiculoB2C[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v)
      setLoading(false)
    })
  }, [dados.loja.slug])

  return (
    <>
      <SiteHeader dados={dados} />
      <div className="site-container">
        <section className="site-section" style={{ borderTop: 'none' }}>
          <h2 className="site-section-titulo">Nosso Estoque</h2>
          {loading ? (
            <p className="site-empty">Carregando veículos…</p>
          ) : veiculos.length === 0 ? (
            <p className="site-empty">Nenhum veículo disponível no momento.</p>
          ) : (
            <div className="site-estoque-grid">
              {veiculos.map((v) => (
                <div key={v.id} className="site-card">
                  {v.midias?.[0]?.url ? (
                    <img src={v.midias[0].url} alt={`${v.marca} ${v.modelo}`} className="site-card-img" />
                  ) : (
                    <div className="site-card-img" />
                  )}
                  <div className="site-card-body">
                    <div className="site-card-titulo">{v.marca} {v.modelo}</div>
                    <div className="site-card-info">
                      {v.ano_fabricacao}/{v.ano_modelo}
                      {v.km != null && ` · ${v.km.toLocaleString('pt-BR')} km`}
                      {v.cor && ` · ${v.cor}`}
                    </div>
                    {formatBRL(v.preco_venda) && (
                      <div className="site-card-preco">{formatBRL(v.preco_venda)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <SiteFooter dados={dados} />
    </>
  )
}
