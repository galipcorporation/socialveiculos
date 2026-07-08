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
export { resetDb } from './db'
export * from './types'
export { LOJA_NOME } from './seed'
