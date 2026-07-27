import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, Lock, Plug, RefreshCw, X, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

interface Portal {
  nome: string
  rotulo: string
  disponivel: boolean
  requer_parceria: boolean
  tipo_auth: string
  conectado: boolean
  motivo?: string | null
}

interface Celula {
  id?: string | null
  portal: string
  status: string
  url_externa?: string | null
  erro?: string | null
  publicado_em?: string | null
}

interface Linha {
  veiculo_id: string
  titulo: string
  placa?: string | null
  preco_venda?: number | null
  foto?: string | null
  vendido: boolean
  celulas: Celula[]
}

interface Grade {
  total: number
  itens: Linha[]
}

interface Pendencia {
  id: string
  veiculo_id: string
  titulo: string
  portal: string
  rotulo_portal: string
  erro?: string | null
}

const STATUS_FILTROS = [
  { value: '', label: 'Todos os status' },
  { value: 'baixa_pendente', label: 'Baixa pendente' },
  { value: 'erro', label: 'Com erro' },
  { value: 'publicado', label: 'Publicados' },
  { value: 'sincronizando', label: 'Enviando' },
]

const LIMITE = 30

function moeda(valor?: number | null): string {
  if (!valor) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Aparência de cada estado da célula. Uma fonte só, usada pelo chip e pela legenda. */
const VISUAL: Record<string, { rotulo: string; cor: string; fundo: string; borda: string }> = {
  publicado: { rotulo: 'No ar', cor: 'var(--sv-success)', fundo: 'rgba(74,222,128,0.10)', borda: 'rgba(74,222,128,0.32)' },
  sincronizando: { rotulo: 'Enviando', cor: 'var(--sv-primary-text)', fundo: 'rgba(59,130,246,0.10)', borda: 'rgba(59,130,246,0.32)' },
  erro: { rotulo: 'Erro', cor: 'var(--sv-error)', fundo: 'rgba(244,63,94,0.10)', borda: 'rgba(244,63,94,0.32)' },
  baixa_pendente: { rotulo: 'Baixar', cor: 'var(--sv-warning)', fundo: 'rgba(251,146,60,0.13)', borda: 'rgba(251,146,60,0.38)' },
  despublicado: { rotulo: 'Publicar', cor: 'var(--sv-text-muted)', fundo: 'transparent', borda: 'var(--sv-border)' },
  nao_publicado: { rotulo: 'Publicar', cor: 'var(--sv-text-muted)', fundo: 'transparent', borda: 'var(--sv-border)' },
}

const thStyle = (largura?: number, align?: 'center' | 'left'): React.CSSProperties => ({
  whiteSpace: 'nowrap',
  ...(largura ? { width: largura } : {}),
  ...(align ? { textAlign: align } : {}),
})

const tdStyle = (align?: 'center' | 'left'): React.CSSProperties => ({
  verticalAlign: 'middle',
  ...(align ? { textAlign: align } : {}),
})

const fotoStyle: React.CSSProperties = {
  width: 52,
  height: 39,
  borderRadius: 6,
  objectFit: 'cover',
  flex: 'none',
}

export function GradeAnuncios() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()

  const [portais, setPortais] = useState<Portal[]>([])
  const [grade, setGrade] = useState<Grade>({ total: 0, itens: [] })
  const [pendencias, setPendencias] = useState<Pendencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPortal, setFiltroPortal] = useState('')
  const [pagina, setPagina] = useState(0)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())

  const disponiveis = useMemo(() => portais.filter((p) => p.disponivel), [portais])
  const desconectados = useMemo(
    () => disponiveis.filter((p) => !p.conectado).map((p) => p.rotulo),
    [disponiveis],
  )
  const semIntegracao = useMemo(
    () => portais.filter((p) => !p.disponivel).map((p) => p.rotulo),
    [portais],
  )

  const carregarPortais = useCallback(async () => {
    try {
      setPortais(await api.get<Portal[]>('/anuncios/portais'))
    } catch {
      showToast('Não foi possível carregar os portais.', 'error')
    }
  }, [showToast])

  const carregarGrade = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    try {
      const params: Record<string, string> = {
        limit: String(LIMITE),
        offset: String(pagina * LIMITE),
      }
      if (busca.trim()) params.busca = busca.trim()
      if (filtroStatus) params.status = filtroStatus
      if (filtroPortal) params.portal = filtroPortal

      const [g, p] = await Promise.all([
        api.get<Grade>('/anuncios/grade', params),
        api.get<Pendencia[]>('/anuncios/pendencias'),
      ])
      setGrade(g)
      setPendencias(p)
    } catch {
      showToast('Não foi possível carregar os anúncios.', 'error')
    } finally {
      setCarregando(false)
    }
  }, [busca, filtroStatus, filtroPortal, pagina, showToast])

  useEffect(() => { void carregarPortais() }, [carregarPortais])
  useEffect(() => { void carregarGrade() }, [carregarGrade])

  // O worker roda a cada 60s; sem isso "Enviando" ficaria parado na tela.
  useEffect(() => {
    const temPendente = grade.itens.some((l) =>
      l.celulas.some((c) => c.status === 'sincronizando'),
    )
    if (!temPendente) return
    // Silencioso: repintar o skeleton a cada 30s piscaria a tela inteira.
    const t = setInterval(() => { void carregarGrade(true) }, 30000)
    return () => clearInterval(t)
  }, [grade, carregarGrade])

  const agir = useCallback(async (
    caminho: string,
    veiculoIds: string[],
    portaisAlvo: string[],
    msgOk: string,
  ) => {
    if (!veiculoIds.length || !portaisAlvo.length) return
    setOcupado(true)
    try {
      const r = await api.post<{ enfileirados: number; ignorados?: string[] }>(
        `/anuncios/${caminho}`,
        { veiculo_ids: veiculoIds, portais: portaisAlvo },
      )
      if (r.enfileirados > 0) showToast(`${msgOk} (${r.enfileirados})`, 'success')
      if (r.ignorados?.length) showToast(r.ignorados[0], 'warning')
      if (!r.enfileirados && !r.ignorados?.length) showToast('Nada a fazer.', 'info')
      await carregarGrade()
    } catch {
      showToast('Não foi possível concluir a ação.', 'error')
    } finally {
      setOcupado(false)
    }
  }, [carregarGrade, showToast])

  const confirmarBaixa = useCallback(async (anuncioId: string, rotulo: string) => {
    setOcupado(true)
    try {
      await api.post(`/anuncios/${anuncioId}/confirmar-baixa`)
      showToast(`Baixa confirmada em ${rotulo}.`, 'success')
      await carregarGrade()
    } catch {
      showToast('Não foi possível confirmar a baixa.', 'error')
    } finally {
      setOcupado(false)
    }
  }, [carregarGrade, showToast])

  async function clicarCelula(linha: Linha, celula: Celula, portal: Portal) {
    if (!portal.disponivel) {
      showToast(portal.motivo || `${portal.rotulo} ainda não está integrado.`, 'info')
      return
    }
    if (celula.status === 'baixa_pendente' && celula.id) {
      await confirmarBaixa(celula.id, portal.rotulo)
      return
    }
    if (linha.vendido) {
      showToast('Veículo vendido — não é possível publicar.', 'info')
      return
    }
    if (celula.status === 'publicado') {
      await agir('despublicar', [linha.veiculo_id], [portal.nome], 'Removendo do portal')
      return
    }
    await agir('publicar', [linha.veiculo_id], [portal.nome], 'Enviando para o portal')
  }

  async function sincronizarTodos() {
    setOcupado(true)
    try {
      const r = await api.post<{ enfileirados: number }>('/anuncios/sincronizar-todos')
      showToast(
        r.enfileirados
          ? `${r.enfileirados} anúncio(s) sendo atualizados.`
          : 'Tudo já está sincronizado.',
        r.enfileirados ? 'success' : 'info',
      )
      await carregarGrade()
    } catch {
      showToast('Não foi possível sincronizar.', 'error')
    } finally {
      setOcupado(false)
    }
  }

  async function testarConexoes() {
    if (!disponiveis.length) {
      showToast('Nenhum portal integrado ainda.', 'info')
      return
    }
    setOcupado(true)
    try {
      const res = await Promise.all(
        disponiveis.map(async (p) => {
          try {
            const r = await api.post<{ sucesso: boolean; erro?: string }>(
              `/anuncios/portais/${p.nome}/testar`,
            )
            return { rotulo: p.rotulo, ...r }
          } catch {
            return { rotulo: p.rotulo, sucesso: false, erro: 'Falha na verificação.' }
          }
        }),
      )
      const falhas = res.filter((r) => !r.sucesso)
      if (!falhas.length) showToast('Todas as contas conectadas estão funcionando.', 'success')
      else showToast(`${falhas[0].rotulo}: ${falhas[0].erro || 'falhou'}`, 'warning')
    } finally {
      setOcupado(false)
    }
  }

  function alternarSelecao(id: string) {
    setSelecao((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const selecionados = [...selecao]
  const totalPaginas = Math.max(1, Math.ceil(grade.total / LIMITE))

  return (
    <div>
      {/* Pendências de baixa manual: o que mais dói se passar batido */}
      {pendencias.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8,
          marginBottom: 14, fontSize: 13, flexWrap: 'wrap',
          background: 'rgba(244,63,94,0.09)', border: '1px solid rgba(244,63,94,0.28)',
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--sv-error)', flexShrink: 0 }} />
          <span style={{ color: 'var(--sv-text-dim)' }}>
            <strong style={{ color: 'var(--sv-text)' }}>
              {pendencias.length} anúncio(s) aguardam baixa manual.
            </strong>{' '}
            Estes portais não permitem remoção automática — remova no site deles e confirme aqui.
          </span>
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto', whiteSpace: 'nowrap' }}
            onClick={() => { setFiltroStatus('baixa_pendente'); setPagina(0) }}
          >
            Ver pendências
          </button>
        </div>
      )}

      {(desconectados.length > 0 || semIntegracao.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8,
          marginBottom: 14, fontSize: 13, flexWrap: 'wrap',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
        }}>
          <Plug size={16} style={{ color: 'var(--sv-warning)', flexShrink: 0 }} />
          <span style={{ color: 'var(--sv-text-dim)' }}>
            {semIntegracao.length > 0 && `${semIntegracao.join(', ')} ainda não ${semIntegracao.length > 1 ? 'estão integrados' : 'está integrado'}. `}
            {desconectados.length > 0 && `Conecte ${desconectados.join(' e ')} para publicar.`}
          </span>
          {desconectados.length > 0 && (
            <button
              className="btn btn-outline"
              style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto', whiteSpace: 'nowrap' }}
              onClick={() => navigate('/configuracoes', { state: { aba: 'redes' } })}
            >
              Conectar contas
            </button>
          )}
        </div>
      )}

      {/* Barra de ações */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ maxWidth: 360, width: '100%' }}>
          <Search size={16} />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por marca, modelo ou placa…"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
          />
        </div>
        <select
          className="filter-select"
          value={filtroStatus}
          onChange={(e) => { setFiltroStatus(e.target.value); setPagina(0) }}
          style={{ minWidth: 150 }}
          aria-label="Filtrar por status"
        >
          {STATUS_FILTROS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          className="filter-select"
          value={filtroPortal}
          onChange={(e) => { setFiltroPortal(e.target.value); setPagina(0) }}
          style={{ minWidth: 150 }}
          aria-label="Filtrar por portal"
        >
          <option value="">Todos os portais</option>
          {portais.map((p) => <option key={p.nome} value={p.nome}>{p.rotulo}</option>)}
        </select>
        <button className="btn btn-outline" onClick={testarConexoes} disabled={ocupado}>
          Testar conexões
        </button>
        <button className="btn btn-primary" onClick={sincronizarTodos} disabled={ocupado}>
          {ocupado ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          Sincronizar todos
        </button>
      </div>

      {/* Ação em massa */}
      {selecionados.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8,
          marginBottom: 12, fontSize: 13, background: 'var(--sv-surface-dim)',
          border: '1px solid var(--sv-border)', flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--sv-text-dim)' }}>{selecionados.length} selecionado(s)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {disponiveis.filter((p) => p.conectado).map((p) => (
              <button
                key={p.nome}
                className="btn btn-outline"
                style={{ fontSize: 12, padding: '5px 12px' }}
                disabled={ocupado}
                onClick={() => agir('publicar', selecionados, [p.nome], `Enviando para ${p.rotulo}`)}
              >
                Publicar no {p.rotulo}
              </button>
            ))}
            <button
              className="btn btn-outline"
              style={{ fontSize: 12, padding: '5px 12px' }}
              onClick={() => setSelecao(new Set())}
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Grade */}
      <div className="table-scroll" style={{ marginBottom: 14 }}>
        <table className="stock-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle(34)}>
                <input
                  type="checkbox"
                  checked={selecao.size > 0 && selecao.size === grade.itens.length}
                  onChange={(e) => setSelecao(
                    e.target.checked ? new Set(grade.itens.map((i) => i.veiculo_id)) : new Set(),
                  )}
                  aria-label="Selecionar todos"
                />
              </th>
              <th style={thStyle()}>Veículo</th>
              <th style={thStyle(undefined, 'left')}>Preço</th>
              {portais.map((p) => (
                <th key={p.nome} style={{ ...thStyle(104, 'center') }}>{p.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={3 + portais.length} style={{ padding: 32, textAlign: 'center', color: 'var(--sv-text-muted)' }}>
                <Loader2 size={18} className="spin" /> Carregando…
              </td></tr>
            )}

            {!carregando && grade.itens.length === 0 && (
              <tr><td colSpan={3 + portais.length} style={{ padding: 32, textAlign: 'center', color: 'var(--sv-text-muted)' }}>
                Nenhum veículo encontrado com estes filtros.
              </td></tr>
            )}

            {!carregando && grade.itens.map((linha) => (
              <tr
                key={linha.veiculo_id}
                style={linha.vendido ? { background: 'rgba(244,63,94,0.045)' } : undefined}
              >
                <td style={tdStyle()}>
                  <input
                    type="checkbox"
                    checked={selecao.has(linha.veiculo_id)}
                    onChange={() => alternarSelecao(linha.veiculo_id)}
                    aria-label={`Selecionar ${linha.titulo}`}
                  />
                </td>
                <td style={tdStyle()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 250 }}>
                    {linha.foto ? (
                      <img src={linha.foto} alt="" style={fotoStyle} />
                    ) : (
                      <div style={{ ...fotoStyle, background: 'var(--sv-surface-dim)' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 550, fontSize: 13, marginBottom: 2 }}>
                        {linha.titulo}
                        {linha.vendido && (
                          <span style={{
                            display: 'inline-block', padding: '2px 7px', borderRadius: 5,
                            fontSize: 10, fontWeight: 700, marginLeft: 6,
                            background: 'rgba(244,63,94,0.16)', color: '#fda4af',
                          }}>VENDIDO</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                        {linha.placa || 'sem placa'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="vehicle-price" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {moeda(linha.preco_venda)}
                </td>
                {portais.map((portal) => {
                  const celula = linha.celulas.find((c) => c.portal === portal.nome)
                    || { portal: portal.nome, status: 'nao_publicado' }
                  return (
                    <td key={portal.nome} style={tdStyle('center')}>
                      <ChipCelula
                        celula={celula}
                        portal={portal}
                        vendido={linha.vendido}
                        ocupado={ocupado}
                        onClick={() => clicarCelula(linha, celula, portal)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="pagination">
        <div className="pagination-info">
          Mostrando {pagina * LIMITE + 1}–{Math.min((pagina + 1) * LIMITE, grade.total)} de {grade.total} veículo(s)
        </div>
        {totalPaginas > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {(() => {
              const maxButtons = 5
              let start = Math.max(0, pagina - 2)
              let end = Math.min(totalPaginas - 1, pagina + 2)
              
              if (end - start + 1 < maxButtons) {
                if (start === 0) {
                  end = Math.min(totalPaginas - 1, start + maxButtons - 1)
                } else if (end === totalPaginas - 1) {
                  start = Math.max(0, end - maxButtons + 1)
                }
              }

              return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => {
                const p = start + i
                return (
                  <button
                    key={p}
                    className={`pagination-btn ${pagina === p ? 'active' : ''}`}
                    onClick={() => setPagina(p)}
                  >
                    {p + 1}
                  </button>
                )
              })
            })()}
            <button
              className="pagination-btn"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{
        display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--sv-text-muted)',
      }}>
        {['publicado', 'sincronizando', 'erro', 'baixa_pendente', 'nao_publicado'].map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: VISUAL[s].cor, display: 'inline-block' }} />
            {s === 'baixa_pendente' ? 'Baixa manual pendente'
              : s === 'nao_publicado' ? 'Fora do ar'
              : s === 'erro' ? 'Erro (clique p/ repetir)'
              : VISUAL[s].rotulo}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Lock size={11} /> Aguardando integração
        </span>
      </div>
    </div>
  )
}

function ChipCelula({ celula, portal, vendido, ocupado, onClick }: {
  celula: Celula
  portal: Portal
  vendido: boolean
  ocupado: boolean
  onClick: () => void
}) {
  if (!portal.disponivel) {
    return (
      <span
        title={portal.motivo || 'Portal ainda não integrado.'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
          borderRadius: 999, fontSize: 11, fontWeight: 600, opacity: 0.5,
          color: 'var(--sv-text-muted)', border: '1px solid transparent', cursor: 'not-allowed',
        }}
      >
        <Lock size={11} />
      </span>
    )
  }

  const v = VISUAL[celula.status] || VISUAL.nao_publicado
  const publicavel = celula.status === 'nao_publicado' || celula.status === 'despublicado'
  // Vendido não publica: é o que impede republicar sem querer.
  const desabilitado = ocupado || (vendido && publicavel)

  const icone = celula.status === 'publicado' ? <Check size={11} />
    : celula.status === 'sincronizando' ? <Loader2 size={11} className="spin" />
    : celula.status === 'erro' ? <X size={11} />
    : celula.status === 'baixa_pendente' ? <AlertTriangle size={11} />
    : null

  const dica = celula.erro
    || (celula.status === 'publicado' ? `No ar em ${portal.rotulo} — clique para remover` : '')
    || (publicavel && !vendido ? `Publicar no ${portal.rotulo}` : '')
    || (vendido ? 'Veículo vendido' : '')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={dica}
      aria-label={`${portal.rotulo}: ${v.rotulo}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        color: v.cor, background: v.fundo, border: `1px solid ${v.borda}`,
        cursor: desabilitado ? 'not-allowed' : 'pointer',
        opacity: desabilitado ? 0.45 : 1, whiteSpace: 'nowrap',
      }}
    >
      {icone}
      {v.rotulo}
    </button>
  )
}
