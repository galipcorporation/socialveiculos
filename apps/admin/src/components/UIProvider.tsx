import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'

export function UIProvider() {
  const { confirmState, closeConfirm, promptState, setPromptValue, closePrompt } = useUIStore()
  const promptInputRef = useRef<HTMLInputElement>(null)

  const isOpen = !!confirmState?.isOpen || !!promptState?.isOpen

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (promptState?.isOpen) {
      promptInputRef.current?.focus()
    }
  }, [promptState?.isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmState?.isOpen) closeConfirm(false)
      if (promptState?.isOpen) closePrompt(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmState?.isOpen, promptState?.isOpen, closeConfirm, closePrompt])

  return (
    <>
      {confirmState?.isOpen && (
        <div className="modal-overlay sv-confirm-overlay" onClick={() => closeConfirm(false)}>
          <div className="sv-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv-confirm-header">
              <h3>{confirmState.title}</h3>
              <button className="close-btn" onClick={() => closeConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sv-confirm-body">
              <p>{confirmState.message}</p>
            </div>
            <div className={`sv-confirm-footer${confirmState.danger ? ' danger' : ''}`}>
              <button className="btn btn-secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText}
              </button>
              <button className="btn btn-primary" onClick={() => closeConfirm(true)}>
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptState?.isOpen && (
        <div className="modal-overlay sv-confirm-overlay" onClick={() => closePrompt(false)}>
          <form
            className="sv-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              closePrompt(true)
            }}
          >
            <div className="sv-confirm-header">
              <h3>{promptState.title}</h3>
              <button type="button" className="close-btn" onClick={() => closePrompt(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sv-confirm-body">
              {promptState.message && <p>{promptState.message}</p>}
              {promptState.label && <label>{promptState.label}</label>}
              <input
                ref={promptInputRef}
                value={promptState.value}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.placeholder}
              />
            </div>
            <div className="sv-confirm-footer">
              <button type="button" className="btn btn-secondary" onClick={() => closePrompt(false)}>
                {promptState.cancelText}
              </button>
              <button type="submit" className="btn btn-primary">
                {promptState.confirmText}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
