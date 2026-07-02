import { Routes, Route } from 'react-router-dom'
import { Feed } from './pages/Feed'
import { Favoritos } from './pages/Favoritos'
import { Mensagens } from './pages/Mensagens'
import { CarroDetalhe } from './pages/CarroDetalhe'
import { Loja } from './pages/Loja'
import { MeusVeiculos } from './pages/MeusVeiculos'
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
      </Routes>
    </>
  )
}

