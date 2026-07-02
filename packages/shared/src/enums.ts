// ─── Status do Veículo ─────────────────────────────────────────
export const VEHICLE_STATUS = {
  DISPONIVEL: 'disponivel',
  RESERVADO: 'reservado',
  VENDIDO: 'vendido',
  REPASSE: 'repasse',
  INATIVO: 'inativo',
} as const

export type VehicleStatus = (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS]

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  repasse: 'Repasse',
  inativo: 'Inativo',
}

export const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  disponivel: '#10b981',
  reservado: '#f59e0b',
  vendido: '#6b7280',
  repasse: '#8b5cf6',
  inativo: '#ef4444',
}

// ─── Papéis de Usuário ─────────────────────────────────────────
export const USER_ROLE = {
  ADMIN_PLATAFORMA: 'admin_plataforma',
  GESTOR: 'gestor',
  VENDEDOR: 'vendedor',
  CLIENTE: 'cliente',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin_plataforma: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  cliente: 'Cliente',
}

// ─── Etapas do Lead ────────────────────────────────────────────
export const LEAD_STAGE = {
  LEAD: 'lead',
  PROPOSTA: 'proposta',
  NEGOCIACAO: 'negociacao',
  FECHAMENTO: 'fechamento',
  PERDIDO: 'perdido',
} as const

export type LeadStage = (typeof LEAD_STAGE)[keyof typeof LEAD_STAGE]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  lead: 'Lead Recebido',
  proposta: 'Proposta Enviada',
  negociacao: 'Em Negociação',
  fechamento: 'Fechamento',
  perdido: 'Perdido',
}

// ─── Tipos de Mídia ────────────────────────────────────────────
export const MEDIA_TYPE = {
  FOTO: 'foto',
  VIDEO: 'video',
} as const

export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE]

// ─── Origem do Lead ────────────────────────────────────────────
export const LEAD_ORIGIN = {
  VITRINE: 'vitrine',
  MANUAL: 'manual',
  SIMULADOR: 'simulador',
  WHATSAPP: 'whatsapp',
} as const

export type LeadOrigin = (typeof LEAD_ORIGIN)[keyof typeof LEAD_ORIGIN]

// ─── Tipo de Câmbio ────────────────────────────────────────────
export const TRANSMISSION_TYPE = {
  MANUAL: 'manual',
  AUTOMATICO: 'automatico',
  CVT: 'cvt',
  AUTOMATIZADO: 'automatizado',
} as const

export type TransmissionType = (typeof TRANSMISSION_TYPE)[keyof typeof TRANSMISSION_TYPE]

// ─── Tipo de Combustível ───────────────────────────────────────
export const FUEL_TYPE = {
  GASOLINA: 'gasolina',
  ETANOL: 'etanol',
  FLEX: 'flex',
  DIESEL: 'diesel',
  ELETRICO: 'eletrico',
  HIBRIDO: 'hibrido',
  GNV: 'gnv',
} as const

export type FuelType = (typeof FUEL_TYPE)[keyof typeof FUEL_TYPE]
