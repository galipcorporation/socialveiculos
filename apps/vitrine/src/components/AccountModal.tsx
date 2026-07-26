import React from 'react'
import { X, Car, ShieldCheck, LogOut, Upload, Check, ChevronRight, User } from 'lucide-react'

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    nome: string
    email: string
    avatar_url?: string | null
    mfa_ativo?: boolean
  }
  avatarPreview: string | null
  avatarUploading: boolean
  avatarError: string | null
  modalAvatarError: boolean
  previewAvatarError: boolean
  setModalAvatarError: (err: boolean) => void
  setPreviewAvatarError: (err: boolean) => void
  avatarInputRef: React.RefObject<HTMLInputElement | null>
  handleAvatarSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSaveAvatar: () => void
  onOpenMfa: () => void
  onNavigateVeiculos: () => void
  onLogout: () => void
}

export function AccountModal({
  isOpen,
  onClose,
  user,
  avatarPreview,
  avatarUploading,
  avatarError,
  modalAvatarError,
  previewAvatarError,
  setModalAvatarError,
  setPreviewAvatarError,
  avatarInputRef,
  handleAvatarSelect,
  handleSaveAvatar,
  onOpenMfa,
  onNavigateVeiculos,
  onLogout,
}: AccountModalProps) {
  if (!isOpen || !user) return null

  const initials = user.nome ? user.nome.slice(0, 2).toUpperCase() : 'U'

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div
        className="vt-modal-card"
        style={{ maxWidth: 440, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="vt-modal-close" onClick={onClose} aria-label="Fechar modal">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="vt-modal-header">
          <h3>Minha Conta</h3>
          <p>Gerencie seus dados de perfil e preferências da conta</p>
        </div>

        <div className="vt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* User info card */}
          <div className="vt-profile-card">
            <div className="vt-profile-avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Pré-visualização" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.avatar_url && !modalAvatarError ? (
                <img
                  src={user.avatar_url}
                  alt={user.nome}
                  onError={() => setModalAvatarError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>
            <div className="vt-profile-info">
              <div className="vt-profile-name">{user.nome}</div>
              <div className="vt-profile-email">{user.email}</div>
            </div>
          </div>

          {/* Photo upload section */}
          <div className="vt-account-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <span className="vt-account-section-title">Foto de Perfil</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px dashed var(--vt-border-hover)',
                  background: 'var(--vt-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--vt-text-dim)',
                  fontSize: '11px',
                }}
              >
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
                  <User size={24} style={{ opacity: 0.4 }} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  style={{ display: 'none' }}
                  id="vt-avatar-input-modal"
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <label
                    htmlFor="vt-avatar-input-modal"
                    className="vt-btn vt-btn-outline vt-btn-sm"
                    style={{ cursor: 'pointer', gap: '6px' }}
                  >
                    <Upload size={14} />
                    {user.avatar_url || avatarPreview ? 'Trocar imagem' : 'Escolher imagem'}
                  </label>

                  {avatarPreview && (
                    <button
                      className="vt-btn vt-btn-primary vt-btn-sm"
                      disabled={avatarUploading}
                      onClick={handleSaveAvatar}
                      style={{ gap: '6px' }}
                    >
                      <Check size={14} />
                      {avatarUploading ? 'Salvando…' : 'Salvar foto'}
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--vt-text-dim)' }}>JPG, PNG ou WEBP — até 15 MB.</span>
              </div>
            </div>
            {avatarError && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'var(--vt-error)' }}>
                {avatarError}
              </span>
            )}
          </div>

          {/* Navigation action list */}
          <div className="vt-account-section">
            <span className="vt-account-section-title">Opções da Conta</span>
            <div className="vt-account-menu">
              <button className="vt-account-menu-item" onClick={onNavigateVeiculos}>
                <div className="vt-account-menu-left">
                  <div className="vt-account-menu-icon">
                    <Car size={18} />
                  </div>
                  <div className="vt-account-menu-content">
                    <span className="vt-account-menu-title">Meus Veículos</span>
                    <span className="vt-account-menu-subtitle">Gerenciar seus anúncios e cadastros</span>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--vt-text-dim)' }} />
              </button>

              <button className="vt-account-menu-item" onClick={onOpenMfa}>
                <div className="vt-account-menu-left">
                  <div className="vt-account-menu-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--vt-primary)' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="vt-account-menu-content">
                    <span className="vt-account-menu-title">Verificação em duas etapas</span>
                    <span className="vt-account-menu-subtitle">Segurança extra com autenticador</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`vt-badge ${user.mfa_ativo ? 'vt-badge-success' : 'vt-badge-muted'}`}>
                    {user.mfa_ativo ? 'Ativada' : 'Desativada'}
                  </span>
                  <ChevronRight size={18} style={{ color: 'var(--vt-text-dim)' }} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--vt-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <button
            className="vt-btn vt-btn-danger-outline"
            style={{ fontSize: '13px', gap: '6px' }}
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair da Conta
          </button>
          <button className="vt-btn vt-btn-secondary" style={{ fontSize: '13px' }} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
