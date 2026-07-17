import type { VarGroup } from '../components/RichEditor'

/** Catálogo de variáveis do sistema disponíveis nos modelos/cabeçalho/rodapé de contrato.
 *  Deve espelhar as chaves resolvidas pelo backend em routers/contratos.py. */
export const CATALOGO_VARIAVEIS: VarGroup[] = [
  {
    grupo: 'Cliente',
    itens: [
      { chave: 'cliente.nome', label: 'Nome' },
      { chave: 'cliente.cpf', label: 'CPF' },
      { chave: 'cliente.rg', label: 'RG' },
      { chave: 'cliente.telefone', label: 'Telefone' },
      { chave: 'cliente.endereco', label: 'Endereço' },
      { chave: 'cliente.cidade', label: 'Cidade' },
      { chave: 'cliente.estado', label: 'Estado' },
    ],
  },
  {
    grupo: 'Veículo',
    itens: [
      { chave: 'veiculo.marca', label: 'Marca' },
      { chave: 'veiculo.modelo', label: 'Modelo' },
      { chave: 'veiculo.versao', label: 'Versão' },
      { chave: 'veiculo.ano_fabricacao', label: 'Ano fabricação' },
      { chave: 'veiculo.ano_modelo', label: 'Ano modelo' },
      { chave: 'veiculo.placa', label: 'Placa' },
      { chave: 'veiculo.cor', label: 'Cor' },
      { chave: 'veiculo.km', label: 'KM' },
      { chave: 'veiculo.combustivel', label: 'Combustível' },
    ],
  },
  {
    grupo: 'Loja',
    itens: [
      { chave: 'loja.nome', label: 'Razão social' },
      { chave: 'loja.cnpj', label: 'CNPJ' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.telefone', label: 'Telefone' },
    ],
  },
  {
    grupo: 'Contrato / Valores',
    itens: [
      { chave: 'contrato.numero', label: 'Número' },
      { chave: 'contrato.data', label: 'Data' },
      { chave: 'contrato.valor_venda', label: 'Valor da venda' },
      { chave: 'contrato.valor_entrada', label: 'Entrada' },
      { chave: 'contrato.parcelas', label: 'Parcelas' },
      { chave: 'contrato.observacoes', label: 'Observações' },
    ],
  },
]

/** Mapa chave → rótulo (para o RichEditor pintar as pílulas). */
export function labelsDe(groups: VarGroup[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const g of groups) for (const it of g.itens) m[it.chave] = it.label
  return m
}
