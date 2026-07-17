import { useState, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararCNPJ, mascararTelefone, mascararCEP, capitalizarNome } from '../lib/mascaras'
import { buscarCEP } from '../lib/cep'
import { RichEditor } from '../components/RichEditor'
import { CATALOGO_VARIAVEIS, labelsDe } from '../lib/variaveisContrato'
import { Link2, Unlink, Gem, FileText, ShieldCheck, Upload, AlertTriangle } from 'lucide-react'

interface Loja {
  id: string
  nome: string
  slug: string
  cnpj?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  logo_url?: string
  contrato_cabecalho?: string
  contrato_rodape?: string
  contrato_marca_dagua_url?: string
  contrato_marca_dagua_ativa?: boolean
  percentual_comissao_padrao: number
  verificada: boolean
  ativa: boolean
  created_at: string
}

interface CredencialBanco {
  id: string
  banco: string
  usuario_id: string | null
  escopo: 'loja' | 'vendedor'
  usuario_configurado: string | null
  ativo: boolean
  created_at: string
}

interface BancoSuportado {
  codigo: string
  nome: string
}

const SENHA_MASCARADA = '••••••••'

type Editaveis = Pick<Loja, 'nome' | 'cnpj' | 'telefone' | 'whatsapp' | 'email' | 'endereco' | 'cidade' | 'estado' | 'cep'>

const CAMPOS: { key: keyof Editaveis; label: string; placeholder?: string; gridColumn?: string }[] = [
  { key: 'nome', label: 'Nome da loja', gridColumn: 'span 8' },
  { key: 'cnpj', label: 'CNPJ', gridColumn: 'span 4' },
  { key: 'telefone', label: 'Telefone', gridColumn: 'span 6' },
  { key: 'whatsapp', label: 'WhatsApp', gridColumn: 'span 6' },
  { key: 'email', label: 'E-mail', gridColumn: 'span 6' },
  { key: 'cep', label: 'CEP', gridColumn: 'span 6' },
  { key: 'endereco', label: 'Endereço', gridColumn: 'span 12' },
  { key: 'cidade', label: 'Cidade', gridColumn: 'span 9' },
  { key: 'estado', label: 'UF', placeholder: 'SP', gridColumn: 'span 3' },
]

export interface RedeSocialStatus {
  rede: string
  page_id?: string | null
  instagram_account_id?: string | null
  token_expira_em?: string | null
  conectada: boolean
}

const MODELOS_IA_POR_PROVEDOR: Record<'anthropic' | 'openai' | 'gemini', string[]> = {
  anthropic: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-5.1', 'gpt-5.1-mini', 'gpt-5.1-nano'],
  gemini: ['gemini-3-pro', 'gemini-3-flash'],
}

export function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const escolherNonce = searchParams.get('escolher')

  const location = useLocation()
  const abaInicial = (location.state as { aba?: string } | null)?.aba
  const [abaAtual, setAbaAtual] = useState<'perfil' | 'credenciais' | 'ia' | 'redes' | 'detran' | 'fiscal'>(
    escolherNonce ? 'redes' : (['redes', 'fiscal'] as const).includes(abaInicial as any) ? (abaInicial as 'redes' | 'fiscal') : 'perfil'
  )

  const [loja, setLoja] = useState<Loja | null>(null)
  const [form, setForm] = useState<Partial<Editaveis>>({})
  const [percentualComissao, setPercentualComissao] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

  // Identidade nos contratos (cabeçalho/rodapé/marca-d'água)
  const [cabecalho, setCabecalho] = useState('')
  const [rodape, setRodape] = useState('')
  const [marcaDaguaAtiva, setMarcaDaguaAtiva] = useState(false)
  const [marcaDaguaUrl, setMarcaDaguaUrl] = useState<string | null>(null)
  const [enviandoMarca, setEnviandoMarca] = useState(false)

  // Escolha de página Meta
  const [paginasMeta, setPaginasMeta] = useState<{ page_id: string, name: string, instagram_account_id?: string }[]>([])
  const [loadingPaginas, setLoadingPaginas] = useState(false)
  const [confirmandoPagina, setConfirmandoPagina] = useState(false)

  const handleCepBlur = async (val: string) => {
    const cepLimpo = val.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      setLoadingCep(true)
      try {
        const res = await buscarCEP(cepLimpo)
        if (res) {
          setForm(prev => ({
            ...prev,
            endereco: res.endereco,
            bairro: res.bairro,
            cidade: res.cidade,
            estado: res.estado
          }))
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  // Redes Sociais
  const [redesSociais, setRedesSociais] = useState<RedeSocialStatus[]>([])

  // Credenciais
  const [credenciais, setCredenciais] = useState<CredencialBanco[]>([])
  const [bancosSuportados, setBancosSuportados] = useState<BancoSuportado[]>([])
  const [bancoSelecionado, setBancoSelecionado] = useState('bv')
  const [credUsuario, setCredUsuario] = useState('')
  const [credSenha, setCredSenha] = useState('')
  const [credEscopo, setCredEscopo] = useState<'loja' | 'vendedor'>('loja')
  const [credMostrarSenha, setCredMostrarSenha] = useState(false)
  const [testando, setTestando] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState<{ valido: boolean; mensagem: string } | null>(null)

  // Credenciais IA (BYOK)
  interface CredencialIA { id: string; provedor: string; modelo_padrao: string | null; configurada: boolean; ativo: boolean }
  const [credsIA, setCredsIA] = useState<CredencialIA[]>([])
  const [iaProvedor, setIaProvedor] = useState<'anthropic' | 'openai' | 'gemini'>('anthropic')
  const [iaApiKey, setIaApiKey] = useState('')
  const [iaModelo, setIaModelo] = useState('')
  const [iaMostrarKey, setIaMostrarKey] = useState(false)
  const [salvandoIA, setSalvandoIA] = useState(false)
  const [removendoIA, setRemovendoIA] = useState('')

  // Fornecedor DETRAN (BYOF)
  interface CredencialDetran { configurada: boolean; api_url: string | null; ativo: boolean }
  const [detran, setDetran] = useState<CredencialDetran>({ configurada: false, api_url: null, ativo: false })
  const [detranUrl, setDetranUrl] = useState('')
  const [detranKey, setDetranKey] = useState('')
  const [detranMostrarKey, setDetranMostrarKey] = useState(false)
  const [salvandoDetran, setSalvandoDetran] = useState(false)
  const [removendoDetran, setRemovendoDetran] = useState(false)

  // Fiscal / NF-e
  interface ConfiguracaoFiscalResponse {
    configurada: boolean
    inscricao_estadual?: string | null
    regime_tributario?: string | null
    cnae?: string | null
    ambiente?: string | null
    certificado_configurado?: boolean
    certificado_validade?: string | null
    ativo?: boolean
  }
  const REGIMES_FISCAIS = [
    { value: 'simples', label: 'Simples Nacional' },
    { value: 'presumido', label: 'Lucro Presumido' },
    { value: 'real', label: 'Lucro Real' },
  ]
  const [fiscalLiberado, setFiscalLiberado] = useState<boolean | null>(null)
  const [fiscalConfig, setFiscalConfig] = useState<ConfiguracaoFiscalResponse>({ configurada: false })
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [regimeTributario, setRegimeTributario] = useState('simples')
  const [cnae, setCnae] = useState('')
  const [ambienteFiscal, setAmbienteFiscal] = useState('homologacao')
  const [salvandoFiscal, setSalvandoFiscal] = useState(false)
  const [certificado, setCertificado] = useState<File | null>(null)
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [enviandoCertificado, setEnviandoCertificado] = useState(false)

  useEffect(() => {
    if (abaAtual !== 'fiscal' || fiscalLiberado !== null) return
    const verificar = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const mod = res.find((m) => m.modulo === 'fiscal')
        setFiscalLiberado(mod ? mod.liberado : false)
      } catch {
        setFiscalLiberado(false)
      }
    }
    verificar()
  }, [abaAtual, fiscalLiberado])

  useEffect(() => {
    if (!fiscalLiberado) return
    const carregar = async () => {
      try {
        const res = await api.get<ConfiguracaoFiscalResponse>('/fiscal/config')
        setFiscalConfig(res)
        setInscricaoEstadual(res.inscricao_estadual || '')
        setRegimeTributario(res.regime_tributario || 'simples')
        setCnae(res.cnae || '')
        setAmbienteFiscal(res.ambiente || 'homologacao')
      } catch (err) {
        console.warn('Erro ao carregar configuração fiscal:', err)
      }
    }
    carregar()
  }, [fiscalLiberado])

  const handleSalvarFiscal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvandoFiscal(true)
    try {
      const res = await api.put<ConfiguracaoFiscalResponse>('/fiscal/config', {
        inscricao_estadual: inscricaoEstadual.trim() || null,
        regime_tributario: regimeTributario,
        cnae: cnae.trim() || null,
        ambiente: ambienteFiscal,
        natureza_operacao: 'Venda de veículo usado',
        cfop_venda: '5102',
        ncm_padrao: '87032310',
        origem_mercadoria: '0',
      })
      setFiscalConfig(res)
      useUIStore.getState().showToast('Dados fiscais salvos.', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar dados fiscais.'
      setError(msg)
    } finally {
      setSalvandoFiscal(false)
    }
  }

  const handleEnviarCertificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certificado || !senhaCertificado.trim()) {
      useUIStore.getState().showToast('Selecione o arquivo .pfx e informe a senha.', 'error')
      return
    }
    setEnviandoCertificado(true)
    try {
      const form = new FormData()
      form.append('arquivo', certificado)
      form.append('senha', senhaCertificado)
      const res = await api.post<ConfiguracaoFiscalResponse>('/fiscal/certificado', form)
      setFiscalConfig(res)
      setCertificado(null)
      setSenhaCertificado('')
      useUIStore.getState().showToast('Certificado enviado e validado.', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar certificado.'
      setError(msg)
    } finally {
      setEnviandoCertificado(false)
    }
  }

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      setError(null)
      try {
        const [dataLoja, dataCreds, dataBancos, dataCredsIA, dataRedes, dataDetran] = await Promise.all([
          api.get<Loja>('/configuracoes/loja').catch(err => {
            console.warn('Falha ao obter loja:', err)
            return null
          }),
          api.get<CredencialBanco[]>('/configuracoes/credenciais_banco').catch(err => {
            console.warn('Falha ao obter credenciais banco:', err)
            return []
          }),
          api.get<BancoSuportado[]>('/configuracoes/bancos').catch(err => {
            console.warn('Falha ao obter bancos suportados:', err)
            return []
          }),
          api.get<CredencialIA[]>('/configuracoes/credenciais-ia').catch(err => {
            console.warn('Falha ao obter credenciais ia:', err)
            return []
          }),
          api.get<RedeSocialStatus[]>('/configuracoes/redes-sociais').catch(err => {
            console.warn('Falha ao obter redes sociais:', err)
            return []
          }),
          api.get<CredencialDetran>('/configuracoes/credenciais-detran').catch(err => {
            console.warn('Falha ao obter credencial detran:', err)
            return { configurada: false, api_url: null, ativo: false }
          }),
        ])
        setCredsIA(dataCredsIA)
        setBancosSuportados(dataBancos)
        if (dataBancos.length > 0) setBancoSelecionado(dataBancos[0].codigo)
        if (dataLoja) {
          setLoja(dataLoja)
          setForm({
            nome: dataLoja.nome,
            cnpj: dataLoja.cnpj ? mascararCNPJ(dataLoja.cnpj) : '',
            telefone: dataLoja.telefone ? mascararTelefone(dataLoja.telefone) : '',
            whatsapp: dataLoja.whatsapp ? mascararTelefone(dataLoja.whatsapp) : '',
            email: dataLoja.email ?? '',
            endereco: dataLoja.endereco ?? '',
            cidade: dataLoja.cidade ?? '',
            estado: dataLoja.estado ?? '',
            cep: dataLoja.cep ? mascararCEP(dataLoja.cep) : '',
          })
          setPercentualComissao(String(dataLoja.percentual_comissao_padrao ?? 0))
          setCabecalho(dataLoja.contrato_cabecalho ?? '')
          setRodape(dataLoja.contrato_rodape ?? '')
          setMarcaDaguaAtiva(dataLoja.contrato_marca_dagua_ativa ?? false)
          setMarcaDaguaUrl(dataLoja.contrato_marca_dagua_url ?? null)
        }
        setCredenciais(dataCreds)
        setRedesSociais(dataRedes)
        setDetran(dataDetran)
        if (dataDetran.api_url) setDetranUrl(dataDetran.api_url)
      } catch (err) {
        console.warn('Erro ao carregar configurações:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  useEffect(() => {
    if (abaAtual === 'redes' && escolherNonce) {
      const buscar = async () => {
        setLoadingPaginas(true)
        setError(null)
        try {
          const res = await api.get<any[]>(`/social-auth/meta/paginas?nonce=${escolherNonce}`)
          setPaginasMeta(res)
        } catch (err: any) {
          setError(err.message || 'Erro ao carregar páginas do Facebook.')
        } finally {
          setLoadingPaginas(false)
        }
      }
      buscar()
    } else {
      setPaginasMeta([])
    }
  }, [abaAtual, escolherNonce])

  // Ao trocar de banco/escopo, pré-popula com a credencial já salva (senha mascarada, não sobrescreve por engano)
  useEffect(() => {
    const existente = credenciais.find(c => c.banco === bancoSelecionado && c.escopo === credEscopo && c.ativo)
    if (existente) {
      setCredUsuario(existente.usuario_configurado ?? '')
      setCredSenha(SENHA_MASCARADA)
    } else {
      setCredUsuario('')
      setCredSenha('')
    }
    setResultadoTeste(null)
  }, [bancoSelecionado, credEscopo, credenciais])

  const handleUploadMarcaDagua = async (file: File) => {
    setEnviandoMarca(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const atualizada = await api.post<Loja>('/configuracoes/loja/marca-dagua', fd)
      setMarcaDaguaUrl(atualizada.contrato_marca_dagua_url ?? null)
      setMarcaDaguaAtiva(atualizada.contrato_marca_dagua_ativa ?? true)
      setLoja(atualizada)
      useUIStore.getState().showToast('Marca d\'água enviada.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar marca d\'água.')
    } finally {
      setEnviandoMarca(false)
    }
  }

  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setError(null)
    setSucesso(false)
    try {
      const pct = Math.min(100, Math.max(0, parseFloat(percentualComissao.replace(',', '.')) || 0))
      const atualizada = await api.patch<Loja>('/configuracoes/loja', {
        ...form,
        percentual_comissao_padrao: pct,
        contrato_cabecalho: cabecalho,
        contrato_rodape: rodape,
        contrato_marca_dagua_ativa: marcaDaguaAtiva,
      })
      setPercentualComissao(String(atualizada.percentual_comissao_padrao ?? pct))
      setLoja(atualizada)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const handleTestarConexao = async () => {
    if (!credUsuario.trim() || !credSenha.trim()) {
      setError('Usuário e senha são obrigatórios para testar.')
      return
    }
    setTestando(true)
    setError(null)
    setResultadoTeste(null)
    try {
      const resultado = await api.post<{ valido: boolean; mensagem: string }>('/configuracoes/credenciais_banco/testar', {
        banco: bancoSelecionado,
        usuario: credUsuario.trim(),
        senha: credSenha,
      })
      setResultadoTeste(resultado)
    } catch (err) {
      setResultadoTeste({ valido: false, mensagem: err instanceof Error ? err.message : 'Erro ao testar conexão.' })
    } finally {
      setTestando(false)
    }
  }

  const handleSalvarCredencial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credUsuario.trim() || !credSenha.trim()) {
      setError('Usuário e senha são obrigatórios.')
      return
    }
    setSalvando(true)
    setError(null)
    setSucesso(false)
    try {
      const atualizada = await api.post<CredencialBanco>('/configuracoes/credenciais_banco', {
        banco: bancoSelecionado,
        usuario: credUsuario.trim(),
        senha: credSenha,
        escopo: credEscopo,
      })
      setCredenciais(prev => {
        const idx = prev.findIndex(c => c.banco === atualizada.banco && c.escopo === atualizada.escopo)
        if (idx >= 0) {
          const arr = [...prev]; arr[idx] = atualizada; return arr
        }
        return [...prev, atualizada]
      })
      setSucesso(true)
      setCredUsuario('')
      setCredSenha('')
      setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar credencial.')
    } finally {
      setSalvando(false)
    }
  }

  const handleSalvarCredencialIA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!iaApiKey.trim()) { setError('API Key é obrigatória.'); return }
    setSalvandoIA(true); setError(null); setSucesso(false)
    try {
      const nova = await api.post<CredencialIA>('/configuracoes/credenciais-ia', {
        provedor: iaProvedor,
        api_key: iaApiKey.trim(),
        modelo_padrao: iaModelo.trim() || undefined,
      })
      setCredsIA(prev => {
        const idx = prev.findIndex(c => c.provedor === nova.provedor)
        if (idx >= 0) { const a = [...prev]; a[idx] = nova; return a }
        return [...prev, nova]
      })
      setSucesso(true); setIaApiKey(''); setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar chave de IA.')
    } finally { setSalvandoIA(false) }
  }

  const handleRemoverCredencialIA = async (provedor: string) => {
    const ok = await useUIStore.getState().confirm({
      title: 'Remover credencial',
      message: `Deseja remover a chave ${provedor}?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    setRemovendoIA(provedor)
    try {
      await api.delete(`/configuracoes/credenciais-ia/${provedor}`)
      setCredsIA(prev => prev.filter(c => c.provedor !== provedor))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover chave.')
    } finally { setRemovendoIA('') }
  }

  const handleSalvarDetran = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detranUrl.trim() || !detranKey.trim()) { setError('URL e chave do fornecedor são obrigatórias.'); return }
    setSalvandoDetran(true); setError(null); setSucesso(false)
    try {
      const salva = await api.post<CredencialDetran>('/configuracoes/credenciais-detran', {
        api_url: detranUrl.trim(),
        api_key: detranKey.trim(),
      })
      setDetran(salva)
      setSucesso(true); setDetranKey(''); setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor DETRAN.')
    } finally { setSalvandoDetran(false) }
  }

  const handleRemoverDetran = async () => {
    const ok = await useUIStore.getState().confirm({
      title: 'Remover fornecedor DETRAN',
      message: 'As consultas de débitos e situação voltarão a ficar indisponíveis. Continuar?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    setRemovendoDetran(true)
    try {
      await api.delete('/configuracoes/credenciais-detran')
      setDetran({ configurada: false, api_url: null, ativo: false })
      setDetranUrl(''); setDetranKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover fornecedor.')
    } finally { setRemovendoDetran(false) }
  }

  const handleConectarMeta = async () => {
    setError(null)
    try {
      const res = await api.get<{ url: string }>('/social-auth/meta/iniciar')
      window.location.href = res.url
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('503') || msg.toLowerCase().includes('não configurado') || msg.toLowerCase().includes('nao configurado')) {
        setError('Integração com Meta não configurada. Verifique as variáveis META_APP_ID e META_REDIRECT_URI no servidor.')
      } else {
        setError(msg || 'Erro ao iniciar conexão com Meta.')
      }
    }
  }

  const handleDesconectarRede = async (rede: string) => {
    const ok = await useUIStore.getState().confirm({
      title: `Desconectar ${rede}`,
      message: `Tem certeza que deseja desconectar o ${rede}?`,
      confirmText: 'Desconectar',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    setError(null)
    try {
      await api.delete(`/configuracoes/redes-sociais/${rede}`)
      setRedesSociais(prev => prev.filter(r => r.rede !== rede))
    } catch (err: any) {
      setError(err.message || 'Erro ao desconectar rede social.')
    }
  }

  const getStatusBanco = (banco: string) => {
    const creds = credenciais.filter(c => c.banco === banco && c.ativo)
    if (creds.length === 0) return 'Não configurado'
    const labels = creds.map(c => c.escopo === 'vendedor' ? `Minha: ${c.usuario_configurado ?? '✓'}` : `Loja: ${c.usuario_configurado ?? '✓'}`)
    return labels.join(' · ')
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Configurações</h2>
        <p>Dados de perfil e credenciais da sua loja.</p>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--sv-border)',
        paddingBottom: '12px',
        overflowX: 'auto',
        width: '100%',
        maxWidth: '100%',
        WebkitOverflowScrolling: 'touch',
      }}>
        <button
          onClick={() => setAbaAtual('perfil')}
          style={{
            background: abaAtual === 'perfil' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'perfil' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Perfil da Loja
        </button>
        <button
          onClick={() => setAbaAtual('credenciais')}
          style={{
            background: abaAtual === 'credenciais' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'credenciais' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Credenciais Bancárias (Simulador)
        </button>
        <button
          onClick={() => setAbaAtual('ia')}
          style={{
            background: abaAtual === 'ia' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'ia' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Inteligência Artificial
        </button>
        <button
          onClick={() => setAbaAtual('redes')}
          style={{
            background: abaAtual === 'redes' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'redes' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Redes Sociais
        </button>
        <button
          onClick={() => setAbaAtual('detran')}
          style={{
            background: abaAtual === 'detran' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'detran' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Consulta DETRAN
        </button>
        <button
          onClick={() => setAbaAtual('fiscal')}
          style={{
            background: abaAtual === 'fiscal' ? 'var(--sv-primary)' : 'transparent',
            color: abaAtual === 'fiscal' ? '#fff' : 'var(--sv-text-dim)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Fiscal / NF-e
        </button>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}
      {sucesso && (
        <div className="glass-card" style={{ marginBottom: '24px', color: 'var(--sv-success)', fontWeight: 600 }}>
          ✓ Salvo com sucesso.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {abaAtual === 'perfil' && (
            <form className="glass-card" onSubmit={handleSalvarPerfil}>
              {loja && (
                <div style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--sv-text-dim)', display: 'flex', gap: '16px' }}>
                  <span><strong>Slug:</strong> {loja.slug}</span>
                  <span><strong>Verificada:</strong> {loja.verificada ? 'Sim' : 'Não'}</span>
                </div>
              )}
              <div className="form-grid-12">
                {CAMPOS.map(({ key, label, placeholder, gridColumn }) => (
                  <div key={key} className="form-group" style={{ gridColumn: gridColumn || 'span 6' }}>
                    <label>{label}</label>
                    <input
                      value={(form[key] as string) ?? ''}
                      onChange={(e) => {
                        let val = e.target.value
                        if (key === 'cnpj') val = mascararCNPJ(val)
                        if (key === 'telefone' || key === 'whatsapp') val = mascararTelefone(val)
                        if (key === 'cep') val = mascararCEP(val)
                        if (key === 'nome' || key === 'cidade' || key === 'endereco') val = capitalizarNome(val)
                        setForm({ ...form, [key]: val })
                      }}
                      onBlur={() => {
                        if (key === 'cep') {
                          handleCepBlur((form[key] as string) ?? '')
                        }
                      }}
                      placeholder={key === 'cep' && loadingCep ? "Buscando..." : placeholder}
                      disabled={key === 'cep' && loadingCep}
                      maxLength={key === 'estado' ? 2 : (key === 'cep' ? 9 : undefined)}
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--sv-border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Comissão de vendas</div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Comissão padrão da loja (%)</label>
                    <input
                      value={percentualComissao}
                      onChange={(e) => setPercentualComissao(e.target.value.replace(/[^\d.,]/g, ''))}
                      placeholder="0"
                      style={{ width: '160px' }}
                      inputMode="decimal"
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--sv-text-muted)', maxWidth: '460px', margin: 0, paddingBottom: '8px' }}>
                    Aplicada automaticamente a cada venda registrada. Membros com % próprio
                    (em Equipe) usam o valor individual.
                  </p>
                </div>
              </div>

              {/* ── Identidade nos contratos ── */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--sv-border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Identidade nos contratos</div>
                <p style={{ fontSize: '12px', color: 'var(--sv-text-muted)', margin: '0 0 16px', maxWidth: '620px' }}>
                  Cabeçalho, rodapé e marca d'água aplicados a todos os contratos. Repetem no topo e no rodapé de cada página impressa.
                  Cada modelo pode desativá-los individualmente. Você pode misturar texto, imagem e variáveis (ex: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>&#123;&#123;loja.cnpj&#125;&#125;</code>).
                </p>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Cabeçalho do documento</label>
                  <RichEditor
                    value={cabecalho}
                    onChange={setCabecalho}
                    variaveis={CATALOGO_VARIAVEIS}
                    labels={labelsDe(CATALOGO_VARIAVEIS)}
                    minHeight={80}
                    compact
                    placeholder="Ex: logo, nome da loja, endereço…"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Rodapé do documento</label>
                  <RichEditor
                    value={rodape}
                    onChange={setRodape}
                    variaveis={CATALOGO_VARIAVEIS}
                    labels={labelsDe(CATALOGO_VARIAVEIS)}
                    minHeight={60}
                    compact
                    placeholder="Ex: Documento gerado em {{contrato.data}}"
                  />
                </div>

                {/* Marca d'água */}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', borderRadius: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>Exibir marca d'água ao fundo</strong>
                    <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', marginTop: 2 }}>Imagem clara e centralizada em cada página. Sem imagem própria, usa a logo da loja.</div>
                  </div>
                  <input type="checkbox" checked={marcaDaguaAtiva} onChange={(e) => setMarcaDaguaAtiva(e.target.checked)} style={{ width: 18, height: 18, flexShrink: 0, accentColor: 'var(--sv-primary)' }} />
                </label>

                {marcaDaguaAtiva && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {marcaDaguaUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sv-overlay-soft)', border: '1px solid var(--sv-border)', borderRadius: 8, padding: '8px 12px' }}>
                        <img src={marcaDaguaUrl} alt="marca d'água" style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} />
                        <span style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Imagem atual</span>
                      </div>
                    )}
                    <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Upload style={{ width: 15, height: 15 }} />
                      {enviandoMarca ? 'Enviando…' : (marcaDaguaUrl ? 'Trocar imagem' : 'Enviar imagem específica')}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        disabled={enviandoMarca}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadMarcaDagua(f); e.target.value = '' }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn btn-primary" type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}

          {abaAtual === 'credenciais' && (
            <div className="glass-card">
              <p style={{ color: 'var(--sv-text-dim)', marginBottom: '24px', fontSize: '14px' }}>
                Configure as credenciais das APIs bancárias para permitir a simulação de crédito automática.
                Os dados são armazenados de forma segura utilizando criptografia forte (Fernet).
              </p>

              <div style={{ display: 'flex', gap: '24px' }}>
                {/* Lista de Bancos */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bancosSuportados.map(({ codigo: b, nome }) => (
                    <button
                      key={b}
                      onClick={() => setBancoSelecionado(b)}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        background: bancoSelecionado === b ? 'var(--sv-overlay-soft)' : 'var(--sv-input-bg)',
                        border: `1px solid ${bancoSelecionado === b ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                        color: 'var(--sv-text)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>
                          {nome}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--sv-text-dim)' }}>
                          Status: {getStatusBanco(b)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Formulário do Banco Selecionado */}
                <div style={{ flex: 2 }}>
                  <form onSubmit={handleSalvarCredencial} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', margin: 0 }}>
                      Configurar: {bancosSuportados.find(b => b.codigo === bancoSelecionado)?.nome ?? bancoSelecionado.toUpperCase()}
                    </h3>

                    {/* Escopo */}
                    <div className="form-group">
                      <label>Escopo</label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 6 }}>
                        {(['loja', 'vendedor'] as const).map(esc => (
                          <button
                            key={esc}
                            type="button"
                            onClick={() => setCredEscopo(esc)}
                            style={{
                              padding: '6px 16px',
                              borderRadius: 6,
                              border: `1px solid ${credEscopo === esc ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                              background: credEscopo === esc ? 'var(--sv-primary-glow)' : 'transparent',
                              color: credEscopo === esc ? 'var(--sv-primary)' : 'var(--sv-text-dim)',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: credEscopo === esc ? 600 : 400,
                            }}
                          >
                            {esc === 'loja' ? 'Desta loja' : 'Minha credencial'}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--sv-text-dim)', margin: 0 }}>
                        {credEscopo === 'loja'
                          ? 'Credencial compartilhada com toda a equipe. Somente gestores podem alterar.'
                          : 'Credencial pessoal. Suas simulações usarão esta em vez da da loja.'}
                      </p>
                    </div>

                    {/* Usuário */}
                    <div className="form-group">
                      <label>Usuário / Login</label>
                      <input
                        type="text"
                        value={credUsuario}
                        onChange={e => setCredUsuario(e.target.value)}
                        placeholder="Usuário cadastrado no banco"
                        autoComplete="off"
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Senha */}
                    <div className="form-group">
                      <label>Senha</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={credMostrarSenha ? 'text' : 'password'}
                          value={credSenha}
                          onChange={e => setCredSenha(e.target.value)}
                          placeholder="Senha"
                          autoComplete="new-password"
                          style={{ width: '100%', paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setCredMostrarSenha(v => !v)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--sv-text-dim)', cursor: 'pointer', fontSize: 13 }}
                        >
                          {credMostrarSenha ? '🙈' : '👁'}
                        </button>
                      </div>
                    </div>

                    {resultadoTeste && (
                      <p style={{
                        fontSize: 13,
                        margin: 0,
                        color: resultadoTeste.valido ? 'var(--sv-success)' : 'var(--sv-error)',
                      }}>
                        {resultadoTeste.valido ? '✓ ' : '✗ '}
                        {resultadoTeste.mensagem || (resultadoTeste.valido ? 'Credenciais válidas.' : 'Credenciais inválidas.')}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={handleTestarConexao}
                        disabled={testando || salvando || !credUsuario.trim() || !credSenha.trim()}
                      >
                        {testando ? 'Testando...' : 'Testar conexão'}
                      </button>
                      <button className="btn btn-primary" type="submit" disabled={salvando || !credUsuario.trim() || !credSenha.trim()}>
                        {salvando ? 'Salvando...' : 'Salvar credencial cifrada'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {abaAtual === 'ia' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <p style={{ fontSize: 14, color: 'var(--sv-text-dim)', margin: 0 }}>
                Configure sua própria chave de IA (BYOK). Ao usar sua chave, o custo das chamadas é cobrado na sua conta do provedor.
                Se não configurar, o módulo de Marketing usa a chave da plataforma.
              </p>

              {/* Credenciais existentes */}
              {credsIA.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Configuradas</h4>
                  {credsIA.map(c => (
                    <div key={c.provedor} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--sv-border)', background: 'var(--sv-overlay-soft)' }}>
                      <div>
                        <strong style={{ textTransform: 'capitalize' }}>{c.provedor}</strong>
                        {c.modelo_padrao && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--sv-text-muted)' }}>{c.modelo_padrao}</span>}
                        <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--sv-success)' }}>✓ Configurada</span>
                      </div>
                      <button
                        onClick={() => handleRemoverCredencialIA(c.provedor)}
                        disabled={removendoIA === c.provedor}
                        style={{ background: 'none', border: '1px solid var(--sv-error)', color: 'var(--sv-error)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
                      >
                        {removendoIA === c.provedor ? 'Removendo...' : 'Remover'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário nova chave */}
              <form onSubmit={handleSalvarCredencialIA} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Adicionar / atualizar chave</h4>

                <div className="form-group">
                  <label>Provedor</label>
                  <select
                    className="filter-select"
                    value={iaProvedor}
                    onChange={e => {
                      setIaProvedor(e.target.value as 'anthropic' | 'openai' | 'gemini')
                      setIaModelo('')
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>API Key</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={iaMostrarKey ? 'text' : 'password'}
                      value={iaApiKey}
                      onChange={e => setIaApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      autoComplete="new-password"
                      style={{ width: '100%', paddingRight: '40px' }}
                    />
                    <button type="button" onClick={() => setIaMostrarKey(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--sv-text-dim)', cursor: 'pointer', fontSize: 13 }}>
                      {iaMostrarKey ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Modelo padrão (opcional)</label>
                  <select
                    className="filter-select"
                    value={iaModelo}
                    onChange={e => setIaModelo(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Padrão da plataforma</option>
                    {MODELOS_IA_POR_PROVEDOR[iaProvedor].map(modelo => (
                      <option key={modelo} value={modelo}>{modelo}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>
                    Deixe em "Padrão da plataforma" para usar o modelo recomendado automaticamente.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={salvandoIA || !iaApiKey.trim()}>
                    {salvandoIA ? 'Validando e salvando...' : 'Salvar chave'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {abaAtual === 'detran' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <p style={{ fontSize: 14, color: 'var(--sv-text-dim)', margin: 0 }}>
                Conecte o seu fornecedor de consulta veicular para exibir débitos (IPVA, licenciamento, multas) e a situação
                da transferência/ATPV-e direto na esteira de pós-venda. Sem fornecedor configurado, essas consultas ficam
                indisponíveis.
              </p>

              <div style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--sv-border)', background: 'var(--sv-overlay-soft)', fontSize: 13, color: 'var(--sv-text-muted)' }}>
                <strong style={{ color: 'var(--sv-text-dim)' }}>Integração com API Veicular</strong>
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Insira abaixo os dados de acesso da API do seu fornecedor de consultas veiculares. O sistema consultará automaticamente os seguintes dados:
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                    <li><strong>Débitos veiculares</strong> (IPVA, licenciamento e multas) através da rota <code style={{ fontFamily: 'monospace', fontSize: 12 }}>/debitos</code>.</li>
                    <li><strong>Situação da transferência</strong> (status do ATPV-e e proprietário atual) através da rota <code style={{ fontFamily: 'monospace', fontSize: 12 }}>/situacao</code>.</li>
                  </ul>
                </div>
              </div>

              {detran.configurada && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--sv-border)', background: 'var(--sv-overlay-soft)' }}>
                  <div>
                    <strong>Fornecedor configurado</strong>
                    {detran.api_url && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--sv-text-muted)' }}>{detran.api_url}</span>}
                    <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--sv-success)' }}>✓ Ativo</span>
                  </div>
                  <button
                    onClick={handleRemoverDetran}
                    disabled={removendoDetran}
                    style={{ background: 'none', border: '1px solid var(--sv-error)', color: 'var(--sv-error)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
                  >
                    {removendoDetran ? 'Removendo...' : 'Remover'}
                  </button>
                </div>
              )}

              <form onSubmit={handleSalvarDetran} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
                  {detran.configurada ? 'Atualizar fornecedor' : 'Conectar fornecedor'}
                </h4>

                <div className="form-group">
                  <label>URL base do fornecedor</label>
                  <input
                    type="text"
                    value={detranUrl}
                    onChange={e => setDetranUrl(e.target.value)}
                    placeholder="https://api.seufornecedor.com/detran"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label>Chave de API</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={detranMostrarKey ? 'text' : 'password'}
                      value={detranKey}
                      onChange={e => setDetranKey(e.target.value)}
                      placeholder={detran.configurada ? '•••••••• (deixe para manter a atual)' : 'Sua chave do fornecedor'}
                      autoComplete="new-password"
                      style={{ width: '100%', paddingRight: '40px' }}
                    />
                    <button type="button" onClick={() => setDetranMostrarKey(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--sv-text-dim)', cursor: 'pointer', fontSize: 13 }}>
                      {detranMostrarKey ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={salvandoDetran || !detranUrl.trim() || !detranKey.trim()}>
                    {salvandoDetran ? 'Salvando...' : 'Salvar fornecedor'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {abaAtual === 'redes' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: 14, color: 'var(--sv-text-dim)', margin: 0, maxWidth: '600px' }}>
                    Conecte a página do Facebook e a conta do Instagram Business da sua loja para automatizar a publicação e agendamento de posts de marketing.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleConectarMeta}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Link2 style={{ width: 16, height: 16 }} />
                  Conecte via Meta OAuth
                </button>
              </div>

              {loadingPaginas && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sv-primary)' }}>
                  <div className="spinner" style={{ width: 18, height: 18 }}></div>
                  <span>Carregando suas páginas da Meta...</span>
                </div>
              )}

              {paginasMeta.length > 0 && (
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'var(--sv-surface-dim)',
                  border: '1px solid var(--sv-primary-glow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <h4 style={{ margin: 0 }}>Selecione a página do Facebook para conectar:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {paginasMeta.map(p => (
                      <button
                        key={p.page_id}
                        onClick={async () => {
                          setConfirmandoPagina(true)
                          setError(null)
                          try {
                            await api.post('/social-auth/meta/confirmar', { nonce: escolherNonce, page_id: p.page_id })
                            setSearchParams({}) // Limpa os parâmetros de busca da URL
                            const dataRedes = await api.get<RedeSocialStatus[]>('/configuracoes/redes-sociais')
                            setRedesSociais(dataRedes)
                            useUIStore.getState().showToast('Página conectada com sucesso!', 'success')
                          } catch (err: any) {
                            setError(err.message || 'Erro ao confirmar página.')
                          } finally {
                            setConfirmandoPagina(false)
                          }
                        }}
                        className="btn btn-outline"
                        disabled={confirmandoPagina}
                        style={{ justifyContent: 'flex-start', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', width: '100%' }}
                      >
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--sv-text-dim)' }}>
                          ID da Página: {p.page_id} {p.instagram_account_id ? `· Instagram: ${p.instagram_account_id}` : '· Sem conta do Instagram Business vinculada'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSearchParams({})}
                    className="btn btn-ghost"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Cancelar escolha
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '8px' }}>
                {/* Card Facebook */}
                {(() => {
                  const fb = redesSociais.find(r => r.rede === 'facebook')
                  return (
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      background: 'var(--sv-surface-dim)',
                      border: `1px solid ${fb ? 'var(--sv-primary-glow)' : 'var(--sv-border)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: fb ? 'rgba(59, 130, 246, 0.15)' : 'var(--sv-overlay-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill={fb ? '#1877F2' : 'var(--sv-text-dim)'}>
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                          </svg>
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '15px' }}>Facebook</strong>
                          <span style={{ fontSize: '12px', color: fb ? 'var(--sv-success)' : 'var(--sv-text-muted)' }}>
                            {fb ? '✓ Conectado' : 'Não conectado'}
                          </span>
                        </div>
                      </div>

                      {fb && (
                        <div style={{ fontSize: '13px', color: 'var(--sv-text-dim)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong>ID da Página:</strong> {fb.page_id || 'N/A'}</div>
                          {fb.token_expira_em && (
                            <div><strong>Expira em:</strong> {new Date(fb.token_expira_em).toLocaleDateString()}</div>
                          )}
                        </div>
                      )}

                      {fb && (
                        <button
                          className="btn btn-outline"
                          onClick={() => handleDesconectarRede('facebook')}
                          style={{ borderColor: 'var(--sv-error)', color: 'var(--sv-error)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Unlink style={{ width: 14, height: 14 }} />
                          Desconectar
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Card Instagram */}
                {(() => {
                  const ig = redesSociais.find(r => r.rede === 'instagram')
                  return (
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      background: 'var(--sv-surface-dim)',
                      border: `1px solid ${ig ? 'var(--sv-primary-glow)' : 'var(--sv-border)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: ig ? 'rgba(236, 72, 153, 0.15)' : 'var(--sv-overlay-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ig ? '#E1306C' : 'var(--sv-text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17.5" cy="6.5" r="0.5" fill={ig ? '#E1306C' : 'var(--sv-text-dim)'} />
                          </svg>
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '15px' }}>Instagram Business</strong>
                          <span style={{ fontSize: '12px', color: ig ? 'var(--sv-success)' : 'var(--sv-text-muted)' }}>
                            {ig ? '✓ Conectado' : 'Não conectado'}
                          </span>
                        </div>
                      </div>

                      {ig && (
                        <div style={{ fontSize: '13px', color: 'var(--sv-text-dim)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong>ID da Conta:</strong> {ig.instagram_account_id || 'N/A'}</div>
                          {ig.token_expira_em && (
                            <div><strong>Expira em:</strong> {new Date(ig.token_expira_em).toLocaleDateString()}</div>
                          )}
                        </div>
                      )}

                      {ig && (
                        <button
                          className="btn btn-outline"
                          onClick={() => handleDesconectarRede('instagram')}
                          style={{ borderColor: 'var(--sv-error)', color: 'var(--sv-error)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Unlink style={{ width: 14, height: 14 }} />
                          Desconectar
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {abaAtual === 'fiscal' && (
            fiscalLiberado === false ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
                <h3>Recurso Premium</h3>
                <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
                  O módulo Fiscal não está ativo no seu plano. Emita NF-e de venda sem precisar de um sistema fiscal à parte.
                </p>
              </div>
            ) : fiscalLiberado === null ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {(() => {
                  const diasParaVencer = fiscalConfig.certificado_validade
                    ? Math.ceil((new Date(fiscalConfig.certificado_validade).getTime() - Date.now()) / 86400000)
                    : null
                  return (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8,
                        background: fiscalConfig.ativo ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${fiscalConfig.ativo ? 'var(--sv-success)' : 'var(--sv-warning, #f59e0b)'}`,
                        fontSize: 13,
                      }}>
                        {fiscalConfig.ativo
                          ? <ShieldCheck style={{ width: 16, height: 16, color: 'var(--sv-success)', flexShrink: 0 }} />
                          : <AlertTriangle style={{ width: 16, height: 16, color: 'var(--sv-warning, #f59e0b)', flexShrink: 0 }} />}
                        <span style={{ color: fiscalConfig.ativo ? 'var(--sv-success)' : 'var(--sv-warning, #f59e0b)' }}>
                          {fiscalConfig.ativo
                            ? `Emissão de NF-e habilitada (ambiente: ${fiscalConfig.ambiente}).`
                            : 'Emissão de NF-e bloqueada — complete os dados fiscais e envie o certificado A1.'}
                        </span>
                      </div>

                      {diasParaVencer !== null && diasParaVencer < 30 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8,
                          background: 'rgba(239,68,68,0.08)', border: '1px solid var(--sv-error)', fontSize: 13,
                        }}>
                          <AlertTriangle style={{ width: 16, height: 16, color: 'var(--sv-error)', flexShrink: 0 }} />
                          <span style={{ color: 'var(--sv-error)' }}>
                            {diasParaVencer > 0
                              ? `Certificado vence em ${diasParaVencer} dia(s) — renove para não interromper as emissões.`
                              : 'Certificado vencido — envie um novo para voltar a emitir NF-e.'}
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}

                <div className="glass-card">
                  <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
                    Dados fiscais
                  </h4>
                  <form onSubmit={handleSalvarFiscal} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Inscrição Estadual</label>
                        <input type="text" value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} placeholder="000.000.000.000" style={{ width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <label>Regime Tributário</label>
                        <select value={regimeTributario} onChange={e => setRegimeTributario(e.target.value)} style={{ width: '100%' }}>
                          {REGIMES_FISCAIS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>CNAE</label>
                        <input type="text" value={cnae} onChange={e => setCnae(e.target.value)} placeholder="4511-1/02" style={{ width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <label>Ambiente</label>
                        <select value={ambienteFiscal} onChange={e => setAmbienteFiscal(e.target.value)} style={{ width: '100%' }}>
                          <option value="homologacao">Homologação (testes)</option>
                          <option value="producao">Produção</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={salvandoFiscal} style={{ alignSelf: 'flex-start' }}>
                      {salvandoFiscal ? 'Salvando…' : 'Salvar dados fiscais'}
                    </button>
                  </form>
                </div>

                <div className="glass-card">
                  <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
                    Certificado Digital A1
                  </h4>
                  {fiscalConfig.certificado_configurado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--sv-border)', background: 'var(--sv-overlay-soft)', marginBottom: 16 }}>
                      <FileText style={{ width: 18, height: 18, color: 'var(--sv-success)' }} />
                      <span>Certificado configurado{fiscalConfig.certificado_validade ? ` — validade ${new Date(fiscalConfig.certificado_validade).toLocaleDateString('pt-BR')}` : ''}</span>
                    </div>
                  )}
                  <form onSubmit={handleEnviarCertificado} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Arquivo do certificado (.pfx)</label>
                        <input type="file" accept=".pfx" onChange={e => setCertificado(e.target.files?.[0] || null)} style={{ width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <label>Senha do certificado</label>
                        <input type="password" value={senhaCertificado} onChange={e => setSenhaCertificado(e.target.value)} placeholder="Senha do arquivo .pfx" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={enviandoCertificado} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Upload style={{ width: 16, height: 16 }} />
                      {enviandoCertificado ? 'Enviando…' : (fiscalConfig.certificado_configurado ? 'Atualizar certificado' : 'Enviar certificado')}
                    </button>
                  </form>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
