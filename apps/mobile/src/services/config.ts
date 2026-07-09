// Configurações da loja (M048) — espelho de apps/gestor/src/pages/Configuracoes.tsx.
// Mock-first: quando a API real entrar, só este adapter muda; as subtelas ficam intactas.

import { delay, getDb, mutate, novoId } from './db'
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

export const configService = {
  // ── Perfil ───────────────────────────────────────────────
  async perfil(): Promise<PerfilLoja> {
    await delay()
    const db = await getDb()
    return { ...db.perfilLoja }
  },

  async salvarPerfil(input: PerfilInput): Promise<PerfilLoja> {
    await delay(200, 400)
    return mutate((db) => {
      db.perfilLoja = {
        ...db.perfilLoja,
        ...input,
        percentual_comissao_padrao:
          input.percentual_comissao_padrao != null
            ? Math.min(100, Math.max(0, input.percentual_comissao_padrao))
            : db.perfilLoja.percentual_comissao_padrao,
      }
      return { ...db.perfilLoja }
    })
  },

  // ── Credenciais bancárias ────────────────────────────────
  async bancosSuportados(): Promise<BancoSuportado[]> {
    const db = await getDb()
    return db.bancosSuportados
  },

  async credenciaisBanco(): Promise<CredencialBanco[]> {
    await delay()
    const db = await getDb()
    return [...db.credenciaisBanco]
  },

  async salvarCredencialBanco(input: CredencialBancoInput): Promise<CredencialBanco> {
    await delay(200, 400)
    return mutate((db) => {
      const idx = db.credenciaisBanco.findIndex(
        (c) => c.banco === input.banco && c.escopo === input.escopo,
      )
      const cred: CredencialBanco = {
        id: idx >= 0 ? db.credenciaisBanco[idx].id : novoId('cred'),
        banco: input.banco,
        escopo: input.escopo,
        usuario_configurado: input.usuario,
        ativo: true,
        created_at: idx >= 0 ? db.credenciaisBanco[idx].created_at : new Date().toISOString(),
      }
      if (idx >= 0) db.credenciaisBanco[idx] = cred
      else db.credenciaisBanco.push(cred)
      return cred
    })
  },

  async removerCredencialBanco(id: string): Promise<void> {
    return mutate((db) => {
      db.credenciaisBanco = db.credenciaisBanco.filter((c) => c.id !== id)
    })
  },

  // Teste de conexão — mock sempre válido (a API real chamaria o banco).
  async testarCredencialBanco(input: { banco: string; usuario: string; senha: string }): Promise<{ valido: boolean; mensagem: string }> {
    await delay(500, 900)
    if (!input.usuario.trim() || !input.senha.trim()) {
      return { valido: false, mensagem: 'Usuário e senha são obrigatórios.' }
    }
    return { valido: true, mensagem: 'Credenciais válidas (ambiente de demonstração).' }
  },

  // ── IA (BYOK) ────────────────────────────────────────────
  async credenciaisIA(): Promise<CredencialIA[]> {
    await delay()
    const db = await getDb()
    return [...db.credenciaisIA]
  },

  async salvarCredencialIA(input: CredencialIAInput): Promise<CredencialIA> {
    await delay(300, 600)
    return mutate((db) => {
      const idx = db.credenciaisIA.findIndex((c) => c.provedor === input.provedor)
      const cred: CredencialIA = {
        id: idx >= 0 ? db.credenciaisIA[idx].id : novoId('cia'),
        provedor: input.provedor,
        modelo_padrao: input.modelo_padrao?.trim() || null,
        configurada: true,
        ativo: true,
      }
      if (idx >= 0) db.credenciaisIA[idx] = cred
      else db.credenciaisIA.push(cred)
      return cred
    })
  },

  async removerCredencialIA(provedor: ProvedorIA): Promise<void> {
    return mutate((db) => {
      db.credenciaisIA = db.credenciaisIA.filter((c) => c.provedor !== provedor)
    })
  },

  // ── Redes sociais ────────────────────────────────────────
  async redesSociais(): Promise<RedeSocialStatus[]> {
    await delay()
    const db = await getDb()
    return [...db.redesSociais]
  },

  // Conectar — mock simula OAuth concluído.
  async conectarRede(rede: 'facebook' | 'instagram'): Promise<RedeSocialStatus> {
    await delay(400, 700)
    return mutate((db) => {
      const expira = new Date(Date.now() + 60 * 86_400_000).toISOString()
      const nova: RedeSocialStatus =
        rede === 'facebook'
          ? { rede, page_id: '10' + Math.random().toString().slice(2, 16), token_expira_em: expira, conectada: true }
          : { rede, instagram_account_id: '178' + Math.random().toString().slice(2, 16), token_expira_em: expira, conectada: true }
      const idx = db.redesSociais.findIndex((r) => r.rede === rede)
      if (idx >= 0) db.redesSociais[idx] = nova
      else db.redesSociais.push(nova)
      return nova
    })
  },

  async desconectarRede(rede: 'facebook' | 'instagram'): Promise<void> {
    return mutate((db) => {
      db.redesSociais = db.redesSociais.filter((r) => r.rede !== rede)
    })
  },

  // ── DETRAN (BYOF) ────────────────────────────────────────
  async detran(): Promise<CredencialDetran> {
    await delay()
    const db = await getDb()
    return { ...db.detran }
  },

  async salvarDetran(input: DetranInput): Promise<CredencialDetran> {
    await delay(200, 400)
    return mutate((db) => {
      db.detran = { configurada: true, api_url: input.api_url.trim(), ativo: true }
      return { ...db.detran }
    })
  },

  async removerDetran(): Promise<void> {
    return mutate((db) => {
      db.detran = { configurada: false, api_url: null, ativo: false }
    })
  },

  // ── Fiscal / NF-e ────────────────────────────────────────
  async fiscal(): Promise<ConfiguracaoFiscal> {
    await delay()
    const db = await getDb()
    return { ...db.configFiscal }
  },

  async salvarFiscal(input: FiscalInput): Promise<ConfiguracaoFiscal> {
    await delay(200, 400)
    return mutate((db) => {
      db.configFiscal = {
        ...db.configFiscal,
        inscricao_estadual: input.inscricao_estadual?.trim() || null,
        regime_tributario: input.regime_tributario,
        cnae: input.cnae?.trim() || null,
        ambiente: input.ambiente,
        configurada: true,
        ativo: db.configFiscal.certificado_configurado ?? false,
      }
      return { ...db.configFiscal }
    })
  },

  // Certificado — mock: marca configurado com validade +1 ano.
  async enviarCertificado(nomeArquivo: string): Promise<ConfiguracaoFiscal> {
    await delay(500, 900)
    return mutate((db) => {
      db.configFiscal = {
        ...db.configFiscal,
        certificado_configurado: true,
        certificado_validade: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        ativo: db.configFiscal.configurada ?? false,
      }
      return { ...db.configFiscal }
    })
  },
}
