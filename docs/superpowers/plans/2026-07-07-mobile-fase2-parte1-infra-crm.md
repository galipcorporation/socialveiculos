# Mobile Fase 2 — Parte 1: Infra Compartilhada + CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar as libs compartilhadas do gestor web (máscaras, CEP, regras de veículo, módulos) e o `uiStore` para `apps/mobile`, e implementar o módulo CRM completo (Kanban por abas, detalhe de lead, negociações, CRUD de clientes) substituindo o placeholder `CrmScreen.tsx`.

**Architecture:** Duplicação de lógica pura (sem DOM) das libs `apps/gestor/src/lib/{mascaras,cep,veiculo,modulos}.ts` para `apps/mobile/src/lib/`, sem alteração de comportamento. `uiStore` do mobile reimplementa a mesma interface (`showToast`, `showError`, `confirm`) usando `Alert.alert` do React Native para confirmação e um componente `Toast` renderizado no topo da árvore. CRM ganha um native-stack próprio dentro da aba (Kanban → Detalhe do Lead ↔ Form de Lead / Clientes → Form de Cliente), com o Kanban usando abas de estágio (sem drag-and-drop) e "Avançar estágio" / "Mover para" chamando o mesmo endpoint `PATCH /leads/{id}/etapa` do web.

**Tech Stack:** React Native 0.86 + Expo ~57, TypeScript ~6.0, zustand 5, @react-navigation (native-stack), sem novas dependências nesta parte.

## Global Constraints

- Não modificar nenhum arquivo em `apps/gestor` — portabilidade por duplicação (decisão de [[m045-mobile-fase1-design]] e [[m045-mobile-fase2-design]]).
- Sem `packages/shared` nesta fase.
- Sem etapa de mockup HTML prévio — implementar direto em React Native (decisão do usuário nesta sessão).
- Máscaras de CPF/CNPJ/telefone/moeda/CEP aplicadas em todo campo relevante; responsividade (safe area, teclado não sobrepõe campo); confirmações destrutivas via `Alert.alert` nativo; ícones de um único set (`@expo/vector-icons`, já embutido no Expo, não requer instalação adicional).
- Credencial de teste: `gestor@autopremium.com.br` / `demo123`.
- Cor de fundo padrão das telas do app: `#0B0F1A` (already used in Fase 1 — manter consistência).

---

### Task 1: Portar `lib/mascaras.ts`, `lib/cep.ts`, `lib/veiculo.ts`, `lib/modulos.ts`

**Files:**
- Create: `apps/mobile/src/lib/mascaras.ts`
- Create: `apps/mobile/src/lib/cep.ts`
- Create: `apps/mobile/src/lib/veiculo.ts`
- Create: `apps/mobile/src/lib/modulos.ts`

**Interfaces:**
- Consumes: nada (funções puras, `fetch` global disponível em RN).
- Produces: `mascararCPF`, `mascararCNPJ`, `mascararTelefone`, `mascararMoeda`, `parseMoeda`, `mascararCEP`, `mascararRG`, `mascararData`, `sanitizarTexto`, `validarCPF`, `validarCNPJ`, `capitalizarNome`, `UFS_VALIDAS` de `mascaras.ts`; `buscarCEP(cep: string): Promise<EnderecoCompleto | null>` de `cep.ts`; `Veiculo`, `Midia`, `TIPOS_VEICULO`, `REGRAS_TIPO`, `regraDoTipo`, `ANOS`, `ANO_MODELO_PAIRS`, `AnoModeloPair` de `veiculo.ts`; `ModuloKey`, `MODULOS`, `TODOS_MODULOS`, `parseModulos`, `podeAcessarModulo` de `modulos.ts`. Todas usadas pelo CRM (Task 2+) e por fases futuras (Estoque/Equipe).

- [ ] **Step 1: Copiar `mascaras.ts` do gestor sem alterações de lógica**

Copie o conteúdo integral de `apps/gestor/src/lib/mascaras.ts` para `apps/mobile/src/lib/mascaras.ts` (mesmo conteúdo, é código puro sem dependência de DOM — nenhuma adaptação necessária).

- [ ] **Step 2: Copiar `cep.ts` do gestor sem alterações**

Copie o conteúdo integral de `apps/gestor/src/lib/cep.ts` para `apps/mobile/src/lib/cep.ts`. Usa `fetch` global e `capitalizarNome` de `./mascaras` — ambos disponíveis em RN sem adaptação.

- [ ] **Step 3: Copiar `veiculo.ts` do gestor sem alterações**

Copie o conteúdo integral de `apps/gestor/src/lib/veiculo.ts` para `apps/mobile/src/lib/veiculo.ts`. Código puro, sem DOM.

- [ ] **Step 4: Copiar `modulos.ts` do gestor sem alterações**

Copie o conteúdo integral de `apps/gestor/src/lib/modulos.ts` para `apps/mobile/src/lib/modulos.ts`. Código puro, sem DOM.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/mascaras.ts apps/mobile/src/lib/cep.ts apps/mobile/src/lib/veiculo.ts apps/mobile/src/lib/modulos.ts
git commit -m "feat(mobile): port mascaras, cep, veiculo and modulos libs from gestor"
```

---

### Task 2: `uiStore` — toast e confirm nativos

**Files:**
- Create: `apps/mobile/src/stores/uiStore.ts`
- Create: `apps/mobile/src/components/ToastHost.tsx`
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `create` de `zustand`; `Alert` de `react-native`.
- Produces:
  - `useUIStore` — hook zustand `{ toasts: Toast[]; showToast(message: string, type?: Toast['type']): void; showError(message: string, details?: ToastDetails): void; removeToast(id: string): void; confirm(options: ConfirmOptions): Promise<boolean> }`, onde `Toast = { id: string; message: string; type: 'success'|'warning'|'error'|'info'; details?: ToastDetails }`, `ToastDetails = { status?: number; path?: string; timestamp?: string; requestId?: string }`, `ConfirmOptions = { title?: string; message: string; confirmText?: string; cancelText?: string }`.
  - `ToastHost` — componente default export, sem props, renderiza os toasts ativos empilhados no topo da tela; deve ser montado uma única vez em `App.tsx`.
  - Usado por todas as telas de CRM/Estoque/Chat/etc a partir daqui.

- [ ] **Step 1: Criar `uiStore.ts` com toast (zustand) e confirm via `Alert.alert`**

```typescript
// apps/mobile/src/stores/uiStore.ts
import { create } from 'zustand'
import { Alert } from 'react-native'

export interface ToastDetails {
  status?: number
  path?: string
  timestamp?: string
  requestId?: string
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
  details?: ToastDetails
}

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

interface UIState {
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type']) => void
  showError: (message: string, details?: ToastDetails) => void
  removeToast: (id: string) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],

  showToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },

  showError: (message, details) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({ toasts: [...state.toasts, { id, message, type: 'error', details }] }))
    setTimeout(() => get().removeToast(id), details ? 8000 : 4000)
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        options.title || 'Confirmar Ação',
        options.message,
        [
          { text: options.cancelText || 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: options.confirmText || 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      )
    })
  },
}))
```

- [ ] **Step 2: Criar `ToastHost.tsx`**

```typescript
// apps/mobile/src/components/ToastHost.tsx
import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useUIStore, type Toast } from '../stores/uiStore'

const COLORS: Record<Toast['type'], string> = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
}

export default function ToastHost() {
  const toasts = useUIStore((state) => state.toasts)
  const removeToast = useUIStore((state) => state.removeToast)

  if (toasts.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <Pressable
          key={toast.id}
          style={[styles.toast, { borderLeftColor: COLORS[toast.type] }]}
          onPress={() => removeToast(toast.id)}
        >
          <Text style={styles.message}>{toast.message}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  message: {
    color: '#fff',
    fontSize: 14,
  },
})
```

- [ ] **Step 3: Montar `ToastHost` em `App.tsx`**

Ler `apps/mobile/App.tsx` primeiro (arquivo pequeno, da Fase 1) e adicionar `<ToastHost />` dentro do `SafeAreaProvider`, junto ao `RootNavigator`:

```typescript
// apps/mobile/App.tsx
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import ToastHost from './src/components/ToastHost';

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
      <ToastHost />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/stores/uiStore.ts apps/mobile/src/components/ToastHost.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): add uiStore (toast + confirm) with native Alert"
```

---

### Task 3: Tipos e cliente de dados do CRM (`lib/crm.ts`)

**Files:**
- Create: `apps/mobile/src/lib/crm.ts`

**Interfaces:**
- Consumes: `api` de `../lib/api` (Fase 1).
- Produces: tipos `ClienteSimples`, `Negociacao`, `Lead`, `KanbanColumn`, `KanbanBoardResponse`, `Cliente`, `VeiculoResumoCRM`; funções `buscarKanban(): Promise<KanbanBoardResponse>`, `moverEtapaLead(leadId: string, etapa: Lead['etapa']): Promise<void>`, `buscarLead(leadId: string): Promise<Lead>`, `criarLead(body: { cliente_id: string; veiculo_id?: string; etapa?: Lead['etapa']; valor_proposta?: number; observacoes?: string }): Promise<Lead>`, `excluirLead(leadId: string): Promise<void>`, `listarNegociacoes(leadId: string): Promise<Negociacao[]>`, `criarNegociacao(leadId: string, body: Omit<Negociacao, 'id'|'lead_id'|'created_at'|'updated_at'>): Promise<Negociacao>`, `listarClientes(params?: { q?: string }): Promise<Cliente[]>`, `buscarCliente(id: string): Promise<Cliente>`, `criarCliente(body: Omit<Cliente, 'id'|'loja_id'|'created_at'|'updated_at'>): Promise<Cliente>`, `editarCliente(id: string, body: Partial<Cliente>): Promise<Cliente>`, `excluirCliente(id: string): Promise<void>`, `buscarVeiculosCRM(params?: { q?: string }): Promise<VeiculoResumoCRM[]>`. Usado pelas telas das Tasks 4-7.

- [ ] **Step 1: Criar `lib/crm.ts` com tipos e funções de acesso à API**

```typescript
// apps/mobile/src/lib/crm.ts
import { api } from './api'

export interface ClienteSimples {
  id: string
  nome: string
  telefone?: string
}

export interface Negociacao {
  id: string
  lead_id: string
  veiculo_id?: string
  valor_proposta?: number
  valor_entrada?: number
  parcelas?: number
  observacoes?: string
  created_at: string
  updated_at: string
}

export type EtapaLead = 'lead' | 'proposta' | 'negociacao' | 'fechamento' | 'perdido'

export interface Lead {
  id: string
  loja_id: string
  cliente_id: string
  veiculo_id?: string
  etapa: EtapaLead
  origem: 'manual' | 'vitrine' | 'simulador' | 'whatsapp'
  valor_proposta?: number
  observacoes?: string
  cliente?: ClienteSimples
  negociacoes?: Negociacao[]
  created_at: string
  updated_at: string
}

export interface KanbanColumn {
  etapa: EtapaLead
  total: number
  leads: Lead[]
}

export interface KanbanBoardResponse {
  colunas: KanbanColumn[]
}

export interface Cliente {
  id: string
  loja_id: string
  usuario_id?: string
  nome: string
  cpf?: string
  cnpj?: string
  rg?: string
  data_nascimento?: string
  telefone?: string
  email?: string
  renda_mensal?: number
  cep?: string
  endereco?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
  tags?: string
  created_at: string
  updated_at: string
}

export interface VeiculoResumoCRM {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_modelo: number
  preco_venda?: number
}

export const ETAPAS_LEAD: { value: EtapaLead; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'perdido', label: 'Perdido' },
]

export function buscarKanban(): Promise<KanbanBoardResponse> {
  return api.get<KanbanBoardResponse>('/leads/kanban')
}

export function moverEtapaLead(leadId: string, etapa: EtapaLead): Promise<void> {
  return api.patch(`/leads/${leadId}/etapa`, { etapa })
}

export function buscarLead(leadId: string): Promise<Lead> {
  return api.get<Lead>(`/leads/${leadId}`)
}

export function criarLead(body: {
  cliente_id: string
  veiculo_id?: string
  etapa?: EtapaLead
  valor_proposta?: number
  observacoes?: string
}): Promise<Lead> {
  return api.post<Lead>('/leads', body)
}

export function excluirLead(leadId: string): Promise<void> {
  return api.delete(`/leads/${leadId}`)
}

export function listarNegociacoes(leadId: string): Promise<Negociacao[]> {
  return api.get<Negociacao[]>(`/leads/${leadId}/negociacoes`)
}

export function criarNegociacao(
  leadId: string,
  body: Omit<Negociacao, 'id' | 'lead_id' | 'created_at' | 'updated_at'>
): Promise<Negociacao> {
  return api.post<Negociacao>(`/leads/${leadId}/negociacoes`, body)
}

export function listarClientes(params?: { q?: string }): Promise<Cliente[]> {
  return api.get<Cliente[]>('/clientes', params as Record<string, string> | undefined)
}

export function buscarCliente(id: string): Promise<Cliente> {
  return api.get<Cliente>(`/clientes/${id}`)
}

export function criarCliente(
  body: Omit<Cliente, 'id' | 'loja_id' | 'created_at' | 'updated_at'>
): Promise<Cliente> {
  return api.post<Cliente>('/clientes', body)
}

export function editarCliente(id: string, body: Partial<Cliente>): Promise<Cliente> {
  return api.patch<Cliente>(`/clientes/${id}`, body)
}

export function excluirCliente(id: string): Promise<void> {
  return api.delete(`/clientes/${id}`)
}

export function buscarVeiculosCRM(params?: { q?: string }): Promise<VeiculoResumoCRM[]> {
  return api
    .get<{ items: VeiculoResumoCRM[] }>('/veiculos', params as Record<string, string> | undefined)
    .then((res) => res.items)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/crm.ts
git commit -m "feat(mobile): add CRM data layer (types + API calls)"
```

---

### Task 8: Navegação interna do CRM (`CrmNavigator`)

**Files:**
- Create: `apps/mobile/src/navigation/CrmNavigator.tsx`
- Modify: `apps/mobile/src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: `createNativeStackNavigator` de `@react-navigation/native-stack`; telas das Tasks 4-7 (`LeadsKanbanScreen`, `LeadDetalheScreen`, `LeadFormScreen`, `ClientesListScreen`, `ClienteFormScreen`).
- Produces: `CrmNavigator` — componente default export, monta o stack interno do CRM; `CrmStackParamList` — tipo exportado usado pelas telas para tipar `useNavigation`/`useRoute`.

Esta task roda depois de todas as telas (Tasks 4-7) já existirem, para não ter imports quebrados no `CrmNavigator`. As telas usam `useNavigation<any>()`/`useRoute<any>()` deliberadamente (sem depender de `CrmStackParamList`), então nenhuma delas precisa ser revisitada depois que este arquivo é criado — a navegação funciona em runtime independente da ordem em que os tipos de rota foram declarados.

- [ ] **Step 1: Criar `CrmNavigator.tsx`**

```typescript
// apps/mobile/src/navigation/CrmNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LeadsKanbanScreen from '../screens/crm/LeadsKanbanScreen'
import LeadDetalheScreen from '../screens/crm/LeadDetalheScreen'
import LeadFormScreen from '../screens/crm/LeadFormScreen'
import ClientesListScreen from '../screens/crm/ClientesListScreen'
import ClienteFormScreen from '../screens/crm/ClienteFormScreen'

export type CrmStackParamList = {
  LeadsKanban: undefined
  LeadDetalhe: { leadId: string }
  LeadForm: undefined
  ClientesList: undefined
  ClienteForm: { clienteId?: string }
}

const Stack = createNativeStackNavigator<CrmStackParamList>()

export default function CrmNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="LeadsKanban" component={LeadsKanbanScreen} options={{ title: 'CRM' }} />
      <Stack.Screen name="LeadDetalhe" component={LeadDetalheScreen} options={{ title: 'Lead' }} />
      <Stack.Screen name="LeadForm" component={LeadFormScreen} options={{ title: 'Novo Lead' }} />
      <Stack.Screen name="ClientesList" component={ClientesListScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="ClienteForm" component={ClienteFormScreen} options={{ title: 'Cliente' }} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Atualizar `MainTabs.tsx` para usar `CrmNavigator` no lugar de `CrmScreen`**

Ler `apps/mobile/src/navigation/MainTabs.tsx` (Fase 1) antes de editar. Trocar o import e uso de `CrmScreen` por `CrmNavigator`, e adicionar `headerShown: false` na tab do CRM (o header já vem do stack interno):

```typescript
// apps/mobile/src/navigation/MainTabs.tsx (diff conceitual — aplicar via Edit)
import CrmNavigator from './CrmNavigator'
// ...
<Tab.Screen name="CRM" component={CrmNavigator} options={{ headerShown: false }} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros (assumindo Tasks 4-7 já aplicadas).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/CrmNavigator.tsx apps/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): wire CRM stack navigator into main tabs"
```

---

### Task 4: Tela `LeadsKanbanScreen` (abas de estágio + lista de cards)

**Files:**
- Create: `apps/mobile/src/screens/crm/LeadsKanbanScreen.tsx`
- Create: `apps/mobile/src/components/LeadCard.tsx`

**Interfaces:**
- Consumes: `buscarKanban`, `moverEtapaLead`, `ETAPAS_LEAD`, tipos `Lead`/`EtapaLead`/`KanbanColumn` de `../../lib/crm`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`. Navegação via `useNavigation<any>()` — deliberadamente não tipada por `CrmStackParamList`, que só é criado na Task 8 (depois de todas as telas); a navegação é validada em runtime pelos testes manuais da Task 9.
- Produces: `LeadsKanbanScreen` — default export, tela raiz do CRM; `LeadCard` — componente reutilizável `{ lead: Lead; onAvancar(): void; onMover(etapa: EtapaLead): void; onPress(): void }`.

- [ ] **Step 1: Criar `LeadCard.tsx`**

```typescript
// apps/mobile/src/components/LeadCard.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ETAPAS_LEAD, type Lead, type EtapaLead } from '../lib/crm'

interface LeadCardProps {
  lead: Lead
  onAvancar: () => void
  onMover: (etapa: EtapaLead) => void
  onPress: () => void
}

const PROXIMA_ETAPA: Record<EtapaLead, EtapaLead | null> = {
  lead: 'proposta',
  proposta: 'negociacao',
  negociacao: 'fechamento',
  fechamento: null,
  perdido: null,
}

export default function LeadCard({ lead, onAvancar, onMover, onPress }: LeadCardProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const proxima = PROXIMA_ETAPA[lead.etapa]

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.nome} numberOfLines={1}>{lead.cliente?.nome || 'Sem nome'}</Text>
        <Pressable hitSlop={8} onPress={() => setMenuAberto(true)}>
          <Ionicons name="ellipsis-vertical" size={18} color="#9AA5B1" />
        </Pressable>
      </View>
      {lead.cliente?.telefone ? <Text style={styles.sub}>{lead.cliente.telefone}</Text> : null}
      {lead.valor_proposta ? (
        <Text style={styles.valor}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.valor_proposta)}
        </Text>
      ) : null}
      {proxima ? (
        <Pressable style={styles.avancarBtn} onPress={onAvancar}>
          <Text style={styles.avancarText}>Avançar</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      ) : null}

      <Modal visible={menuAberto} transparent animationType="fade" onRequestClose={() => setMenuAberto(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuAberto(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitulo}>Mover para</Text>
            {ETAPAS_LEAD.filter((e) => e.value !== lead.etapa).map((e) => (
              <Pressable
                key={e.value}
                style={styles.menuItem}
                onPress={() => {
                  setMenuAberto(false)
                  onMover(e.value)
                }}
              >
                <Text style={styles.menuItemText}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  sub: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  valor: { color: '#3B82F6', fontSize: 14, fontWeight: '600', marginTop: 6 },
  avancarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingVertical: 8,
    marginTop: 10,
  },
  avancarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menu: { backgroundColor: '#151B29', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  menuTitulo: { color: '#9AA5B1', fontSize: 13, marginBottom: 8 },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A3345' },
  menuItemText: { color: '#fff', fontSize: 16 },
})
```

- [ ] **Step 2: Criar `LeadsKanbanScreen.tsx`**

```typescript
// apps/mobile/src/screens/crm/LeadsKanbanScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { buscarKanban, moverEtapaLead, ETAPAS_LEAD, type Lead, type EtapaLead, type KanbanColumn } from '../../lib/crm'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import LeadCard from '../../components/LeadCard'

const PROXIMA_ETAPA: Record<EtapaLead, EtapaLead | null> = {
  lead: 'proposta',
  proposta: 'negociacao',
  negociacao: 'fechamento',
  fechamento: null,
  perdido: null,
}

export default function LeadsKanbanScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const [colunas, setColunas] = useState<KanbanColumn[]>([])
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaLead>('lead')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await buscarKanban()
      setColunas(data.colunas)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const onRefresh = () => {
    setRefreshing(true)
    carregar()
  }

  const moverLead = async (lead: Lead, etapa: EtapaLead) => {
    const anterior = colunas
    setColunas((cols) =>
      cols.map((c) => ({
        ...c,
        leads: c.etapa === lead.etapa ? c.leads.filter((l) => l.id !== lead.id) : c.leads,
      }))
    )
    try {
      await moverEtapaLead(lead.id, etapa)
      showToast('Lead movido.', 'success')
      carregar()
    } catch (err) {
      setColunas(anterior)
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const colunaAtual = colunas.find((c) => c.etapa === etapaAtiva)
  const leads = colunaAtual?.leads ?? []

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {ETAPAS_LEAD.map((e) => {
          const total = colunas.find((c) => c.etapa === e.value)?.total ?? 0
          const ativa = e.value === etapaAtiva
          return (
            <Pressable key={e.value} style={[styles.tab, ativa && styles.tabAtiva]} onPress={() => setEtapaAtiva(e.value)}>
              <Text style={[styles.tabText, ativa && styles.tabTextAtiva]}>{e.label}</Text>
              {total > 0 ? <Text style={styles.tabBadge}>{total}</Text> : null}
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#3B82F6" />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum lead nesta etapa.</Text>}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              onPress={() => navigation.navigate('LeadDetalhe', { leadId: item.id })}
              onAvancar={() => {
                const proxima = PROXIMA_ETAPA[item.etapa]
                if (proxima) moverLead(item, proxima)
              }}
              onMover={(etapa) => moverLead(item, etapa)}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('LeadForm')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#151B29',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  tabAtiva: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tabText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  tabTextAtiva: { color: '#fff' },
  tabBadge: { color: '#fff', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 6 },
  lista: { padding: 16, paddingBottom: 100 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: erros esperados de módulos ainda inexistentes (`LeadDetalhe`, `LeadForm` via navigation — como `navigation` é tipado `any` aqui, não deve gerar erro de tipo; erros só aparecerão se `../../lib/crm` ou `../../stores/uiStore` estiverem ausentes — ambos já existem das Tasks 2-3). Se der erro, verificar se Tasks 2 e 3 foram aplicadas antes desta.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/crm/LeadsKanbanScreen.tsx apps/mobile/src/components/LeadCard.tsx
git commit -m "feat(mobile): add CRM kanban screen with stage tabs"
```

---

### Task 5: Tela `LeadDetalheScreen` + `LeadFormScreen`

**Files:**
- Create: `apps/mobile/src/screens/crm/LeadDetalheScreen.tsx`
- Create: `apps/mobile/src/screens/crm/LeadFormScreen.tsx`

**Interfaces:**
- Consumes: `buscarLead`, `criarLead`, `excluirLead`, `listarNegociacoes`, `criarNegociacao`, `listarClientes`, `buscarVeiculosCRM`, tipos `Lead`/`Negociacao`/`Cliente`/`VeiculoResumoCRM` de `../../lib/crm`; `mascararMoeda`, `parseMoeda` de `../../lib/mascaras`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `LeadDetalheScreen` — default export, recebe `leadId` via route params; `LeadFormScreen` — default export, cria lead novo (busca cliente/veículo por autocomplete simples de lista filtrada).

- [ ] **Step 1: Criar `LeadDetalheScreen.tsx`**

```typescript
// apps/mobile/src/screens/crm/LeadDetalheScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { buscarLead, listarNegociacoes, criarNegociacao, excluirLead, type Lead, type Negociacao } from '../../lib/crm'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

function formatarMoeda(valor?: number): string {
  if (!valor) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export default function LeadDetalheScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { leadId } = route.params as { leadId: string }
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [lead, setLead] = useState<Lead | null>(null)
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([])
  const [loading, setLoading] = useState(true)
  const [novaProposta, setNovaProposta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [leadData, negs] = await Promise.all([buscarLead(leadId), listarNegociacoes(leadId)])
      setLead(leadData)
      setNegociacoes(negs)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [leadId, showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const registrarProposta = async () => {
    const valor = parseMoeda(novaProposta)
    if (!valor) {
      showError('Informe um valor de proposta válido.')
      return
    }
    setEnviando(true)
    try {
      await criarNegociacao(leadId, { valor_proposta: valor })
      setNovaProposta('')
      showToast('Proposta registrada.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setEnviando(false)
    }
  }

  const excluir = async () => {
    const ok = await confirm({ title: 'Excluir lead', message: 'Tem certeza que deseja excluir este lead?' })
    if (!ok) return
    try {
      await excluirLead(leadId)
      showToast('Lead excluído.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  if (loading || !lead) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.nome}>{lead.cliente?.nome}</Text>
      {lead.cliente?.telefone ? <Text style={styles.sub}>{lead.cliente.telefone}</Text> : null}
      <Text style={styles.etapa}>Etapa: {lead.etapa}</Text>
      {lead.valor_proposta ? <Text style={styles.valor}>{formatarMoeda(lead.valor_proposta)}</Text> : null}
      {lead.observacoes ? <Text style={styles.obs}>{lead.observacoes}</Text> : null}

      <Text style={styles.secaoTitulo}>Histórico de negociações</Text>
      {negociacoes.length === 0 ? (
        <Text style={styles.vazio}>Nenhuma negociação registrada ainda.</Text>
      ) : (
        negociacoes.map((n) => (
          <View key={n.id} style={styles.negociacaoItem}>
            <Text style={styles.negociacaoValor}>{formatarMoeda(n.valor_proposta)}</Text>
            <Text style={styles.negociacaoData}>{new Date(n.created_at).toLocaleDateString('pt-BR')}</Text>
          </View>
        ))
      )}

      <Text style={styles.secaoTitulo}>Registrar nova proposta</Text>
      <View style={styles.novaPropostaRow}>
        <TextInput
          style={styles.input}
          placeholder="R$ 0,00"
          placeholderTextColor="#5B6472"
          keyboardType="numeric"
          value={novaProposta}
          onChangeText={(v) => setNovaProposta(mascararMoeda(v))}
        />
        <Pressable style={styles.botaoSalvar} onPress={registrarProposta} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>Salvar</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.botaoExcluir} onPress={excluir}>
        <Text style={styles.botaoExcluirText}>Excluir lead</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  content: { padding: 20, paddingBottom: 60 },
  nome: { color: '#fff', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9AA5B1', fontSize: 15, marginTop: 4 },
  etapa: { color: '#3B82F6', fontSize: 14, fontWeight: '600', marginTop: 8, textTransform: 'capitalize' },
  valor: { color: '#10B981', fontSize: 18, fontWeight: '700', marginTop: 8 },
  obs: { color: '#9AA5B1', fontSize: 14, marginTop: 12 },
  secaoTitulo: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 28, marginBottom: 12 },
  vazio: { color: '#9AA5B1', fontSize: 14 },
  negociacaoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#151B29',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  negociacaoValor: { color: '#fff', fontSize: 15, fontWeight: '600' },
  negociacaoData: { color: '#9AA5B1', fontSize: 13 },
  novaPropostaRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  botaoSalvarText: { color: '#fff', fontWeight: '600' },
  botaoExcluir: { marginTop: 40, alignItems: 'center', paddingVertical: 14 },
  botaoExcluirText: { color: '#EF4444', fontWeight: '600' },
})
```

- [ ] **Step 2: Criar `LeadFormScreen.tsx`**

```typescript
// apps/mobile/src/screens/crm/LeadFormScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { listarClientes, buscarVeiculosCRM, criarLead, type Cliente, type VeiculoResumoCRM } from '../../lib/crm'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function LeadFormScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)

  const [buscaVeiculo, setBuscaVeiculo] = useState('')
  const [veiculos, setVeiculos] = useState<VeiculoResumoCRM[]>([])
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<VeiculoResumoCRM | null>(null)

  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (clienteSelecionado) return
    const timer = setTimeout(() => {
      listarClientes({ q: buscaCliente || undefined }).then(setClientes).catch(() => setClientes([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaCliente, clienteSelecionado])

  useEffect(() => {
    if (veiculoSelecionado) return
    const timer = setTimeout(() => {
      buscarVeiculosCRM({ q: buscaVeiculo || undefined }).then(setVeiculos).catch(() => setVeiculos([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaVeiculo, veiculoSelecionado])

  const salvar = async () => {
    if (!clienteSelecionado) {
      showError('Selecione um cliente.')
      return
    }
    setSalvando(true)
    try {
      await criarLead({ cliente_id: clienteSelecionado.id, veiculo_id: veiculoSelecionado?.id })
      showToast('Lead criado.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Cliente</Text>
      {clienteSelecionado ? (
        <Pressable style={styles.selecionado} onPress={() => setClienteSelecionado(null)}>
          <Text style={styles.selecionadoText}>{clienteSelecionado.nome}</Text>
          <Text style={styles.trocar}>trocar</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Buscar cliente por nome..."
            placeholderTextColor="#5B6472"
            value={buscaCliente}
            onChangeText={setBuscaCliente}
          />
          <FlatList
            data={clientes}
            keyExtractor={(c) => c.id}
            style={styles.lista}
            renderItem={({ item }) => (
              <Pressable style={styles.item} onPress={() => setClienteSelecionado(item)}>
                <Text style={styles.itemText}>{item.nome}</Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.label}>Veículo (opcional)</Text>
      {veiculoSelecionado ? (
        <Pressable style={styles.selecionado} onPress={() => setVeiculoSelecionado(null)}>
          <Text style={styles.selecionadoText}>{veiculoSelecionado.marca} {veiculoSelecionado.modelo}</Text>
          <Text style={styles.trocar}>trocar</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Buscar veículo..."
            placeholderTextColor="#5B6472"
            value={buscaVeiculo}
            onChangeText={setBuscaVeiculo}
          />
          <FlatList
            data={veiculos}
            keyExtractor={(v) => v.id}
            style={styles.lista}
            renderItem={({ item }) => (
              <Pressable style={styles.item} onPress={() => setVeiculoSelecionado(item)}>
                <Text style={styles.itemText}>{item.marca} {item.modelo} {item.ano_modelo}</Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Pressable style={styles.botaoSalvar} onPress={salvar} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>Criar Lead</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A', padding: 20 },
  label: { color: '#9AA5B1', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  lista: { maxHeight: 160, marginTop: 8 },
  item: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#2A3345' },
  itemText: { color: '#fff', fontSize: 14 },
  selecionado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
  },
  selecionadoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trocar: { color: '#3B82F6', fontSize: 13 },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  botaoSalvarText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros novos introduzidos por estes dois arquivos (dependências já existem das Tasks 2-3).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/crm/LeadDetalheScreen.tsx apps/mobile/src/screens/crm/LeadFormScreen.tsx
git commit -m "feat(mobile): add lead detail and lead creation screens"
```

---

### Task 6: Tela `ClientesListScreen`

**Files:**
- Create: `apps/mobile/src/screens/crm/ClientesListScreen.tsx`

**Interfaces:**
- Consumes: `listarClientes`, `excluirCliente`, type `Cliente` de `../../lib/crm`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `ClientesListScreen` — default export, lista com busca e navegação para `ClienteForm` (nova ou edição).

- [ ] **Step 1: Criar `ClientesListScreen.tsx`**

```typescript
// apps/mobile/src/screens/crm/ClientesListScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { listarClientes, excluirCliente, type Cliente } from '../../lib/crm'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function ClientesListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregar = useCallback(
    async (q?: string) => {
      try {
        const data = await listarClientes(q ? { q } : undefined)
        setClientes(data)
      } catch (err) {
        const { message, details } = extractErrorDetails(err)
        showError(message, details)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [showError]
  )

  useFocusEffect(
    useCallback(() => {
      carregar(busca || undefined)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const onBuscar = (texto: string) => {
    setBusca(texto)
    carregar(texto || undefined)
  }

  const excluir = async (cliente: Cliente) => {
    const ok = await confirm({ title: 'Excluir cliente', message: `Excluir "${cliente.nome}"?` })
    if (!ok) return
    try {
      await excluirCliente(cliente.id)
      showToast('Cliente excluído.', 'success')
      carregar(busca || undefined)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar cliente..."
        placeholderTextColor="#5B6472"
        value={busca}
        onChangeText={onBuscar}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#3B82F6" />
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                carregar(busca || undefined)
              }}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum cliente encontrado.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.item} onPress={() => navigation.navigate('ClienteForm', { clienteId: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                {item.telefone ? <Text style={styles.sub}>{item.telefone}</Text> : null}
              </View>
              <Pressable hitSlop={8} onPress={() => excluir(item)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('ClienteForm', {})}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  busca: {
    margin: 16,
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
    marginBottom: 8,
  },
  nome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sub: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/crm/ClientesListScreen.tsx
git commit -m "feat(mobile): add clientes list screen"
```

---

### Task 7: Tela `ClienteFormScreen` (máscaras + busca de CEP)

**Files:**
- Create: `apps/mobile/src/screens/crm/ClienteFormScreen.tsx`

**Interfaces:**
- Consumes: `buscarCliente`, `criarCliente`, `editarCliente`, type `Cliente` de `../../lib/crm`; `mascararCPF`, `mascararCNPJ`, `mascararTelefone`, `mascararCEP`, `mascararRG`, `capitalizarNome` de `../../lib/mascaras`; `buscarCEP` de `../../lib/cep`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `ClienteFormScreen` — default export, recebe `clienteId?: string` via route params (ausente = criação).

- [ ] **Step 1: Criar `ClienteFormScreen.tsx`**

```typescript
// apps/mobile/src/screens/crm/ClienteFormScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { buscarCliente, criarCliente, editarCliente } from '../../lib/crm'
import { mascararCPF, mascararTelefone, mascararCEP, capitalizarNome, sanitizarTexto } from '../../lib/mascaras'
import { buscarCEP } from '../../lib/cep'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function ClienteFormScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { clienteId } = (route.params ?? {}) as { clienteId?: string }
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [loading, setLoading] = useState(!!clienteId)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!clienteId) return
    buscarCliente(clienteId)
      .then((c) => {
        setNome(c.nome)
        setCpf(c.cpf ? mascararCPF(c.cpf) : '')
        setTelefone(c.telefone ? mascararTelefone(c.telefone) : '')
        setEmail(c.email || '')
        setCep(c.cep ? mascararCEP(c.cep) : '')
        setEndereco(c.endereco || '')
        setNumero(c.numero || '')
        setBairro(c.bairro || '')
        setCidade(c.cidade || '')
        setEstado(c.estado || '')
      })
      .catch((err) => {
        const { message, details } = extractErrorDetails(err)
        showError(message, details)
      })
      .finally(() => setLoading(false))
  }, [clienteId, showError])

  const onCepChange = async (valor: string) => {
    const mascarado = mascararCEP(valor)
    setCep(mascarado)
    if (mascarado.replace(/\D/g, '').length === 8) {
      setBuscandoCep(true)
      const resultado = await buscarCEP(mascarado)
      setBuscandoCep(false)
      if (resultado) {
        setEndereco(resultado.endereco)
        setBairro(resultado.bairro)
        setCidade(resultado.cidade)
        setEstado(resultado.estado)
      }
    }
  }

  const salvar = async () => {
    if (!nome.trim()) {
      showError('Informe o nome do cliente.')
      return
    }
    setSalvando(true)
    const body = {
      nome: capitalizarNome(sanitizarTexto(nome)),
      cpf: cpf.replace(/\D/g, '') || undefined,
      telefone: telefone.replace(/\D/g, '') || undefined,
      email: email.trim() || undefined,
      cep: cep.replace(/\D/g, '') || undefined,
      endereco: endereco || undefined,
      numero: numero || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
    }
    try {
      if (clienteId) {
        await editarCliente(clienteId, body)
      } else {
        await criarCliente(body)
      }
      showToast('Cliente salvo.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nome *</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor="#5B6472" />

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={styles.input}
        value={cpf}
        onChangeText={(v) => setCpf(mascararCPF(v))}
        placeholder="000.000.000-00"
        placeholderTextColor="#5B6472"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        value={telefone}
        onChangeText={(v) => setTelefone(mascararTelefone(v))}
        placeholder="(00) 00000-0000"
        placeholderTextColor="#5B6472"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemplo.com"
        placeholderTextColor="#5B6472"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>CEP</Text>
      <View style={styles.cepRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={cep}
          onChangeText={onCepChange}
          placeholder="00000-000"
          placeholderTextColor="#5B6472"
          keyboardType="numeric"
        />
        {buscandoCep ? <ActivityIndicator color="#3B82F6" style={{ marginLeft: 12 }} /> : null}
      </View>

      <Text style={styles.label}>Endereço</Text>
      <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} placeholderTextColor="#5B6472" />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Número</Text>
          <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholderTextColor="#5B6472" />
        </View>
        <View style={{ flex: 2, marginLeft: 12 }}>
          <Text style={styles.label}>Bairro</Text>
          <TextInput style={styles.input} value={bairro} onChangeText={setBairro} placeholderTextColor="#5B6472" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput style={styles.input} value={cidade} onChangeText={setCidade} placeholderTextColor="#5B6472" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.label}>UF</Text>
          <TextInput
            style={styles.input}
            value={estado}
            onChangeText={(v) => setEstado(v.toUpperCase().slice(0, 2))}
            autoCapitalize="characters"
            maxLength={2}
            placeholderTextColor="#5B6472"
          />
        </View>
      </View>

      <Pressable style={styles.botaoSalvar} onPress={salvar} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>Salvar</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: '#9AA5B1', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  cepRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row' },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  botaoSalvarText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/crm/ClienteFormScreen.tsx
git commit -m "feat(mobile): add cliente form screen with masks and CEP lookup"
```

---

### Task 9: Ligar "Clientes" à navegação a partir do Kanban e validar tudo junto

**Files:**
- Modify: `apps/mobile/src/screens/crm/LeadsKanbanScreen.tsx`

**Interfaces:**
- Consumes: navegação já tipada por `CrmNavigator` (Task 8).
- Produces: botão de acesso à lista de clientes a partir do Kanban.

- [ ] **Step 1: Adicionar botão "Clientes" no header do Kanban**

Editar `LeadsKanbanScreen.tsx`: adicionar um `Pressable` no topo (acima das tabs de etapa) navegando para `ClientesList`:

```typescript
// Inserir logo após a abertura de <View style={styles.container}> em LeadsKanbanScreen.tsx
<Pressable style={styles.linkClientes} onPress={() => navigation.navigate('ClientesList')}>
  <Text style={styles.linkClientesText}>Ver clientes →</Text>
</Pressable>
```

E no `StyleSheet.create` de `LeadsKanbanScreen.tsx`, adicionar:
```typescript
linkClientes: { paddingHorizontal: 16, paddingTop: 12 },
linkClientesText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/crm/LeadsKanbanScreen.tsx
git commit -m "feat(mobile): link clientes list from CRM kanban"
```

- [ ] **Step 4: Validação manual ponta a ponta**

Com a API local rodando (`pnpm --filter @sv/api dev`) e o `.env` do mobile apontando pro IP da rede (herdado da Fase 1):

Run: `pnpm --filter @sv/mobile run start`

No Expo Go, logar com `gestor@autopremium.com.br` / `demo123` e verificar:
1. Aba CRM abre no Kanban, com abas de estágio e contagem.
2. Criar um lead novo (buscar/selecionar cliente existente, opcionalmente veículo) — deve aparecer na coluna "Lead".
3. Tocar "Avançar" em um lead — deve mover para a próxima etapa e sumir da lista atual.
4. Tocar "⋮" em um lead → "Mover para" → escolher "Perdido" — deve mover direto.
5. Abrir detalhe do lead, registrar uma nova proposta com valor em R$ — deve aparecer no histórico.
6. Excluir um lead — deve pedir confirmação nativa (Alert) e remover da lista ao confirmar.
7. Ir em "Ver clientes", criar um cliente novo preenchendo CEP válido (ex: `01310-100`) — endereço/bairro/cidade/UF devem autopreencher.
8. Editar esse cliente e excluir — confirmar comportamento de máscara (CPF/telefone formatados ao digitar).

Expected: todos os fluxos completam sem erro, e os dados aparecem refletidos no gestor web (`apps/gestor`, aba CRM) usando a mesma conta/loja — confirma sincronização real via o mesmo backend/banco.

Se todos os passos passarem, a Parte 1 (infra + CRM) está completa.
