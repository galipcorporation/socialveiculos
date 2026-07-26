import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { fetchVeiculo, carroMeta, formatBRL, type Veiculo, type Midia } from '../lib/loaders'
import { getSSGData } from '../lib/ssgData'
import { whatsappLojaLink } from '../lib/contato'
import { api } from '../lib/api'
import { BottomNav } from '../components/BottomNav'
import { ContatoVitrineModal } from '../components/ContatoVitrineModal'
import { useAuthStore } from '../stores/authStore'
import { mascararTelefone, capitalizarNome, mascararMoeda, desmascararMoeda } from '../lib/mascaras'

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
        renda_mensal: desmascararMoeda(form.renda_mensal),
        entrada: desmascararMoeda(form.entrada),
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
      <div className="vt-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
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
            <div className="vt-modal-header">
              <h3>Simular financiamento</h3>
              <p>
                Preencha seus dados e a loja retorna com as condições. Não é uma aprovação automática.
              </p>
            </div>

            {erro && <div className="vt-modal-error">{erro}</div>}

            <div className="vt-form-group">
              <label htmlFor="vt-sim-nome">Seu nome completo</label>
              <input
                id="vt-sim-nome"
                className="vt-input"
                placeholder="Ex: João da Silva"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
              />
            </div>

            <div className="vt-form-group">
              <label htmlFor="vt-sim-tel">WhatsApp / Telefone</label>
              <input
                id="vt-sim-tel"
                className="vt-input"
                placeholder="(00) 00000-0000"
                required
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: mascararTelefone(e.target.value) })}
              />
            </div>

            <div className="vt-form-group">
              <label htmlFor="vt-sim-email">E-mail (opcional)</label>
              <input
                id="vt-sim-email"
                className="vt-input"
                placeholder="seuemail@exemplo.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="vt-form-group">
                <label htmlFor="vt-sim-renda">Renda mensal</label>
                <input
                  id="vt-sim-renda"
                  className="vt-input"
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  value={form.renda_mensal}
                  onChange={(e) => setForm({ ...form, renda_mensal: mascararMoeda(e.target.value) })}
                />
              </div>

              <div className="vt-form-group">
                <label htmlFor="vt-sim-entrada">Entrada pretendida</label>
                <input
                  id="vt-sim-entrada"
                  className="vt-input"
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  value={form.entrada}
                  onChange={(e) => setForm({ ...form, entrada: mascararMoeda(e.target.value) })}
                />
              </div>
            </div>

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
  const navigate = useNavigate()
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const seed = initialData ?? getSSGData<Veiculo>()
  const [veiculo, setVeiculo] = useState<Veiculo | null>(seed)
  const [loading, setLoading] = useState(!seed)
  const [erro, setErro] = useState(false)
  const [modalCredito, setModalCredito] = useState(false)
  const [modalContato, setModalContato] = useState(false)
  const [iniciandoChat, setIniciandoChat] = useState(false)
  const [erroChat, setErroChat] = useState('')

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

  const handleConversar = async () => {
    if (!veiculo) return
    if (!isAuthenticated) {
      openLoginModal('login')
      return
    }

    setIniciandoChat(true)
    setErroChat('')

    try {
      const msg = `Olá, estou interessado no veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_modelo}).`
      const res = await api.post<{ id: string }>('/vitrine/conversas', {
        veiculo_id: veiculo.id,
        loja_id: veiculo.loja_id,
        mensagem: msg
      })
      navigate('/mensagens', { state: { conversaId: res.id } })
    } catch (err) {
      setErroChat(err instanceof Error ? err.message : 'Não foi possível iniciar a conversa.')
    } finally {
      setIniciandoChat(false)
    }
  }

  if (loading) {
    return <div className="vt-detail">Carregando…</div>
  }
  if (erro || !veiculo) {
    return (
      <div className="vt-detail">
        Veículo não encontrado ou não está mais disponível.{' '}
        <Link to="/" style={{ color: 'var(--vt-primary)' }}>
          Voltar ao início
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

          {erroChat && (
            <div className="vt-modal-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
              {erroChat}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="vt-btn vt-btn-primary vt-btn-block"
              disabled={iniciandoChat}
              onClick={handleConversar}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {iniciandoChat ? 'Iniciando conversa…' : 'Conversar no Chat'}
            </button>

            <button
              type="button"
              className="vt-btn vt-btn-outline vt-btn-block"
              onClick={() => setModalContato(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M.06 24l1.7-6.2A11.9 11.9 0 1 1 12 24a11.9 11.9 0 0 1-5.7-1.5L.06 24zM6.6 20l.4.2a9.9 9.9 0 1 0-3.4-3.4l.2.4-1 3.7 3.8-.9z"/>
              </svg>
              Chamar no WhatsApp
            </button>

            <button
              type="button"
              className="vt-btn vt-btn-outline vt-btn-block"
              onClick={() => setModalCredito(true)}
            >
              Simular financiamento
            </button>
          </div>
        </div>
      </div>

      {modalCredito && <PreAprovacaoModal veiculoId={veiculo.id} onClose={() => setModalCredito(false)} />}
      {modalContato && (
        <ContatoVitrineModal
          veiculoId={veiculo.id}
          veiculoInfo={{
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            ano_modelo: veiculo.ano_modelo,
            loja_whatsapp: veiculo.loja_whatsapp,
          }}
          onClose={() => setModalContato(false)}
        />
      )}
      <BottomNav />
    </div>
  )
}

