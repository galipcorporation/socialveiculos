import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararMoeda, parseMoeda } from '../lib/mascaras'

type TipoLancamento = 'receita' | 'despesa' | 'comissao'

interface ResumoFinanceiro {
  receitas: number
  despesas: number
  comissoes: number
  saldo: number
  custo_estoque: number
  comissoes_pendentes: number
}

interface Lancamento {
  id: string
  loja_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  veiculo_id?: string
  veiculo_nome?: string
  status_pagamento: string
  observacoes?: string
  created_at: string
}

interface VeiculoBasico {
  id: string
  marca: string
  modelo: string
  placa: string
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const TIPO_LABEL: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  comissao: 'Comissão',
}

const TIPO_COR: Record<TipoLancamento, string> = {
  receita: 'var(--sv-success)',
  despesa: 'var(--sv-error)',
  comissao: 'var(--sv-warning)',
}

export function Financeiro() {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [veiculos, setVeiculos] = useState<VeiculoBasico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dataAtual = new Date()
  const [filtroMes, setFiltroMes] = useState<string>(String(dataAtual.getMonth() + 1))
  const [filtroAno, setFiltroAno] = useState<string>(String(dataAtual.getFullYear()))

  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<{ tipo: TipoLancamento; descricao: string; valor: string; status_pagamento: string; veiculo_id: string }>({
    tipo: 'despesa',
    descricao: '',
    valor: '',
    status_pagamento: 'pago',
    veiculo_id: ''
  })

  const showToast = useUIStore((state) => state.showToast)
  const confirm = useUIStore((state) => state.confirm)

  const carregar = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (filtroMes && filtroAno) {
        params.mes = filtroMes
        params.ano = filtroAno
      }

      const [r, l] = await Promise.all([
        api.get<ResumoFinanceiro>('/financeiro/resumo', params),
        api.get<Lancamento[]>('/financeiro/lancamentos', params),
      ])
      setResumo(r)
      setLancamentos(l)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar dados financeiros. Verifique suas permissões.')
    } finally {
      setLoading(false)
    }
  }

  const carregarVeiculos = async () => {
    try {
      const data = await api.get<{ items: VeiculoBasico[] }>('/veiculos', { per_page: '500' })
      setVeiculos(data.items)
    } catch (err) {
      console.error("Erro ao carregar veículos", err)
    }
  }

  useEffect(() => {
    carregar()
  }, [filtroMes, filtroAno])

  useEffect(() => {
    if (mostrarForm && veiculos.length === 0) {
      carregarVeiculos()
    }
  }, [mostrarForm])

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorNum = parseMoeda(form.valor)
    if (!form.descricao.trim() || !valorNum || valorNum <= 0) {
      showToast('Informe uma descrição e um valor maior que zero.', 'warning')
      return
    }
    setSalvando(true)
    try {
      await api.post('/financeiro/lancamentos', {
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        valor: valorNum,
        status_pagamento: form.status_pagamento,
        veiculo_id: form.veiculo_id || null
      })
      setForm({ tipo: 'despesa', descricao: '', valor: '', status_pagamento: 'pago', veiculo_id: '' })
      setMostrarForm(false)
      showToast('Lançamento registrado com sucesso!', 'success')
      await carregar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar lançamento.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Lançamento',
      message: 'Deseja realmente excluir este lançamento?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.delete(`/financeiro/lancamentos/${id}`)
      setLancamentos((prev) => prev.filter((l) => l.id !== id))
      showToast('Lançamento excluído com sucesso.', 'success')
      await carregar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir lançamento.', 'error')
    }
  }

  const toggleStatusPagamento = async (lancamento: Lancamento) => {
    const novoStatus = lancamento.status_pagamento === 'pago' ? 'pendente' : 'pago'
    const statusAntigo = lancamento.status_pagamento
    
    // Optimistic UI
    setLancamentos(prev => prev.map(l => l.id === lancamento.id ? { ...l, status_pagamento: novoStatus } : l))
    
    try {
      await api.patch(`/financeiro/lancamentos/${lancamento.id}`, { status_pagamento: novoStatus })
      showToast(`Marcado como ${novoStatus === 'pago' ? 'Pago' : 'Pendente'}`, 'success')
      // Refresh resumo to reflect new saldo (respecting active month/year filter)
      const params: any = {}
      if (filtroMes && filtroAno) {
        params.mes = filtroMes
        params.ano = filtroAno
      }
      const r = await api.get<ResumoFinanceiro>('/financeiro/resumo', params)
      setResumo(r)
    } catch (err) {
      setLancamentos(prev => prev.map(l => l.id === lancamento.id ? { ...l, status_pagamento: statusAntigo } : l))
      showToast('Erro ao atualizar status', 'error')
    }
  }

  const meses = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ]

  const anos = [
    String(dataAtual.getFullYear() - 1),
    String(dataAtual.getFullYear()),
    String(dataAtual.getFullYear() + 1)
  ]

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Financeiro</h2>
          <p>Receitas, despesas, comissões e saldo da sua loja.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--sv-text-dim)', fontWeight: 600, textTransform: 'uppercase', marginRight: '4px' }}>Fechamento:</span>
            <select 
              value={filtroMes} 
              onChange={e => setFiltroMes(e.target.value)}
              className="filter-select"
              style={{ height: '36px', padding: '0 28px 0 10px', fontSize: '12px' }}
            >
              <option value="">Todos</option>
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select 
              value={filtroAno} 
              onChange={e => setFiltroAno(e.target.value)}
              className="filter-select"
              style={{ height: '36px', padding: '0 28px 0 10px', fontSize: '12px' }}
            >
              <option value="">--</option>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Fechar' : '+ Novo Lançamento'}
          </button>
        </div>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Resumo */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Saldo Atual</div>
            <div className="kpi-value" style={{ color: (resumo?.saldo ?? 0) >= 0 ? 'var(--sv-success)' : 'var(--sv-error)' }}>
              {loading ? '—' : formatBRL(resumo?.saldo ?? 0)}
            </div>
            <div className="kpi-change positive"><span>Apenas lançamentos pagos</span></div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Receitas (Pagas)</div>
            <div className="kpi-value">{loading ? '—' : formatBRL(resumo?.receitas ?? 0)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Despesas (Pagas)</div>
            <div className="kpi-value">{loading ? '—' : formatBRL(resumo?.despesas ?? 0)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Comissões pendentes</div>
            <div className="kpi-value">{loading ? '—' : formatBRL(resumo?.comissoes_pendentes ?? 0)}</div>
          </div>
        </div>
      </div>

      {/* Formulário rápido */}
      {mostrarForm && (
        <form className="glass-card" onSubmit={handleCriar} style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLancamento })}
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', color: 'var(--sv-text)' }}
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
              <option value="comissao">Comissão</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Venda do veículo ABC-1234"
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', color: 'var(--sv-text)' }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Veículo (Opcional)</label>
            <select
              value={form.veiculo_id}
              onChange={(e) => setForm({ ...form, veiculo_id: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', color: 'var(--sv-text)' }}
            >
              <option value="">Nenhum</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.placa ? `(${v.placa})` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Status</label>
            <select
              value={form.status_pagamento}
              onChange={(e) => setForm({ ...form, status_pagamento: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', color: 'var(--sv-text)' }}
            >
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--sv-text-dim)' }}>Valor (R$)</label>
            <input
              type="text"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: mascararMoeda(e.target.value) })}
              placeholder="0,00"
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', color: 'var(--sv-text)', width: '120px' }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Lançar'}
          </button>
        </form>
      )}

      {/* Lista de lançamentos */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner"></div>
        </div>
      ) : lancamentos.length === 0 ? (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <h3>Nenhum lançamento encontrado</h3>
          <p>Não há dados para o período ou filtros selecionados.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-scroll">
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--sv-text-dim)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Tipo</th>
                <th style={{ padding: '12px 16px' }}>Descrição</th>
                <th style={{ padding: '12px 16px' }}>Veículo</th>
                <th style={{ padding: '12px 16px' }}>Data</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--sv-border)', opacity: l.status_pagamento === 'pendente' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 16px', width: '100px' }}>
                    <button 
                      onClick={() => toggleStatusPagamento(l)}
                      title="Clique para alterar o status"
                      style={{ 
                        background: l.status_pagamento === 'pago' ? 'var(--sv-success-dim)' : 'var(--sv-warning-dim)',
                        color: l.status_pagamento === 'pago' ? 'var(--sv-success)' : 'var(--sv-warning)',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {l.status_pagamento}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: TIPO_COR[l.tipo], fontWeight: 600 }}>{TIPO_LABEL[l.tipo]}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{l.descricao}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--sv-text-dim)', fontSize: '13px' }}>
                    {l.veiculo_nome ? l.veiculo_nome : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sv-text-dim)' }}>
                    {new Date(l.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: TIPO_COR[l.tipo] }}>
                    {l.tipo === 'receita' ? '+' : '−'} {formatBRL(l.valor)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn btn-glass"
                      onClick={() => handleExcluir(l.id)}
                      style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--sv-error)' }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
