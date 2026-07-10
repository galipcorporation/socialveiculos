# Mobile API Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Trocar a camada `apps/mobile/src/services/*` de mock (AsyncStorage) para chamadas HTTP ao `apps/api` real, sem alterar telas/stores/hooks.

**Architecture:** Um `ApiClient` fetch-based (porta do gestor) em `src/lib/api.ts`. Cada service reescrito para chamar `api.*`, preservando as assinaturas exportadas em `index.ts`. Onde o DTO da API diverge do tipo interno (`types.ts`), um `mapper` local converte. `db.ts`/`seed.ts` removidos no fim.

**Tech Stack:** Expo/React Native, TypeScript, zustand (authStore), TanStack Query, fetch.

## Global Constraints
- Não alterar assinaturas exportadas em `src/services/index.ts` nem os tipos em `src/services/types.ts` (telas dependem deles).
- `baseUrl = process.env.EXPO_PUBLIC_API_URL` (prefixo `/v1` já incluído no valor).
- Token/refresh via `useAuthStore.getState()`; refresh transparente no 401.
- `tsc --noEmit` limpo ao fim de cada onda.
- Sem MFA (login+refresh só). Sem WebSocket (refetch/polling).

---

### Task 1: ApiClient (`src/lib/api.ts`)

**Files:** Create `apps/mobile/src/lib/api.ts`

**Produces:** `api.get/post/put/patch/delete<T>()`, `ApiError`, `extractErrorDetails`.

- [ ] Portar `apps/gestor/src/lib/api.ts` trocando: `API_BASE` → `process.env.EXPO_PUBLIC_API_URL`; remover `useLojaAtivaStore`/`X-Loja-Id`; remover `reportarErroServidor`; token de `useAuthStore` (RN store). Manter refresh transparente + `friendlyHttpMessage` + suporte FormData.
- [ ] `tsc --noEmit` limpo.
- [ ] Commit.

### Task 2: auth service

**Files:** Modify `apps/mobile/src/services/auth.ts`

- [ ] `login` → `api.post('/auth/login', {email, senha})` retornando `{access_token, refresh_token, user}` (shape 1:1). Remover `CONTAS`/`delay`. Manter `credenciaisDemo()`.
- [ ] `tsc` limpo. Commit.

### Task 3..N: Padrão-mestre por service (Ondas 2 e 3)

Para cada service abaixo, repetir o ciclo:
1. Ler o mock e o(s) router(s) da API lado a lado.
2. Reescrever cada método mock como chamada `api.*` ao endpoint correspondente.
3. Se o DTO da API ≠ tipo interno, escrever `mapXxx(dto): Xxx` no topo do arquivo.
4. Remover imports de `db`/`seed`/`delay`.
5. `tsc --noEmit` limpo.
6. Commit `feat(mobile): <service> via API real`.

**Onda 2 (núcleo B2B):**
- `veiculos.ts` → `/v1/veiculos*`, `/veiculos/fipe/*`, `/veiculos/{id}/precificacao|documentos|venda`, custos.
- `leads.ts` → `/v1/leads`, `/kanban`, `/leads/{id}`, interações/negociações.
- `clientes.ts` → `/v1/clientes*`.
- `chat.ts` → `/v1/b2b/chat/conversas*`.
- `esteira.ts` (esteira+comissoes) → `/v1/esteira*`, `/v1/me/comissoes`, `/v1/me/vendas`.
- `financeiro.ts` + `dashboard.ts` → `/v1` financeiro/métricas/dashboard.
- `equipe.ts` → `/v1/equipe*`.
- `config.ts` → `/v1/configuracoes*` + credenciais-ia + credenciais-detran.
- `simulador.ts` → `/v1/simulador`.
- `fipe.ts` → `/v1/veiculos/fipe/*`.
- `contratos.ts` → `/v1/contratos*`.
- `repasses.ts` → `/v1/b2b/repasses`, `/b2b/propostas*`, `/b2b/parceiros`.

**Onda 3 (externos/IA + B2C):**
- `notasFiscais.ts` → `/v1/fiscal*`.
- `site.ts` → `/v1/site*`.
- `marketing.ts` → `/v1/marketing*`.
- `modulos.ts` → `/v1/assinaturas*`.
- `vitrine.ts` → `/v1/marketplace*`, `/v1/vitrine*`, customer auth.
- `assistente` (se houver service) → `/v1/assistente*`.

### Final Task: Remover mock

**Files:** Delete `db.ts`, `seed.ts`; Modify `index.ts`

- [ ] Remover exports `resetDb`, `LOJA_NOME` (se não usados por tela); grep confirma zero imports de `./db`/`./seed`.
- [ ] `tsc --noEmit` limpo; `expo export --platform web` ok.
- [ ] Commit.

## Self-Review
- Cobertura: toda linha da spec (18 services + ApiClient + remoção mock) tem task. ✓
- Sem placeholders acionáveis: o padrão-mestre é o processo real; shapes resolvidos em execução lendo router+mock. ✓
- Consistência de tipos: `types.ts` é imutável; mappers absorvem divergência. ✓
