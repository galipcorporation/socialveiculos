# Mobile Fase 2 — Parte 4: Mais (PosVenda + Comissões + Financeiro + Equipe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder `MaisScreen.tsx` por um menu que navega para os quatro módulos restantes do gestor: PosVenda (esteira pós-venda com checklist), MinhasComissões (somente leitura), Financeiro (KPIs + lançamentos) e Equipe (membros, módulos, comissão).

**Architecture:** `MaisScreen` vira uma tela de menu simples (lista de itens) que navega para stacks internos independentes de cada módulo — não viram abas próprias na bottom tab bar (decisão já tomada na Fase 1). Cada módulo é autocontido: PosVenda usa abas por estágio (somente leitura + detalhe com checklist), MinhasComissões é uma tela única de leitura com filtro local, Financeiro combina KPI cards com lista de lançamentos, Equipe é lista + formulário de convite/edição.

**Tech Stack:** React Native 0.86 + Expo ~57, TypeScript ~6.0. Reaproveita `expo-document-picker` (já instalado na Parte 2) para anexar documentos no checklist de pós-venda.

## Global Constraints

- Não modificar nenhum arquivo em `apps/gestor` — portabilidade por duplicação.
- Sem `packages/shared` nesta fase.
- Sem etapa de mockup HTML prévio — implementar direto em React Native.
- Depende das Partes 1 e 2 já aplicadas: `apps/mobile/src/lib/{api,mascaras,modulos}.ts`, `apps/mobile/src/stores/uiStore.ts`, e `expo-document-picker` (instalado na Parte 2, Task 1).
- Cor de fundo padrão: `#0B0F1A`; ícones via `@expo/vector-icons` (Ionicons).
- Credencial de teste: `gestor@autopremium.com.br` / `demo123`.

---

### Task 1: Tipos e cliente de dados — PosVenda (`lib/posvenda.ts`)

**Files:**
- Create: `apps/mobile/src/lib/posvenda.ts`

**Interfaces:**
- Consumes: `api` de `./api`.
- Produces: tipos `VeiculoResumoEsteira`, `CompradorResumo`, `EstagioEsteira`, `EsteiraResumoResponse`, `StatusItem`, `CategoriaItem`, `ItemChecklist`, `EsteiraDetalheResponse`; funções `listarEsteiras(estagio?)`, `buscarEsteira(id)`, `alternarStatusItem(esteiraId, itemId, status)`, `criarItemChecklist(esteiraId, body)`, `removerItemChecklist(esteiraId, itemId)`, `anexarDocumentoEsteira(esteiraId, veiculoId, itemChave, file)`, `concluirEsteira(esteiraId)`. Usado pelas telas da Task 2.

- [ ] **Step 1: Criar `lib/posvenda.ts`**

```typescript
// apps/mobile/src/lib/posvenda.ts
import { api } from './api'

export interface VeiculoResumoEsteira {
  id: string
  marca?: string
  modelo?: string
  ano_modelo?: number
  placa?: string
  foto?: string | null
}

export interface CompradorResumo {
  id: string
  nome?: string
  telefone?: string
}

export type EstagioEsteira = 'contrato' | 'pagamento' | 'documentos' | 'transferencia' | 'concluido'

export interface EsteiraResumoResponse {
  id: string
  estagio: EstagioEsteira
  origem?: string
  veiculo?: VeiculoResumoEsteira | null
  comprador?: CompradorResumo | null
  proximo_item?: string | null
  prazo_mais_proximo?: string | null
  tem_vencido: boolean
  total_itens: number
  concluidos: number
  aberta_em?: string | null
}

export type StatusItem = 'pendente' | 'em_andamento' | 'concluido' | 'nao_aplicavel'
export type CategoriaItem = 'contrato' | 'financeiro' | 'documento' | 'transferencia'

export interface ItemChecklist {
  id: string
  chave: string
  titulo: string
  categoria: CategoriaItem
  responsavel: 'loja' | 'comprador'
  status: StatusItem
  obrigatorio: boolean
  prazo_em?: string | null
  doc_id?: string | null
  observacao?: string | null
  concluido_em?: string | null
  vencido: boolean
}

export interface EsteiraDetalheResponse {
  id: string
  estagio: EstagioEsteira
  origem?: string
  veiculo?: VeiculoResumoEsteira | null
  comprador?: CompradorResumo | null
  contrato_id?: string | null
  vendedor_id?: string | null
  comunicacao_venda_em?: string | null
  transferencia_em?: string | null
  aberta_em?: string | null
  concluida_em?: string | null
  itens: ItemChecklist[]
  total_itens: number
  concluidos: number
  vencidos: number
}

export function listarEsteiras(estagio?: 'concluido'): Promise<EsteiraResumoResponse[]> {
  return api.get<EsteiraResumoResponse[]>('/esteira', estagio ? { estagio } : undefined)
}

export function buscarEsteira(id: string): Promise<EsteiraDetalheResponse> {
  return api.get<EsteiraDetalheResponse>(`/esteira/${id}`)
}

export function alternarStatusItem(
  esteiraId: string,
  itemId: string,
  status: StatusItem
): Promise<EsteiraDetalheResponse> {
  return api.patch<EsteiraDetalheResponse>(`/esteira/${esteiraId}/itens/${itemId}`, { status })
}

export function criarItemChecklist(
  esteiraId: string,
  body: { titulo: string; categoria: CategoriaItem; obrigatorio: boolean }
): Promise<EsteiraDetalheResponse> {
  return api.post<EsteiraDetalheResponse>(`/esteira/${esteiraId}/itens`, body)
}

export function removerItemChecklist(esteiraId: string, itemId: string): Promise<EsteiraDetalheResponse> {
  return api.delete<EsteiraDetalheResponse>(`/esteira/${esteiraId}/itens/${itemId}`)
}

export async function anexarDocumentoEsteira(
  esteiraId: string,
  veiculoId: string,
  itemChave: string,
  file: { uri: string; name: string; mimeType?: string }
): Promise<EsteiraDetalheResponse> {
  const formData = new FormData()
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/pdf',
  } as unknown as Blob)
  formData.append('tipo', 'nota_fiscal')
  formData.append('visivel_comprador', 'true')

  const doc = await api.post<{ id: string; url: string; nome: string }>(
    `/veiculos/${veiculoId}/documentos/upload`,
    formData
  )
  return api.post<EsteiraDetalheResponse>(`/esteira/${esteiraId}/documentos`, undefined, {
    params: { item_chave: itemChave, nome: doc.nome, url: doc.url },
  })
}

export function concluirEsteira(esteiraId: string): Promise<void> {
  return api.post(`/esteira/${esteiraId}/concluir`)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/posvenda.ts
git commit -m "feat(mobile): add posvenda data layer (types + API calls)"
```

---

### Task 2: Telas `EsteirasListScreen` + `EsteiraDetalheScreen`

**Files:**
- Create: `apps/mobile/src/screens/posvenda/EsteirasListScreen.tsx`
- Create: `apps/mobile/src/screens/posvenda/EsteiraDetalheScreen.tsx`

**Interfaces:**
- Consumes: `listarEsteiras`, `buscarEsteira`, `alternarStatusItem`, `criarItemChecklist`, `removerItemChecklist`, `anexarDocumentoEsteira`, `concluirEsteira`, tipos de `../../lib/posvenda`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`; `expo-document-picker`.
- Produces: `EsteirasListScreen` — default export, tela raiz; `EsteiraDetalheScreen` — default export, recebe `{ esteiraId: string }` via route params.

- [ ] **Step 1: Criar `EsteirasListScreen.tsx`**

```typescript
// apps/mobile/src/screens/posvenda/EsteirasListScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { listarEsteiras, type EsteiraResumoResponse, type EstagioEsteira } from '../../lib/posvenda'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

const ESTAGIOS: { key: EstagioEsteira; label: string }[] = [
  { key: 'contrato', label: 'Contrato' },
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'transferencia', label: 'Transferência' },
]

export default function EsteirasListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)

  const [esteiras, setEsteiras] = useState<EsteiraResumoResponse[]>([])
  const [estagioAtivo, setEstagioAtivo] = useState<EstagioEsteira>('contrato')
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const data = await listarEsteiras()
      setEsteiras(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const filtradas = esteiras.filter((e) => e.estagio === estagioAtivo)

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {ESTAGIOS.map((e) => {
          const total = esteiras.filter((x) => x.estagio === e.key).length
          const ativa = e.key === estagioAtivo
          return (
            <Pressable key={e.key} style={[styles.tab, ativa && styles.tabAtiva]} onPress={() => setEstagioAtivo(e.key)}>
              <Text style={[styles.tabText, ativa && styles.tabTextAtiva]}>{e.label}</Text>
              {total > 0 ? <Text style={styles.tabBadge}>{total}</Text> : null}
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma esteira nesta etapa.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('EsteiraDetalhe', { esteiraId: item.id })}>
            <Text style={styles.veiculoNome}>
              {item.veiculo ? `${item.veiculo.marca} ${item.veiculo.modelo}` : 'Veículo não informado'}
            </Text>
            {item.comprador?.nome ? <Text style={styles.comprador}>{item.comprador.nome}</Text> : null}
            <View style={styles.progressoRow}>
              <View style={styles.progressoBarra}>
                <View
                  style={[
                    styles.progressoPreenchido,
                    { width: `${item.total_itens ? (item.concluidos / item.total_itens) * 100 : 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressoTexto}>{item.concluidos}/{item.total_itens}</Text>
            </View>
            {item.tem_vencido ? <Text style={styles.vencido}>Item vencido</Text> : null}
          </Pressable>
        )}
      />
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
  lista: { padding: 16, paddingBottom: 40 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
    marginBottom: 10,
  },
  veiculoNome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  comprador: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  progressoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressoBarra: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2A3345', overflow: 'hidden' },
  progressoPreenchido: { height: 6, backgroundColor: '#3B82F6' },
  progressoTexto: { color: '#9AA5B1', fontSize: 12 },
  vencido: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginTop: 6 },
})
```

- [ ] **Step 2: Criar `EsteiraDetalheScreen.tsx`**

```typescript
// apps/mobile/src/screens/posvenda/EsteiraDetalheScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import {
  buscarEsteira,
  alternarStatusItem,
  criarItemChecklist,
  removerItemChecklist,
  anexarDocumentoEsteira,
  concluirEsteira,
  type EsteiraDetalheResponse,
  type ItemChecklist,
  type CategoriaItem,
} from '../../lib/posvenda'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

const CATEGORIA_LABEL: Record<CategoriaItem, string> = {
  contrato: 'Contrato',
  financeiro: 'Pagamento',
  documento: 'Documentos',
  transferencia: 'Transferência',
}

export default function EsteiraDetalheScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { esteiraId } = route.params as { esteiraId: string }
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [esteira, setEsteira] = useState<EsteiraDetalheResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [concluindo, setConcluindo] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await buscarEsteira(esteiraId)
      setEsteira(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [esteiraId, showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const alternarItem = async (item: ItemChecklist) => {
    const novoStatus = item.status === 'concluido' ? 'pendente' : 'concluido'
    try {
      const atualizado = await alternarStatusItem(esteiraId, item.id, novoStatus)
      setEsteira(atualizado)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const removerItem = async (item: ItemChecklist) => {
    const ok = await confirm({ title: 'Remover item', message: `Remover "${item.titulo}" do checklist?` })
    if (!ok) return
    try {
      const atualizado = await removerItemChecklist(esteiraId, item.id)
      setEsteira(atualizado)
      showToast('Item removido.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const adicionarItem = async () => {
    if (!novoTitulo.trim() || !esteira) return
    try {
      const atualizado = await criarItemChecklist(esteiraId, {
        titulo: novoTitulo.trim(),
        categoria: 'documento',
        obrigatorio: false,
      })
      setEsteira(atualizado)
      setNovoTitulo('')
      showToast('Item adicionado.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const anexarDoc = async (item: ItemChecklist) => {
    if (!esteira?.veiculo?.id) {
      showError('Este item não está vinculado a um veículo.')
      return
    }
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (resultado.canceled || !resultado.assets?.[0]) return
    const asset = resultado.assets[0]
    try {
      const atualizado = await anexarDocumentoEsteira(esteiraId, esteira.veiculo.id, item.chave, {
        uri: asset.uri,
        name: asset.name,
        mimeType: 'application/pdf',
      })
      setEsteira(atualizado)
      showToast('Documento anexado.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const concluir = async () => {
    const ok = await confirm({ title: 'Concluir esteira', message: 'Concluir esta esteira e arquivar na carteira do proprietário?' })
    if (!ok) return
    setConcluindo(true)
    try {
      await concluirEsteira(esteiraId)
      showToast('Esteira concluída.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setConcluindo(false)
    }
  }

  if (loading || !esteira) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.veiculoNome}>
          {esteira.veiculo ? `${esteira.veiculo.marca} ${esteira.veiculo.modelo}` : 'Veículo não informado'}
        </Text>
        {esteira.comprador?.nome ? <Text style={styles.comprador}>{esteira.comprador.nome}</Text> : null}
        <Text style={styles.progresso}>{esteira.concluidos}/{esteira.total_itens} itens concluídos</Text>
      </View>

      <FlatList
        data={esteira.itens}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <Pressable style={styles.itemCheck} onPress={() => alternarItem(item)}>
              <Ionicons
                name={item.status === 'concluido' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={item.status === 'concluido' ? '#10B981' : '#9AA5B1'}
              />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.itemTitulo, item.status === 'concluido' && styles.itemTituloConcluido]}>
                {item.titulo}
              </Text>
              <Text style={styles.itemCategoria}>
                {CATEGORIA_LABEL[item.categoria]} {item.obrigatorio ? '· obrigatório' : ''}
              </Text>
              {item.vencido ? <Text style={styles.itemVencido}>Vencido</Text> : null}
            </View>
            {item.categoria === 'documento' ? (
              <Pressable hitSlop={8} onPress={() => anexarDoc(item)}>
                <Ionicons name="attach-outline" size={20} color="#3B82F6" />
              </Pressable>
            ) : null}
            <Pressable hitSlop={8} onPress={() => removerItem(item)}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      />

      <View style={styles.novoItemRow}>
        <TextInput
          style={styles.input}
          placeholder="Novo item do checklist..."
          placeholderTextColor="#5B6472"
          value={novoTitulo}
          onChangeText={setNovoTitulo}
        />
        <Pressable style={styles.botaoAdicionar} onPress={adicionarItem}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      {esteira.estagio !== 'concluido' && (
        <Pressable style={styles.botaoConcluir} onPress={concluir} disabled={concluindo}>
          {concluindo ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoConcluirText}>Concluir esteira</Text>}
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A3345' },
  veiculoNome: { color: '#fff', fontSize: 18, fontWeight: '700' },
  comprador: { color: '#9AA5B1', fontSize: 14, marginTop: 4 },
  progresso: { color: '#3B82F6', fontSize: 13, fontWeight: '600', marginTop: 8 },
  lista: { padding: 16 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B29',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemCheck: { padding: 2 },
  itemTitulo: { color: '#fff', fontSize: 14, fontWeight: '600' },
  itemTituloConcluido: { textDecorationLine: 'line-through', color: '#9AA5B1' },
  itemCategoria: { color: '#9AA5B1', fontSize: 12, marginTop: 2 },
  itemVencido: { color: '#EF4444', fontSize: 11, fontWeight: '700', marginTop: 2 },
  novoItemRow: { flexDirection: 'row', gap: 8, padding: 16 },
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
  botaoAdicionar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoConcluir: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  botaoConcluirText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/posvenda/EsteirasListScreen.tsx apps/mobile/src/screens/posvenda/EsteiraDetalheScreen.tsx
git commit -m "feat(mobile): add posvenda esteira list and detail screens with checklist"
```

---

### Task 3: Tela `MinhasComissoesScreen`

**Files:**
- Create: `apps/mobile/src/screens/comissoes/MinhasComissoesScreen.tsx`

**Interfaces:**
- Consumes: `api` de `../../lib/api` diretamente (endpoint único, sem necessidade de módulo `lib/` dedicado); `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `MinhasComissoesScreen` — default export, com filtro local (`todas|pendentes|pagas`).

- [ ] **Step 1: Criar `MinhasComissoesScreen.tsx`**

```typescript
// apps/mobile/src/screens/comissoes/MinhasComissoesScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { api, extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

interface MinhaVenda {
  esteira_id: string
  veiculo_id?: string
  veiculo_nome?: string
  valor_venda?: number
  comissao_valor?: number
  comissao_paga?: boolean | null
  estagio: string
  aberta_em: string
}

type Filtro = 'todas' | 'pendentes' | 'pagas'

function formatBRL(v?: number | null): string {
  return v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function MinhasComissoesScreen() {
  const showError = useUIStore((s) => s.showError)
  const [vendas, setVendas] = useState<MinhaVenda[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const data = await api.get<MinhaVenda[]>('/me/vendas')
      setVendas(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const filtradas = vendas.filter((v) => {
    if (filtro === 'pendentes') return v.comissao_paga === false || v.comissao_paga == null
    if (filtro === 'pagas') return v.comissao_paga === true
    return true
  })

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['todas', 'pendentes', 'pagas'] as Filtro[]).map((f) => (
          <Pressable key={f} style={[styles.tab, filtro === f && styles.tabAtiva]} onPress={() => setFiltro(f)}>
            <Text style={[styles.tabText, filtro === f && styles.tabTextAtiva]}>
              {f === 'todas' ? 'Todas' : f === 'pendentes' ? 'Pendentes' : 'Pagas'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(v) => v.esteira_id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma venda encontrada.</Text>}
        renderItem={({ item }) => {
          const percentual = item.valor_venda && item.comissao_valor ? (item.comissao_valor / item.valor_venda) * 100 : null
          return (
            <View style={styles.card}>
              <Text style={styles.veiculoNome}>{item.veiculo_nome || 'Veículo não informado'}</Text>
              <Text style={styles.data}>{formatData(item.aberta_em)}</Text>
              <View style={styles.valoresRow}>
                <View>
                  <Text style={styles.label}>Venda</Text>
                  <Text style={styles.valor}>{formatBRL(item.valor_venda)}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Comissão {percentual ? `(${percentual.toFixed(1)}%)` : ''}</Text>
                  <Text style={styles.valorComissao}>{formatBRL(item.comissao_valor)}</Text>
                </View>
              </View>
              <Text style={[styles.status, item.comissao_paga ? styles.statusPago : styles.statusPendente]}>
                {item.comissao_paga ? 'Paga' : 'Pendente'}
              </Text>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  tabs: { flexDirection: 'row', gap: 8, padding: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#151B29', alignItems: 'center' },
  tabAtiva: { backgroundColor: '#3B82F6' },
  tabText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  tabTextAtiva: { color: '#fff' },
  lista: { paddingHorizontal: 16, paddingBottom: 40 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
    marginBottom: 10,
  },
  veiculoNome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  data: { color: '#9AA5B1', fontSize: 12, marginTop: 2 },
  valoresRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  label: { color: '#9AA5B1', fontSize: 11 },
  valor: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  valorComissao: { color: '#10B981', fontSize: 15, fontWeight: '600', marginTop: 2 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 10, textTransform: 'uppercase' },
  statusPago: { color: '#10B981' },
  statusPendente: { color: '#F59E0B' },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/comissoes/MinhasComissoesScreen.tsx
git commit -m "feat(mobile): add minhas comissoes screen (read-only with filter)"
```

---

### Task 4: Tipos e cliente de dados — Financeiro (`lib/financeiro.ts`)

**Files:**
- Create: `apps/mobile/src/lib/financeiro.ts`

**Interfaces:**
- Consumes: `api` de `./api`.
- Produces: tipos `TipoLancamento`, `ResumoFinanceiro`, `Lancamento`, `VeiculoBasico`; funções `buscarResumoFinanceiro(mes?, ano?)`, `listarLancamentos(mes?, ano?)`, `listarVeiculosBasico()`, `criarLancamento(body)`, `excluirLancamento(id)`, `toggleStatusPagamento(id, novoStatus)`. Usado pelas telas da Task 5.

- [ ] **Step 1: Criar `lib/financeiro.ts`**

```typescript
// apps/mobile/src/lib/financeiro.ts
import { api } from './api'

export type TipoLancamento = 'receita' | 'despesa' | 'comissao'

export interface ResumoFinanceiro {
  receitas: number
  despesas: number
  comissoes: number
  saldo: number
  custo_estoque: number
  comissoes_pendentes: number
}

export interface Lancamento {
  id: string
  loja_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  veiculo_id?: string
  veiculo_nome?: string
  status_pagamento: string
  observacoes?: string
  created_at: string
}

export interface VeiculoBasico {
  id: string
  marca: string
  modelo: string
  placa: string
}

function periodoParams(mes?: number, ano?: number): Record<string, string> | undefined {
  if (!mes || !ano) return undefined
  return { mes: String(mes), ano: String(ano) }
}

export function buscarResumoFinanceiro(mes?: number, ano?: number): Promise<ResumoFinanceiro> {
  return api.get<ResumoFinanceiro>('/financeiro/resumo', periodoParams(mes, ano))
}

export function listarLancamentos(mes?: number, ano?: number): Promise<Lancamento[]> {
  return api.get<Lancamento[]>('/financeiro/lancamentos', periodoParams(mes, ano))
}

export function listarVeiculosBasico(): Promise<VeiculoBasico[]> {
  return api.get<{ items: VeiculoBasico[] }>('/veiculos', { per_page: '500' }).then((res) => res.items)
}

export function criarLancamento(body: {
  tipo: TipoLancamento
  descricao: string
  valor: number
  status_pagamento: string
  veiculo_id?: string | null
}): Promise<Lancamento> {
  return api.post<Lancamento>('/financeiro/lancamentos', body)
}

export function excluirLancamento(id: string): Promise<void> {
  return api.delete(`/financeiro/lancamentos/${id}`)
}

export function toggleStatusPagamento(id: string, novoStatus: string): Promise<void> {
  return api.patch(`/financeiro/lancamentos/${id}`, { status_pagamento: novoStatus })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/financeiro.ts
git commit -m "feat(mobile): add financeiro data layer (types + API calls)"
```

---

### Task 5: Telas `FinanceiroScreen` + `LancamentoFormScreen`

**Files:**
- Create: `apps/mobile/src/screens/financeiro/FinanceiroScreen.tsx`
- Create: `apps/mobile/src/screens/financeiro/LancamentoFormScreen.tsx`

**Interfaces:**
- Consumes: `buscarResumoFinanceiro`, `listarLancamentos`, `excluirLancamento`, `toggleStatusPagamento`, `listarVeiculosBasico`, `criarLancamento`, tipos de `../../lib/financeiro`; `mascararMoeda`, `parseMoeda` de `../../lib/mascaras`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `FinanceiroScreen` — default export, tela raiz com KPIs + lista; `LancamentoFormScreen` — default export, formulário de criação.

- [ ] **Step 1: Criar `FinanceiroScreen.tsx`**

```typescript
// apps/mobile/src/screens/financeiro/FinanceiroScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import {
  buscarResumoFinanceiro,
  listarLancamentos,
  excluirLancamento,
  toggleStatusPagamento,
  type ResumoFinanceiro,
  type Lancamento,
} from '../../lib/financeiro'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FinanceiroScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([buscarResumoFinanceiro(), listarLancamentos()])
      setResumo(r)
      setLancamentos(l)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const toggleStatus = async (lancamento: Lancamento) => {
    const novoStatus = lancamento.status_pagamento === 'pago' ? 'pendente' : 'pago'
    setLancamentos((lista) =>
      lista.map((l) => (l.id === lancamento.id ? { ...l, status_pagamento: novoStatus } : l))
    )
    try {
      await toggleStatusPagamento(lancamento.id, novoStatus)
      showToast(`Marcado como ${novoStatus === 'pago' ? 'Pago' : 'Pendente'}.`, 'success')
      const r = await buscarResumoFinanceiro()
      setResumo(r)
    } catch (err) {
      setLancamentos((lista) =>
        lista.map((l) => (l.id === lancamento.id ? { ...l, status_pagamento: lancamento.status_pagamento } : l))
      )
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const excluir = async (lancamento: Lancamento) => {
    const ok = await confirm({ title: 'Excluir lançamento', message: `Excluir "${lancamento.descricao}"?` })
    if (!ok) return
    try {
      await excluirLancamento(lancamento.id)
      showToast('Lançamento excluído.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  if (loading || !resumo) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lancamentos}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <View style={styles.kpis}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Receitas</Text>
              <Text style={[styles.kpiValor, { color: '#10B981' }]}>{formatBRL(resumo.receitas)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Despesas</Text>
              <Text style={[styles.kpiValor, { color: '#EF4444' }]}>{formatBRL(resumo.despesas)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Comissões</Text>
              <Text style={styles.kpiValor}>{formatBRL(resumo.comissoes)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Saldo</Text>
              <Text style={[styles.kpiValor, { color: resumo.saldo >= 0 ? '#10B981' : '#EF4444' }]}>
                {formatBRL(resumo.saldo)}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum lançamento neste período.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable style={{ flex: 1 }} onPress={() => toggleStatus(item)}>
              <Text style={styles.itemDescricao}>{item.descricao}</Text>
              <Text style={styles.itemMeta}>
                {item.tipo} · {new Date(item.data).toLocaleDateString('pt-BR')} ·{' '}
                <Text style={item.status_pagamento === 'pago' ? styles.pago : styles.pendente}>
                  {item.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                </Text>
              </Text>
            </Pressable>
            <Text style={[styles.itemValor, item.tipo === 'despesa' && { color: '#EF4444' }]}>
              {formatBRL(item.valor)}
            </Text>
            <Pressable hitSlop={8} onPress={() => excluir(item)}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('LancamentoForm')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  kpiCard: {
    flexBasis: '47%',
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
  },
  kpiLabel: { color: '#9AA5B1', fontSize: 12 },
  kpiValor: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 4 },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 20 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B29',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  itemDescricao: { color: '#fff', fontSize: 14, fontWeight: '600' },
  itemMeta: { color: '#9AA5B1', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  pago: { color: '#10B981' },
  pendente: { color: '#F59E0B' },
  itemValor: { color: '#fff', fontSize: 14, fontWeight: '700' },
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

- [ ] **Step 2: Criar `LancamentoFormScreen.tsx`**

```typescript
// apps/mobile/src/screens/financeiro/LancamentoFormScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { criarLancamento, listarVeiculosBasico, type TipoLancamento, type VeiculoBasico } from '../../lib/financeiro'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

const TIPOS: { value: TipoLancamento; label: string }[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'comissao', label: 'Comissão' },
]

export default function LancamentoFormScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [tipo, setTipo] = useState<TipoLancamento>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [statusPagamento, setStatusPagamento] = useState<'pago' | 'pendente'>('pago')
  const [veiculoId, setVeiculoId] = useState<string | null>(null)
  const [veiculos, setVeiculos] = useState<VeiculoBasico[]>([])
  const [mostrarVeiculos, setMostrarVeiculos] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (mostrarVeiculos && veiculos.length === 0) {
      listarVeiculosBasico().then(setVeiculos).catch(() => setVeiculos([]))
    }
  }, [mostrarVeiculos, veiculos.length])

  const salvar = async () => {
    const valorNum = parseMoeda(valor)
    if (!descricao.trim() || !valorNum || valorNum <= 0) {
      showError('Informe uma descrição e um valor maior que zero.')
      return
    }
    setSalvando(true)
    try {
      await criarLancamento({
        tipo,
        descricao: descricao.trim(),
        valor: valorNum,
        status_pagamento: statusPagamento,
        veiculo_id: veiculoId,
      })
      showToast('Lançamento registrado.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setSalvando(false)
    }
  }

  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.tipoRow}>
        {TIPOS.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.tipoChip, tipo === t.value && styles.tipoChipAtivo]}
            onPress={() => setTipo(t.value)}
          >
            <Text style={[styles.tipoChipText, tipo === t.value && styles.tipoChipTextAtivo]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Descrição</Text>
      <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} placeholderTextColor="#5B6472" />

      <Text style={styles.label}>Valor</Text>
      <TextInput
        style={styles.input}
        value={valor}
        onChangeText={(v) => setValor(mascararMoeda(v))}
        keyboardType="numeric"
        placeholder="R$ 0,00"
        placeholderTextColor="#5B6472"
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.tipoRow}>
        <Pressable
          style={[styles.tipoChip, statusPagamento === 'pago' && styles.tipoChipAtivo]}
          onPress={() => setStatusPagamento('pago')}
        >
          <Text style={[styles.tipoChipText, statusPagamento === 'pago' && styles.tipoChipTextAtivo]}>Pago</Text>
        </Pressable>
        <Pressable
          style={[styles.tipoChip, statusPagamento === 'pendente' && styles.tipoChipAtivo]}
          onPress={() => setStatusPagamento('pendente')}
        >
          <Text style={[styles.tipoChipText, statusPagamento === 'pendente' && styles.tipoChipTextAtivo]}>Pendente</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Veículo (opcional)</Text>
      {veiculoSelecionado ? (
        <Pressable style={styles.selecionado} onPress={() => setVeiculoId(null)}>
          <Text style={styles.selecionadoText}>{veiculoSelecionado.marca} {veiculoSelecionado.modelo} · {veiculoSelecionado.placa}</Text>
          <Text style={styles.trocar}>trocar</Text>
        </Pressable>
      ) : (
        <>
          <Pressable style={styles.input} onPress={() => setMostrarVeiculos((v) => !v)}>
            <Text style={{ color: '#5B6472' }}>Selecionar veículo...</Text>
          </Pressable>
          {mostrarVeiculos && (
            <FlatList
              data={veiculos}
              keyExtractor={(v) => v.id}
              style={styles.lista}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.item}
                  onPress={() => {
                    setVeiculoId(item.id)
                    setMostrarVeiculos(false)
                  }}
                >
                  <Text style={styles.itemText}>{item.marca} {item.modelo} · {item.placa}</Text>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      <Pressable style={styles.botaoSalvar} onPress={salvar} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>Salvar</Text>}
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
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#151B29', alignItems: 'center', borderWidth: 1, borderColor: '#2A3345' },
  tipoChipAtivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tipoChipText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  tipoChipTextAtivo: { color: '#fff' },
  selecionado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
  },
  selecionadoText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  trocar: { color: '#3B82F6', fontSize: 13 },
  lista: { maxHeight: 160, marginTop: 8 },
  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3345' },
  itemText: { color: '#fff', fontSize: 14 },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  botaoSalvarText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/financeiro/FinanceiroScreen.tsx apps/mobile/src/screens/financeiro/LancamentoFormScreen.tsx
git commit -m "feat(mobile): add financeiro screen with KPIs and lancamento form"
```

---

### Task 6: Tipos e cliente de dados — Equipe (`lib/equipe.ts`)

**Files:**
- Create: `apps/mobile/src/lib/equipe.ts`

**Interfaces:**
- Consumes: `api` de `./api`; `TODOS_MODULOS`, `ModuloKey` de `./modulos` (Parte 1).
- Produces: tipos `Papel`, `Membro`; funções `listarEquipe()`, `convidarMembro(body)`, `toggleAtivoMembro(id, ativo)`, `removerMembro(id)`, `atualizarPercentualComissao(id, percentual)`, `atualizarModulosMembro(id, modulos)`, `buscarAssistenteConfig(usuarioId)`, `salvarAssistenteConfig(usuarioId, body)`. Usado pelas telas da Task 7.

- [ ] **Step 1: Criar `lib/equipe.ts`**

```typescript
// apps/mobile/src/lib/equipe.ts
import { api } from './api'
import type { ModuloKey } from './modulos'

export type Papel = 'gestor' | 'vendedor' | 'admin_plataforma' | 'cliente'

export interface Membro {
  id: string
  usuario_id: string
  nome: string
  email: string
  telefone?: string
  avatar_url?: string
  papel: Papel
  modulos?: string
  percentual_comissao?: number | null
  ativo: boolean
  created_at: string
}

export interface AssistenteConfig {
  pode_usar: boolean
  autonomia_default: 'copiloto' | 'automatico'
}

export function listarEquipe(): Promise<Membro[]> {
  return api.get<Membro[]>('/equipe')
}

export function convidarMembro(body: {
  nome: string
  email: string
  telefone?: string
  papel: 'gestor' | 'vendedor'
  senha: string
  modulos: ModuloKey[]
}): Promise<Membro> {
  return api.post<Membro>('/equipe', {
    nome: body.nome.trim(),
    email: body.email.trim(),
    telefone: body.telefone?.trim() || undefined,
    papel: body.papel,
    senha: body.senha,
    modulos: JSON.stringify(body.modulos),
  })
}

export function toggleAtivoMembro(id: string, ativo: boolean): Promise<void> {
  return api.patch(`/equipe/${id}`, { ativo })
}

export function removerMembro(id: string): Promise<void> {
  return api.delete(`/equipe/${id}`)
}

export function atualizarPercentualComissao(id: string, percentual: number | null): Promise<void> {
  return api.patch(`/equipe/${id}`, { percentual_comissao: percentual })
}

export function atualizarModulosMembro(id: string, modulos: ModuloKey[]): Promise<void> {
  return api.patch(`/equipe/${id}`, { modulos: JSON.stringify(modulos) })
}

export function buscarAssistenteConfig(usuarioId: string): Promise<AssistenteConfig> {
  return api.get<AssistenteConfig>(`/equipe/${usuarioId}/assistente`)
}

export function salvarAssistenteConfig(usuarioId: string, body: AssistenteConfig): Promise<void> {
  return api.put(`/equipe/${usuarioId}/assistente`, body)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/equipe.ts
git commit -m "feat(mobile): add equipe data layer (types + API calls)"
```

---

### Task 7: Telas `EquipeListScreen` + `MembroFormScreen`

**Files:**
- Create: `apps/mobile/src/screens/equipe/EquipeListScreen.tsx`
- Create: `apps/mobile/src/screens/equipe/MembroFormScreen.tsx`

**Interfaces:**
- Consumes: `listarEquipe`, `convidarMembro`, `toggleAtivoMembro`, `removerMembro`, `atualizarPercentualComissao`, `atualizarModulosMembro`, tipos de `../../lib/equipe`; `MODULOS`, `TODOS_MODULOS`, `parseModulos`, type `ModuloKey` de `../../lib/modulos`; `mascararTelefone`, `capitalizarNome` de `../../lib/mascaras`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `EquipeListScreen` — default export, tela raiz; `MembroFormScreen` — default export, convite (sempre cria novo — edição de módulos/comissão acontece inline na lista, igual ao padrão do gestor web).

- [ ] **Step 1: Criar `EquipeListScreen.tsx`**

```typescript
// apps/mobile/src/screens/equipe/EquipeListScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, Switch, TextInput, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import {
  listarEquipe,
  toggleAtivoMembro,
  removerMembro,
  atualizarPercentualComissao,
  type Membro,
} from '../../lib/equipe'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

const PAPEL_LABEL: Record<string, string> = {
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  admin_plataforma: 'Admin',
  cliente: 'Cliente',
}

export default function EquipeListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [comissaoEdit, setComissaoEdit] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    try {
      const data = await listarEquipe()
      setMembros(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [showError])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  const toggleAtivo = async (membro: Membro) => {
    setMembros((lista) => lista.map((m) => (m.id === membro.id ? { ...m, ativo: !m.ativo } : m)))
    try {
      await toggleAtivoMembro(membro.id, !membro.ativo)
      showToast('Status atualizado.', 'success')
    } catch (err) {
      setMembros((lista) => lista.map((m) => (m.id === membro.id ? { ...m, ativo: membro.ativo } : m)))
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const salvarComissao = async (membro: Membro) => {
    const texto = comissaoEdit[membro.id]
    if (texto === undefined) return
    const valor = texto.trim() === '' ? null : Number(texto.replace(',', '.'))
    try {
      await atualizarPercentualComissao(membro.id, valor)
      setMembros((lista) => lista.map((m) => (m.id === membro.id ? { ...m, percentual_comissao: valor } : m)))
      showToast('Comissão atualizada.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const remover = async (membro: Membro) => {
    const ok = await confirm({ title: 'Remover membro', message: `Remover ${membro.nome} da equipe?` })
    if (!ok) return
    try {
      await removerMembro(membro.id)
      showToast('Membro removido.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={membros}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum membro na equipe.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('MembroEditar', { membroId: item.id })}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.papel}>{PAPEL_LABEL[item.papel] || item.papel}</Text>
              </View>
              <Switch value={item.ativo} onValueChange={() => toggleAtivo(item)} trackColor={{ false: '#2A3345', true: '#3B82F6' }} />
              <Pressable hitSlop={8} onPress={() => remover(item)} style={{ marginLeft: 12 }}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </Pressable>
            </View>

            {item.papel === 'vendedor' ? (
              <View style={styles.comissaoRow}>
                <Text style={styles.comissaoLabel}>% Comissão:</Text>
                <TextInput
                  style={styles.comissaoInput}
                  keyboardType="numeric"
                  placeholder="padrão da loja"
                  placeholderTextColor="#5B6472"
                  value={comissaoEdit[item.id] ?? (item.percentual_comissao != null ? String(item.percentual_comissao) : '')}
                  onChangeText={(v) => setComissaoEdit((atual) => ({ ...atual, [item.id]: v }))}
                  onBlur={() => salvarComissao(item)}
                />
              </View>
            ) : null}
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('MembroForm')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  lista: { padding: 16, paddingBottom: 100 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 14,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  nome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  papel: { color: '#9AA5B1', fontSize: 12, marginTop: 2 },
  comissaoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  comissaoLabel: { color: '#9AA5B1', fontSize: 13 },
  comissaoInput: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
  },
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

- [ ] **Step 2: Criar `MembroFormScreen.tsx`** (convite de novo membro + edição de módulos/config. IA para membro existente)

```typescript
// apps/mobile/src/screens/equipe/MembroFormScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Switch } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import {
  convidarMembro,
  listarEquipe,
  atualizarModulosMembro,
  buscarAssistenteConfig,
  salvarAssistenteConfig,
  type Membro,
} from '../../lib/equipe'
import { MODULOS, TODOS_MODULOS, parseModulos, type ModuloKey } from '../../lib/modulos'
import { mascararTelefone, capitalizarNome } from '../../lib/mascaras'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function MembroFormScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { membroId } = (route.params ?? {}) as { membroId?: string }
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [loading, setLoading] = useState(!!membroId)
  const [salvando, setSalvando] = useState(false)

  // Campos de convite (novo membro)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [papel, setPapel] = useState<'gestor' | 'vendedor'>('vendedor')
  const [senha, setSenha] = useState('')

  // Módulos (ambos os fluxos)
  const [modulos, setModulos] = useState<ModuloKey[]>([])

  // Config. IA (só edição de membro existente)
  const [membro, setMembro] = useState<Membro | null>(null)
  const [assistenteHabilitado, setAssistenteHabilitado] = useState(false)
  const [autonomiaAutomatica, setAutonomiaAutomatica] = useState(false)

  useEffect(() => {
    if (!membroId) return
    listarEquipe()
      .then((lista) => {
        const encontrado = lista.find((m) => m.id === membroId)
        if (encontrado) {
          setMembro(encontrado)
          setModulos(parseModulos(encontrado.modulos))
          if (encontrado.papel === 'vendedor') {
            buscarAssistenteConfig(encontrado.usuario_id)
              .then((cfg) => {
                setAssistenteHabilitado(cfg.pode_usar)
                setAutonomiaAutomatica(cfg.autonomia_default === 'automatico')
              })
              .catch(() => {})
          }
        }
      })
      .catch((err) => {
        const { message, details } = extractErrorDetails(err)
        showError(message, details)
      })
      .finally(() => setLoading(false))
  }, [membroId, showError])

  const toggleModulo = (key: ModuloKey) => {
    setModulos((atual) => (atual.includes(key) ? atual.filter((m) => m !== key) : [...atual, key]))
  }

  const salvarConvite = async () => {
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      showError('Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.')
      return
    }
    setSalvando(true)
    try {
      await convidarMembro({
        nome: capitalizarNome(nome),
        email,
        telefone: telefone || undefined,
        papel,
        senha,
        modulos: papel === 'gestor' ? TODOS_MODULOS : modulos,
      })
      showToast('Membro convidado.', 'success')
      navigation.goBack()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setSalvando(false)
    }
  }

  const salvarEdicao = async () => {
    if (!membro) return
    setSalvando(true)
    try {
      await atualizarModulosMembro(membro.id, modulos)
      if (membro.papel === 'vendedor') {
        await salvarAssistenteConfig(membro.usuario_id, {
          pode_usar: assistenteHabilitado,
          autonomia_default: autonomiaAutomatica ? 'automatico' : 'copiloto',
        })
      }
      showToast('Alterações salvas.', 'success')
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

  const ehEdicao = !!membroId

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!ehEdicao && (
        <>
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholderTextColor="#5B6472" />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#5B6472"
          />

          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            value={telefone}
            onChangeText={(v) => setTelefone(mascararTelefone(v))}
            keyboardType="phone-pad"
            placeholderTextColor="#5B6472"
          />

          <Text style={styles.label}>Papel</Text>
          <View style={styles.papelRow}>
            <Pressable style={[styles.papelChip, papel === 'vendedor' && styles.papelChipAtivo]} onPress={() => setPapel('vendedor')}>
              <Text style={[styles.papelChipText, papel === 'vendedor' && styles.papelChipTextAtivo]}>Vendedor</Text>
            </Pressable>
            <Pressable style={[styles.papelChip, papel === 'gestor' && styles.papelChipAtivo]} onPress={() => setPapel('gestor')}>
              <Text style={[styles.papelChipText, papel === 'gestor' && styles.papelChipTextAtivo]}>Gestor</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Senha provisória</Text>
          <TextInput style={styles.input} value={senha} onChangeText={setSenha} secureTextEntry placeholderTextColor="#5B6472" />
        </>
      )}

      {(ehEdicao ? membro?.papel !== 'gestor' : papel !== 'gestor') && (
        <>
          <Text style={styles.label}>Módulos liberados</Text>
          <View style={styles.modulosGrid}>
            {MODULOS.map((m) => (
              <Pressable key={m.key} style={styles.moduloItem} onPress={() => toggleModulo(m.key)}>
                <View style={[styles.checkbox, modulos.includes(m.key) && styles.checkboxAtivo]} />
                <Text style={styles.moduloLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {ehEdicao && membro?.papel === 'vendedor' && (
        <>
          <Text style={styles.label}>Assistente de IA</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Habilitado para este vendedor</Text>
            <Switch value={assistenteHabilitado} onValueChange={setAssistenteHabilitado} trackColor={{ false: '#2A3345', true: '#3B82F6' }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Autonomia automática (sem copiloto)</Text>
            <Switch value={autonomiaAutomatica} onValueChange={setAutonomiaAutomatica} trackColor={{ false: '#2A3345', true: '#3B82F6' }} />
          </View>
        </>
      )}

      <Pressable style={styles.botaoSalvar} onPress={ehEdicao ? salvarEdicao : salvarConvite} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>{ehEdicao ? 'Salvar' : 'Convidar'}</Text>}
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
  papelRow: { flexDirection: 'row', gap: 8 },
  papelChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#151B29', alignItems: 'center', borderWidth: 1, borderColor: '#2A3345' },
  papelChipAtivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  papelChipText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  papelChipTextAtivo: { color: '#fff' },
  modulosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moduloItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#2A3345' },
  checkboxAtivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  moduloLabel: { color: '#fff', fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  switchLabel: { color: '#fff', fontSize: 14, flex: 1, marginRight: 12 },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  botaoSalvarText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/equipe/EquipeListScreen.tsx apps/mobile/src/screens/equipe/MembroFormScreen.tsx
git commit -m "feat(mobile): add equipe list and member form screens"
```

---

### Task 8: `MaisScreen` como menu + navegadores internos de cada módulo

**Files:**
- Modify: `apps/mobile/src/screens/MaisScreen.tsx`
- Create: `apps/mobile/src/navigation/PosVendaNavigator.tsx`
- Create: `apps/mobile/src/navigation/ComissoesNavigator.tsx`
- Create: `apps/mobile/src/navigation/FinanceiroNavigator.tsx`
- Create: `apps/mobile/src/navigation/EquipeNavigator.tsx`
- Modify: `apps/mobile/src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: todas as telas das Tasks 2, 3, 5, 7.
- Produces: 4 navegadores default export; `MaisScreen` atualizada como menu.

- [ ] **Step 1: Criar os 4 navegadores internos**

```typescript
// apps/mobile/src/navigation/PosVendaNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import EsteirasListScreen from '../screens/posvenda/EsteirasListScreen'
import EsteiraDetalheScreen from '../screens/posvenda/EsteiraDetalheScreen'

export type PosVendaStackParamList = {
  EsteirasList: undefined
  EsteiraDetalhe: { esteiraId: string }
}

const Stack = createNativeStackNavigator<PosVendaStackParamList>()

export default function PosVendaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="EsteirasList" component={EsteirasListScreen} options={{ title: 'Pós-venda' }} />
      <Stack.Screen name="EsteiraDetalhe" component={EsteiraDetalheScreen} options={{ title: 'Esteira' }} />
    </Stack.Navigator>
  )
}
```

```typescript
// apps/mobile/src/navigation/ComissoesNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MinhasComissoesScreen from '../screens/comissoes/MinhasComissoesScreen'

const Stack = createNativeStackNavigator()

export default function ComissoesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="MinhasComissoes" component={MinhasComissoesScreen} options={{ title: 'Minhas Comissões' }} />
    </Stack.Navigator>
  )
}
```

```typescript
// apps/mobile/src/navigation/FinanceiroNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import FinanceiroScreen from '../screens/financeiro/FinanceiroScreen'
import LancamentoFormScreen from '../screens/financeiro/LancamentoFormScreen'

export type FinanceiroStackParamList = {
  Financeiro: undefined
  LancamentoForm: undefined
}

const Stack = createNativeStackNavigator<FinanceiroStackParamList>()

export default function FinanceiroNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="Financeiro" component={FinanceiroScreen} options={{ title: 'Financeiro' }} />
      <Stack.Screen name="LancamentoForm" component={LancamentoFormScreen} options={{ title: 'Novo Lançamento' }} />
    </Stack.Navigator>
  )
}
```

```typescript
// apps/mobile/src/navigation/EquipeNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import EquipeListScreen from '../screens/equipe/EquipeListScreen'
import MembroFormScreen from '../screens/equipe/MembroFormScreen'

export type EquipeStackParamList = {
  EquipeList: undefined
  MembroForm: undefined
  MembroEditar: { membroId: string }
}

const Stack = createNativeStackNavigator<EquipeStackParamList>()

export default function EquipeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="EquipeList" component={EquipeListScreen} options={{ title: 'Equipe' }} />
      <Stack.Screen name="MembroForm" component={MembroFormScreen} options={{ title: 'Convidar Membro' }} />
      <Stack.Screen name="MembroEditar" component={MembroFormScreen} options={{ title: 'Editar Membro' }} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Reescrever `MaisScreen.tsx` como menu**

Ler `apps/mobile/src/screens/MaisScreen.tsx` (Fase 1) antes de editar — atualmente é um placeholder com nome/e-mail do usuário e botão de logout. Preservar o logout, adicionar itens de menu:

```typescript
// apps/mobile/src/screens/MaisScreen.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../stores/authStore'

const ITENS = [
  { key: 'PosVenda', label: 'Pós-venda', icon: 'car-outline' as const },
  { key: 'Comissoes', label: 'Minhas Comissões', icon: 'cash-outline' as const },
  { key: 'Financeiro', label: 'Financeiro', icon: 'stats-chart-outline' as const },
  { key: 'Equipe', label: 'Equipe', icon: 'people-outline' as const },
]

export default function MaisScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nome}>{user?.nome}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.menu}>
        {ITENS.map((item) => (
          <Pressable key={item.key} style={styles.menuItem} onPress={() => navigation.navigate(item.key)}>
            <Ionicons name={item.icon} size={20} color="#3B82F6" />
            <Text style={styles.menuItemText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#5B6472" />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sair</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A', padding: 20 },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  nome: { color: '#fff', fontSize: 18, fontWeight: '600' },
  email: { color: '#9AA5B1', fontSize: 14, marginTop: 4 },
  menu: { gap: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 16,
  },
  menuItemText: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  button: { backgroundColor: '#EF4444', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 32 },
  buttonText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 3: Envolver `MaisScreen` num stack próprio e registrar os 4 sub-navegadores**

Criar `apps/mobile/src/navigation/MaisNavigator.tsx`:

```typescript
// apps/mobile/src/navigation/MaisNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MaisScreen from '../screens/MaisScreen'
import PosVendaNavigator from './PosVendaNavigator'
import ComissoesNavigator from './ComissoesNavigator'
import FinanceiroNavigator from './FinanceiroNavigator'
import EquipeNavigator from './EquipeNavigator'

const Stack = createNativeStackNavigator()

export default function MaisNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MaisMenu" component={MaisScreen} />
      <Stack.Screen name="PosVenda" component={PosVendaNavigator} />
      <Stack.Screen name="Comissoes" component={ComissoesNavigator} />
      <Stack.Screen name="Financeiro" component={FinanceiroNavigator} />
      <Stack.Screen name="Equipe" component={EquipeNavigator} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 4: Atualizar `MainTabs.tsx` para usar `MaisNavigator` no lugar de `MaisScreen`**

Ler `apps/mobile/src/navigation/MainTabs.tsx` antes de editar (já modificado nas Partes 1-3 para CRM/Estoque/Chat). Trocar o import e uso de `MaisScreen` por `MaisNavigator`, com `headerShown: false` na tab "Mais".

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/MaisScreen.tsx apps/mobile/src/navigation/MaisNavigator.tsx apps/mobile/src/navigation/PosVendaNavigator.tsx apps/mobile/src/navigation/ComissoesNavigator.tsx apps/mobile/src/navigation/FinanceiroNavigator.tsx apps/mobile/src/navigation/EquipeNavigator.tsx apps/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): turn Mais tab into menu wiring posvenda, comissoes, financeiro and equipe"
```

---

### Task 9: Validação manual ponta a ponta

**Files:**
- Nenhum arquivo novo — apenas execução e verificação manual.

- [ ] **Step 1: Rodar API + Expo**

Com `pnpm --filter @sv/api dev` rodando e `pnpm --filter @sv/mobile run start` aberto no Expo Go:

1. Logar com `gestor@autopremium.com.br` / `demo123`.
2. Ir na aba "Mais" — deve mostrar o menu com Pós-venda, Minhas Comissões, Financeiro, Equipe.
3. **Pós-venda:** abrir, navegar pelas abas de estágio, abrir uma esteira, marcar um item do checklist como concluído, anexar um PDF num item de categoria documento, tentar concluir a esteira (com itens obrigatórios pendentes deve falhar com mensagem clara).
4. **Minhas Comissões:** conferir a lista e alternar entre os filtros Todas/Pendentes/Pagas.
5. **Financeiro:** conferir os KPIs, criar um lançamento de despesa vinculado a um veículo, alternar o status pago/pendente de um lançamento existente e confirmar que o saldo dos KPIs atualiza.
6. **Equipe:** convidar um novo vendedor com 2-3 módulos marcados, editar o % de comissão de um vendedor existente, editar os módulos de outro membro, testar o toggle de assistente de IA, desativar e depois remover um membro de teste.

Expected: todos os fluxos completam sem erro, refletindo no mesmo backend usado pelo `apps/gestor`.

Se todos os passos passarem, a Parte 4 (Mais) está completa — a Fase 2 do mobile (M045) está inteiramente especificada e pronta para implementação.
