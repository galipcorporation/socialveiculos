// Assistente do Vendedor (copiloto de WhatsApp) — recorte mobile "acompanhar + aprovar".
// O pareamento por QR fica no desktop; aqui só LEMOS o status da sessão, listamos as
// conversas de leads reais e enviamos a sugestão da IA (texto ou áudio na voz clonada).
// API real: /v1/assistente (apps/api/routers/assistente.py). Ver stack-ia-assistente-vs-marketing.
import { api } from '../lib/api'

export type TomAssistente = 'formal' | 'amigavel' | 'direto' | 'consultivo' | 'descontraido'
export type AutonomiaAssistente = 'copiloto' | 'automatico'
export type StatusSessao = 'connected' | 'connecting' | 'disconnected'

export const TONS_ASSISTENTE: { value: TomAssistente; label: string }[] = [
  { value: 'amigavel', label: 'Amigável' },
  { value: 'formal', label: 'Formal' },
  { value: 'direto', label: 'Direto' },
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'descontraido', label: 'Descontraído' },
]

export interface SessaoAssistente {
  status: StatusSessao
  numero?: string | null
}

export interface ConversaAssistente {
  id: string
  contato_nome: string
  contato_numero: string
  autonomia: AutonomiaAssistente
  ultima_mensagem?: string
  ultima_mensagem_data?: string
  updated_at: string
}

export interface MensagemAssistente {
  id: string
  autor_tipo: 'lead' | 'vendedor' | 'ia' | string
  conteudo: string
  midia_url?: string
  midia_tipo?: string
  sugestao_ia?: string
  enviada_ia: boolean
  created_at: string
}

export interface ConfigAssistente {
  tom: TomAssistente
  consentimento_voz: boolean
  consentimento_timestamp?: string
  audio_url?: string
  estilo_resumo?: string
}

// ── DTOs da API ──
interface SessaoDTO { status?: string; numero_pareado?: string | null; qr?: string | null; error?: string }
interface ConversaDTO {
  id: string
  contato_nome: string
  contato_numero: string
  conversa_whatsapp_id: string
  autonomia: string
  created_at: string
  updated_at: string
  ultima_mensagem?: string | null
  ultima_mensagem_data?: string | null
}
interface MensagemDTO {
  id: string
  autor_tipo: string
  conteudo: string
  midia_url?: string | null
  midia_tipo?: string | null
  sugestao_ia?: string | null
  enviada_ia: boolean
  created_at: string
}
interface ConfigDTO {
  tom: string
  audio_url?: string | null
  estilo_resumo?: string | null
  consentimento_voz: boolean
  consentimento_timestamp?: string | null
}

function mapConversa(c: ConversaDTO): ConversaAssistente {
  return {
    id: c.id,
    contato_nome: c.contato_nome,
    contato_numero: c.contato_numero,
    autonomia: (c.autonomia as AutonomiaAssistente) ?? 'copiloto',
    ultima_mensagem: c.ultima_mensagem ?? undefined,
    ultima_mensagem_data: c.ultima_mensagem_data ?? undefined,
    updated_at: c.updated_at,
  }
}

function mapMensagem(m: MensagemDTO): MensagemAssistente {
  return {
    id: m.id,
    autor_tipo: m.autor_tipo,
    conteudo: m.conteudo,
    midia_url: m.midia_url ?? undefined,
    midia_tipo: m.midia_tipo ?? undefined,
    sugestao_ia: m.sugestao_ia ?? undefined,
    enviada_ia: m.enviada_ia,
    created_at: m.created_at,
  }
}

function mapConfig(c: ConfigDTO): ConfigAssistente {
  return {
    tom: (c.tom as TomAssistente) ?? 'amigavel',
    consentimento_voz: c.consentimento_voz,
    consentimento_timestamp: c.consentimento_timestamp ?? undefined,
    audio_url: c.audio_url ?? undefined,
    estilo_resumo: c.estilo_resumo ?? undefined,
  }
}

export const assistenteService = {
  // Só leitura — o pareamento por QR é feito no desktop (Gestor).
  async sessao(): Promise<SessaoAssistente> {
    const d = await api.get<SessaoDTO>('/assistente/sessao')
    const raw = d.status ?? 'disconnected'
    const status: StatusSessao =
      raw === 'connected' ? 'connected' : raw === 'connecting' ? 'connecting' : 'disconnected'
    return { status, numero: d.numero_pareado ?? undefined }
  },

  async conversas(): Promise<ConversaAssistente[]> {
    const data = await api.get<ConversaDTO[]>('/assistente/conversas')
    return data.map(mapConversa)
  },

  async mensagens(conversaId: string): Promise<MensagemAssistente[]> {
    const data = await api.get<MensagemDTO[]>(`/assistente/conversas/${conversaId}/mensagens`)
    return data.map(mapMensagem)
  },

  // Envia a sugestão da IA (possivelmente editada) como texto.
  async enviar(conversaId: string, conteudo: string): Promise<MensagemAssistente> {
    const m = await api.post<MensagemDTO>(`/assistente/conversas/${conversaId}/mensagens`, { conteudo })
    return mapMensagem(m)
  },

  // Envia como nota de voz sintetizada na voz clonada do vendedor.
  async enviarAudio(conversaId: string, conteudo: string): Promise<MensagemAssistente> {
    const m = await api.post<MensagemDTO>(`/assistente/conversas/${conversaId}/mensagens/audio`, { conteudo })
    return mapMensagem(m)
  },

  async config(): Promise<ConfigAssistente> {
    const c = await api.get<ConfigDTO>('/assistente/config')
    return mapConfig(c)
  },

  async salvarConfig(tom: TomAssistente, consentimentoVoz: boolean): Promise<ConfigAssistente> {
    const c = await api.put<ConfigDTO>('/assistente/config', { tom, consentimento_voz: consentimentoVoz })
    return mapConfig(c)
  },
}
