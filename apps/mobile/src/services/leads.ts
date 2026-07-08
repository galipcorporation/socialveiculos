import { delay, getDb, mutate, novoId } from './db'
import { LOJA_ID } from './seed'
import type { Cliente, EtapaLead, Interacao, Lead, OrigemLead } from './types'

export interface LeadInput {
  cliente_nome: string
  cliente_telefone?: string
  veiculo_id?: string
  origem: OrigemLead
  valor_proposta?: number
  observacoes?: string
}

function enriquecer(db: Awaited<ReturnType<typeof getDb>>, lead: Lead): Lead {
  return {
    ...lead,
    cliente: db.clientes.find((c) => c.id === lead.cliente_id),
    veiculo: lead.veiculo_id ? db.veiculos.find((v) => v.id === lead.veiculo_id) : undefined,
  }
}

export const leadsService = {
  async listar(): Promise<Lead[]> {
    await delay()
    const db = await getDb()
    return db.leads
      .map((l) => enriquecer(db, l))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  },

  async obter(idLead: string): Promise<Lead> {
    await delay(120, 260)
    const db = await getDb()
    const lead = db.leads.find((l) => l.id === idLead)
    if (!lead) throw new Error('Lead não encontrado.')
    return enriquecer(db, lead)
  },

  async criar(input: LeadInput): Promise<Lead> {
    await delay()
    return mutate((db) => {
      const agora = new Date().toISOString()
      let cliente = db.clientes.find(
        (c) => c.nome.toLowerCase() === input.cliente_nome.trim().toLowerCase()
      )
      if (!cliente) {
        cliente = {
          id: novoId('cli'),
          loja_id: LOJA_ID,
          nome: input.cliente_nome.trim(),
          telefone: input.cliente_telefone,
          created_at: agora,
        } satisfies Cliente
        db.clientes.unshift(cliente)
      }
      const lead: Lead = {
        id: novoId('lead'),
        loja_id: LOJA_ID,
        cliente_id: cliente.id,
        veiculo_id: input.veiculo_id,
        etapa: 'lead',
        origem: input.origem,
        valor_proposta: input.valor_proposta,
        observacoes: input.observacoes,
        interacoes: [
          {
            id: novoId('int'),
            lead_id: '',
            tipo: 'sistema',
            texto: 'Lead criado',
            created_at: agora,
          },
        ],
        created_at: agora,
        updated_at: agora,
      }
      lead.interacoes![0].lead_id = lead.id
      db.leads.unshift(lead)
      return enriquecer(db, lead)
    })
  },

  async moverEtapa(idLead: string, etapa: EtapaLead): Promise<Lead> {
    await delay(150, 300)
    return mutate((db) => {
      const lead = db.leads.find((l) => l.id === idLead)
      if (!lead) throw new Error('Lead não encontrado.')
      const agora = new Date().toISOString()
      lead.etapa = etapa
      lead.updated_at = agora
      lead.interacoes = lead.interacoes ?? []
      lead.interacoes.push({
        id: novoId('int'),
        lead_id: lead.id,
        tipo: 'sistema',
        texto: `Etapa alterada para "${etiquetaEtapa(etapa)}"`,
        created_at: agora,
      })
      return enriquecer(db, lead)
    })
  },

  async adicionarInteracao(idLead: string, tipo: Interacao['tipo'], texto: string): Promise<Lead> {
    await delay(150, 300)
    return mutate((db) => {
      const lead = db.leads.find((l) => l.id === idLead)
      if (!lead) throw new Error('Lead não encontrado.')
      const agora = new Date().toISOString()
      lead.interacoes = lead.interacoes ?? []
      lead.interacoes.push({
        id: novoId('int'),
        lead_id: lead.id,
        tipo,
        texto,
        autor: 'Você',
        created_at: agora,
      })
      lead.updated_at = agora
      return enriquecer(db, lead)
    })
  },

  async atualizarProposta(idLead: string, valor: number | undefined, observacoes?: string): Promise<Lead> {
    await delay(150, 300)
    return mutate((db) => {
      const lead = db.leads.find((l) => l.id === idLead)
      if (!lead) throw new Error('Lead não encontrado.')
      lead.valor_proposta = valor
      if (observacoes !== undefined) lead.observacoes = observacoes
      lead.updated_at = new Date().toISOString()
      return enriquecer(db, lead)
    })
  },
}

function etiquetaEtapa(etapa: EtapaLead): string {
  const map: Record<EtapaLead, string> = {
    lead: 'Novo',
    proposta: 'Proposta',
    negociacao: 'Negociação',
    fechamento: 'Fechamento',
    perdido: 'Perdido',
  }
  return map[etapa]
}
