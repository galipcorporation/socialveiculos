// Ponto único de acesso à camada de dados.
// Todos os adapters falam com a API real (apps/api) via src/lib/api.ts,
// mantendo as assinaturas que as telas consomem.

export { authService } from './auth'
export { veiculosService, CATEGORIAS_CUSTO } from './veiculos'
export type { VeiculoInput, VeiculosFiltro, RegistrarVendaInput } from './veiculos'
export { leadsService } from './leads'
export type { LeadInput, NegociacaoInput } from './leads'
export { clientesService } from './clientes'
export type { ClienteInput } from './clientes'
export { chatService } from './chat'
export { esteiraService, comissoesService } from './esteira'
export { financeiroService } from './financeiro'
export type { LancamentoInput, PeriodoFinanceiro } from './financeiro'
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
export { marketingService, TONS_MARKETING, CANAIS_MARKETING } from './marketing'
export type { TomMarketing, CanalMarketing, PostMarketing } from './marketing'
export { assistenteService, TONS_ASSISTENTE } from './assistente'
export type {
  TomAssistente, AutonomiaAssistente, SessaoAssistente,
  ConversaAssistente, MensagemAssistente, ConfigAssistente,
} from './assistente'
export { vitrineService, FILTROS_FEED } from './vitrine'
export type { FiltroFeed } from './vitrine'
export { simuladorService, BANCOS_SIM } from './simulador'
export type { BancoSim, ResultadoBanco, SimulacaoInput } from './simulador'
export * from './types'
