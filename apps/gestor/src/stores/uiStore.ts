import { create } from 'zustand'

export interface ToastDetails {
  status?: number
  path?: string
  timestamp?: string
  requestId?: string
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
  details?: ToastDetails
}

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve: (value: boolean) => void
}

interface UIState {
  toasts: Toast[]
  confirmState: ConfirmState | null
  showToast: (message: string, type?: Toast['type']) => void
  showError: (message: string, details?: ToastDetails) => void
  removeToast: (id: string) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  closeConfirm: (value: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  confirmState: null,

  showToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }))
    setTimeout(() => get().removeToast(id), 4000)
  },

  showError: (message, details) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: 'error', details }],
    }))
    // Erros com detalhes técnicos ficam mais tempo na tela
    setTimeout(() => get().removeToast(id), details ? 8000 : 4000)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmState: {
          isOpen: true,
          title: options.title || 'Confirmar Ação',
          message: options.message,
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          resolve,
        },
      })
    })
  },

  closeConfirm: (value) => {
    const { confirmState } = get()
    if (confirmState) {
      confirmState.resolve(value)
    }
    set({ confirmState: null })
  },
}))
