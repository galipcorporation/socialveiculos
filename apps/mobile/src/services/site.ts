// Meu Site (builder white-label) — /v1/site.
import { api } from '../lib/api'
import type { SiteLoja } from './types'

export const siteService = {
  async obter(): Promise<SiteLoja> {
    return api.get<SiteLoja>('/site')
  },

  async salvar(patch: Partial<SiteLoja>): Promise<SiteLoja> {
    return api.put<SiteLoja>('/site', patch)
  },

  async publicar(publicar: boolean): Promise<SiteLoja> {
    return api.post<SiteLoja>(`/site/${publicar ? 'publicar' : 'despublicar'}`)
  },
}
