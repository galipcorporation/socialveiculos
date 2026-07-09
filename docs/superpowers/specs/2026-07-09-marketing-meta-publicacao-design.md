# Marketing IA — Publicação Meta ponta a ponta (gestor + mobile)

Data: 2026-07-09
Autor: brainstorming Claude + Victor

## Contexto

O backend de Marketing Social (`apps/api/routers/marketing_social.py` + `marketing_worker.py`)
já implementa OAuth Meta (Instagram/Facebook), publicação imediata e agendamento com worker.
O **gestor** (`apps/gestor/src/pages/ferramentas/Marketing.tsx`) já consome tudo isso ponta a ponta.

Lacunas:
1. O código OAuth/publicação tem fragilidades de segurança e robustez a corrigir.
2. O **mobile** só gera legenda (template mock) e compartilha via `Share` nativo — não tem
   publicar/agendar/histórico, embora já tenha `RedesSociaisScreen` (mock OAuth) e o tipo
   `RedeSocialStatus`.
3. Falta documentação (Ajuda) explicando como o usuário obtém as credenciais/APIs Meta,
   tanto no gestor quanto no mobile.

Decisões do usuário:
- Mobile: **mock-first**, espelhando o gestor (swap p/ API real = só reimplementar o service).
- Gestor: revisar/ajustar o código do backend além da doc.
- Corrigir as 4 fragilidades identificadas (CSRF, IG sem mídia, refresh de token, escolha de página).

## Frente 1 — Backend: endurecer OAuth/publicação Meta

Arquivos: `apps/api/routers/marketing_social.py`, `apps/api/marketing_worker.py`, `.env.example`.

### 1.1 CSRF no `state` do OAuth
Hoje `state = base64(loja_id)` — forjável. Um atacante pode conectar a própria conta Meta à
loja de outro.
- Gerar `state` assinado: `payload = {loja_id, nonce, ts}`; `sig = HMAC-SHA256(FERNET_KEY, payload_json)`;
  `state = base64url(payload_json + "." + sig)`.
- No callback: decodificar, recomputar HMAC, comparar em tempo constante (`hmac.compare_digest`),
  rejeitar se `ts` > 10 min. Erro 400 "State inválido ou expirado."

### 1.2 Escolha de página Meta
Hoje `pages[0]` cego. Loja com várias páginas pode conectar a errada.
- Se `len(pages) == 1`: mantém auto-seleção e salva (fluxo atual).
- Se `len(pages) > 1`: guarda a sessão pendente (token longo + páginas) numa tabela/registro
  temporário chaveado por `loja_id` + nonce, e redireciona o gestor para
  `/configuracoes#redes-sociais?escolher=<nonce>`.
  - `GET /social-auth/meta/paginas?nonce=` → lista `[{page_id, name, instagram_account_id}]`.
  - `POST /social-auth/meta/confirmar` `{nonce, page_id}` → salva a credencial escolhida (FB + IG
    vinculada) e limpa a sessão pendente.
- Sessão pendente expira em 10 min.

### 1.3 Instagram sem mídia
Publicar IG exige `image_url`. Hoje falha genérico.
- Validar antes de tentar: em `_publicar_na_rede`, se `rede == "instagram"` e `not midia_url`,
  retornar `{sucesso: False, erro: "Instagram exige ao menos uma foto no veículo."}`.
- No `agendar_post`: se `instagram` está entre as redes e o veículo não tem mídia, retornar 400
  com a mesma mensagem (falha cedo, não deixa agendar algo que vai falhar).
- No worker: mesma validação; grava a mensagem no campo `erro` do post e marca `falhou`.

### 1.4 Refresh de token (60 dias)
Token Meta expira em 60 dias; nada renova. Posts agendados além disso falham.
- Helper `_renovar_se_perto_de_expirar(cred, db)`: se `token_expira_em - now < 7 dias`, chama
  `fb_exchange_token`, regrava `access_token_cifrado` + novo `token_expira_em`.
- Chamado no worker antes de publicar cada post agendado.
- Tick diário no worker (contador de iterações; a cada 1440 loops de 60s) que varre todas as
  credenciais ativas e renova as que estão a < 7 dias de expirar, mesmo sem post pendente.

### 1.5 `.env.example`
Documentar com comentários: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `FERNET_KEY`.

## Frente 2 — Mobile: portar publicar/agendar (mock-first)

Arquivos: novo `apps/mobile/src/services/marketingSocial.ts`,
`apps/mobile/src/services/index.ts` (export),
`apps/mobile/src/screens/ferramentas/MarketingScreen.tsx`.

### 2.1 Service mock `marketingSocial.ts`
Padrão dos outros services (AsyncStorage via `db`/`mutate`, `delay`):
- `publicar({texto, hashtags, redes, veiculoId})` → `{resultados: [{rede, sucesso, erro?}]}`.
  Mock: sucesso se a rede está conectada (`db.redesSociais`) e, para IG, se o veículo tem mídia.
  Grava um `PostAgendado`-like no histórico com status `publicado`/`falhou`.
- `agendar({texto, hashtags, redes, publicarEm, veiculoId})` → cria registro status `agendado`.
- `historico()` → lista os posts da loja, desc por criado_em.
- `cancelar(id)` → status `cancelado` (só se `agendado`).
- Novo tipo `PostMarketing` em `types.ts` + seed vazio no `db`.

### 2.2 UI em `MarketingScreen.tsx`
Abaixo do card "Legenda gerada", quando há legenda:
- Card "Publicar / Agendar":
  - Reusa `configService.redesSociais()`. Se vazio → CTA "Configurar redes sociais" que navega
    para `RedesSociaisScreen`.
  - Chips de seleção das redes conectadas (multi-select).
  - `SegmentedControl` "Publicar agora / Agendar".
  - Se "Agendar": date/time picker (usar o padrão de picker já existente no app).
  - Botão "Publicar" / "Agendar publicação".
- Card "Histórico" com status colorido (publicado/agendado/falhou/cancelado) e cancelar agendado.
- Botão "Compartilhar" nativo atual permanece como fallback manual (WhatsApp/OLX etc.).
- Geração de legenda continua mock (template) — sem mudança.

## Frente 3 — Ajuda no gestor

Arquivo: `apps/gestor/src/pages/Ajuda.tsx`.
- Expandir o tópico `marketing` existente com passos reais de **conexão** (botão conectar →
  login Meta → escolher página/conta IG → publicar/agendar).
- Novo tópico `marketing-meta-setup` (`gestorOnly: true`): guia de bastidores para o dono da
  plataforma — criar app no Meta for Developers, obter App ID/Secret, produtos "Facebook Login"
  e "Instagram Graph API", configurar `META_*` no `.env`, e o aviso de que as permissões
  `instagram_content_publish` / `pages_manage_posts` exigem **App Review** da Meta (revisão do app)
  antes de funcionar em produção com contas que não sejam de teste.
- Novo FAQ: "Por que não consigo conectar o Instagram?" (conta precisa ser Instagram Business
  vinculada a uma Página do Facebook; app precisa de App Review aprovado).

## Frente 4 — Ajuda no mobile

Arquivo: `apps/mobile/src/screens/mais/config/RedesSociaisScreen.tsx`.
- O mobile **não** tem Central de Ajuda dedicada — não criar uma (YAGNI).
- Adicionar um card "Como conectar" na própria tela de Redes Sociais, com os passos de conexão
  e a nota de que a loja/plataforma precisa ter o app Meta configurado. É onde o usuário está no
  momento da ação.

## Fora de escopo (YAGNI)
- Legenda por IA real no mobile (segue mock/template).
- Publicação em WhatsApp/OLX via API (Meta cobre só FB/IG; resto é compartilhar/copiar manual).
- Central de Ajuda dedicada no mobile.

## Testes / verificação
- Backend: testes do `state` assinado (aceita válido, rejeita forjado/expirado); validação IG
  sem mídia; helper de refresh (mock do httpx). Rodar suíte pytest existente.
- Mobile: subir o app (Expo) e exercer o fluxo gerar → selecionar rede → publicar/agendar →
  histórico → cancelar; verificar CTA quando sem rede conectada.
- Gestor: conferir que a Ajuda renderiza os novos tópicos/FAQ conforme papel.
