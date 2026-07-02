import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useLojaAtivaStore } from '../stores/lojaAtivaStore'

export interface LojaResumo {
  id: string
  nome: string
  cidade?: string | null
  estado?: string | null
  ativa: boolean
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nome.slice(0, 2).toUpperCase()
}

function localidade(l: LojaResumo): string {
  return [l.cidade, l.estado].filter(Boolean).join(' · ')
}

/** Hook: carrega as lojas da plataforma (admin). */
function useLojas() {
  const [lojas, setLojas] = useState<LojaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api
      .get<LojaResumo[]>('/admin/lojas')
      .then((data) => { if (vivo) setLojas(data) })
      .catch(() => { if (vivo) setErro('Não foi possível carregar as lojas.') })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [])

  return { lojas, loading, erro }
}

const logoStyle: React.CSSProperties = {
  borderRadius: 8, flexShrink: 0, color: '#fff', fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, var(--sv-primary), #6366f1)',
}

/**
 * Tela cheia exibida ao admin de plataforma que ainda não escolheu loja.
 * Bloqueia o gestor até uma loja ser selecionada (o backend responde 409 sem X-Loja-Id).
 */
export function SeletorLojaGate() {
  const { lojas, loading, erro } = useLojas()
  const setLoja = useLojaAtivaStore((s) => s.setLoja)
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lojas
    return lojas.filter(
      (l) => l.nome.toLowerCase().includes(q) || localidade(l).toLowerCase().includes(q),
    )
  }, [lojas, busca])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--sv-bg)' }}>
      <div style={{ width: '100%', maxWidth: 620, background: 'var(--sv-surface)', border: '1px solid var(--sv-border)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--sv-primary) 14%, transparent)', color: 'var(--sv-primary)', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999, marginBottom: 20 }}>
          🛡️ Modo Suporte
        </span>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Escolha uma loja para operar</h2>
        <p style={{ color: 'var(--sv-text-dim)', fontSize: 15, marginBottom: 28 }}>
          Como suporte da plataforma, você acessa qualquer loja para ajustes e correções. Selecione abaixo.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)', padding: '11px 14px', marginBottom: 18 }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--sv-text-muted)" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar loja por nome ou cidade..."
            autoFocus
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--sv-text)', fontSize: 14, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', maxHeight: 340, overflowY: 'auto' }}>
          {loading && <p style={{ color: 'var(--sv-text-muted)', padding: 16, textAlign: 'center' }}>Carregando lojas…</p>}
          {erro && <p style={{ color: 'var(--sv-error, #ef4444)', padding: 16, textAlign: 'center' }}>{erro}</p>}
          {!loading && !erro && filtradas.length === 0 && (
            <p style={{ color: 'var(--sv-text-muted)', padding: 16, textAlign: 'center' }}>Nenhuma loja encontrada.</p>
          )}
          {filtradas.map((l) => (
            <div
              key={l.id}
              onClick={() => setLoja(l.id, l.nome)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)', padding: '13px 16px', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sv-primary)'; e.currentTarget.style.background = 'var(--sv-surface-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--sv-border)'; e.currentTarget.style.background = 'var(--sv-bg)' }}
            >
              <div style={{ ...logoStyle, width: 42, height: 42, fontSize: 15 }}>{iniciais(l.nome)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{l.nome}</div>
                <div style={{ fontSize: 12.5, color: 'var(--sv-text-muted)' }}>{localidade(l) || '—'}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em', ...(l.ativa ? { color: '#34d399', background: 'color-mix(in srgb, #34d399 15%, transparent)' } : { color: 'var(--sv-text-muted)', background: 'var(--sv-surface-hover)' }) }}>
                {l.ativa ? 'Ativa' : 'Inativa'}
              </span>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--sv-text-muted)" strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Switcher compacto no topbar — troca a loja ativa sem sair da tela. */
export function SeletorLojaSwitcher() {
  const { lojas } = useLojas()
  const { lojaId, lojaNome, setLoja } = useLojaAtivaStore()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const nomeAtual = lojaNome ?? 'Selecionar loja'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 14%, transparent)', padding: '5px 11px', borderRadius: 999 }}>
        🛡️ Suporte
      </span>
      <div
        onClick={() => setAberto((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setAberto((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius)', padding: '7px 12px', cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sv-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--sv-border)' }}
      >
        <div style={{ ...logoStyle, width: 26, height: 26, fontSize: 11 }}>{lojaNome ? iniciais(lojaNome) : '?'}</div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>Operando</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{nomeAtual}</div>
        </div>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--sv-text-muted)" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      {aberto && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 300, background: 'var(--sv-surface-solid)', border: '1px solid var(--sv-border)', borderRadius: 10, padding: 6, boxShadow: '0 20px 40px -12px rgba(0,0,0,.6)', zIndex: 1001 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--sv-text-muted)', padding: '8px 10px 6px', fontWeight: 700 }}>Trocar de loja</div>
          {lojas.map((l) => {
            const ativa = l.id === lojaId
            return (
              <div
                key={l.id}
                onClick={() => { setLoja(l.id, l.nome); setAberto(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer', ...(ativa ? { background: 'color-mix(in srgb, var(--sv-primary) 12%, transparent)' } : undefined) }}
                onMouseEnter={(e) => { if (!ativa) e.currentTarget.style.background = 'var(--sv-surface-hover)' }}
                onMouseLeave={(e) => { if (!ativa) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ ...logoStyle, width: 28, height: 28, fontSize: 11 }}>{iniciais(l.nome)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>{localidade(l) || '—'}</div>
                </div>
                {ativa && (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--sv-primary)" strokeWidth={2.5} style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
