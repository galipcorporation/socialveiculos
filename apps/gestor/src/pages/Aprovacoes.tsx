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
}

export function Aprovacoes() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAprovacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
      const data = await api.get<SolicitacaoAprovacao[]>('/aprovacoes/pendentes')
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
  }, [])

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
      // Remover da lista local
      setSolicitacoes((prev) => prev.filter((item) => item.id !== id))
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
      // Remover da lista local
      setSolicitacoes((prev) => prev.filter((item) => item.id !== id))
      // Fechar painel de justificativa
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
      const parsed = JSON.parse(dadosNovos)
      return parsed.preco_venda ?? null
    } catch {
      return null
    }
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <h2>Fila de Aprovações</h2>
        <p>Revisão de ações críticas e reajustes de preços solicitados pelos vendedores da loja.</p>
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
      ) : solicitacoes.length === 0 ? (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Nenhuma solicitação pendente</h3>
          <p>Tudo em ordem! Não há reajustes de preço ou exclusões aguardando aprovação.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {solicitacoes.map((item) => {
            const precoProposto = parsePrecoProposto(item.dados_novos)
            const isExcluir = item.tipo_acao === 'excluir_veiculo'
            const isProcessando = processandoId === item.id
            const isRejeitando = rejeitandoId === item.id

            return (
              <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: isExcluir ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isExcluir ? 'var(--sv-error)' : 'var(--sv-warning)'
                    }}>
                      {isExcluir ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--sv-text)' }}>
                        {isExcluir ? 'Solicitação de Exclusão' : 'Alteração de Preço'}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--sv-text-muted)' }}>
                        ID do Veículo: {item.entidade_id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  <span className="alerts-badge" style={{
                    background: isExcluir ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: isExcluir ? 'var(--sv-error)' : 'var(--sv-warning)',
                    fontSize: '11px'
                  }}>
                    PENDENTE
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
                    <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--sv-border)' }}>
                      {isExcluir ? (
                        <span style={{ color: '#ff859b', fontWeight: 500 }}>
                          ⚠️ Vendedor solicitou a exclusão permanente deste veículo do estoque.
                        </span>
                      ) : (
                        <span>
                          Preço Proposto:{' '}
                          <strong style={{ color: 'var(--sv-primary-text)', fontSize: '14px' }}>
                            R$ {precoProposto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
