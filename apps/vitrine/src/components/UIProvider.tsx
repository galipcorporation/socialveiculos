import React from 'react'
import { useUIStore } from '../stores/uiStore'

export function UIProvider() {
  const { toasts, removeToast, confirmState, _resolveConfirm } = useUIStore()

  return (
    <>
      <div className="vt-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`vt-toast vt-toast-${toast.type}`}>
            <span className="vt-toast-icon">
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
            <span className="vt-toast-message">
              {toast.message}
              {toast.details && (
                <details className="vt-toast-details">
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
            <button className="vt-toast-close" onClick={() => removeToast(toast.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="vt-confirm-overlay" onClick={() => _resolveConfirm(false)}>
          <div className="vt-confirm-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="vt-confirm-title">{confirmState.title}</p>
            {confirmState.message && (
              <p className="vt-confirm-message">{confirmState.message}</p>
            )}
            <div className="vt-confirm-actions">
              <button
                className="vt-btn vt-btn-outline"
                onClick={() => _resolveConfirm(false)}
                autoFocus
              >
                {confirmState.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                className={`vt-btn ${confirmState.danger ? 'vt-btn-danger' : 'vt-btn-primary'}`}
                onClick={() => _resolveConfirm(true)}
              >
                {confirmState.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
