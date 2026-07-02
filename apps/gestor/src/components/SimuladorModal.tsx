import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararCPF, mascararTelefone, mascararMoeda, parseMoeda, mascararData, capitalizarNome } from '../lib/mascaras'

interface SimuladorModalProps {
  veiculo: any
  onClose: () => void
}

interface SimulacaoResult {
  banco: string
  status: string
  parcela?: number
  taxa?: number
  total?: number
  prazo?: number
  erro?: string
}

export function SimuladorModal({ veiculo, onClose }: SimuladorModalProps) {
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [telefone, setTelefone] = useState('')
  
  const [entrada, setEntrada] = useState(veiculo.preco_venda ? veiculo.preco_venda * 0.2 : 0)
  const [entradaStr, setEntradaStr] = useState(mascararMoeda(veiculo.preco_venda ? veiculo.preco_venda * 0.2 : 0))
  const [bancos, setBancos] = useState<string[]>(['bv', 'pan', 'creditas'])
  
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState<SimulacaoResult[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Paywall
  const [paywall, setPaywall] = useState(false)

  const handleSimular = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cpf || !nome) {
      setError('CPF e Nome são obrigatórios para simulação.')
      return
    }

    setLoading(true)
    setError(null)
    setResultados([])
    setPaywall(false)

    try {
      const resp = await api.post<any>('/simulador', {
        veiculo_id: veiculo.id,
        entrada,
        bancos,
        cliente_dados: {
          cpf,
          nome,
          nascimento,
          telefone
        }
      })
      
      if (resp.resultados) {
        setResultados(resp.resultados)
      }
    } catch (err: any) {
      if (err.status === 402 || err.message?.includes('Módulo SIMULADOR não ativo')) {
        setPaywall(true)
      } else {
        setError(err.message || 'Erro ao realizar simulação.')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val?: number) => {
    if (!val) return '—'
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%' }}>
        <div className="modal-header">
          <h3>Simular Crédito - {veiculo.marca} {veiculo.modelo}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', gap: '24px' }}>
          
          {/* Formulário de Dados */}
          <div style={{ flex: 1, borderRight: '1px solid var(--sv-border)', paddingRight: '24px' }}>
            <form onSubmit={handleSimular} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)', fontWeight: 600 }}>CPF do Cliente *</label>
                <input required type="text" value={cpf} onChange={e => setCpf(mascararCPF(e.target.value))} style={inputStyle} placeholder="000.000.000-00" />
              </div>
              
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)', fontWeight: 600 }}>Nome Completo *</label>
                <input required type="text" value={nome} onChange={e => setNome(capitalizarNome(e.target.value))} style={inputStyle} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)', fontWeight: 600 }}>Nascimento</label>
                  <input type="text" value={nascimento} onChange={e => setNascimento(mascararData(e.target.value))} style={inputStyle} placeholder="DD/MM/AAAA" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)', fontWeight: 600 }}>Telefone</label>
                  <input type="text" value={telefone} onChange={e => setTelefone(mascararTelefone(e.target.value))} style={inputStyle} placeholder="(11) 90000-0000" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)', fontWeight: 600 }}>Valor de Entrada (R$)</label>
                <input
                  required
                  type="text"
                  value={entradaStr}
                  onChange={e => {
                    const masked = mascararMoeda(e.target.value)
                    setEntradaStr(masked)
                    setEntrada(parseMoeda(masked))
                  }}
                  style={inputStyle}
                />
                <p style={{ fontSize: '11px', color: 'var(--sv-text-dim)', marginTop: '4px' }}>
                  Veículo: {formatCurrency(veiculo.preco_venda)}
                </p>
              </div>

              {error && <div style={{ color: 'var(--sv-danger)', fontSize: '13px' }}>{error}</div>}

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px' }}>
                {loading ? 'Simulando em paralelo...' : 'Executar Simulação V2'}
              </button>
            </form>
          </div>

          {/* Resultados */}
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--sv-text)', fontSize: '14px', textTransform: 'uppercase' }}>Resultados</h4>
            
            {paywall ? (
              <div style={{ padding: '24px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--sv-danger)' }}>
                <h4 style={{ color: 'var(--sv-danger)', margin: '0 0 8px 0' }}>Módulo Bloqueado</h4>
                <p style={{ color: 'var(--sv-text-dim)', fontSize: '14px' }}>A simulação de crédito é um recurso exclusivo do pacote Premium. Assine agora para ter acesso à orquestração paralela com BV, PAN e Creditas.</p>
                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => window.location.href = '/gestor/assinatura'}>
                  Ver Planos
                </button>
              </div>
            ) : loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                <div className="spinner"></div>
                <span style={{ color: 'var(--sv-text-dim)' }}>Consultando bancos em tempo real...</span>
              </div>
            ) : resultados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resultados.map((r, i) => (
                  <div key={i} style={{ 
                    padding: '16px', 
                    borderRadius: '8px', 
                    background: 'var(--sv-surface-dim)',
                    border: `1px solid ${r.status === 'approved' || r.status === 'mock' ? 'var(--sv-success)' : r.status === 'denied' ? 'var(--sv-danger)' : 'var(--sv-border)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <strong style={{ textTransform: 'uppercase' }}>{r.banco}</strong>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: r.status === 'approved' || r.status === 'mock' ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)',
                        color: r.status === 'approved' || r.status === 'mock' ? 'var(--sv-success)' : 'var(--sv-danger)'
                      }}>
                        {r.status}
                      </span>
                    </div>

                    {r.status === 'approved' || r.status === 'mock' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        <div>
                          <div style={{ color: 'var(--sv-text-dim)', fontSize: '11px' }}>Parcela</div>
                          <div style={{ fontWeight: 'bold' }}>{r.prazo}x {formatCurrency(r.parcela)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--sv-text-dim)', fontSize: '11px' }}>Taxa</div>
                          <div style={{ fontWeight: 'bold' }}>{r.taxa}% a.m.</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--sv-text-dim)' }}>
                        {r.erro || 'Proposta não aprovada pelo banco.'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--sv-text-dim)', fontSize: '14px', textAlign: 'center', marginTop: '64px' }}>
                Preencha os dados e clique em "Executar Simulação V2" para ver as ofertas de crédito.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  background: 'var(--sv-surface-dim)',
  border: '1px solid var(--sv-border)',
  color: 'var(--sv-text)',
  outline: 'none',
}
