import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Aprovacoes } from './pages/Aprovacoes'
import { Estoque } from './pages/Estoque'
import { CRM } from './pages/CRM'
import { Ferramentas } from './pages/Ferramentas'
import { Financeiro } from './pages/Financeiro'
import { MinhasComissoes } from './pages/MinhasComissoes'
import { Equipe } from './pages/Equipe'
import { Configuracoes } from './pages/Configuracoes'
import { RedeSocial } from './pages/RedeSocial'
import { AssistenteIA } from './pages/AssistenteIA'
import { Ajuda } from './pages/Ajuda'
import { PosVenda } from './pages/PosVenda'
import { SimuladorPage } from './pages/ferramentas/Simulador'
import { ContratosPage } from './pages/ferramentas/Contratos'
import { MarketingPage } from './pages/ferramentas/Marketing'
import { FipePage } from './pages/ferramentas/Fipe'
import { NotasFiscaisPage } from './pages/ferramentas/NotasFiscais'
import { MeuSitePage } from './pages/ferramentas/MeuSite'
import { AdminPage } from './pages/Admin'
import { AdminLayout } from './components/AdminLayout'
import { ImpersonarPage } from './pages/Impersonar'
import { ExtensionProvider } from './contexts/ExtensionContext'
import { useAuthStore } from './stores/authStore'
import { api } from './lib/api'
import { UIProvider } from './components/UIProvider'
import { type ReactNode, useEffect } from 'react'
import { parseModulos, podeAcessarModulo, type ModuloKey } from './lib/modulos'

function PrivateRoute() {
  const { isAuthenticated, user, token, logout } = useAuthStore()

  useEffect(() => {
    if (token) {
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload.exp && payload.exp < Date.now() / 1000) {
            logout('Sua sessão expirou. Faça login novamente.')
          }
        }
      } catch {
        logout()
      }
    }
  }, [token, logout])

  // Revalida contra o backend a cada carga (F5): o JWT pode continuar válido
  // localmente, mas a conta pode ter sido desativada. /auth/me devolve 401 se o
  // usuário estiver inativo — o interceptor de api.ts então expulsa para o login.
  useEffect(() => {
    if (token) {
      api.get('/auth/me').catch(() => { /* 401 já tratado no interceptor */ })
    }
    // Só na montagem/troca de token — não a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aguarda hidratação síncrona do persist antes de redirecionar
  if (user === null && !isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

import { useUIStore } from './stores/uiStore'

function AdminRedirect() {
  const showError = useUIStore((state) => state.showError)
  useEffect(() => {
    showError("Acesso restrito a administradores.")
  }, [showError])
  return <Navigate to="/" replace />
}

function AdminGuard() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Aguarda hidratação do persist — store começa com user=null antes de ler o localStorage
  if (!isAuthenticated || user === null) return null
  if (user.papel !== 'admin_plataforma') return <AdminRedirect />
  return <Outlet />
}

// Bloqueia o acesso a rotas de módulos não liberados ao vendedor logado.
function ModuleGuard({ modulo, children }: { modulo: ModuloKey; children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const modulos = parseModulos(user?.modulos)
  if (!podeAcessarModulo(user?.papel, modulos, modulo)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || 'painel-sv'

export default function App() {
  return (
    <ExtensionProvider>
      <UIProvider />
      <Routes>
      {/* Rota pública de login */}
      <Route path="login" element={<Login />} />

      {/* Impersonar — pública, mas processa token */}
      <Route path="impersonar" element={<ImpersonarPage />} />

      {/* Rotas protegidas — um único PrivateRoute */}
      <Route element={<PrivateRoute />}>

        {/* Painel admin — rota secreta, layout isolado */}
        <Route path={ADMIN_PATH} element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminPage />} />
          </Route>
        </Route>

        {/* Alias alternativo para /admin */}
        <Route path="admin" element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminPage />} />
          </Route>
        </Route>

        {/* Gestor — AppLayout com sidebar */}
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="estoque" element={<ModuleGuard modulo="estoque"><Estoque /></ModuleGuard>} />
          <Route path="crm" element={<ModuleGuard modulo="crm"><CRM /></ModuleGuard>} />
          <Route path="rede-social" element={<RedeSocial />} />
          <Route path="ferramentas" element={<Ferramentas />} />
          <Route path="ferramentas/simulador" element={<ModuleGuard modulo="simulador"><SimuladorPage /></ModuleGuard>} />
          <Route path="ferramentas/contratos" element={<ModuleGuard modulo="contratos"><ContratosPage /></ModuleGuard>} />
          <Route path="ferramentas/marketing" element={<ModuleGuard modulo="marketing"><MarketingPage /></ModuleGuard>} />
          <Route path="ferramentas/fipe" element={<FipePage />} />
          <Route path="ferramentas/fiscal" element={<Navigate to="/configuracoes" state={{ aba: 'fiscal' }} replace />} />
          <Route path="ferramentas/notas-fiscais" element={<ModuleGuard modulo="fiscal"><NotasFiscaisPage /></ModuleGuard>} />
          <Route path="ferramentas/meu-site" element={<ModuleGuard modulo="site"><MeuSitePage /></ModuleGuard>} />
          <Route path="assistente" element={<ModuleGuard modulo="assistente"><AssistenteIA /></ModuleGuard>} />
          <Route path="financeiro" element={<ModuleGuard modulo="financeiro"><Financeiro /></ModuleGuard>} />
          <Route path="minhas-comissoes" element={<MinhasComissoes />} />
          <Route path="aprovacoes" element={<Aprovacoes />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="ajuda" element={<Ajuda />} />
          <Route path="pos-venda" element={<PosVenda />} />
        </Route>

      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ExtensionProvider>
  )
}

