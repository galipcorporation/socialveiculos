# Mobile em produção — troca da camada mock pela API real

**Data:** 2026-07-10
**Escopo:** C (tudo — B2B, módulos externos/IA, Vitrine B2C)
**Objetivo:** `apps/mobile` deixa de usar mock (`db.ts` + AsyncStorage seed) e passa a falar HTTP com o `apps/api` real, o mesmo backend do `apps/gestor` web. As telas, hooks TanStack Query e stores **não mudam** — só a camada `src/services/*` é reescrita.

## Contexto

O `apps/mobile` foi construído mock-first: cada tela consome `src/services/*`, cujos adapters hoje leem/escrevem em `db.ts` (AsyncStorage + seed). As assinaturas exportadas em `services/index.ts` são o contrato. O `apps/api` (FastAPI, prefixo `/v1`) já expõe **todos** os endpoints necessários — mesma API do gestor web. Não há gap de backend; é trabalho puramente de front mobile.

## Arquitetura

### Núcleo: `src/lib/api.ts`
Porta React Native do `ApiClient` do gestor (`apps/gestor/src/lib/api.ts`):
- `baseUrl = process.env.EXPO_PUBLIC_API_URL` (via `.env`; fallback documentado p/ IP da LAN no Expo Go). Já existe `.env.example` com `EXPO_PUBLIC_API_URL=http://localhost:8000/v1`.
- `fetch` nativo. Token e refreshToken lidos de `useAuthStore.getState()` (zustand persistido em AsyncStorage — já existe e expõe `token`, `refreshToken`, `login`, `logout`).
- Refresh transparente no 401 → `POST /auth/refresh` → refaz request; se falhar → `logout()`.
- Header `Authorization: Bearer <token>`; `X-Loja-Id` opcional (paridade com gestor; irrelevante p/ gestor/vendedor).
- `ApiError` + `friendlyHttpMessage` idênticos ao gestor.
- Métodos `get/post/put/patch/delete`; suporte a `FormData` p/ upload de mídia/documentos (sem `Content-Type` manual — RN define o boundary).
- **Diferença RN:** sem `X-Loja-Id` store no mobile (não há multi-loja no app); anexar só se existir. `URLSearchParams` está disponível no Hermes moderno; usar; se faltar, montar query manual.

### Regra por service
Para cada service, comparar o tipo interno (`src/services/types.ts`) com o `response_model` do router. Shape bate → chamada direta. Shape diverge → `mapper` local (`apiDTO → tipo interno`) no próprio arquivo do service. Telas intactas.

### Legado
`db.ts`, `seed.ts` e os helpers de mock (`delay`, `resetDb`) são removidos ao final. Onde `delay` era importado só p/ latência simulada, remover. `resetDb`/`SEED_VERSION` deixam de ser exportados de `index.ts`.

## Ondas de execução

### Onda 1 — Fundação
- `src/lib/api.ts` (ApiClient) + wiring ao `authStore`.
- `auth` → `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Shape `LoginResponse` da API é 1:1 com `LoginResult` mock (`access_token`, `refresh_token`, `user{id,nome,email,papel,ativo,mfa_ativo,modulos,loja_id}`). **Sem MFA nesta rodada** (login+refresh só).

### Onda 2 — Núcleo B2B (endpoints prontos, paridade com gestor)
`veiculos` (`/v1/veiculos*`, `/veiculos/fipe/*`, precificação, documentos, custos, venda) · `leads` (`/v1` CRM Leads & Kanban) · `clientes` (`/v1` Clientes) · `chat` (`/v1/b2b`, `/midias`) · `esteira` + `comissoes` (`/v1/esteira`) · `financeiro` + `dashboard` (`/v1` Dashboard/Métricas/Financeiro) · `equipe` (`/v1/equipe`) · `configuracoes` + credenciais IA/DETRAN (`/v1/configuracoes*`) · `simulador` (`/v1/simulador`) · `fipe` (`/v1/veiculos/fipe/*` ou `/v1/catalogo`) · `contratos` (`/v1` Contratos) · `repasses` (`/v1/b2b/repasses`).

### Onda 3 — Módulos externos/IA + Vitrine B2C
`notasFiscais` (`/v1/fiscal`) · `site` (`/v1/site`) · `marketing` (`/v1/marketing`, `/v1` Marketing Social) · `assistente` (`/v1/assistente`) · `vitrine` (`/v1/marketplace`, `/v1/vitrine`, customer auth) · `modulos` (`/v1/assinaturas`).

## Validação
- `tsc` limpo (sem quebrar assinaturas).
- `expo export --platform web` ok.
- Smoke manual: `apps/api` rodando local + `pnpm --filter @sv/mobile start`, login real com credencial de dev (`gestor@autopremium.com.br`/`demo123`), navegar cada módulo.

## Fora de escopo
- MFA no mobile (fica p/ rodada seguinte).
- Admin/impersonação (web-only, já fora do mobile).
- WebSocket de chat em tempo real (usar polling/refetch como já faz o mock; WS é evolução).
