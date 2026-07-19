import { useState, useEffect, useRef } from 'react'
import { api, extractErrorDetails } from '../../lib/api'
import { mascararMoeda, parseMoeda, mascararCPF, mascararTelefone, capitalizarNome } from '../../lib/mascaras'
import { VehicleIdentityFields } from '../../components/VehicleIdentityFields'
import { type Veiculo } from '../../lib/veiculo'
import { XIcon } from './icons'

type PagamentoTroca = {
  tipo: 'troca'
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao?: number
  ano_modelo?: number
  placa?: string
  km?: number
  cor?: string
  valor: number
  keplaca: boolean
}
type PagamentoItem =
  | PagamentoTroca
  | { tipo: 'dinheiro'; valor: number }
  | { tipo: 'financiamento'; valor: number; parcelas?: number }
  | { tipo: 'outros'; descricao: string; valor: number }

export function VenderModal({
  veiculo,
  onClose,
  onSaved,
  onError,
}: {
  veiculo: Veiculo
  onClose: () => void
  onSaved: (contratoId: string) => void
  onError: (msg: string) => void
}) {
  // ── Cliente: existente (busca) ou novo (cadastro rápido) ──
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteDropRect, setClienteDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const clienteInputRef = useRef<HTMLInputElement>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [clienteNovo, setClienteNovo] = useState<{ nome: string; cpf: string; telefone: string } | null>(null)
  const [qNome, setQNome] = useState('')
  const [qCpf, setQCpf] = useState('')
  const [qTel, setQTel] = useState('')

  // ── Venda e pagamento composto ──
  const [valorStr, setValorStr] = useState(mascararMoeda(veiculo.preco_venda || 0))
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([])
  const [formAberto, setFormAberto] = useState<null | 'troca' | 'dinheiro' | 'financiamento' | 'outros'>(null)

  // Form de troca
  const [tPlaca, setTPlaca] = useState('')
  const [tTipo, setTTipo] = useState('carro')
  const [tMarca, setTMarca] = useState('')
  const [tModelo, setTModelo] = useState('')
  const [tAnoFab, setTAnoFab] = useState<number | undefined>(undefined)
  const [tAnoMod, setTAnoMod] = useState<number | undefined>(undefined)
  const [tFipeMarcaCodigo, setTFipeMarcaCodigo] = useState<string | undefined>(undefined)
  const [tFipeModeloCodigo, setTFipeModeloCodigo] = useState<string | undefined>(undefined)
  const [tFipeAnoCodigo, setTFipeAnoCodigo] = useState<string | undefined>(undefined)
  const [tKm, setTKm] = useState('')
  const [tValorStr, setTValorStr] = useState('')
  const [tCor, setTCor] = useState('')
  const [tKeplacaHit, setTKeplacaHit] = useState<string | null>(null)
  const [tTravado, setTTravado] = useState(false)
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)

  // Forms de dinheiro / financiamento
  const [dValorStr, setDValorStr] = useState('')
  const [fValorStr, setFValorStr] = useState('')
  const [fParcelas, setFParcelas] = useState('')
  const [oDescricao, setODescricao] = useState('')
  const [oValorStr, setOValorStr] = useState('')

  const [saving, setSaving] = useState(false)

  // ── Modelo de contrato ──
  const [templates, setTemplates] = useState<{ id: string; nome: string }[]>([])
  const [templateId, setTemplateId] = useState('')
  useEffect(() => {
    api.get<{ items: { id: string; nome: string }[] }>('/templates-contrato')
      .then(res => setTemplates(res.items || []))
      .catch(() => { /* ignore */ })
  }, [])

  // Fetch clientes
  useEffect(() => {
    if (clienteNovo) return
    const t = setTimeout(async () => {
      try {
        const params: Record<string, string> = { per_page: '10' }
        if (clienteSearch) params.q = clienteSearch
        const res = await api.get<{ items: any[] }>('/clientes', params)
        setClientes(res.items || [])
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [clienteSearch, clienteNovo])

  const valorVenda = parseMoeda(valorStr) || 0
  const composto = Math.round(pagamentos.reduce((s, p) => s + p.valor, 0) * 100) / 100
  const falta = Math.round((valorVenda - composto) * 100) / 100
  const excedente = falta < 0 ? -falta : 0
  const temDinheiro = pagamentos.some(p => p.tipo === 'dinheiro')
  const temFinanciamento = pagamentos.some(p => p.tipo === 'financiamento')

  const fecharForm = () => {
    setFormAberto(null)
    setTPlaca(''); setTTipo('carro'); setTMarca(''); setTModelo('')
    setTAnoFab(undefined); setTAnoMod(undefined)
    setTFipeMarcaCodigo(undefined); setTFipeModeloCodigo(undefined); setTFipeAnoCodigo(undefined)
    setTKm(''); setTValorStr(''); setTCor('')
    setTKeplacaHit(null); setTTravado(false)
    setDValorStr(''); setFValorStr(''); setFParcelas('')
    setODescricao(''); setOValorStr('')
  }

  // ── Buscar dados da placa da troca (KePlaca, server-side) ──
  const buscarPlacaTroca = async () => {
    const p = tPlaca.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!p) { onError('Informe a placa para buscar.'); return }
    setBuscandoPlaca(true)
    try {
      const res = await api.get<any>(`/veiculos/consulta-placa/${p}`)
      if (!res?.encontrado) {
        setTKeplacaHit(null)
        onError(res?.mensagem || 'Placa não encontrada — preencha os dados manualmente.')
        return
      }
      if (res.marca) setTMarca(res.marca)
      if (res.modelo) setTModelo(res.modelo)
      if (res.ano_modelo) { setTAnoFab(res.ano_fabricacao || res.ano_modelo); setTAnoMod(res.ano_modelo) }
      if (res.cor) setTCor(res.cor)
      setTKeplacaHit(
        `${res.marca || ''} ${res.modelo || ''}`.trim()
        + (res.ano_modelo ? ` · ${res.ano_fabricacao || res.ano_modelo}/${res.ano_modelo}` : '')
        + (res.cor ? ` · ${res.cor}` : '')
      )
      setTTravado(true)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao consultar a placa.')
    } finally {
      setBuscandoPlaca(false)
    }
  }

  const adicionarTroca = () => {
    const valor = parseMoeda(tValorStr)
    if (!tMarca.trim() || !tModelo.trim()) { onError('Informe marca e modelo do veículo da troca.'); return }
    if (!valor || valor <= 0) { onError('Informe o valor de avaliação da troca.'); return }
    setPagamentos([...pagamentos, {
      tipo: 'troca',
      marca: tMarca.trim().toUpperCase(),
      modelo: tModelo.trim().toUpperCase(),
      ano_fabricacao: tAnoFab,
      ano_modelo: tAnoMod,
      placa: tPlaca.trim().toUpperCase() || undefined,
      km: tKm ? parseInt(tKm.replace(/\D/g, '')) : undefined,
      cor: tCor || undefined,
      valor,
      keplaca: !!tKeplacaHit,
    }])
    fecharForm()
  }

  const adicionarDinheiro = () => {
    const valor = parseMoeda(dValorStr)
    if (!valor || valor <= 0) { onError('Informe o valor em dinheiro.'); return }
    setPagamentos([...pagamentos, { tipo: 'dinheiro', valor }])
    fecharForm()
  }

  const adicionarFinanciamento = () => {
    const valor = parseMoeda(fValorStr)
    if (!valor || valor <= 0) { onError('Informe o valor financiado.'); return }
    setPagamentos([...pagamentos, { tipo: 'financiamento', valor, parcelas: fParcelas ? parseInt(fParcelas) : undefined }])
    fecharForm()
  }

  const adicionarOutros = () => {
    const valor = parseMoeda(oValorStr)
    if (!oDescricao.trim()) { onError('Descreva a forma de pagamento (ex: Carta de crédito).'); return }
    if (!valor || valor <= 0) { onError('Informe o valor.'); return }
    setPagamentos([...pagamentos, { tipo: 'outros', descricao: oDescricao.trim(), valor }])
    fecharForm()
  }

  const removerPagamento = (idx: number) => setPagamentos(pagamentos.filter((_, i) => i !== idx))

  const usarClienteNovo = () => {
    if (!qNome.trim()) { onError('Informe ao menos o nome do cliente.'); return }
    setClienteNovo({ nome: qNome.trim(), cpf: qCpf, telefone: qTel })
    setQuickOpen(false)
    setClienteId('')
  }

  const handleSubmit = async () => {
    if (!clienteId && !clienteNovo) {
      onError('Selecione um cliente ou faça o cadastro rápido.')
      return
    }
    const trocas = pagamentos.filter((p): p is PagamentoTroca => p.tipo === 'troca')
    const dinheiro = pagamentos.filter(p => p.tipo === 'dinheiro').reduce((s, p) => s + p.valor, 0)
    const financiamento = pagamentos.find(p => p.tipo === 'financiamento') as { valor: number; parcelas?: number } | undefined
    const outros = pagamentos.filter((p): p is { tipo: 'outros'; descricao: string; valor: number } => p.tipo === 'outros')
    setSaving(true)
    try {
      const res = await api.post<{ contrato_id: string; trocas_veiculo_ids: string[] }>(`/veiculos/${veiculo.id}/vender`, {
        cliente_id: clienteId || null,
        cliente_novo: clienteNovo ? {
          nome: clienteNovo.nome,
          cpf: clienteNovo.cpf || null,
          telefone: clienteNovo.telefone || null,
        } : null,
        valor_venda: valorVenda || null,
        pagamento_dinheiro: dinheiro || null,
        financiamento: financiamento ? { valor: financiamento.valor, parcelas: financiamento.parcelas || null } : null,
        outros: outros.map(o => ({ descricao: o.descricao, valor: o.valor })),
        trocas: trocas.map(t => ({
          marca: t.marca,
          modelo: t.modelo,
          versao: t.versao || null,
          ano_fabricacao: t.ano_fabricacao || null,
          ano_modelo: t.ano_modelo || null,
          placa: t.placa || null,
          km: t.km || 0,
          cor: t.cor || null,
          valor_avaliacao: t.valor,
        })),
        template_id: templateId || null,
      })
      onSaved(res.contrato_id)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao vender veículo')
    } finally {
      setSaving(false)
    }
  }

  const clienteSel = clientes.find(c => c.id === clienteId)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Fechar Venda</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Veículo sendo vendido + valor editável */}
          <div className="fv-veiculo-box">
            <div>
              <div className="fv-nome">{veiculo.marca} {veiculo.modelo}</div>
              <div className="fv-placa">Placa: {veiculo.placa || 'Sem placa'}</div>
            </div>
            <div className="fv-preco">
              <small>Valor da venda</small>
              <input
                type="text"
                value={valorStr}
                onChange={e => setValorStr(mascararMoeda(e.target.value))}
              />
            </div>
          </div>

          {/* Cliente / Comprador */}
          <div style={{ position: 'relative' }}>
            <div className="fv-sec-label">Cliente / Comprador</div>

            {clienteNovo ? (
              <div className="fv-cliente-sel">
                <div>
                  <div className="fv-nome">{clienteNovo.nome} <span className="fv-chip fv-chip-novo">novo</span></div>
                  <div className="fv-doc">
                    {[clienteNovo.telefone, clienteNovo.cpf ? `CPF: ${clienteNovo.cpf}` : 'sem CPF'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button type="button" className="fv-link-btn" onClick={() => { setClienteNovo(null); setQNome(''); setQCpf(''); setQTel('') }}>
                  Alterar
                </button>
              </div>
            ) : clienteId ? (
              <div className="fv-cliente-sel">
                <div>
                  <div className="fv-nome">{clienteSel?.nome || 'Cliente Selecionado'}</div>
                  <div className="fv-doc">{clienteSel?.cpf ? `CPF: ${clienteSel.cpf}` : (clienteSel?.telefone || '')}</div>
                </div>
                <button type="button" className="fv-link-btn" onClick={() => { setClienteId(''); setClienteSearch('') }}>
                  Alterar
                </button>
              </div>
            ) : (
              <>
                <div className="fv-field">
                  <input
                    ref={clienteInputRef}
                    type="text"
                    placeholder="Buscar cliente por nome ou CPF..."
                    value={clienteSearch}
                    onChange={e => {
                      setClienteSearch(e.target.value)
                      const r = clienteInputRef.current?.getBoundingClientRect()
                      if (r) setClienteDropRect({ top: r.bottom, left: r.left, width: r.width })
                    }}
                    onFocus={() => {
                      const r = clienteInputRef.current?.getBoundingClientRect()
                      if (r) setClienteDropRect({ top: r.bottom, left: r.left, width: r.width })
                    }}
                  />
                </div>
                {!quickOpen && clienteSearch && clientes.length > 0 && clienteDropRect && (
                  <div style={{ position: 'fixed', top: clienteDropRect.top, left: clienteDropRect.left, width: clienteDropRect.width, zIndex: 10000, background: 'var(--sv-surface-solid)', border: '1px solid var(--sv-border)', borderRadius: 6, marginTop: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
                    {clientes.map(c => (
                      <div
                        key={c.id}
                        style={{ cursor: 'pointer', padding: '8px 12px', borderBottom: '1px solid var(--sv-border)' }}
                        onClick={() => { setClienteId(c.id); setClientes([c]) }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>{c.nome}</strong>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>{c.cpf || c.telefone || 'Sem identificador'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!quickOpen && (
                  <div className="fv-hint">
                    Não achou? <button type="button" className="fv-link-btn" onClick={() => setQuickOpen(true)}>+ Cadastro rápido</button>
                  </div>
                )}
                {quickOpen && (
                  <div className="fv-inline-form">
                    <div className="fv-form-title">⚡ Cadastro rápido <span>— o resto completa depois</span></div>
                    <div className="fv-field">
                      <label>Nome completo *</label>
                      <input type="text" value={qNome} onChange={e => setQNome(capitalizarNome(e.target.value))} autoFocus />
                    </div>
                    <div className="fv-row">
                      <div className="fv-field">
                        <label>CPF</label>
                        <input type="text" placeholder="000.000.000-00" value={qCpf} onChange={e => setQCpf(mascararCPF(e.target.value))} />
                      </div>
                      <div className="fv-field">
                        <label>Telefone</label>
                        <input type="text" placeholder="(00) 00000-0000" value={qTel} onChange={e => setQTel(mascararTelefone(e.target.value))} />
                      </div>
                    </div>
                    <div className="fv-form-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuickOpen(false)}>Cancelar</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={usarClienteNovo}>Usar cliente</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagamento componível */}
          <div>
            <div className="fv-sec-label">Pagamento</div>
            <div className="fv-pay-adders">
              <button type="button" className="fv-pay-adder" onClick={() => setFormAberto('troca')}>🚗 Troca</button>
              <button type="button" className="fv-pay-adder" disabled={temDinheiro} onClick={() => setFormAberto('dinheiro')}>💵 Dinheiro</button>
              <button type="button" className="fv-pay-adder" disabled={temFinanciamento} onClick={() => setFormAberto('financiamento')}>🏦 Financiamento</button>
              <button type="button" className="fv-pay-adder" onClick={() => setFormAberto('outros')}>📄 Outros</button>
            </div>

            <div className="fv-pay-list">
              {pagamentos.map((p, idx) => (
                <div className="fv-pay-card" key={idx}>
                  <div className="fv-pay-ico">{p.tipo === 'troca' ? '🚗' : p.tipo === 'dinheiro' ? '💵' : p.tipo === 'financiamento' ? '🏦' : '📄'}</div>
                  <div className="fv-pay-info">
                    {p.tipo === 'troca' ? (
                      <>
                        <div className="fv-t">
                          Troca — {p.marca} {p.modelo}
                          {p.keplaca && <span className="fv-chip fv-chip-keplaca">KePlaca ✓</span>}
                        </div>
                        <div className="fv-s">
                          {[p.placa || 'sem placa', p.ano_modelo ? `${p.ano_fabricacao}/${p.ano_modelo}` : null, 'entra no estoque como rascunho'].filter(Boolean).join(' · ')}
                        </div>
                      </>
                    ) : p.tipo === 'dinheiro' ? (
                      <>
                        <div className="fv-t">Dinheiro / PIX</div>
                        <div className="fv-s">Entrada em espécie</div>
                      </>
                    ) : p.tipo === 'financiamento' ? (
                      <>
                        <div className="fv-t">Financiamento</div>
                        <div className="fv-s">{p.parcelas ? `${p.parcelas}× · banco` : 'banco'}</div>
                      </>
                    ) : (
                      <>
                        <div className="fv-t">{p.descricao}</div>
                        <div className="fv-s">Outra forma de pagamento</div>
                      </>
                    )}
                  </div>
                  <div className="fv-pay-valor">{mascararMoeda(p.valor)}</div>
                  <button type="button" className="fv-pay-x" onClick={() => removerPagamento(idx)}>✕</button>
                </div>
              ))}

              {formAberto === 'troca' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">🚗 Adicionar troca</div>
                  <div className="fv-row">
                    <div className="fv-field" style={{ flex: 1.2 }}>
                      <label>Placa</label>
                      <input type="text" placeholder="ABC1D23" value={tPlaca} onChange={e => setTPlaca(e.target.value.toUpperCase())} autoFocus />
                    </div>
                    <div className="fv-field" style={{ flex: 0.9, display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={buscandoPlaca} onClick={buscarPlacaTroca}>
                        {buscandoPlaca ? 'Buscando...' : 'Buscar placa'}
                      </button>
                    </div>
                  </div>
                  {tKeplacaHit && <div className="fv-keplaca-hit">✓ KePlaca: {tKeplacaHit}</div>}
                  <div className="form-group veic-c12">
                    <VehicleIdentityFields
                      modoBusca={tTravado ? 'travado' : 'autocomplete'}
                      value={{
                        tipo: tTipo,
                        marca: tMarca,
                        modelo: tModelo,
                        ano_fabricacao: tAnoFab,
                        ano_modelo: tAnoMod,
                        fipe_marca_codigo: tFipeMarcaCodigo,
                        fipe_modelo_codigo: tFipeModeloCodigo,
                        fipe_ano_codigo: tFipeAnoCodigo,
                      }}
                      onChange={(patch) => {
                        if (patch.tipo !== undefined) setTTipo(patch.tipo)
                        if (patch.marca !== undefined) setTMarca(patch.marca)
                        if (patch.modelo !== undefined) setTModelo(patch.modelo)
                        if (patch.ano_fabricacao !== undefined) setTAnoFab(patch.ano_fabricacao)
                        if (patch.ano_modelo !== undefined) setTAnoMod(patch.ano_modelo)
                        if ('fipe_marca_codigo' in patch) setTFipeMarcaCodigo(patch.fipe_marca_codigo)
                        if ('fipe_modelo_codigo' in patch) setTFipeModeloCodigo(patch.fipe_modelo_codigo)
                        if ('fipe_ano_codigo' in patch) setTFipeAnoCodigo(patch.fipe_ano_codigo)
                      }}
                      onDestravar={() => setTTravado(false)}
                    />
                  </div>
                  <div className="fv-row">
                    <div className="fv-field">
                      <label>KM</label>
                      <input type="text" placeholder="0" value={tKm} onChange={e => setTKm(e.target.value)} />
                    </div>
                    <div className="fv-field">
                      <label>Valor de avaliação *</label>
                      <input type="text" placeholder="R$ 0,00" value={tValorStr} onChange={e => setTValorStr(mascararMoeda(e.target.value))} />
                    </div>
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarTroca}>Adicionar</button>
                  </div>
                </div>
              )}

              {formAberto === 'dinheiro' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">💵 Dinheiro / PIX</div>
                  <div className="fv-field">
                    <label>Valor *</label>
                    <input type="text" placeholder="R$ 0,00" value={dValorStr} onChange={e => setDValorStr(mascararMoeda(e.target.value))} autoFocus />
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarDinheiro}>Adicionar</button>
                  </div>
                </div>
              )}

              {formAberto === 'financiamento' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">🏦 Financiamento</div>
                  <div className="fv-row">
                    <div className="fv-field">
                      <label>Valor financiado *</label>
                      <input type="text" placeholder="R$ 0,00" value={fValorStr} onChange={e => setFValorStr(mascararMoeda(e.target.value))} autoFocus />
                    </div>
                    <div className="fv-field">
                      <label>Parcelas</label>
                      <input type="number" placeholder="Ex: 48" min="1" max="120" value={fParcelas} onChange={e => setFParcelas(e.target.value)} />
                    </div>
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarFinanciamento}>Adicionar</button>
                  </div>
                </div>
              )}

              {formAberto === 'outros' && (
                <div className="fv-inline-form" style={{ marginTop: 0 }}>
                  <div className="fv-form-title">📄 Outros</div>
                  <div className="fv-field">
                    <label>Descrição *</label>
                    <input type="text" placeholder="Ex: Carta de crédito, Consórcio, Cheque..." value={oDescricao} onChange={e => setODescricao(e.target.value)} autoFocus />
                  </div>
                  <div className="fv-field">
                    <label>Valor *</label>
                    <input type="text" placeholder="R$ 0,00" value={oValorStr} onChange={e => setOValorStr(mascararMoeda(e.target.value))} />
                  </div>
                  <div className="fv-form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={fecharForm}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={adicionarOutros}>Adicionar</button>
                  </div>
                </div>
              )}

              {pagamentos.length === 0 && !formAberto && (
                <div className="fv-pay-empty">Nenhuma forma de pagamento adicionada ainda</div>
              )}
            </div>
          </div>
        </div>

        {/* Modelo de contrato */}
        <div style={{ padding: '0 24px' }}>
          <div className="fv-sec-label">Modelo de Contrato</div>
          <select
            className="fv-select"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Padrão do sistema</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>

        {/* Rodapé vivo: composto / falta / comissão */}
        <div className="fv-saldo-bar">
          <span className="fv-comp">Composto: <strong>{mascararMoeda(composto)}</strong> de {mascararMoeda(valorVenda)}</span>
          {excedente > 0 ? (
            <span className="fv-saldo-pill fv-pill-comissao">Comissão vendedor: {mascararMoeda(excedente)}</span>
          ) : falta > 0 ? (
            <span className="fv-saldo-pill fv-pill-falta">Falta {mascararMoeda(falta)}</span>
          ) : (
            <span className="fv-saldo-pill fv-pill-ok">✓ Fechado</span>
          )}
        </div>
        {excedente > 0 && (
          <div className="fv-saldo-note">O excedente é lançado como comissão do vendedor no financeiro.</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: 'var(--sv-success)' }}>
            {saving ? 'Registrando...' : 'Confirmar Venda'}
          </button>
        </div>
      </div>
    </div>
  )
}


