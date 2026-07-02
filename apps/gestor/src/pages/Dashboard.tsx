import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getRecentPages, type RecentPage } from '../lib/recentPages'

const FALLBACK_ACTIONS: RecentPage[] = [
  { path: '/estoque', label: 'Estoque', icon: 'M1 3h15a2 2 0 012 2v6a2 2 0 01-2 2H1V3zm0 0v13m4 2a2 2 0 100-4 2 2 0 000 4zm13 0a2 2 0 100-4 2 2 0 000 4z' },
  { path: '/crm', label: 'CRM', icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm10 1v6m3-3h-6' },
  { path: '/financeiro', label: 'Financeiro', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
]

interface DashboardKpis {
  estoque_ativo: number
  leads_ativos: number
  vendas_mes: number
  receita_mes: number
  veiculos_publicados: number
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function Dashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.get<DashboardKpis>('/dashboard/kpis')
        setKpis(data)
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar os indicadores. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    const carregarAlertas = async () => {
      try {
        const data = await api.get<any[]>('/notificacoes')
        setAlerts(data)
      } catch (err) {
        console.error(err)
      }
    }
    carregar()
    carregarAlertas()
  }, [])

  const val = (n?: number) => (loading ? '—' : (n ?? 0).toLocaleString('pt-BR'))

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Visão Geral</h2>
        <p>Acompanhe os principais indicadores e atalhos da sua concessionária.</p>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '24px' }}>
          <svg className="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Estoque Ativo</div>
            <div className="kpi-value">{val(kpis?.estoque_ativo)}</div>
            <div className="kpi-change positive">
              <span>{kpis?.veiculos_publicados ?? 0} publicados na vitrine</span>
            </div>
          </div>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
              <circle cx="5.5" cy="18" r="2" />
              <circle cx="18.5" cy="18" r="2" />
            </svg>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Leads Ativos</div>
            <div className="kpi-value">{val(kpis?.leads_ativos)}</div>
            <div className="kpi-change positive">
              <span>No funil de vendas</span>
            </div>
          </div>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Vendas (Mês)</div>
            <div className="kpi-value">{val(kpis?.vendas_mes)}</div>
            <div className="kpi-change positive">
              <span>Veículos vendidos no mês</span>
            </div>
          </div>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Receita (Mês)</div>
            <div className="kpi-value">{loading ? '—' : formatBRL(kpis?.receita_mes ?? 0)}</div>
            <div className="kpi-change positive">
              <span>Lançamentos de receita</span>
            </div>
          </div>
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick Actions + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-card quick-actions-card">
          <h3 className="quick-actions-title">Acesso Rápido</h3>
          <div className="quick-actions">
            {(getRecentPages().length > 0 ? getRecentPages() : FALLBACK_ACTIONS).map((page) => (
              <button key={page.path} className="quick-action-btn" onClick={() => navigate(page.path)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={page.icon} />
                </svg>
                {page.label}
              </button>
            ))}
          </div>
        </div>

        <div className="alerts-panel">
          <div className="alerts-header">
            <h3>⚠️ Alertas</h3>
            <span className="alerts-badge">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40 }}>
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: '13px' }}>Nenhum alerta no momento.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '8px 0' }}>
              {alerts.map((al) => (
                <div
                  key={al.id}
                  onClick={async () => {
                    try {
                      await api.post(`/notificacoes/${al.id}/ler`)
                      if (al.link) navigate(al.link)
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--sv-surface-hover)',
                    borderRadius: 'var(--sv-radius)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background 0.2s',
                    borderLeft: '3px solid var(--sv-primary)'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{al.titulo}</div>
                  <div style={{ color: 'var(--sv-text-dim)', marginTop: '2px' }}>{al.conteudo}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
