// Banco mock local — hidrata do AsyncStorage, semeia na primeira execução e
// persiste toda mutação. É o "backend" temporário: quando a API real entrar,
// somente os adapters em services/* mudam; telas e hooks ficam intactos.

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildClientes, buildConfigFiscal, buildConversas, buildConversasB2B,
  buildCredenciaisBanco, buildCredenciaisIA, buildCredencialDetran, buildEquipe, buildEsteiras,
  buildLancamentos, buildLeads, buildNotificacoes, buildPerfilLoja, buildRedesSociais,
  buildVeiculos, BANCOS_SUPORTADOS,
} from './seed'
import type {
  Cliente, ConfiguracaoFiscal, Conversa, CredencialBanco, CredencialDetran, CredencialIA,
  CustoVeiculo, DocumentoVenda, Esteira, Lancamento, Lead, Membro, Mensagem, Negociacao,
  Notificacao, PerfilLoja, RedeSocialStatus, SolicitacaoAprovacao, Veiculo,
} from './types'

const STORAGE_KEY = 'sv-mock-db'
const SEED_VERSION = 4

export interface Database {
  version: number
  veiculos: Veiculo[]
  clientes: Cliente[]
  leads: Lead[]
  conversas: Conversa[]
  mensagens: Mensagem[]
  esteiras: Esteira[]
  lancamentos: Lancamento[]
  equipe: Membro[]
  notificacoes: Notificacao[]
  // Configurações da loja (M048)
  perfilLoja: PerfilLoja
  credenciaisBanco: CredencialBanco[]
  bancosSuportados: { codigo: string; nome: string }[]
  credenciaisIA: CredencialIA[]
  redesSociais: RedeSocialStatus[]
  detran: CredencialDetran
  configFiscal: ConfiguracaoFiscal
  // Paridade recurso-a-recurso (M058/M059)
  custos: CustoVeiculo[]
  negociacoes: Negociacao[]
  documentosVenda: DocumentoVenda[]
  solicitacoes: SolicitacaoAprovacao[]
}

let cache: Database | null = null
let loading: Promise<Database> | null = null

function buildSeed(): Database {
  const veiculos = buildVeiculos()
  const clientes = buildClientes()
  const leads = buildLeads(clientes, veiculos)
  const clientesChat = buildConversas()
  const b2b = buildConversasB2B()
  return {
    version: SEED_VERSION,
    veiculos,
    clientes,
    leads,
    conversas: [...clientesChat.conversas, ...b2b.conversas],
    mensagens: [...clientesChat.mensagens, ...b2b.mensagens],
    esteiras: buildEsteiras(),
    lancamentos: buildLancamentos(),
    equipe: buildEquipe(),
    notificacoes: buildNotificacoes(),
    perfilLoja: buildPerfilLoja(),
    credenciaisBanco: buildCredenciaisBanco(),
    bancosSuportados: BANCOS_SUPORTADOS,
    credenciaisIA: buildCredenciaisIA(),
    redesSociais: buildRedesSociais(),
    detran: buildCredencialDetran(),
    configFiscal: buildConfigFiscal(),
    custos: [],
    negociacoes: [],
    documentosVenda: [],
    solicitacoes: [],
  }
}

export async function getDb(): Promise<Database> {
  if (cache) return cache
  if (loading) return loading
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Database
        if (parsed.version === SEED_VERSION) {
          cache = parsed
          return parsed
        }
      }
    } catch {
      // seed abaixo
    }
    const seeded = buildSeed()
    cache = seeded
    persist()
    return seeded
  })()
  return loading
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Persistência assíncrona com debounce — nunca bloqueia a UI. */
export function persist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    if (cache) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => {})
  }, 150)
}

export async function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const db = await getDb()
  const result = fn(db)
  persist()
  return result
}

export async function resetDb(): Promise<void> {
  cache = buildSeed()
  loading = null
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
}

/** Latência simulada para exercitar loading/skeleton states. */
export function delay(min = 220, max = 480): Promise<void> {
  const ms = min + Math.random() * (max - min)
  return new Promise((r) => setTimeout(r, ms))
}

let idSeq = 1000
export function novoId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`
}
