import { Routes, Route } from 'react-router-dom'
import { Feed } from './pages/Feed'
import { Favoritos } from './pages/Favoritos'
import { Mensagens } from './pages/Mensagens'
import { CarroDetalhe } from './pages/CarroDetalhe'
import { Loja } from './pages/Loja'
import { MeusVeiculos } from './pages/MeusVeiculos'
import { Sobre } from './pages/institucional/Sobre'
import { Termos } from './pages/institucional/Termos'
import { Privacidade } from './pages/institucional/Privacidade'
import { Anuncie } from './pages/institucional/Anuncie'
import { GoogleCallback } from './pages/GoogleCallback'
import { UIProvider } from './components/UIProvider'

export default function App() {
  return (
    <>
      <UIProvider />
      <Routes>
        <Route index element={<Feed />} />
        <Route path="/favoritos" element={<Favoritos />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/carro/:id" element={<CarroDetalhe />} />
        <Route path="/loja/:slug" element={<Loja />} />
        <Route path="/minha-conta/veiculos" element={<MeusVeiculos />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/anuncie" element={<Anuncie />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
      </Routes>
    </>
  )
}

