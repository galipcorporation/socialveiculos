import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import {
  ANO_MODELO_PAIRS,
  TIPOS_VEICULO,
  type CatalogoMarca,
  type CatalogoModelo,
} from '../lib/veiculo'

/* ══════════════════════════════════════════════════════════════
   VehicleIdentityFields — captura de Tipo · Marca · Modelo · Ano.
   Fonte ÚNICA usada por Estoque (VeiculoModal) e Simulador.

   modoBusca='travado'  → placa encontrada: marca/modelo preenchidos,
                          exibidos como texto com botão "Alterar".
   modoBusca='autocomplete' → busca/seleção manual no catálogo canônico.
   ══════════════════════════════════════════════════════════════ */

export interface VehicleIdentity {
  tipo: string
  marca: string
  modelo: string
  ano_fabricacao?: number
  ano_modelo?: number
  fipe_marca_codigo?: string
  fipe_modelo_codigo?: string
  fipe_ano_codigo?: string
}

interface Props {
  value: VehicleIdentity
  onChange: (patch: Partial<VehicleIdentity>) => void
  modoBusca: 'autocomplete' | 'travado'
  /** Simulador passa só os tipos financiáveis; Estoque omite (usa todos). */
  tiposPermitidos?: { value: string; label: string }[]
  /** Bordas de erro (campos obrigatórios não preenchidos no submit). */
  erros?: { marca?: boolean; modelo?: boolean; tipo?: boolean }
  /** Chamado quando o usuário clica "Alterar" no modo travado. */
  onDestravar?: () => void
  /** Oculta o select de Tipo (ex.: Estoque controla o tipo fora do componente). */
  ocultarTipo?: boolean
}

const erroStyle = { borderColor: 'rgba(239, 68, 68, 0.6)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.15)' }

export function VehicleIdentityFields({
  value,
  onChange,
  modoBusca,
  tiposPermitidos,
  erros,
  onDestravar,
  ocultarTipo,
}: Props) {
  const tipos = tiposPermitidos ?? TIPOS_VEICULO

  // ── Autocomplete de Marca ──
  const [marcas, setMarcas] = useState<CatalogoMarca[]>([])
  const [showMarcas, setShowMarcas] = useState(false)
  const [modelos, setModelos] = useState<CatalogoModelo[]>([])
  const [showModelos, setShowModelos] = useState(false)
  const [selectedMarcaId, setSelectedMarcaId] = useState<number | null>(null)
  const [selectedModeloId, setSelectedModeloId] = useState<number | null>(null)

  // Anos FIPE do modelo selecionado
  const [anosDisponiveis, setAnosDisponiveis] = useState<{ codigo: string; label: string }[]>([])

  const marcaRef = useRef<HTMLDivElement>(null)
  const modeloRef = useRef<HTMLDivElement>(null)

  // Tipo FIPE-compatível (moto, caminhao, carro)
  const tipoFipe = value.tipo || 'carro'

  // Limpa cache de marcas/modelos quando o tipo muda (barco ≠ carro)
  useEffect(() => {
    setMarcas([])
    setModelos([])
    setSelectedMarcaId(null)
    setSelectedModeloId(null)
    setAnosDisponiveis([])
    setShowMarcas(false)
    setShowModelos(false)
  }, [tipoFipe])

  // Carrega anos FIPE quando marca+modelo selecionados
  useEffect(() => {
    if (!selectedMarcaId || !selectedModeloId) { setAnosDisponiveis([]); return }
    const load = async () => {
      try {
        const anos = await api.get<{ codigo: string; nome: string }[]>(
          `/veiculos/fipe/marcas/${selectedMarcaId}/modelos/${selectedModeloId}/anos`,
          { tipo: tipoFipe }
        )
        setAnosDisponiveis(anos.map(a => ({ codigo: a.codigo, label: a.nome })))
      } catch { setAnosDisponiveis([]) }
    }
    load()
  }, [selectedMarcaId, selectedModeloId, tipoFipe])

  // Sincroniza selectedMarcaId e selectedModeloId com o catálogo ao editar veículo existente
  useEffect(() => {
    if (modoBusca === 'travado') return
    if (!value.marca.trim()) {
      setSelectedMarcaId(null)
      setSelectedModeloId(null)
      return
    }
    const syncMarcaId = async () => {
      try {
        const data = await api.get<CatalogoMarca[]>('/catalogo/marcas', { q: value.marca, tipo: tipoFipe })
        const match = data.find(m => m.nome.toLowerCase() === value.marca.trim().toLowerCase())
        if (match) {
          setSelectedMarcaId(match.id)
          // Se já tem fipe_modelo_codigo, recupera o modelo id
          if (value.fipe_modelo_codigo) {
            setSelectedModeloId(Number(value.fipe_modelo_codigo))
          } else if (value.modelo.trim()) {
            try {
              const mods = await api.get<CatalogoModelo[]>(`/catalogo/marcas/${match.id}/modelos`, { q: value.modelo, tipo: tipoFipe })
              const matchMod = mods.find(m => m.nome.toLowerCase() === value.modelo.trim().toLowerCase())
              if (matchMod) setSelectedModeloId(matchMod.id)
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    }
    syncMarcaId()
  }, [value.marca, modoBusca, tipoFipe])

  // Busca marcas conforme digita
  useEffect(() => {
    if (modoBusca === 'travado') return
    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string> = { tipo: tipoFipe }
        if (value.marca.trim()) params.q = value.marca.trim()
        const data = await api.get<CatalogoMarca[]>('/catalogo/marcas', params)
        setMarcas(data)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [value.marca, modoBusca, tipoFipe])

  // Busca modelos quando a marca foi selecionada do catálogo
  useEffect(() => {
    if (modoBusca === 'travado') return
    if (!selectedMarcaId) { setModelos([]); return }
    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string> = { tipo: tipoFipe }
        if (value.modelo.trim()) params.q = value.modelo.trim()
        const data = await api.get<CatalogoModelo[]>(`/catalogo/marcas/${selectedMarcaId}/modelos`, params)
        setModelos(data)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedMarcaId, value.modelo, modoBusca, tipoFipe])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (marcaRef.current && !marcaRef.current.contains(e.target as Node)) setShowMarcas(false)
      if (modeloRef.current && !modeloRef.current.contains(e.target as Node)) setShowModelos(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Modo travado: placa encontrada, mostra resumo + "Alterar" ──
  if (modoBusca === 'travado') {
    return (
      <div className="vehicle-identity">
        <div className="vid-locked">
          <div className="vid-locked-info">
            <strong>{value.marca} {value.modelo}</strong>
            <span>
              {value.ano_fabricacao && value.ano_modelo ? `${value.ano_fabricacao}/${value.ano_modelo}` : (value.ano_modelo || value.ano_fabricacao || '')}
              {value.tipo ? ` · ${tipos.find(t => t.value === value.tipo)?.label || value.tipo}` : ''}
            </span>
          </div>
          {onDestravar && (
            <button type="button" className="btn btn-glass btn-sm" onClick={onDestravar}>
              Alterar
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Modo autocomplete: captura manual ──
  const getPlaceholders = () => {
    switch (value.tipo) {
      case 'moto':
        return { marca: 'Ex.: Honda', modelo: 'Ex.: CG 160' }
      case 'caminhao':
        return { marca: 'Ex.: Volvo', modelo: 'Ex.: FH 540' }
      case 'barco':
        return { marca: 'Ex.: Schaefer', modelo: 'Ex.: Phantom 300' }
      case 'jet':
        return { marca: 'Ex.: Sea-Doo', modelo: 'Ex.: GTI 130' }
      case 'aeronave':
        return { marca: 'Ex.: Cessna', modelo: 'Ex.: 172 Skyhawk' }
      case 'reboque':
        return { marca: 'Ex.: Randon', modelo: 'Ex.: Semirreboque' }
      case 'outro':
        return { marca: 'Ex.: Marca', modelo: 'Ex.: Modelo' }
      case 'carro':
      default:
        return { marca: 'Ex.: Toyota', modelo: 'Ex.: Corolla' }
    }
  }
  const placeholders = getPlaceholders()

  return (
    <div className="vehicle-identity vid-grid">
      {!ocultarTipo && (
        <div className="form-group vid-tipo">
          <label>Tipo *</label>
          <select
            value={value.tipo}
            onChange={e => onChange({ tipo: e.target.value })}
            style={erros?.tipo && !value.tipo ? erroStyle : undefined}
          >
            <option value="">Selecione</option>
            {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      <div className="form-group vid-marca">
        <label>Marca *</label>
        <div className="autocomplete-wrapper" ref={marcaRef}>
          <input
            type="text"
            placeholder={placeholders.marca}
            value={value.marca}
            onChange={e => {
              onChange({ marca: e.target.value });
              setSelectedMarcaId(null);
              setShowMarcas(true);
            }}
            onFocus={async () => {
              setShowMarcas(true);
              if (marcas.length === 0) {
                try {
                  const params: Record<string, string> = { tipo: tipoFipe }
                  if (value.marca.trim()) params.q = value.marca.trim()
                  const data = await api.get<CatalogoMarca[]>('/catalogo/marcas', params)
                  setMarcas(data)
                } catch { /* ignore */ }
              }
            }}
            style={erros?.marca && !value.marca.trim() ? erroStyle : undefined}
          />
          {showMarcas && marcas.length > 0 && (
            <div className="autocomplete-dropdown">
              {marcas.map(m => (
                <div
                  key={m.id}
                  className="autocomplete-item"
                  onClick={() => {
                    onChange({ marca: m.nome, modelo: '', fipe_marca_codigo: String(m.id), fipe_modelo_codigo: undefined, fipe_ano_codigo: undefined })
                    setSelectedMarcaId(m.id)
                    setSelectedModeloId(null)
                    setAnosDisponiveis([])
                    setShowMarcas(false)
                  }}
                >
                  {m.nome}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-group vid-modelo">
        <label>Modelo *</label>
        <div className="autocomplete-wrapper" ref={modeloRef}>
          <input
            type="text"
            placeholder={placeholders.modelo}
            value={value.modelo}
            onChange={e => {
              onChange({ modelo: e.target.value });
              setShowModelos(true);
            }}
            onFocus={async () => {
              if (selectedMarcaId) {
                setShowModelos(true);
                if (modelos.length === 0) {
                  try {
                    const params: Record<string, string> = { tipo: tipoFipe }
                    if (value.modelo.trim()) params.q = value.modelo.trim()
                    const data = await api.get<CatalogoModelo[]>(`/catalogo/marcas/${selectedMarcaId}/modelos`, params)
                    setModelos(data)
                  } catch { /* ignore */ }
                }
              }
            }}
            style={erros?.modelo && !value.modelo.trim() ? erroStyle : undefined}
          />
          {showModelos && modelos.length > 0 && (
            <div className="autocomplete-dropdown">
              {modelos.map(m => (
                <div
                  key={m.id}
                  className="autocomplete-item"
                  onClick={() => {
                    onChange({ modelo: m.nome, fipe_modelo_codigo: String(m.id), fipe_ano_codigo: undefined })
                    setSelectedModeloId(m.id)
                    setAnosDisponiveis([])
                    setShowModelos(false)
                  }}
                >
                  {m.nome}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-group vid-ano">
        <label>Ano / Modelo *</label>
        {anosDisponiveis.length > 0 ? (
          /* Anos reais da FIPE — inclui combustível no nome */
          <select
            value={value.fipe_ano_codigo || ''}
            onChange={e => {
              if (!e.target.value) return
              // Extrai ano numérico do código (ex: "2020-1" → 2020)
              const anoNum = parseInt(e.target.value.split('-')[0], 10) || 0
              onChange({ fipe_ano_codigo: e.target.value, ano_fabricacao: anoNum, ano_modelo: anoNum })
            }}
            title="Ano de fabricação / modelo"
          >
            <option value="">Selecione</option>
            {anosDisponiveis.map(a => (
              <option key={a.codigo} value={a.codigo}>{a.label}</option>
            ))}
          </select>
        ) : (
          /* Fallback: sem modelo FIPE selecionado, usa lista estática */
          <select
            value={value.ano_fabricacao && value.ano_modelo ? `${value.ano_fabricacao}/${value.ano_modelo}` : ''}
            onChange={e => {
              if (!e.target.value) return
              const [fab, mod] = e.target.value.split('/').map(Number)
              onChange({ ano_fabricacao: fab, ano_modelo: mod, fipe_ano_codigo: undefined })
            }}
            title="Ano de fabricação / modelo"
          >
            <option value="">Selecione</option>
            {(() => {
              const hasSelection = value.ano_fabricacao && value.ano_modelo
              const selectKey = `${value.ano_fabricacao}/${value.ano_modelo}`
              const exists = ANO_MODELO_PAIRS.some(
                p => p.fabricacao === value.ano_fabricacao && p.modelo === value.ano_modelo
              )
              const options = [...ANO_MODELO_PAIRS]
              if (hasSelection && !exists) {
                options.unshift({
                  fabricacao: value.ano_fabricacao as number,
                  modelo: value.ano_modelo as number,
                  label: selectKey
                })
              }
              return options.map(p => (
                <option key={p.label} value={`${p.fabricacao}/${p.modelo}`}>
                  {p.label}
                </option>
              ))
            })()}
          </select>
        )}
      </div>
    </div>
  )
}
