import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useSiteConfig } from '../lib/SiteContext'
import { LoginModal } from '../components/LoginModal'
import { MfaSettingsModal } from '../components/MfaSettingsModal'
import { api } from '../lib/api'
import { whatsappLojaLink } from '../lib/contato'
import { CarCard } from '../components/CarCard'
import { BottomNav } from '../components/BottomNav'


/* ── Types ───────────────────────────────────────────────────── */

type FiltroRapido = 'Todos' | 'Ofertas' | 'Novidades' | 'Destaques'

interface Midia {
  id: string
  tipo: 'foto' | 'video'
  url: string
  ordem: number
}

interface Story {
  id: string
  loja_id: string
  loja_nome: string
  loja_logo?: string
  veiculo_id?: string
  veiculo_marca?: string
  veiculo_modelo?: string
  veiculo_preco?: number
  midia_url?: string
  legenda?: string
  expira_em: string
  created_at: string
}

interface Veiculo {
  id: string
  loja_id: string
  loja_nome?: string
  loja_logo?: string
  loja_cidade?: string
  loja_estado?: string
  loja_whatsapp?: string
  loja_verificada?: boolean
  seguindo_loja?: boolean
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao: number
  ano_modelo: number
  km: number
  cor?: string
  cambio?: string
  combustivel?: string
  tipo?: string
  portas?: number
  preco_venda?: number
  descricao?: string
  opcionais?: string
  midias: Midia[]
  status: string
  total_favoritos: number
  favoritado_por_mim: boolean
}

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
    <rect x="1" y="6" width="22" height="10" rx="3" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M5 6L7 2h10l2 4" />
  </svg>
)

export function Feed() {
  const navigate = useNavigate()
  const { isAuthenticated, user, openLoginModal, logout, updateUser } = useAuthStore()
  const { lojaId, isWhiteLabel } = useSiteConfig()

  // Tema escuro
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('vt-theme') === 'dark'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('vt-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Feed states
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Filter states
  const [search, setSearch] = useState('')
  const [ordenacao, setOrdenacao] = useState('')
  const [selectedStory, setSelectedStory] = useState('')
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('Todos')

  // Stories reais
  const [stories, setStories] = useState<Story[]>([])
  const [storyAberto, setStoryAberto] = useState<Story | null>(null)
  const [showPerfilModal, setShowPerfilModal] = useState(false)
  const [showMfaModal, setShowMfaModal] = useState(false)

  // Avatar (foto de perfil) states
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [headerAvatarError, setHeaderAvatarError] = useState(false)
  const [modalAvatarError, setModalAvatarError] = useState(false)
  const [previewAvatarError, setPreviewAvatarError] = useState(false)

  useEffect(() => {
    setHeaderAvatarError(false)
    setModalAvatarError(false)
    setPreviewAvatarError(false)
  }, [user?.avatar_url])

  const perPage = 12
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (isAuthenticated) {
      api.get<Story[]>('/vitrine/stories').then(setStories).catch(() => {})
    }
  }, [])

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecione um arquivo de imagem válido.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setAvatarError('Imagem muito grande. Limite máximo: 15MB.')
      return
    }
    setAvatarError(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveAvatar = async () => {
    if (!avatarFile) return
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('file', avatarFile)
      const res = await fetch('/v1/auth/me/avatar', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      updateUser({ avatar_url: data.avatar_url })
      setAvatarFile(null)
      setAvatarPreview(null)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Falha ao salvar a foto.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const closePerfilModal = () => {
    setShowPerfilModal(false)
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarError(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  // Fetch feed
  const fetchFeed = useCallback(async (currentPage: number, resetList = false) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(currentPage),
        per_page: String(perPage)
      }
      if (search && isAuthenticated) params.q = search
      if (ordenacao && isAuthenticated) params.ordenacao = ordenacao
      if (selectedStory && isAuthenticated && !['Ofertas', 'Novidades', 'Destaques'].includes(selectedStory)) {
        params.carroceria = selectedStory
      }
      if (isWhiteLabel && lojaId) params.loja_id = lojaId

      const data = await api.get<Veiculo[]>('/marketplace/feed', params)
      
      setVeiculos(prev => {
        if (resetList || currentPage === 1) return data
        // Evitar duplicatas
        const existingIds = new Set(prev.map(v => v.id))
        const filteredNew = data.filter(v => !existingIds.has(v.id))
        return [...prev, ...filteredNew]
      })
      
      if (data.length < perPage) {
        setHasMore(false)
      } else {
        setHasMore(true)
      }
    } catch (err) {
      console.error('Erro ao carregar feed B2C:', err)
    } finally {
      setLoading(false)
    }
  }, [search, ordenacao, selectedStory, isAuthenticated])

  // Reset page and reload feed when filters change
  useEffect(() => {
    setPage(1)
    fetchFeed(1, true)
  }, [search, ordenacao, selectedStory, isAuthenticated, fetchFeed])

  // Load next page
  useEffect(() => {
    if (page > 1) {
      fetchFeed(page, false)
    }
  }, [page, fetchFeed])

  // Scroll handler (Infinite Scroll + Login Gate)
  useEffect(() => {
    let hasTriggeredLogin = false
    const handleScroll = () => {
      // 1. Login Gate on scroll > 400px if deslogado
      if (!isAuthenticated && window.scrollY > 400 && !hasTriggeredLogin) {
        hasTriggeredLogin = true
        openLoginModal('login')
        return
      }

      // 2. Infinite scroll if logado
      if (isAuthenticated && hasMore && !loading) {
        const threshold = 100
        const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold
        if (isNearBottom) {
          setPage(prev => prev + 1)
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isAuthenticated, hasMore, loading, openLoginModal])

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(value)
    }, 400)
  }


  const handleFavoritar = async (veiculoId: string, favoritado: boolean) => {
    if (!isAuthenticated) {
      openLoginModal('login')
      return
    }
    
    // Otimista
    setVeiculos(prev => prev.map(v => {
      if (v.id === veiculoId) {
        return {
          ...v,
          favoritado_por_mim: !favoritado,
          total_favoritos: favoritado ? Math.max(0, v.total_favoritos - 1) : v.total_favoritos + 1
        }
      }
      return v
    }))

    try {
      if (favoritado) {
        await api.delete(`/vitrine/favoritos/${veiculoId}`)
      } else {
        await api.post('/vitrine/favoritos', { veiculo_id: veiculoId })
      }
    } catch (err) {
      console.error('Erro ao favoritar/desfavoritar:', err)
      // Reverter se der erro
      setVeiculos(prev => prev.map(v => {
        if (v.id === veiculoId) {
          return {
            ...v,
            favoritado_por_mim: favoritado,
            total_favoritos: favoritado ? v.total_favoritos + 1 : Math.max(0, v.total_favoritos - 1)
          }
        }
        return v
      }))
    }
  }

  const handleConversar = async (veiculo: Veiculo) => {
    if (!isAuthenticated) {
      openLoginModal('login')
      return
    }
    
    try {
      const msg = `Olá, estou interessado no veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_modelo}).`
      const res = await api.post<{ id: string }>('/vitrine/conversas', {
        veiculo_id: veiculo.id,
        loja_id: veiculo.loja_id,
        mensagem: msg
      })
      navigate('/mensagens', { state: { conversaId: res.id } })
    } catch (err) {
      console.error('Erro ao iniciar conversa:', err)
    }
  }

  const handleSeguir = async (lojaId: string, seguindo: boolean) => {
    if (!isAuthenticated) { openLoginModal('login'); return }
    setVeiculos(prev => prev.map(v =>
      v.loja_id === lojaId ? { ...v, seguindo_loja: !seguindo } : v
    ))
    try {
      if (seguindo) {
        await api.delete(`/vitrine/lojas/${lojaId}/seguir`)
      } else {
        await api.post(`/vitrine/lojas/${lojaId}/seguir`, {})
      }
    } catch {
      setVeiculos(prev => prev.map(v =>
        v.loja_id === lojaId ? { ...v, seguindo_loja: seguindo } : v
      ))
    }
  }

  const handleWhatsApp = (veiculo: Veiculo) => {
    const text = `Olá! Vi o carro ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_fabricacao}/${veiculo.ano_modelo}) na Vitrine do Social Veículos e gostaria de mais informações.`
    const link = whatsappLojaLink(veiculo.loja_whatsapp, text)
    if (!link) {
      useUIStore.getState().showToast('Esta loja não tem WhatsApp cadastrado. Use o chat interno.', 'info')
      return
    }
    window.open(link, '_blank')
  }


  const handleFiltroRapido = (f: FiltroRapido) => {
    if (!isAuthenticated && f !== 'Todos') { openLoginModal('login'); return }
    setFiltroRapido(f)
    setSelectedStory('')
    setSearch('')
    if (f === 'Ofertas') setOrdenacao('ofertas')
    else if (f === 'Novidades') setOrdenacao('novidades')
    else setOrdenacao('')
  }

  return (
    <>
      {/* Topbar */}
      <header className="vt-topbar">
        <div className="vt-topbar-brand">Social Veículos</div>

        {/* Centro: busca + filtros sutis */}
        <div className="vt-topbar-center">
          {isAuthenticated && (
            <div className="vt-topbar-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar carros..."
                id="feed-search"
                onChange={e => handleSearchChange(e.target.value)}
              />
            </div>
          )}
          <div className="vt-filter-chips">
            {(['Todos', 'Ofertas', 'Novidades', 'Destaques'] as FiltroRapido[]).map(f => (
              <button
                key={f}
                className={`vt-chip-filter${filtroRapido === f ? ' active' : ''}`}
                onClick={() => handleFiltroRapido(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="vt-topbar-actions">
          {/* Toggle tema */}
          <button className="vt-icon-btn" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Tema claro' : 'Tema escuro'}>
            {darkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {isAuthenticated && user ? (
            <div
              className="vt-avatar"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--vt-primary-light)', color: 'var(--vt-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '1px solid var(--vt-border)', cursor: 'pointer' }}
              onClick={() => setShowPerfilModal(true)}
              title={user.email}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : user.avatar_url && !headerAvatarError ? (
                <img src={user.avatar_url} alt={user.nome} onError={() => setHeaderAvatarError(true)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user.nome.slice(0, 2).toUpperCase()
              )}
            </div>
          ) : (
            <>
              <button className="vt-btn vt-btn-outline" onClick={() => openLoginModal('login')}>Entrar</button>
              <button className="vt-btn vt-btn-primary" onClick={() => openLoginModal('register')}>Cadastrar</button>
            </>
          )}
        </div>
      </header>

      {/* Stories — lojas seguidas com stories ativos */}
      {isAuthenticated && stories.length > 0 && (
        <div className="vt-stories-wrapper">
          <div className="vt-stories">
            {stories.map((story) => (
              <div key={story.id} className="vt-story" onClick={() => setStoryAberto(story)}>
                <div className="vt-story-ring">
                  <div className="vt-story-avatar">
                    {story.loja_logo
                      ? <img src={story.loja_logo} alt={story.loja_nome} />
                      : <CarIcon />}
                  </div>
                </div>
                <span>{story.loja_nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de story */}
      {storyAberto && (
        <div onClick={() => setStoryAberto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vt-surface)', borderRadius: 16, width: 360, maxWidth: '95vw', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setStoryAberto(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#fff', zIndex: 2 }}>✕</button>
            {storyAberto.midia_url
              ? <img src={storyAberto.midia_url} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', maxHeight: 560 }} />
              : <div style={{ width: '100%', aspectRatio: '9/16', maxHeight: 560, background: 'var(--vt-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarIcon /></div>}
            <div style={{ padding: '12px 16px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{storyAberto.loja_nome}</div>
              {storyAberto.veiculo_marca && <div style={{ fontSize: 13, color: 'var(--vt-text-dim)', marginTop: 2 }}>{storyAberto.veiculo_marca} {storyAberto.veiculo_modelo}</div>}
              {storyAberto.veiculo_preco && <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--vt-primary)', marginTop: 4 }}>{storyAberto.veiculo_preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>}
              {storyAberto.legenda && <div style={{ fontSize: 13, marginTop: 8, color: 'var(--vt-text)' }}>{storyAberto.legenda}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Feed — coluna central estreita */}
      <div className="vt-feed-layout">
        <main className="vt-feed-main">
          {veiculos.length === 0 && !loading ? (
            <div style={{ background: 'var(--vt-surface)', padding: 40, borderRadius: 12, border: '1px solid var(--vt-border)', textAlign: 'center' }}>
              <CarIcon />
              <h3 style={{ marginTop: 12 }}>Nenhum veículo encontrado</h3>
              <p style={{ color: 'var(--vt-text-dim)', marginTop: 4 }}>Tente outros filtros.</p>
            </div>
          ) : (
            veiculos.map(v => (
              <CarCard
                key={v.id}
                veiculo={v}
                onFavoritar={handleFavoritar}
                onConversar={handleConversar}
                onWhatsApp={handleWhatsApp}
                onSeguir={handleSeguir}
                isAuthenticated={isAuthenticated}
              />
            ))
          )}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div className="spinner" />
            </div>
          )}
        </main>

      </div>

      {/* Footer */}
      <footer className="vt-footer" style={{ paddingBottom: '80px' }}>
        <div className="vt-footer-links">
          <Link to="/sobre">Sobre</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/anuncie">Anuncie</Link>
        </div>
        <span>© 2026 Social Veículos</span>
      </footer>

      <BottomNav />

      {/* Perfil Modal */}
      {showPerfilModal && user && (
        <div className="vt-modal-overlay" onClick={closePerfilModal}>
          <div className="vt-modal-card" style={{ maxWidth: 400, width: 'min(400px, 92vw)', background: 'var(--vt-surface)', border: '1px solid var(--vt-border)', color: 'var(--vt-text)' }} onClick={e => e.stopPropagation()}>
            <div className="vt-modal-header" style={{ borderBottom: '1px solid var(--vt-border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Minha Conta</h3>
              <button className="vt-modal-close" onClick={closePerfilModal} style={{ color: 'var(--vt-text)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--vt-primary-light)',
                  color: 'var(--vt-primary)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  border: '1px solid var(--vt-border)'
                }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Pré-visualização" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : user.avatar_url && !modalAvatarError ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.nome} 
                      onError={() => setModalAvatarError(true)}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    user.nome.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{user.nome}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--vt-text-dim)' }}>{user.email}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vt-border)', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Foto de Perfil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '2px dashed var(--vt-border-hover)',
                    background: 'var(--vt-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    color: 'var(--vt-text-muted)',
                    fontSize: '11px',
                    textAlign: 'center'
                  }}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Pré-visualização" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : user.avatar_url && !previewAvatarError ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.nome} 
                        onError={() => setPreviewAvatarError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      'sem foto'
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      style={{ display: 'none' }}
                      id="vt-avatar-input"
                    />
                    <label htmlFor="vt-avatar-input" className="vt-btn vt-btn-outline" style={{ fontSize: '13px', cursor: 'pointer' }}>
                      {user.avatar_url || avatarPreview ? 'Trocar imagem' : 'Escolher imagem'}
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--vt-text-dim)' }}>JPG, PNG ou WEBP — até 15 MB.</span>
                  </div>
                </div>
                {avatarError && (
                  <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: 'var(--vt-error)' }}>{avatarError}</span>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    className="vt-btn vt-btn-primary"
                    disabled={!avatarPreview || avatarUploading}
                    onClick={handleSaveAvatar}
                    style={{ fontSize: '13px', opacity: !avatarPreview || avatarUploading ? 0.5 : 1, cursor: !avatarPreview || avatarUploading ? 'not-allowed' : 'pointer' }}
                  >
                    {avatarUploading ? 'Salvando…' : 'Salvar foto'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--vt-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="vt-btn vt-btn-outline"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => { navigate('/minha-conta/veiculos'); closePerfilModal() }}
              >
                🚗 Meus Veículos
              </button>
              <button
                className="vt-btn vt-btn-outline"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => setShowMfaModal(true)}
              >
                🔒 Verificação em duas etapas {user.mfa_ativo ? '(ativada)' : ''}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="vt-btn vt-btn-outline" style={{ borderColor: 'var(--vt-error)', color: 'var(--vt-error)' }} onClick={async () => {
                  const ok = await useUIStore.getState().confirm({
                    title: 'Sair da conta',
                    message: 'Deseja realmente encerrar sua sessão?',
                    confirmLabel: 'Sair',
                    cancelLabel: 'Cancelar',
                    danger: true,
                  })
                  if (ok) {
                    logout()
                    closePerfilModal()
                  }
                }}>Sair da Conta</button>
                <button className="vt-btn vt-btn-outline" onClick={closePerfilModal}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Gate Modal */}
      <LoginModal />

      {showMfaModal && user && (
        <MfaSettingsModal
          mfaAtivo={!!user.mfa_ativo}
          onClose={() => setShowMfaModal(false)}
          onChange={(ativo) => updateUser({ mfa_ativo: ativo })}
        />
      )}
    </>
  )
}

