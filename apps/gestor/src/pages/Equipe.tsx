import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararTelefone, capitalizarNome } from '../lib/mascaras'
import { MODULOS, TODOS_MODULOS, MODULOS_BASE, parseModulos, type ModuloKey } from '../lib/modulos'
import { PasswordInput } from '../components/PasswordInput'

type Papel = 'gestor' | 'vendedor'

interface Membro {
  id: string
  usuario_id: string
  nome: string
  email: string
  telefone?: string
  avatar_url?: string
  papel: Papel | 'admin_plataforma' | 'cliente'
  modulos?: string
  percentual_comissao?: number | null
  ativo: boolean
  created_at: string
}

/** Item de GET /assinaturas/modulos — status premium por loja. */
interface ModuloStatus {
  modulo: string
  contratado: boolean
  liberado: boolean
}

const PAPEL_LABEL: Record<string, string> = {
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  admin_plataforma: 'Admin',
  cliente: 'Cliente',
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export function Equipe() {
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membroPermissaoIa, setMembroPermissaoIa] = useState<Membro | null>(null)
  const [membroAcessos, setMembroAcessos] = useState<Membro | null>(null)
  const [modulosLoja, setModulosLoja] = useState<string[]>([])

  // Núcleo do CRM + premium contratados pela loja.
  const disponiveis: ModuloKey[] = TODOS_MODULOS.filter(
    (k) => MODULOS_BASE.includes(k) || modulosLoja.includes(k),
  )

  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<{ nome: string; email: string; telefone: string; papel: Papel; senha: string; modulos: ModuloKey[] }>(
    { nome: '', email: '', telefone: '', papel: 'vendedor', senha: '', modulos: [] }
  )

  const toggleModulo = (key: ModuloKey) => {
    setForm((f) => ({
      ...f,
      modulos: f.modulos.includes(key) ? f.modulos.filter((m) => m !== key) : [...f.modulos, key],
    }))
  }

  const handlePapelChange = (papel: Papel) => {
    // Gestor recebe todos os módulos por padrão; vendedor parte de seleção individual.
    setForm((f) => ({ ...f, papel, modulos: papel === 'gestor' ? [...disponiveis] : f.modulos }))
  }

  const showToast = useUIStore((state) => state.showToast)
  const confirm = useUIStore((state) => state.confirm)

  const carregar = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Membro[]>('/equipe')
      setMembros(data)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar a equipe. Verifique suas permissões.')
    } finally {
      setLoading(false)
    }
  }

  // Módulos premium que o admin habilitou para esta loja. O gestor só pode
  // repassar a um vendedor o que a loja de fato contratou.
  const carregarModulosDaLoja = async () => {
    try {
      const status = await api.get<ModuloStatus[]>('/assinaturas/modulos')
      setModulosLoja(status.filter((m) => m.liberado).map((m) => m.modulo))
    } catch (err) {
      console.error(err)
      // Sem a lista, mostramos só o núcleo — nunca o contrário, para não
      // oferecer um módulo que o backend vai recusar no salvamento.
      setModulosLoja([])
    }
  }

  useEffect(() => {
    carregar()
    carregarModulosDaLoja()
  }, [])

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6) {
      showToast('Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.', 'warning')
      return
    }
    setSalvando(true)
    try {
      const modulos = form.papel === 'gestor' ? disponiveis : form.modulos
      await api.post('/equipe', {
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim() || undefined,
        papel: form.papel,
        senha: form.senha,
        modulos: JSON.stringify(modulos),
      })
      setForm({ nome: '', email: '', telefone: '', papel: 'vendedor', senha: '', modulos: [] })
      setMostrarForm(false)
      showToast('Membro convidado com sucesso!', 'success')
      await carregar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao convidar membro.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (m: Membro) => {
    try {
      await api.patch(`/equipe/${m.id}`, { ativo: !m.ativo })
      setMembros((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo: !m.ativo } : x)))
      showToast('Status do membro atualizado.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar membro.', 'error')
    }
  }

  const handleRemover = async (m: Membro) => {
    const ok = await confirm({
      title: 'Remover Membro',
      message: `Tem certeza que deseja remover ${m.nome} da equipe?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await api.delete(`/equipe/${m.id}`)
      setMembros((prev) => prev.filter((x) => x.id !== m.id))
      showToast('Membro removido com sucesso.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover membro.', 'error')
    }
  }

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [modalEdicaoLote, setModalEdicaoLote] = useState(false)

  const toggleSelectAll = () => {
    if (selectedIds.length === membros.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(membros.map(m => m.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBulkDesativar = async () => {
    if (selectedIds.length === 0) return
    const ok = await confirm({
      title: 'Desativar Membros em Lote',
      message: `Tem certeza que deseja desativar os ${selectedIds.length} membro(s) selecionados?`,
      confirmText: 'Desativar Todos',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await Promise.all(selectedIds.map(id => api.patch(`/equipe/${id}`, { ativo: false })))
      showToast(`${selectedIds.length} membro(s) desativado(s) com sucesso.`, 'success')
      setSelectedIds([])
      carregar()
    } catch (err) {
      showToast('Erro ao desativar membros em lote', 'error')
    }
  }

  const handleBulkRemover = async () => {
    if (selectedIds.length === 0) return
    const ok = await confirm({
      title: 'Remover Membros em Lote',
      message: `Tem certeza que deseja remover os ${selectedIds.length} membro(s) selecionados da equipe? Esta ação não pode ser desfeita.`,
      confirmText: 'Remover Todos',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/equipe/${id}`)))
      showToast(`${selectedIds.length} membro(s) removido(s) com sucesso.`, 'success')
      setSelectedIds([])
      carregar()
    } catch (err) {
      showToast('Erro ao remover membros em lote', 'error')
    }
  }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Equipe</h2>
          <p>Gerencie os gestores e vendedores da sua loja.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Fechar' : '+ Convidar Membro'}
          </button>
        </div>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal-glass" style={{ maxWidth: 600, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Convidar Membro</h3>
              <button className="modal-close" onClick={() => setMostrarForm(false)} aria-label="Fechar"><XIcon /></button>
            </div>
            
            <form onSubmit={handleConvidar}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="equipe-form-grid">
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
                      placeholder="Ex: João Silva"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>E-mail *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value.replace(/\s+/g, '') })}
                      onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                      placeholder="Ex: joao@loja.com"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Telefone (opcional)</label>
                    <input
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: mascararTelefone(e.target.value) })}
                      placeholder="(11) 99999-9999"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Papel *</label>
                    <select
                      value={form.papel}
                      onChange={(e) => handlePapelChange(e.target.value as Papel)}
                      style={inputStyle}
                      required
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  </div>
                  <div className="form-group full-width-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / 3' }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Senha provisória *</label>
                    <PasswordInput
                      value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                      placeholder="Senha temporária (mín. 6 caracteres)"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                </div>

                <ModulosChecklist
                  modulos={form.papel === 'gestor' ? disponiveis : form.modulos}
                  disponiveis={disponiveis}
                  onToggle={toggleModulo}
                  disabled={form.papel === 'gestor'}
                  hint={form.papel === 'gestor' ? 'Gestor — acesso total.' : 'Vendedor — selecione os acessos.'}
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, padding: '16px 24px', borderTop: '1px solid var(--sv-border)' }}>
                <button className="btn btn-outline" type="button" onClick={() => setMostrarForm(false)} disabled={salvando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={salvando}>
                  {salvando ? 'Convidando...' : 'Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner"></div>
        </div>
      ) : membros.length === 0 ? (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <h3>Nenhum membro cadastrado</h3>
          <p>Convide gestores e vendedores para colaborar na sua loja.</p>
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ padding: 0 }}>
            <div className="table-scroll">
            <table className="responsive-table" style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--sv-text-dim)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px', width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={membros.length > 0 && selectedIds.length === membros.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--sv-primary)' }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px' }}>Nome</th>
                  <th style={{ padding: '12px 16px' }}>E-mail</th>
                  <th style={{ padding: '12px 16px' }}>Papel</th>
                  <th style={{ padding: '12px 16px' }}>Comissão</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m) => {
                  const isSelected = selectedIds.includes(m.id)
                  return (
                    <tr
                      key={m.id}
                      style={{ borderTop: '1px solid var(--sv-border)', cursor: 'pointer' }}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => setMembroAcessos(m)}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(m.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--sv-primary)' }}
                        />
                      </td>
                      <td className="cell-title" data-label="Nome" style={{ padding: '12px 16px', fontWeight: 600 }}>{m.nome}</td>
                      <td data-label="E-mail" style={{ padding: '12px 16px', color: 'var(--sv-text-dim)', wordBreak: 'break-word' }}>{m.email}</td>
                      <td data-label="Papel" style={{ padding: '12px 16px' }}>{PAPEL_LABEL[m.papel] ?? m.papel}</td>
                      <td data-label="Comissão" style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {m.papel === 'vendedor' ? (
                          <ComissaoInput
                            membro={m}
                            onSaved={(pct) =>
                              setMembros((prev) => prev.map((x) => (x.id === m.id ? { ...x, percentual_comissao: pct } : x)))
                            }
                          />
                        ) : (
                          <span style={{ color: 'var(--sv-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td data-label="Status" style={{ padding: '12px 16px' }}>
                        <span style={{ color: m.ativo ? 'var(--sv-success)' : 'var(--sv-text-muted)', fontWeight: 600 }}>
                          {m.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="sv-selection-bar" style={{
              position: 'sticky',
              bottom: 20,
              marginTop: 16,
              background: 'var(--sv-surface-dim)',
              border: '1px solid var(--sv-border)',
              backdropFilter: 'blur(var(--sv-blur))',
              padding: '12px 20px',
              borderRadius: 'var(--sv-radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 20,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {selectedIds.length} membro(s) selecionado(s)
              </span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setModalEdicaoLote(true)}>
                  ✏️ Editar Selecionados
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleBulkDesativar}>
                  🚫 Desativar Selecionados
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleBulkRemover}>
                  🗑️ Remover Selecionados
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
                  Limpar Seleção
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modalEdicaoLote && (
        <ModalEdicaoLoteEquipe
          selectedIds={selectedIds}
          membros={membros}
          disponiveis={disponiveis}
          onClose={() => setModalEdicaoLote(false)}
          onSaved={() => {
            setSelectedIds([])
            carregar()
          }}
        />
      )}

      {membroPermissaoIa && (
        <PermissaoIAModal membro={membroPermissaoIa} onClose={() => setMembroPermissaoIa(null)} />
      )}

      {membroAcessos && (
        <EditarAcessosModal
          membro={membroAcessos}
          disponiveis={disponiveis}
          selectedIds={selectedIds}
          onClose={() => setMembroAcessos(null)}
          onSaved={(novos, affectedIds) => {
            setMembros((prev) => prev.map((x) => (affectedIds.includes(x.id) ? { ...x, modulos: novos } : x)))
            setMembroAcessos(null)
          }}
          onToggleAtivo={(m) => {
            handleToggleAtivo(m)
            setMembroAcessos(null)
          }}
          onRemover={(m) => {
            handleRemover(m)
            setMembroAcessos(null)
          }}
          onConfigIa={(m) => {
            setMembroAcessos(null)
            setMembroPermissaoIa(m)
          }}
        />
      )}
    </div>
  )
}

/** Override de % de comissão por vendedor. Vazio = usa o padrão da loja. Salva no blur. */
function ComissaoInput({ membro, onSaved }: { membro: Membro; onSaved: (pct: number | null) => void }) {
  const [valor, setValor] = useState(membro.percentual_comissao != null ? String(membro.percentual_comissao) : '')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    const limpo = valor.trim()
    const pct = limpo === '' ? null : Math.min(100, Math.max(0, parseFloat(limpo.replace(',', '.')) || 0))
    if (pct === (membro.percentual_comissao ?? null)) return
    setSalvando(true)
    try {
      await api.patch(`/equipe/${membro.id}`, { percentual_comissao: pct })
      onSaved(pct)
    } catch (err) {
      console.error(err)
      setValor(membro.percentual_comissao != null ? String(membro.percentual_comissao) : '')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ''))}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--sv-primary)'
        }}
        onBlur={(e) => {
          salvar()
          e.currentTarget.style.borderColor = 'var(--sv-border)'
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        placeholder="—"
        disabled={salvando}
        inputMode="decimal"
        style={{
          width: 54,
          textAlign: 'center',
          padding: '6px 8px',
          fontSize: 13,
          borderRadius: 'var(--sv-radius, 6px)',
          background: 'var(--sv-surface-dim)',
          border: '1px solid var(--sv-border)',
          color: 'var(--sv-text)',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        title="% de comissão deste vendedor. Vazio = usa o padrão da loja."
      />
      <span style={{ fontSize: 12, color: 'var(--sv-text-muted)', fontStyle: valor === '' ? 'italic' : 'normal' }}>
        {valor === '' ? 'usa o padrão' : '%'}
      </span>
    </span>
  )
}

function ModulosChecklist({
  modulos,
  disponiveis,
  onToggle,
  disabled,
  hint,
}: {
  modulos: ModuloKey[]
  /** Núcleo + premium contratados pela loja. O resto aparece bloqueado. */
  disponiveis: ModuloKey[]
  onToggle: (key: ModuloKey) => void
  disabled?: boolean
  hint?: string
}) {
  const bloqueados = MODULOS.filter((m) => !disponiveis.includes(m.key))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Módulos de acesso</strong>
        {hint && <small style={{ color: 'var(--sv-text-muted)', fontSize: 11 }}>{hint}</small>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {MODULOS.map((mod) => {
          const contratado = disponiveis.includes(mod.key)
          const on = contratado && modulos.includes(mod.key)
          const travado = disabled || !contratado
          return (
            <label
              key={mod.key}
              title={contratado ? undefined : 'Módulo não contratado por esta loja.'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                fontSize: 13,
                cursor: travado ? 'not-allowed' : 'pointer',
                opacity: !contratado ? 0.45 : disabled ? 0.7 : 1,
                borderRadius: 'var(--sv-radius)',
                border: `1px solid ${on ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                background: on ? 'rgba(59,130,246,0.10)' : 'var(--sv-surface-dim)',
                color: on ? 'var(--sv-primary-text)' : 'var(--sv-text)',
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={travado}
                onChange={() => onToggle(mod.key)}
                style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)', cursor: travado ? 'not-allowed' : 'pointer' }}
              />
              <span style={{ flex: 1 }}>{mod.label}</span>
              {!contratado && (
                <span style={{ fontSize: 10, color: 'var(--sv-text-muted)', whiteSpace: 'nowrap' }}>
                  não contratado
                </span>
              )}
            </label>
          )
        })}
      </div>
      {bloqueados.length > 0 && (
        <small style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'var(--sv-text-muted)' }}>
          Módulos em cinza não fazem parte do plano desta loja. Fale com o suporte para contratá-los.
        </small>
      )}
    </div>
  )
}

function EditarAcessosModal({
  membro,
  disponiveis,
  selectedIds,
  onClose,
  onSaved,
  onToggleAtivo,
  onRemover,
  onConfigIa,
}: {
  membro: Membro
  disponiveis: ModuloKey[]
  selectedIds: string[]
  onClose: () => void
  onSaved: (modulos: string, affectedIds: string[]) => void
  onToggleAtivo: (m: Membro) => void
  onRemover: (m: Membro) => void
  onConfigIa: (m: Membro) => void
}) {
  const [modulos, setModulos] = useState<ModuloKey[]>(
    parseModulos(membro.modulos).filter((k) => disponiveis.includes(k)),
  )
  const [salvando, setSalvando] = useState(false)
  const showToast = useUIStore((state) => state.showToast)
  const confirm = useUIStore((state) => state.confirm)

  const toggle = (key: ModuloKey) =>
    setModulos((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]))

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const serializado = JSON.stringify(modulos)

      // Se há múltiplos membros selecionados (ou se este membro faz parte de uma seleção maior)
      if (selectedIds.length > 1) {
        const confirmarReplicar = await confirm({
          title: 'Replicar Permissões?',
          message: `Você possui ${selectedIds.length} membros selecionados na equipe. Deseja replicar estes mesmos acessos para todos os ${selectedIds.length} membros selecionados ou salvar apenas para ${membro.nome}?`,
          confirmText: `Replicar para os ${selectedIds.length}`,
          cancelText: 'Salvar apenas para este',
        })

        if (confirmarReplicar) {
          await Promise.all(selectedIds.map(id => api.patch(`/equipe/${id}`, { modulos: serializado })))
          showToast(`Acessos replicados com sucesso para ${selectedIds.length} membros!`, 'success')
          onSaved(serializado, selectedIds)
          return
        }
      }

      await api.patch(`/equipe/${membro.id}`, { modulos: serializado })
      showToast('Acessos atualizados com sucesso!', 'success')
      onSaved(serializado, [membro.id])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar acessos.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 520, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3>Editar Acessos & Permissões</h3>
            <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', marginTop: 2 }}>{membro.nome} ({membro.email})</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* Top actions bar */}
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--sv-surface-dim)',
          borderBottom: '1px solid var(--sv-border)',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 12, color: 'var(--sv-text-dim)', fontWeight: 600 }}>
            Status: <strong style={{ color: membro.ativo ? 'var(--sv-success)' : 'var(--sv-text-muted)' }}>{membro.ativo ? 'ATIVO' : 'INATIVO'}</strong>
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {membro.papel === 'vendedor' && (
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => onConfigIa(membro)}
                title="Configurações de IA deste vendedor"
              >
                🤖 Config. IA
              </button>
            )}
            <button
              type="button"
              className="btn btn-glass btn-sm"
              onClick={() => onToggleAtivo(membro)}
            >
              {membro.ativo ? 'Desativar Membro' : 'Ativar Membro'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => { onClose(); onRemover(membro); }}
            >
              Remover Membro
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ModulosChecklist
            modulos={modulos}
            disponiveis={disponiveis}
            onToggle={toggle}
            hint="Marque os módulos liberados a este vendedor."
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Acessos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PermissaoIAModal({ membro, onClose }: { membro: Membro; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [podeUsar, setPodeUsar] = useState(false)
  const [autonomia, setAutonomia] = useState<'copiloto' | 'automatico'>('copiloto')
  const [salvando, setSalvando] = useState(false)
  
  const showToast = useUIStore((state) => state.showToast)

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      try {
        const res = await api.get<{ pode_usar: boolean; autonomia_default: 'copiloto' | 'automatico' }>(`/equipe/${membro.usuario_id}/assistente`)
        setPodeUsar(res.pode_usar)
        setAutonomia(res.autonomia_default)
      } catch (err) {
        console.error(err)
        showToast('Erro ao carregar permissões de IA.', 'error')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [membro.usuario_id, showToast])

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      await api.put(`/equipe/${membro.usuario_id}/assistente`, {
        pode_usar: podeUsar,
        autonomia_default: autonomia
      })
      showToast('Permissões de IA atualizadas com sucesso!', 'success')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Erro ao salvar permissões de IA.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 450, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Permissões de IA — {membro.nome}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sv-surface-dim)', padding: '12px', borderRadius: 8, border: '1px solid var(--sv-border)' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Habilitar Assistente de IA</strong>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--sv-text-dim)' }}>Permite que o vendedor conecte o WhatsApp dele.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={podeUsar} 
                  onChange={e => setPodeUsar(e.target.checked)} 
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Autonomia Padrão</label>
                <select 
                  value={autonomia} 
                  onChange={e => setAutonomia(e.target.value as any)}
                  style={inputStyle}
                  disabled={!podeUsar}
                >
                  <option value="copiloto">Copiloto (IA sugere respostas)</option>
                  <option value="automatico">Automático (IA responde direto)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '6px',
  background: 'var(--sv-surface-dim)',
  border: '1px solid var(--sv-border)',
  color: 'var(--sv-text)',
  outline: 'none',
}

function ModalEdicaoLoteEquipe({
  selectedIds,
  membros,
  disponiveis,
  onClose,
  onSaved,
}: {
  selectedIds: string[]
  membros: Membro[]
  disponiveis: ModuloKey[]
  onClose: () => void
  onSaved: () => void
}) {
  const showToast = useUIStore((state) => state.showToast)
  const [salvando, setSalvando] = useState(false)

  // Módulos de acesso (em foco como padrão)
  const [modulosSelecionados, setModulosSelecionados] = useState<ModuloKey[]>([])
  const [aplicarModulos, setAplicarModulos] = useState(true)

  // Opções extras opcionais
  const [mostrarOutrasOpcoes, setMostrarOutrasOpcoes] = useState(false)
  const [aplicarComissao, setAplicarComissao] = useState(false)
  const [comissaoValor, setComissaoValor] = useState('5')
  const [aplicarPapel, setAplicarPapel] = useState(false)
  const [papelValor, setPapelValor] = useState<Papel>('vendedor')
  const [aplicarStatus, setAplicarStatus] = useState(false)
  const [statusValor, setStatusValor] = useState(true)
  const [aplicarIA, setAplicarIA] = useState(false)
  const [iaPermitida, setIaPermitida] = useState(true)

  const toggleModulo = (key: ModuloKey) => {
    setModulosSelecionados(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleSalvar = async () => {
    if (!aplicarModulos && !aplicarComissao && !aplicarPapel && !aplicarStatus && !aplicarIA) {
      showToast('Selecione pelo menos uma configuração para aplicar em lote.', 'warning')
      return
    }

    setSalvando(true)
    try {
      const payload: Record<string, any> = {}
      if (aplicarModulos) {
        payload.modulos = JSON.stringify(modulosSelecionados)
      }
      if (aplicarComissao) {
        const num = comissaoValor.trim() === '' ? null : Math.min(100, Math.max(0, parseFloat(comissaoValor.replace(',', '.')) || 0))
        payload.percentual_comissao = num
      }
      if (aplicarPapel) {
        payload.papel = papelValor
      }
      if (aplicarStatus) {
        payload.ativo = statusValor
      }

      await Promise.all(selectedIds.map(id => api.patch(`/equipe/${id}`, payload)))

      if (aplicarIA) {
        await Promise.all(
          selectedIds.map(id =>
            api.put(`/vendedores/${id}/permissao-ia`, {
              permitido: iaPermitida,
              autonomia: 'copiloto',
            }).catch(() => {})
          )
        )
      }

      showToast(`Permissões e configurações aplicadas com sucesso a ${selectedIds.length} membros!`, 'success')
      onSaved()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar membros em lote.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 620, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Editar Permissões em Lote</h3>
            <div style={{ fontSize: 13, color: 'var(--sv-text-muted)', marginTop: 2 }}>
              Definindo permissões para <strong>{selectedIds.length} membro(s)</strong> selecionado(s).
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Módulos de Acesso — Destaque principal */}
          <div style={{ padding: 14, borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={aplicarModulos}
                onChange={e => setAplicarModulos(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)' }}
              />
              Módulos de Acesso dos Membros Selecionados
            </label>
            {aplicarModulos && (
              <div style={{ paddingLeft: 8 }}>
                <ModulosChecklist
                  modulos={modulosSelecionados}
                  disponiveis={disponiveis}
                  onToggle={toggleModulo}
                  hint="Marque os módulos que ficarão liberados para todos os selecionados."
                />
              </div>
            )}
          </div>

          {/* Opções adicionais recolhíveis */}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMostrarOutrasOpcoes(!mostrarOutrasOpcoes)}
              style={{ fontSize: 12, color: 'var(--sv-text-dim)', padding: 0 }}
            >
              {mostrarOutrasOpcoes ? '▲ Ocultar outras opções em lote' : '▼ Mais opções em lote (Comissão, Cargo, Status, IA)'}
            </button>
          </div>

          {mostrarOutrasOpcoes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 1. Comissão */}
              <div style={{ padding: 14, borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={aplicarComissao}
                    onChange={e => setAplicarComissao(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)' }}
                  />
                  Definir % de Comissão dos Vendedores
                </label>
                {aplicarComissao && (
                  <div style={{ marginTop: 10, paddingLeft: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="text"
                      value={comissaoValor}
                      onChange={e => setComissaoValor(e.target.value.replace(/[^\d.,]/g, ''))}
                      placeholder="Ex: 5"
                      style={{ ...inputStyle, width: 80, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>% de comissão por venda</span>
                  </div>
                )}
              </div>

              {/* 2. Papel */}
              <div style={{ padding: 14, borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={aplicarPapel}
                    onChange={e => setAplicarPapel(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)' }}
                  />
                  Alterar Papel / Cargo
                </label>
                {aplicarPapel && (
                  <div style={{ marginTop: 10, paddingLeft: 28 }}>
                    <select
                      value={papelValor}
                      onChange={e => setPapelValor(e.target.value as Papel)}
                      style={inputStyle}
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 3. Permissão de IA */}
              <div style={{ padding: 14, borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={aplicarIA}
                    onChange={e => setAplicarIA(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)' }}
                  />
                  Permissão de Assistente IA
                </label>
                {aplicarIA && (
                  <div style={{ marginTop: 10, paddingLeft: 28 }}>
                    <select
                      value={iaPermitida ? 'sim' : 'nao'}
                      onChange={e => setIaPermitida(e.target.value === 'sim')}
                      style={inputStyle}
                    >
                      <option value="sim">Habilitar IA para todos os selecionados</option>
                      <option value="nao">Desabilitar IA para todos os selecionados</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 4. Status */}
              <div style={{ padding: 14, borderRadius: 'var(--sv-radius)', background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={aplicarStatus}
                    onChange={e => setAplicarStatus(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)' }}
                  />
                  Status do Usuário
                </label>
                {aplicarStatus && (
                  <div style={{ marginTop: 10, paddingLeft: 28 }}>
                    <select
                      value={statusValor ? 'ativo' : 'inativo'}
                      onChange={e => setStatusValor(e.target.value === 'ativo')}
                      style={inputStyle}
                    >
                      <option value="ativo">Marcar como Ativos</option>
                      <option value="inativo">Marcar como Inativos / Desativados</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--sv-border)' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : `Aplicar a ${selectedIds.length} Membro(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
