import type { VarGroup } from '../components/RichEditor'

/** Catálogo de variáveis do contrato B2B (Social Veículos ↔ Loja).
 *  Deve espelhar as chaves resolvidas pelo backend em
 *  routers/admin.py → resolver_variaveis_contrato_assinatura(). */
export const CATALOGO_VARIAVEIS_ASSINATURA: VarGroup[] = [
  {
    grupo: 'Lojista (contratante)',
    itens: [
      { chave: 'loja.nome', label: 'Razão social' },
      { chave: 'loja.cnpj', label: 'CNPJ' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.cep', label: 'CEP' },
      { chave: 'loja.telefone', label: 'Telefone' },
      { chave: 'loja.email', label: 'E-mail' },
    ],
  },
  {
    grupo: 'Responsável legal',
    itens: [
      { chave: 'responsavel.nome', label: 'Nome' },
      { chave: 'responsavel.email', label: 'E-mail' },
      { chave: 'responsavel.telefone', label: 'Telefone' },
    ],
  },
  {
    grupo: 'Plano',
    itens: [
      { chave: 'plano.nome', label: 'Nome do plano' },
      { chave: 'plano.descricao', label: 'Descrição' },
      { chave: 'plano.modulos', label: 'Módulos inclusos' },
    ],
  },
  {
    grupo: 'Assinatura / Valores',
    itens: [
      { chave: 'assinatura.valor_mensal', label: 'Valor mensal contratado' },
      { chave: 'assinatura.inicio', label: 'Início da vigência' },
      { chave: 'assinatura.proximo_vencimento', label: 'Próximo vencimento' },
      { chave: 'assinatura.dia_vencimento', label: 'Dia do vencimento' },
      { chave: 'assinatura.observacoes', label: 'Observações' },
    ],
  },
  {
    grupo: 'Contratada (Social Veículos)',
    itens: [
      { chave: 'plataforma.nome', label: 'Razão social' },
      { chave: 'plataforma.cnpj', label: 'CNPJ' },
      { chave: 'plataforma.endereco', label: 'Endereço' },
      { chave: 'plataforma.email', label: 'E-mail' },
    ],
  },
  {
    grupo: 'Documento',
    itens: [
      { chave: 'contrato.versao', label: 'Versão' },
      { chave: 'contrato.data', label: 'Data de hoje' },
      { chave: 'contrato.data_aceite', label: 'Data do aceite' },
    ],
  },
]

/** Mapa chave → rótulo (para o RichEditor pintar as pílulas). */
export function labelsDe(groups: VarGroup[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const g of groups) for (const it of g.itens) m[it.chave] = it.label
  return m
}

export const LABELS_VARIAVEIS_ASSINATURA = labelsDe(CATALOGO_VARIAVEIS_ASSINATURA)
