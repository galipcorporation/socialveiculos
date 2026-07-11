# Mobile Fase 2 — Parte 2: Estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder `EstoqueScreen.tsx` pelo módulo de Estoque completo: lista de veículos, formulário multi-step de cadastro/edição (Dados → Mídia → Custos → Venda), consulta de placa e fechamento de venda.

**Architecture:** Stack de navegação próprio dentro da aba Estoque (Lista → Detalhe/Formulário multi-step). Reaproveita `lib/veiculo.ts` (já portado na Parte 1) para regras de campos condicionais por tipo de veículo. Fluxo de "rascunho" igual ao web: cria o veículo com `status: RASCUNHO` assim que os dados mínimos (marca/modelo/ano) são preenchidos, liberando o upload de mídia antes de completar o resto do cadastro. Upload via `expo-image-picker` (foto/vídeo unificados) e `expo-document-picker` (PDF de documentos de venda).

**Tech Stack:** React Native 0.86 + Expo ~57, TypeScript ~6.0, `expo-image-picker`, `expo-document-picker` (novas dependências desta parte).

## Global Constraints

- Não modificar nenhum arquivo em `apps/gestor` — portabilidade por duplicação.
- Sem `packages/shared` nesta fase.
- Sem etapa de mockup HTML prévio — implementar direto em React Native.
- Depende da Parte 1 já aplicada: `apps/mobile/src/lib/{veiculo,mascaras,api}.ts`, `apps/mobile/src/stores/uiStore.ts` devem existir antes de iniciar esta parte.
- Campo de mídia é sempre único (foto e vídeo juntos, nunca separados) — regra de produto vigente em todo o projeto.
- Cor de fundo padrão: `#0B0F1A`; ícones via `@expo/vector-icons` (Ionicons).
- Credencial de teste: `gestor@autopremium.com.br` / `demo123`.

---

### Task 1: Dependências de mídia e documentos

**Files:**
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Produces: pacotes `expo-image-picker`, `expo-document-picker` disponíveis para import nas próximas tasks.

- [ ] **Step 1: Instalar via expo install**

Run (a partir da raiz do monorepo):
```bash
pnpm --filter @sv/mobile exec npx expo install expo-image-picker expo-document-picker
```
Expected: `apps/mobile/package.json` ganha as entradas em `dependencies`; `pnpm-lock.yaml` atualizado.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-image-picker and expo-document-picker"
```

---

### Task 2: Tipos e cliente de dados do Estoque (`lib/estoque.ts`)

**Files:**
- Create: `apps/mobile/src/lib/estoque.ts`

**Interfaces:**
- Consumes: `api` de `./api`; `Veiculo`, `Midia` de `./veiculo` (Parte 1).
- Produces: tipos `VeiculoListResponse`, `CustoLancamento`, `CustosVeiculoResponse`, `VeiculoDocumento`, `VendaData`, `ClienteBusca`; funções `listarVeiculos(params)`, `atualizarStatusVeiculo`, `togglePublicarVeiculo`, `excluirVeiculo`, `criarVeiculo`, `editarVeiculo`, `buscarCustosVeiculo`, `lancarCustoVeiculo`, `removerCustoVeiculo`, `consultarPlaca`, `buscarVendaData`, `vincularComprador`, `desvincularComprador`, `uploadDocumentoVenda`, `removerDocumentoVenda`, `fecharVenda`, `buscarClientesEstoque`. Usado pelas telas das Tasks 3-7.

- [ ] **Step 1: Criar `lib/estoque.ts`**

```typescript
// apps/mobile/src/lib/estoque.ts
import { api } from './api'
import type { Veiculo } from './veiculo'

export interface VeiculoListResponse {
  items: Veiculo[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface CustoLancamento {
  id: string
  descricao: string
  valor: number
  data: string
  categoria?: string | null
  observacoes?: string
}

export interface CustosVeiculoResponse {
  veiculo_id: string
  preco_compra: number
  total_preparacao: number
  custo_total: number
  custos: CustoLancamento[]
}

export interface VeiculoDocumento {
  id: string
  tipo: string
  nome: string
  url: string
  visivel_comprador: boolean
  created_at: string
}

export interface VendaData {
  veiculo_id: string
  comprador_id: string | null
  comprador_nome: string | null
  comprador_telefone: string | null
  documentos: VeiculoDocumento[]
}

export interface ClienteBusca {
  id: string
  nome: string
  telefone?: string
}

export interface ConsultaPlacaResponse {
  marca?: string
  modelo?: string
  ano_fabricacao?: number
  ano_modelo?: number
  cor?: string
  combustivel?: string
  [key: string]: unknown
}

export function listarVeiculos(params?: Record<string, string>): Promise<VeiculoListResponse> {
  return api.get<VeiculoListResponse>('/veiculos', params)
}

export function atualizarStatusVeiculo(id: string, status: string): Promise<void> {
  return api.patch(`/veiculos/${id}/status`, { status })
}

export function togglePublicarVeiculo(id: string, publicado: boolean): Promise<void> {
  return api.patch(`/veiculos/${id}/publicar`, { publicado })
}

export function excluirVeiculo(id: string, motivo?: string): Promise<{ message?: string; status?: string }> {
  return api.delete<{ message?: string; status?: string }>(
    motivo ? `/veiculos/${id}?motivo=${encodeURIComponent(motivo)}` : `/veiculos/${id}`
  )
}

export function criarVeiculo(body: Partial<Veiculo>): Promise<{ id: string }> {
  return api.post<{ id: string }>('/veiculos', body)
}

export function editarVeiculo(id: string, body: Partial<Veiculo>): Promise<Veiculo> {
  return api.patch<Veiculo>(`/veiculos/${id}`, body)
}

export function buscarVeiculo(id: string): Promise<Veiculo> {
  return api.get<Veiculo>(`/veiculos/${id}`)
}

export function buscarCustosVeiculo(id: string): Promise<CustosVeiculoResponse> {
  return api.get<CustosVeiculoResponse>(`/financeiro/veiculos/${id}/custos`)
}

export function lancarCustoVeiculo(
  id: string,
  body: { descricao: string; valor: number; data: string; categoria?: string; observacoes?: string }
): Promise<CustosVeiculoResponse> {
  return api.post<CustosVeiculoResponse>(`/financeiro/veiculos/${id}/custos`, body)
}

export function removerCustoVeiculo(id: string, lancamentoId: string): Promise<CustosVeiculoResponse> {
  return api.delete<CustosVeiculoResponse>(`/financeiro/veiculos/${id}/custos/${lancamentoId}`)
}

export function consultarPlaca(placa: string): Promise<ConsultaPlacaResponse> {
  return api.get<ConsultaPlacaResponse>(`/veiculos/consulta-placa/${placa}`)
}

export function buscarVendaData(id: string): Promise<VendaData> {
  return api.get<VendaData>(`/veiculos/${id}/venda`)
}

export function vincularComprador(id: string, clienteId: string): Promise<VendaData> {
  return api.put<VendaData>(`/veiculos/${id}/venda/comprador`, { comprador_id: clienteId })
}

export function desvincularComprador(id: string): Promise<void> {
  return api.delete(`/veiculos/${id}/venda/comprador`)
}

export function uploadDocumentoVenda(
  id: string,
  formData: FormData
): Promise<VeiculoDocumento> {
  return api.post<VeiculoDocumento>(`/veiculos/${id}/documentos/upload`, formData)
}

export function removerDocumentoVenda(id: string, docId: string): Promise<void> {
  return api.delete(`/veiculos/${id}/documentos/${docId}`)
}

export function fecharVenda(
  id: string,
  body: {
    cliente_id?: string
    cliente_novo?: { nome: string; telefone?: string }
    valor_dinheiro?: number
    trocas_veiculo_ids?: string[]
    valor_financiamento?: number
  }
): Promise<{ contrato_id: string; trocas_veiculo_ids: string[] }> {
  return api.post(`/veiculos/${id}/vender`, body)
}

export function buscarClientesEstoque(q: string): Promise<ClienteBusca[]> {
  return api
    .get<{ items: ClienteBusca[] }>('/clientes', { q, per_page: '8' })
    .then((res) => res.items)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/estoque.ts
git commit -m "feat(mobile): add estoque data layer (types + API calls)"
```

---

### Task 3: Componente `VeiculoCard` e `VeiculosListScreen`

**Files:**
- Create: `apps/mobile/src/components/VeiculoCard.tsx`
- Create: `apps/mobile/src/screens/estoque/VeiculosListScreen.tsx`

**Interfaces:**
- Consumes: `listarVeiculos`, `togglePublicarVeiculo`, type `Veiculo` de `../../lib/estoque` (e `../lib/estoque` no card); `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `VeiculoCard` — componente `{ veiculo: Veiculo; onPress(): void; onTogglePublicar(): void }`; `VeiculosListScreen` — default export, tela raiz do Estoque.

- [ ] **Step 1: Criar `VeiculoCard.tsx`**

```typescript
// apps/mobile/src/components/VeiculoCard.tsx
import React from 'react'
import { View, Text, Pressable, Image, StyleSheet, Switch } from 'react-native'
import type { Veiculo } from '../lib/veiculo'

interface VeiculoCardProps {
  veiculo: Veiculo
  onPress: () => void
  onTogglePublicar: () => void
}

function formatBRL(v?: number): string {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  repasse: 'Repasse',
  inativo: 'Inativo',
}

export default function VeiculoCard({ veiculo, onPress, onTogglePublicar }: VeiculoCardProps) {
  const foto = veiculo.midias?.[0]?.url

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {foto ? (
        <Image source={{ uri: foto }} style={styles.foto} />
      ) : (
        <View style={[styles.foto, styles.fotoVazia]} />
      )}
      <View style={styles.info}>
        <Text style={styles.titulo} numberOfLines={1}>
          {veiculo.marca} {veiculo.modelo}
        </Text>
        <Text style={styles.sub}>{veiculo.ano_modelo} {veiculo.placa ? `· ${veiculo.placa}` : ''}</Text>
        <Text style={styles.preco}>{formatBRL(veiculo.preco_venda)}</Text>
        <Text style={styles.status}>{STATUS_LABEL[veiculo.status || ''] || veiculo.status}</Text>
      </View>
      <View style={styles.publicarCol}>
        <Text style={styles.publicarLabel}>Vitrine</Text>
        <Switch
          value={!!veiculo.publicado_marketplace}
          onValueChange={onTogglePublicar}
          trackColor={{ false: '#2A3345', true: '#3B82F6' }}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#151B29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3345',
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  foto: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#1E293B' },
  fotoVazia: {},
  info: { flex: 1, marginLeft: 12 },
  titulo: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sub: { color: '#9AA5B1', fontSize: 12, marginTop: 2 },
  preco: { color: '#10B981', fontSize: 14, fontWeight: '600', marginTop: 4 },
  status: { color: '#3B82F6', fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  publicarCol: { alignItems: 'center', marginLeft: 8 },
  publicarLabel: { color: '#9AA5B1', fontSize: 10, marginBottom: 4 },
})
```

- [ ] **Step 2: Criar `VeiculosListScreen.tsx`**

```typescript
// apps/mobile/src/screens/estoque/VeiculosListScreen.tsx
import React, { useCallback, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { listarVeiculos, togglePublicarVeiculo } from '../../lib/estoque'
import type { Veiculo } from '../../lib/veiculo'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import VeiculoCard from '../../components/VeiculoCard'

export default function VeiculosListScreen() {
  const navigation = useNavigation<any>()
  const showError = useUIStore((s) => s.showError)

  const [busca, setBusca] = useState('')
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregar = useCallback(
    async (q?: string) => {
      try {
        const data = await listarVeiculos(q ? { q, per_page: '50' } : { per_page: '50' })
        setVeiculos(data.items)
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

  const togglePublicar = async (veiculo: Veiculo) => {
    const novoValor = !veiculo.publicado_marketplace
    setVeiculos((list) =>
      list.map((v) => (v.id === veiculo.id ? { ...v, publicado_marketplace: novoValor } : v))
    )
    try {
      await togglePublicarVeiculo(veiculo.id, novoValor)
    } catch (err) {
      setVeiculos((list) =>
        list.map((v) => (v.id === veiculo.id ? { ...v, publicado_marketplace: !novoValor } : v))
      )
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar veículo..."
        placeholderTextColor="#5B6472"
        value={busca}
        onChangeText={onBuscar}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#3B82F6" />
      ) : (
        <FlatList
          data={veiculos}
          keyExtractor={(v) => v.id}
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
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum veículo encontrado.</Text>}
          renderItem={({ item }) => (
            <VeiculoCard
              veiculo={item}
              onPress={() => navigation.navigate('VeiculoForm', { veiculoId: item.id })}
              onTogglePublicar={() => togglePublicar(item)}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('VeiculoForm', {})}>
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

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/VeiculoCard.tsx apps/mobile/src/screens/estoque/VeiculosListScreen.tsx
git commit -m "feat(mobile): add veiculos list screen with publish toggle"
```

---

### Task 4: `VeiculoFormScreen` — seção Dados (com consulta de placa e rascunho)

**Files:**
- Create: `apps/mobile/src/screens/estoque/VeiculoFormScreen.tsx`

**Interfaces:**
- Consumes: `criarVeiculo`, `editarVeiculo`, `buscarVeiculo`, `consultarPlaca` de `../../lib/estoque`; `TIPOS_VEICULO`, `regraDoTipo`, `ANO_MODELO_PAIRS` de `../../lib/veiculo`; `mascararMoeda`, `parseMoeda` de `../../lib/mascaras`; `extractErrorDetails` de `../../lib/api`; `useUIStore` de `../../stores/uiStore`.
- Produces: `VeiculoFormScreen` — default export, recebe `veiculoId?: string` via route params. Controla estado interno de seção ativa (`dados|midia|custos|venda`) com abas de progresso no topo — as seções Mídia/Custos/Venda são implementadas nas Tasks 5-7 como sub-componentes importados por este arquivo.

- [ ] **Step 1: Criar `VeiculoFormScreen.tsx` com a seção Dados e navegação por abas internas**

```typescript
// apps/mobile/src/screens/estoque/VeiculoFormScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { criarVeiculo, editarVeiculo, buscarVeiculo, consultarPlaca } from '../../lib/estoque'
import { TIPOS_VEICULO, regraDoTipo, ANO_MODELO_PAIRS, type Veiculo } from '../../lib/veiculo'
import { mascararMoeda, parseMoeda } from '../../lib/mascaras'
import { extractErrorDetails } from '../../lib/api'
import { useUIStore } from '../../stores/uiStore'
import VeiculoMidiaSection from './sections/VeiculoMidiaSection'
import VeiculoCustosSection from './sections/VeiculoCustosSection'
import VeiculoVendaSection from './sections/VeiculoVendaSection'

type Secao = 'dados' | 'midia' | 'custos' | 'venda'

const SECOES: { key: Secao; label: string }[] = [
  { key: 'dados', label: 'Dados' },
  { key: 'midia', label: 'Mídia' },
  { key: 'custos', label: 'Custos' },
  { key: 'venda', label: 'Venda' },
]

export default function VeiculoFormScreen() {
  const route = useRoute<any>()
  const { veiculoId: veiculoIdParam } = (route.params ?? {}) as { veiculoId?: string }
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)

  const [veiculoId, setVeiculoId] = useState<string | undefined>(veiculoIdParam)
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('dados')
  const [loading, setLoading] = useState(!!veiculoIdParam)
  const [salvando, setSalvando] = useState(false)
  const [consultandoPlaca, setConsultandoPlaca] = useState(false)

  const [tipo, setTipo] = useState('carro')
  const [placa, setPlaca] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [versao, setVersao] = useState('')
  const [anoModeloLabel, setAnoModeloLabel] = useState('')
  const [anoFabricacao, setAnoFabricacao] = useState<number>()
  const [anoModelo, setAnoModelo] = useState<number>()
  const [km, setKm] = useState('')
  const [cor, setCor] = useState('')
  const [cambio, setCambio] = useState('')
  const [combustivel, setCombustivel] = useState('')
  const [carroceria, setCarroceria] = useState('')
  const [portas, setPortas] = useState('')
  const [precoVenda, setPrecoVenda] = useState('')

  const regra = regraDoTipo(tipo)

  useEffect(() => {
    if (!veiculoIdParam) return
    buscarVeiculo(veiculoIdParam)
      .then((v) => {
        setTipo(v.tipo || 'carro')
        setPlaca(v.placa || '')
        setMarca(v.marca)
        setModelo(v.modelo)
        setVersao(v.versao || '')
        setAnoFabricacao(v.ano_fabricacao)
        setAnoModelo(v.ano_modelo)
        setKm(v.km ? String(v.km) : '')
        setCor(v.cor || '')
        setCambio(v.cambio || '')
        setCombustivel(v.combustivel || '')
        setCarroceria(v.carroceria || '')
        setPortas(v.portas ? String(v.portas) : '')
        setPrecoVenda(v.preco_venda ? mascararMoeda(v.preco_venda) : '')
      })
      .catch((err) => {
        const { message, details } = extractErrorDetails(err)
        showError(message, details)
      })
      .finally(() => setLoading(false))
  }, [veiculoIdParam, showError])

  const onConsultarPlaca = async () => {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '')
    if (placaLimpa.length < 7) {
      showError('Informe uma placa válida.')
      return
    }
    setConsultandoPlaca(true)
    try {
      const dados = await consultarPlaca(placaLimpa)
      if (dados.marca) setMarca(String(dados.marca))
      if (dados.modelo) setModelo(String(dados.modelo))
      if (dados.ano_fabricacao) setAnoFabricacao(Number(dados.ano_fabricacao))
      if (dados.ano_modelo) setAnoModelo(Number(dados.ano_modelo))
      if (dados.cor) setCor(String(dados.cor))
      if (dados.combustivel) setCombustivel(String(dados.combustivel))
      showToast('Dados da placa preenchidos.', 'success')
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setConsultandoPlaca(false)
    }
  }

  const montarBody = (): Partial<Veiculo> => ({
    tipo,
    placa: regra.placa ? placa.toUpperCase().replace(/\s/g, '') || undefined : undefined,
    marca,
    modelo,
    versao: regra.versao ? versao || undefined : undefined,
    ano_fabricacao: anoFabricacao,
    ano_modelo: anoModelo as number,
    km: regra.km ? Number(km) || undefined : undefined,
    cor: cor || undefined,
    cambio: regra.cambio ? cambio || undefined : undefined,
    combustivel: regra.combustivel ? combustivel || undefined : undefined,
    carroceria: regra.carroceria ? carroceria || undefined : undefined,
    portas: regra.portas ? Number(portas) || undefined : undefined,
    preco_venda: parseMoeda(precoVenda) || undefined,
  })

  const salvarRascunhoESeguir = async (proximaSecao: Secao) => {
    if (!marca.trim() || !modelo.trim() || !anoModelo) {
      showError('Preencha ao menos marca, modelo e ano para continuar.')
      return
    }
    setSalvando(true)
    try {
      if (veiculoId) {
        await editarVeiculo(veiculoId, montarBody())
      } else {
        const criado = await criarVeiculo({ ...montarBody(), status: 'RASCUNHO' } as Partial<Veiculo>)
        setVeiculoId(criado.id)
      }
      showToast('Dados salvos.', 'success')
      setSecaoAtiva(proximaSecao)
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
    <View style={styles.container}>
      <View style={styles.abas}>
        {SECOES.map((s) => {
          const habilitada = s.key === 'dados' || !!veiculoId
          return (
            <Pressable
              key={s.key}
              style={[styles.aba, secaoAtiva === s.key && styles.abaAtiva]}
              disabled={!habilitada}
              onPress={() => setSecaoAtiva(s.key)}
            >
              <Text style={[styles.abaText, secaoAtiva === s.key && styles.abaTextAtiva, !habilitada && styles.abaDesabilitada]}>
                {s.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {secaoAtiva === 'dados' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.label}>Tipo de veículo</Text>
          <View style={styles.tipoRow}>
            {TIPOS_VEICULO.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.tipoChip, tipo === t.value && styles.tipoChipAtivo]}
                onPress={() => setTipo(t.value)}
              >
                <Text style={[styles.tipoChipText, tipo === t.value && styles.tipoChipTextAtivo]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {regra.placa && (
            <>
              <Text style={styles.label}>Placa</Text>
              <View style={styles.placaRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={placa}
                  onChangeText={(v) => setPlaca(v.toUpperCase())}
                  placeholder="ABC1D23"
                  placeholderTextColor="#5B6472"
                  autoCapitalize="characters"
                  maxLength={7}
                />
                <Pressable style={styles.botaoConsultar} onPress={onConsultarPlaca} disabled={consultandoPlaca}>
                  {consultandoPlaca ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoConsultarText}>Consultar</Text>}
                </Pressable>
              </View>
            </>
          )}

          <Text style={styles.label}>Marca *</Text>
          <TextInput style={styles.input} value={marca} onChangeText={setMarca} placeholderTextColor="#5B6472" />

          <Text style={styles.label}>Modelo *</Text>
          <TextInput style={styles.input} value={modelo} onChangeText={setModelo} placeholderTextColor="#5B6472" />

          {regra.versao && (
            <>
              <Text style={styles.label}>Versão</Text>
              <TextInput style={styles.input} value={versao} onChangeText={setVersao} placeholderTextColor="#5B6472" />
            </>
          )}

          <Text style={styles.label}>Ano ({regra.uso === 'horas' ? 'fabricação' : 'fabricação/modelo'})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.anosScroll}>
            {ANO_MODELO_PAIRS.slice(0, 40).map((par) => (
              <Pressable
                key={par.label}
                style={[styles.anoChip, anoModelo === par.modelo && anoFabricacao === par.fabricacao && styles.anoChipAtivo]}
                onPress={() => {
                  setAnoFabricacao(par.fabricacao)
                  setAnoModelo(par.modelo)
                  setAnoModeloLabel(par.label)
                }}
              >
                <Text style={styles.anoChipText}>{par.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.row}>
            {regra.uso === 'km' && regra.km && (
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>KM</Text>
                <TextInput style={styles.input} value={km} onChangeText={(v) => setKm(v.replace(/\D/g, ''))} keyboardType="numeric" placeholderTextColor="#5B6472" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: regra.km ? 12 : 0 }}>
              <Text style={styles.label}>Cor</Text>
              <TextInput style={styles.input} value={cor} onChangeText={setCor} placeholderTextColor="#5B6472" />
            </View>
          </View>

          {(regra.cambio || regra.combustivel) && (
            <View style={styles.row}>
              {regra.cambio && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Câmbio</Text>
                  <TextInput style={styles.input} value={cambio} onChangeText={setCambio} placeholderTextColor="#5B6472" />
                </View>
              )}
              {regra.combustivel && (
                <View style={{ flex: 1, marginLeft: regra.cambio ? 12 : 0 }}>
                  <Text style={styles.label}>Combustível</Text>
                  <TextInput style={styles.input} value={combustivel} onChangeText={setCombustivel} placeholderTextColor="#5B6472" />
                </View>
              )}
            </View>
          )}

          {regra.carroceria && (
            <>
              <Text style={styles.label}>Carroceria</Text>
              <TextInput style={styles.input} value={carroceria} onChangeText={setCarroceria} placeholderTextColor="#5B6472" />
            </>
          )}

          {regra.portas && (
            <>
              <Text style={styles.label}>Portas</Text>
              <TextInput style={styles.input} value={portas} onChangeText={(v) => setPortas(v.replace(/\D/g, ''))} keyboardType="numeric" placeholderTextColor="#5B6472" />
            </>
          )}

          <Text style={styles.label}>Preço de venda</Text>
          <TextInput
            style={styles.input}
            value={precoVenda}
            onChangeText={(v) => setPrecoVenda(mascararMoeda(v))}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            placeholderTextColor="#5B6472"
          />

          <Pressable style={styles.botaoSalvar} onPress={() => salvarRascunhoESeguir('midia')} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoSalvarText}>Salvar e continuar</Text>}
          </Pressable>
        </ScrollView>
      )}

      {secaoAtiva === 'midia' && veiculoId && <VeiculoMidiaSection veiculoId={veiculoId} />}
      {secaoAtiva === 'custos' && veiculoId && <VeiculoCustosSection veiculoId={veiculoId} />}
      {secaoAtiva === 'venda' && veiculoId && <VeiculoVendaSection veiculoId={veiculoId} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  abas: { flexDirection: 'row', padding: 12, gap: 8 },
  aba: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#151B29', alignItems: 'center' },
  abaAtiva: { backgroundColor: '#3B82F6' },
  abaText: { color: '#9AA5B1', fontSize: 13, fontWeight: '600' },
  abaTextAtiva: { color: '#fff' },
  abaDesabilitada: { opacity: 0.4 },
  scroll: { flex: 1 },
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
  placaRow: { flexDirection: 'row', gap: 8 },
  botaoConsultar: { backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  botaoConsultarText: { color: '#3B82F6', fontWeight: '600', fontSize: 13 },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#151B29', borderWidth: 1, borderColor: '#2A3345' },
  tipoChipAtivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tipoChipText: { color: '#9AA5B1', fontSize: 13 },
  tipoChipTextAtivo: { color: '#fff' },
  anosScroll: { marginTop: 4 },
  anoChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#151B29', borderWidth: 1, borderColor: '#2A3345', marginRight: 8 },
  anoChipAtivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  anoChipText: { color: '#fff', fontSize: 13 },
  row: { flexDirection: 'row' },
  botaoSalvar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 32 },
  botaoSalvarText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: erros esperados apontando `./sections/VeiculoMidiaSection`, `./sections/VeiculoCustosSection`, `./sections/VeiculoVendaSection` inexistentes — criados nas Tasks 5-7. Confirmar que não há outros erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/estoque/VeiculoFormScreen.tsx
git commit -m "feat(mobile): add veiculo form screen with dados section, plate lookup and draft flow"
```

---

### Task 5: Seção Mídia (`VeiculoMidiaSection`)

**Files:**
- Create: `apps/mobile/src/screens/estoque/sections/VeiculoMidiaSection.tsx`

**Interfaces:**
- Consumes: `buscarVeiculo` de `../../../lib/estoque`; `Midia` de `../../../lib/veiculo`; `api` de `../../../lib/api` (para upload multipart); `useUIStore` de `../../../stores/uiStore`; `expo-image-picker`.
- Produces: `VeiculoMidiaSection` — componente `{ veiculoId: string }`, exibe grid de mídia existente e botão de adicionar foto/vídeo (campo único).

- [ ] **Step 1: Criar `VeiculoMidiaSection.tsx`**

```typescript
// apps/mobile/src/screens/estoque/sections/VeiculoMidiaSection.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { buscarVeiculo } from '../../../lib/estoque'
import type { Midia } from '../../../lib/veiculo'
import { api, extractErrorDetails } from '../../../lib/api'
import { useUIStore } from '../../../stores/uiStore'

interface VeiculoMidiaSectionProps {
  veiculoId: string
}

export default function VeiculoMidiaSection({ veiculoId }: VeiculoMidiaSectionProps) {
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const [midias, setMidias] = useState<Midia[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const v = await buscarVeiculo(veiculoId)
      setMidias(v.midias || [])
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [veiculoId, showError])

  useEffect(() => {
    carregar()
  }, [carregar])

  const adicionarMidia = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      showError('Permissão de galeria negada.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsMultipleSelection: true,
    })
    if (resultado.canceled || resultado.assets.length === 0) return

    setEnviando(true)
    try {
      for (const asset of resultado.assets) {
        const formData = new FormData()
        const nomeArquivo = asset.fileName || `midia-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`
        formData.append('file', {
          uri: asset.uri,
          name: nomeArquivo,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        } as unknown as Blob)

        // Fluxo em duas etapas, igual ao UploadMidia.tsx do gestor web:
        // 1) upload unificado, retorna { url, tipo }; 2) associa ao veículo.
        const uploadResult = await api.post<{ url: string; tipo: string }>('/midias/upload', formData)
        await api.post(`/veiculos/${veiculoId}/midias`, { url: uploadResult.url, tipo: uploadResult.tipo })
      }
      showToast('Mídia enviada.', 'success')
      carregar()
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
    <View style={styles.container}>
      <FlatList
        data={midias}
        keyExtractor={(m) => m.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma mídia adicionada ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.thumbWrapper}>
            {item.tipo === 'video' ? (
              <View style={[styles.thumb, styles.videoThumb]}>
                <Ionicons name="play-circle" size={28} color="#fff" />
              </View>
            ) : (
              <Image source={{ uri: item.url }} style={styles.thumb} />
            )}
          </View>
        )}
      />

      <Pressable style={styles.botaoAdicionar} onPress={adicionarMidia} disabled={enviando}>
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={styles.botaoAdicionarText}>Adicionar foto ou vídeo</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  grid: { paddingBottom: 20 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 20 },
  thumbWrapper: { width: '33%', padding: 4 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#1E293B' },
  videoThumb: { alignItems: 'center', justifyContent: 'center' },
  botaoAdicionar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  botaoAdicionarText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/estoque/sections/VeiculoMidiaSection.tsx
git commit -m "feat(mobile): add veiculo media section with unified photo/video upload"
```

---

### Task 6: Seção Custos (`VeiculoCustosSection`)

**Files:**
- Create: `apps/mobile/src/screens/estoque/sections/VeiculoCustosSection.tsx`

**Interfaces:**
- Consumes: `buscarCustosVeiculo`, `lancarCustoVeiculo`, `removerCustoVeiculo`, type `CustoLancamento` de `../../../lib/estoque`; `mascararMoeda`, `parseMoeda` de `../../../lib/mascaras`; `extractErrorDetails` de `../../../lib/api`; `useUIStore` de `../../../stores/uiStore`.
- Produces: `VeiculoCustosSection` — componente `{ veiculoId: string }`.

- [ ] **Step 1: Criar `VeiculoCustosSection.tsx`**

```typescript
// apps/mobile/src/screens/estoque/sections/VeiculoCustosSection.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { buscarCustosVeiculo, lancarCustoVeiculo, removerCustoVeiculo, type CustoLancamento } from '../../../lib/estoque'
import { mascararMoeda, parseMoeda } from '../../../lib/mascaras'
import { extractErrorDetails } from '../../../lib/api'
import { useUIStore } from '../../../stores/uiStore'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface VeiculoCustosSectionProps {
  veiculoId: string
}

export default function VeiculoCustosSection({ veiculoId }: VeiculoCustosSectionProps) {
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [custos, setCustos] = useState<CustoLancamento[]>([])
  const [custoTotal, setCustoTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await buscarCustosVeiculo(veiculoId)
      setCustos(data.custos)
      setCustoTotal(data.custo_total)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [veiculoId, showError])

  useEffect(() => {
    carregar()
  }, [carregar])

  const lancar = async () => {
    const valorNum = parseMoeda(valor)
    if (!descricao.trim() || !valorNum) {
      showError('Informe descrição e valor do custo.')
      return
    }
    setSalvando(true)
    try {
      await lancarCustoVeiculo(veiculoId, {
        descricao: descricao.trim(),
        valor: valorNum,
        data: new Date().toISOString().slice(0, 10),
      })
      setDescricao('')
      setValor('')
      showToast('Custo lançado.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (custo: CustoLancamento) => {
    const ok = await confirm({ title: 'Remover custo', message: `Remover "${custo.descricao}"?` })
    if (!ok) return
    try {
      await removerCustoVeiculo(veiculoId, custo.id)
      showToast('Custo removido.', 'success')
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
      <Text style={styles.total}>Custo total: {formatBRL(custoTotal)}</Text>

      <FlatList
        data={custos}
        keyExtractor={(c) => c.id}
        style={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum custo lançado ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemDescricao}>{item.descricao}</Text>
              <Text style={styles.itemValor}>{formatBRL(item.valor)}</Text>
            </View>
            <Pressable hitSlop={8} onPress={() => remover(item)}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      />

      <Text style={styles.label}>Novo custo</Text>
      <TextInput
        style={styles.input}
        placeholder="Descrição (ex: Revisão, Pintura)"
        placeholderTextColor="#5B6472"
        value={descricao}
        onChangeText={setDescricao}
      />
      <View style={styles.novoRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="R$ 0,00"
          placeholderTextColor="#5B6472"
          keyboardType="numeric"
          value={valor}
          onChangeText={(v) => setValor(mascararMoeda(v))}
        />
        <Pressable style={styles.botaoLancar} onPress={lancar} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoLancarText}>Lançar</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  total: { color: '#10B981', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  lista: { flexGrow: 0, maxHeight: 260, marginBottom: 16 },
  vazio: { color: '#9AA5B1', textAlign: 'center', marginTop: 20 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B29',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemDescricao: { color: '#fff', fontSize: 14, fontWeight: '600' },
  itemValor: { color: '#9AA5B1', fontSize: 13, marginTop: 2 },
  label: { color: '#9AA5B1', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
    marginBottom: 8,
  },
  novoRow: { flexDirection: 'row', gap: 8 },
  botaoLancar: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  botaoLancarText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/estoque/sections/VeiculoCustosSection.tsx
git commit -m "feat(mobile): add veiculo custos section"
```

---

### Task 7: Seção Venda (`VeiculoVendaSection`) — vincular comprador, documentos e fechar venda

**Files:**
- Create: `apps/mobile/src/screens/estoque/sections/VeiculoVendaSection.tsx`

**Interfaces:**
- Consumes: `buscarVendaData`, `vincularComprador`, `desvincularComprador`, `uploadDocumentoVenda`, `removerDocumentoVenda`, `fecharVenda`, `buscarClientesEstoque`, type `VendaData`/`VeiculoDocumento`/`ClienteBusca` de `../../../lib/estoque`; `mascararMoeda`, `parseMoeda` de `../../../lib/mascaras`; `extractErrorDetails` de `../../../lib/api`; `useUIStore` de `../../../stores/uiStore`; `expo-document-picker`.
- Produces: `VeiculoVendaSection` — componente `{ veiculoId: string }`.

- [ ] **Step 1: Criar `VeiculoVendaSection.tsx`**

```typescript
// apps/mobile/src/screens/estoque/sections/VeiculoVendaSection.tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import {
  buscarVendaData,
  vincularComprador,
  desvincularComprador,
  uploadDocumentoVenda,
  removerDocumentoVenda,
  fecharVenda,
  buscarClientesEstoque,
  type VendaData,
  type VeiculoDocumento,
  type ClienteBusca,
} from '../../../lib/estoque'
import { mascararMoeda, parseMoeda } from '../../../lib/mascaras'
import { extractErrorDetails } from '../../../lib/api'
import { useUIStore } from '../../../stores/uiStore'

interface VeiculoVendaSectionProps {
  veiculoId: string
}

export default function VeiculoVendaSection({ veiculoId }: VeiculoVendaSectionProps) {
  const showError = useUIStore((s) => s.showError)
  const showToast = useUIStore((s) => s.showToast)
  const confirm = useUIStore((s) => s.confirm)

  const [vendaData, setVendaData] = useState<VendaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [enviandoDoc, setEnviandoDoc] = useState(false)
  const [valorDinheiro, setValorDinheiro] = useState('')
  const [fechando, setFechando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await buscarVendaData(veiculoId)
      setVendaData(data)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setLoading(false)
    }
  }, [veiculoId, showError])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (vendaData?.comprador_id) return
    const timer = setTimeout(() => {
      if (buscaCliente.length >= 2) {
        buscarClientesEstoque(buscaCliente).then(setClientes).catch(() => setClientes([]))
      } else {
        setClientes([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaCliente, vendaData?.comprador_id])

  const selecionarComprador = async (cliente: ClienteBusca) => {
    try {
      await vincularComprador(veiculoId, cliente.id)
      showToast('Comprador vinculado.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const removerComprador = async () => {
    const ok = await confirm({ message: 'Desvincular o comprador deste veículo?' })
    if (!ok) return
    try {
      await desvincularComprador(veiculoId)
      showToast('Comprador desvinculado.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const anexarDocumento = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (resultado.canceled || !resultado.assets?.[0]) return
    const asset = resultado.assets[0]

    setEnviandoDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: 'application/pdf',
      } as unknown as Blob)
      formData.append('tipo', 'documento_venda')
      formData.append('visivel_comprador', 'true')
      await uploadDocumentoVenda(veiculoId, formData)
      showToast('Documento anexado.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setEnviandoDoc(false)
    }
  }

  const removerDoc = async (doc: VeiculoDocumento) => {
    const ok = await confirm({ title: 'Remover documento', message: `Remover "${doc.nome}"?` })
    if (!ok) return
    try {
      await removerDocumentoVenda(veiculoId, doc.id)
      showToast('Documento removido.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    }
  }

  const finalizarVenda = async () => {
    if (!vendaData?.comprador_id) {
      showError('Vincule um comprador antes de fechar a venda.')
      return
    }
    const valorNum = parseMoeda(valorDinheiro)
    const ok = await confirm({ title: 'Fechar venda', message: 'Confirma o fechamento desta venda? Esta ação não pode ser desfeita.' })
    if (!ok) return
    setFechando(true)
    try {
      await fecharVenda(veiculoId, {
        cliente_id: vendaData.comprador_id,
        valor_dinheiro: valorNum || undefined,
      })
      showToast('Venda fechada com sucesso.', 'success')
      carregar()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      showError(message, details)
    } finally {
      setFechando(false)
    }
  }

  if (loading || !vendaData) {
    return <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
  }

  return (
    <View style={styles.container}>
      <Text style={styles.secaoTitulo}>Comprador</Text>
      {vendaData.comprador_id ? (
        <View style={styles.compradorRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compradorNome}>{vendaData.comprador_nome}</Text>
            {vendaData.comprador_telefone ? <Text style={styles.compradorTelefone}>{vendaData.comprador_telefone}</Text> : null}
          </View>
          <Pressable onPress={removerComprador}>
            <Text style={styles.link}>desvincular</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Buscar cliente..."
            placeholderTextColor="#5B6472"
            value={buscaCliente}
            onChangeText={setBuscaCliente}
          />
          <FlatList
            data={clientes}
            keyExtractor={(c) => c.id}
            style={styles.buscaLista}
            renderItem={({ item }) => (
              <Pressable style={styles.buscaItem} onPress={() => selecionarComprador(item)}>
                <Text style={styles.buscaItemText}>{item.nome}</Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.secaoTitulo}>Documentos</Text>
      <FlatList
        data={vendaData.documentos}
        keyExtractor={(d) => d.id}
        style={styles.docsLista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum documento anexado.</Text>}
        renderItem={({ item }) => (
          <View style={styles.docItem}>
            <Ionicons name="document-text-outline" size={18} color="#9AA5B1" />
            <Text style={styles.docNome} numberOfLines={1}>{item.nome}</Text>
            <Pressable hitSlop={8} onPress={() => removerDoc(item)}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      />
      <Pressable style={styles.botaoAnexar} onPress={anexarDocumento} disabled={enviandoDoc}>
        {enviandoDoc ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoAnexarText}>Anexar documento (PDF)</Text>}
      </Pressable>

      <Text style={styles.secaoTitulo}>Fechar venda</Text>
      <TextInput
        style={styles.input}
        placeholder="Valor em dinheiro (R$)"
        placeholderTextColor="#5B6472"
        keyboardType="numeric"
        value={valorDinheiro}
        onChangeText={(v) => setValorDinheiro(mascararMoeda(v))}
      />
      <Pressable style={styles.botaoFechar} onPress={finalizarVenda} disabled={fechando}>
        {fechando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoFecharText}>Fechar venda</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  secaoTitulo: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  input: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A3345',
    marginBottom: 8,
  },
  compradorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
  },
  compradorNome: { color: '#fff', fontSize: 15, fontWeight: '600' },
  compradorTelefone: { color: '#9AA5B1', fontSize: 13 },
  link: { color: '#EF4444', fontSize: 13 },
  buscaLista: { maxHeight: 140 },
  buscaItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A3345' },
  buscaItemText: { color: '#fff', fontSize: 14 },
  vazio: { color: '#9AA5B1', fontSize: 13 },
  docsLista: { maxHeight: 160, marginBottom: 8 },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#151B29',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  docNome: { color: '#fff', fontSize: 13, flex: 1 },
  botaoAnexar: { backgroundColor: '#1E293B', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  botaoAnexarText: { color: '#3B82F6', fontWeight: '600' },
  botaoFechar: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  botaoFecharText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros. Todos os imports de `../../screens/estoque/VeiculoFormScreen.tsx` (Task 4) agora resolvem.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/estoque/sections/VeiculoVendaSection.tsx
git commit -m "feat(mobile): add veiculo venda section (buyer, documents, close sale)"
```

---

### Task 8: Navegação interna do Estoque (`EstoqueNavigator`)

**Files:**
- Create: `apps/mobile/src/navigation/EstoqueNavigator.tsx`
- Modify: `apps/mobile/src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: `VeiculosListScreen` (Task 3), `VeiculoFormScreen` (Task 4-7).
- Produces: `EstoqueNavigator` — componente default export.

- [ ] **Step 1: Criar `EstoqueNavigator.tsx`**

```typescript
// apps/mobile/src/navigation/EstoqueNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import VeiculosListScreen from '../screens/estoque/VeiculosListScreen'
import VeiculoFormScreen from '../screens/estoque/VeiculoFormScreen'

export type EstoqueStackParamList = {
  VeiculosList: undefined
  VeiculoForm: { veiculoId?: string }
}

const Stack = createNativeStackNavigator<EstoqueStackParamList>()

export default function EstoqueNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      <Stack.Screen name="VeiculosList" component={VeiculosListScreen} options={{ title: 'Estoque' }} />
      <Stack.Screen name="VeiculoForm" component={VeiculoFormScreen} options={{ title: 'Veículo' }} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Atualizar `MainTabs.tsx` para usar `EstoqueNavigator` no lugar de `EstoqueScreen`**

Ler `apps/mobile/src/navigation/MainTabs.tsx` antes de editar (já modificado na Parte 1 para o CRM). Trocar o import e uso de `EstoqueScreen` por `EstoqueNavigator`, com `headerShown: false` na tab.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sv/mobile run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/EstoqueNavigator.tsx apps/mobile/src/navigation/MainTabs.tsx
git commit -m "feat(mobile): wire estoque stack navigator into main tabs"
```

---

### Task 9: Validação manual ponta a ponta

**Files:**
- Nenhum arquivo novo — apenas execução e verificação manual.

- [ ] **Step 1: Rodar API + Expo**

Com `pnpm --filter @sv/api dev` rodando e `pnpm --filter @sv/mobile run start` aberto no Expo Go:

1. Logar com `gestor@autopremium.com.br` / `demo123`.
2. Aba Estoque: lista carrega veículos existentes.
3. Buscar por marca/modelo — lista filtra.
4. Alternar o switch "Vitrine" de um veículo — reflete no gestor web.
5. Criar veículo novo: escolher tipo "Carro", preencher marca/modelo/ano, salvar (cria rascunho) — deve habilitar as abas Mídia/Custos/Venda.
6. Testar consulta de placa com uma placa válida — deve preencher marca/modelo/ano/cor.
7. Ir para Mídia, adicionar uma foto da galeria — deve aparecer no grid.
8. Ir para Custos, lançar um custo de preparação — deve somar no total.
9. Ir para Venda, buscar e vincular um comprador existente, anexar um PDF, fechar a venda com valor em dinheiro.
10. Conferir no gestor web que o veículo mudou de status para vendido e o contrato foi gerado.

Expected: todos os fluxos completam sem erro, refletindo no mesmo backend usado pelo `apps/gestor`.

Se todos os passos passarem, a Parte 2 (Estoque) está completa.
