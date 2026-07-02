import React, { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

export function UIProvider() {
  const { toasts, removeToast, confirmState, closeConfirm } = useUIStore()

  // Lock body scroll when confirm dialog is open
  useEffect(() => {
    if (confirmState?.isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [confirmState?.isOpen])

  // ESC key to close confirm dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmState?.isOpen) {
        closeConfirm(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmState?.isOpen, closeConfirm])

  return (
    <>
      {/* Toast Notification Container */}
      <div className="sv-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`sv-toast sv-toast-${toast.type}`}>
            <span className="sv-toast-icon">
              {toast.type === 'success' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </span>
            <span className="sv-toast-message">
              {toast.message}
              {toast.details && (
                <details className="sv-toast-details">
                  <summary>Detalhes técnicos</summary>
                  <ul>
                    {toast.details.status && <li><b>Código:</b> {toast.details.status}</li>}
                    {toast.details.path && <li><b>Rota:</b> {toast.details.path}</li>}
                    {toast.details.timestamp && <li><b>Horário:</b> {new Date(toast.details.timestamp).toLocaleTimeString('pt-BR')}</li>}
                    {toast.details.requestId && <li><b>ID:</b> {toast.details.requestId}</li>}
                  </ul>
                </details>
              )}
            </span>
            <button className="sv-toast-close" onClick={() => removeToast(toast.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog Overlay */}
      {confirmState?.isOpen && (
        <div className="modal-overlay" onClick={() => closeConfirm(false)}>
          <div className="glass-card sv-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv-confirm-header">
              <h3>{confirmState.title}</h3>
              <button className="close-btn" onClick={() => closeConfirm(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="sv-confirm-body">
              <p>{confirmState.message}</p>
            </div>
            <div className="sv-confirm-footer">
              <button className="btn btn-outline" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText}
              </button>
              <button className="btn btn-primary" onClick={() => closeConfirm(true)}>
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
