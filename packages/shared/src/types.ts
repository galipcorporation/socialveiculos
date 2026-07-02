import type { VehicleStatus, UserRole, LeadStage, MediaType, LeadOrigin, TransmissionType, FuelType } from './enums'

// ─── Veículo ───────────────────────────────────────────────────
export interface Vehicle {
  id: string
  loja_id: string
  placa?: string
  marca: string
  modelo: string
  ano_fabricacao: number
  ano_modelo: number
  km: number
  cor: string
  cambio: TransmissionType
  combustivel: FuelType
  tipo?: string
  preco_venda: number
  preco_custo?: number // ⚠️ nunca expor no B2C
  status: VehicleStatus
  publicado_marketplace: boolean
  descricao?: string
  opcionais?: string[]
  midias: Media[]
  created_at: string
  updated_at: string
}

/** DTO público da Vitrine — sem campos sensíveis */
export type VehiclePublic = Omit<Vehicle, 'preco_custo' | 'loja_id'> & {
  loja: StorePublic
  favoritos_count: number
}

// ─── Mídia ─────────────────────────────────────────────────────
export interface Media {
  id: string
  tipo: MediaType
  url: string
  ordem: number
  veiculo_id: string
}

// ─── Loja ──────────────────────────────────────────────────────
export interface Store {
  id: string
  nome: string
  slug: string
  logo_url?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  verificada: boolean
  created_at: string
}

/** DTO público da loja (visível no B2C) */
export type StorePublic = Pick<Store, 'id' | 'nome' | 'slug' | 'logo_url' | 'cidade' | 'estado' | 'verificada'>

// ─── Usuário ───────────────────────────────────────────────────
export interface User {
  id: string
  nome: string
  email: string
  telefone?: string
  avatar_url?: string
  papel: UserRole
  loja_id?: string
  created_at: string
}

// ─── Lead / Negociação ─────────────────────────────────────────
export interface Lead {
  id: string
  loja_id: string
  cliente_id: string
  veiculo_id?: string
  etapa: LeadStage
  origem: LeadOrigin
  valor_proposta?: number
  observacoes?: string
  created_at: string
  updated_at: string
}

// ─── Resposta padrão da API ────────────────────────────────────
export interface ApiError {
  error: string
  code: string
  details?: unknown
}

export interface ApiSuccess<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    per_page?: number
  }
}

// ─── Health Check ──────────────────────────────────────────────
export interface HealthResponse {
  status: 'ok'
  timestamp: string
  version: string
}
