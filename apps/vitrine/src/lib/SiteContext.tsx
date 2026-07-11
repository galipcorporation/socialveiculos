import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ThemeConfig, getThemeConfig, detectarTipoSite } from './theme'

interface SiteContextType {
  config: ThemeConfig | null
  host: string
  loading: boolean
  tipo: 'marketplace' | 'white-label'
  lojaId?: string
  isWhiteLabel: boolean
}

const SiteContext = createContext<SiteContextType | undefined>(undefined)

export function SiteProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState('')
  const [config, setConfig] = useState<ThemeConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentHost = window.location.hostname
    setHost(currentHost)

    getThemeConfig(currentHost)
      .then((cfg) => {
        setConfig(cfg)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[SiteContext] Erro ao carregar config:', err)
        setLoading(false)
      })
  }, [])

  const value: SiteContextType = {
    config,
    host,
    loading,
    tipo: config?.tipo || 'marketplace',
    lojaId: config?.lojaId,
    isWhiteLabel: detectarTipoSite(host) === 'white-label',
  }

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSiteConfig() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSiteConfig deve estar dentro de <SiteProvider>')
  return ctx
}
