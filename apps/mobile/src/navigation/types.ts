import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RootStackParamList = {
  Login: undefined
  MainTabs: undefined
  VeiculoDetalhe: { id: string }
  VeiculoForm: { id?: string } | undefined
  LeadDetalhe: { id: string }
  LeadForm: { veiculoId?: string } | undefined
  Conversa: { id: string; nome: string }
  PosVenda: undefined
  EsteiraDetalhe: { id: string }
  Comissoes: undefined
  Financeiro: undefined
  Equipe: undefined
  Simulador: { precoInicial?: number } | undefined
  Configuracoes: undefined
}

export type MainTabsParamList = {
  Inicio: undefined
  Estoque: undefined
  CRM: undefined
  Chat: undefined
  Mais: undefined
}

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
