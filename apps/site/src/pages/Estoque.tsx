import { useEffect, useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { fetchEstoqueLoja, type SitePublicoResponse, type VeiculoB2C } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

function formatBRL(v?: number | null) {
  if (v == null) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function estoqueJsonLd(veiculos: VeiculoB2C[]) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    itemListElement: veiculos.map((v, i) => ({
      '@type': 'Vehicle',
      position: i + 1,
      name: `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''} ${v.ano_modelo}`,
      image: v.midias?.[0]?.url || undefined,
      brand: { '@type': 'Brand', name: v.marca },
      model: v.modelo,
      vehicleModelDate: String(v.ano_modelo),
      mileageFromOdometer: v.km != null ? { '@type': 'QuantitativeValue', value: v.km, unitCode: 'KMT' } : undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: v.preco_venda ?? undefined,
        availability: 'https://schema.org/InStock',
      },
    })),
  }
}

export function Estoque({ dados }: { dados: SitePublicoResponse }) {
  const [veiculos, setVeiculos] = useState<VeiculoB2C[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [marca, setMarca] = useState('')
  const [faixaPreco, setFaixaPreco] = useState('')
  const [anoMin, setAnoMin] = useState('')
  const [ordenacao, setOrdenacao] = useState<'menor_preco' | 'maior_preco' | 'recentes' | 'menor_km'>('recentes')

  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dados.loja.slug])

  // Marcas únicas
  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    veiculos.forEach((v) => { if (v.marca) set.add(v.marca) })
    return Array.from(set).sort()
  }, [veiculos])

  // Filtros aplicados
  const veiculosFiltrados = useMemo(() => {
    return veiculos.filter((v) => {
      // Busca texto
      if (busca.trim()) {
        const t = busca.toLowerCase()
        const match =
          (v.marca && v.marca.toLowerCase().includes(t)) ||
          (v.modelo && v.modelo.toLowerCase().includes(t)) ||
          (v.versao && v.versao.toLowerCase().includes(t)) ||
          (v.cor && v.cor.toLowerCase().includes(t))
        if (!match) return false
      }

      // Marca
      if (marca && v.marca !== marca) return false

      // Ano
      if (anoMin && (v.ano_modelo || v.ano_fabricacao || 0) < Number(anoMin)) return false

      // Faixa Preço
      if (faixaPreco) {
        const p = v.preco_venda || 0
        if (faixaPreco === 'ate_50k' && p > 50000) return false
        if (faixaPreco === '50k_100k' && (p < 50000 || p > 100000)) return false
        if (faixaPreco === '100k_150k' && (p < 100000 || p > 150000)) return false
        if (faixaPreco === 'acima_150k' && p < 150000) return false
      }

      return true
    }).sort((a, b) => {
      if (ordenacao === 'menor_preco') return (a.preco_venda || 0) - (b.preco_venda || 0)
      if (ordenacao === 'maior_preco') return (b.preco_venda || 0) - (a.preco_venda || 0)
      if (ordenacao === 'menor_km') return (a.km || 0) - (b.km || 0)
      // recentes
      return (b.ano_modelo || 0) - (a.ano_modelo || 0)
    })
  }, [veiculos, busca, marca, faixaPreco, anoMin, ordenacao])

  const limparFiltros = () => {
    setBusca('')
    setMarca('')
    setFaixaPreco('')
    setAnoMin('')
    setOrdenacao('recentes')
  }

  const temFiltroAtivo = !!busca || !!marca || !!faixaPreco || !!anoMin || ordenacao !== 'recentes'
  const telLimpo = (dados.loja.whatsapp || '').replace(/\D/g, '')

  return (
    <>
      {veiculos.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(estoqueJsonLd(veiculos))}</script>
        </Helmet>
      )}
      <SiteHeader dados={dados} />

      <div className="site-container">
        <section className="site-section" style={{ borderTop: 'none', paddingTop: 32 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 className="site-section-titulo" style={{ fontSize: 28, marginBottom: 6 }}>Estoque de Veículos</h1>
            <p style={{ color: 'var(--site-text-dim)', fontSize: 15, margin: 0 }}>
              Confira todos os veículos disponíveis na {dados.loja.nome}.
            </p>
          </div>

          {/* ── Barra de Filtros ── */}
          <div className="site-filtros-bar">
            {/* Busca textual */}
            <div className="site-filtro-item" style={{ flex: '2 1 220px' }}>
              <label>Buscar</label>
              <input
                type="text"
                placeholder="Ex: Onix, Compass, automático..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="site-filtro-input"
              />
            </div>

            {/* Marca */}
            <div className="site-filtro-item">
              <label>Marca</label>
              <select value={marca} onChange={(e) => setMarca(e.target.value)} className="site-filtro-select">
                <option value="">Todas as marcas</option>
                {marcasDisponiveis.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Faixa de Preço */}
            <div className="site-filtro-item">
              <label>Faixa de Preço</label>
              <select value={faixaPreco} onChange={(e) => setFaixaPreco(e.target.value)} className="site-filtro-select">
                <option value="">Qualquer valor</option>
                <option value="ate_50k">Até R$ 50.000</option>
                <option value="50k_100k">R$ 50.000 a R$ 100.000</option>
                <option value="100k_150k">R$ 100.000 a R$ 150.000</option>
                <option value="acima_150k">Acima de R$ 150.000</option>
              </select>
            </div>

            {/* Ano mínimo */}
            <div className="site-filtro-item">
              <label>Ano Mínimo</label>
              <select value={anoMin} onChange={(e) => setAnoMin(e.target.value)} className="site-filtro-select">
                <option value="">Qualquer ano</option>
                <option value="2024">2024 ou mais novo</option>
                <option value="2022">2022 ou mais novo</option>
                <option value="2020">2020 ou mais novo</option>
                <option value="2018">2018 ou mais novo</option>
                <option value="2015">2015 ou mais novo</option>
              </select>
            </div>

            {/* Ordenar */}
            <div className="site-filtro-item">
              <label>Ordenar por</label>
              <select value={ordenacao} onChange={(e: any) => setOrdenacao(e.target.value)} className="site-filtro-select">
                <option value="recentes">Mais recentes</option>
                <option value="menor_preco">Menor preço</option>
                <option value="maior_preco">Maior preço</option>
                <option value="menor_km">Menor quilometragem</option>
              </select>
            </div>

            {temFiltroAtivo && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" onClick={limparFiltros} className="site-filtro-btn-limpar">
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Contador de resultados */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontSize: 14, color: 'var(--site-text-dim)' }}>
            <span>
              Mostrando <strong>{veiculosFiltrados.length}</strong> {veiculosFiltrados.length === 1 ? 'veículo' : 'veículos'}
            </span>
          </div>

          {loading ? (
            <p className="site-empty">Carregando catálogo de veículos…</p>
          ) : veiculosFiltrados.length === 0 ? (
            <div className="site-empty" style={{ background: 'var(--site-surface)', borderRadius: 'var(--site-radius)', border: '1px solid var(--site-border)', padding: 48 }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Nenhum veículo encontrado com os filtros selecionados.</p>
              {temFiltroAtivo && (
                <button type="button" onClick={limparFiltros} className="site-hero-cta" style={{ marginTop: 12, padding: '8px 18px', fontSize: 13 }}>
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="site-estoque-grid">
              {veiculosFiltrados.map((v) => {
                const foto = v.midias?.[0]?.url
                const msgWhats = encodeURIComponent(`Olá! Vi o anúncio do ${v.marca} ${v.modelo} ${v.ano_modelo || ''} no site e gostaria de mais informações.`)
                const linkWhats = telLimpo ? `https://wa.me/55${telLimpo}?text=${msgWhats}` : null

                return (
                  <div key={v.id} className="site-card">
                    {foto ? (
                      <img src={foto} alt={`${v.marca} ${v.modelo}`} className="site-card-img" />
                    ) : (
                      <div className="site-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--site-text-dim)', fontSize: 13 }}>
                        Foto do Veículo
                      </div>
                    )}
                    <div className="site-card-body">
                      <div className="site-card-titulo">{v.marca} {v.modelo}</div>
                      <div className="site-card-info">
                        {v.ano_fabricacao}/{v.ano_modelo}
                        {v.km != null && ` · ${v.km.toLocaleString('pt-BR')} km`}
                        {v.cor && ` · ${v.cor}`}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <div className="site-card-preco">{formatBRL(v.preco_venda) || 'Consulte'}</div>
                        {linkWhats && (
                          <a
                            href={linkWhats}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="site-card-btn-whats"
                            title="Conversar no WhatsApp"
                          >
                            Proposta
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <SiteFooter dados={dados} />
    </>
  )
}
