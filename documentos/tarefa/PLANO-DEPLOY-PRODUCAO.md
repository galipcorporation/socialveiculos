# Plano de Deploy em Produção — Social Veículos

> Objetivo: colocar a plataforma no ar esta semana (lançamento 1 cidade), com capacidade para dezenas–centenas de usuários simultâneos, em infraestrutura majoritariamente gratuita.
> Data: 2026-06-29 · Stack decidida com o fundador.

---

## 1. Arquitetura de produção

```
                         Internet
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                     │
  ┌─────▼─────┐       ┌─────▼─────┐         ┌─────▼─────┐
  │  VERCEL   │       │  VERCEL   │         │  VERCEL   │   (build estático Vite/React)
  │  gestor   │       │  vitrine  │         │  admin    │
  └─────┬─────┘       └─────┬─────┘         └─────┬─────┘
        │ rewrite /v1, /static → backend Fly      │
        └───────────────────┬─────────────────────┘
                            │ HTTPS
                     ┌──────▼───────┐         ┌──────────────────┐
                     │   FLY.IO     │  HTTP   │     FLY.IO       │
                     │  @sv/api     │◄───────►│ whatsapp-worker  │
                     │  (FastAPI)   │  env    │ (Node + Baileys) │
                     │  + worker MKT│  URLs   │ + VOLUME persist │
                     │  + WebSocket │         │  ./sessions      │
                     └──┬────────┬──┘         └──────────────────┘
                        │        │
              ┌─────────▼──┐  ┌──▼──────────────┐
              │ SUPABASE   │  │ CLOUDFLARE R2   │
              │ Postgres   │  │ fotos + JSON    │
              └────────────┘  └─────────────────┘
```

**Por que cada peça:**
- **Backend e worker NÃO vão pro Vercel.** O backend tem worker em loop (`marketing_worker`, `while True` no lifespan) + 2 WebSockets (`routers/b2b.py`, `routers/vitrine_interativo.py`). Serverless mata ambos. → Fly.io, que mantém o processo de pé 24/7.
- **Worker WhatsApp separado** num app Fly próprio. Acoplamento é só HTTP por env var (`WHATSAPP_WORKER_URL` ↔ `FASTAPI_WEBHOOK_URL`), então isolar é trivial e protege: se o Baileys cair, não derruba a API. **Baileys desconectar é comportamento esperado e previsto** — por isso fica isolado e com volume persistente pra reconectar com a sessão salva.
- **Vercel** só serve os 3 fronts (build estático), com rewrites apontando `/v1` e `/static` pro backend.

---

## 2. Pré-requisitos (contas — exigem login/cartão do fundador)

| Serviço | Free tier | Cartão exigido? | O que cria |
|---|---|---|---|
| Supabase | Postgres 500MB | Não | banco `DATABASE_URL` |
| Cloudflare R2 | 10GB/mês grátis | **Sim** (não cobra no free) | bucket fotos/JSON |
| Fly.io | 3 VMs shared-256MB | **Sim** (não cobra no free) | api + worker |
| Vercel | Hobby ilimitado | Não | 3 fronts |

---

## 3. Fases de execução

### Fase 0 — Versionamento (BLOQUEADOR, fazer primeiro)
- [ ] `git init` na raiz.
- [ ] `.gitignore` deve excluir: `*.db`, `*.db-shm*`, `*.db-wal*`, `.env`, `**/.env`, `**/sessions/`, `**/static/uploads/`, `backups/`, `__pycache__/`, `node_modules/`, `dist/`.
- [ ] Commit inicial. Criar repo no GitHub (privado).
- [ ] Conectar GitHub ao Vercel e Fly (deploy automático por push).

### Fase 1 — Banco Postgres (Supabase)
> **Regra de ouro de portas:** o **app usa a porta 6543 (pooler, modo transaction)** — combina com `NullPool` que o código já usa; o **Alembic usa a 5432 (conexão direta)** — migração não passa por pooler.

- [ ] Criar projeto Supabase, copiar as duas connection strings (pooler 6543 e direta 5432).
- [ ] URL do app (Fly secret `DATABASE_URL`): `postgresql://postgres.<ref>:<senha>@...pooler.supabase.com:6543/postgres?prepared_statement_cache_size=0`. O `_get_async_url()` em `database.py` converte `postgresql://`→`postgresql+asyncpg://` sozinho. ✔
- [ ] **Validar as 17 migrations Alembic contra Postgres** (risco conhecido: SQLite ≠ PG em alguns tipos/DDL). Rodar contra a **porta 5432 direta**, banco limpo, e corrigir o que quebrar **antes** do deploy:
  ```bash
  cd apps/api
  DATABASE_URL="postgresql://...:5432/postgres" alembic upgrade head
  ```
- [ ] Rodar `seed.py` + `seed_catalogo.py` apontando pro Postgres (catálogo FIPE, planos, usuários demo).
- [ ] NÃO usar `create_all` em prod — `main.py` já gateia isso por `api_debug=False`. ✔

### Fase 2 — Storage de fotos/JSON (Cloudflare R2)
R2 é S3-compatível → o `storage.py` já tem um `StorageProvider` que **liga o modo S3 automaticamente** quando `S3_ACCESS_KEY` + `S3_SECRET_KEY` + `S3_BUCKET_NAME` existem; senão cai no disco local (dev). Nenhuma mudança de schema: `Midia` guarda só a URL.

- [ ] Criar bucket R2 + API token (Access Key / Secret). Anotar o `Account ID`.
- [ ] Habilitar acesso público no bucket (domínio `r2.dev` ou domínio custom).
- [ ] Setar no backend (Fly secrets):
  - `S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com`
  - `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`
  - `S3_PUBLIC_URL=https://<bucket>.<accountid>.r2.dev` (ou domínio custom)
  - `S3_REGION=auto`
- [ ] **Atenção ACL:** `storage.py` faz `put_object(..., ACL="public-read")`. R2 **ignora/rejeita ACL por objeto** — a publicidade vem da config do bucket. Verificar no teste: se o `put` falhar por causa do ACL, remover o parâmetro `ACL` e deixar o bucket público por política. (Ajuste pequeno em `storage.py`.)
- [ ] **JSON/arquivos** (snapshots, exports): mesmo bucket, prefixo `json/`. Se forem privados, ler via presigned GET quando precisar.
- [ ] Testar 1 upload real ponta-a-ponta: subir foto pelo gestor → conferir que a URL pública (`S3_PUBLIC_URL/<arquivo>`) abre no navegador.

> **Evolução opcional (não-bloqueante):** hoje o arquivo passa **pelo backend** (`upload_file` recebe os bytes). Para escala, migrar para **presigned PUT** — backend só assina a URL (`generate_presigned_url("put_object", ...)`, expira ~5 min) e o front faz `PUT` direto no R2, sem trafegar a mídia pela API. Decisão de performance, deixar para depois do lançamento.

### Fase 3 — Backend FastAPI no Fly
- [ ] Criar `Dockerfile` (python:3.12-slim, instala `requirements.txt`, roda uvicorn — **sem `--reload`**).
- [ ] Criar `fly.toml`: porta interna 8000, health check em `/v1/health`, `min_machines_running=1` (não deixar dormir; senão worker MKT e WS param).
- [ ] Fly secrets: `DATABASE_URL`, `JWT_SECRET` (gerar novo: `python -c "import secrets;print(secrets.token_hex(32))"`), `APP_ENV=production`, `API_DEBUG=false`, `CORS_ORIGINS` (domínios Vercel), `WEBHOOK_SECRET`, `WHATSAPP_WORKER_URL` (URL interna do worker Fly), `WHATSAPP_WORKER_TOKEN`, todos os `S3_*`, opcional `SENTRY_DSN`.
- [ ] Deploy. Validar `/v1/health` e `/v1/docs`.

### Fase 4 — WhatsApp-worker no Fly (app separado)
- [ ] App Fly próprio (`Dockerfile` Node 20, `npm ci`, `node server.js`).
- [ ] **Volume Fly** montado em `/app/sessions` (Baileys grava `useMultiFileAuthState('./sessions/auth_info_<usuario_id>')`; sem volume, a sessão WhatsApp some a cada deploy/restart).
- [ ] Secrets: `MOCK_WHATSAPP=false`, `FASTAPI_WEBHOOK_URL` (URL interna da API Fly + `/v1/assistente/webhook`), `SERVICE_TOKEN` (= `WHATSAPP_WORKER_TOKEN` da API), `PORT=8090`.
- [ ] `min_machines_running=1`. Comunicação API↔worker por rede privada Fly (`.internal`).
- [ ] Testar: gerar QR, parear um número, enviar/receber 1 mensagem.

### Fase 5 — Fronts no Vercel
4 projetos Vercel, mesmo repo, mudando o **Root Directory** em cada (todos já têm `vercel.json` commitado):

| Projeto | Root Directory | Framework | Build | Output |
|---|---|---|---|---|
| sv-gestor | `apps/gestor` | Vite | `pnpm build` | `dist` |
| sv-vitrine | `apps/vitrine` | Vite | `pnpm build` | `dist` |
| sv-admin | `apps/admin` | Vite | `pnpm build` | `dist` |
| sv-site | `apps/site` | Vite | `pnpm build` (+ prerender) | `dist` |

> Monorepo pnpm: **Install Command** = `pnpm install --frozen-lockfile`. Se a Vercel não resolver o `packages/shared` (workspace), usar `cd ../.. && pnpm install`.

- [ ] **Rewrites** (`vercel.json` por app) mapeando `/v1/*` e `/static/*` → `https://<api>.fly.dev/...`. Substitui o proxy do `vite.config` (que só vale em dev). Os fronts usam `API_BASE='/v1'` relativo — por isso o rewrite é obrigatório.
- [ ] WebSocket da vitrine (`Mensagens.tsx` usa `localhost:8000` hardcoded) e do gestor (`RedeSocial.tsx`) — **corrigir para o host de produção** (rewrite não cobre WS; é mudança de código).
- [ ] `VITE_ADMIN_PATH` e demais envs Vite no painel Vercel.

#### Fase 5.1 — SEO / prerender da vitrine (⚠️ exige API + banco já no ar)
A vitrine **não é SPA pura**. O `pnpm build` dela faz 3 passos: `vite build` + `vite build --ssr` + **`node prerender.js`**. O `prerender.js` gera HTML estático de `/carro/:id` e `/loja/:slug` com `<title>`, Open Graph e JSON-LD (`Vehicle`/`AutoDealer`) lendo a API.

- [ ] **Ordem importa:** buildar a vitrine **só depois** da API publicada e banco migrado/semeado.
- [ ] Env no projeto `sv-vitrine`: `PRERENDER_API_URL=https://<api>.fly.dev` (o build alcança a API).
- [ ] Degradação graciosa: se a API estiver fora no build, o prerender **não falha** — só pula as rotas dinâmicas e publica a SPA shell (sem SEO nessas páginas). Re-deployar a vitrine depois que a API subir.
- [ ] Conteúdo é estático no build: carro/loja novos só entram no HTML pré-renderado no **próximo build** (em runtime o cliente busca dados frescos). Considerar Deploy Hook pra rebuild quando o estoque mudar muito.

#### Fase 5.2 — Site white-label (`apps/site`, M038)
O 4º front: sites próprios por loja em `{slug}.socialveiculos.com.br` (modelo `SiteLoja`, resolução por host via `GET /v1/public/site/{host}`).

- [ ] Criar 4º projeto Vercel `sv-site` (Root Directory `apps/site`, `vercel.json` já commitado com `PRERENDER_API_URL` no build — mesma ordem da vitrine: **buildar só depois da API no ar**).
- [ ] Registrar o domínio `socialveiculos.com.br` e apontar DNS **wildcard** `*.socialveiculos.com.br` → Vercel (adicionar `*.socialveiculos.com.br` como domain do projeto `sv-site`; Vercel emite SSL wildcard automaticamente).
- [ ] O `prerender.js` gera HTML por host publicado — configurar Deploy Hook para rebuild quando uma loja publicar/despublicar o site.
- [ ] Domínio próprio por loja (ex.: `www.lojax.com.br`) segue **fora do escopo** (pendente T-Q002).

#### Fase 5.3 — sitemap.xml e robots.txt
- [ ] O `sitemap` é servido **pela API** (`GET /v1/marketplace/sitemap`) em tempo real — não depende de rebuild. ✔
- [ ] Setar `VITRINE_BASE_URL` (env da **API**, Fly) para o domínio público da vitrine — é o host das `<loc>` do sitemap (default hoje `localhost:5174`).
- [ ] Ajustar o `Sitemap:` em `apps/vitrine/public/robots.txt` para a URL real da API (hoje aponta `localhost:8000`).

### Fase 6 — Smoke test ponta-a-ponta
- [ ] Login (credenciais demo) no gestor.
- [ ] Criar veículo + **upload de foto** (confirmar que vai pro R2 e a URL pública abre).
- [ ] Vitrine pública lista o veículo; abrir página de detalhe.
- [ ] Chat vitrine (WebSocket) conecta e troca mensagem.
- [ ] WhatsApp: parear e enviar mensagem pelo worker.
- [ ] Conferir CORS, headers de segurança, e que erros não vazam stacktrace (`api_debug=false`).

---

## 4. Capacidade esperada

- **FastAPI async + asyncpg**: não é o gargalo. Aguenta centenas de req/s numa VM pequena.
- **Limites práticos no free:**
  - Supabase free: 500MB de dados + ~60 conexões no pooler (código usa `NullPool` → correto).
  - Fly shared-256MB: apertado com worker + WS; provável subir API pra **512MB (~$2-3/mês)**.
- **Conclusão:** confortável para **100–300 usuários ativos simultâneos** numa instância. Suficiente para lançamento de 1 cidade com folga.

---

## 5. Riscos assumidos (MVP)

1. **Zero testes automatizados** — validação é o smoke test manual da Fase 6. Bugs aparecem em produção.
2. **Baileys (WhatsApp não-oficial)** — instável por natureza; desconexão é esperada (mitigado por app isolado + volume + reconexão). Risco de ban do número pelo WhatsApp.
3. **Migrations SQLite→Postgres** — risco de ajuste em alguma das 17 migrations; mitigado validando na Fase 1 antes do deploy.
4. **Fly/R2 exigem cartão** mesmo no free (não cobram dentro do limite).

---

## 6. Ordem recomendada de ataque

`Fase 0 → Fase 1 (validar migrations é o maior risco, atacar cedo) → Fase 2 → Fase 3 → Fase 4 → Fase 5 (5.1 só depois da API no ar) → Fase 6`

Estimativa: **~2 dias úteis focados.** Viável esta semana se as contas forem criadas no início.

---

## 7. Segurança — verificado no código (não é mais pendência)

Versões antigas deste plano listavam 2 bloqueios de segurança. **Ambos já estão corrigidos** no código atual:
- ✅ `config.py` — `jwt_secret` é `Field(...)` **obrigatório**, com `validate_secure_jwt_secret` que falha no boot se ausente ou igual ao default, quando `api_debug=False`.
- ✅ `routers/auth.py` — `forgot-password` **não** retorna mais `token_debug` no JSON.

Confirmar no go-live: `API_DEBUG=false` (error handler global esconde stacktrace), `CORS_ORIGINS` só com domínios reais, headers OWASP ativos (já no middleware de `main.py`), rate-limit no auth (já em `forgot-password`).

---

## 8. Mobile (futuro, não-bloqueante)

A API REST `/v1` já é o contrato único — um app mobile consome **a mesma API**, sem backend novo.
- **Tecnologia:** Expo (React Native), reusa TS e os tipos de `packages/shared`.
- **Escopo "lite":** Vitrine B2C (feed, detalhe, favoritar, login leve `register-b2c`, chat/WhatsApp) — maior valor pro consumidor e mais simples de portar.
- **Reuso:** auth JWT+refresh → `SecureStore`; upload via presigned (Fase 2 evolução); o fluxo de refresh de `lib/api.ts` é portável quase 1:1.
- **Manter:** API stateless (já é), versionamento `/v1`. **Nada a codar agora** — só preservar essas decisões.

---

> **Histórico:** este documento unifica o antigo `deploy.md` (que assumia Vercel serverless para o backend — decisão revertida para Fly.io por causa do worker + WebSockets). O plano de marketing/go-to-market continua separado em `PLANO-LANCAMENTO.md`.
