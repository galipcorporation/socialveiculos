import { useState, useEffect, useCallback } from 'react'
import { api, extractErrorDetails } from '../../lib/api'
import { UploadMidia } from '../../components/UploadMidia'
import { useAuthStore } from '../../stores/authStore'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { VehicleIdentityFields } from '../../components/VehicleIdentityFields'
import { TIPOS_VEICULO, regraDoTipo, type Veiculo } from '../../lib/veiculo'
import { TrashIcon, XIcon } from './icons'

/* ── Types ───────────────────────────────────────────────────── */

interface CustoLancamento {
  id: string
  descricao: string
  valor: number
  data: string
  categoria?: string | null
  observacoes?: string
}
interface CustosVeiculoResponse {
  veiculo_id: string
  preco_compra: number
  total_preparacao: number
  custo_total: number
  custos: CustoLancamento[]
}

interface VeiculoDocumento {
  id: string
  tipo: string
  nome: string
  url: string
  visivel_comprador: boolean
  created_at: string
}

interface VendaData {
  veiculo_id: string
  comprador_id: string | null
  comprador_nome: string | null
  comprador_telefone: string | null
  documentos: VeiculoDocumento[]
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')


const CATEGORIAS_CUSTO: { value: string; label: string; icon: string }[] = [
  { value: 'mecanica', label: 'Mecânica', icon: '🔧' },
  { value: 'pintura', label: 'Pintura/Funilaria', icon: '🎨' },
  { value: 'pneus', label: 'Pneus', icon: '🛞' },
  { value: 'higienizacao', label: 'Higienização', icon: '🧼' },
  { value: 'documentacao', label: 'Documentação', icon: '📄' },
  { value: 'outro', label: 'Outro', icon: '➕' },
]
const iconeCategoria = (cat?: string | null) =>
  CATEGORIAS_CUSTO.find(c => c.value === cat)?.icon || '💸'
const labelCategoria = (cat?: string | null) =>
  CATEGORIAS_CUSTO.find(c => c.value === cat)?.label || ''

export function VeiculoModal({
  veiculo,
  onClose,
  onSaved,
  onError,
}: {
  veiculo: Veiculo | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const isEditing = !!veiculo

  // Form state
  const [placa, setPlaca] = useState(veiculo?.placa || '')
  const [marca, setMarca] = useState(veiculo?.marca || '')
  const [modelo, setModelo] = useState(veiculo?.modelo || '')
  const [versao, setVersao] = useState(veiculo?.versao || '')
  const [anoFab, setAnoFab] = useState(veiculo?.ano_fabricacao || new Date().getFullYear())
  const [anoMod, setAnoMod] = useState(veiculo?.ano_modelo || new Date().getFullYear())
  const [km, setKm] = useState<number | ''>(veiculo?.km !== undefined ? veiculo.km : 0)
  const [cor, setCor] = useState(veiculo?.cor || '')
  const [cambio, setCambio] = useState(veiculo?.cambio || '')
  const [combustivel, setCombustivel] = useState(veiculo?.combustivel || '')
  const [tipo, setTipo] = useState(veiculo?.tipo || '')
  const [carroceria, setCarroceria] = useState(veiculo?.carroceria || '')
  const [portas, setPortas] = useState(veiculo?.portas || 4)
  const [precoVenda, setPrecoVenda] = useState(veiculo?.preco_venda || 0)
  const [precoVendaStr, setPrecoVendaStr] = useState(mascararMoeda(veiculo?.preco_venda || 0))
  const [motivo, setMotivo] = useState('')
  const [precoCusto, setPrecoCusto] = useState(veiculo?.preco_custo || 0)
  const [precoCustoStr, setPrecoCustoStr] = useState(mascararMoeda(veiculo?.preco_custo || 0))
  const [midias, setMidias] = useState<any[]>(veiculo?.midias || [])
  const [opcionais, setOpcionais] = useState<string[]>(() => {
    try { return veiculo?.opcionais ? JSON.parse(veiculo.opcionais) : [] } catch { return [] }
  })
  const [novoOpcional, setNovoOpcional] = useState('')
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)
  const [fipeMarcaCodigo, setFipeMarcaCodigo] = useState(veiculo?.fipe_marca_codigo || '')
  const [fipeModeloCodigo, setFipeModeloCodigo] = useState(veiculo?.fipe_modelo_codigo || '')
  const [fipeAnoCodigo, setFipeAnoCodigo] = useState(veiculo?.fipe_ano_codigo || '')

  const [saving, setSaving] = useState(false)
  const [submetido, setSubmetido] = useState(false)
  const [rascunhoId, setRascunhoId] = useState<string | null>(null)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)

  // Rede Social
  const [publicarRedeSocial, setPublicarRedeSocial] = useState(veiculo?.publicar_rede_social || false)
  const [legendaStory, setLendaStory] = useState('')
  const [valorRepasse, setValorRepasse] = useState(veiculo?.valor_repasse || 0)
  const [valorRepasseStr, setValorRepasseStr] = useState(mascararMoeda(veiculo?.valor_repasse || 0))

  // FIPE (Melhoria 15)
  const [fipeData, setFipeData] = useState<any>(null)

  // ── Aba Venda (M018) ──
  const [vendaData, setVendaData] = useState<VendaData | null>(null)
  const [compradorSearch, setCompradorSearch] = useState('')
  const [compradorResults, setCompradorResults] = useState<any[]>([])
  const [novoDocTipo, setNovoDocTipo] = useState('contrato')
  const [novoDocFile, setNovoDocFile] = useState<File | null>(null)
  const [novoDocVisivel, setNovoDocVisivel] = useState(true)
  const [docForm, setDocForm] = useState(false)
  const [vendaSaving, setVendaSaving] = useState(false)

  // ── Abas ──
  const [aba, setAba] = useState<'dados' | 'custos' | 'venda'>('dados')

  // ── Custos de preparação (aba 2) ──
  const [custos, setCustos] = useState<CustoLancamento[]>([])
  const [totalPreparacao, setTotalPreparacao] = useState(0)
  const [precoCompra, setPrecoCompra] = useState(veiculo?.preco_custo || 0)
  const [custoNovaDesc, setCustoNovaDesc] = useState('')
  const [custoNovoValorStr, setCustoNovoValorStr] = useState('')
  const [custoNovaCategoria, setCustoNovaCategoria] = useState('')
  const [custoForm, setCustoForm] = useState(false)
  const [custoSaving, setCustoSaving] = useState(false)

  const aplicarCustos = useCallback((c: CustosVeiculoResponse) => {
    setCustos(c.custos)
    setTotalPreparacao(c.total_preparacao)
    setPrecoCompra(c.preco_compra)
    setPrecoCusto(c.custo_total)
    setPrecoCustoStr(mascararMoeda(c.custo_total))
  }, [])

  // Carrega custos e FIPE ao abrir (somente edição)
  useEffect(() => {
    if (!veiculo) return
    api.get<CustosVeiculoResponse>(`/financeiro/veiculos/${veiculo.id}/custos`)
      .then(aplicarCustos)
      .catch(() => { /* ignore */ })
    
    api.get(`/veiculos/${veiculo.id}/precificacao`)
      .then(res => setFipeData(res))
      .catch(() => { /* ignore */ })

    api.get<VendaData>(`/veiculos/${veiculo.id}/venda`)
      .then(res => setVendaData(res))
      .catch(() => { /* ignore */ })
  }, [veiculo, aplicarCustos])

  const adicionarCusto = async () => {
    if (!veiculo) return
    const valor = parseMoeda(custoNovoValorStr)
    if (!custoNovaDesc.trim() || valor <= 0) {
      onError('Informe descrição e valor do custo.')
      return
    }
    setCustoSaving(true)
    try {
      const res = await api.post<CustosVeiculoResponse>(
        `/financeiro/veiculos/${veiculo.id}/custos`,
        { descricao: custoNovaDesc.trim(), valor, categoria: custoNovaCategoria || null },
      )
      aplicarCustos(res)
      setCustoNovaDesc('')
      setCustoNovoValorStr('')
      setCustoNovaCategoria('')
      setCustoForm(false)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao lançar custo')
    } finally {
      setCustoSaving(false)
    }
  }

  const removerCusto = async (lancamentoId: string) => {
    if (!veiculo) return
    try {
      const res = await api.delete<CustosVeiculoResponse>(
        `/financeiro/veiculos/${veiculo.id}/custos/${lancamentoId}`,
      )
      aplicarCustos(res)
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao remover custo')
    }
  }

  // ── Regras de visibilidade por tipo ──
  const regra = regraDoTipo(tipo)

  // ── Buscar dados da placa (KePlaca, server-side scraping) ──
  const buscarPlaca = async () => {
    const p = placa.trim().toUpperCase()
    if (!p) { onError('Informe a placa para buscar.'); return }
    setBuscandoPlaca(true)
    try {
      const res = await api.get<any>(`/veiculos/consulta-placa/${p}`)
      if (!res?.encontrado) {
        onError(res?.mensagem || 'Placa não encontrada.')
        return
      }
      if (res.marca) setMarca(res.marca)
      if (res.modelo) setModelo(res.modelo)
      if (res.ano_modelo) { setAnoMod(res.ano_modelo); setAnoFab(res.ano_fabricacao || res.ano_modelo) }
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao consultar a placa.')
    } finally {
      setBuscandoPlaca(false)
    }
  }

  // ── Opcionais ──
  const adicionarOpcional = () => {
    const v = novoOpcional.trim()
    if (!v) return
    if (!opcionais.some(o => o.toLowerCase() === v.toLowerCase())) {
      setOpcionais([...opcionais, v])
    }
    setNovoOpcional('')
  }
  const removerOpcional = (item: string) => setOpcionais(opcionais.filter(o => o !== item))

  // ── Rascunho: cria veículo silenciosamente para liberar upload de mídia ──
  const buildBody = (rascunho = false) => ({
    placa: regra.placa ? (placa || null) : null,
    marca: marca || 'Rascunho',
    modelo: modelo || 'Rascunho',
    versao: versao || null,
    ano_fabricacao: anoFab,
    ano_modelo: anoMod,
    km: regra.km ? (km === '' ? 0 : km) : null,
    cor: cor || null,
    cambio: regra.cambio ? (cambio || null) : null,
    combustivel: regra.combustivel ? (combustivel || null) : null,
    tipo: tipo || null,
    carroceria: regra.carroceria ? (carroceria || null) : null,
    portas: regra.portas ? (portas || null) : null,
    opcionais: opcionais.length > 0 ? JSON.stringify(opcionais) : null,
    preco_venda: precoVenda || null,
    preco_custo: precoCusto || null,
    publicar_rede_social: false,
    valor_repasse: null,
    fipe_marca_codigo: fipeMarcaCodigo || null,
    fipe_modelo_codigo: fipeModeloCodigo || null,
    fipe_ano_codigo: fipeAnoCodigo || null,
    status: rascunho ? 'RASCUNHO' : undefined,
  })

  const salvarRascunho = async (): Promise<string | null> => {
    if (rascunhoId) return rascunhoId
    if (isEditing) return veiculo!.id
    setSalvandoRascunho(true)
    try {
      const criado = await api.post<{ id: string }>('/veiculos', buildBody(true))
      setRascunhoId(criado.id)
      return criado.id
    } catch {
      return null
    } finally {
      setSalvandoRascunho(false)
    }
  }

  // ── Fechar sem perder dados: se algo já foi preenchido e ainda não foi salvo, vira rascunho ──
  const temDadosPreenchidos = !isEditing && (
    placa.trim() || marca.trim() || modelo.trim() || versao.trim() || cor.trim() ||
    precoVenda > 0 || precoCusto > 0 || midias.length > 0 || opcionais.length > 0
  )

  const handleClose = async () => {
    if (temDadosPreenchidos && !rascunhoId) {
      await salvarRascunho()
    }
    onClose()
  }

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmetido(true)
    if (!marca.trim() || !modelo.trim()) {
      onError('Marca e Modelo são obrigatórios.')
      return
    }

    const isVendedor = useAuthStore.getState().user?.papel === 'vendedor'
    const precoAlterado = isEditing && veiculo && precoVenda !== veiculo.preco_venda
    if (precoAlterado && isVendedor && !motivo.trim()) {
      onError('Por favor, informe o motivo para o reajuste de preço.')
      return
    }

    setSaving(true)
    try {
      const body: any = {
        ...buildBody(false),
        marca,
        modelo,
        publicar_rede_social: publicarRedeSocial,
        valor_repasse: publicarRedeSocial ? (valorRepasse || null) : null,
        status: 'DISPONIVEL',
      }
      if (precoAlterado && isVendedor) {
        body.motivo = motivo
      }

      let veiculoId = veiculo?.id
      if (isEditing) {
        await api.patch(`/veiculos/${veiculo!.id}`, body)
      } else if (rascunhoId) {
        await api.patch(`/veiculos/${rascunhoId}`, body)
        veiculoId = rascunhoId
      } else {
        const criado = await api.post<{ id: string }>('/veiculos', body)
        veiculoId = criado.id
      }

      // Publica story se solicitado e tem foto
      if (publicarRedeSocial && veiculoId && midias.length > 0) {
        try {
          await api.post('/gestor/stories', { veiculo_id: veiculoId, legenda: legendaStory || null })
        } catch {
          // Story falhou mas veículo foi salvo — não bloqueia
        }
      }

      onSaved()
    } catch (err) {
      onError(extractErrorDetails(err).message || 'Erro ao salvar veículo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-glass modal-veiculo" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Veículo' : 'Novo Veículo'}</h3>
          <button className="modal-close" onClick={handleClose}><XIcon /></button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${aba === 'dados' ? 'active' : ''}`}
            onClick={() => setAba('dados')}
          >
            Dados Gerais
          </button>
          <button
            className={`modal-tab ${aba === 'custos' ? 'active' : ''}`}
            onClick={() => setAba('custos')}
            disabled={!isEditing}
            title={isEditing ? '' : 'Salve o veículo para lançar custos de preparação'}
            style={!isEditing ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            Histórico de Custos
            {custos.length > 0 && <span className="modal-tab-badge">{custos.length}</span>}
          </button>
          <button
            className={`modal-tab ${aba === 'venda' ? 'active' : ''}`}
            onClick={() => setAba('venda')}
            disabled={!isEditing}
            title={isEditing ? '' : 'Salve o veículo para acessar dados de venda'}
            style={!isEditing ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            Venda & Docs
            {vendaData?.documentos?.length ? <span className="modal-tab-badge">{vendaData.documentos.length}</span> : null}
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-form-col">
          <div className="veic-grid" style={aba === 'dados' ? {} : { display: 'none' }}>
            {/* ── Linha 1: Tipo · Placa (com Buscar) ── */}
            <div className="form-group veic-c5">
              <label>Tipo de veículo *</label>
              <select value={tipo} onChange={e => {
                const novoTipo = e.target.value
                if (novoTipo !== tipo) {
                  setMarca('')
                  setModelo('')
                  setVersao('')
                }
                setTipo(novoTipo)
              }}>
                <option value="">Selecione</option>
                {TIPOS_VEICULO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {regra.placa && (
              <div className="form-group veic-c7">
                <label>Placa <span className="veic-hint">— busca dados na KePlaca</span></label>
                <div className="placa-row">
                  <input
                    type="text"
                    placeholder="ABC1D23"
                    value={placa}
                    onChange={e => setPlaca(e.target.value.toUpperCase())}
                    maxLength={7}
                  />
                  <button type="button" className="btn-buscar" onClick={buscarPlaca} disabled={buscandoPlaca}>
                    {buscandoPlaca ? <span className="spinner" /> : '🔍 Buscar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Linha 2: Marca · Modelo · Ano ── */}
            <div className="veic-section">Identificação</div>
            <div className="form-group veic-c12">
              <VehicleIdentityFields
                modoBusca="autocomplete"
                ocultarTipo
                value={{ tipo, marca, modelo, ano_fabricacao: anoFab, ano_modelo: anoMod, fipe_marca_codigo: fipeMarcaCodigo, fipe_modelo_codigo: fipeModeloCodigo, fipe_ano_codigo: fipeAnoCodigo }}
                erros={{ marca: submetido, modelo: submetido }}
                onChange={(patch) => {
                  if (patch.marca !== undefined) setMarca(patch.marca)
                  if (patch.modelo !== undefined) setModelo(patch.modelo)
                  if (patch.ano_fabricacao !== undefined) setAnoFab(patch.ano_fabricacao)
                  if (patch.ano_modelo !== undefined) setAnoMod(patch.ano_modelo)
                  if ('fipe_marca_codigo' in patch) setFipeMarcaCodigo(patch.fipe_marca_codigo || '')
                  if ('fipe_modelo_codigo' in patch) setFipeModeloCodigo(patch.fipe_modelo_codigo || '')
                  if ('fipe_ano_codigo' in patch) setFipeAnoCodigo(patch.fipe_ano_codigo || '')
                }}
              />
            </div>

            {/* ── Linha 3: Versão · KM/Horas · Cor ── */}
            {regra.versao && (
              <div className="form-group veic-c6">
                <label>Versão</label>
                <input
                  type="text"
                  placeholder="Ex: 1.0 Turbo Premier"
                  value={versao}
                  onChange={e => setVersao(e.target.value)}
                />
              </div>
            )}

            {regra.km && (
              <div className="form-group veic-c3">
                <label>{regra.uso === 'horas' ? 'Horas de uso' : 'Quilometragem'}</label>
                <div className="inp-suffix">
                  <input
                    type="number"
                    min={0}
                    value={km}
                    onChange={e => {
                      const val = e.target.value
                      setKm(val === '' ? '' : Number(val))
                    }}
                  />
                  <span className="sfx">{regra.uso === 'horas' ? 'h' : 'km'}</span>
                </div>
              </div>
            )}

            <div className="form-group veic-c3">
              <label>Cor</label>
              <input
                type="text"
                placeholder="Ex: Prata"
                value={cor}
                onChange={e => setCor(e.target.value)}
              />
            </div>

            {/* ── Linha 4: Câmbio · Combustível · Portas ── */}
            {regra.cambio && (
              <div className="form-group veic-c4">
                <label>Câmbio</label>
                <select value={cambio} onChange={e => setCambio(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="cvt">CVT</option>
                  <option value="automatizado">Automatizado</option>
                </select>
              </div>
            )}

            {regra.combustivel && (
              <div className="form-group veic-c4">
                <label>Combustível</label>
                <select value={combustivel} onChange={e => setCombustivel(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="etanol">Etanol</option>
                  <option value="diesel">Diesel</option>
                  <option value="eletrico">Elétrico</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="gnv">GNV</option>
                </select>
              </div>
            )}

            {regra.portas && (
              <div className="form-group veic-c4">
                <label>Portas</label>
                <select value={portas} onChange={e => setPortas(Number(e.target.value))}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            )}

            {regra.carroceria && (
              <div className="form-group veic-c4">
                <label>Carroceria</label>
                <select value={carroceria} onChange={e => setCarroceria(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Hatch">Hatch</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Minivan">Minivan</option>
                  <option value="Conversível">Conversível</option>
                  <option value="Coupé">Coupé</option>
                  <option value="Perua">Perua / Station Wagon</option>
                  <option value="Furgão">Furgão</option>
                </select>
              </div>
            )}

            {/* ── Linha 5: Precificação ── */}
            <div className="veic-section">Precificação</div>
            <div className="form-group veic-c6">
              <label>Preço de Custo (R$)</label>
              <input
                type="text"
                value={precoCustoStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setPrecoCustoStr(masked)
                  setPrecoCusto(parseMoeda(masked))
                }}
              />
            </div>

            <div className="form-group veic-c6">
              <label>Preço de Venda (R$)</label>
              <input
                type="text"
                value={precoVendaStr}
                onChange={e => {
                  const masked = mascararMoeda(e.target.value)
                  setPrecoVendaStr(masked)
                  setPrecoVenda(parseMoeda(masked))
                }}
              />
            </div>

            {isEditing && useAuthStore.getState().user?.papel === 'vendedor' && precoVenda !== veiculo?.preco_venda && (
              <div className="form-group veic-c12" style={{ marginTop: '8px' }}>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--sv-warning)',
                  padding: '12px',
                  borderRadius: 'var(--sv-radius)',
                  fontSize: '13px',
                  color: 'var(--sv-warning)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: 600 }}>⚠️ Alterações de preço solicitadas por vendedores exigem aprovação do gestor.</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase' }}>
                      Motivo do Reajuste de Preço (Obrigatório)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Negociação com cliente, promoção especial..."
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      style={{
                        background: 'var(--sv-input-bg)',
                        border: '1px solid var(--sv-border)',
                        borderRadius: 'var(--sv-radius)',
                        color: 'var(--sv-text)',
                        height: '38px',
                        padding: '0 12px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Linha 6: Opcionais ── */}
            <div className="veic-section">Opcionais</div>
            <div className="form-group veic-c12">
              <div className="opcionais">
                {opcionais.map(o => (
                  <span key={o} className="opc-tag">
                    {o}
                    <button type="button" className="opc-x" onClick={() => removerOpcional(o)} title="Remover">✕</button>
                  </span>
                ))}
                <input
                  className="opc-input"
                  type="text"
                  placeholder="+ Adicionar opcional"
                  value={novoOpcional}
                  onChange={e => setNovoOpcional(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarOpcional() } }}
                  onBlur={adicionarOpcional}
                />
              </div>
            </div>

            {/* ── Linha 7: Rede Social ── */}
            <div className="veic-section" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>Rede Social</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, textTransform: 'none', color: 'var(--sv-text-dim)' }}>
                <input
                  type="checkbox"
                  checked={publicarRedeSocial}
                  onChange={e => setPublicarRedeSocial(e.target.checked)}
                  disabled={midias.length === 0}
                />
                Publicar no story + feed de repasses
              </label>
              {midias.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--sv-warning, #f59e0b)', textTransform: 'none', fontWeight: 400 }}>
                  (Adicione pelo menos 1 foto para publicar)
                </span>
              )}
            </div>

            {publicarRedeSocial && (
              <>
                <div className="form-group veic-c6">
                  <label>Legenda do story</label>
                  <input
                    type="text"
                    placeholder="Ex: Chegou! BMW 320i impecável..."
                    value={legendaStory}
                    onChange={e => setLendaStory(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="form-group veic-c6">
                  <label>Valor de repasse (Parceiro)</label>
                  <input
                    type="text"
                    placeholder="R$ 0,00"
                    value={valorRepasseStr}
                    onChange={e => {
                      const masked = mascararMoeda(e.target.value)
                      setValorRepasseStr(masked)
                      setValorRepasse(parseMoeda(masked))
                    }}
                    onBlur={() => setValorRepasseStr(mascararMoeda(valorRepasse))}
                  />
                </div>
              </>
            )}

            {/* Card FIPE (M016) — exibido ao editar quando há dado */}
            {isEditing && fipeData?.fipe_disponivel && (
              <div className="form-group veic-c12">
                <div className="custo-total-card" style={{ marginTop: 0 }}>
                  <div className="custo-total-row">
                    <span>Tabela FIPE</span>
                    <span style={{ fontWeight: 600 }}>{formatBRL(fipeData.fipe)}</span>
                  </div>
                  {fipeData.margem_sobre_fipe !== null && (
                    <div className="custo-total-row">
                      <span>Margem sobre FIPE</span>
                      <span style={{ color: fipeData.margem_sobre_fipe >= 0 ? 'var(--sv-success)' : 'var(--sv-error)', fontWeight: 500 }}>
                        {fipeData.margem_sobre_fipe > 0 ? '+' : ''}{fipeData.margem_sobre_fipe}%
                      </span>
                    </div>
                  )}
                  {fipeData.alerta_encalhe && (
                    <div className="custo-total-row" style={{ color: 'var(--sv-warning, #f59e0b)' }}>
                      <span>⚠ Encalhe</span>
                      <span>{fipeData.dias_no_estoque} dias em estoque</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── Aba: Histórico de Custos (Preparação) ── */}
          {aba === 'custos' && (
            <div>
              <div className="custos-head">
                <div>
                  <h4>Custos de preparação</h4>
                  <p>Cada custo vira uma despesa no Financeiro e soma ao custo do veículo. Toque num atalho para lançar rápido:</p>
                </div>
              </div>

              {/* Atalhos de categoria (chips) */}
              <div className="custo-chips">
                {CATEGORIAS_CUSTO.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className="custo-chip"
                    onClick={() => {
                      setCustoNovaCategoria(cat.value)
                      if (!custoNovaDesc.trim() && cat.value !== 'outro') setCustoNovaDesc(cat.label)
                      setCustoForm(true)
                    }}
                  >
                    <span className="plus">+</span> {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              {custos.length > 0 ? (
                <div className="custo-list">
                  {custos.map(c => (
                    <div key={c.id} className="custo-item">
                      <div className="custo-ico">{iconeCategoria(c.categoria)}</div>
                      <div className="custo-desc">
                        <strong>{c.descricao}</strong>
                        <span>{labelCategoria(c.categoria) ? `${labelCategoria(c.categoria)} · ` : ''}{formatData(c.data)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="custo-valor">− {formatBRL(c.valor)}</span>
                        <button className="custo-del" onClick={() => removerCusto(c.id)} title="Remover custo">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !custoForm && (
                  <div className="custos-empty">
                    Sem custos de preparação.<br />
                    Adicione mecânica, pintura, pneus etc. e some ao custo do veículo.
                  </div>
                )
              )}

              {custoForm && (
                <div className="custo-add-form">
                  <div className="form-group">
                    <label>Categoria</label>
                    <select value={custoNovaCategoria} onChange={e => setCustoNovaCategoria(e.target.value)}>
                      <option value="">Selecione</option>
                      {CATEGORIAS_CUSTO.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Descrição do custo</label>
                    <input
                      type="text"
                      placeholder="Ex: 4 pneus novos"
                      value={custoNovaDesc}
                      onChange={e => setCustoNovaDesc(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      value={custoNovoValorStr}
                      onChange={e => setCustoNovoValorStr(mascararMoeda(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-glass btn-sm"
                      onClick={() => { setCustoForm(false); setCustoNovaDesc(''); setCustoNovoValorStr(''); setCustoNovaCategoria('') }}
                    >
                      Cancelar
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={adicionarCusto} disabled={custoSaving}>
                      {custoSaving ? <span className="spinner" /> : 'Lançar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="custo-total-card">
                <div className="custo-total-row">
                  <span>Preço de compra original</span>
                  <span>{formatBRL(precoCompra)}</span>
                </div>
                {totalPreparacao > 0 && (
                  <div className="custo-total-row">
                    <span>+ Custos de preparação ({custos.length})</span>
                    <span style={{ color: 'var(--sv-error)' }}>{formatBRL(totalPreparacao)}</span>
                  </div>
                )}
                <div className="custo-total-row grand">
                  <span>Custo Total Acumulado</span>
                  <span className="custo-total-value">{formatBRL(precoCusto)}</span>
                </div>
              </div>

              {/* Lucro projetado (venda − custo total) */}
              {precoVenda > 0 && (() => {
                const lucro = precoVenda - precoCusto
                const margem = precoVenda > 0 ? (lucro / precoVenda) * 100 : 0
                const cor = lucro >= 0 ? 'var(--sv-success)' : 'var(--sv-error)'
                return (
                  <div className="custo-total-card" style={{ marginTop: 12 }}>
                    <div className="custo-total-row">
                      <span>Preço de venda</span>
                      <span>{formatBRL(precoVenda)}</span>
                    </div>
                    <div className="custo-total-row">
                      <span>− Custo total</span>
                      <span style={{ color: 'var(--sv-error)' }}>{formatBRL(precoCusto)}</span>
                    </div>
                    <div className="custo-total-row grand" style={{ background: 'transparent' }}>
                      <span>Lucro {veiculo?.status === 'vendido' ? 'realizado' : 'projetado'}</span>
                      <span className="custo-total-value" style={{ color: cor }}>
                        {formatBRL(lucro)} <span style={{ fontSize: 13 }}>({margem.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Aba: Venda & Documentos (M018) ── */}
          {aba === 'venda' && (
            <div>
              {/* Comprador vinculado */}
              <div className="custos-head">
                <div>
                  <h4>Comprador</h4>
                  <p>Indique qual cliente adquiriu este veículo pela plataforma.</p>
                </div>
              </div>

              {vendaData?.comprador_id ? (
                <div className="custo-total-card" style={{ marginBottom: 16 }}>
                  <div className="custo-total-row">
                    <span>{vendaData.comprador_nome}</span>
                    <button
                      className="custo-del"
                      title="Desvincular comprador"
                      onClick={async () => {
                        if (!veiculo) return
                        try {
                          await api.delete(`/veiculos/${veiculo.id}/venda/comprador`)
                          setVendaData(v => v ? { ...v, comprador_id: null, comprador_nome: null, comprador_telefone: null } : v)
                        } catch { /* ignore */ }
                      }}
                    >✕</button>
                  </div>
                  {vendaData.comprador_telefone && (
                    <div className="custo-total-row" style={{ fontSize: 13, color: 'var(--sv-text-secondary)' }}>
                      <span>{vendaData.comprador_telefone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <div className="input-icon-wrapper">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar cliente por nome..."
                        value={compradorSearch}
                        onChange={async e => {
                          setCompradorSearch(e.target.value)
                          if (!e.target.value.trim()) { setCompradorResults([]); return }
                          try {
                            const res = await api.get<{ items: any[] }>('/clientes', { q: e.target.value, per_page: '8' })
                            setCompradorResults(res.items || [])
                          } catch { /* ignore */ }
                        }}
                      />
                    </div>
                  </div>
                  {compradorResults.length > 0 && (
                    <div className="custo-list">
                      {compradorResults.map(c => (
                        <div
                          key={c.id}
                          className="custo-item"
                          style={{ cursor: 'pointer' }}
                          onClick={async () => {
                            if (!veiculo) return
                            setVendaSaving(true)
                            try {
                              const res = await api.put<VendaData>(`/veiculos/${veiculo.id}/venda/comprador`, { comprador_id: c.id })
                              setVendaData(v => v ? { ...v, ...res } : res)
                              setCompradorSearch('')
                              setCompradorResults([])
                            } catch { /* ignore */ } finally { setVendaSaving(false) }
                          }}
                        >
                          <div className="custo-desc">
                            <strong>{c.nome}</strong>
                            <span>{c.telefone || c.email || ''}</span>
                          </div>
                          {vendaSaving && <span className="spinner" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documentos */}
              <div className="custos-head" style={{ marginTop: 8 }}>
                <div>
                  <h4>Documentos</h4>
                  <p>Contrato, nota fiscal, garantia e outros arquivos vinculados a esta venda.</p>
                </div>
                <button className="btn btn-glass" style={{ fontSize: 13 }} onClick={() => setDocForm(f => !f)}>
                  + Adicionar
                </button>
              </div>

              {docForm && (
                <div className="custo-add-form" style={{ marginBottom: 12, gridTemplateColumns: '160px 1fr auto' }}>
                  <select value={novoDocTipo} onChange={e => setNovoDocTipo(e.target.value)}>
                    <option value="contrato">Contrato</option>
                    <option value="nota_fiscal">Nota Fiscal</option>
                    <option value="garantia">Garantia</option>
                    <option value="laudo">Laudo</option>
                    <option value="outro">Outro</option>
                  </select>
                  <label className="doc-upload-area" data-active={!!novoDocFile}>
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={e => setNovoDocFile(e.target.files?.[0] ?? null)}
                    />
                    {novoDocFile ? (
                      <span className="doc-upload-name">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {novoDocFile.name}
                      </span>
                    ) : (
                      <span className="doc-upload-placeholder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Selecionar PDF…
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sv-text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" id="doc-visivel" checked={novoDocVisivel} onChange={e => setNovoDocVisivel(e.target.checked)} />
                      Visível na vitrine
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                    <button className="btn btn-glass" onClick={() => { setDocForm(false); setNovoDocFile(null) }}>Cancelar</button>
                    <button
                      className="btn btn-primary"
                      disabled={vendaSaving || !novoDocFile}
                      onClick={async () => {
                        if (!veiculo || !novoDocFile) return
                        setVendaSaving(true)
                        try {
                          const fd = new FormData()
                          fd.append('file', novoDocFile)
                          fd.append('tipo', novoDocTipo)
                          fd.append('visivel_comprador', String(novoDocVisivel))
                          const doc = await api.post<VeiculoDocumento>(`/veiculos/${veiculo.id}/documentos/upload`, fd)
                          setVendaData(v => v ? { ...v, documentos: [...v.documentos, doc] } : v)
                          setNovoDocFile(null); setDocForm(false)
                        } catch { /* ignore */ } finally { setVendaSaving(false) }
                      }}
                    >
                      {vendaSaving ? <span className="spinner" /> : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}

              {vendaData?.documentos?.length ? (
                <div className="doc-list">
                  {vendaData.documentos.map(d => (
                    <div key={d.id} className="doc-item">
                      <svg className="doc-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="doc-item-info">
                        <div className="doc-item-name">{d.nome}</div>
                        <div className="doc-item-meta">{d.tipo} · {formatData(d.created_at)}</div>
                      </div>
                      <span className={`doc-badge ${d.visivel_comprador ? 'doc-badge-visible' : 'doc-badge-internal'}`}>
                        {d.visivel_comprador ? 'Visível' : 'Interno'}
                      </span>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ fontSize: 12, padding: '5px 12px' }}>Abrir</a>
                      <button
                        className="doc-del-btn"
                        title="Remover documento"
                        onClick={async () => {
                          if (!veiculo) return
                          await api.delete(`/veiculos/${veiculo.id}/documentos/${d.id}`)
                          setVendaData(v => v ? { ...v, documentos: v.documentos.filter(x => x.id !== d.id) } : v)
                        }}
                      ><TrashIcon /></button>
                    </div>
                  ))}
                </div>
              ) : (
                !docForm && <div className="custos-empty">Sem documentos. Adicione o contrato, nota fiscal ou garantia.</div>
              )}
            </div>
          )}
          </div>{/* fim modal-form-col */}

          {/* ── Coluna: Galeria de Mídia ── */}
          <div className="modal-gallery-col">
            <div className="modal-gallery-col-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Fotos & Vídeos</span>
              {!isEditing && rascunhoId && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em' }}>
                  RASCUNHO
                </span>
              )}
            </div>
            <div className="modal-gallery-col-body">
              {(isEditing && veiculo) || rascunhoId ? (
                <UploadMidia
                  veiculoId={(isEditing ? veiculo!.id : rascunhoId)!}
                  midias={midias}
                  onChange={(updated) => setMidias(updated)}
                  sidebar
                />
              ) : (
                <UploadMidia
                  veiculoId=""
                  midias={midias}
                  onChange={(updated) => setMidias(updated)}
                  sidebar
                  onRequestUpload={salvarRascunho}
                  salvandoRascunho={salvandoRascunho}
                />
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-glass" onClick={handleClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : isEditing ? 'Salvar Alterações' : 'Cadastrar Veículo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MODAL DE VENDA (VenderVeiculo)
   ══════════════════════════════════════════════════════════════ */

