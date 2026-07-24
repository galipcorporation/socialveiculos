import { api } from '../lib/api'
import type { Membro, Papel } from './types'
import { MODULOS_BASE } from '../lib/modulos'

export interface MembroInput {
  nome: string
  email: string
  telefone?: string
  papel: Papel
  percentual_comissao?: number | null
  modulos?: string
  senha?: string
}

interface MembroDTO {
  id: string
  usuario_id: string
  nome: string
  email: string
  telefone?: string | null
  papel: Papel
  modulos?: string | null
  percentual_comissao?: number | null
  ativo: boolean
  created_at: string
}

function mapMembro(m: MembroDTO): Membro {
  return {
    id: m.id,
    nome: m.nome,
    email: m.email,
    telefone: m.telefone ?? undefined,
    papel: m.papel,
    ativo: m.ativo,
    percentual_comissao: m.percentual_comissao ?? null,
    modulos: m.modulos ?? undefined,
    created_at: m.created_at,
  }
}

export const equipeService = {
  async listar(): Promise<Membro[]> {
    const data = await api.get<MembroDTO[]>('/equipe')
    return data.map(mapMembro).sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
      if (a.papel !== b.papel) return a.papel === 'gestor' ? -1 : 1
      return a.nome.localeCompare(b.nome)
    })
  },

  async criar(input: MembroInput): Promise<Membro> {
    const m = await api.post<MembroDTO>('/equipe', {
      nome: input.nome,
      email: input.email,
      telefone: input.telefone || null,
      papel: input.papel,
      senha: input.senha,
      percentual_comissao: input.papel === 'vendedor' ? input.percentual_comissao ?? 0 : null,
      // A tela envia a lista já filtrada pelos módulos contratados pela loja.
      // O fallback fica no núcleo do CRM: pedir um premium não contratado
      // faria o backend recusar o convite inteiro com 400.
      modulos: input.modulos ?? JSON.stringify(input.papel === 'gestor' ? MODULOS_BASE : []),
    })
    return mapMembro(m)
  },

  async atualizar(idMembro: string, input: Partial<MembroInput>): Promise<Membro> {
    const m = await api.patch<MembroDTO>(`/equipe/${idMembro}`, input)
    return mapMembro(m)
  },

  async alternarAtivo(idMembro: string): Promise<Membro> {
    // Precisa do estado atual para inverter.
    const atuais = await this.listar()
    const atual = atuais.find((m) => m.id === idMembro)
    const m = await api.patch<MembroDTO>(`/equipe/${idMembro}`, { ativo: !(atual?.ativo ?? true) })
    return mapMembro(m)
  },

  async excluir(idMembro: string): Promise<void> {
    await api.delete(`/equipe/${idMembro}`)
  },

  async configurarIA(idMembro: string, input: { ativo: boolean; autonomia: 'copiloto' | 'automatico' }): Promise<Membro> {
    // O endpoint de assistente usa o usuario_id do membro.
    const atuais = await this.listar()
    const atual = atuais.find((m) => m.id === idMembro)
    await api.put(`/equipe/${idMembro}/assistente`, {
      pode_usar: input.ativo,
      autonomia_default: input.autonomia,
    }).catch(() => {})
    return atual
      ? { ...atual, assistente_ativo: input.ativo, assistente_autonomia: input.autonomia }
      : mapMembro({ id: idMembro } as MembroDTO)
  },
}
