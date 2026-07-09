// Consulta de CEP (ViaCEP) — usada no cadastro de clientes (M059) e no Perfil da
// Loja (M069). Falha silenciosa: retorna null se offline/CEP inválido.

export interface EnderecoCep {
  endereco: string
  bairro: string
  cidade: string
  estado: string
}

export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const limpo = cep.replace(/\D/g, '')
  if (limpo.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return {
      endereco: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      estado: data.uf ?? '',
    }
  } catch {
    return null
  }
}
