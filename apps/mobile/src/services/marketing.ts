// Marketing IA (M056) — geração de legenda/post a partir de um veículo.
// MOCK: monta o texto por template determinístico (sem LLM). O app real chamaria
// o backend de Marketing (Claude opus-4-8, ver memória stack-ia-assistente-vs-marketing).

import { delay } from './db'
import type { Veiculo } from './types'
import { formatBRL, formatKm } from '../lib/format'

export type TomMarketing = 'entusiasmado' | 'sofisticado' | 'direto'

export const TONS_MARKETING: { value: TomMarketing; label: string }[] = [
  { value: 'entusiasmado', label: 'Entusiasmado' },
  { value: 'sofisticado', label: 'Sofisticado' },
  { value: 'direto', label: 'Direto ao ponto' },
]

const EMOJIS = ['🚗', '🔥', '✨', '🏁', '💥', '🚀']

function hashtags(v: Veiculo): string {
  const tags = [v.marca, v.modelo, 'seminovos', 'carros', 'autopremium']
    .map((t) => '#' + t.replace(/\s+/g, '').toLowerCase())
  return tags.join(' ')
}

export const marketingService = {
  async gerarLegenda(v: Veiculo, tom: TomMarketing): Promise<string> {
    await delay(600, 1200) // simula a chamada de IA
    const nome = `${v.marca} ${v.modelo}${v.versao ? ' ' + v.versao : ''}`
    const preco = v.preco_venda ? formatBRL(v.preco_venda) : 'preço sob consulta'
    const km = v.km != null ? formatKm(v.km) : null
    const detalhes = [v.ano_modelo, km, v.cor, v.cambio].filter(Boolean).join(' · ')
    const e = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]

    let corpo: string
    if (tom === 'sofisticado') {
      corpo = `Apresentamos o ${nome}. Requinte, procedência e desempenho em um só carro.\n\n${detalhes}\n\nValor: ${preco}. Agende sua avaliação presencial.`
    } else if (tom === 'direto') {
      corpo = `${nome} ${e}\n${detalhes}\nPor ${preco}. Chama no WhatsApp que a gente fecha.`
    } else {
      corpo = `${e} CHEGOU NA LOJA: ${nome}! Um baita carro esperando por você ${e}\n\n${detalhes}\n\n👉 ${preco} — condições especiais de financiamento. Vem test drive!`
    }
    return `${corpo}\n\n${hashtags(v)}`
  },
}
