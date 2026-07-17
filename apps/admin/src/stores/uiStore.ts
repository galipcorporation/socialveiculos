import { create } from 'zustand'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve: (value: boolean) => void
}

interface PromptOptions {
  title?: string
  message?: string
  label?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}

interface PromptState extends PromptOptions {
  isOpen: boolean
  value: string
  resolve: (value: string | undefined) => void
}

interface UIState {
  confirmState: ConfirmState | null
  promptState: PromptState | null
  confirm: (options: ConfirmOptions) => Promise<boolean>
  closeConfirm: (value: boolean) => void
  prompt: (options: PromptOptions) => Promise<string | undefined>
  setPromptValue: (value: string) => void
  closePrompt: (submit: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  confirmState: null,
  promptState: null,

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmState: {
          isOpen: true,
          title: options.title || 'Confirmar Ação',
          message: options.message,
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          danger: options.danger || false,
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

  prompt: (options) => {
    return new Promise<string | undefined>((resolve) => {
      set({
        promptState: {
          isOpen: true,
          title: options.title || 'Informe um valor',
          message: options.message,
          label: options.label,
          placeholder: options.placeholder,
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          value: '',
          resolve,
        },
      })
    })
  },

  setPromptValue: (value) => {
    const { promptState } = get()
    if (promptState) {
      set({ promptState: { ...promptState, value } })
    }
  },

  closePrompt: (submit) => {
    const { promptState } = get()
    if (promptState) {
      promptState.resolve(submit ? promptState.value : undefined)
    }
    set({ promptState: null })
  },
}))
