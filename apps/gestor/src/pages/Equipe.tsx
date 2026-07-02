import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../stores/uiStore'
import { mascararTelefone, capitalizarNome } from '../lib/mascaras'
import { MODULOS, TODOS_MODULOS, parseModulos, type ModuloKey } from '../lib/modulos'

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
  ativo: boolean
  created_at: string
}

const PAPEL_LABEL: Record<string, string> = {
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  admin_plataforma: 'Admin',
  cliente: 'Cliente',
}

export function Equipe() {
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membroPermissaoIa, setMembroPermissaoIa] = useState<Membro | null>(null)
  const [membroAcessos, setMembroAcessos] = useState<Membro | null>(null)

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
    setForm((f) => ({ ...f, papel, modulos: papel === 'gestor' ? [...TODOS_MODULOS] : f.modulos }))
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

  useEffect(() => {
    carregar()
  }, [])

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6) {
      showToast('Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.', 'warning')
      return
    }
    setSalvando(true)
    try {
      const modulos = form.papel === 'gestor' ? TODOS_MODULOS : form.modulos
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

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Equipe</h2>
          <p>Gerencie os gestores e vendedores da sua loja.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Fechar' : '+ Convidar Membro'}
        </button>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {mostrarForm && (
        <form className="glass-card" onSubmit={handleConvidar} style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
            placeholder="Nome completo"
            style={inputStyle}
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value.replace(/\s+/g, '') })}
            onKeyDown={(e) => {
              if (e.key === ' ') {
                e.preventDefault();
              }
            }}
            placeholder="E-mail"
            type="email"
            style={inputStyle}
          />
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: mascararTelefone(e.target.value) })}
            placeholder="Telefone (opcional)"
            style={inputStyle}
          />
          <select
            value={form.papel}
            onChange={(e) => handlePapelChange(e.target.value as Papel)}
            style={inputStyle}
          >
            <option value="vendedor">Vendedor</option>
            <option value="gestor">Gestor</option>
          </select>
          <input
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder="Senha provisória (mín. 6)"
            type="password"
            style={inputStyle}
          />

          <div style={{ gridColumn: '1 / 3' }}>
            <ModulosChecklist
              modulos={form.papel === 'gestor' ? TODOS_MODULOS : form.modulos}
              onToggle={toggleModulo}
              disabled={form.papel === 'gestor'}
              hint={form.papel === 'gestor' ? 'Gestor — acesso total a todos os módulos.' : 'Vendedor — selecione os módulos liberados.'}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={salvando} style={{ gridColumn: '2', justifySelf: 'end' }}>
            {salvando ? 'Convidando...' : 'Convidar'}
          </button>
        </form>
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
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--sv-text-dim)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Nome</th>
                <th style={{ padding: '12px 16px' }}>E-mail</th>
                <th style={{ padding: '12px 16px' }}>Papel</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--sv-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.nome}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--sv-text-dim)' }}>{m.email}</td>
                  <td style={{ padding: '12px 16px' }}>{PAPEL_LABEL[m.papel] ?? m.papel}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: m.ativo ? 'var(--sv-success)' : 'var(--sv-text-muted)', fontWeight: 600 }}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {m.papel === 'vendedor' && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => setMembroAcessos(m)}>
                          Editar Acessos
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setMembroPermissaoIa(m)}>
                          Config. IA
                        </button>
                      </>
                    )}
                    <button className="btn btn-glass btn-sm" onClick={() => handleToggleAtivo(m)}>
                      {m.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemover(m)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {membroPermissaoIa && (
        <PermissaoIAModal membro={membroPermissaoIa} onClose={() => setMembroPermissaoIa(null)} />
      )}

      {membroAcessos && (
        <EditarAcessosModal
          membro={membroAcessos}
          onClose={() => setMembroAcessos(null)}
          onSaved={(novos) => {
            setMembros((prev) => prev.map((x) => (x.id === membroAcessos.id ? { ...x, modulos: novos } : x)))
            setMembroAcessos(null)
          }}
        />
      )}
    </div>
  )
}

function ModulosChecklist({
  modulos,
  onToggle,
  disabled,
  hint,
}: {
  modulos: ModuloKey[]
  onToggle: (key: ModuloKey) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Módulos de acesso</strong>
        {hint && <small style={{ color: 'var(--sv-text-muted)', fontSize: 11 }}>{hint}</small>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {MODULOS.map((mod) => {
          const on = modulos.includes(mod.key)
          return (
            <label
              key={mod.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                fontSize: 13,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.7 : 1,
                borderRadius: 'var(--sv-radius)',
                border: `1px solid ${on ? 'var(--sv-primary)' : 'var(--sv-border)'}`,
                background: on ? 'rgba(59,130,246,0.10)' : 'var(--sv-surface-dim)',
                color: on ? 'var(--sv-primary-text)' : 'var(--sv-text)',
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() => onToggle(mod.key)}
                style={{ width: 18, height: 18, accentColor: 'var(--sv-primary)', cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              {mod.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function EditarAcessosModal({
  membro,
  onClose,
  onSaved,
}: {
  membro: Membro
  onClose: () => void
  onSaved: (modulos: string) => void
}) {
  const [modulos, setModulos] = useState<ModuloKey[]>(parseModulos(membro.modulos))
  const [salvando, setSalvando] = useState(false)
  const showToast = useUIStore((state) => state.showToast)

  const toggle = (key: ModuloKey) =>
    setModulos((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]))

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const serializado = JSON.stringify(modulos)
      await api.patch(`/equipe/${membro.id}`, { modulos: serializado })
      showToast('Acessos atualizados com sucesso!', 'success')
      onSaved(serializado)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar acessos.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Editar Acessos — {membro.nome}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ModulosChecklist modulos={modulos} onToggle={toggle} hint="Marque os módulos liberados a este vendedor." />
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
          <button className="modal-close" onClick={onClose}>×</button>
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
