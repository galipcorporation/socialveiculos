// Meu Site (M053) — mock do builder white-label. Espelha /site do gestor.
// Gate via modulosService('site'). Swap p/ API = reimplementar mantendo assinaturas.

import { delay } from './db'
import type { SiteLoja } from './types'

let site: SiteLoja = {
  publicado: true,
  subdominio: 'auto-premium-veiculos.socialveiculos.com.br',
  template: 'premium',
  cor_primaria: '#2563eb',
  cor_secundaria: '#0f172a',
  hero_titulo: 'Auto Premium Veículos',
  hero_subtitulo: 'Seminovos selecionados com procedência e garantia em Porto Alegre.',
  hero_cta: 'Ver estoque',
  sobre_texto: 'Há mais de 10 anos realizando o sonho do carro novo com transparência e as melhores condições de financiamento.',
  ga4_id: '',
  meta_pixel_id: '',
}

export const siteService = {
  async obter(): Promise<SiteLoja> {
    await delay()
    return { ...site }
  },

  async salvar(patch: Partial<SiteLoja>): Promise<SiteLoja> {
    await delay(200, 400)
    site = { ...site, ...patch }
    return { ...site }
  },

  async publicar(publicar: boolean): Promise<SiteLoja> {
    await delay(300, 600)
    site = { ...site, publicado: publicar }
    return { ...site }
  },
}
