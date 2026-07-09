import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RootStackParamList = {
  EscolhaExperiencia: undefined
  Vitrine: undefined
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
  PerfilLoja: undefined
  CredenciaisBanco: undefined
  CredenciaisIA: undefined
  RedesSociais: undefined
  Detran: undefined
  Fiscal: undefined
  Fipe: undefined
  Contratos: undefined
  NotasFiscais: undefined
  MeuSite: undefined
  RedeSocial: undefined
  Marketing: undefined
  AssistenteIA: undefined
}

export type MainTabsParamList = {
  Inicio: undefined
  Estoque: undefined
  CRM: undefined
  Chat: undefined
  Mais: undefined
}

// ── Vitrine B2C (comprador) ──
export type VitrineStackParamList = {
  VitrineTabs: undefined
  CarroDetalhe: { id: string }
  PerfilLoja: { id: string }
  ConversaVitrine: { id: string; nome: string }
}

export type VitrineTabsParamList = {
  Feed: undefined
  Buscar: undefined
  Mensagens: undefined
  Perfil: undefined
}

export type VitrineScreenProps<T extends keyof VitrineStackParamList> = NativeStackScreenProps<
  VitrineStackParamList,
  T
>

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
