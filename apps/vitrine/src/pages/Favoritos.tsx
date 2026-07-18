import React, { useState, useEffect } from 'react'
import { CarCard, Veiculo } from '../components/CarCard'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { LoginModal } from '../components/LoginModal'
import { whatsappLojaLink } from '../lib/contato'
import { BottomNav } from '../components/BottomNav'

export function Favoritos() {
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const [favoritos, setFavoritos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFavoritos = async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await api.get<Veiculo[]>('/vitrine/favoritos')
      setFavoritos(data)
    } catch (err) {
      console.error('Erro ao carregar favoritos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFavoritos()
  }, [isAuthenticated])

  const handleFavoritar = async (veiculoId: string, favoritado: boolean) => {
    if (!isAuthenticated) {
      openLoginModal('login')
      return
    }

    try {
      if (favoritado) {
        await api.delete(`/vitrine/favoritos/${veiculoId}`)
        setFavoritos(prev => prev.filter(v => v.id !== veiculoId))
      } else {
        // Favoritar (não deve acontecer aqui pois já está favoritada na página de favoritos, mas por consistência)
        await api.post('/vitrine/favoritos', { veiculo_id: veiculoId })
        fetchFavoritos()
      }
    } catch (err) {
      console.error('Erro ao favoritar/desfavoritar:', err)
    }
  }

  const handleConversar = async (veiculo: Veiculo) => {
    if (!isAuthenticated) {
      openLoginModal('login')
      return
    }
    
    try {
      const msg = `Olá, estou interessado no veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_modelo}).`
      await api.post('/vitrine/conversas', {
        veiculo_id: veiculo.id,
        loja_id: veiculo.loja_id,
        mensagem: msg
      })
      useUIStore.getState().showToast('Conversa iniciada! Vá para a aba de Mensagens para conversar.', 'success')
    } catch (err) {
      console.error('Erro ao iniciar conversa:', err)
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

  const handleSeguir = async (lojaId: string, seguindo: boolean) => {
    if (!isAuthenticated) { openLoginModal('login'); return }
    setFavoritos(prev => prev.map(v =>
      v.loja_id === lojaId ? { ...v, seguindo_loja: !seguindo } : v
    ))
    try {
      if (seguindo) {
        await api.delete(`/vitrine/lojas/${lojaId}/seguir`)
      } else {
        await api.post(`/vitrine/lojas/${lojaId}/seguir`, {})
      }
    } catch {
      setFavoritos(prev => prev.map(v =>
        v.loja_id === lojaId ? { ...v, seguindo_loja: seguindo } : v
      ))
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="vt-page" style={{ padding: '40px 20px', textAlign: 'center', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Faça login para ver seus favoritos</h2>
        <p style={{ color: 'var(--vt-text-dim)', marginBottom: 20 }}>Você precisa estar autenticado para salvar e gerenciar seus veículos favoritos.</p>
        <button className="vt-btn vt-btn-primary" onClick={() => openLoginModal('login')}>Entrar / Cadastrar</button>
        <LoginModal />
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="vt-page" style={{ padding: '20px 16px', minHeight: '100vh', paddingBottom: 100 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--vt-text)' }}>Seus Favoritos</h1>
        <p style={{ color: 'var(--vt-text-dim)', fontSize: 14 }}>Os veículos que você salvou para olhar depois.</p>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="spinner" />
        </div>
      ) : favoritos.length === 0 ? (
        <div className="empty-state" style={{ background: 'rgba(30,41,59,0.3)', padding: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 12 }}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <h3>Nenhum veículo favoritado</h3>
          <p style={{ color: 'var(--vt-text-dim)' }}>Explore o feed e clique no coração para salvar veículos aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {favoritos.map(v => (
            <CarCard
              key={v.id}
              veiculo={v}
              onFavoritar={handleFavoritar}
              onConversar={handleConversar}
              onWhatsApp={handleWhatsApp}
              onSeguir={handleSeguir}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
      <LoginModal />
      <BottomNav />
    </div>
  )
}
export default Favoritos
