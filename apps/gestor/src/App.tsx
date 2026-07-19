import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { AdminLayout } from './components/AdminLayout'
import { ImpersonarPage } from './pages/Impersonar'
import { ExtensionProvider } from './contexts/ExtensionContext'
import { useAuthStore } from './stores/authStore'
import { api } from './lib/api'
import { UIProvider } from './components/UIProvider'
import { type ReactNode, lazy, Suspense, useEffect, useState } from 'react'
import { parseModulos, podeAcessarModulo, type ModuloKey } from './lib/modulos'

// Code-splitting por rota: cada página do painel vira um chunk carregado sob demanda,
// em vez de todas (TipTap, simulador, marketing…) irem no bundle inicial único.
// Os importers ficam separados para o prefetch pós-login aquecer os chunks.
const importers = {
  Dashboard: () => import('./pages/Dashboard'),
  Aprovacoes: () => import('./pages/Aprovacoes'),
  Estoque: () => import('./pages/Estoque'),
  CRM: () => import('./pages/CRM'),
  Ferramentas: () => import('./pages/Ferramentas'),
  Financeiro: () => import('./pages/Financeiro'),
  MinhasComissoes: () => import('./pages/MinhasComissoes'),
  Equipe: () => import('./pages/Equipe'),
  Configuracoes: () => import('./pages/Configuracoes'),
  RedeSocial: () => import('./pages/RedeSocial'),
  AssistenteIA: () => import('./pages/AssistenteIA'),
  Ajuda: () => import('./pages/Ajuda'),
  PosVenda: () => import('./pages/PosVenda'),
  Simulador: () => import('./pages/ferramentas/Simulador'),
  Contratos: () => import('./pages/ferramentas/Contratos'),
  Marketing: () => import('./pages/ferramentas/Marketing'),
  Fipe: () => import('./pages/ferramentas/Fipe'),
  NotasFiscais: () => import('./pages/ferramentas/NotasFiscais'),
  MeuSite: () => import('./pages/ferramentas/MeuSite'),
  Admin: () => import('./pages/Admin'),
}
const Dashboard = lazy(() => importers.Dashboard().then(m => ({ default: m.Dashboard })))
const Aprovacoes = lazy(() => importers.Aprovacoes().then(m => ({ default: m.Aprovacoes })))
const Estoque = lazy(() => importers.Estoque().then(m => ({ default: m.Estoque })))
const CRM = lazy(() => importers.CRM().then(m => ({ default: m.CRM })))
const Ferramentas = lazy(() => importers.Ferramentas().then(m => ({ default: m.Ferramentas })))
const Financeiro = lazy(() => importers.Financeiro().then(m => ({ default: m.Financeiro })))
const MinhasComissoes = lazy(() => importers.MinhasComissoes().then(m => ({ default: m.MinhasComissoes })))
const Equipe = lazy(() => importers.Equipe().then(m => ({ default: m.Equipe })))
const Configuracoes = lazy(() => importers.Configuracoes().then(m => ({ default: m.Configuracoes })))
const RedeSocial = lazy(() => importers.RedeSocial().then(m => ({ default: m.RedeSocial })))
const AssistenteIA = lazy(() => importers.AssistenteIA().then(m => ({ default: m.AssistenteIA })))
const Ajuda = lazy(() => importers.Ajuda().then(m => ({ default: m.Ajuda })))
const PosVenda = lazy(() => importers.PosVenda().then(m => ({ default: m.PosVenda })))
const SimuladorPage = lazy(() => importers.Simulador().then(m => ({ default: m.SimuladorPage })))
const ContratosPage = lazy(() => importers.Contratos().then(m => ({ default: m.ContratosPage })))
const MarketingPage = lazy(() => importers.Marketing().then(m => ({ default: m.MarketingPage })))
const FipePage = lazy(() => importers.Fipe().then(m => ({ default: m.FipePage })))
const NotasFiscaisPage = lazy(() => importers.NotasFiscais().then(m => ({ default: m.NotasFiscaisPage })))
const MeuSitePage = lazy(() => importers.MeuSite().then(m => ({ default: m.MeuSitePage })))
const AdminPage = lazy(() => importers.Admin().then(m => ({ default: m.AdminPage })))

// Depois do login, aquece os chunks das outras telas em segundo plano:
// a primeira visita a cada tela deixa de mostrar o "Carregando…".
function PrefetchRotas() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (!isAuthenticated) return
    const t = setTimeout(() => {
      for (const importar of Object.values(importers)) {
        void importar().catch(() => { /* offline/deploy novo: a rota carrega normal ao navegar */ })
      }
    }, 2500)
    return () => clearTimeout(t)
  }, [isAuthenticated])
  return null
}

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--sv-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
      Carregando…
    </div>
  )
}

function PrivateRoute() {
  const { isAuthenticated, user, token, logout } = useAuthStore()
  // 'checking' até o backend confirmar a sessão; segura a renderização do painel
  // para que uma conta desativada NÃO chegue a ver a tela por um instante.
  const [status, setStatus] = useState<'checking' | 'ok'>('checking')

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

  // Revalida contra o backend a cada carga (F5) ANTES de liberar o painel: o JWT
  // pode continuar válido localmente, mas a conta / vínculo de loja pode ter sido
  // desativado. /auth/me devolve 401 nesse caso — o interceptor de api.ts então
  // expulsa para o login. Enquanto verifica, mostramos um loader (não o painel).
  useEffect(() => {
    let ativo = true
    if (token) {
      api.get('/auth/me')
        .then(() => { if (ativo) setStatus('ok') })
        .catch(() => { /* 401/403 já expulsa via interceptor; não liberamos o painel */ })
    } else {
      setStatus('ok')
    }
    return () => { ativo = false }
    // Só na montagem/troca de token — não a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Aguarda hidratação síncrona do persist antes de redirecionar
  if (user === null && !isAuthenticated) return <Navigate to="/login" replace />
  // Sessão ainda não confirmada pelo backend: não renderiza o painel.
  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--sv-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
        Verificando acesso…
      </div>
    )
  }
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
      <PrefetchRotas />
      <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
    </ExtensionProvider>
  )
}

