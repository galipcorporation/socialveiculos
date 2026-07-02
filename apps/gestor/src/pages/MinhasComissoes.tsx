import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface MinhaVenda {
  esteira_id: string
  veiculo_id?: string
  veiculo_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_paga?: boolean | null
  estagio: string
  aberta_em: string
}

type Filtro = 'todas' | 'pendentes' | 'pagas'

const formatBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

/** % derivado dos valores reais da comissão (nunca inventado). */
function percentual(v: MinhaVenda): string {
  if (!v.valor_venda || !v.comissao_valor) return '—'
  return `${Math.round((v.comissao_valor / v.valor_venda) * 10000) / 100}%`
}

function StatusChip({ venda }: { venda: MinhaVenda }) {
  // Sem comissão vinculada ou comissão zerada → gestor ainda precisa definir o %
  const definir = venda.comissao_paga == null || (!venda.comissao_valor && !venda.comissao_paga)
  const cfg = definir
    ? { label: 'Definir %', bg: 'rgba(244,63,94,.12)', color: 'var(--sv-error)' }
    : venda.comissao_paga
      ? { label: 'Paga', bg: 'rgba(74,222,128,.12)', color: 'var(--sv-success)' }
      : { label: 'Pendente', bg: 'rgba(251,146,60,.12)', color: 'var(--sv-warning)' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, padding: '3px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

export function MinhasComissoes() {
  const [vendas, setVendas] = useState<MinhaVenda[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.get<MinhaVenda[]>('/me/vendas')
        setVendas(data)
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar suas comissões. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const visiveis = vendas.filter((v) => {
    if (filtro === 'pendentes') return v.comissao_paga === false
    if (filtro === 'pagas') return v.comissao_paga === true
    return true
  })

  const filtroBtn = (key: Filtro, label: string) => (
    <button
      key={key}
      className="quick-action-btn"
      onClick={() => setFiltro(key)}
      style={filtro === key ? { borderColor: 'var(--sv-primary)', color: 'var(--sv-primary-text)' } : undefined}
    >
      {label}
    </button>
  )

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2>Minhas Comissões</h2>
          <p>Acompanhe o que você tem a receber por venda.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {filtroBtn('todas', 'Todas')}
          {filtroBtn('pendentes', 'Pendentes')}
          {filtroBtn('pagas', 'Pagas')}
        </div>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: 24 }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ padding: 24, color: 'var(--sv-text-dim)' }}>Carregando…</div>
      ) : visiveis.length === 0 ? (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <h3>Nenhuma venda por aqui ainda</h3>
          <p>Quando você registrar uma venda, a comissão aparece automaticamente nesta lista.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--sv-text-dim)', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Veículo</th>
                <th style={{ padding: '12px 16px' }}>Data da venda</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor da venda</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>%</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Comissão</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((v) => (
                <tr key={v.esteira_id} style={{ borderTop: '1px solid var(--sv-border)' }}>
                  <td style={{ padding: '12px 16px' }}>{v.veiculo_nome ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{formatData(v.aberta_em)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatBRL(v.valor_venda)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{percentual(v)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatBRL(v.comissao_valor)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusChip venda={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
