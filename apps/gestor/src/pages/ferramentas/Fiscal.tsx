import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { Gem, FileText, ShieldCheck, Upload, AlertTriangle } from 'lucide-react'

interface ConfiguracaoFiscalResponse {
  configurada: boolean
  inscricao_estadual?: string | null
  regime_tributario?: string | null
  cnae?: string | null
  ambiente?: string | null
  natureza_operacao?: string | null
  cfop_venda?: string | null
  ncm_padrao?: string | null
  certificado_configurado?: boolean
  certificado_validade?: string | null
  ativo?: boolean
}

const REGIMES = [
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'presumido', label: 'Lucro Presumido' },
  { value: 'real', label: 'Lucro Real' },
]

export function FiscalPage() {
  const showToast = useUIStore((s) => s.showToast)
  const navigate = useNavigate()

  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [config, setConfig] = useState<ConfiguracaoFiscalResponse>({ configurada: false })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [regimeTributario, setRegimeTributario] = useState('simples')
  const [cnae, setCnae] = useState('')
  const [ambiente, setAmbiente] = useState('homologacao')

  const [certificado, setCertificado] = useState<File | null>(null)
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [enviandoCertificado, setEnviandoCertificado] = useState(false)

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get<any[]>('/assinaturas/modulos')
        const mod = res.find((m) => m.modulo === 'fiscal')
        setLiberado(mod ? mod.liberado : false)
      } catch {
        setLiberado(false)
      }
    }
    verificar()
  }, [])

  useEffect(() => {
    if (!liberado) { setLoading(false); return }
    const carregar = async () => {
      setLoading(true)
      try {
        const res = await api.get<ConfiguracaoFiscalResponse>('/fiscal/config')
        setConfig(res)
        setInscricaoEstadual(res.inscricao_estadual || '')
        setRegimeTributario(res.regime_tributario || 'simples')
        setCnae(res.cnae || '')
        setAmbiente(res.ambiente || 'homologacao')
      } catch (err) {
        console.warn('Erro ao carregar configuração fiscal:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [liberado])

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await api.put<ConfiguracaoFiscalResponse>('/fiscal/config', {
        inscricao_estadual: inscricaoEstadual.trim() || null,
        regime_tributario: regimeTributario,
        cnae: cnae.trim() || null,
        ambiente,
        natureza_operacao: 'Venda de veículo usado',
        cfop_venda: '5102',
        ncm_padrao: '87032310',
        origem_mercadoria: '0',
      })
      setConfig(res)
      showToast('Dados fiscais salvos.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao salvar dados fiscais.', details)
    } finally {
      setSalvando(false)
    }
  }

  const handleEnviarCertificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certificado || !senhaCertificado.trim()) {
      showToast('Selecione o arquivo .pfx e informe a senha.', 'error')
      return
    }
    setEnviandoCertificado(true)
    try {
      const form = new FormData()
      form.append('arquivo', certificado)
      form.append('senha', senhaCertificado)
      const res = await api.post<ConfiguracaoFiscalResponse>('/fiscal/certificado', form)
      setConfig(res)
      setCertificado(null)
      setSenhaCertificado('')
      showToast('Certificado enviado e validado.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao enviar certificado.', details)
    } finally {
      setEnviandoCertificado(false)
    }
  }

  if (liberado === false) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>Fiscal / NF-e</h2>
          <p>Emita nota fiscal de venda direto do contrato, com impostos calculados automaticamente.</p>
        </div>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Gem style={{ width: 48, height: 48, color: 'var(--sv-primary)', marginBottom: 16 }} />
          <h3>Recurso Premium</h3>
          <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, marginBottom: 24 }}>
            O módulo Fiscal não está ativo no seu plano. Emita NF-e de venda sem precisar de um sistema fiscal à parte.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ferramentas')}>
            Ver Módulos &amp; Assinatura
          </button>
        </div>
      </div>
    )
  }

  if (loading || liberado === null) {
    return <div className="empty-state">Carregando…</div>
  }

  const diasParaVencer = config.certificado_validade
    ? Math.ceil((new Date(config.certificado_validade).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Fiscal / NF-e</h2>
        <p>Configure os dados fiscais e o certificado A1 da loja para emitir NF-e de venda.</p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, marginBottom: 20,
        background: config.ativo ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${config.ativo ? 'var(--sv-success)' : 'var(--sv-warning, #f59e0b)'}`,
        fontSize: 13,
      }}>
        {config.ativo
          ? <ShieldCheck style={{ width: 16, height: 16, color: 'var(--sv-success)', flexShrink: 0 }} />
          : <AlertTriangle style={{ width: 16, height: 16, color: 'var(--sv-warning, #f59e0b)', flexShrink: 0 }} />}
        <span style={{ color: config.ativo ? 'var(--sv-success)' : 'var(--sv-warning, #f59e0b)' }}>
          {config.ativo
            ? `Emissão de NF-e habilitada (ambiente: ${config.ambiente}).`
            : 'Emissão de NF-e bloqueada — complete os dados fiscais e envie o certificado A1.'}
        </span>
      </div>

      {diasParaVencer !== null && diasParaVencer < 30 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, marginBottom: 20,
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

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
          Dados fiscais
        </h4>
        <form onSubmit={handleSalvarConfig} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Inscrição Estadual</label>
            <input type="text" value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)} placeholder="000.000.000.000" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>Regime Tributário</label>
            <select value={regimeTributario} onChange={e => setRegimeTributario(e.target.value)} style={{ width: '100%' }}>
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>CNAE</label>
            <input type="text" value={cnae} onChange={e => setCnae(e.target.value)} placeholder="4511-1/02" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>Ambiente</label>
            <select value={ambiente} onChange={e => setAmbiente(e.target.value)} style={{ width: '100%' }}>
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={salvando} style={{ alignSelf: 'flex-start' }}>
            {salvando ? 'Salvando…' : 'Salvar dados fiscais'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h4 style={{ margin: '0 0 16px', fontSize: 13, textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>
          Certificado Digital A1
        </h4>
        {config.certificado_configurado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--sv-border)', background: 'var(--sv-overlay-soft)', marginBottom: 16 }}>
            <FileText style={{ width: 18, height: 18, color: 'var(--sv-success)' }} />
            <span>Certificado configurado{config.certificado_validade ? ` — validade ${new Date(config.certificado_validade).toLocaleDateString('pt-BR')}` : ''}</span>
          </div>
        )}
        <form onSubmit={handleEnviarCertificado} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Arquivo do certificado (.pfx)</label>
            <input type="file" accept=".pfx" onChange={e => setCertificado(e.target.files?.[0] || null)} />
          </div>
          <div className="form-group">
            <label>Senha do certificado</label>
            <input type="password" value={senhaCertificado} onChange={e => setSenhaCertificado(e.target.value)} placeholder="Senha do arquivo .pfx" style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={enviandoCertificado} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload style={{ width: 16, height: 16 }} />
            {enviandoCertificado ? 'Enviando…' : (config.certificado_configurado ? 'Atualizar certificado' : 'Enviar certificado')}
          </button>
        </form>
      </div>
    </div>
  )
}
