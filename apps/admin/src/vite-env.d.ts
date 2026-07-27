/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GESTOR_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
