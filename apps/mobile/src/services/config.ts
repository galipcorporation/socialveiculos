// Configurações da loja — contra /v1/configuracoes, /v1/fiscal e credenciais.
import { api } from '../lib/api'
import type {
  AmbienteFiscal, BancoSuportado, ConfiguracaoFiscal, CredencialBanco, CredencialDetran,
  CredencialIA, EscopoCredencial, PerfilLoja, ProvedorIA, RedeSocialStatus, RegimeTributario,
} from './types'

export interface PerfilInput {
  nome?: string
  cnpj?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  percentual_comissao_padrao?: number
}
export interface CredencialBancoInput {
  banco: string
  escopo: EscopoCredencial
  usuario: string
  senha: string
}
export interface CredencialIAInput {
  provedor: ProvedorIA
  api_key: string
  modelo_padrao?: string
}
export interface DetranInput {
  api_url: string
  api_key: string
}
export interface FiscalInput {
  inscricao_estadual?: string | null
  regime_tributario: RegimeTributario
  cnae?: string | null
  ambiente: AmbienteFiscal
}

interface LojaDTO {
  id: string
  nome: string
  slug: string
  cnpj?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  percentual_comissao_padrao?: number
  verificada?: boolean
  ativa?: boolean
}

function mapPerfil(l: LojaDTO): PerfilLoja {
  return {
    id: l.id,
    nome: l.nome,
    slug: l.slug,
    cnpj: l.cnpj ?? undefined,
    telefone: l.telefone ?? undefined,
    whatsapp: l.whatsapp ?? undefined,
    email: l.email ?? undefined,
    endereco: l.endereco ?? undefined,
    cidade: l.cidade ?? undefined,
    estado: l.estado ?? undefined,
    cep: l.cep ?? undefined,
    percentual_comissao_padrao: l.percentual_comissao_padrao ?? 0,
    verificada: l.verificada ?? false,
    ativa: l.ativa ?? true,
  }
}

export const configService = {
  // ── Perfil ───────────────────────────────────────────────
  async perfil(): Promise<PerfilLoja> {
    return mapPerfil(await api.get<LojaDTO>('/configuracoes/loja'))
  },
  async salvarPerfil(input: PerfilInput): Promise<PerfilLoja> {
    return mapPerfil(await api.patch<LojaDTO>('/configuracoes/loja', input))
  },

  // ── Credenciais bancárias ────────────────────────────────
  async bancosSuportados(): Promise<BancoSuportado[]> {
    return api.get<BancoSuportado[]>('/configuracoes/bancos')
  },
  async credenciaisBanco(): Promise<CredencialBanco[]> {
    return api.get<CredencialBanco[]>('/configuracoes/credenciais_banco')
  },
  async salvarCredencialBanco(input: CredencialBancoInput): Promise<CredencialBanco> {
    return api.post<CredencialBanco>('/configuracoes/credenciais_banco', {
      banco: input.banco,
      escopo: input.escopo,
      usuario: input.usuario,
      senha: input.senha,
    })
  },
  async removerCredencialBanco(id: string): Promise<void> {
    await api.delete(`/configuracoes/credenciais_banco/${id}`)
  },
  async testarCredencialBanco(input: { banco: string; usuario: string; senha: string }): Promise<{ valido: boolean; mensagem: string }> {
    return api.post<{ valido: boolean; mensagem: string }>('/configuracoes/credenciais_banco/testar', input)
  },

  // ── IA (BYOK) ────────────────────────────────────────────
  async credenciaisIA(): Promise<CredencialIA[]> {
    return api.get<CredencialIA[]>('/configuracoes/credenciais-ia')
  },
  async salvarCredencialIA(input: CredencialIAInput): Promise<CredencialIA> {
    return api.post<CredencialIA>('/configuracoes/credenciais-ia', {
      provedor: input.provedor,
      api_key: input.api_key,
      modelo_padrao: input.modelo_padrao?.trim() || null,
    })
  },
  async removerCredencialIA(provedor: ProvedorIA): Promise<void> {
    await api.delete(`/configuracoes/credenciais-ia/${provedor}`)
  },

  // ── Redes sociais ────────────────────────────────────────
  async redesSociais(): Promise<RedeSocialStatus[]> {
    return api.get<RedeSocialStatus[]>('/configuracoes/redes-sociais')
  },
  // A conexão real é um fluxo OAuth (Meta); retornamos a URL para abrir no navegador.
  // origem=app faz o backend redirecionar de volta via deep link (socialveiculos://meta-callback).
  async conectarRede(_rede: 'facebook' | 'instagram'): Promise<RedeSocialStatus> {
    const { url } = await api.get<{ url: string }>('/social-auth/meta/iniciar', { origem: 'app' })
    return { rede: _rede, conectada: false, oauth_url: url }
  },
  async metaPaginasPendentes(nonce: string): Promise<{ page_id: string; name: string; instagram_account_id?: string }[]> {
    return api.get(`/social-auth/meta/paginas`, { nonce })
  },
  async metaConfirmarPagina(nonce: string, pageId: string): Promise<void> {
    await api.post('/social-auth/meta/confirmar', { nonce, page_id: pageId })
  },
  async desconectarRede(rede: 'facebook' | 'instagram'): Promise<void> {
    await api.delete(`/configuracoes/redes-sociais/${rede}`)
  },

  // ── DETRAN (BYOF) ────────────────────────────────────────
  async detran(): Promise<CredencialDetran> {
    return api.get<CredencialDetran>('/configuracoes/credenciais-detran')
  },
  async salvarDetran(input: DetranInput): Promise<CredencialDetran> {
    return api.post<CredencialDetran>('/configuracoes/credenciais-detran', {
      api_url: input.api_url.trim(),
      api_key: input.api_key,
    })
  },
  async removerDetran(): Promise<void> {
    await api.delete('/configuracoes/credenciais-detran')
  },

  // ── Fiscal / NF-e ────────────────────────────────────────
  async fiscal(): Promise<ConfiguracaoFiscal> {
    return api.get<ConfiguracaoFiscal>('/fiscal/config')
  },
  async salvarFiscal(input: FiscalInput): Promise<ConfiguracaoFiscal> {
    return api.put<ConfiguracaoFiscal>('/fiscal/config', {
      inscricao_estadual: input.inscricao_estadual?.trim() || null,
      regime_tributario: input.regime_tributario,
      cnae: input.cnae?.trim() || null,
      ambiente: input.ambiente,
    })
  },
  // O certificado é enviado como arquivo (FormData) pela tela; aqui recebemos o URI.
  async enviarCertificado(nomeArquivo: string): Promise<ConfiguracaoFiscal> {
    const fd = new FormData()
    // A tela mobile passa o nome; o upload real anexa o arquivo A1 escolhido.
    fd.append('nome', nomeArquivo)
    return api.post<ConfiguracaoFiscal>('/fiscal/certificado', fd)
  },
}
