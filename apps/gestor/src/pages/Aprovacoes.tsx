import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'

interface UsuarioSimples {
  id: string
  nome: string
  email: string
}

interface SolicitacaoAprovacao {
  id: string
  loja_id: string
  requisitante_id: string
  requisitante: UsuarioSimples
  tipo_acao: 'excluir_veiculo' | 'alterar_preco'
  entidade_id: string
  dados_novos?: string // JSON string
  status: 'pendente' | 'aprovado' | 'rejeitado'
  justificativa_rejeicao?: string
  created_at: string
  updated_at: string
  veiculo_marca?: string
  veiculo_modelo?: string
  veiculo_placa?: string
  veiculo_ano?: number
  veiculo_cor?: string
  /** Preço vigente do veículo — referência para o preço proposto. */
  veiculo_preco_venda?: number | null
  motivo?: string
}

const formatBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function Aprovacoes() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAprovacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Controle de rejeição individual
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const showToast = useUIStore((state) => state.showToast)
  const confirm = useUIStore((state) => state.confirm)

  const carregarSolicitacoes = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = filtroStatus === 'pendente'
        ? '/aprovacoes/pendentes'
        : (filtroStatus === 'aprovado' || filtroStatus === 'rejeitado')
        ? '/aprovacoes/historico'
        : '/aprovacoes'
      const data = await api.get<SolicitacaoAprovacao[]>(endpoint)
      setSolicitacoes(data)
    } catch (err: unknown) {
      console.error(err)
      setError('Erro ao carregar fila de aprovações. Verifique suas permissões.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarSolicitacoes()
    setSelectedIds([])
  }, [filtroStatus])

  const solicitacoesFiltradas = solicitacoes.filter(s => {
    if (filtroStatus === 'todos') return true
    return s.status === filtroStatus
  })

  const toggleSelectAll = () => {
    if (selectedIds.length === solicitacoesFiltradas.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(solicitacoesFiltradas.map(s => s.id))
    }
  }

  const toggleSelectCard = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBulkAprovar = async () => {
    if (selectedIds.length === 0) return
    const ok = await confirm({
      title: 'Aprovar em Lote',
      message: `Deseja realmente APROVAR as ${selectedIds.length} solicitação(ões) selecionada(s)?`,
      confirmText: 'Aprovar Todas',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await Promise.all(selectedIds.map(id => api.post(`/aprovacoes/${id}/processar`, { status: 'aprovado' })))
      showToast(`${selectedIds.length} solicitação(ões) aprovada(s) com sucesso!`, 'success')
      setSelectedIds([])
      carregarSolicitacoes()
    } catch (err) {
      showToast('Erro ao processar aprovações em lote', 'error')
    }
  }

  const handleBulkRejeitar = async () => {
    if (selectedIds.length === 0) return
    const justificativaLote = prompt('Informe a justificativa de rejeição para o lote:')
    if (!justificativaLote || !justificativaLote.trim()) {
      showToast('Justificativa é obrigatória para rejeição.', 'warning')
      return
    }
    const ok = await confirm({
      title: 'Rejeitar em Lote',
      message: `Deseja realmente REJEITAR as ${selectedIds.length} solicitação(ões) selecionada(s)?`,
      confirmText: 'Rejeitar Todas',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await Promise.all(selectedIds.map(id => api.post(`/aprovacoes/${id}/processar`, { status: 'rejeitado', justificativa_rejeicao: justificativaLote.trim() })))
      showToast(`${selectedIds.length} solicitação(ões) rejeitada(s).`, 'success')
      setSelectedIds([])
      carregarSolicitacoes()
    } catch (err) {
      showToast('Erro ao rejeitar solicitações em lote', 'error')
    }
  }

  const handleAprovar = async (id: string) => {
    const ok = await confirm({
      title: 'Aprovar Solicitação',
      message: 'Tem certeza de que deseja APROVAR esta solicitação?',
      confirmText: 'Aprovar',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    setProcessandoId(id)
    try {
      await api.post(`/aprovacoes/${id}/processar`, { status: 'aprovado' })
      if (filtroStatus === 'todos') {
        setSolicitacoes((prev) => prev.map((item) => item.id === id ? { ...item, status: 'aprovado' } : item))
      } else {
        setSolicitacoes((prev) => prev.filter((item) => item.id !== id))
      }
      showToast('Solicitação aprovada com sucesso!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar solicitação.'
      showToast(msg, 'error')
    } finally {
      setProcessandoId(null)
    }
  }

  const handleRejeitarConfirmada = async (id: string) => {
    if (!justificativa.trim()) {
      showToast('Por favor, informe a justificativa para a rejeição.', 'warning')
      return
    }
    setProcessandoId(id)
    try {
      await api.post(`/aprovacoes/${id}/processar`, {
        status: 'rejeitado',
        justificativa_rejeicao: justificativa,
      })
      if (filtroStatus === 'todos') {
        setSolicitacoes((prev) => prev.map((item) => item.id === id ? { ...item, status: 'rejeitado', justificativa_rejeicao: justificativa } : item))
      } else {
        setSolicitacoes((prev) => prev.filter((item) => item.id !== id))
      }
      setRejeitandoId(null)
      setJustificativa('')
      showToast('Solicitação rejeitada com sucesso.', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao rejeitar solicitação.'
      showToast(msg, 'error')
    } finally {
      setProcessandoId(null)
    }
  }

  const parsePrecoProposto = (dadosNovos?: string): number | null => {
    if (!dadosNovos) return null
    try {
      const parsed = typeof dadosNovos === 'string' ? JSON.parse(dadosNovos) : dadosNovos
      return parsed.preco_venda ?? parsed.preco_proposto ?? null
    } catch {
      return null
    }
  }

  const parsePrecoAtual = (dadosNovos?: string): number | null => {
    if (!dadosNovos) return null
    try {
      const parsed = typeof dadosNovos === 'string' ? JSON.parse(dadosNovos) : dadosNovos
      return parsed.preco_atual ?? parsed.preco_antigo ?? null
    } catch {
      return null
    }
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Central de Aprovações</h2>
          <p>
            Gerencie solicitações de crédito/financiamento, propostas, reajustes de preços e ações críticas da loja.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--sv-surface-dim)', padding: 4, borderRadius: 'var(--sv-radius-lg)', border: '1px solid var(--sv-border)' }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'aprovado', label: 'Aprovados' },
            { id: 'rejeitado', label: 'Rejeitados' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-sm ${filtroStatus === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setFiltroStatus(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner"></div>
        </div>
      ) : solicitacoesFiltradas.length === 0 ? (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Nenhuma solicitação encontrada</h3>
          <p>Não há solicitações para o filtro de status selecionado.</p>
        </div>
      ) : (
        <>
          {/* Top selection bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--sv-text-dim)' }}>
              <input
                type="checkbox"
                checked={solicitacoesFiltradas.length > 0 && selectedIds.length === solicitacoesFiltradas.length}
                onChange={toggleSelectAll}
                style={{ width: 16, height: 16, accentColor: 'var(--sv-primary)', cursor: 'pointer' }}
              />
              Selecionar todos ({solicitacoesFiltradas.length})
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
            {solicitacoesFiltradas.map((item) => {
              const precoProposto = parsePrecoProposto(item.dados_novos)
              const isExcluir = item.tipo_acao === 'excluir_veiculo'
              const isProcessando = processandoId === item.id
              const isRejeitando = rejeitandoId === item.id
              const isSelected = selectedIds.includes(item.id)

              const badgeBg = item.status === 'aprovado'
                ? 'rgba(16, 185, 129, 0.15)'
                : item.status === 'rejeitado'
                ? 'rgba(244, 63, 94, 0.15)'
                : 'rgba(245, 158, 11, 0.15)'

              const badgeColor = item.status === 'aprovado'
                ? '#10b981'
                : item.status === 'rejeitado'
                ? 'var(--sv-error)'
                : 'var(--sv-warning)'

              return (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    border: isSelected ? '1px solid var(--sv-primary)' : '1px solid var(--sv-border)',
                    background: isSelected ? 'color-mix(in srgb, var(--sv-primary) 6%, var(--sv-surface-dim))' : 'var(--sv-surface-dim)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectCard(item.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--sv-primary)', cursor: 'pointer' }}
                      />
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: isExcluir ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isExcluir ? 'var(--sv-error)' : 'var(--sv-warning)'
                      }}>
                        {isExcluir ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sv-text)' }}>
                          {isExcluir ? 'Solicitação de Exclusão' : 'Alteração de Preço'}
                        </h4>
                        {item.veiculo_marca ? (
                          <div style={{ fontSize: '12px', color: 'var(--sv-primary-text)', fontWeight: 600, marginTop: '2px' }}>
                            {item.veiculo_marca} {item.veiculo_modelo} {item.veiculo_ano ? `(${item.veiculo_ano})` : ''} {item.veiculo_placa ? `· Placa: ${item.veiculo_placa.toUpperCase()}` : ''}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)' }}>
                            ID do Veículo: {item.entidade_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="alerts-badge" style={{
                      background: badgeBg,
                      color: badgeColor,
                      fontSize: '11px'
                    }}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                <div style={{ borderTop: '1px solid var(--sv-border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--sv-text-dim)' }}>
                    <div>
                      <strong>Solicitado por:</strong> {item.requisitante.nome} ({item.requisitante.email})
                    </div>
                    <div>
                      <strong>Data:</strong> {new Date(item.created_at).toLocaleString()}
                    </div>
                    {item.motivo && (
                      <div style={{ marginTop: '2px' }}>
                        <strong>Motivo:</strong> <span style={{ fontStyle: 'italic', color: 'var(--sv-text)' }}>"{item.motivo}"</span>
                      </div>
                    )}
                    {item.veiculo_marca ? (
                      <div style={{ marginTop: '2px' }}>
                        <strong>Veículo:</strong> {item.veiculo_marca} {item.veiculo_modelo} {item.veiculo_ano ? `(${item.veiculo_ano})` : ''} {item.veiculo_cor ? ` · Cor: ${item.veiculo_cor}` : ''} {item.veiculo_placa ? ` · Placa: ${item.veiculo_placa.toUpperCase()}` : ''}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--sv-text-muted)', marginTop: '2px' }}>
                        ID do Veículo: {item.entidade_id}
                      </div>
                    )}
                    <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--sv-border)' }}>
                      {isExcluir ? (
                        <span style={{ color: '#ff859b', fontWeight: 500 }}>
                          ⚠️ Vendedor solicitou a exclusão permanente deste veículo do estoque.
                        </span>
                      ) : (
                        <span>
                          Preço Atual:{' '}
                          <strong style={{ color: 'var(--sv-text)', fontSize: '14px' }}>
                            {formatBRL(item.veiculo_preco_venda || parsePrecoAtual(item.dados_novos))}
                          </strong>
                          {' → '}
                          Preço Proposto:{' '}
                          <strong style={{ color: 'var(--sv-primary-text)', fontSize: '14px' }}>
                            {formatBRL(precoProposto)}
                          </strong>
                        </span>
                      )}
                    </div>
                    {item.status === 'rejeitado' && item.justificativa_rejeicao && (
                      <div style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                        <strong style={{ color: 'var(--sv-error)' }}>Justificativa da Rejeição:</strong>
                        <p style={{ color: 'var(--sv-text)', fontSize: '13px', marginTop: '4px', marginBlockEnd: 0 }}>
                          {item.justificativa_rejeicao}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {item.status === 'pendente' && (
                  <>
                    {isRejeitando ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sv-text-dim)', textTransform: 'uppercase' }}>
                          Justificativa da Rejeição:
                        </label>
                        <textarea
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Ex: Preço de venda abaixo da margem mínima."
                          disabled={isProcessando}
                          style={{
                            width: '100%',
                            height: '70px',
                            background: 'var(--sv-surface-dim)',
                            border: '1px solid var(--sv-border)',
                            borderRadius: '6px',
                            color: 'var(--sv-text)',
                            padding: '10px',
                            fontSize: '13px',
                            outline: 'none',
                            resize: 'none'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-glass"
                            onClick={() => {
                              setRejeitandoId(null)
                              setJustificativa('')
                            }}
                            disabled={isProcessando}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleRejeitarConfirmada(item.id)}
                            disabled={isProcessando}
                            style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--sv-error)', color: 'white' }}
                          >
                            {isProcessando ? 'Rejeitando...' : 'Confirmar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                        <button
                          className="btn btn-glass"
                          onClick={() => setRejeitandoId(item.id)}
                          disabled={isProcessando}
                          style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--sv-error)' }}
                        >
                          Rejeitar
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleAprovar(item.id)}
                          disabled={isProcessando}
                          style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                          {isProcessando ? (
                            <>
                              <span className="spinner" style={{ width: '12px', height: '12px', borderTopColor: 'white' }} />
                              Processando...
                            </>
                          ) : (
                            'Aprovar'
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {selectedIds.length > 0 && (
          <div className="sv-selection-bar" style={{
            position: 'sticky',
            bottom: 20,
            marginTop: 20,
            background: 'var(--sv-surface-dim)',
            border: '1px solid var(--sv-border)',
            backdropFilter: 'blur(var(--sv-blur))',
            padding: '12px 20px',
            borderRadius: 'var(--sv-radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {selectedIds.length} solicitação(ões) selecionada(s)
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={handleBulkAprovar}>
                ✓ Aprovar Selecionadas
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkRejeitar}>
                ✕ Rejeitar Selecionadas
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
                Limpar Seleção
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
)
}
