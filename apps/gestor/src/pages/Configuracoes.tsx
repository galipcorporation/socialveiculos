import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararCNPJ, mascararTelefone, mascararCEP, capitalizarNome } from '../lib/mascaras'
import { buscarCEP } from '../lib/cep'
import { Link2, Unlink } from 'lucide-react'

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

const CAMPOS: { key: keyof Editaveis; label: string; placeholder?: string }[] = [
  { key: 'nome', label: 'Nome da loja' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'UF', placeholder: 'SP' },
  { key: 'cep', label: 'CEP' },
]

export interface RedeSocialStatus {
  rede: string
  page_id?: string | null
  instagram_account_id?: string | null
  token_expira_em?: string | null
  conectada: boolean
}

export function Configuracoes() {
  const location = useLocation()
  const abaInicial = (location.state as { aba?: string } | null)?.aba
  const [abaAtual, setAbaAtual] = useState<'perfil' | 'credenciais' | 'ia' | 'redes'>(
    abaInicial === 'redes' ? 'redes' : 'perfil'
  )

  const [loja, setLoja] = useState<Loja | null>(null)
  const [form, setForm] = useState<Partial<Editaveis>>({})
  const [percentualComissao, setPercentualComissao] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

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

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      setError(null)
      try {
        const [dataLoja, dataCreds, dataBancos, dataCredsIA, dataRedes] = await Promise.all([
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
        }
        setCredenciais(dataCreds)
        setRedesSociais(dataRedes)
      } catch (err) {
        console.warn('Erro ao carregar configurações:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

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

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--sv-border)', paddingBottom: '12px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {CAMPOS.map(({ key, label, placeholder }) => (
                  <div key={key} className="form-group">
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
                    onChange={e => setIaProvedor(e.target.value as 'anthropic' | 'openai' | 'gemini')}
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
                  <input
                    type="text"
                    value={iaModelo}
                    onChange={e => setIaModelo(e.target.value)}
                    placeholder="claude-haiku-4-5-20251001"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={salvandoIA || !iaApiKey.trim()}>
                    {salvandoIA ? 'Validando e salvando...' : 'Salvar chave'}
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
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
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
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <circle cx="12" cy="12" r="4"/>
                            <circle cx="17.5" cy="6.5" r="0.5" fill={ig ? '#E1306C' : 'var(--sv-text-dim)'}/>
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
        </>
      )}
    </div>
  )
}
