/* ══════════════════════════════════════════════════════════════
   Identidade de veículo — fonte ÚNICA compartilhada entre
   Estoque (VeiculoModal) e Simulador. Não duplicar estas listas.
   ══════════════════════════════════════════════════════════════ */

/* Tipo de mídia canônico — igual ao enum TipoMidia do backend (apps/api/models.py). */
export type TipoMidia = 'foto' | 'video'

export interface Midia { id: string; tipo: TipoMidia; url: string; thumb_url?: string | null; ordem: number }

const EXT_FOTO = ['.jpg', '.jpeg', '.png', '.webp']
const EXT_VIDEO = ['.mp4', '.mov', '.webm']

const temExtensao = (url: string | undefined | null, exts: string[]): boolean => {
  const u = (url || '').toLowerCase()
  return exts.some(ext => u.endsWith(ext))
}

/* A extensão da URL tem precedência sobre o campo `tipo`: mídias gravadas antes
   da correção do B077 vieram do banco com tipo='video' sendo foto. */
export const isFoto = (m: Pick<Midia, 'tipo' | 'url'>): boolean =>
  temExtensao(m?.url, EXT_FOTO) || (m?.tipo === 'foto' && !temExtensao(m?.url, EXT_VIDEO))

export const isVideo = (m: Pick<Midia, 'tipo' | 'url'>): boolean => !!m?.url && !isFoto(m)

/* Capa do veículo: primeira foto; sem foto nenhuma, cai na primeira mídia. */
export const midiaCapa = <T extends Pick<Midia, 'tipo' | 'url'>>(midias?: T[]): T | undefined =>
  midias?.find(isFoto) ?? midias?.[0]

export interface Veiculo {
  id: string
  loja_id?: string
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
  tipo?: string
  carroceria?: string
  portas?: number
  preco_venda?: number
  preco_custo?: number
  status?: string
  publicado_marketplace?: boolean
  publicar_rede_social?: boolean
  valor_repasse?: number
  descricao?: string
  opcionais?: string
  fipe_marca_codigo?: string
  fipe_modelo_codigo?: string
  fipe_ano_codigo?: string
  created_at?: string
  updated_at?: string
  midias?: Midia[]
}

export interface CatalogoMarca { id: number; nome: string; logo_url?: string; ativa?: boolean }
export interface CatalogoModelo { id: number; marca_id?: number; nome: string; ativo?: boolean }

// Tipos de veículo (não é só carro: também moto, barco, jet, aeronave…).
export const TIPOS_VEICULO: { value: string; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'barco', label: 'Barco / Lancha' },
  { value: 'jet', label: 'Jet Ski' },
  { value: 'aeronave', label: 'Aeronave' },
  { value: 'reboque', label: 'Reboque / Carreta' },
  { value: 'outro', label: 'Outro' },
]

// Tipos que os bancos integrados (BV/PAN) financiam de fato.
// Verificado no mapeamento do BV: só "carro" tem seletor mapeado.
// Adicionar 'moto' quando houver seletor no backend das financiadoras.
export const TIPOS_FINANCIAVEIS = ['carro']
export const tiposVeiculoFinanciaveis = TIPOS_VEICULO.filter(t => TIPOS_FINANCIAVEIS.includes(t.value))
export const isTipoFinanciavel = (tipo?: string): boolean => !!tipo && TIPOS_FINANCIAVEIS.includes(tipo)

// Matriz: quais campos cada tipo MOSTRA. uso='horas' troca KM por "Horas de uso".
export type RegraTipo = { placa: boolean; km: boolean; cambio: boolean; combustivel: boolean; portas: boolean; versao: boolean; carroceria: boolean; uso: 'km' | 'horas' }
export const REGRAS_TIPO: Record<string, RegraTipo> = {
  carro:    { placa: true,  km: true,  cambio: true,  combustivel: true,  portas: true,  versao: true,  carroceria: true,  uso: 'km' },
  moto:     { placa: true,  km: true,  cambio: false, combustivel: true,  portas: false, versao: false, carroceria: false, uso: 'km' },
  caminhao: { placa: true,  km: true,  cambio: true,  combustivel: true,  portas: false, versao: true,  carroceria: false, uso: 'km' },
  barco:    { placa: false, km: true,  cambio: false, combustivel: true,  portas: false, versao: false, carroceria: false, uso: 'horas' },
  jet:      { placa: false, km: true,  cambio: false, combustivel: true,  portas: false, versao: false, carroceria: false, uso: 'horas' },
  aeronave: { placa: false, km: true,  cambio: false, combustivel: true,  portas: false, versao: false, carroceria: false, uso: 'horas' },
  reboque:  { placa: true,  km: false, cambio: false, combustivel: false, portas: false, versao: false, carroceria: false, uso: 'km' },
  outro:    { placa: true,  km: true,  cambio: true,  combustivel: true,  portas: true,  versao: true,  carroceria: false, uso: 'km' },
}
export const regraDoTipo = (tipo: string): RegraTipo => REGRAS_TIPO[tipo] || REGRAS_TIPO.outro

// Lista de anos para os selects: ano atual + 1 (0km do próximo ano) até 1990, decrescente.
export const ANOS: number[] = (() => {
  const max = new Date().getFullYear() + 1
  const arr: number[] = []
  for (let y = max; y >= 1990; y--) arr.push(y)
  return arr
})()

export interface AnoModeloPair {
  fabricacao: number
  modelo: number
  label: string
}

// Pares de ano fabricação / ano modelo para o select único, decrescente por modelo.
export const ANO_MODELO_PAIRS: AnoModeloPair[] = (() => {
  const max = new Date().getFullYear() + 1
  const arr: AnoModeloPair[] = []
  for (let y = max; y >= 1990; y--) {
    // Y/Y (ex: 2025/2025)
    arr.push({ fabricacao: y, modelo: y, label: `${y}/${y}` })
    // Y-1/Y (ex: 2024/2025)
    arr.push({ fabricacao: y - 1, modelo: y, label: `${y - 1}/${y}` })
  }
  return arr
})()

