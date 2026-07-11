import { useEffect, useState } from 'react'
import { ThemeConfig, getThemeConfig, detectarTipoSite, extrairSlugDoHost } from './theme'

export function useHost() {
  const [config, setConfig] = useState<ThemeConfig | null>(null)
  const [host, setHost] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentHost = window.location.hostname
    setHost(currentHost)

    getThemeConfig(currentHost).then((cfg) => {
      setConfig(cfg)
      setLoading(false)
    })
  }, [])

  return {
    host,
    config,
    loading,
    tipo: config?.tipo || 'marketplace',
    lojaId: config?.lojaId,
    lojaSlug: config?.lojaSlug || extrairSlugDoHost(host),
    isWhiteLabel: detectarTipoSite(host) === 'white-label',
  }
}
