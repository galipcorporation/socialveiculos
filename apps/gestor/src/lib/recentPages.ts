import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'

const MAX = 5

export interface RecentPage {
  path: string
  label: string
  icon: string // SVG path string (single <path> ou primitiva)
}

// Mapa canônico: path → metadados exibíveis
const PAGE_META: Record<string, Omit<RecentPage, 'path'>> = {
  '/': { label: 'Dashboard', icon: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
  '/estoque': { label: 'Estoque', icon: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2 M7 15a2 2 0 100 4 2 2 0 000-4 M9 17h6 M17 15a2 2 0 100 4 2 2 0 000-4' },
  '/crm': { label: 'Clientes (CRM)', icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm10 1v6m3-3h-6' },
  '/financeiro': { label: 'Financeiro', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  '/rede-social': { label: 'Rede Social', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  '/aprovacoes': { label: 'Aprovações', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-2.99' },
  '/equipe': { label: 'Equipe', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  '/configuracoes': { label: 'Configurações', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm8.485-3A8.485 8.485 0 0112 20.485 8.485 8.485 0 013.515 12 8.485 8.485 0 0112 3.515 8.485 8.485 0 0120.485 12z' },
  '/ferramentas/simulador': { label: 'Simulador', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  '/ferramentas/contratos': { label: 'Contratos', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8m8 4H8m2-8H8' },
  '/assistente': { label: 'Assistente IA', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  '/ajuda': { label: 'Ajuda', icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-.002-5.003h.01M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' },
}

// Páginas excluídas do tracking (Dashboard em si não faz sentido como "recente")
const EXCLUDED = new Set(['/', '/login'])

const getStorageKey = () => {
  const user = useAuthStore.getState().user
  const lojaId = user?.loja_id || 'global'
  return `sv_recent_pages_${lojaId}`
}

function load(): RecentPage[] {
  try {
    const key = getStorageKey()
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function save(pages: RecentPage[]) {
  const key = getStorageKey()
  localStorage.setItem(key, JSON.stringify(pages))
}

export function recordPageVisit(path: string) {
  const meta = PAGE_META[path]
  if (!meta || EXCLUDED.has(path)) return

  const current = load().filter((p) => p.path !== path)
  const updated = [{ path, ...meta }, ...current].slice(0, MAX)
  save(updated)
}

export function getRecentPages(): RecentPage[] {
  return load()
}

// Hook: registra visita a cada mudança de rota
export function useTrackPageVisit() {
  const location = useLocation()
  useEffect(() => {
    recordPageVisit(location.pathname)
  }, [location.pathname])
}
