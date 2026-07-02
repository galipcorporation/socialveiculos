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
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface UIState {
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type']) => void
  showError: (message: string, details?: ToastDetails) => void
  removeToast: (id: string) => void

  confirmState: (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  _resolveConfirm: (value: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],

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
    setTimeout(() => get().removeToast(id), details ? 8000 : 4000)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  confirmState: null,

  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ confirmState: { ...opts, resolve } })
    }),

  _resolveConfirm: (value) => {
    const { confirmState } = get()
    if (confirmState) {
      confirmState.resolve(value)
      set({ confirmState: null })
    }
  },
}))
