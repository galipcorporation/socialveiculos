import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export interface Midia {
  id: string
  tipo: 'foto' | 'video'
  url: string
  ordem: number
}

export interface Veiculo {
  id: string
  loja_id: string
  loja_nome?: string
  loja_logo?: string
  loja_cidade?: string
  loja_estado?: string
  loja_whatsapp?: string
  loja_verificada?: boolean
  loja_destaque?: boolean
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

interface CarCardProps {
  veiculo: Veiculo
  onFavoritar: (veiculoId: string, favoritado: boolean) => void
  onConversar: (veiculo: Veiculo) => void
  onWhatsApp: (veiculo: Veiculo) => void
  onSeguir: (lojaId: string, seguindo: boolean) => void
  isAuthenticated: boolean
}

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="6" width="22" height="10" rx="3" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M5 6L7 2h10l2 4" />
  </svg>
)

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="vt-verified">
    <path d="M12 1l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.2L12 23l-2.6-1.9-3.2.2-1-3L2.6 16.5l1-3-1-3 2.6-1.9 1-3 3.2.2z"/>
    <path d="M9.5 12.5l1.8 1.8 3.5-3.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function formatCurrency(val?: number) {
  if (val == null) return 'Sob Consulta'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)
}

function formatKm(val?: number) {
  if (val == null) return '—'
  return new Intl.NumberFormat('pt-BR').format(val) + ' km'
}

function timeAgo(v: Veiculo) {
  return `${v.ano_fabricacao}/${v.ano_modelo}`
}

export function CarCard({ veiculo, onFavoritar, onConversar, onWhatsApp, onSeguir }: CarCardProps) {
  const navigate = useNavigate()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [imgError, setImgError] = useState(false)

  const midias = veiculo.midias ?? []
  const currentMidia = midias.length > 0 ? midias[currentIdx] : null

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIdx(i => (i === 0 ? midias.length - 1 : i - 1))
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIdx(i => (i === midias.length - 1 ? 0 : i + 1))
  }

  const lojaInicial = (veiculo.loja_nome ?? veiculo.marca).slice(0, 2).toUpperCase()
  const localidade = [veiculo.loja_cidade, veiculo.loja_estado].filter(Boolean).join(', ')
  const indisponivel = veiculo.status !== 'disponivel'

  return (
    <div className="vt-car-card">
      {/* Header — loja */}
      <div className="vt-car-card-header">
        <div className="vt-car-card-shop" style={{ cursor: 'pointer' }} onClick={() => navigate(`/loja/${veiculo.loja_id}`)}>
          <div className="vt-card-shop-ring">
            <div>
              {veiculo.loja_logo
                ? <img src={veiculo.loja_logo} alt={veiculo.loja_nome} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : lojaInicial}
            </div>
          </div>
          <div className="vt-car-card-shop-info">
            <h4>
              {veiculo.loja_nome ?? 'Loja Parceira'}
              {veiculo.loja_verificada && <VerifiedIcon />}
            </h4>
            <span>{localidade || 'Brasil'}</span>
          </div>
          {veiculo.loja_destaque && (
            <span className="vt-badge-patrocinado">Patrocinado</span>
          )}
        </div>

        <button
          className={`vt-btn-seguir${veiculo.seguindo_loja ? ' seguindo' : ''}`}
          onClick={() => onSeguir(veiculo.loja_id, !!veiculo.seguindo_loja)}
        >
          {veiculo.seguindo_loja ? 'Seguindo' : 'Seguir'}
        </button>
      </div>

      {/* Mídia — 1:1 */}
      <div className="vt-car-card-image">
        {currentMidia && !imgError ? (
          currentMidia.tipo === 'video'
            ? <video src={currentMidia.url} controls muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={currentMidia.url} alt={`${veiculo.marca} ${veiculo.modelo}`} onError={() => setImgError(true)} />
        ) : (
          <div className="vt-car-card-placeholder">
            <CarIcon />
            <span>Sem foto disponível</span>
          </div>
        )}

        {/* badges */}
        <div className="vt-car-card-badges">
          {indisponivel ? (
            <span className="vt-badge vt-badge-vendido">Vendido</span>
          ) : (
            <>
              <span className="vt-badge vt-badge-destaque">Destaque</span>
              {veiculo.descricao?.toLowerCase().includes('troca') && (
                <span className="vt-badge vt-badge-troca">Aceita troca</span>
              )}
            </>
          )}
        </div>

        {/* contador */}
        {midias.length > 1 && (
          <span className="vt-media-count">{currentIdx + 1}/{midias.length}</span>
        )}

        {/* setas */}
        {midias.length > 1 && (
          <>
            <button className="vt-media-arrow left" onClick={prev}>‹</button>
            <button className="vt-media-arrow right" onClick={next}>›</button>
          </>
        )}

        {/* bolinhas */}
        {midias.length > 1 && (
          <div className="vt-media-dots">
            {midias.map((_, i) => (
              <span key={i} className={i === currentIdx ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>

      {/* Ações: favoritar (esquerda) | seguir já no header */}
      <div className="vt-car-card-actions">
        <div className="vt-car-card-social">
          {/* Favoritar */}
          <button
            className={`vt-act${veiculo.favoritado_por_mim ? ' liked' : ''}`}
            onClick={() => onFavoritar(veiculo.id, veiculo.favoritado_por_mim)}
            title={veiculo.favoritado_por_mim ? 'Desfavoritar' : 'Favoritar'}
          >
            <svg viewBox="0 0 24 24" fill={veiculo.favoritado_por_mim ? 'currentColor' : 'none'} stroke="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>

        {/* Salvar (bookmark) */}
        <button className="vt-act" title="Salvar" onClick={() => onFavoritar(veiculo.id, veiculo.favoritado_por_mim)}>
          <svg viewBox="0 0 24 24" fill={veiculo.favoritado_por_mim ? 'currentColor' : 'none'} stroke="currentColor">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>
      </div>

      {/* Corpo */}
      <div className="vt-car-card-body">
        {veiculo.total_favoritos > 0 && (
          <div className="vt-card-likes">{veiculo.total_favoritos} curtidas</div>
        )}

        <div className="vt-card-caption">
          <span className="name">{veiculo.marca} {veiculo.modelo}</span>
          {veiculo.versao && ` ${veiculo.versao}`}
          {' · '}
          <span className="vt-card-price">{formatCurrency(veiculo.preco_venda)}</span>
        </div>

        <div className="vt-car-card-specs">
          <div className="vt-car-card-spec">
            <label>KM</label>
            <span>{formatKm(veiculo.km)}</span>
          </div>
          <div className="vt-car-card-spec">
            <label>Ano</label>
            <span>{timeAgo(veiculo)}</span>
          </div>
          {veiculo.cambio && (
            <div className="vt-car-card-spec">
              <label>Câmbio</label>
              <span style={{ textTransform: 'capitalize' }}>{veiculo.cambio}</span>
            </div>
          )}
          {veiculo.combustivel && (
            <div className="vt-car-card-spec">
              <label>Combustível</label>
              <span style={{ textTransform: 'capitalize' }}>{veiculo.combustivel}</span>
            </div>
          )}
        </div>

        {indisponivel ? (
          <div className="vt-card-cta">
            <button className="vt-btn-chat" disabled title="Este veículo não está mais disponível">
              Vendido
            </button>
          </div>
        ) : (
          <div className="vt-card-cta">
            {veiculo.loja_whatsapp && (
              <button className="vt-btn-negociar" onClick={() => onWhatsApp(veiculo)}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M.06 24l1.7-6.2A11.9 11.9 0 1 1 12 24a11.9 11.9 0 0 1-5.7-1.5L.06 24zM6.6 20l.4.2a9.9 9.9 0 1 0-3.4-3.4l.2.4-1 3.7 3.8-.9z"/>
                </svg>
                WhatsApp
              </button>
            )}
            <button className="vt-btn-chat" onClick={() => onConversar(veiculo)}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Conversar
            </button>
          </div>
        )}

        <div className="vt-card-time">{veiculo.loja_cidade ?? ''}</div>
      </div>
    </div>
  )
}
