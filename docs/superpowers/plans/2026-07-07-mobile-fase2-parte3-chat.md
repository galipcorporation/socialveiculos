# Mobile Fase 2 — Parte 3: Chat (B2B + B2C + Repasses) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder `ChatScreen.tsx` pelo módulo de Chat completo: conversas B2B+B2C unificadas com tempo real via WebSocket, feed de repasses entre lojas, propostas de repasse e busca de lojas parceiras.

**Architecture:** Stack de navegação próprio dentro da aba Chat (Conversas → Conversa individual; Feed de Repasses → Propostas ↔ Parceiros, acessíveis a partir de um menu). Reaproveita `lib/ws.ts` (já portado na Fase 1) sem alterações — a mesma função `createReconnectingSocket` atende os dois canais (`/v1/b2b/chat/ws` e `/v1/vitrine/chat/ws`), abrindo um socket por vez para a conversa/canal ativo. Contagem de não lidos é derivada client-side comparando `ultima_mensagem_data` e mensagens vistas, igual ao padrão do `chatStore` do gestor web.

**Tech Stack:** React Native 0.86 + Expo ~57, TypeScript ~6.0. Sem novas dependências — usa `WebSocket` global do RN já coberto por `lib/ws.ts`.

## Global Constraints

- Não modificar nenhum arquivo em `apps/gestor` — portabilidade por duplicação.
- Sem `packages/shared` nesta fase.
- Sem etapa de mockup HTML prévio — implementar direto em React Native.
- Depende da Parte 1 já aplicada: `apps/mobile/src/lib/{api,ws}.ts`, `apps/mobile/src/stores/uiStore.ts`.
- Triagem de leads por IA está fora de escopo desta parte (decisão do spec [[m045-mobile-fase2-design]]).
- Cor de fundo padrão: `#0B0F1A`; ícones via `@expo/vector-icons` (Ionicons).
- Credencial de teste: `gestor@autopremium.com.br` / `demo123`.

---

### Task 1: Tipos e cliente de dados do Chat (`lib/chat.ts`)

**Files:**
- Create: `apps/mobile/src/lib/chat.ts`

**Interfaces:**
- Consumes: `api` de `./api`.
- Produces: tipos `VeiculoResumoChat`, `Curtida`, `Comentario`, `PublicacaoB2B`, `PropostaRepasse`, `LojaParceira`, `Conversa`, `Mensagem`; funções `listarRepasses()`, `curtirRepasse(id)`, `enviarPropostaRepasse(body)`, `listarPropostas(direcao)`, `atualizarStatusProposta(id, status)`, `buscarParceiros(params?)`, `listarConversasB2B()`, `listarMensagensB2B(conversaId)`, `enviarMensagemB2B(conversaId, conteudo)`, `iniciarConversaB2B(outraLojaId)`, `listarConversasB2C()`, `listarMensagensB2C(conversaId)`, `enviarMensagemB2C(conversaId, conteudo)`. Usado pelas telas das Tasks 3-6.

- [ ] **Step 1: Criar `lib/chat.ts`**

```typescript
// apps/mobile/src/lib/chat.ts
import { api } from './api'

export interface VeiculoResumoChat {
  id: string
  marca: string
  modelo: string
  versao?: string
  ano_fabricacao: number
  ano_modelo: number
  km: number
  cor?: string
  preco_venda: number
  status: string
  midias: { id: string; tipo: string; url: string; ordem: number }[]
}

export interface Curtida {
  id: string
  publicacao_id: string
  usuario_id: string
  created_at: string
}

export interface Comentario {
  id: string
  publicacao_id: string
  autor_id: string
  autor_nome: string
  conteudo: string
  created_at: string
}

export interface PublicacaoB2B {
  id: string
  loja_id: string
  loja_nome: string
  veiculo_id: string
  veiculo: VeiculoResumoChat
  autor_id?: string
  autor_nome: string
  conteudo?: string
  valor_repasse?: number
  ativa: boolean
  created_at: string
  updated_at: string
  comentarios: Comentario[]
  curtidas: Curtida[]
  curtido_por_mim: boolean
}

export type StatusProposta = 'pendente' | 'aceita' | 'rejeitada' | 'cancelada'

export interface PropostaRepasse {
  id: string
  loja_proponente_id: string
  loja_proponente_nome: string
  loja_destino_id: string
  loja_destino_nome: string
  veiculo_id: string
  veiculo: VeiculoResumoChat
  valor_proposta: number
  status: StatusProposta
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface LojaParceira {
  id: string
  nome: string
  slug: string
  logo_url?: string
  telefone?: string
  whatsapp?: string
  email?: string
  cidade?: string
  estado?: string
  verificada: boolean
}

export interface Conversa {
  id: string
  tipo: 'b2c' | 'b2b'
  loja_a_id: string
  loja_a_nome: string
  loja_b_id: string
  loja_b_nome: string
  ativa: boolean
  created_at: string
  updated_at: string
  ultima_mensagem?: string
  ultima_mensagem_data?: string
  mensagens_nao_lidas?: number
}

export interface Mensagem {
  id: string
  conversa_id: string
  autor_id: string
  autor_nome: string
  conteudo: string
  lida: boolean
  created_at: string
}

export function listarRepasses(): Promise<PublicacaoB2B[]> {
  return api.get<PublicacaoB2B[]>('/b2b/repasses')
}

export function curtirRepasse(pubId: string): Promise<void> {
  return api.post(`/b2b/repasses/${pubId}/curtir`)
}

export function enviarPropostaRepasse(body: {
  publicacao_id: string
  valor_proposta: number
  observacoes?: string
}): Promise<PropostaRepasse> {
  return api.post<PropostaRepasse>('/b2b/propostas', body)
}

export function listarPropostas(direcao: 'recebidas' | 'enviadas'): Promise<PropostaRepasse[]> {
  return api.get<PropostaRepasse[]>(`/b2b/propostas/${direcao}`)
}

export function atualizarStatusProposta(id: string, status: StatusProposta): Promise<void> {
  return api.patch(`/b2b/propostas/${id}/status`, { status })
}

export function buscarParceiros(params?: { q?: string; cidade?: string; estado?: string }): Promise<LojaParceira[]> {
  return api.get<LojaParceira[]>('/b2b/parceiros', params as Record<string, string> | undefined)
}

export function iniciarConversaB2B(outraLojaId: string): Promise<{ id: string }> {
  return api.post<{ id: string }>('/b2b/chat/conversas', { outra_loja_id: outraLojaId })
}

export function listarConversasB2B(): Promise<Conversa[]> {
  return api.get<Conversa[]>('/b2b/chat/conversas')
}

export function listarMensagensB2B(conversaId: string): Promise<Mensagem[]> {
  return api.get<Mensagem[]>(`/b2b/chat/conversas/${conversaId}/mensagens`)
}

export function enviarMensagemB2B(conversaId: string, conteudo: string): Promise<Mensagem> {
  return api.post<Mensagem>(`/b2b/chat/conversas/${conversaId}/mensagens`, { conteudo })
}

export function listarConversasB2C(): Promise<Conversa[]> {
  return api.get<Conversa[]>('/vitrine/chat/conversas')
}

export function listarMensagensB2C(conversaId: string): Promise<Mensagem[]> {
  return api.get<Mensagem[]>(`/vitrine/chat/conversas/${conversaId}/mensagens`)
}

export function enviarMensagemB2C(conversaId: string, conteudo: string): Promise<Mensagem> {
  return api.post<Mensagem>(`/vitrine/chat/conversas/${conversaId}/mensagens`, { conteudo })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/chat.ts
git commit -m "feat(mobile): add chat data layer (types + API calls for B2B/B2C/repasses)"
```

---

### Task 2: Tela `ConversasListScreen` (unificada B2B + B2C)

**Files:**
- Create: `apps/mobile/src/screens/chat/ConversasListScreen.tsx`

**Interfaces:**
- Consumes: `listarConversasB2B`, `listarConversasB2C`, type `Conversa` de `../../lib/chat`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`; `useAuthStore` de `../../stores/authStore` (para saber o `loja_id` do usuário e exibir o nome da "outra loja").
- Produces: `ConversasListScreen` — default export, tela raiz do Chat. Ao tocar numa conversa, navega para `Conversa` passando `{ conversaId, tipo: 'b2b'|'b2c', nomeOutraParte }`.

- [ ] **Step 1: Criar `ConversasListScreen.tsx`**

```typescript
// apps/mobile/src/screens/chat/ConversasListScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { listarConversasB2B, listarConversasB2C, type Conversa } from '../../lib/chat'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'

interface ConversaComTipo extends Conversa {
  tipoCanal: 'b2b' | 'b2c'
}

function nomeOutraParte(conversa: Conversa, lojaId: string | null | undefined): string {
  if (conversa.loja_a_id === lojaId) return conversa.loja_b_nome
  return conversa.loja_a_nome
}

function formatarData(iso?: string): string {
  if (!iso) return ''
  const data = new Date(iso)
  const hoje = new Date()
  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return data.toLocaleDateString('pt-BR')
}

export default function ConversasListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const lojaId = useAuthStore((s) => s.user?.loja_id)

  const [conversas, setConversas] = useState<ConversaComTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [b2b, b2c] = await Promise.all([listarConversasB2B(), listarConversasB2C()])
      const todas: ConversaComTipo[] = [
        ...b2b.map((c) => ({ ...c, tipoCanal: 'b2b' as const })),
        ...b2c.map((c) => ({ ...c, tipoCanal: 'b2c' as const })),
      ].sort((a, b) => {
        const da = a.ultima_mensagem_data ? new Date(a.ultima_mensagem_data).getTime() : 0
        const db = b.ultima_mensagem_data ? new Date(b.ultima_mensagem_data).getTime() : 0
        return db - da
      })
      setConversas(todas)
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

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('RepassesFeed')}>
          <Ionicons name="repeat-outline" size={16} color="#3B82F6" />
          <Text style={styles.headerBtnText}>Repasses</Text>
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('Parceiros')}>
          <Ionicons name="business-outline" size={16} color="#3B82F6" />
          <Text style={styles.headerBtnText}>Parceiros</Text>
        </Pressable>
      </View>

      <FlatList
        data={conversas}
        keyExtractor={(c) => `${c.tipoCanal}-${c.id}`}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              carregar()
            }}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma conversa ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() =>
              navigation.navigate('Conversa', {
                conversaId: item.id,
                tipo: item.tipoCanal,
                nomeOutraParte: nomeOutraParte(item, lojaId),
              })
            }
          >
            <View style={[styles.badge, item.tipoCanal === 'b2b' ? styles.badgeB2B : styles.badgeB2C]}>
              <Text style={styles.badgeText}>{item.tipoCanal.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.nome} numberOfLines={1}>{nomeOutraParte(item, lojaId)}</Text>
              {item.ultima_mensagem ? (
                <Text style={styles.ultimaMensagem} numberOfLines={1}>{item.ultima_mensagem}</Text>
              ) : null}
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.data}>{formatarData(item.ultima_mensagem_data)}</Text>
              {item.mensagens_nao_lidas ? (
                <View style={styles.contador}>
                  <Text style={styles.contadorText}>{item.mensagens_nao_lidas}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { flexDirection: 'row', gap: 8, padding: 16 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#151B29',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  headerBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
  lista: { paddingHorizontal: 16, paddingBottom: 40 },
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
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  badgeB2B: { backgroundColor: '#1E293B' },
  badgeB2C: { backgroundColor: '#1E3A2F' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  nome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ultimaMensagem: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  metaCol: { alignItems: 'flex-end' },
  data: { color: '#9AA5B1', fontSize: 11 },
  contador: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  contadorText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: erros esperados apontando telas ainda inexistentes referenciadas por `navigation.navigate` (não gera erro de tipo, pois `navigation` é `any`). Confirmar que não há outros erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/chat/ConversasListScreen.tsx
git commit -m "feat(mobile): add unified B2B/B2C conversations list screen"
```

---

### Task 3: Tela `ConversaScreen` (WebSocket em tempo real)

**Files:**
- Create: `apps/mobile/src/screens/chat/ConversaScreen.tsx`

**Interfaces:**
- Consumes: `listarMensagensB2B`, `enviarMensagemB2B`, `listarMensagensB2C`, `enviarMensagemB2C`, type `Mensagem` de `../../lib/chat`; `createReconnectingSocket` de `../../lib/ws`; `useAuthStore` de `../../stores/authStore`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `ConversaScreen` — default export, recebe `{ conversaId: string; tipo: 'b2b'|'b2c'; nomeOutraParte: string }` via route params.

- [ ] **Step 1: Criar `ConversaScreen.tsx`**

```typescript
// apps/mobile/src/screens/chat/ConversaScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import {
  listarMensagensB2B,
  enviarMensagemB2B,
  listarMensagensB2C,
  enviarMensagemB2C,
  type Mensagem,
} from '../../lib/chat'
import { createReconnectingSocket, type ReconnectingSocket } from '../../lib/ws'
import { useAuthStore } from '../../stores/authStore'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function ConversaScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { conversaId, tipo, nomeOutraParte } = route.params as {
    conversaId: string
    tipo: 'b2b' | 'b2c'
    nomeOutraParte: string
  }
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.user?.id)
  const showError = useUIStore((s) => s.showError)

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const socketRef = useRef<ReconnectingSocket | null>(null)

  useEffect(() => {
    navigation.setOptions({ title: nomeOutraParte })
  }, [navigation, nomeOutraParte])

  const listarMensagens = tipo === 'b2b' ? listarMensagensB2B : listarMensagensB2C
  const enviarMensagem = tipo === 'b2b' ? enviarMensagemB2B : enviarMensagemB2C
  const wsPath = tipo === 'b2b' ? '/v1/b2b/chat/ws' : '/v1/vitrine/chat/ws'

  const carregar = useCallback(async () => {
    try {
      const data = await listarMensagens(conversaId)
      setMensagens(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [conversaId, listarMensagens, showError])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!token) return
    const socket = createReconnectingSocket(`${wsPath}?token=${token}`, {
      onMessage: (event) => {
        try {
          const msg: Mensagem = JSON.parse(event.data)
          if (msg.conversa_id === conversaId) {
            setMensagens((atual) => [msg, ...atual])
          }
        } catch {
          // mensagem não reconhecida, ignora
        }
      },
    })
    socketRef.current = socket
    return () => socket.close()
  }, [token, wsPath, conversaId])

  const enviar = async () => {
    const conteudo = texto.trim()
    if (!conteudo) return
    setTexto('')
    setEnviando(true)
    try {
      const msg = await enviarMensagem(conversaId, conteudo)
      setMensagens((atual) => [msg, ...atual])
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={mensagens}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          const minha = item.autor_id === userId
          return (
            <View style={[styles.bolha, minha ? styles.bolhaMinha : styles.bolhaOutro]}>
              {!minha ? <Text style={styles.autor}>{item.autor_nome}</Text> : null}
              <Text style={styles.conteudo}>{item.conteudo}</Text>
              <Text style={styles.hora}>
                {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#5B6472"
          value={texto}
          onChangeText={setTexto}
          multiline
        />
        <Pressable style={styles.botaoEnviar} onPress={enviar} disabled={enviando || !texto.trim()}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  lista: { padding: 16, gap: 8 },
  bolha: { maxWidth: '80%', borderRadius: 12, padding: 12, marginBottom: 8 },
  bolhaMinha: { backgroundColor: '#3B82F6', alignSelf: 'flex-end' },
  bolhaOutro: { backgroundColor: '#151B29', alignSelf: 'flex-start' },
  autor: { color: '#9AA5B1', fontSize: 11, marginBottom: 4, fontWeight: '600' },
  conteudo: { color: '#fff', fontSize: 14 },
  hora: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A3345',
  },
  input: {
    flex: 1,
    backgroundColor: '#151B29',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
    maxHeight: 120,
  },
  botaoEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/chat/ConversaScreen.tsx
git commit -m "feat(mobile): add realtime conversation screen with websocket"
```

---

### Task 4: Tela `RepassesFeedScreen`

**Files:**
- Create: `apps/mobile/src/screens/chat/RepassesFeedScreen.tsx`

**Interfaces:**
- Consumes: `listarRepasses`, `curtirRepasse`, `enviarPropostaRepasse`, type `PublicacaoB2B` de `../../lib/chat`; `mascararMoeda`, `parseMoeda` de `../../lib/mascaras`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `RepassesFeedScreen` — default export.

- [ ] **Step 1: Criar `RepassesFeedScreen.tsx`**

```typescript
// apps/mobile/src/screens/chat/RepassesFeedScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, Image, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, Modal } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { listarRepasses, curtirRepasse, enviarPropostaRepasse, type PublicacaoB2B } from '../../lib/chat'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

function formatBRL(v?: number): string {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RepassesFeedScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [publicacoes, setPublicacoes] = useState<PublicacaoB2B[]>([])
  const [loading, setLoading] = useState(true)
  const [propostaAlvo, setPropostaAlvo] = useState<PublicacaoB2B | null>(null)
  const [valorProposta, setValorProposta] = useState('')
  const [enviandoProposta, setEnviandoProposta] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await listarRepasses()
      setPublicacoes(data)
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

  const toggleCurtir = async (pub: PublicacaoB2B) => {
    setPublicacoes((lista) =>
      lista.map((p) =>
        p.id === pub.id ? { ...p, curtido_por_mim: !p.curtido_por_mim } : p
      )
    )
    try {
      await curtirRepasse(pub.id)
    } catch (err) {
      setPublicacoes((lista) =>
        lista.map((p) => (p.id === pub.id ? { ...p, curtido_por_mim: pub.curtido_por_mim } : p))
      )
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const enviarProposta = async () => {
    if (!propostaAlvo) return
    const valor = parseMoeda(valorProposta)
    if (!valor) {
      showError('Informe um valor de proposta válido.')
      return
    }
    setEnviandoProposta(true)
    try {
      await enviarPropostaRepasse({ publicacao_id: propostaAlvo.id, valor_proposta: valor })
      showToast('Proposta enviada.', 'success')
      setPropostaAlvo(null)
      setValorProposta('')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setEnviandoProposta(false)
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.linkPropostas} onPress={() => navigation.navigate('Propostas')}>
        <Text style={styles.linkPropostasText}>Ver minhas propostas →</Text>
      </Pressable>

      <FlatList
        data={publicacoes}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum repasse disponível no momento.</Text>}
        renderItem={({ item }) => {
          const foto = item.veiculo.midias?.[0]?.url
          return (
            <View style={styles.card}>
              {foto ? <Image source={{ uri: foto }} style={styles.foto} /> : null}
              <View style={styles.info}>
                <Text style={styles.lojaNome}>{item.loja_nome}</Text>
                <Text style={styles.veiculoNome}>{item.veiculo.marca} {item.veiculo.modelo} {item.veiculo.ano_modelo}</Text>
                {item.valor_repasse ? <Text style={styles.valor}>{formatBRL(item.valor_repasse)}</Text> : null}
                {item.conteudo ? <Text style={styles.conteudo}>{item.conteudo}</Text> : null}

                <View style={styles.acoes}>
                  <Pressable style={styles.acaoBtn} onPress={() => toggleCurtir(item)}>
                    <Ionicons
                      name={item.curtido_por_mim ? 'heart' : 'heart-outline'}
                      size={18}
                      color={item.curtido_por_mim ? '#EF4444' : '#9AA5B1'}
                    />
                    <Text style={styles.acaoText}>{item.curtidas.length}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.acaoBtn}
                    onPress={() => {
                      setPropostaAlvo(item)
                      setValorProposta('')
                    }}
                  >
                    <Ionicons name="cash-outline" size={18} color="#3B82F6" />
                    <Text style={[styles.acaoText, { color: '#3B82F6' }]}>Propor</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )
        }}
      />

      <Modal visible={!!propostaAlvo} transparent animationType="fade" onRequestClose={() => setPropostaAlvo(null)}>
        <Pressable style={styles.overlay} onPress={() => setPropostaAlvo(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitulo}>Enviar proposta de repasse</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="R$ 0,00"
              placeholderTextColor="#5B6472"
              keyboardType="numeric"
              value={valorProposta}
              onChangeText={(v) => setValorProposta(mascararMoeda(v))}
              autoFocus
            />
            <Pressable style={styles.modalBotao} onPress={enviarProposta} disabled={enviandoProposta}>
              {enviandoProposta ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBotaoText}>Enviar</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  linkPropostas: { padding: 16 },
  linkPropostasText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
  lista: { paddingHorizontal: 16, paddingBottom: 40 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    marginBottom: 12,
    overflow: 'hidden',
  },
  foto: { width: '100%', height: 160, backgroundColor: '#1E293B' },
  info: { padding: 14 },
  lojaNome: { color: '#9AA5B1', fontSize: 12, fontWeight: '600' },
  veiculoNome: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  valor: { color: '#10B981', fontSize: 15, fontWeight: '600', marginTop: 4 },
  conteudo: { color: '#9AA5B1', fontSize: 13, marginTop: 6 },
  acoes: { flexDirection: 'row', gap: 20, marginTop: 12 },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acaoText: { color: '#9AA5B1', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#151B29', borderRadius: 12, padding: 20, width: '100%' },
  modalTitulo: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0B0F1A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
    marginBottom: 16,
  },
  modalBotao: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  modalBotaoText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/chat/RepassesFeedScreen.tsx
git commit -m "feat(mobile): add B2B repasses feed screen with like and proposal"
```

---

### Task 5: Tela `PropostasRepasseScreen`

**Files:**
- Create: `apps/mobile/src/screens/chat/PropostasRepasseScreen.tsx`

**Interfaces:**
- Consumes: `listarPropostas`, `atualizarStatusProposta`, type `PropostaRepasse` de `../../lib/chat`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `PropostasRepasseScreen` — default export, com abas "Recebidas"/"Enviadas".

- [ ] **Step 1: Criar `PropostasRepasseScreen.tsx`**

```typescript
// apps/mobile/src/screens/chat/PropostasRepasseScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { listarPropostas, atualizarStatusProposta, type PropostaRepasse, type StatusProposta } from '../../lib/chat'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<StatusProposta, string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
}

const STATUS_COR: Record<StatusProposta, string> = {
  pendente: '#F59E0B',
  aceita: '#10B981',
  rejeitada: '#EF4444',
  cancelada: '#9AA5B1',
}

export default function PropostasRepasseScreen() {
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [direcao, setDirecao] = useState<'recebidas' | 'enviadas'>('recebidas')
  const [propostas, setPropostas] = useState<PropostaRepasse[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const data = await listarPropostas(direcao)
      setPropostas(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [direcao, showError])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      carregar()
    }, [carregar])
  )

  const atualizarStatus = async (proposta: PropostaRepasse, status: StatusProposta) => {
    const acaoLabel = status === 'aceita' ? 'aceitar' : status === 'rejeitada' ? 'rejeitar' : 'cancelar'
    const ok = await confirm({ message: `Confirma ${acaoLabel} esta proposta?` })
    if (!ok) return
    try {
      await atualizarStatusProposta(proposta.id, status)
      showToast('Proposta atualizada.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.abas}>
        <Pressable style={[styles.aba, direcao === 'recebidas' && styles.abaAtiva]} onPress={() => setDirecao('recebidas')}>
          <Text style={[styles.abaText, direcao === 'recebidas' && styles.abaTextAtiva]}>Recebidas</Text>
        </Pressable>
        <Pressable style={[styles.aba, direcao === 'enviadas' && styles.abaAtiva]} onPress={() => setDirecao('enviadas')}>
          <Text style={[styles.abaText, direcao === 'enviadas' && styles.abaTextAtiva]}>Enviadas</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#3B82F6" />
      ) : (
        <FlatList
          data={propostas}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhuma proposta {direcao === 'recebidas' ? 'recebida' : 'enviada'}.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.veiculoNome}>{item.veiculo.marca} {item.veiculo.modelo}</Text>
              <Text style={styles.loja}>
                {direcao === 'recebidas' ? item.loja_proponente_nome : item.loja_destino_nome}
              </Text>
              <Text style={styles.valor}>{formatBRL(item.valor_proposta)}</Text>
              <Text style={[styles.status, { color: STATUS_COR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>

              {item.status === 'pendente' && direcao === 'recebidas' && (
                <View style={styles.acoes}>
                  <Pressable style={[styles.botao, styles.botaoAceitar]} onPress={() => atualizarStatus(item, 'aceita')}>
                    <Text style={styles.botaoText}>Aceitar</Text>
                  </Pressable>
                  <Pressable style={[styles.botao, styles.botaoRejeitar]} onPress={() => atualizarStatus(item, 'rejeitada')}>
                    <Text style={styles.botaoText}>Rejeitar</Text>
                  </Pressable>
                </View>
              )}
              {item.status === 'pendente' && direcao === 'enviadas' && (
                <Pressable style={[styles.botao, styles.botaoCancelar]} onPress={() => atualizarStatus(item, 'cancelada')}>
                  <Text style={styles.botaoText}>Cancelar</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  abas: { flexDirection: 'row', gap: 8, padding: 16 },
  aba: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#151B29', alignItems: 'center' },
  abaAtiva: { backgroundColor: '#3B82F6' },
  abaText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  abaTextAtiva: { color: '#fff' },
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
  loja: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  valor: { color: '#10B981', fontSize: 15, fontWeight: '600', marginTop: 6 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  botao: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  botaoAceitar: { backgroundColor: '#10B981' },
  botaoRejeitar: { backgroundColor: '#EF4444' },
  botaoCancelar: { backgroundColor: '#EF4444', marginTop: 12 },
  botaoText: { color: '#fff', fontWeight: '600', fontSize: 13 },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/chat/PropostasRepasseScreen.tsx
git commit -m "feat(mobile): add repasse proposals screen (received/sent tabs)"
```

---

### Task 6: Tela `ParceirosListScreen`

**Files:**
- Create: `apps/mobile/src/screens/chat/ParceirosListScreen.tsx`

**Interfaces:**
- Consumes: `buscarParceiros`, `iniciarConversaB2B`, type `LojaParceira` de `../../lib/chat`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `ParceirosListScreen` — default export. Ao tocar num parceiro, cria/recupera a conversa e navega direto para `Conversa`.

- [ ] **Step 1: Criar `ParceirosListScreen.tsx`**

```typescript
// apps/mobile/src/screens/chat/ParceirosListScreen.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, Image, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { buscarParceiros, iniciarConversaB2B, type LojaParceira } from '../../lib/chat'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'

export default function ParceirosListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)

  const [busca, setBusca] = useState('')
  const [parceiros, setParceiros] = useState<LojaParceira[]>([])
  const [loading, setLoading] = useState(true)
  const [abrindoConversa, setAbrindoConversa] = useState<string | null>(null)

  const carregar = useCallback(
    async (q?: string) => {
      try {
        const data = await buscarParceiros(q ? { q } : undefined)
        setParceiros(data)
      } catch (err) {
        const { message, details } = extractErrorDetails(err)
        showError(message, details)
      } finally {
        setLoading(false)
      }
    },
    [showError]
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  const onBuscar = (texto: string) => {
    setBusca(texto)
    carregar(texto || undefined)
  }

  const abrirConversa = async (parceiro: LojaParceira) => {
    setAbrindoConversa(parceiro.id)
    try {
      const conversa = await iniciarConversaB2B(parceiro.id)
      navigation.navigate('Conversa', { conversaId: conversa.id, tipo: 'b2b', nomeOutraParte: parceiro.nome })
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setAbrindoConversa(null)
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar loja parceira..."
        placeholderTextColor="#5B6472"
        value={busca}
        onChangeText={onBuscar}
      />

      <FlatList
        data={parceiros}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma loja parceira encontrada.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => abrirConversa(item)} disabled={abrindoConversa === item.id}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoVazio]}>
                <Ionicons name="business" size={20} color="#9AA5B1" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.nomeRow}>
                <Text style={styles.nome}>{item.nome}</Text>
                {item.verificada ? <Ionicons name="checkmark-circle" size={14} color="#3B82F6" /> : null}
              </View>
              {item.cidade ? <Text style={styles.cidade}>{item.cidade}{item.estado ? ` - ${item.estado}` : ''}</Text> : null}
            </View>
            {abrindoConversa === item.id ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Ionicons name="chatbubble-outline" size={20} color="#3B82F6" />
            )}
          </Pressable>
        )}
      />
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
  lista: { paddingHorizontal: 16, paddingBottom: 40 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 12,
    marginBottom: 8,
  },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B' },
  logoVazio: { alignItems: 'center', justifyContent: 'center' },
  nomeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cidade: { color: '#9AA5B1', fontSize: 12, marginTop: 2 },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/chat/ParceirosListScreen.tsx
git commit -m "feat(mobile): add partner stores search screen"
```

---

### Task 7: Navegação interna do Chat (`ChatNavigator`)

**Files:**
- Create: `apps/mobile/src/navigation/ChatNavigator.tsx`
- Modify: `apps/mobile/src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: `ConversasListScreen` (Task 2), `ConversaScreen` (Task 3), `RepassesFeedScreen` (Task 4), `PropostasRepasseScreen` (Task 5), `ParceirosListScreen` (Task 6).
- Produces: `ChatNavigator` — componente default export.

- [ ] **Step 1: Criar `ChatNavigator.tsx`**

```typescript
// apps/mobile/src/navigation/ChatNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ConversasListScreen from '../screens/chat/ConversasListScreen'
import ConversaScreen from '../screens/chat/ConversaScreen'
import RepassesFeedScreen from '../screens/chat/RepassesFeedScreen'
import PropostasRepasseScreen from '../screens/chat/PropostasRepasseScreen'
import ParceirosListScreen from '../screens/chat/ParceirosListScreen'

export type ChatStackParamList = {
  ConversasList: undefined
  Conversa: { conversaId: string; tipo: 'b2b' | 'b2c'; nomeOutraParte: string }
  RepassesFeed: undefined
  Propostas: undefined
  Parceiros: undefined
}

const Stack = createNativeStackNavigator<ChatStackParamList>()

export default function ChatNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="ConversasList" component={ConversasListScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="Conversa" component={ConversaScreen} options={{ title: '' }} />
      <Stack.Screen name="RepassesFeed" component={RepassesFeedScreen} options={{ title: 'Repasses' }} />
      <Stack.Screen name="Propostas" component={PropostasRepasseScreen} options={{ title: 'Propostas' }} />
      <Stack.Screen name="Parceiros" component={ParceirosListScreen} options={{ title: 'Parceiros' }} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Atualizar `MainTabs.tsx` para usar `ChatNavigator` no lugar de `ChatScreen`**

Ler `apps/mobile/src/navigation/MainTabs.tsx` antes de editar. Trocar o import e uso de `ChatScreen` por `ChatNavigator`, com `headerShown: false` na tab.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/ChatNavigator.tsx apps/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): wire chat stack navigator into main tabs"
```

---

### Task 8: Validação manual ponta a ponta

**Files:**
- Nenhum arquivo novo — apenas execução e verificação manual.

- [ ] **Step 1: Rodar API + Expo**

Com `pnpm --filter @sv/api dev` rodando e `pnpm --filter @sv/mobile run start` aberto no Expo Go:

1. Logar com `gestor@autopremium.com.br` / `demo123`.
2. Aba Chat: lista de conversas B2B/B2C aparece (badge identificando o tipo).
3. Abrir uma conversa existente, enviar uma mensagem — deve aparecer imediatamente na lista.
4. Com uma segunda sessão logada (outra loja, ou o gestor web aberto em paralelo na mesma conversa), enviar uma mensagem de lá e confirmar que aparece em tempo real no mobile (via WebSocket, sem precisar recarregar).
5. Fechar o app e reabrir — o socket deve reconectar automaticamente (testar entrando em modo avião por alguns segundos e voltando).
6. Ir em "Repasses", curtir uma publicação, enviar uma proposta de repasse com valor em R$.
7. Ir em "Ver minhas propostas", conferir a proposta enviada na aba "Enviadas".
8. Ir em "Parceiros", buscar uma loja e iniciar uma conversa nova — deve navegar direto para a tela de conversa.

Expected: todos os fluxos completam sem erro, mensagens em tempo real funcionam nos dois sentidos, e os dados refletem no mesmo backend usado pelo `apps/gestor`.

Se todos os passos passarem, a Parte 3 (Chat) está completa.
