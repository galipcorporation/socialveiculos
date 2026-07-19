import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararMoeda, parseMoeda } from '../lib/mascaras'
import { SelectField } from '../components/SelectField'

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
  deletado_em?: string
  deletado_por_nome?: string
  motivo_exclusao?: string
}

interface VeiculoBasico {
  id: string
  marca: string
  modelo: string
  placa: string
}

interface Comissao {
  id: string
  vendedor_id?: string
  veiculo_id?: string
  vendedor_nome?: string
  veiculo_nome?: string
  valor_venda: number
  percentual: number
  valor_comissao: number
  pago: boolean
  created_at: string
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

  // Modal de comissões (o que é de quem)
  const [showComissoes, setShowComissoes] = useState(false)
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [loadingComissoes, setLoadingComissoes] = useState(false)
  const [pagandoId, setPagandoId] = useState<string | null>(null)

  // Exclusão com motivo
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null)
  const [motivoExclusao, setMotivoExclusao] = useState('')
  const [salvandoExclusao, setSalvandoExclusao] = useState(false)

  // Lixeira
  const [showLixeira, setShowLixeira] = useState(false)
  const [lixeira, setLixeira] = useState<Lancamento[]>([])
  const [loadingLixeira, setLoadingLixeira] = useState(false)
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null)

  const abrirComissoes = async () => {
    setShowComissoes(true)
    setLoadingComissoes(true)
    try {
      const c = await api.get<Comissao[]>('/financeiro/comissoes', { pago: 'false' })
      setComissoes(c)
    } catch {
      showToast('Erro ao carregar comissões', 'error')
    } finally {
      setLoadingComissoes(false)
    }
  }

  const pagarComissao = async (c: Comissao) => {
    setPagandoId(c.id)
    try {
      await api.patch(`/financeiro/comissoes/${c.id}/pagar`, {})
      setComissoes(prev => prev.filter(x => x.id !== c.id))
      showToast('Comissão marcada como paga', 'success')
      carregar()
    } catch {
      showToast('Erro ao marcar comissão como paga', 'error')
    } finally {
      setPagandoId(null)
    }
  }

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

  const abrirExclusao = (l: Lancamento) => {
    setExcluindo(l)
    setMotivoExclusao('')
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    if (motivoExclusao.trim().length < 3) {
      showToast('Informe o motivo da exclusão (mínimo 3 caracteres).', 'warning')
      return
    }
    setSalvandoExclusao(true)
    try {
      await api.delete(`/financeiro/lancamentos/${excluindo.id}`, { motivo: motivoExclusao.trim() })
      setLancamentos((prev) => prev.filter((l) => l.id !== excluindo.id))
      showToast('Lançamento excluído. Pode ser restaurado na Lixeira.', 'success')
      setExcluindo(null)
      await carregar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir lançamento.', 'error')
    } finally {
      setSalvandoExclusao(false)
    }
  }

  const abrirLixeira = async () => {
    setShowLixeira(true)
    setLoadingLixeira(true)
    try {
      const l = await api.get<Lancamento[]>('/financeiro/lancamentos/lixeira')
      setLixeira(l)
    } catch {
      showToast('Erro ao carregar lixeira', 'error')
    } finally {
      setLoadingLixeira(false)
    }
  }

  const restaurarLancamento = async (l: Lancamento) => {
    setRestaurandoId(l.id)
    try {
      await api.post(`/financeiro/lancamentos/${l.id}/restaurar`, {})
      setLixeira((prev) => prev.filter((x) => x.id !== l.id))
      showToast('Lançamento restaurado com sucesso.', 'success')
      await carregar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao restaurar lançamento.', 'error')
    } finally {
      setRestaurandoId(null)
    }
  }

  const [editandoValorId, setEditandoValorId] = useState<string | null>(null)
  const [valorEditado, setValorEditado] = useState('')
  const [salvandoValor, setSalvandoValor] = useState(false)

  const abrirEdicaoValor = (l: Lancamento) => {
    setEditandoValorId(l.id)
    setValorEditado(mascararMoeda(l.valor))
  }

  const salvarValorEditado = async (lancamento: Lancamento) => {
    const novoValor = parseMoeda(valorEditado)
    if (!novoValor || novoValor <= 0) {
      showToast('Informe um valor válido.', 'error')
      return
    }
    setSalvandoValor(true)
    try {
      await api.patch(`/financeiro/lancamentos/${lancamento.id}`, { valor: novoValor })
      setLancamentos(prev => prev.map(l => l.id === lancamento.id ? { ...l, valor: novoValor } : l))
      setEditandoValorId(null)
      showToast('Valor atualizado.', 'success')
      const params: any = {}
      if (filtroMes && filtroAno) {
        params.mes = filtroMes
        params.ano = filtroAno
      }
      const r = await api.get<ResumoFinanceiro>('/financeiro/resumo', params)
      setResumo(r)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar valor.', 'error')
    } finally {
      setSalvandoValor(false)
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

          <button className="btn btn-glass" onClick={abrirLixeira}>
            Lixeira
          </button>

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
        <div
          className="kpi-card"
          onClick={abrirComissoes}
          style={{ cursor: 'pointer' }}
          title="Ver comissões pendentes por vendedor"
        >
          <div>
            <div className="kpi-label">Comissões pendentes</div>
            <div className="kpi-value">{loading ? '—' : formatBRL(resumo?.comissoes_pendentes ?? 0)}</div>
            <div className="kpi-change positive"><span>Ver o que é de quem →</span></div>
          </div>
        </div>
      </div>

      {/* Formulário rápido */}
      {mostrarForm && (
        <form className="glass-card" onSubmit={handleCriar} style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <SelectField
            label="Tipo"
            minWidth="140px"
            value={form.tipo}
            onChange={(v) => setForm({ ...form, tipo: v as TipoLancamento })}
            options={[
              { value: 'receita', label: 'Receita' },
              { value: 'despesa', label: 'Despesa' },
              { value: 'comissao', label: 'Comissão' },
            ]}
          />
          <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
            <label>Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Venda do veículo ABC-1234"
            />
          </div>

          <SelectField
            label="Veículo (Opcional)"
            minWidth="180px"
            value={form.veiculo_id}
            onChange={(v) => setForm({ ...form, veiculo_id: v })}
            options={[
              { value: '', label: 'Nenhum' },
              ...veiculos.map(v => ({ value: v.id, label: `${v.marca} ${v.modelo} ${v.placa ? `(${v.placa})` : ''}`.trim() })),
            ]}
          />

          <SelectField
            label="Status"
            minWidth="160px"
            value={form.status_pagamento}
            onChange={(v) => setForm({ ...form, status_pagamento: v })}
            options={[
              { value: 'pago', label: 'Pago / Recebido' },
              { value: 'pendente', label: 'Pendente' },
            ]}
          />

          <div className="form-group" style={{ minWidth: '140px' }}>
            <label>Valor (R$)</label>
            <input
              type="text"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: mascararMoeda(e.target.value) })}
              placeholder="0,00"
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
                    {editandoValorId === l.id ? (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={valorEditado}
                          onChange={(e) => setValorEditado(mascararMoeda(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') salvarValorEditado(l)
                            if (e.key === 'Escape') setEditandoValorId(null)
                          }}
                          disabled={salvandoValor}
                          style={{ width: '110px', fontSize: '13px', padding: '4px 6px', textAlign: 'right' }}
                        />
                        <button
                          className="btn btn-glass"
                          onClick={() => salvarValorEditado(l)}
                          disabled={salvandoValor}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          ✓
                        </button>
                        <button
                          className="btn btn-glass"
                          onClick={() => setEditandoValorId(null)}
                          disabled={salvandoValor}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => abrirEdicaoValor(l)}
                        title="Clique para editar o valor"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', padding: 0 }}
                      >
                        {l.tipo === 'receita' ? '+' : '−'} {formatBRL(l.valor)}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn btn-glass"
                      onClick={() => abrirExclusao(l)}
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

      {/* Modal: comissões pendentes — o que é de quem */}
      {showComissoes && (
        <div className="modal-overlay" onClick={() => setShowComissoes(false)}>
          <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Comissões pendentes</h3>
              <button className="modal-close" onClick={() => setShowComissoes(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingComissoes ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : comissoes.length === 0 ? (
                <div className="empty-state"><p>Nenhuma comissão pendente. 🎉</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comissoes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--sv-surface)', border: '1px solid var(--sv-border)', borderRadius: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.vendedor_nome || 'Vendedor não identificado'}</div>
                        <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>
                          {c.veiculo_nome || 'Veículo —'} · venda {formatBRL(c.valor_venda)} ·{' '}
                          {c.percentual > 0 ? `${c.percentual}%` : 'excedente da troca'}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--sv-warning)', whiteSpace: 'nowrap' }}>{formatBRL(c.valor_comissao)}</div>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={pagandoId === c.id}
                        onClick={() => pagarComissao(c)}
                      >
                        {pagandoId === c.id ? <span className="spinner" /> : 'Pagar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowComissoes(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: motivo da exclusão */}
      {excluindo && (
        <div className="modal-overlay" onClick={() => !salvandoExclusao && setExcluindo(null)}>
          <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Excluir lançamento</h3>
              <button className="modal-close" onClick={() => setExcluindo(null)} disabled={salvandoExclusao}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, fontSize: 14, color: 'var(--sv-text-dim)' }}>
                <strong>{excluindo.descricao}</strong> · {formatBRL(excluindo.valor)}
              </p>
              <div className="form-group">
                <label>Motivo da exclusão</label>
                <textarea
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  placeholder="Ex: lançamento duplicado, valor incorreto..."
                  rows={3}
                  autoFocus
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginTop: 8 }}>
                O lançamento vai para a Lixeira e pode ser restaurado depois.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setExcluindo(null)} disabled={salvandoExclusao}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--sv-error)' }} onClick={confirmarExclusao} disabled={salvandoExclusao}>
                {salvandoExclusao ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: lixeira de lançamentos excluídos */}
      {showLixeira && (
        <div className="modal-overlay" onClick={() => setShowLixeira(false)}>
          <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Lixeira</h3>
              <button className="modal-close" onClick={() => setShowLixeira(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingLixeira ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : lixeira.length === 0 ? (
                <div className="empty-state"><p>Nenhum lançamento excluído.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lixeira.map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--sv-surface)', border: '1px solid var(--sv-border)', borderRadius: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          <span style={{ color: TIPO_COR[l.tipo] }}>{TIPO_LABEL[l.tipo]}</span> · {l.descricao} · {formatBRL(l.valor)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>
                          Excluído por {l.deletado_por_nome || '—'} em {l.deletado_em ? new Date(l.deletado_em).toLocaleString('pt-BR') : '—'}
                        </div>
                        {l.motivo_exclusao && (
                          <div style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginTop: 4 }}>
                            Motivo: {l.motivo_exclusao}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={restaurandoId === l.id}
                        onClick={() => restaurarLancamento(l)}
                      >
                        {restaurandoId === l.id ? <span className="spinner" /> : 'Restaurar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowLixeira(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
