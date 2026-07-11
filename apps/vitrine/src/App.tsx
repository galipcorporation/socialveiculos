import { Routes, Route } from 'react-router-dom'
import { Feed } from './pages/Feed'
import { Favoritos } from './pages/Favoritos'
import { Mensagens } from './pages/Mensagens'
import { CarroDetalhe } from './pages/CarroDetalhe'
import { Loja } from './pages/Loja'
import { MeusVeiculos } from './pages/MeusVeiculos'
import { Sobre } from './pages/institucional/Sobre'
import { SobreWhiteLabel } from './pages/SobreWhiteLabel'
import { Termos } from './pages/institucional/Termos'
import { Privacidade } from './pages/institucional/Privacidade'
import { Anuncie } from './pages/institucional/Anuncie'
import { GoogleCallback } from './pages/GoogleCallback'
import { UIProvider } from './components/UIProvider'
import { SiteProvider, useSiteConfig } from './lib/SiteContext'

function AppRoutes() {
  const { isWhiteLabel } = useSiteConfig()
  const sobrePage = isWhiteLabel ? <SobreWhiteLabel /> : <Sobre />

  return (
    <Routes>
      <Route index element={<Feed />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/mensagens" element={<Mensagens />} />
      <Route path="/carro/:id" element={<CarroDetalhe />} />
      <Route path="/loja/:slug" element={<Loja />} />
      <Route path="/minha-conta/veiculos" element={<MeusVeiculos />} />
      <Route path="/sobre" element={sobrePage} />
      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/anuncie" element={<Anuncie />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SiteProvider>
      <UIProvider />
      <AppRoutes />
    </SiteProvider>
  )
}

