/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_PATH: string
  readonly VITE_VITRINE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
