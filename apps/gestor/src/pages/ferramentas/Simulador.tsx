import { useState, useEffect, useRef, useMemo, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { mascararCPF, mascararTelefone, mascararMoeda, parseMoeda, mascararData, capitalizarNome } from '../../lib/mascaras'
import { useUIStore } from '../../stores/uiStore'
import { ExtensionContext, CHROME_STORE_URL } from '../../contexts/ExtensionContext'
import { VehicleIdentityFields } from '../../components/VehicleIdentityFields'
import { tiposVeiculoFinanciaveis, isTipoFinanciavel } from '../../lib/veiculo'
import { 
  Calculator, Loader2, Trash2, Edit, Search, X, Check, AlertCircle, AlertTriangle, 
  Clock, Send, Smartphone, Download, Gem, ExternalLink, FileText, RefreshCw, Printer, Car, ChevronDown 
} from 'lucide-react'

// Bancos disponíveis
interface BancoInfo {
  id: string
  codigo: string
  nome: string
  logo: string
  tier: 'free' | 'paid'
  site: string
}

const BANCOS: BancoInfo[] = [
  { id: '1', codigo: 'bv', nome: 'Banco BV', logo: '/logos/bancos/bv.svg', tier: 'free', site: 'https://parceiro.bv.com.br' },
  { id: '2', codigo: 'c6', nome: 'C6 Bank', logo: '/logos/bancos/c6.svg', tier: 'free', site: 'https://www.c6bank.com.br' },
  { id: '3', codigo: 'itau', nome: 'Itaú', logo: '/logos/bancos/itau.svg', tier: 'paid', site: 'https://www.itau.com.br' },
  { id: '4', codigo: 'santander', nome: 'Santander', logo: '/logos/bancos/santander.svg', tier: 'paid', site: 'https://www.santander.com.br' },
]


interface Cliente {
  id: string
  nome: string
  cpf: string
  telefone?: string
  data_nascimento?: string
}

interface Veiculo {
  id: string
  placa: string
  marca: string
  modelo: string
  ano_fabricacao?: number
  ano_modelo: number
  preco_venda: number
  tipo: 'carro' | 'moto'
}

interface ResultadoBanco {
  id: string
  banco: string
  status: string
  parcela?: number | null
  taxa?: number | null
  total?: number | null
  prazo?: number | null
  erro?: string | null
}

interface SimulacaoResponse {
  id: string
  status: string
  resultados: ResultadoBanco[]
  entrada: number
  prazo_desejado?: number
}

export function SimuladorPage() {
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)
  const { isInstalled, recheck: recheckExtension } = useContext(ExtensionContext)
  const navigate = useNavigate()

  // Módulo liberado (paywall status)
  const [liberado, setLiberado] = useState<boolean | null>(null)
  
  // Bancos selecionados
  const [bancosSelecionados, setBancosSelecionados] = useState<string[]>(['bv', 'c6'])
  const [credenciaisBanco, setCredenciaisBanco] = useState<Record<string, { usuario: string; ativo: boolean }>>({})
  const [bancoSelecionadoParaConfig, setBancoSelecionadoParaConfig] = useState<string | null>(null)
  const [showModalConfig, setShowModalConfig] = useState(false)
  const [usuarioConfig, setUsuarioConfig] = useState('')
  const [senhaConfig, setSenhaConfig] = useState('')
  const [salvandoCredencial, setSalvandoCredencial] = useState(false)

  // Dados da Pessoa
  const [dadosPessoa, setDadosPessoa] = useState({
    id: '',
    nome: '',
    documento: '',
    telefone: '',
    dataNascimento: ''
  })
  const [isFetchingPessoa, setIsFetchingPessoa] = useState(false)
  const lastDocQueriedRef = useRef('')

  // Dados do Veículo
  const [dadosVeiculo, setDadosVeiculo] = useState({
    id: '',
    placa: '',
    marca: '',
    modelo: '',
    anoFabricacao: new Date().getFullYear(),
    anoModelo: new Date().getFullYear(),
    valor: '',
    entrada: '',
    tipoVeiculo: 'carro' as string,
    usarSelect: true
  })
  const [isFetchingVeiculo, setIsFetchingVeiculo] = useState(false)
  const lastPlacaQueriedRef = useRef('')

  // Autocomplete do estoque
  const [veiculosEstoque, setVeiculosEstoque] = useState<Veiculo[]>([])
  const [showPlacaDropdown, setShowPlacaDropdown] = useState(false)
  const [loadingVeiculos, setLoadingVeiculos] = useState(false)

  // Resultados
  const [showModalResultados, setShowModalResultados] = useState(false)
  const [resultadosSimulacao, setResultadosSimulacao] = useState<ResultadoBanco[]>([])
  const [simulacaoResponse, setSimulacaoResponse] = useState<SimulacaoResponse | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // Modais de orientação
  const [showExtensionRequiredModal, setShowExtensionRequiredModal] = useState(false)
  const [showDeviceWarningModal, setShowDeviceWarningModal] = useState(false)

  // Verificar módulo premium simulador
  useEffect(() => {
    const verificarModulo = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const sim = res.find((m) => m.modulo === 'simulador')
        setLiberado(sim ? sim.liberado : false)
      } catch {
        setLiberado(false)
      }
    }
    verificarModulo()
  }, [])

  // Carregar credenciais bancárias
  const carregarCredenciais = async () => {
    try {
      const res = await api.get<any[]>('/configuracoes/credenciais_banco')
      const creds: Record<string, { usuario: string; ativo: boolean }> = {}
      res.forEach((c) => {
        creds[c.banco] = { usuario: c.usuario || '', ativo: c.ativo }
      })
      setCredenciaisBanco(creds)
    } catch (err) {
      console.error('Erro ao carregar credenciais:', err)
    }
  }

  useEffect(() => {
    if (liberado) {
      carregarCredenciais()
    }
  }, [liberado])

  // Marca/modelo canônicos: agora geridos pelo VehicleIdentityFields (autocomplete próprio).

  // Buscar cliente por documento (Blur / Tab)
  const buscarPessoaPorDocumento = async (doc: string) => {
    const docLimpo = doc.replace(/\D/g, '')
    if (docLimpo.length < 11 || lastDocQueriedRef.current === docLimpo) return

    setIsFetchingPessoa(true)
    try {
      const res = await api.get<Cliente[]>('/clientes', { cpf: docLimpo })
      if (res && res.length > 0) {
        const c = res[0]
        setDadosPessoa({
          id: c.id,
          nome: c.nome || '',
          documento: mascararCPF(c.cpf),
          telefone: c.telefone ? mascararTelefone(c.telefone) : '',
          dataNascimento: c.data_nascimento ? c.data_nascimento.substring(0, 10) : ''
        })
        showToast('Dados do cliente encontrados.', 'success')
      } else {
        showToast('Cliente não localizado. Insira os dados manualmente.', 'warning')
      }
      lastDocQueriedRef.current = docLimpo
    } catch (err) {
      console.error(err)
      showToast('Erro ao consultar documento.', 'error')
    } finally {
      setIsFetchingPessoa(false)
    }
  }

  // Buscar veículo por placa (Blur / Tab)
  const buscarVeiculoPorPlaca = async (placaRaw: string) => {
    const placa = placaRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (placa.length < 7 || lastPlacaQueriedRef.current === placa) return

    setIsFetchingVeiculo(true)
    try {
      const res = await api.get<{ items: Veiculo[] }>('/veiculos', { q: placa })
      if (res.items && res.items.length > 0) {
        const v = res.items[0]
        setDadosVeiculo({
          id: v.id,
          placa: v.placa,
          marca: v.marca,
          modelo: v.modelo,
          anoFabricacao: v.ano_fabricacao || v.ano_modelo,
          anoModelo: v.ano_modelo,
          valor: mascararMoeda(v.preco_venda),
          entrada: mascararMoeda(v.preco_venda * 0.2),
          tipoVeiculo: v.tipo || 'carro',
          usarSelect: false
        })
        showToast('Veículo localizado no estoque.', 'success')
      } else {
        showToast('Veículo não cadastrado. Preencha manualmente.', 'info')
        setDadosVeiculo((prev) => ({ ...prev, usarSelect: true }))
      }
      lastPlacaQueriedRef.current = placa
    } catch (err) {
      console.error(err)
      showToast('Erro ao consultar veículo.', 'error')
    } finally {
      setIsFetchingVeiculo(false)
    }
  }

  const carregarVeiculosEstoque = async () => {
    setLoadingVeiculos(true)
    try {
      const res = await api.get<{ items: Veiculo[] }>('/veiculos')
      setVeiculosEstoque(res.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingVeiculos(false)
    }
  }

  // Salvar credenciais no modal
  const handleSalvarCredencial = async () => {
    if (!bancoSelecionadoParaConfig) return
    if (!usuarioConfig || !senhaConfig) {
      showToast('Usuário e Senha são obrigatórios.', 'error')
      return
    }

    setSalvandoCredencial(true)
    try {
      await api.post('/configuracoes/credenciais_banco', {
        banco: bancoSelecionadoParaConfig,
        credenciais: {
          usuario: usuarioConfig,
          senha: senhaConfig
        }
      })
      showToast('Credenciais salvas com sucesso!', 'success')
      await carregarCredenciais()
      setShowModalConfig(false)
      setUsuarioConfig('')
      setSenhaConfig('')
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar credenciais.', 'error')
    } finally {
      setSalvandoCredencial(false)
    }
  }

  const toggleBanco = (code: string) => {
    setBancosSelecionados((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  // Executar simulação
  const handleSimular = async () => {
    if (bancosSelecionados.length === 0) {
      showToast('Selecione ao menos um banco.', 'error')
      return
    }
    if (!dadosPessoa.documento || !dadosPessoa.nome) {
      showToast('Documento e Nome são obrigatórios.', 'error')
      return
    }
    if (!dadosVeiculo.placa || !dadosVeiculo.marca || !dadosVeiculo.modelo || !dadosVeiculo.valor) {
      showToast('Dados mínimos do veículo são obrigatórios.', 'error')
      return
    }
    if (!isTipoFinanciavel(dadosVeiculo.tipoVeiculo)) {
      showToast('Este tipo de veículo não é financiável pelos bancos integrados.', 'warning')
      return
    }

    // Alertas de dispositivo e extensão
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobile) {
      setShowDeviceWarningModal(true)
      return
    }

    // Se no navegador chrome sem extensão, exibir modal
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
    if (isChrome && isInstalled === false) {
      setShowExtensionRequiredModal(true)
      return
    }

    setIsSimulating(true)
    setResultadosSimulacao([])
    setSimulacaoResponse(null)
    setShowModalResultados(true)

    try {
      const payload: any = {
        bancos: bancosSelecionados,
        entrada: parseMoeda(dadosVeiculo.entrada) || 0,
        prazo_desejado: 48,
        cliente_dados: {
          cpf: dadosPessoa.documento.replace(/\D/g, ''),
          nome: dadosPessoa.nome,
          nascimento: dadosPessoa.dataNascimento ? mascararData(dadosPessoa.dataNascimento) : undefined,
          telefone: dadosPessoa.telefone ? dadosPessoa.telefone.replace(/\D/g, '') : undefined
        },
        veiculo_dados: {
          placa: dadosVeiculo.placa,
          marca: dadosVeiculo.marca,
          modelo: dadosVeiculo.modelo,
          ano_modelo: dadosVeiculo.anoModelo,
          valor_veiculo: parseMoeda(dadosVeiculo.valor)
        }
      }

      if (dadosVeiculo.id) {
        payload.veiculo_id = dadosVeiculo.id
      }
      if (dadosPessoa.id) {
        payload.cliente_id = dadosPessoa.id
      }

      const res = await api.post<SimulacaoResponse>('/simulador', payload)
      setSimulacaoResponse(res)
      setResultadosSimulacao(res.resultados || [])
      showToast('Simulação concluída com sucesso.', 'success')

      // Sincronizar token com a extensão caso ela exista
      const token = localStorage.getItem('token')
      if (token) {
        window.postMessage({ type: 'SF_SYNC_TOKEN', token }, '*')
      }

      // Enviar comando de execução para a extensão caso haja integração ativa
      window.postMessage({
        type: 'SF_EXECUTE_BATCH',
        payload: res.resultados.map(r => ({
          bank: r.banco,
          status: r.status,
          simulacao_id: res.id
        })),
        taskId: res.id
      }, '*')

    } catch (err: any) {
      showToast(err.message || 'Falha ao executar simulação.', 'error')
      setShowModalResultados(false)
    } finally {
      setIsSimulating(false)
    }
  }

  // Impressão de Proposta
  const imprimirResultados = () => {
    if (!simulacaoResponse) return
    const printWindow = window.open('', '_blank', 'width=860,height=700')
    if (!printWindow) return

    const dataHoje = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const bancosHtml = resultadosSimulacao.map(r => {
      const isError = r.status === 'erro' || r.status === 'negado'
      return `
        <div style="break-inside:avoid;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:${isError ? '#dc2626' : '#8b5cf6'};color:white;padding:10px 16px;display:flex;align-items:center;gap:10px">
            <strong style="font-size:15px;text-transform:uppercase">${r.banco}</strong>
            <span style="margin-left:auto;font-size:11px;background:rgba(255,255,255,0.2);padding:2px 10px;border-radius:12px">${r.status}</span>
          </div>
          <div style="padding:14px 16px">
            ${isError ? `<p style="color:#dc2626;margin:0">${r.erro || 'Não aprovado'}</p>` : `
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:5px 0;color:#6b7280">Taxa de Juros</td><td style="text-align:right;font-weight:500">${r.taxa || 0}% a.m.</td></tr>
                <tr><td style="padding:5px 0;color:#6b7280">Prazo</td><td style="text-align:right;font-weight:500">${r.prazo || 0} meses</td></tr>
                <tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0 5px;font-weight:700">Parcela</td><td style="text-align:right;font-weight:700;color:#8b5cf6;font-size:15px;padding:8px 0 5px">${r.parcela ? r.parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td></tr>
              </table>
            `}
          </div>
        </div>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Proposta de Financiamento</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,sans-serif;font-size:14px;color:#1f2937;padding:32px;max-width:800px;margin:0 auto}
          @media print{body{padding:16px}button{display:none!important}}
        </style>
      </head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;margin-bottom:24px;border-bottom:3px solid #8b5cf6">
          <h1 style="font-size:20px;font-weight:700;color:#1f2937;margin:0">Proposta de Financiamento</h1>
          <div style="text-align:right;color:#6b7280;font-size:12px">
            <div>Gerado em</div>
            <div style="font-weight:700;color:#1f2937;font-size:13px">${dataHoje}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
          <div style="background:#f9fafb;border-radius:8px;padding:14px">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8b5cf6;letter-spacing:.06em;margin-bottom:10px">Dados do Cliente</h3>
            <p style="margin:5px 0"><strong>Nome:</strong> ${dadosPessoa.nome || '—'}</p>
            <p style="margin:5px 0"><strong>CPF:</strong> ${dadosPessoa.documento || '—'}</p>
            <p style="margin:5px 0"><strong>Telefone:</strong> ${dadosPessoa.telefone || '—'}</p>
          </div>
          <div style="background:#f9fafb;border-radius:8px;padding:14px">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8b5cf6;letter-spacing:.06em;margin-bottom:10px">Dados do Veículo</h3>
            <p style="margin:5px 0"><strong>Veículo:</strong> ${dadosVeiculo.marca} ${dadosVeiculo.modelo}</p>
            <p style="margin:5px 0"><strong>Ano:</strong> ${dadosVeiculo.anoFabricacao && dadosVeiculo.anoModelo ? `${dadosVeiculo.anoFabricacao}/${dadosVeiculo.anoModelo}` : (dadosVeiculo.anoModelo || dadosVeiculo.anoFabricacao || '—')}</p>
            <p style="margin:5px 0"><strong>Placa:</strong> ${dadosVeiculo.placa || '—'}</p>
            <p style="margin:5px 0"><strong>Valor:</strong> ${dadosVeiculo.valor || '—'}</p>
          </div>
        </div>
        <h2 style="font-size:15px;font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Resultado das Simulações</h2>
        ${bancosHtml}
        <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
          Este documento é meramente informativo. As condições finais estão sujeitas a análise de crédito de cada instituição.
        </div>
        <div style="text-align:center;margin-top:20px">
          <button onclick="window.print()" style="background:#8b5cf6;color:white;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer">Imprimir / Salvar PDF</button>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  // Limpar formulários
  const limparTudo = () => {
    setDadosPessoa({ id: '', nome: '', documento: '', telefone: '', dataNascimento: '' })
    setDadosVeiculo({ id: '', placa: '', marca: '', modelo: '', anoFabricacao: new Date().getFullYear(), anoModelo: new Date().getFullYear(), valor: '', entrada: '', tipoVeiculo: 'carro', usarSelect: true })
    lastDocQueriedRef.current = ''
    lastPlacaQueriedRef.current = ''
  }

  // Paywall
  if (liberado === false) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>Simulador de Crédito</h2>
          <p>Orquestre financiamentos em múltiplos bancos em tempo real.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
          <h3>Recurso Premium</h3>
          <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
            O Simulador de Crédito integrado não está ativo no seu plano. Obtenha acesso à simulação automática com múltiplos bancos simultâneos (BV, PAN).
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ferramentas')}>
            Ver Módulos & Assinatura
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Simulador de Crédito</h2>
        <p>Simule e orquestre o financiamento nos portais em paralelo.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Bloco 1: Bancos */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--sv-primary)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>1</div>
            <h3 style={{ margin: 0 }}>Selecione as Financeiras</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {BANCOS.map((b) => {
              const ativo = bancosSelecionados.includes(b.codigo)
              const configurado = credenciaisBanco[b.codigo]?.ativo
              return (
                <div
                  key={b.id}
                  onClick={() => toggleBanco(b.codigo)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: ativo ? 'var(--sv-primary-glow)' : 'var(--sv-surface-dim)',
                    border: `1px solid ${ativo ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    position: 'relative',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={b.logo} alt={b.nome} style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', background: '#fff', padding: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{b.nome}</strong>
                      <span style={{ fontSize: '10px', color: 'var(--sv-text-dim)' }}>
                        {configurado ? '✓ Configurado' : 'Apenas Local'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={ativo}
                        onChange={() => {}}
                        onClick={e => e.stopPropagation()}
                      />
                      Selecionar
                    </label>

                    <button
                      className="btn btn-outline"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={e => {
                        e.stopPropagation()
                        setBancoSelecionadoParaConfig(b.codigo)
                        setUsuarioConfig(credenciaisBanco[b.codigo]?.usuario || '')
                        setShowModalConfig(true)
                      }}
                    >
                      <Edit style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                      Configurar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Grid de Pessoa e Veículo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          
          {/* Bloco 2: Dados do Cliente */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--sv-primary)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>2</div>
              <h3 style={{ margin: 0 }}>Dados do Cliente</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>CPF / CNPJ *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="000.000.000-00" 
                      value={dadosPessoa.documento} 
                      onChange={e => setDadosPessoa({ ...dadosPessoa, documento: mascararCPF(e.target.value) })}
                      onBlur={e => buscarPessoaPorDocumento(e.target.value)}
                      style={{ width: '100%', paddingRight: '32px' }}
                    />
                    {isFetchingPessoa && <Loader2 style={{ width: '16px', height: '16px', position: 'absolute', right: '10px', top: '12px' }} className="animate-spin" />}
                  </div>
                </div>
                <div className="form-group">
                  <label>Data de Nascimento *</label>
                  <input 
                    type="date" 
                    value={dadosPessoa.dataNascimento} 
                    onChange={e => setDadosPessoa({ ...dadosPessoa, dataNascimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nome Completo *</label>
                <input 
                  type="text" 
                  placeholder="Nome do cliente" 
                  value={dadosPessoa.nome} 
                  onChange={e => setDadosPessoa({ ...dadosPessoa, nome: capitalizarNome(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Telefone</label>
                <input 
                  type="text" 
                  placeholder="(00) 00000-0000" 
                  value={dadosPessoa.telefone} 
                  onChange={e => setDadosPessoa({ ...dadosPessoa, telefone: mascararTelefone(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Bloco 3: Dados do Veículo */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--sv-primary)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>3</div>
              <h3 style={{ margin: 0 }}>Dados do Veículo</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Placa *</label>
                  <input 
                    type="text" 
                    placeholder="AAA-0000" 
                    value={dadosVeiculo.placa} 
                    onChange={e => setDadosVeiculo({ ...dadosVeiculo, placa: e.target.value.toUpperCase() })}
                    onFocus={() => {
                      carregarVeiculosEstoque()
                      setShowPlacaDropdown(true)
                    }}
                    onBlur={() => setTimeout(() => setShowPlacaDropdown(false), 200)}
                    style={{ width: '100%' }}
                  />
                  {showPlacaDropdown && veiculosEstoque.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--sv-card-bg, #1a1a1a)',
                      border: '1px solid var(--sv-border)',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                      {veiculosEstoque
                        .filter(v => v.placa.includes(dadosVeiculo.placa.toUpperCase()))
                        .map(v => (
                          <div 
                            key={v.id} 
                            style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--sv-border)' }}
                            onMouseDown={() => {
                              setDadosVeiculo({
                                id: v.id,
                                placa: v.placa,
                                marca: v.marca,
                                modelo: v.modelo,
                                anoFabricacao: v.ano_fabricacao || v.ano_modelo,
                                anoModelo: v.ano_modelo,
                                valor: mascararMoeda(v.preco_venda),
                                entrada: mascararMoeda(v.preco_venda * 0.2),
                                tipoVeiculo: v.tipo || 'carro',
                                usarSelect: false
                              })
                            }}
                          >
                            <strong>{v.placa}</strong> - {v.marca} {v.modelo} ({v.ano_modelo})
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button 
                  className="btn btn-outline" 
                  style={{ height: '42px', padding: '0 12px' }}
                  onClick={() => buscarVeiculoPorPlaca(dadosVeiculo.placa)}
                  disabled={isFetchingVeiculo}
                >
                  {isFetchingVeiculo ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Search style={{ width: 16, height: 16 }} />}
                </button>
              </div>

              <VehicleIdentityFields
                modoBusca={dadosVeiculo.usarSelect ? 'autocomplete' : 'travado'}
                tiposPermitidos={tiposVeiculoFinanciaveis}
                value={{
                  tipo: dadosVeiculo.tipoVeiculo,
                  marca: dadosVeiculo.marca,
                  modelo: dadosVeiculo.modelo,
                  ano_fabricacao: dadosVeiculo.anoFabricacao,
                  ano_modelo: dadosVeiculo.anoModelo,
                }}
                onChange={(patch) => setDadosVeiculo(prev => ({
                  ...prev,
                  ...(patch.tipo !== undefined ? { tipoVeiculo: patch.tipo } : {}),
                  ...(patch.marca !== undefined ? { marca: patch.marca } : {}),
                  ...(patch.modelo !== undefined ? { modelo: patch.modelo } : {}),
                  ...(patch.ano_fabricacao !== undefined ? { anoFabricacao: patch.ano_fabricacao } : {}),
                  ...(patch.ano_modelo !== undefined ? { anoModelo: patch.ano_modelo } : {}),
                }))}
                onDestravar={() => setDadosVeiculo(prev => ({ ...prev, usarSelect: true }))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Valor do Veículo *</label>
                  <input 
                    type="text" 
                    placeholder="R$ 0,00" 
                    value={dadosVeiculo.valor} 
                    onChange={e => {
                      const val = mascararMoeda(e.target.value)
                      setDadosVeiculo({ 
                        ...dadosVeiculo, 
                        valor: val,
                        entrada: dadosVeiculo.entrada ? dadosVeiculo.entrada : mascararMoeda(parseMoeda(val) * 0.2)
                      })
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Entrada (R$)</label>
                  <input 
                    type="text" 
                    placeholder="R$ 0,00" 
                    value={dadosVeiculo.entrada} 
                    onChange={e => setDadosVeiculo({ ...dadosVeiculo, entrada: mascararMoeda(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start', marginTop: '8px' }}>
          <button className="btn btn-outline" onClick={limparTudo}>
            <Trash2 style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Limpar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSimular} 
            disabled={isSimulating}
            style={{ minWidth: '160px' }}
          >
            {isSimulating ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Simulando...
              </>
            ) : (
              <>
                <Calculator style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Simular Financiamento
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal: Configurar Credenciais */}
      {showModalConfig && bancoSelecionadoParaConfig && (
        <div className="modal-overlay" onClick={() => setShowModalConfig(false)}>
          <div className="modal-glass" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ textTransform: 'uppercase' }}>Configurar {bancoSelecionadoParaConfig}</h3>
              <button className="modal-close" onClick={() => setShowModalConfig(false)}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Usuário / Operador</label>
                <input 
                  type="text" 
                  value={usuarioConfig} 
                  onChange={e => setUsuarioConfig(e.target.value)} 
                  placeholder="Operador do portal"
                />
              </div>
              <div className="form-group">
                <label>Senha / Chave de Acesso</label>
                <input 
                  type="password" 
                  value={senhaConfig} 
                  onChange={e => setSenhaConfig(e.target.value)} 
                  placeholder="Senha do portal"
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSalvarCredencial}
                disabled={salvandoCredencial}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {salvandoCredencial ? 'Salvando...' : 'Salvar Credenciais'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resultados da Simulação */}
      {showModalResultados && (
        <div className="modal-overlay" onClick={() => setShowModalResultados(false)}>
          <div className="modal-glass" style={{ maxWidth: '800px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Resultados da Simulação</h3>
              <button className="modal-close" onClick={() => setShowModalResultados(false)}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            
            <div className="modal-body">
              {isSimulating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '16px' }}>
                  <Loader2 className="animate-spin" style={{ width: '48px', height: '48px', color: 'var(--sv-primary)' }} />
                  <span>Consultando financeiras contratadas em paralelo...</span>
                </div>
              ) : resultadosSimulacao.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <AlertCircle style={{ width: '48px', height: '48px', color: 'var(--sv-danger)', marginBottom: '16px' }} />
                  <p>Nenhum resultado retornado.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {resultadosSimulacao.map((r, i) => {
                      const isError = r.status === 'erro' || r.status === 'negado'
                      return (
                        <div 
                          key={i} 
                          className="glass-card" 
                          style={{ 
                            padding: '16px', 
                            border: `1px solid ${isError ? 'var(--sv-danger)' : 'var(--sv-success)'}` 
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <strong style={{ textTransform: 'uppercase' }}>{r.banco}</strong>
                            <span style={{ 
                              fontSize: '11px', 
                              padding: '2px 8px', 
                              borderRadius: '12px',
                              background: isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: isError ? 'var(--sv-danger)' : 'var(--sv-success)',
                              fontWeight: 'bold'
                            }}>
                              {r.status}
                            </span>
                          </div>

                          {!isError ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--sv-text-dim)' }}>Parcela</span>
                                <strong style={{ color: 'var(--sv-success)', fontSize: '16px' }}>
                                  {r.prazo}x {r.parcela ? r.parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--sv-text-dim)' }}>Taxa de Juros</span>
                                <span>{r.taxa}% a.m.</span>
                              </div>
                              {r.total && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                  <span style={{ color: 'var(--sv-text-dim)' }}>Total Financiado</span>
                                  <span>{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: 'var(--sv-danger)', fontSize: '13px', margin: 0 }}>
                              {r.erro || 'Reprovado de acordo com a política de crédito.'}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <button className="btn btn-outline" onClick={imprimirResultados}>
                      <Printer style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                      Imprimir Proposta
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowModalResultados(false)}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Extensão não instalada */}
      {showExtensionRequiredModal && (
        <div className="modal-overlay" onClick={() => setShowExtensionRequiredModal(false)}>
          <div className="modal-glass" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle style={{ color: 'var(--sv-warning)' }} />
                Extensão Requerida
              </h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--sv-text-dim)', margin: 0 }}>
                Para realizar a automação nos portais, você precisa da extensão **Simulador Fácil**.
              </p>
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '13px' }}>
                1. Instale a extensão do Chrome Store.<br />
                2. Realize **logout** e **login novamente** para sincronizar o token.
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <a 
                  href={CHROME_STORE_URL} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
                >
                  <ExternalLink style={{ width: 16, height: 16, marginRight: 8 }} />
                  Instalar
                </a>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowExtensionRequiredModal(false)}>
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mobile Warning */}
      {showDeviceWarningModal && (
        <div className="modal-overlay" onClick={() => setShowDeviceWarningModal(false)}>
          <div className="modal-glass" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone style={{ color: 'var(--sv-warning)' }} />
                Aviso Mobile
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--sv-text-dim)' }}>
                As simulações automáticas exigem a extensão do navegador Chrome no Desktop. No celular, você só poderá consultar dados locais.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '12px' }}
                onClick={() => setShowDeviceWarningModal(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
