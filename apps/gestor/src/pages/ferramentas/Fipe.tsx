import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { SearchSelect } from '../../components/SearchSelect'

interface FipeItem { codigo: string; nome: string }
interface FipeResult { fipe: number | null; fipe_disponivel: boolean }

const TIPOS = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** FIPE usa "32000" como ano-sentinela para zero km (comum em elétricos recém-lançados). */
const formatAnoNome = (nome: string) => nome.replace(/^32000\b/i, 'Zero KM (0km)')

export function FipePage() {
  const [tipo, setTipo] = useState('carro')
  const [marcas, setMarcas] = useState<FipeItem[]>([])
  const [modelos, setModelos] = useState<FipeItem[]>([])
  const [anos, setAnos] = useState<FipeItem[]>([])

  const [marcaCod, setMarcaCod] = useState('')
  const [modeloCod, setModeloCod] = useState('')
  const [anoCod, setAnoCod] = useState('')

  // Texto exibido nos campos de busca — independente do código selecionado.
  const [marcaDisplay, setMarcaDisplay] = useState('')
  const [modeloDisplay, setModeloDisplay] = useState('')
  const [anoDisplay, setAnoDisplay] = useState('')
  const [buscaMarca, setBuscaMarca] = useState('')
  const [buscaModelo, setBuscaModelo] = useState('')
  const [buscaAno, setBuscaAno] = useState('')

  const [result, setResult] = useState<FipeResult | null>(null)
  const [loadingMarcas, setLoadingMarcas] = useState(false)
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [loadingAnos, setLoadingAnos] = useState(false)
  const [loadingConsulta, setLoadingConsulta] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setMarcaCod(''); setModeloCod(''); setAnoCod('')
    setMarcaDisplay(''); setModeloDisplay(''); setAnoDisplay('')
    setBuscaMarca(''); setBuscaModelo(''); setBuscaAno('')
    setModelos([]); setAnos([]); setResult(null); setErro(null)
    setLoadingMarcas(true)
    api.get<FipeItem[]>(`/veiculos/fipe/marcas?tipo=${tipo}`)
      .then(setMarcas)
      .catch(() => setErro('Não foi possível carregar as marcas.'))
      .finally(() => setLoadingMarcas(false))
  }, [tipo])

  useEffect(() => {
    if (!marcaCod) return
    setModeloCod(''); setAnoCod('')
    setModeloDisplay(''); setAnoDisplay('')
    setBuscaModelo(''); setBuscaAno('')
    setAnos([]); setResult(null)
    setLoadingModelos(true)
    api.get<FipeItem[]>(`/veiculos/fipe/marcas/${marcaCod}/modelos?tipo=${tipo}`)
      .then(setModelos)
      .catch(() => setErro('Não foi possível carregar os modelos.'))
      .finally(() => setLoadingModelos(false))
  }, [marcaCod])

  useEffect(() => {
    if (!modeloCod) return
    setAnoCod(''); setAnoDisplay(''); setBuscaAno('')
    setResult(null)
    setLoadingAnos(true)
    api.get<FipeItem[]>(`/veiculos/fipe/marcas/${marcaCod}/modelos/${modeloCod}/anos?tipo=${tipo}`)
      .then(setAnos)
      .catch(() => setErro('Não foi possível carregar os anos.'))
      .finally(() => setLoadingAnos(false))
  }, [modeloCod])

  const marcasFiltradas = useMemo(() => {
    const q = buscaMarca.trim().toLowerCase()
    if (!q) return marcas
    return marcas.filter(m => m.nome.toLowerCase().includes(q))
  }, [marcas, buscaMarca])

  const modelosFiltrados = useMemo(() => {
    const q = buscaModelo.trim().toLowerCase()
    if (!q) return modelos
    return modelos.filter(m => m.nome.toLowerCase().includes(q))
  }, [modelos, buscaModelo])

  const anosFiltrados = useMemo(() => {
    const q = buscaAno.trim().toLowerCase()
    const formatadas = anos.map(a => ({ ...a, nome: formatAnoNome(a.nome) }))
    if (!q) return formatadas
    return formatadas.filter(a => a.nome.toLowerCase().includes(q))
  }, [anos, buscaAno])

  const consultar = async () => {
    if (!marcaCod || !modeloCod || !anoCod) return
    setErro(null); setLoadingConsulta(true)
    try {
      const res = await api.post<FipeResult>('/veiculos/fipe/consultar', {
        marca_codigo: marcaCod,
        modelo_codigo: modeloCod,
        ano_codigo: anoCod,
        tipo,
      })
      setResult(res)
    } catch {
      setErro('Erro ao consultar a tabela FIPE. Tente novamente.')
    } finally {
      setLoadingConsulta(false)
    }
  }

  const limpar = () => {
    setTipo('carro')
    setMarcaCod('')
    setModeloCod('')
    setAnoCod('')
    setMarcaDisplay('')
    setModeloDisplay('')
    setAnoDisplay('')
    setBuscaMarca('')
    setBuscaModelo('')
    setBuscaAno('')
    setModelos([])
    setAnos([])
    setResult(null)
    setErro(null)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Consulta FIPE</h2>
        <p>Consulte o valor de referência sem precisar cadastrar o veículo. Útil durante negociações.</p>
      </div>

      <div className="glass-card fipe-container">
        {/* Stepper vertical em cascata */}
        <div className="fipe-stepper">
          
          {/* Step 1: Tipo */}
          <div className="fipe-step">
            <div className="fipe-step-left">
              <div className="fipe-step-number completed">1</div>
              <div className={`fipe-step-line ${marcaCod ? 'active' : ''}`}></div>
            </div>
            <div className="fipe-step-right">
              <div className="form-group">
                <label className="fipe-select-label">Tipo de Veículo</label>
                <div className="fipe-select-container">
                  <select
                    className="filter-select"
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                  >
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Marca */}
          <div className="fipe-step">
            <div className="fipe-step-left">
              <div className={`fipe-step-number ${marcaCod ? 'completed' : 'active'}`}>2</div>
              <div className={`fipe-step-line ${modeloCod ? 'active' : ''}`}></div>
            </div>
            <div className="fipe-step-right">
              <SearchSelect
                label="Marca"
                placeholder={loadingMarcas ? 'Carregando marcas…' : 'Buscar marca…'}
                value={marcaCod}
                displayValue={marcaDisplay}
                options={marcasFiltradas.map(m => ({ id: m.codigo, label: m.nome }))}
                onSearch={setBuscaMarca}
                onSelect={(id, label) => { setMarcaCod(id); setMarcaDisplay(label) }}
                loading={loadingMarcas}
              />
            </div>
          </div>

          {/* Step 3: Modelo */}
          <div className="fipe-step">
            <div className="fipe-step-left">
              <div className={`fipe-step-number ${modeloCod ? 'completed' : marcaCod ? 'active' : ''}`}>3</div>
              <div className={`fipe-step-line ${anoCod ? 'active' : ''}`}></div>
            </div>
            <div className="fipe-step-right">
              {marcaCod ? (
                <SearchSelect
                  label="Modelo"
                  placeholder={loadingModelos ? 'Carregando modelos…' : 'Buscar modelo…'}
                  value={modeloCod}
                  displayValue={modeloDisplay}
                  options={modelosFiltrados.map(m => ({ id: String(m.codigo), label: m.nome }))}
                  onSearch={setBuscaModelo}
                  onSelect={(id, label) => { setModeloCod(id); setModeloDisplay(label) }}
                  loading={loadingModelos}
                />
              ) : (
                <div className="form-group">
                  <label className="fipe-select-label disabled">Modelo</label>
                  <div className="fipe-select-container">
                    <select className="filter-select" disabled>
                      <option>Aguardando marca...</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Ano */}
          <div className="fipe-step">
            <div className="fipe-step-left">
              <div className={`fipe-step-number ${anoCod ? 'completed' : modeloCod ? 'active' : ''}`}>4</div>
              <div className="fipe-step-line"></div>
            </div>
            <div className="fipe-step-right">
              {modeloCod ? (
                <SearchSelect
                  label="Ano / Modelo"
                  placeholder={loadingAnos ? 'Carregando anos…' : 'Buscar ano…'}
                  value={anoCod}
                  displayValue={anoDisplay}
                  options={anosFiltrados.map(a => ({ id: a.codigo, label: a.nome }))}
                  onSearch={setBuscaAno}
                  onSelect={(id, label) => { setAnoCod(id); setAnoDisplay(label) }}
                  loading={loadingAnos}
                />
              ) : (
                <div className="form-group">
                  <label className="fipe-select-label disabled">Ano / Modelo</label>
                  <div className="fipe-select-container">
                    <select className="filter-select" disabled>
                      <option>Aguardando modelo...</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {erro && (
          <div className="fipe-error-card">
            {erro}
          </div>
        )}

        <div className="fipe-btn-container" style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={consultar}
            disabled={loadingConsulta || !anoCod}
          >
            {loadingConsulta ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Consultar FIPE'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={limpar}
            disabled={loadingConsulta}
            style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--sv-text)' }}
          >
            Limpar
          </button>
        </div>

        {result && (
          <div className="fipe-result-card">
            {result.fipe_disponivel && result.fipe !== null ? (
              <div className="custo-total-card">
                <div className="custo-total-row grand">
                  <span>Valor FIPE</span>
                  <span className="custo-total-value">{fmt(result.fipe)}</span>
                </div>
              </div>
            ) : (
              <div className="custo-total-card">
                <div className="custo-total-row" style={{ color: 'var(--sv-text-dim)', fontSize: 13 }}>
                  <span>Valor não disponível para esta combinação.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .fipe-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px;
        }
        .fipe-stepper {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 24px;
        }
        .fipe-step {
          display: flex;
          gap: 16px;
        }
        .fipe-step-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 28px;
        }
        .fipe-step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--sv-input-bg);
          border: 1px solid var(--sv-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--sv-text-muted);
          transition: all var(--sv-transition);
          flex-shrink: 0;
        }
        .fipe-step-number.active {
          background: var(--sv-primary);
          border-color: var(--sv-primary);
          color: #ffffff;
          box-shadow: 0 0 12px var(--sv-primary-glow);
        }
        .fipe-step-number.completed {
          background: rgba(59, 130, 246, 0.1);
          border-color: var(--sv-primary);
          color: var(--sv-primary);
        }
        .fipe-step-line {
          width: 2px;
          flex-grow: 1;
          background: var(--sv-border);
          margin: 6px 0;
          min-height: 24px;
          transition: background var(--sv-transition);
        }
        .fipe-step-line.active {
          background: var(--sv-primary);
        }
        .fipe-step-right {
          flex-grow: 1;
          padding-bottom: 20px;
        }
        .fipe-select-container {
          position: relative;
          width: 100%;
        }
        .fipe-stepper select {
          width: 100%;
        }
        .fipe-stepper select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .fipe-select-loader {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          display: flex;
          align-items: center;
          background: var(--sv-input-bg);
          padding-left: 6px;
        }
        .fipe-error-card {
          color: var(--sv-error);
          font-size: 13px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: color-mix(in srgb, var(--sv-error) 8%, var(--sv-surface));
          border: 1px solid color-mix(in srgb, var(--sv-error) 25%, var(--sv-border));
          border-radius: var(--sv-radius);
        }
        .fipe-btn-container {
          margin-top: 24px;
        }
        .fipe-btn-container button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
        }
        .fipe-result-card {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px dashed var(--sv-border);
        }
        .fipe-select-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--sv-text);
          transition: color var(--sv-transition);
        }
        .fipe-select-label.disabled {
          color: var(--sv-text-muted);
        }
      `}</style>
    </div>
  )
}
