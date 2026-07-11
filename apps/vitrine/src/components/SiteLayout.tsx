import { ReactNode } from 'react'
import { useSiteConfig } from '../lib/SiteContext'
import { SiteHero } from './SiteHero'
import { SiteFooter } from './SiteFooter'
import '../styles/site-layout.css'

interface SiteLayoutProps {
  children: ReactNode
  showHero?: boolean
}

export function SiteLayout({ children, showHero = true }: SiteLayoutProps) {
  const { config, loading } = useSiteConfig()

  if (loading || !config) {
    return <div className="site-layout-loading">Carregando...</div>
  }

  return (
    <div className="site-layout">
      {showHero && <SiteHero config={config} />}
      <main className="site-layout-main">{children}</main>
      <SiteFooter config={config} />
    </div>
  )
}
