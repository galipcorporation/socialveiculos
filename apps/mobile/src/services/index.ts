// Ponto único de acesso à camada de dados.
// Hoje: adapters mock (AsyncStorage + seed). Amanhã: adapters da API real,
// mantendo as mesmas assinaturas — as telas não mudam.

export { authService } from './auth'
export { veiculosService } from './veiculos'
export type { VeiculoInput, VeiculosFiltro, RegistrarVendaInput } from './veiculos'
export { leadsService } from './leads'
export type { LeadInput } from './leads'
export { chatService } from './chat'
export { esteiraService, comissoesService } from './esteira'
export { financeiroService } from './financeiro'
export type { LancamentoInput } from './financeiro'
export { equipeService } from './equipe'
export type { MembroInput } from './equipe'
export { dashboardService } from './dashboard'
export { configService } from './config'
export type {
  PerfilInput, CredencialBancoInput, CredencialIAInput, DetranInput, FiscalInput,
} from './config'
export { modulosService } from './modulos'
export { fipeService, TIPOS_FIPE } from './fipe'
export { contratosService } from './contratos'
export { notasFiscaisService } from './notasFiscais'
export { siteService } from './site'
export { repassesService } from './repasses'
export { marketingService, TONS_MARKETING } from './marketing'
export type { TomMarketing } from './marketing'
export { vitrineService, FILTROS_FEED } from './vitrine'
export type { FiltroFeed } from './vitrine'
export { resetDb } from './db'
export * from './types'
export { LOJA_NOME } from './seed'
