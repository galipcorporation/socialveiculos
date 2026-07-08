// Modelos de domínio — mesmas shapes das APIs do apps/api (ver apps/gestor).
// Quando o backend for plugado, estes tipos permanecem; troca-se só o adapter.

// ── Veículo ────────────────────────────────────────────────
export type VeiculoStatus = 'disponivel' | 'reservado' | 'vendido' | 'repasse' | 'inativo'
export type TipoVeiculo = 'carro' | 'moto' | 'caminhao' | 'barco' | 'jet' | 'aeronave' | 'reboque' | 'outro'

export interface Midia {
  id: string
  tipo: 'imagem' | 'video'
  url: string
  ordem: number
}

export interface Veiculo {
  id: string
  loja_id: string
  placa?: string
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao?: number
  ano_modelo: number
  km?: number
  cor?: string
  cambio?: string
  combustivel?: string
  tipo: TipoVeiculo
  portas?: number
  preco_venda?: number
  preco_custo?: number
  status: VeiculoStatus
  publicado_marketplace?: boolean
  publicar_rede_social?: boolean
  descricao?: string
  opcionais?: string
  created_at: string
  updated_at: string
  midias: Midia[]
}

export const STATUS_VEICULO_LABEL: Record<VeiculoStatus, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  repasse: 'Repasse',
  inativo: 'Inativo',
}

export const TIPOS_VEICULO: { value: TipoVeiculo; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'barco', label: 'Barco / Lancha' },
  { value: 'jet', label: 'Jet Ski' },
  { value: 'aeronave', label: 'Aeronave' },
  { value: 'reboque', label: 'Reboque / Carreta' },
  { value: 'outro', label: 'Outro' },
]

// Matriz de campos por tipo (espelho de apps/gestor/src/lib/veiculo.ts)
export type RegraTipo = {
  placa: boolean
  km: boolean
  cambio: boolean
  combustivel: boolean
  portas: boolean
  versao: boolean
  uso: 'km' | 'horas'
}

export const REGRAS_TIPO: Record<TipoVeiculo, RegraTipo> = {
  carro: { placa: true, km: true, cambio: true, combustivel: true, portas: true, versao: true, uso: 'km' },
  moto: { placa: true, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'km' },
  caminhao: { placa: true, km: true, cambio: true, combustivel: true, portas: false, versao: true, uso: 'km' },
  barco: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas' },
  jet: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas' },
  aeronave: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas' },
  reboque: { placa: true, km: false, cambio: false, combustivel: false, portas: false, versao: false, uso: 'km' },
  outro: { placa: true, km: true, cambio: true, combustivel: true, portas: true, versao: true, uso: 'km' },
}

export const ANOS: number[] = (() => {
  const max = new Date().getFullYear() + 1
  const arr: number[] = []
  for (let y = max; y >= 1990; y--) arr.push(y)
  return arr
})()

// ── CRM ────────────────────────────────────────────────────
export type EtapaLead = 'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido'
export type OrigemLead = 'manual' | 'vitrine' | 'simulador' | 'whatsapp'

export interface Cliente {
  id: string
  loja_id: string
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  cidade?: string
  created_at: string
}

export interface Interacao {
  id: string
  lead_id: string
  tipo: 'nota' | 'ligacao' | 'whatsapp' | 'visita' | 'proposta' | 'sistema'
  texto: string
  autor?: string
  created_at: string
}

export interface Lead {
  id: string
  loja_id: string
  cliente_id: string
  veiculo_id?: string
  etapa: EtapaLead
  origem: OrigemLead
  valor_proposta?: number
  observacoes?: string
  cliente?: Cliente
  veiculo?: Veiculo
  interacoes?: Interacao[]
  created_at: string
  updated_at: string
}

export const ETAPAS_LEAD: { value: EtapaLead; label: string }[] = [
  { value: 'lead', label: 'Novo' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'perdido', label: 'Perdido' },
]

export const ORIGEM_LEAD_LABEL: Record<OrigemLead, string> = {
  manual: 'Manual',
  vitrine: 'Vitrine',
  simulador: 'Simulador',
  whatsapp: 'WhatsApp',
}

// ── Chat ───────────────────────────────────────────────────
export interface Mensagem {
  id: string
  conversa_id: string
  autor: 'loja' | 'cliente'
  texto: string
  created_at: string
  lida: boolean
}

export interface Conversa {
  id: string
  cliente_nome: string
  cliente_telefone?: string
  veiculo_interesse?: string
  canal: 'chat' | 'whatsapp'
  ultima_mensagem: string
  ultima_mensagem_em: string
  nao_lidas: number
}

// ── Pós-venda (esteira) ────────────────────────────────────
export type EstagioEsteira = 'contrato' | 'pagamento' | 'documentos' | 'transferencia' | 'concluido'
export type StatusItemEsteira = 'pendente' | 'em_andamento' | 'concluido' | 'nao_aplicavel'
export type CategoriaItemEsteira = 'contrato' | 'financeiro' | 'documento' | 'transferencia'

export interface ItemChecklist {
  id: string
  chave: string
  titulo: string
  categoria: CategoriaItemEsteira
  responsavel: 'loja' | 'comprador'
  status: StatusItemEsteira
  obrigatorio: boolean
  prazo_em?: string | null
  vencido: boolean
  concluido_em?: string | null
}

export interface Esteira {
  id: string
  estagio: EstagioEsteira
  veiculo_nome: string
  veiculo_id?: string
  comprador_nome: string
  vendedor_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_paga?: boolean | null
  itens: ItemChecklist[]
  aberta_em: string
  concluida_em?: string | null
}

export const ESTAGIOS_ESTEIRA: { key: Exclude<EstagioEsteira, 'concluido'>; label: string; descricao: string }[] = [
  { key: 'contrato', label: 'Contrato', descricao: 'Assinatura e validação' },
  { key: 'pagamento', label: 'Pagamento', descricao: 'Confirmação e recibo' },
  { key: 'documentos', label: 'Documentos', descricao: 'Documentação do veículo' },
  { key: 'transferencia', label: 'Transferência', descricao: 'DETRAN e finalização' },
]

export const CATEGORIA_ITEM_LABEL: Record<CategoriaItemEsteira, string> = {
  contrato: 'Contrato',
  financeiro: 'Pagamento',
  documento: 'Documentos',
  transferencia: 'Transferência',
}

// ── Financeiro ─────────────────────────────────────────────
export type TipoLancamento = 'receita' | 'despesa' | 'comissao'

export interface Lancamento {
  id: string
  loja_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  veiculo_nome?: string
  status_pagamento: 'pago' | 'pendente'
  created_at: string
}

export interface ResumoFinanceiro {
  receitas: number
  despesas: number
  comissoes: number
  saldo: number
  custo_estoque: number
  comissoes_pendentes: number
}

// ── Equipe ─────────────────────────────────────────────────
export type Papel = 'gestor' | 'vendedor'

export interface Membro {
  id: string
  nome: string
  email: string
  telefone?: string
  papel: Papel
  ativo: boolean
  percentual_comissao?: number | null
  vendas_mes?: number
  created_at: string
}

// ── Dashboard ──────────────────────────────────────────────
export interface DashboardKpis {
  escopo: 'loja' | 'vendedor'
  estoque_ativo: number
  leads_ativos: number
  vendas_mes: number
  receita_mes: number | null
  veiculos_publicados: number
  minhas_comissoes_pendentes: number | null
  minhas_comissoes_pagas_mes: number | null
  vendas_por_mes: { mes: string; total: number }[]
}

export interface Notificacao {
  id: string
  titulo: string
  conteudo: string
  lida: boolean
  created_at: string
}

// ── Comissões ──────────────────────────────────────────────
export interface MinhaVenda {
  esteira_id: string
  veiculo_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_paga?: boolean | null
  estagio: EstagioEsteira
  aberta_em: string
}
