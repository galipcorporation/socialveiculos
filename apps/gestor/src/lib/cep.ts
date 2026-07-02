import { capitalizarNome } from './mascaras'

export interface ViaCepResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface EnderecoCompleto {
  endereco: string
  bairro: string
  cidade: string
  estado: string
}

export async function buscarCEP(cep: string): Promise<EnderecoCompleto | null> {
  const cepLimpo = cep.replace(/\D/g, '')
  if (cepLimpo.length !== 8) return null

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    if (!res.ok) return null
    
    const data: ViaCepResponse = await res.json()
    if (data.erro) return null

    return {
      endereco: capitalizarNome(data.logradouro),
      bairro: capitalizarNome(data.bairro),
      cidade: capitalizarNome(data.localidade),
      estado: data.uf.toUpperCase()
    }
  } catch (error) {
    console.error('Erro ao buscar CEP:', error)
    return null
  }
}
