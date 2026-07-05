import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { Megaphone, Loader2, Sparkles, Copy, Check, Gem, Car, Send, Clock, History, X } from 'lucide-react'
import { SearchSelect } from '../../components/SearchSelect'

interface VeiculoItem {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_modelo: number
  placa?: string
  preco_venda?: number
}

interface GerarPostResponse {
  texto: string
  hashtags: string[]
  rede: string
  tom: string
}

interface RedeSocialStatus {
  rede: string
  conectada: boolean
  token_expira_em?: string
}

interface PostHistorico {
  id: string
  redes: string[]
  texto: string
  hashtags: string[]
  status: string
  publicar_em: string
  publicado_em?: string
  erro?: string
  criado_em: string
}

const REDES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'olx', label: 'OLX / Classificados' },
]

const TONS = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'descontraido', label: 'Descontraído' },
  { value: 'sofisticado', label: 'Sofisticado' },
  { value: 'objetivo', label: 'Objetivo' },
]

export function MarketingPage() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()

  const [liberado, setLiberado] = useState<boolean | null>(null)

  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([])
  const [loadingVeiculos, setLoadingVeiculos] = useState(false)
  const [busca, setBusca] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [veiculoDisplay, setVeiculoDisplay] = useState('')

  const [rede, setRede] = useState('instagram')
  const [tom, setTom] = useState('vendedor')
  const [destaques, setDestaques] = useState('')

  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<GerarPostResponse | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [modoIA, setModoIA] = useState<'byok' | 'plataforma' | 'sem-chave' | null>(null)

  // Publicação / agendamento
  const [redesConectadas, setRedesConectadas] = useState<RedeSocialStatus[]>([])
  const [redesSelecionadas, setRedesSelecionadas] = useState<string[]>([])
  const [modoPublicacao, setModoPublicacao] = useState<'agora' | 'agendar'>('agora')
  const [publicarEm, setPublicarEm] = useState('')
  const [publicando, setPublicando] = useState(false)

  // Histórico
  const [historico, setHistorico] = useState<PostHistorico[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Verificar módulo premium marketing + modo de IA ativo
  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const mod = res.find((m) => m.modulo === 'marketing')
        setLiberado(mod ? mod.liberado : false)
      } catch {
        setLiberado(false)
      }
    }
    const verificarIA = async () => {
      try {
        const creds = await api.get<any[]>('/configuracoes/credenciais-ia')
        const anthropic = creds.find((c: any) => c.provedor === 'anthropic' && c.ativo)
        setModoIA(anthropic ? 'byok' : 'plataforma')
      } catch {
        setModoIA('plataforma')
      }
    }
    verificar()
    verificarIA()
    // Carregar redes conectadas
    api.get<RedeSocialStatus[]>('/configuracoes/redes-sociais')
      .then(setRedesConectadas)
      .catch(() => {})
  }, [])

  const carregarHistorico = useCallback(async () => {
    setLoadingHistorico(true)
    try {
      const res = await api.get<PostHistorico[]>('/marketing/historico')
      setHistorico(res)
    } catch { /* ignore */ } finally {
      setLoadingHistorico(false)
    }
  }, [])

  // Carregar estoque
  useEffect(() => {
    if (!liberado) return
    const carregar = async () => {
      setLoadingVeiculos(true)
      try {
        const res = await api.get<{ items: VeiculoItem[] }>('/veiculos')
        setVeiculos(res.items || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingVeiculos(false)
      }
    }
    carregar()
  }, [liberado])

  const veiculosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return veiculos
    return veiculos.filter((v) =>
      `${v.marca} ${v.modelo} ${v.versao || ''} ${v.placa || ''}`.toLowerCase().includes(q),
    )
  }, [veiculos, busca])

  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId)

  const handleGerar = async () => {
    if (!veiculoId) {
      showToast('Selecione um veículo do estoque.', 'error')
      return
    }
    setGerando(true)
    setResultado(null)
    try {
      const res = await api.post<GerarPostResponse>('/marketing/gerar-post', {
        veiculo_id: veiculoId,
        rede,
        tom,
        destaques: destaques.trim() || undefined,
      })
      setResultado(res)
      showToast('Post gerado com sucesso.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Falha ao gerar o post.', 'error')
    } finally {
      setGerando(false)
    }
  }

  const textoFinal = useMemo(() => {
    if (!resultado) return ''
    const tags = resultado.hashtags.length ? '\n\n' + resultado.hashtags.map((h) => `#${h}`).join(' ') : ''
    return resultado.texto + tags
  }, [resultado])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoFinal)
      setCopiado(true)
      showToast('Copiado para a área de transferência.', 'success')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      showToast('Não foi possível copiar.', 'error')
    }
  }

  const handlePublicar = async () => {
    if (!resultado) return
    if (redesSelecionadas.length === 0) { showToast('Selecione ao menos uma rede.', 'error'); return }
    setPublicando(true)
    try {
      if (modoPublicacao === 'agora') {
        const res = await api.post<{ resultados: { rede: string; sucesso: boolean; erro?: string }[] }>(
          '/marketing/publicar',
          { texto: resultado.texto, hashtags: resultado.hashtags, redes: redesSelecionadas, veiculo_id: veiculoId || undefined }
        )
        const falhas = res.resultados.filter(r => !r.sucesso)
        if (falhas.length === 0) showToast('Publicado com sucesso!', 'success')
        else showToast(`Publicado com erros: ${falhas.map(f => f.rede).join(', ')}`, 'warning')
      } else {
        if (!publicarEm) { showToast('Informe a data/hora de publicação.', 'error'); setPublicando(false); return }
        await api.post('/marketing/agendar', {
          texto: resultado.texto, hashtags: resultado.hashtags,
          redes: redesSelecionadas, publicar_em: new Date(publicarEm).toISOString(),
          veiculo_id: veiculoId || undefined,
        })
        showToast('Post agendado!', 'success')
      }
      carregarHistorico()
    } catch (err: any) {
      showToast(err.message || 'Erro ao publicar.', 'error')
    } finally {
      setPublicando(false)
    }
  }

  const handleCancelarPost = async (id: string) => {
    try {
      await api.delete(`/marketing/posts/${id}`)
      setHistorico(h => h.map(p => p.id === id ? { ...p, status: 'cancelado' } : p))
    } catch { showToast('Erro ao cancelar.', 'error') }
  }

  // Paywall
  if (liberado === false) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>Marketing</h2>
          <p>Gere posts e criativos a partir do seu estoque com um clique.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
          <h3>Recurso Premium</h3>
          <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
            O módulo de Marketing não está ativo no seu plano. Gere anúncios prontos para Instagram, WhatsApp e
            classificados a partir dos veículos do seu estoque, com IA.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ferramentas')}>
            Ver Módulos &amp; Assinatura
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Marketing</h2>
        <p>Escolha um veículo do estoque e gere um anúncio pronto para publicar.</p>
      </div>

      {/* Banner modo IA */}
      {modoIA && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8,
          marginBottom: 20,
          background: modoIA === 'byok' ? 'rgba(16,185,129,0.08)' : 'rgba(37,99,235,0.08)',
          border: `1px solid ${modoIA === 'byok' ? 'var(--sv-success)' : 'var(--sv-primary)'}`,
          fontSize: 13,
        }}>
          <Sparkles style={{ width: 16, height: 16, color: modoIA === 'byok' ? 'var(--sv-success)' : 'var(--sv-primary)', flexShrink: 0 }} />
          {modoIA === 'byok'
            ? <span style={{ color: 'var(--sv-success)' }}>Usando sua API — o custo é cobrado na sua conta Anthropic.</span>
            : <span style={{ color: 'var(--sv-primary)' }}>IA da plataforma — <a href="/configuracoes" style={{ color: 'inherit' }}>configure sua chave</a> para usar sua conta.</span>
          }
        </div>
      )}

      {/* Banner redes sociais — sempre visível quando nenhuma rede está conectada */}
      {redesConectadas.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '10px 16px', borderRadius: 8, marginBottom: 20,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.35)',
          fontSize: 13, flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--sv-text-dim)' }}>
            Nenhuma rede social conectada — conecte Instagram ou Facebook para publicar anúncios direto da plataforma.
          </span>
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap', borderColor: 'rgba(245,158,11,0.6)', color: 'var(--sv-text)' }}
            onClick={() => navigate('/configuracoes', { state: { aba: 'redes' } })}
          >
            Configurar redes sociais
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Configuração */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Megaphone style={{ width: 20, height: 20, color: 'var(--sv-primary)' }} />
            <h3 style={{ margin: 0 }}>Configurar anúncio</h3>
          </div>

            <SearchSelect
              label="Veículo do estoque"
              placeholder="Filtrar por marca, modelo ou placa..."
              value={veiculoId}
              displayValue={veiculoDisplay}
              options={veiculosFiltrados.map((v) => ({
                id: v.id,
                label: `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''} (${v.ano_modelo})`,
                sub: v.placa || undefined,
              }))}
              onSearch={setBusca}
              onSelect={(id, label) => {
                setVeiculoId(id)
                setVeiculoDisplay(label)
              }}
              loading={loadingVeiculos}
              required
            />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Rede / canal</label>
              <select value={rede} onChange={(e) => setRede(e.target.value)}>
                {REDES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Tom</label>
              <select value={tom} onChange={(e) => setTom(e.target.value)}>
                {TONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Destaques (opcional)</label>
            <textarea
              placeholder="Ex: único dono, IPVA pago, revisões em concessionária"
              value={destaques}
              onChange={(e) => setDestaques(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGerar}
            disabled={gerando || !veiculoId}
            style={{ width: '100%', marginTop: 8 }}
          >
            {gerando ? (
              <>
                <Loader2 className="animate-spin" style={{ width: 16, height: 16, marginRight: 8 }} />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles style={{ width: 16, height: 16, marginRight: 8 }} />
                Gerar anúncio
              </>
            )}
          </button>
        </div>

        {/* Resultado */}
        <div className="glass-card" style={{ padding: '20px', minHeight: 240, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Prévia</h3>
            {resultado && (
              <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={copiar}>
                {copiado ? <Check style={{ width: 14, height: 14, marginRight: 6 }} /> : <Copy style={{ width: 14, height: 14, marginRight: 6 }} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            )}
          </div>

          {gerando ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--sv-text-dim)' }}>
              <Loader2 className="animate-spin" style={{ width: 40, height: 40, color: 'var(--sv-primary)' }} />
              <span>Escrevendo o anúncio...</span>
            </div>
          ) : resultado ? (
            <>
              {veiculoSelecionado && (
                <div style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Car style={{ width: 14, height: 14 }} />
                  {veiculoSelecionado.marca} {veiculoSelecionado.modelo} · {REDES.find((r) => r.value === resultado.rede)?.label}
                </div>
              )}
              <div
                style={{
                  flex: 1,
                  whiteSpace: 'pre-wrap',
                  background: 'var(--sv-surface-dim)',
                  border: '1px solid var(--sv-border)',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                {textoFinal}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--sv-text-dim)', textAlign: 'center' }}>
              <Megaphone style={{ width: 40, height: 40, opacity: 0.5 }} />
              <p style={{ margin: 0 }}>O anúncio gerado aparece aqui.<br />Escolha um veículo e clique em “Gerar anúncio”.</p>
            </div>
          )}
        </div>
      </div>

      {/* Painel Publicar / Agendar — exibido só quando há resultado */}
      {resultado && (
        <div className="glass-card" style={{ padding: '20px', marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Send style={{ width: 18, height: 18, color: 'var(--sv-primary)' }} />
            <h3 style={{ margin: 0 }}>Publicar / Agendar</h3>
          </div>

          {redesConectadas.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '14px 16px',
              borderRadius: 8,
              background: 'var(--sv-overlay-soft)',
              border: '1px solid var(--sv-border)',
            }}>
              <span style={{ color: 'var(--sv-text-dim)', fontSize: 14 }}>
                Nenhuma rede social conectada. Configure antes de publicar.
              </span>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '6px 14px', whiteSpace: 'nowrap' }}
                onClick={() => navigate('/configuracoes', { state: { aba: 'redes' } })}
              >
                Configurar redes sociais
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {redesConectadas.map(r => (
                  <label key={r.rede} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={redesSelecionadas.includes(r.rede)}
                      onChange={e => setRedesSelecionadas(prev =>
                        e.target.checked ? [...prev, r.rede] : prev.filter(x => x !== r.rede)
                      )}
                    />
                    {r.rede.charAt(0).toUpperCase() + r.rede.slice(1)}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="modo" value="agora" checked={modoPublicacao === 'agora'} onChange={() => setModoPublicacao('agora')} />
                  Publicar agora
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="modo" value="agendar" checked={modoPublicacao === 'agendar'} onChange={() => setModoPublicacao('agendar')} />
                  Agendar para:
                </label>
                {modoPublicacao === 'agendar' && (
                  <input
                    type="datetime-local"
                    value={publicarEm}
                    onChange={e => setPublicarEm(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                )}
              </div>

              <button
                className="btn btn-primary"
                onClick={handlePublicar}
                disabled={publicando || redesSelecionadas.length === 0}
              >
                {publicando ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : null}
                {modoPublicacao === 'agora' ? 'Publicar agora' : 'Agendar publicação'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Histórico de posts */}
      <div className="glass-card" style={{ padding: '20px', marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History style={{ width: 18, height: 18, color: 'var(--sv-primary)' }} />
            <h3 style={{ margin: 0 }}>Histórico de posts</h3>
          </div>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={carregarHistorico}>
            {loadingHistorico ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : 'Atualizar'}
          </button>
        </div>

        {historico.length === 0 ? (
          <div style={{ color: 'var(--sv-text-dim)', fontSize: 14 }}>
            Nenhum post publicado ou agendado ainda.
            {!loadingHistorico && (
              <button className="btn btn-ghost" style={{ marginLeft: 12, fontSize: 12 }} onClick={carregarHistorico}>
                Carregar histórico
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historico.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: 'var(--sv-surface-dim)', borderRadius: 8, fontSize: 13
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    {p.redes.map(r => (
                      <span key={r} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--sv-surface-bright)', color: 'var(--sv-text)' }}>
                        {r}
                      </span>
                    ))}
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                      color: p.status === 'publicado' ? 'var(--sv-success)' : p.status === 'falhou' ? 'var(--sv-error)' : p.status === 'cancelado' ? 'var(--sv-text-dim)' : 'var(--sv-primary)',
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--sv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.texto.slice(0, 80)}{p.texto.length > 80 ? '…' : ''}
                  </div>
                  <div style={{ color: 'var(--sv-text-dim)', fontSize: 11, marginTop: 3, display: 'flex', gap: 10 }}>
                    <span>
                      <Clock style={{ width: 10, height: 10, marginRight: 3 }} />
                      {p.status === 'agendado' ? `Agendado para ${new Date(p.publicar_em).toLocaleString('pt-BR')}` : new Date(p.criado_em).toLocaleString('pt-BR')}
                    </span>
                    {p.erro && <span style={{ color: 'var(--sv-error)' }}>{p.erro}</span>}
                  </div>
                </div>
                {p.status === 'agendado' && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 4, color: 'var(--sv-error)' }}
                    onClick={() => handleCancelarPost(p.id)}
                    title="Cancelar agendamento"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
