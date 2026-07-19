import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchVeiculo, carroMeta, formatBRL, type Veiculo, type Midia } from '../lib/loaders'
import { getSSGData } from '../lib/ssgData'
import { whatsappLojaLink } from '../lib/contato'
import { api } from '../lib/api'
import { BottomNav } from '../components/BottomNav'

/** Modal de pré-aprovação de crédito (M017) — captura o interesse do comprador
 *  e encaminha à loja como lead. Não simula parcela (sem parceria com banco). */
function PreAprovacaoModal({ veiculoId, onClose }: { veiculoId: string; onClose: () => void }) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', renda_mensal: '', entrada: '' })
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      await api.post('/marketplace/pre-aprovacao', {
        veiculo_id: veiculoId,
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim() || undefined,
        renda_mensal: form.renda_mensal ? Number(form.renda_mensal) : undefined,
        entrada: form.entrada ? Number(form.entrada) : undefined,
      })
      setOk(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="vt-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        {ok ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <h3>Pedido enviado! 🎉</h3>
            <p style={{ color: 'var(--vt-text-dim)', marginTop: 8 }}>
              A loja vai entrar em contato para dar sequência ao financiamento.
            </p>
            <button className="vt-btn vt-btn-primary vt-btn-block" style={{ marginTop: 16 }} onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <h3 style={{ marginBottom: 4 }}>Simular financiamento</h3>
            <p style={{ color: 'var(--vt-text-dim)', fontSize: 13, marginBottom: 16 }}>
              Preencha seus dados e a loja retorna com as condições. Não é uma aprovação automática.
            </p>
            <input className="vt-input" placeholder="Seu nome" required value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className="vt-input" placeholder="WhatsApp / telefone" required value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })} style={{ marginTop: 10 }} />
            <input className="vt-input" placeholder="E-mail (opcional)" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ marginTop: 10 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <input className="vt-input" placeholder="Renda mensal (R$)" inputMode="numeric" value={form.renda_mensal}
                onChange={(e) => setForm({ ...form, renda_mensal: e.target.value.replace(/\D/g, '') })} />
              <input className="vt-input" placeholder="Entrada (R$)" inputMode="numeric" value={form.entrada}
                onChange={(e) => setForm({ ...form, entrada: e.target.value.replace(/\D/g, '') })} />
            </div>
            {erro && <p style={{ color: 'var(--vt-error, #dc2626)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
            <button className="vt-btn vt-btn-primary vt-btn-block" type="submit" disabled={enviando} style={{ marginTop: 16 }}>
              {enviando ? 'Enviando…' : 'Quero simular financiamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/** Renderiza uma mídia (foto OU vídeo) — foto e vídeo são tratados como a mesma coisa. */
function MidiaView({ midia, className }: { midia: Midia; className?: string }) {
  if (midia.tipo === 'video') {
    return <video src={midia.url} className={className} controls preload="metadata" />
  }
  return <img src={midia.url} alt="" className={className} loading="lazy" />
}

/** Aceita dados pré-carregados (prerender) p/ render imediato sem fetch. */
export function CarroDetalhe({ initialData }: { initialData?: Veiculo | null }) {
  const { id } = useParams()
  const seed = initialData ?? getSSGData<Veiculo>()
  const [veiculo, setVeiculo] = useState<Veiculo | null>(seed)
  const [loading, setLoading] = useState(!seed)
  const [erro, setErro] = useState(false)
  const [modalCredito, setModalCredito] = useState(false)

  useEffect(() => {
    if (seed && seed.id === id) return
    let alive = true
    setLoading(true)
    fetchVeiculo(id!).then((v) => {
      if (!alive) return
      if (v) setVeiculo(v)
      else setErro(true)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="vt-detail">Carregando…</div>
  }
  if (erro || !veiculo) {
    return (
      <div className="vt-detail">
        Veículo não encontrado ou não está mais disponível.{' '}
        <Link to="/" className="vt-detail-back">
          Voltar ao feed
        </Link>
      </div>
    )
  }

  const meta = carroMeta(veiculo)
  // Mídia unificada: foto e vídeo entram na mesma galeria, na ordem.
  const midias = [...(veiculo.midias ?? [])].sort((a, b) => a.ordem - b.ordem)
  const capa = midias[0]
  const opcionais: string[] = (() => {
    try {
      return veiculo.opcionais ? JSON.parse(veiculo.opcionais) : []
    } catch {
      return []
    }
  })()

  const whatsappHref = whatsappLojaLink(
    veiculo.loja_whatsapp,
    `Olá! Tenho interesse no ${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_modelo}.`,
  )

  return (
    <div className="vt-detail">
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(meta.jsonLd)}</script>
      </Helmet>

      <Link to="/" className="vt-detail-back">
        &larr; Voltar
      </Link>

      <div className="vt-detail-grid">
        <div>
          {capa ? (
            <div className="vt-detail-media">
              <MidiaView midia={capa} />
            </div>
          ) : (
            <div className="vt-detail-media-empty">Sem mídia</div>
          )}
          {midias.length > 1 && (
            <div className="vt-detail-thumbs">
              {midias.slice(1, 6).map((m) => (
                <MidiaView key={m.id} midia={m} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="vt-detail-title">
            {veiculo.marca} {veiculo.modelo}
          </h1>
          {veiculo.versao && <div className="vt-detail-subtitle">{veiculo.versao}</div>}
          <div className="vt-detail-price">{formatBRL(veiculo.preco_venda)}</div>

          <div className="vt-detail-specs">
            <div><span>Ano:</span> {veiculo.ano_fabricacao}/{veiculo.ano_modelo}</div>
            <div><span>Km:</span> {veiculo.km.toLocaleString('pt-BR')} km</div>
            {veiculo.cambio && <div><span>Câmbio:</span> {veiculo.cambio}</div>}
            {veiculo.combustivel && <div><span>Combustível:</span> {veiculo.combustivel}</div>}
            {veiculo.cor && <div><span>Cor:</span> {veiculo.cor}</div>}
            {veiculo.portas != null && <div><span>Portas:</span> {veiculo.portas}</div>}
          </div>

          {veiculo.descricao && (
            <div className="vt-detail-section">
              <h3>Descrição</h3>
              <p>{veiculo.descricao}</p>
            </div>
          )}

          {opcionais.length > 0 && (
            <div className="vt-detail-section">
              <h3>Opcionais</h3>
              <div className="vt-detail-chips">
                {opcionais.map((o) => (
                  <span key={o} className="vt-chip">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            className="vt-btn vt-btn-primary vt-btn-block"
            style={{ marginTop: '1.5rem' }}
            onClick={() => setModalCredito(true)}
          >
            Simular financiamento
          </button>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="vt-btn vt-btn-outline vt-btn-block"
              style={{ marginTop: '0.75rem' }}
            >
              Chamar no WhatsApp
            </a>
          )}
        </div>
      </div>

      {modalCredito && <PreAprovacaoModal veiculoId={veiculo.id} onClose={() => setModalCredito(false)} />}
      <BottomNav />
    </div>
  )
}
