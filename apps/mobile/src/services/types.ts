// Modelos de domínio — mesmas shapes das APIs do apps/api (ver apps/gestor).
// Quando o backend for plugado, estes tipos permanecem; troca-se só o adapter.

// ── Veículo ────────────────────────────────────────────────
export type VeiculoStatus = 'disponivel' | 'reservado' | 'vendido' | 'repasse' | 'inativo' | 'rascunho'
export type TipoVeiculo = 'carro' | 'moto' | 'caminhao' | 'barco' | 'jet' | 'aeronave' | 'reboque' | 'outro'
export type OrigemVeiculo = 'compra' | 'troca'

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
  origem?: OrigemVeiculo
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
  rascunho: 'Rascunho',
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
  /** Tipo tem cobertura na tabela FIPE (marca/modelo vêm do catálogo). */
  fipe: boolean
}

export const REGRAS_TIPO: Record<TipoVeiculo, RegraTipo> = {
  carro: { placa: true, km: true, cambio: true, combustivel: true, portas: true, versao: true, uso: 'km', fipe: true },
  moto: { placa: true, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'km', fipe: true },
  caminhao: { placa: true, km: true, cambio: true, combustivel: true, portas: false, versao: true, uso: 'km', fipe: true },
  barco: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas', fipe: false },
  jet: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas', fipe: false },
  aeronave: { placa: false, km: true, cambio: false, combustivel: true, portas: false, versao: false, uso: 'horas', fipe: false },
  reboque: { placa: true, km: false, cambio: false, combustivel: false, portas: false, versao: false, uso: 'km', fipe: false },
  outro: { placa: true, km: true, cambio: true, combustivel: true, portas: true, versao: true, uso: 'km', fipe: false },
}

// Opcionais sugeridos por tipo — moto não tem porta elétrica, barco não tem airbag.
const OPCIONAIS_AUTOMOVEL = [
  'Ar condicionado', 'Direção hidráulica', 'Vidros elétricos', 'Travas elétricas',
  'Alarme', 'Freio ABS', 'Airbag', 'Kit multimídia', 'Rodas de liga leve',
  'Sensor de ré', 'Câmera de ré', 'Teto solar',
]

export const OPCIONAIS_POR_TIPO: Record<TipoVeiculo, string[]> = {
  carro: OPCIONAIS_AUTOMOVEL,
  outro: OPCIONAIS_AUTOMOVEL,
  moto: [
    'Freio ABS', 'Partida elétrica', 'Painel digital', 'Alarme',
    'Baú / bagageiro', 'Protetor de motor', 'Manopla aquecida', 'Escapamento esportivo',
  ],
  caminhao: [
    'Ar condicionado', 'Freio ABS', 'Direção hidráulica', 'Cabine leito',
    'Freio motor', 'Tacógrafo', 'Rastreador', 'Quinta roda', 'Traçado (6x2 / 6x4)',
  ],
  barco: [
    'Motor de popa', 'Motor de centro', 'Cabine', 'Banheiro químico',
    'GPS / sonar', 'Piloto automático', 'Toldo / capota', 'Carreta rodoviária',
    'Som marinizado', 'Geladeira / cooler',
  ],
  jet: [
    'Reboque / carreta', 'Ré', 'Sistema de som', 'Baú estanque',
    'Capa de proteção', 'Colete salva-vidas', 'Modo eco',
  ],
  aeronave: [
    'IFR homologado', 'Piloto automático', 'GPS / glass cockpit', 'Degelo',
    'Trem retrátil', 'Hélice de velocidade constante', 'Ar condicionado', 'Interior refeito',
  ],
  reboque: [
    'Freio próprio', 'Eixo duplo', 'Rampa', 'Lona / encerado',
    'Suspensão a ar', 'Pneus novos', 'Documentação em dia',
  ],
}

// Placeholder da descrição por tipo — evita "carro" fixo em anúncio de lancha.
export const DESCRICAO_PLACEHOLDER: Record<TipoVeiculo, string> = {
  carro: 'Detalhes do veículo, histórico, condição…',
  moto: 'Detalhes da moto, revisões, condição dos pneus…',
  caminhao: 'Detalhes do caminhão, implemento, histórico de manutenção…',
  barco: 'Detalhes da embarcação, horas de motor, local de guarda…',
  jet: 'Detalhes do jet ski, horas de uso, itens inclusos…',
  aeronave: 'Detalhes da aeronave, horas de célula/motor, aviônicos…',
  reboque: 'Detalhes do reboque, capacidade, estado da estrutura…',
  outro: 'Detalhes do item, histórico, condição…',
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
  rg?: string
  data_nascimento?: string
  renda_mensal?: number
  cep?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
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

// ── Custos de preparação do veículo — M058 ─────────────────
export type CategoriaCusto = 'mecanica' | 'pintura' | 'pneus' | 'documentacao' | 'estetica' | 'outro'

export interface CustoVeiculo {
  id: string
  veiculo_id: string
  categoria: CategoriaCusto
  descricao: string
  valor: number
  created_at: string
}

// ── Documentos de venda do veículo — M058 (resto) ──────────
export type TipoDocumentoVenda = 'contrato' | 'nota_fiscal' | 'garantia' | 'laudo' | 'outro'

export const TIPOS_DOC_VENDA: { value: TipoDocumentoVenda; label: string }[] = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'nota_fiscal', label: 'Nota fiscal' },
  { value: 'garantia', label: 'Garantia' },
  { value: 'laudo', label: 'Laudo cautelar' },
  { value: 'outro', label: 'Outro' },
]

export interface DocumentoVenda {
  id: string
  veiculo_id: string
  tipo: TipoDocumentoVenda
  nome_arquivo: string
  visivel_comprador: boolean
  created_at: string
}

// ── Aprovação do vendedor — M058 (resto) ───────────────────
export type TipoSolicitacao = 'exclusao' | 'alteracao_preco'
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'rejeitada'

export interface SolicitacaoAprovacao {
  id: string
  veiculo_id: string
  veiculo_nome: string
  tipo: TipoSolicitacao
  motivo: string
  solicitante_nome: string
  /** Para alteracao_preco: novo preço proposto. */
  novo_preco?: number
  preco_atual?: number
  status: StatusSolicitacao
  created_at: string
  resolvida_em?: string
}

// ── Negociações (propostas por lead) — M059 ────────────────
export interface Negociacao {
  id: string
  lead_id: string
  valor_proposta: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
  created_at: string
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

export type TipoConversa = 'cliente' | 'parceiro'

export type StatusNegociacaoConversa =
  | 'pendente' | 'aceita' | 'rejeitada' | 'cancelada'
  | 'em_negociacao' | 'fechou' | 'nao_fechou'

export interface Conversa {
  id: string
  tipo: TipoConversa
  cliente_nome: string
  cliente_telefone?: string
  veiculo_interesse?: string
  /** Para tipo 'parceiro': nome da loja parceira (B2B). */
  loja_parceira_nome?: string
  canal: 'chat' | 'whatsapp'
  ultima_mensagem: string
  ultima_mensagem_em: string
  nao_lidas: number
  /** Para tipo 'parceiro' (B2B): status herdado da proposta vinculada, ou marcado manualmente. */
  status_negociacao?: StatusNegociacaoConversa | null
  /** Para tipo 'parceiro' (B2B): true se há PropostaRepasse vinculada (status não é editável manualmente). */
  tem_proposta_vinculada?: boolean
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
  documento_nome?: string | null
}

export interface Esteira {
  id: string
  estagio: EstagioEsteira
  veiculo_nome: string
  veiculo_id?: string
  contrato_id?: string
  comprador_nome: string
  vendedor_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_percentual?: number
  comissao_id?: string
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
  // Soft delete (lixeira)
  deletado_em?: string
  deletado_por_nome?: string
  motivo_exclusao?: string
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
  /** JSON array das keys de módulos liberados (vendedor). Gestor = acesso total. */
  modulos?: string
  vendas_mes?: number
  created_at: string
  // Config do Assistente de IA por vendedor (M066)
  assistente_ativo?: boolean
  assistente_autonomia?: 'copiloto' | 'automatico'
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
  link?: string | null
  created_at: string
}

// ── Configurações da loja ──────────────────────────────────
export interface PerfilLoja {
  id: string
  nome: string
  slug: string
  cnpj?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  percentual_comissao_padrao: number
  verificada: boolean
  ativa: boolean
}

export type EscopoCredencial = 'loja' | 'vendedor'

export interface BancoSuportado {
  codigo: string
  nome: string
}

export interface CredencialBanco {
  id: string
  banco: string
  escopo: EscopoCredencial
  usuario_configurado: string | null
  ativo: boolean
  created_at: string
}

export type ProvedorIA = 'anthropic' | 'openai' | 'gemini'

export interface CredencialIA {
  id: string
  provedor: ProvedorIA
  modelo_padrao: string | null
  configurada: boolean
  ativo: boolean
}

export const PROVEDORES_IA: { value: ProvedorIA; label: string; placeholder: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  { value: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-...' },
  { value: 'gemini', label: 'Google Gemini', placeholder: 'AIza...' },
]

export interface RedeSocialStatus {
  rede: 'facebook' | 'instagram'
  page_id?: string | null
  instagram_account_id?: string | null
  token_expira_em?: string | null
  conectada: boolean
  /** URL do fluxo OAuth (Meta) a abrir no navegador ao conectar. */
  oauth_url?: string
}

export interface CredencialDetran {
  configurada: boolean
  api_url: string | null
  ativo: boolean
}

export type RegimeTributario = 'simples' | 'presumido' | 'real'
export type AmbienteFiscal = 'homologacao' | 'producao'

export const REGIMES_FISCAIS: { value: RegimeTributario; label: string }[] = [
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'presumido', label: 'Lucro Presumido' },
  { value: 'real', label: 'Lucro Real' },
]

export interface ConfiguracaoFiscal {
  liberado: boolean
  configurada: boolean
  inscricao_estadual?: string | null
  regime_tributario?: RegimeTributario | null
  cnae?: string | null
  ambiente?: AmbienteFiscal | null
  certificado_configurado?: boolean
  certificado_validade?: string | null
  ativo?: boolean
}

// ── Vitrine B2C (comprador) ────────────────────────────────
export interface LojaVitrine {
  id: string
  nome: string
  cidade?: string
  estado?: string
  whatsapp?: string
  verificada: boolean
  total_veiculos: number
  seguindo?: boolean
}

export interface AnuncioVitrine {
  id: string
  loja_id: string
  loja_nome: string
  loja_cidade?: string
  loja_estado?: string
  loja_whatsapp?: string
  loja_verificada: boolean
  marca: string
  modelo: string
  versao?: string
  tipo: TipoVeiculo
  ano_fabricacao?: number
  ano_modelo: number
  km?: number
  cor?: string
  cambio?: string
  combustivel?: string
  portas?: number
  preco_venda?: number
  descricao?: string
  opcionais?: string
  midias: Midia[]
  oferta?: boolean
  novidade?: boolean
  total_favoritos: number
  favoritado_por_mim: boolean
  created_at: string
}

export interface ConversaVitrine {
  id: string
  loja_id: string
  loja_nome: string
  loja_verificada: boolean
  veiculo_interesse?: string
  ultima_mensagem: string
  ultima_mensagem_em: string
  nao_lidas: number
}

// ── Módulos pagos (gate) ───────────────────────────────────
export type Modulo = 'contratos' | 'simulador' | 'marketing' | 'assistente_ia' | 'fiscal' | 'site'

export interface ModuloStatus {
  modulo: Modulo
  liberado: boolean
}

// ── FIPE ───────────────────────────────────────────────────
export interface FipeItem {
  codigo: string
  nome: string
}

export interface FipeResultado {
  fipe: number | null
  fipe_disponivel: boolean
}

// ── Contratos ──────────────────────────────────────────────
export type StatusContrato = 'rascunho' | 'aguardando' | 'assinado' | 'cancelado'

export interface Contrato {
  id: string
  numero: string
  tipo: 'compra_venda' | 'compra'
  status: StatusContrato
  veiculo_nome?: string
  cliente_nome?: string
  valor_venda?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
  created_at: string
}

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando assinatura',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
}

// ── Notas Fiscais (NF-e) ───────────────────────────────────
export type StatusNota =
  | 'processando' | 'autorizada' | 'rejeitada' | 'erro' | 'cancelada' | 'processando_cancelamento'

export interface NotaFiscal {
  id: string
  numero?: string
  serie?: string
  tipo: 'saida' | 'entrada'
  status: StatusNota
  chave_acesso?: string
  valor_total: number
  veiculo_nome?: string
  cliente_nome?: string
  contrato_numero?: string
  ambiente: AmbienteFiscal
  motivo_rejeicao?: string
  justificativa_cancelamento?: string
  danfe_pdf_url?: string
  xml_url?: string
  cartas_correcao?: CartaCorrecao[]
  emitida_em?: string
  created_at: string
}

export interface CartaCorrecao {
  id: string
  sequencia: number
  texto: string
  created_at: string
}

export const STATUS_NOTA_LABEL: Record<StatusNota, string> = {
  processando: 'Processando',
  autorizada: 'Autorizada',
  rejeitada: 'Rejeitada',
  erro: 'Erro',
  cancelada: 'Cancelada',
  processando_cancelamento: 'Cancelando…',
}

// ── Meu Site (white-label) ─────────────────────────────────
export type TemplateSite = 'clean' | 'premium' | 'compacto'

export interface SiteLoja {
  publicado: boolean
  subdominio: string
  template: TemplateSite
  cor_primaria: string
  cor_secundaria: string
  logo_url?: string
  banner_url?: string
  hero_titulo: string
  hero_subtitulo: string
  hero_cta: string
  sobre_texto: string
  seo_title?: string
  seo_description?: string
  ga4_id?: string
  meta_pixel_id?: string
}

export const TEMPLATES_SITE: { value: TemplateSite; label: string; descricao: string }[] = [
  { value: 'clean', label: 'Clean', descricao: 'Hero centralizado, fundo claro' },
  { value: 'premium', label: 'Premium', descricao: 'Hero em tela cheia com banner' },
  { value: 'compacto', label: 'Compacto', descricao: 'Faixa estreita à esquerda' },
]

// ── Rede Social / Repasses B2B ─────────────────────────────
export interface PublicacaoRepasse {
  id: string
  loja_id: string
  loja_nome: string
  autor_nome: string
  veiculo_id?: string
  veiculo_nome: string
  veiculo_ano?: number
  veiculo_km?: number
  foto_url?: string
  conteudo?: string
  valor_repasse?: number
  curtidas: number
  comentarios: number
  curtido_por_mim: boolean
  created_at: string
}

export interface ComentarioRepasse {
  id: string
  publicacao_id: string
  autor_nome: string
  texto: string
  created_at: string
}

export type StatusProposta = 'pendente' | 'aceita' | 'rejeitada' | 'cancelada'

export interface PropostaRepasse {
  id: string
  direcao: 'enviada' | 'recebida'
  loja_parceira_nome: string
  veiculo_nome: string
  valor_proposta: number
  status: StatusProposta
  observacoes?: string
  created_at: string
}

export const STATUS_PROPOSTA_LABEL: Record<StatusProposta, string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
}

export interface LojaParceira {
  id: string
  nome: string
  cidade?: string
  estado?: string
  telefone?: string
  whatsapp?: string
  verificada: boolean
  total_veiculos: number
  conversa_id?: string
  seguindo?: boolean
}

// ── Comissões ──────────────────────────────────────────────
export interface MinhaVenda {
  esteira_id: string
  veiculo_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_percentual?: number
  comissao_paga?: boolean | null
  estagio: EstagioEsteira
  aberta_em: string
}
