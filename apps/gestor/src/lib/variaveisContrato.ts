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
      { chave: 'cliente.email', label: 'E-mail' },
      { chave: 'cliente.endereco', label: 'Endereço' },
      { chave: 'cliente.cidade', label: 'Cidade' },
      { chave: 'cliente.estado', label: 'Estado' },
      { chave: 'cliente.nacionalidade', label: 'Nacionalidade' },
      { chave: 'cliente.estado_civil', label: 'Estado civil' },
      { chave: 'cliente.profissao', label: 'Profissão' },
      { chave: 'cliente.cnh', label: 'CNH' },
      { chave: 'cliente.cnh_categoria', label: 'Categoria CNH' },
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
      { chave: 'veiculo.chassi', label: 'Chassi' },
      { chave: 'veiculo.renavam', label: 'RENAVAM' },
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
      { chave: 'loja.inscricao_estadual', label: 'Inscrição estadual' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.cep', label: 'CEP' },
      { chave: 'loja.telefone', label: 'Telefone' },
      { chave: 'loja.email', label: 'E-mail' },
      { chave: 'loja.representante_nome', label: 'Representante legal' },
      { chave: 'loja.representante_cpf', label: 'CPF do representante' },
      { chave: 'loja.representante_rg', label: 'RG do representante' },
    ],
  },
  {
    grupo: 'Contrato / Valores',
    itens: [
      { chave: 'contrato.numero', label: 'Número' },
      { chave: 'contrato.data', label: 'Data' },
      { chave: 'contrato.data_extenso', label: 'Data por extenso' },
      { chave: 'contrato.valor_venda', label: 'Valor da venda' },
      { chave: 'contrato.valor_venda_extenso', label: 'Valor da venda por extenso' },
      { chave: 'contrato.valor_entrada', label: 'Entrada' },
      { chave: 'contrato.valor_entrada_extenso', label: 'Entrada por extenso' },
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
