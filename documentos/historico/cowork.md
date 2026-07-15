# cowork.md — Diário de acompanhamento automático

> Arquivo mantido pela tarefa agendada **"validao"** (roda de hora em hora enquanto você está fora).
> A cada execução eu reviso o estado do projeto (código das ferramentas, bugs, gaps e melhorias) e **acrescento uma entrada nova no topo do log**, sem apagar as anteriores. Objetivo: quando você voltar, ter aqui, claro e pronto, tudo o que andou — e o que ainda falta para fechar 100%.
>
> Convenção (atualizada na #08): a partir da #08, como você pediu explicitamente ("seja proativo", "sem que eu precise apontar coisas"), passo a **aplicar as correções seguras e verificadas** (não só recomendar). Continuo deixando para você o que é sensível mexer com a API no ar (auth, escrita no banco vivo, remoção de backdoor, `git init`) — esses ficam como patch pronto. Toda correção aplicada é **verificada ao vivo** (contra uma cópia do banco) antes de entrar.

---

## Resumo executivo — última atualização: 2026-07-11 ~BRT

**Estado geral: 🟢 feature-complete + em desenvolvimento ativo.** Nesta rodada (#20, análise tipo D / Consistência) — **6 dias desde a última rodada agente (#19)**, com bastante trabalho seu no meio: novo app **`apps/mobile`** (React Native/Expo, mock-first, reconstruído 2026-07-08) com paridade recurso-a-recurso ao gestor web (M048–M073), e bugs **B036–B043** que você fechou (Meu Site preview, chat B2B/B2C, esteira RBAC, Vite host, mobile). ⚠️ **Ambiente degradado:** o sandbox Linux caiu de novo por **falta de disco** — sem `git`/`pytest`/`py_compile` ao vivo; toda a análise desta rodada foi **estática** (leitura de código via ferramenta de arquivo). **Achei e corrigi 1 inconsistência real de timezone (B044):** 13 pontos gravavam `datetime.utcnow()` (naive, deprecado) nas mesmas colunas cujo default de INSERT já é tz-aware (`models._now()`) — padronizei para `datetime.now(timezone.utc)`, restaurando a consistência que o resto da API já segue. Sem achados de segurança/tenant novos. Nada bloqueia o uso.

- **Run #20 (2026-07-11) — análise D (Consistência), ambiente degradado (sem sandbox).** Delta grande e saudável desde a #19: **`apps/mobile` inteiro** (mock-first) + M048–M073 + B036–B043 fechados por você. Rodei uma varredura estática de consistência/produção no backend: `localhost` só em defaults de `config.py` com override por env (OK); comparações de datetime tz-aware×naive estão **defensivamente normalizadas** onde ocorrem (auth `sessao`, workers, esteira) — sem crash; dinheiro segue em `Float` (débito de design conhecido, não introduzido agora). **1 achado corrigido — B044:** `datetime.utcnow()` (naive/deprecado) em `b2b.py`/`vitrine_interativo.py`/`veiculos.py`/`pos_venda_template.py` → padronizado para `datetime.now(timezone.utc)` (o mesmo valor aware que o default de coluna já persiste). Verificação estática (grep 0 restantes + imports conferidos); **recomendo rodar `pytest` na sua máquina antes de commitar** já que não pude ao vivo. Detalhes na Execução #20.

## Resumo executivo — 2026-07-05 ~12:27 BRT (15:27 UTC)

**Estado geral: 🟢 feature-complete. Nesta rodada (#19, análise tipo C / Integração sobre o WIP grande desde a #18): subi a API ao vivo (175 rotas) e a suíte fechou 37/37 (você resolveu B030–B034 e somou +6 testes desde a #18). Auditei a integração do WIP novo — admin↔módulos, site white-label (M038), vitrine e ferramentas do gestor batem tudo certo. Achei e corrigi 1 gap: o `sitemap.xml`/`robots.txt` do "Meu Site" só existiam sob a API, fora da raiz do host onde o crawler busca (B035) → fiz o `prerender.js` emitir os dois estáticos por host. Nada bloqueia o uso hoje; maior débito é commitar o WIP.**

- **Run #19 (2026-07-05 ~12:27 BRT) — análise C (Integração) sobre o WIP acumulado desde a #18.** Ambiente saudável: **API sobe (175 rotas) e `pytest` 37/37 verde** (contra banco em disco local; no mount o SQLite dá `disk I/O error` — artefato de ambiente, não regressão). Desde a #18 você **fechou B030/B031** (os 2 que eu havia deixado) + **B032/B033/B034** e somou testes (OAuth-state, tenant-isolation, escopo de comissão). **Auditoria de integração — tudo casando:** chaves de módulo do admin = enum `Modulo` (habilitar no admin libera a rota de verdade); campos novos do site (`cidade/estado/verificada/total_veiculos`) consumidos na `Sobre.tsx`; vitrine agora filtra `Loja.ativa`; chamadas de `MeuSite`/`AssistenteIA` batem em rotas reais. **Corrigi 1 (aditivo):** **B035** — `sitemap.xml`/`robots.txt` do site white-label eram órfãos (só na API, não na raiz do host servida estático) → `prerender.js` passa a emitir os dois por host, alinhados às rotas prerenderizadas. Detalhes na Execução #19.

- **Run #18 (2026-07-04 ~13:01 BRT) — análise E+A sobre o WIP não-commitado de auth (login Google + MFA real, M029).** Ambiente saudável: **API sobe (40 rotas) e `pytest` 31/31 verde ao vivo**, incluindo `tests/test_mfa.py`. Auditei `oauth_google.py`/`auth.py`: validação do `id_token` do Google **correta** (RS256+JWKS, issuer, audience, **exige `email_verified`** → sem account-takeover por e-mail falso). **Corrigi 2** (aditivos, suíte segue verde): **B028** — `/mfa/verify-login` e `/mfa/confirm` sem rate limit (TOTP brute-forceável) → `rate_limit(5,60)`; **B029** — `google/callback` dava 422 quando o usuário nega o consentimento → agora redireciona com `#erro=…`. **Deixei 2 para sua decisão** (mexem em cookie/migração de auth em WIP seu): **B030** — `state` do OAuth gerado mas nunca validado (login-CSRF); **B031** — `/mfa/enroll` desliga o MFA ativo sem re-autenticar (bypass com sessão roubada / downgrade se abandonar). Detalhes na Execução #18.

- **Run #17 (2026-07-03 ~08:35 BRT) — análise B (RBAC/multiempresa). Ambiente saudável de novo (disco 8.4 GB, mount íntegro): `pip install` + `pytest` rodaram limpos.** (1) **Verifiquei B027 ao vivo** — subi a API via ASGITransport e criei o teste de regressão `tests/test_comissao_tenant_b027.py`: gestor da loja A criando comissão com **veículo/vendedor da loja B → 404**, com **id inexistente → 404**, e **caminho feliz → 201** com `valor_comissao` correto (1500.00). Fecha o "próximo passo" que a #16 deixou pendente (ela não tinha ambiente vivo para adicionar o teste sem risco de vermelho falso). **Suíte: 27/27 passam** (eram 26 + o novo). (2) **Auditei o RBAC novo** que você adicionou (`rbac.py` + `test_rbac_modulo_financeiro.py`): o gate de **Financeiro por módulo liberado** para vendedor (`can()` concede só `VER` quando `"financeiro" ∈ MembroLoja.modulos`; nunca CRIAR/EDITAR; inativo nunca acessa) está **correto e coberto por testes** ✅. (3) **Auditei a Esteira Pós-venda** (`routers/esteira.py`, feature nova + a página `PosVenda.tsx` que você está construindo): **escopo multi-tenant sólido** — todo endpoint passa por `_carregar_esteira(..., ctx.loja.id)` → 404 cross-loja, sem IDOR. **Achado (M037):** a esteira **não tem nenhum `exige_permissao`**; como marcar item da categoria FINANCEIRO dispara `_lancar_financeiro` (grava despesa no caixa), um **vendedor sem o módulo financeiro** consegue criar lançamento **indiretamente**, contornando o 403 que o `financeiro.py` aplica. É **decisão de política** (gatear os caminhos financeiros vs. manter esteira aberta) — registrei em M037, **não** alterei comportamento sozinho. Detalhes na Execução #17.

- **Run #16 (2026-07-02 ~21:20 BRT) — análise A (regra de negócio: venda → comissão → financeiro). Achei e corrigi um furo de integridade multi-tenant na criação de comissão (B027).** Percorri o fluxo de comissão em `financeiro.py`: `criar_comissao` deriva `valor_comissao = valor_venda × percentual` (schema já valida `valor_venda > 0` e `0 ≤ percentual ≤ 100` — ✅) e `marcar_comissao_paga` é idempotente e filtra `loja_id` (✅). **Mas `criar_comissao` gravava `vendedor_id`/`veiculo_id` vindos do request sem checar tenant:** um gestor da loja A podia atribuir a comissão a um **veículo/vendedor de outra loja** ou a um id inexistente (FK `SET NULL`, SQLite sem enforce), corrompendo atribuição de comissão e relatórios/ranking. **Corrigi:** valida que `veiculo_id` pertence a `context.loja_id` e que `vendedor_id` é membro da loja → **404** caso contrário (import de `MembroLoja` adicionado). Edição via ferramenta de arquivo (arquivo real); região reconferida. **Housekeeping (M036):** arquivo-lixo `apps/api/routers/_wtest.tmp` versionado, `socialveiculos.db` vazio na raiz e `fastapi>=0.115` em faixa aberta (causa do B026) — deixei como melhoria (ações de git/host bloqueadas no sandbox: `rm` do `_wtest.tmp` → `Operation not permitted`). **Limitações persistentes:** mount serve `financeiro.py` truncado (872 linhas cortadas mid-token) e git com índice corrompido pelo host — por isso `pytest`/`py_compile` não fecharam no sandbox; verificação por revisão de lógica (mesma postura das #13–#15). Detalhes na Execução #16.

- **Run #15 (2026-07-02 ~15:46 BRT) — você COMMITOU tudo (2º commit no git!) + rodei a suíte de testes AO VIVO pela 1ª vez e achei/corrigi 2 problemas reais.** Delta grande desde a #14: você fez `git commit` (b9552e0, "feat: bank automation modules…") trazendo **todo o WIP das #08–#14 para o controle de versão** — o gap "tudo fora do git" das rodadas anteriores **fechou**. As únicas "modificações" restantes no working tree são **puro CRLF↔LF** (0 linha de conteúdo em 6 arquivos — confirmado com `git diff -w`). **Consegui instalar deps e rodar `pytest`:** **19/21 passam**; as 2 falhas eram **testes quebrados, não regressão** — `test_smoke.py` afirmava `len(app.routes)>50` e iterava `.path`, o que o **FastAPI 0.139** (que um `pip install` limpo já traz, pois `requirements.txt` fixa `>=0.115`) mudou: o `include_router` agora registra 1 wrapper `_IncludedRouter` por router, então `len(app.routes)`=36 e nenhum path aparece, **embora o app sirva as 155 rotas** (via `app.openapi()["paths"]`). **Corrigi** o smoke test para introspectar o schema OpenAPI (fonte de verdade estável) — verificado contra o app real (`B026`). **2ª correção (higiene/DevEx):** criei `.gitattributes` (`* text=auto eol=lf`) — a causa raiz dos 27 arquivos que apareciam "modificados" sem mudança de conteúdo, poluindo todo diff (`M033`). Falta você rodar `git add --renormalize . && git commit` (git travado no sandbox). **Achados documentados (não urgentes):** ~40 deprecações do Pydantic V2 que quebram no Pydantic V3 (`M034`) e `JWT_SECRET` de 29<32 bytes (`M035`). Detalhes na Execução #15.

- **Run #14 (2026-07-02 ~06:40 BRT) — higiene de robustez aplicada: eliminei os 15 `except:` nus do motor do Simulador.** Todos os bare except (`base.py` 3, `browser_pool.py` 1, `bv.py` 2, `c6.py` 3, `itau.py` 4, `santander.py` 2) viraram `except Exception:` — mudança de palavra-chave sobre `try` já válidos, sem tocar em fluxo/log. Motivo: bare except engole `KeyboardInterrupt`/`SystemExit`, dificultando kill/shutdown limpo do worker headless. Verificado: `grep "except:"` → **0** restantes; `bv.py` e `santander.py` (os 2 que o mount serviu inteiros) compilam OK; nos outros 4 o "erro" de `py_compile` é só truncagem do mount na última linha (cauda real confirmada íntegra). Único delta seu desde a #13: `midias.py` editado às 07:14. Git ainda com 1 commit e `.git/index.lock` preso — **commitar segue pendente** (ação sua). Detalhes na Execução #14.

- Backlog de features (`TAREFAS.md`): **145/145** — o produto está, em funcionalidade, completo.
- **Correção importante da Execução #01:** os bugs **B015 e B016 (500 nas credenciais) AINDA REPRODUZEM.** A #01 concluiu que "não reproduzem mais" porque não conseguiu subir a API (só análise estática). Nesta rodada **subi a API de verdade** e reproduzi o 500. **Não feche B015/B016.** Causa raiz real diagnosticada abaixo (não é o enum — é `get_current_b2b_user` no `deps.py`, e afeta justamente a sua conta admin).
- Além do P1, o que separa o projeto de "pronto para produção" são itens de **infra de release**: **não há repositório Git** (Fase 0 do deploy, bloqueadora), **falta a dependência `email-validator`** (o boot limpo quebra sem ela) e **não há testes automatizados** (lint é `echo 'lint ok'`).
- Nenhum código foi alterado (conforme a convenção). Tudo abaixo tem correção pronta para colar.
- **Run #03 (03:15 BRT):** nada mudou desde a #02 — **nenhum arquivo tocado** e **todos os P0/P1 seguem abertos** (sem Git, `email-validator` ausente, B015/B016 na conta admin, script `dev` quebrado, `.db` vazio na raiz). **2 achados NOVOS de segurança:** `webhook_secret` com default inseguro **fora do validador de boot** (permite forjar webhook de pagamento) e **backdoor de e-mail hardcoded** na autorização (`rbac.py`, `auth.py`, `deps.py`). Detalhes na Execução #03.
- **Run #04 (04:10 BRT):** **4ª rodada seguida sem NENHUMA mudança de código** — todos os P0/P1 continuam abertos. **Detalhe novo que agrava o P0 do webhook:** `WEBHOOK_SECRET` está **ausente tanto do `.env` quanto do `.env.example`** — ou seja, a instância atual **já roda com o default inseguro** (não é só risco "se produção esquecer"), e ninguém que for fazer deploy tem como saber que precisa setá-lo. Como esta tarefa é read-only por convenção, **o projeto não vai fechar 100% sozinho**: precisa da sua decisão (aplicar você / me autorizar). Veja o "Recado direto" no fim da Execução #04.
- **Run #05 (05:10 BRT):** **5ª rodada seguida sem NENHUMA mudança de código** (nada tocado nos últimos 90 min; health-checks verdes: `py_compile` 0 erros, 24=24 routers, TAREFAS 145/0, B015/B016 seguem `[ ]`). **2 achados NOVOS de configuração/produção:** (1) o `.env` já traz `API_DEBUG=true` **+** `JWT_SECRET=troque-esta-chave-em-producao` (o próprio valor que o validador barra) — ao virar `API_DEBUG=false` para produção o boot **falha no JWT** (bom, o validador pega), **mas o `webhook_secret` fica silenciosamente no default público** porque não está no validador: o segredo que não dá pra esquecer é o guardado, e o que realmente importa (webhook de pagamento) é o que escapa; (2) `.env`/`.env.example` têm **só 8 chaves** — faltam por completo `WEBHOOK_SECRET`, `S3_*` e as chaves de IA (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`ELEVENLABS_API_KEY`), que o `assistente/motor.py` lê via `os.getenv` e, quando ausentes, **degrada para resposta mock / pula transcrição e voz** (não quebra, mas "não funciona de verdade" em produção e ninguém tem como saber que essas chaves existem). Como as anteriores, nada disso fecha sozinho: montei no fim da Execução #05 um **bloco consolidado "aplicar tudo"** (ordenado, pronto pra colar) para você fechar em ~15 min quando voltar.
- **Run #06 (06:20 BRT):** 6ª rodada seguida **sem mudança de código** — porém com **1 achado NOVO real (P1):** além do dup-insert do `victorbelocorreia@gmail.com` (#02), a conta **`admin@socialveiculos.com` nem loga** — o papel legado `ADMIN`, que não existe mais no enum (`PapelUsuario` virou `ADMIN_PLATAFORMA`), dispara `LookupError` ao carregar a linha → 500 (bug **B021**). Ou seja, agora são **2 motivos independentes** de 500 no acesso admin, os dois com fix de 1 linha de SQL. Subi a API ao vivo de novo (boot limpo, **34 rotas**), reconfirmei backlog **145/0** e B015/B016 ainda em Abertos `[ ]`. Detalhes na Execução #06.
- **Run #07 (07:23 BRT):** 7ª rodada seguida **sem mudança de código** (nada tocado desde 03:40 UTC). Subi a API pela **auth real** e **reconfirmei ao vivo os dois 500 do admin**: `victorbelocorreia@gmail.com` → `IntegrityError: UNIQUE … membro_loja` (dup-insert em `get_current_b2b_user`) e `admin@socialveiculos.com` → `LookupError: 'ADMIN' …` (papel legado, B021). **Achado NOVO menor (P3):** resíduo `Date.now()` em `assistente.py:472` (inofensivo hoje pelo guard; deve virar `datetime.now(...)`, sugiro **B022**). **Nota de método:** testar com a auth *contornada* dá falso-verde `200 []` — o 500 mora no `get_current_b2b_user`; sempre reproduzir com o admin real. Detalhes na Execução #07.
- **Run #09 (~13:40 BRT) — muita coisa nova sua desde a #08, +1 bug de segurança que eu achei e corrigi.** Detectei **desenvolvimento ativo forte**: entraram **testes automatizados** (`tests/test_smoke.py`, `test_auth_multiloja.py`, `conftest.py` + `.pytest_cache/` = já rodando) → o gap "zero testes" das #01–#05 **fechou**; a **migração `d3f8a1c46b90`** que corrige de vez **B021** (papel legado `ADMIN`) **e B015/B016** (vínculos residuais do admin); e uma **feature inteira nova — Esteira Pós-venda** (`routers/esteira.py`, `esteira_worker.py`, migração, `pos_venda_template.py`, `detran_provider.py`) + **`marketing_social.py`** (OAuth Meta/agendamento, M024), **`stories.py`**, **`triagem.py`**, **`aprovacoes.py`** e **Sentry** no boot. **Achado + conserto principal (proativo):** `POST /v1/gestor/triagem/{id}` lia a conversa **sem filtrar `loja_id`** → um gestor podia ler o histórico de mensagens de **outra loja** (IDOR multi-tenant, **B023**). Corrigi (1 linha, espelha o filtro que a rota-irmã já usa) e conferi estaticamente. **Os 3 fixes do #08 persistem** (sino de notificações, `webhook_secret` no validador, `email-validator`). ⚠️ **Limitação séria desta rodada:** o **sandbox Linux caiu por falta de espaço em disco** — **não** consegui subir a API nem rodar `py_compile`/`pytest`; **toda a análise foi estática (leitura de código)**. Por isso apliquei só o fix de 1 linha (baixíssimo risco, relido byte a byte) e deixei o resto como diagnóstico. Detalhes na Execução #09.
- **Run #11 (2026-07-02 00:25 BRT) — código real saudável; achado crítico foi do AMBIENTE, não do seu projeto.** O sandbox serviu **cópias truncadas** de 3 arquivos (`veiculos.py`, `vitrine_interativo.py`, `schemas.py`) e o `py_compile` acusou "SyntaxError". **Investiguei antes de mexer:** seus arquivos reais estão **íntegros** (confirmado pela leitura do arquivo real + git HEAD; o backend compila 0 erros na cópia restaurada). **Não apliquei patch** justamente porque escrever a partir do mount corrompido clobberaria o arquivo bom — near-miss importante. Delta novo desde a #10, todo revisado e OK: **chat WebSocket em tempo real** (auth por token + validação de participante, sem IDOR), **`ws.ts`** que corrige o proxy-de-WS-na-Vercel, **regra de contato por loja** (`contato.ts` + `loja_whatsapp` hidratado no feed/detalhe), **KePlaca real** (fecha M019) e **páginas institucionais** (Sobre/Termos/Privacidade/Anuncie). Proativos abertos (P2/P3): contatos TEMPORÁRIOS hardcoded em `contato.ts` (trocar/confirmar `galipcorporation@gmail.com` antes de escalar), **13 arquivos novos fora do git** (commitar), e WebSocket sem heartbeat/teto de conexões (sugiro B024). Detalhes na Execução #11.
- **Run #12 (2026-07-02 05:23 BRT) — implementei B024: WebSocket de chat resiliente (reconexão + heartbeat).** Os 3 consumidores de chat (vitrine `Mensagens.tsx` + os 2 do gestor `RedeSocial.tsx`) usavam `new WebSocket` cru, **sem reconexão nem keep-alive** — qualquer queda de rede/deploy/idle matava o tempo-real silenciosamente. Criei `createReconnectingSocket` em ambos `ws.ts` (backoff exponencial+jitter, heartbeat `{"type":"ping"}` a cada 25s, teardown limpo) e migrei os 3 pontos. **Zero mudança no backend** — o servidor já ignora mensagens sem `conversa_id`+`conteudo`, então o ping é inofensivo. Verifiquei a lógica com harness isolado (**14/14**). **Não consegui commitar:** `.git/index.lock` preso pelo host (mount Windows) — os 4 arquivos estão prontos no working tree; apague o lock e commite. Ambiente de novo servindo cópias truncadas (item 0 da #12), por isso editei tudo pela ferramenta de arquivo (arquivo real) e não pelo build do sandbox. Detalhes na Execução #12.
- **Run #13 (2026-07-02 06:10 BRT / 09:10 UTC) — implementei a metade backend do B024: teto de conexões por usuário no `ConnectionManager`.** Sem delta seu desde a #12 (working tree idêntico; nada tocado nos últimos ~45 min). O `ConnectionManager` (compartilhado pelo chat B2B em `b2b.py` e pelo B2C em `vitrine_interativo.py`) mantinha `active_connections` como um `dict` que crescia **sem limite** — e agora que o cliente **reconecta automaticamente** (B024 client, #12), sockets meio-abertos podem se acumular (várias abas, rede instável, deploy). Adicionei `MAX_CONNECTIONS_PER_USER = 8`: ao exceder, o `connect()` **encerra as conexões mais antigas** (FIFO, `close(WS_1013_TRY_AGAIN_LATER)`, best-effort). Verifiquei a lógica com harness isolado (cap=8, eviction FIFO, socket evictado fechado com 1013, `disconnect()` idempotente para socket já evictado, isolamento multi-usuário — **tudo passou**). Mudança de baixo risco e isolada (só o `connect`; o caminho de broadcast/escrita não muda). **Ainda não consegui commitar:** o `.git/index.lock` (dono = host) segue impossível de remover do sandbox (`Operation not permitted`) — a mudança está no working tree junto do WIP; apague o lock e commite. Ambiente ainda serve **cópias truncadas** no mount (veiculos.py 1266 vs 1284 real), então editei pela ferramenta de arquivo (arquivo real) e não confiei no build do sandbox. Detalhes na Execução #13.
- **Run #08 (12:40 BRT) — MUDANÇA DE POSTURA: apliquei correções, não só relatei.** Detectei **desenvolvimento ativo em tempo real** (API no ar + 8 arquivos editados nos últimos 30 min, incluindo o `notificacoes.py` novo). **Achado + conserto principal:** o sino de notificações dava **500 em todo poll** (`current_user.loja_id` num `Usuario` que não tem esse campo) — **corrigido e verificado ao vivo** (200 ponta a ponta). Ainda **apliquei e verifiquei 5 correções** de release/segurança: `email-validator` no `requirements.txt`, `webhook_secret` no validador de boot (P0), `WEBHOOK_SECRET` no `.env`/`.env.example`, chaves de IA documentadas, e o script `dev` da API. **Sem regressão.** **Novidade nos herdados:** B015/B016 agora **não reproduzem** (o victor@ ficou sem o vínculo inativo que causava o dup-insert); B021 (admin@ legado) segue aberto (fix é escrita no banco vivo — deixei o comando). Detalhes na Execução #08.

---

## Log de execuções

### Execução #20 — 2026-07-11 (BRT)

**Escopo:** análise profunda **tipo D (Consistência)** com passada leve de **E (Produção)**. Rodízio a partir da #19 (tipo C). **Ambiente degradado:** o sandbox Linux falhou ao subir (**"Not enough disk space to set up the workspace"**), então **não houve** `git`/`pytest`/`py_compile`/boot ao vivo — mesma limitação recorrente das #09/#11–#14. Toda a análise e a correção foram feitas por **leitura/edição do arquivo real** (ferramenta de arquivo), com verificação **estática**. Mantida a convenção #08+.

#### 0. 🔁 Delta desde a #19 (6 dias)
Muito trabalho seu no intervalo (por `BUGS.md`/`MELHORIAS.md`, já que o git não abriu no sandbox):
- **Novo `apps/mobile`** — app do gestor em React Native/Expo, **mock-first**, reconstruído 2026-07-08. Ganhou paridade recurso-a-recurso com o gestor web via uma reauditoria de 3 agentes: **M048–M073** (Configurações espelhando o web, Chat com abas Parceiros/Clientes, Simulador multi-banco, venda composta, custos de preparação, etc.). Arquitetura mock-first: "trocar para API real = reimplementar o service".
- **Bugs fechados por você:** **B036/B037** (Meu Site — banner/cor secundária no preview dos 3 templates), **B038** (esteira — vendedor não cria/deleta itens de checklist), **B039/B040** (chat B2B/B2C — WS proxy `ws:true`, fallback REST, `MissingGreenlet`/rota 405 do lojista), **B041** (Sidebar colapsada → navega p/ `/ferramentas`), **B042** (removida aba de assinatura/paywall do gestor — módulos são liberados no admin, sem self-service), **B043** (badge "Pro" no simulador mobile).
- Próximos IDs livres: **B045** (após esta rodada) e **M074**.

#### 1. ✅ Verificação rápida (estática — sem ambiente vivo)
Sem sandbox, não pude rodar a suíte. Fiz varredura por `grep`/leitura:
- **Produção (E):** `localhost`/`http://` no backend só aparece em **defaults de `config.py`** (todos com override por env) e como **namespace XML** de sitemap — nenhum hardcode de segredo/endpoint em rota. `WHATSAPP_WORKER_URL` lê `os.getenv` com fallback local. Sem `TODO/FIXME/XXX/HACK` em `apps/api/*.py`.
- **Timezone (D):** os pontos que **comparam/subtraem** datetime já normalizam defensivamente antes (`auth.py` sessão: `expira_em.replace(tzinfo=timezone.utc) < now(utc)`; `marketing_worker`/`esteira`/`marketing_social`), então **não há crash** de aware×naive hoje.
- **Dinheiro (D):** todas as colunas monetárias são `Float` (`models.py`) — débito de design **conhecido e antigo** (round(…,2) na fronteira); não introduzido agora, não é regressão. Fora do escopo desta correção (migração para `Numeric` seria decisão sua).

#### 2. 🔧 Achado corrigido — B044: `datetime.utcnow()` naive quebrando a padronização tz-aware
O projeto padroniza datas em **tz-aware**: `models._now()` = `datetime.now(timezone.utc)` é o `default` de `created_at`/`updated_at`, e quase toda a API usa `datetime.now(timezone.utc)`. Mas **13 pontos** de UPDATE/instanciação gravavam o **naive e deprecado** `datetime.utcnow()` **nas mesmas colunas** que o INSERT já preenche com valor aware:
- `routers/b2b.py` — 6× (`updated_at` de proposta/conversa, `created_at` de mensagens).
- `routers/vitrine_interativo.py` — 4× (`conversa.updated_at` no envio REST e no loop do WebSocket B2C).
- `routers/veiculos.py` — 2× (`pub.updated_at`).
- `pos_venda_template.py` — 1× (`base = data_venda or …`, usado em `base + timedelta` para `prazo_em`).

**Riscos que isso abre:** (a) `DeprecationWarning` do Python 3.12+ — `datetime.utcnow()` está marcado para remoção; (b) uma mesma linha alterna `updated_at` aware (criação) ↔ naive (atualização); qualquer comparação/ordenação **em Python** (não SQL) que misture os dois estoura `TypeError: can't compare offset-naive and offset-aware datetimes`. Hoje o SQLite mascara (leitura volta naive), mas some ao migrar para Postgres / `DateTime(timezone=True)`.

**Fix:** troquei os 13 `datetime.utcnow()` por `datetime.now(timezone.utc)` e adicionei `timezone` ao `from datetime import …` dos 4 arquivos (nenhum o importava). É o **mesmo valor aware** que o `default` de coluna já grava com sucesso no INSERT — portanto estritamente mais consistente, não menos.

**Verificação (estática, por falta de ambiente):** `grep "datetime.utcnow"` em `apps/api` → **0 ocorrências**; os 4 arquivos passam a importar `timezone`; o valor injetado é idêntico ao que `_now()` já persiste nessas colunas. **Não pude** rodar `pytest`/`py_compile` (disco do sandbox). ⚠️ **Recomendo rodar a suíte na sua máquina antes de commitar** — é uma mudança de runtime e a convenção pede verificação ao vivo, que o ambiente não permitiu nesta rodada.

#### 3. Arquivos alterados nesta rodada
- `apps/api/routers/b2b.py`, `apps/api/routers/vitrine_interativo.py`, `apps/api/routers/veiculos.py`, `apps/api/pos_venda_template.py` — `utcnow()` → `now(timezone.utc)` + import de `timezone`.
- `documentos/tarefa/BUGS.md` — B044 (corrigido); próximo ID → **B045**.
- `documentos/cowork.md` — esta entrada + resumo executivo.

#### 4. Impacto / motivação
Técnico: fecha um foco latente de `TypeError` de timezone e remove uso deprecado antes que a migração para Postgres (produção) o transforme em bug real; alinha 100% do backend ao helper `_now()`. Negócio: `updated_at` correto é a base de ordenação de conversas/propostas/estoque — inconsistência de timezone aí vira "mensagem na ordem errada" ou erro 500 intermitente difícil de reproduzir. Risco: baixo/aditivo (mesmo valor já usado no INSERT).

#### 5. Próximos passos sugeridos
1. **Rodar `pytest` na sua máquina** e commitar B044 (o sandbox não permitiu verificação ao vivo nesta rodada).
2. **DevOps recorrente:** o sandbox agente caiu de novo por disco — se a rodada agendada vai continuar, vale garantir espaço/limpeza no ambiente para não perder as verificações ao vivo (foi o mesmo bloqueio das #09/#11–#14).
3. Considerar migração das colunas monetárias `Float → Numeric(12,2)` (decisão sua; migração aditiva mas ampla) — evita erros de arredondamento em somatórios financeiros. Posso preparar o plano quando quiser.
4. Auditar o **`apps/mobile`** quando ele deixar de ser mock-first (hoje não bate no backend, então gaps de integração são esperados e já mapeados em M048–M073).

---

### Execução #19 — 2026-07-05 ~12:27 BRT (15:27 UTC)

**Escopo:** análise profunda **tipo C (Integração)** sobre o grande WIP não-commitado acumulado desde a #18 (login Google/MFA já endurecido pelo fundador, **construtor de sites M038 + SEO**, cancelamento de NF-e M039, edição de loja/módulos no admin M030). Rodízio a partir da #18 (E+A). **Ambiente saudável** — subi a API ao vivo e rodei a suíte inteira. Mantida a convenção #08+ (aplicar só o aditivo/verificável).

#### 0. 🔁 Delta desde a #18
HEAD do git segue em `32efacb` (13 commits à frente do origin), mas o **working tree cresceu muito**: 29 arquivos modificados + 9 novos (`+2349/-435`). O fundador **resolveu por conta própria** os 2 abertos que a #18 deixou (**B030** state-CSRF e **B031** enroll derruba MFA), mais **B032/B033/B034**, e adicionou testes (`test_oauth_state.py`, ampliação do `test_mfa.py`, `test_tenant_isolation.py`, `test_comissao_escopo_vendedor.py`). O `email-validator`/`pyotp`/`qrcode` já estão no `requirements.txt`.

#### 1. ✅ Verificação rápida (ao vivo)
- **Boot da API:** `import main` sobe limpo — **175 endpoints** no `openapi()["paths"]` (padrão B008 sem regressão).
- **Suíte completa:** **37/37 passam** (13 s), incluindo os novos de MFA, OAuth-state, isolamento de tenant e escopo de comissão. Eram 31 na #18 → **+6 testes** do fundador, todos verdes.
- ⚠️ **Nota de ambiente:** rodando o `pytest` direto no mount, 16 testes davam `sqlite3.OperationalError: disk I/O error` — **artefato do SQLite sobre o mount Windows**, não regressão. Rodando contra uma **cópia local do banco** (`/tmp`), a suíte fecha **37/37**. (Mesmo tipo de limitação de ambiente das rodadas anteriores.)

#### 2. 🔎 Auditoria de integração (frontend ↔ backend ↔ banco) do WIP
**Verificado OK (sem gaps):**
- **Admin → Módulos (M030):** o `ModalEditarLoja` envia as chaves `contratos/simulador/marketing/assistente_ia/fiscal/site` e o `PATCH /admin/lojas/{id}` grava em `ModuloHabilitado.nome_modulo`. **Casam exatamente** com os valores do enum `Modulo` (`modulos.py`) que o gate `modulo_ativo`/`exige_modulo` consome → habilitar módulo no admin **realmente** libera a rota (sem mismatch de string). O `GET /admin/lojas/{id}` passou a devolver `modulos_ativos` reais (antes era `[]` fixo).
- **Site público (M038):** os campos novos do `GET /public/site/{host}` (`cidade`, `estado`, `verificada`, `total_veiculos`) são **consumidos** na página `Sobre.tsx`; `Sobre`/`Financiamento` têm rota (`App.tsx`), link no `SiteHeader` e são prerenderizadas (`prerender.js`). JSON-LD `AutoDealer`, OG tags, GA4 e Meta Pixel bem cabeados.
- **Marketplace/vitrine:** `get_veiculos_vitrine`/`feed`/`detalhe` agora dão `JOIN Loja … Loja.ativa == True` → veículo de loja desativada some da vitrine (fecha um vazamento sutil). ✅
- **MeuSite/AssistenteIA (gestor):** todas as chamadas (`/site`, `/site/{acao}`, `/assinaturas/modulos`, `/midias/upload`, `/assistente/*`) batem em rotas existentes.

**Achado (1) — corrigido:**
- **B035 (corrigido) — `sitemap.xml`/`robots.txt` do site white-label eram órfãos.** Os endpoints existem na **API** (`/v1/public/site/{host}/…`), mas o `apps/site` é dist estático por host e o `prerender.js` só gerava as **páginas** — então `https://<host>/sitemap.xml` e `/robots.txt` (a raiz onde o crawler busca) caíam no fallback SPA. Fiz o `prerender.js` **emitir os dois estáticos por host** em `dist/_hosts/<host>/`, alinhados às rotas realmente prerenderizadas, com o `robots.txt` apontando o `Sitemap:` para a raiz do host. Detalhe/verificação em `BUGS.md#B035`.

#### 3. Arquivos alterados nesta rodada (por mim)
- `apps/site/prerender.js` — helpers `writeRaw`/`xmlEscape`/`buildSitemap`/`buildRobots` + emissão de `sitemap.xml`/`robots.txt` por host. **Só adição; nenhuma mudança nas páginas já geradas.**
- `documentos/tarefa/BUGS.md` — B035 (corrigido); ponteiro de próximo ID → **B036**.
- `documentos/cowork.md` — esta entrada.

#### 4. Impacto / motivação
Negócio: o "Meu Site" white-label é vendido como presença digital própria da loja; sitemap/robots inacessíveis ao Google esvaziam justamente o argumento de SEO da feature. Técnico: o conserto é no build (sem risco de runtime na API) e reaproveita a lista de rotas que o próprio prerender já calcula — zero divergência entre o que é servido e o que o sitemap anuncia.

#### 5. Próximos passos sugeridos
1. **Commitar o WIP** (13 commits à frente do origin + este bloco grande fora do índice, incl. o B035). É o maior débito de higiene agora.
2. Confirmar no reverse-proxy de produção que `dist/_hosts/<host>/sitemap.xml|robots.txt` são servidos com `Content-Type` correto (`application/xml`/`text/plain`) — o arquivo estático resolve o caminho; o MIME depende da config do proxy.
3. Considerar **recovery codes** de MFA antes de liberar o login social (risco de lockout já apontado na #18 §5.2).
4. **Verificar a suíte sempre contra banco em disco local** no CI (não sobre o mount/rede) para não pegar o falso-vermelho de `disk I/O error`.

---

### Execução #18 — 2026-07-04 ~13:01 BRT (16:01 UTC)

**Escopo:** análise profunda **tipo E (Produção) + A (regra de negócio de auth)** sobre o WIP grande não-commitado desta vez: **login social Google + MFA real (M029)**. Ambiente do sandbox saudável de novo — **subi a API ao vivo e rodei a suíte inteira** (`pytest` **31/31 verde**, incluindo os novos `tests/test_mfa.py`). Mantida a convenção #08+ (aplicar só o seguro/verificável; deixar o sensível de auth para você).

#### 0. 🔁 Delta desde a #17
Working tree tem **13 commits à frente do origin** (último: `32efacb feat(site): app público apps/site…`) e um bloco grande **não-commitado** de auth: `routers/auth.py` (+291 linhas), `models.py` (senha_hash agora nullable, `google_sub`, MFA), `config.py` (envs do Google), `requirements.txt` (`pyotp`, `qrcode`), e **novos** `oauth_google.py`, `tests/test_mfa.py`, `MfaSettingsModal.tsx`, `GoogleCallback.tsx`. O `email-validator` que a #02 pediu **já está** no `requirements.txt` ✅.

#### 1. ✅ Verificação rápida (ao vivo)
- **Boot da API:** `import main` sobe limpo, **40 rotas** (padrão B008 sem regressão), depois de instalar as deps (incl. `pyotp`, `qrcode`, `authlib`).
- **`py_compile`** dos 5 arquivos de auth alterados/novos: **0 erros**.
- **Suíte completa:** **31/31 passam** (10,6 s), incluindo os 2 testes novos de MFA (enroll→confirm→login-com-challenge→verify e o de disable exigindo senha correta).

#### 2. 🔎 Auditoria do fluxo Google OAuth + MFA
**O que está bem-feito (verificado no código):** o `oauth_google.py` valida o `id_token` **corretamente** — assinatura RS256 contra o JWKS público do Google, `issuer`, `audience` (= client_id) e **exige `email_verified`** (linha 88), o que **fecha o vetor clássico de account-takeover por e-mail não verificado**. O `mfa/verify-login` usa um challenge JWT de escopo `mfa_pending` com TTL de 5 min, separado do access token. Bom desenho no geral.

**Achados (4) — 2 corrigidos agora, 2 documentados para você:**

- **B028 (corrigido) — segundo fator sem rate limit.** `/mfa/verify-login` e `/mfa/confirm` aceitavam tentativas ilimitadas de TOTP dentro da janela de 5 min; `/login` tinha throttle mas o 2º fator não. → adicionei `rate_limit(5,60)` em verify-login/confirm e `rate_limit(10,60)` em enroll/disable. **Suíte segue 31/31.**
- **B029 (corrigido) — `google/callback` dava 422 quando o usuário nega o consentimento.** O Google volta com `?error=…` e **sem** `code` (query param obrigatório) → tela crua 422. → `code`/`error` agora `Optional`; sem `code` faz redirect para `{vitrine}/auth/google/callback#erro=google_consentimento_negado`.
- **B030 (aberto, sua decisão) — `state` do OAuth gerado mas nunca validado no callback (login-CSRF).** `google_login` cria o `state` e injeta na URL, mas `google_callback` não o confere. Fix pede armazenar o state em cookie assinado/`HttpOnly` — mexe em cookies de auth em WIP seu, então **não apliquei**.
- **B031 (aberto, sua decisão) — `/mfa/enroll` desliga o MFA ativo sem re-autenticar.** O enroll faz `mfa_ativo=False` + sobrescreve `mfa_secret` na hora: com uma **sessão roubada** (só o access token) dá pra chamar enroll e o login deixa de exigir 2º fator → **bypass**; e abandonar o enroll deixa o MFA **desligado** (downgrade). Fix limpo pede coluna `mfa_secret_pendente` (migração aditiva) + exigir senha/TOTP atual para re-enroll quando já ativo — toca o modelo `Usuario` que você está mexendo, então **deixei documentado**.

#### 3. Arquivos alterados nesta rodada (por mim)
- `apps/api/routers/auth.py` — `rate_limit` nos 4 endpoints de MFA; `google_callback` tolerante a consentimento negado. **Só adições/hardening; nenhuma mudança de contrato dos caminhos felizes** (a suíte confirma).
- `documentos/tarefa/BUGS.md` — B028/B029 (corrigidos) e B030/B031 (abertos); ponteiro de próximo ID → **B032**.
- `documentos/cowork.md` — esta entrada.

#### 4. Impacto / motivação
Negócio: MFA e login Google são features de confiança/segurança que a loja vê como "software sério"; um 2º fator sem throttle ou um MFA que cai com sessão roubada minam justamente isso. Técnico: os 2 fixes aplicados são aditivos e cobertos pela suíte (risco ~zero); os 2 abertos são de segurança porém exigem cookie/migração em código de auth que **você** está editando agora — mexer neles sem você, com a possibilidade da API no ar, é o tipo de risco que a convenção manda evitar.

#### 5. Próximos passos sugeridos
1. Aplicar B030 (validar `state` via cookie `HttpOnly`) e B031 (coluna `mfa_secret_pendente` + re-auth no re-enroll) quando estiver com o WIP de auth aberto.
2. Considerar **recovery codes** de MFA antes de liberar a feature (o próprio TDD de M029 §10 marca o risco de lockout como pergunta em aberto) — sem isso, perder o autenticador vira suporte manual no banco.
3. Commitar o WIP de auth (segue 13 commits à frente do origin, mas o bloco M029 está fora do índice).

---

### Execução #17 — 2026-07-03 ~08:35 BRT (11:35 UTC)

**Escopo:** análise profunda **tipo B (RBAC e Multiempresa)**. Rodízio a partir da #16 (que foi tipo A). **Ambiente do sandbox voltou saudável** (disco 8.4 GB livre, mount servindo os arquivos íntegros — `financeiro.py` com 905 linhas terminando limpo, ao contrário das #11–#16 que pegavam cópias truncadas), então consegui **subir a API e rodar a suíte ao vivo** pela primeira vez desde a #15. Mantida a convenção #08+ (aplicar só o seguro e verificável).

#### 0. 🔁 Delta desde a #16

Você seguiu desenvolvendo. Working tree (além do fix B027 da #16 ainda não commitado em `financeiro.py`): há um bloco **staged** grande — `PosVenda.tsx` **novo (+431)**, `rbac.py` (+43/-), `tests/test_rbac_modulo_financeiro.py` **novo (+42)**, `Sidebar.tsx`/`App.tsx`/`Topbar.tsx`/`CRM.tsx`/`Dashboard.tsx`/`recentPages.ts`/`theme.css` e `.env.example`. Ou seja: você começou a **frente do frontend da Esteura Pós-venda (M032)** e adicionou o **gate RBAC de Financeiro por módulo** para vendedor. HEAD do git ainda é `76efc15` (3º commit); o WIP acima está por commitar.

#### 1. ✅ VERIFICADO AO VIVO — suíte 27/27 + B027 ponta-a-ponta (novo teste de regressão)

`pip install -r requirements.txt` + `pytest`: **27 passaram** (0 falhas). Eram 26 na base; o 27º é o teste que **adicionei nesta rodada**. Boot limpo, FastAPI 0.139 (o smoke corrigido no B026 segue verde via `app.openapi()["paths"]`).

**Teste novo — `apps/api/tests/test_comissao_tenant_b027.py`** (autossuficiente, padrão de `test_tenant_isolation.py`): cria loja A + gestor A (solicitante) e loja B + veículo B + vendedor B (membro da B). Via `POST /v1/financeiro/comissoes` com o token do gestor A:
- `veiculo_id` da loja B → **404** ✅
- `vendedor_id` da loja B → **404** ✅
- `veiculo_id` inexistente → **404** ✅
- sem referências cruzadas (`valor_venda=50000, percentual=3`) → **201** com `valor_comissao=1500.00` ✅ (caminho feliz intacto)

Isso **fecha o "próximo passo 3" da #16** — ela recomendou o teste mas não o adicionou por não ter boot ao vivo confiável (para não deixar um vermelho falso no CI). Agora o B027 tem cobertura permanente. Cleanup em `finally` (apaga comissões/veículo/usuários/lojas criados). **O fix B027 em si** (bloco de validação em `criar_comissao`, +`MembroLoja` no import) segue idêntico ao da #16 e agora está **verificado**, não só revisado por lógica.

#### 2. ✅ Auditado OK — gate RBAC de Financeiro por módulo (seu código novo)

`rbac.py` → `can()` concede a um **vendedor** o `VER` de `Recurso.FINANCEIRO` **somente** quando `"financeiro" ∈ MembroLoja.modulos` (o array que o gestor libera por vendedor); nunca `CRIAR`/`EDITAR`; usuário inativo **nunca** acessa (guard no topo); admin de plataforma passa por cima da matriz. O `exige_permissao(...)` desserializa `context.membro.modulos` (JSON) com try/except defensivo e injeta em `can()`. **Coberto por `test_rbac_modulo_financeiro.py` (5 casos)** — todos passam. Bom design: fecha o bug que você citou no docstring (menu mostrava Financeiro pra vendedor com módulo liberado, mas backend dava 403). ✅ Sem ressalvas.

#### 3. ✅ Auditado OK (tenant) — Esteira Pós-venda (`routers/esteira.py`)

Feature nova (backend M031; frontend M032 em construção agora via `PosVenda.tsx`, que hoje só faz `GET /esteira` do board). **Escopo multi-tenant sólido:** `listar_board` e `dashboard/resumo` filtram `EsteiraPosVenda.loja_id == ctx.loja.id`; **todos** os endpoints de detalhe/mutação (`detalhe`, `atualizar_item`, `anexar_documento`, `registrar_transferencia`, `consultar_debitos`, `consultar_situacao`, `concluir`) passam por `_carregar_esteira(db, esteira_id, ctx.loja.id)`, que faz `WHERE id == esteira_id AND loja_id == loja_id` → **404 cross-loja**. `VeiculoDocumento` criado no `anexar_documento` herda `loja_id=ctx.loja.id`. **Sem IDOR.** ✅

#### 4. 🟡 Achado (M037) — Esteira sem gate RBAC: efeito colateral financeiro acessível a qualquer membro da loja

O router `/v1/esteira` **não usa `exige_permissao` em nenhum endpoint** — só `get_current_b2b_user` (qualquer membro autenticado da loja). Aceitável para trabalho operacional de pós-venda, **exceto por um efeito colateral financeiro:** em `atualizar_item`, concluir um item da categoria `FINANCEIRO` chama `_lancar_financeiro(...)`, que **grava um `LancamentoFinanceiro` (despesa) no caixa da loja**. Ou seja, um **vendedor sem o módulo `financeiro`** — que o `financeiro.py` bloqueia com `exige_permissao(CRIAR, FINANCEIRO)` (403) — consegue, pela esteira, **criar lançamento financeiro indiretamente**, contornando o gate. O escopo de **tenant** está OK; o furo é de **autorização por papel/módulo dentro da própria loja**.

**Não apliquei correção** por ser **decisão de política/produto** (o critério de autonomia da tarefa manda pedir sua decisão quando há duas soluções válidas de produto). Opções: (a) gatear só os caminhos com efeito financeiro (`CategoriaItem.FINANCEIRO` e/ou `concluir`) atrás de `exige_permissao`/checagem de módulo — **recomendo**; ou (b) documentar que a esteira é operacional e aberta. Registrado em **M037** com plano de validação (vendedor sem módulo marca item FINANCEIRO → 403 após opção (a)).

#### 5. Arquivos alterados nesta rodada
- **Criado:** `apps/api/tests/test_comissao_tenant_b027.py` (teste de regressão B027, verificado — 1/1 + suíte 27/27).
- **Editado (doc):** `documentos/tarefa/MELHORIAS.md` (M037 + próximo ID livre → M038) e este `cowork.md`.
- **Nenhuma mudança de comportamento** de runtime aplicada nesta rodada (o achado M037 é decisão sua; B027 já estava aplicado na #16, aqui só ganhou teste).

#### 6. 🎯 Próximos passos sugeridos
1. **Commitar** o WIP: fix B027 (`financeiro.py`), o novo teste `test_comissao_tenant_b027.py`, o gate RBAC (`rbac.py` + teste) e a frente do `PosVenda.tsx`.
2. **Decidir M037** (gatear efeito financeiro da esteira vs. manter aberta).
3. Housekeeping **M036** (`_wtest.tmp`, `.db` vazio na raiz, pin do FastAPI) numa passada rápida.
4. Herdados de decisão sua: backdoor de e-mail → papel `ADMIN_PLATAFORMA`; renormalizar EOL (M033); migração Pydantic V2→V3 (M034).

---

### Execução #16 — 2026-07-02 ~21:20 BRT (2026-07-03 00:20 UTC)

**Escopo:** análise profunda **tipo A (Regra de Negócio)** — percorri o fluxo **venda → comissão → financeiro** de ponta a ponta (schema → router → modelo → banco). **1 correção segura aplicada e verificada por lógica** + 1 melhoria de housekeeping registrada. Mantida a convenção #08+ (aplicar só o seguro e verificável; o que exige git/host vivo fica como patch/registro).

#### 0. 🔁 Delta desde a #15

Você seguiu desenvolvendo: `apps/gestor/src/pages/PosVenda.tsx` foi editado às **21:07** (após o 3º commit `76efc15` das 16:44) e há WIP no working tree. **Não consegui inspecionar o git a fundo:** o índice está **corrompido para o git do sandbox** (`error: index uses ... extension, which we do not understand; fatal: index file corrupt`) — o índice foi escrito pelo git do Windows/host. Isso é ambiente, não seu repo; na sua máquina o git abre normal. Segui por leitura de arquivo (fonte da verdade) e não confiei no build do sandbox.

#### 1. ✅ IMPLEMENTADO — B027: `criar_comissao` aceitava `vendedor_id`/`veiculo_id` de outra loja

**Fluxo auditado (`routers/financeiro.py`):**
- `criar_comissao` → `valor_comissao = round(valor_venda × percentual/100, 2)`. O schema `ComissaoCreateRequest` **já** valida `valor_venda > 0` (`gt=0`) e `0 ≤ percentual ≤ 100` (`ge=0, le=100`) — cálculo e limites **OK**. ✅
- `marcar_comissao_paga` → filtra `loja_id`, é **idempotente** (barra `pago` já `True` com 400) e lança a despesa correspondente no caixa (`TipoLancamento.COMISSAO`, `StatusPagamento.PAGO`). ✅
- `/me/comissoes` → escopo de linha por `vendedor_id + loja_id` (padrão do fix B023). ✅

**Furo encontrado:** em `criar_comissao`, os campos `vendedor_id` e `veiculo_id` chegavam como strings livres e eram **persistidos sem checagem de tenant**. Como a comissão herda `loja_id` do contexto, um gestor da loja A podia criar uma comissão apontando para um **veículo/vendedor da loja B** — ou para um **id inexistente** (a FK é `ON DELETE SET NULL` e o SQLite não força FK por padrão). Consequência: atribuição de comissão corrompida, **relatórios financeiros e ranking de vendedores** poluídos com referências cruzadas/quebradas, e a possibilidade de "plantar" comissão vinculada a recurso alheio. A rota de pagamento já se protegia; só a **criação** escapava — clássico gap onde a leitura filtra por tenant mas a escrita confia no id do corpo.

**Correção (`criar_comissao`):** antes de persistir, quando `veiculo_id`/`vendedor_id` são informados, valido que pertencem à loja do contexto:
- `select(Veiculo.id).where(Veiculo.id == data.veiculo_id, Veiculo.loja_id == context.loja_id)` → senão **404** "Veículo não encontrado nesta loja."
- `select(MembroLoja.id).where(MembroLoja.usuario_id == data.vendedor_id, MembroLoja.loja_id == context.loja_id)` → senão **404** "Vendedor não encontrado nesta loja."

Não filtrei `MembroLoja.ativo` de propósito: um vendedor desligado ainda pode ter comissão legítima de venda passada; o que importa é impedir referência **cross-tenant**, não bloquear histórico.

**Arquivos alterados (1):** `apps/api/routers/financeiro.py` — `+MembroLoja` no import de `models` e o bloco de validação no início de `criar_comissao`. Edição pela **ferramenta de arquivo** (arquivo real).
**Verificação:** revisão de lógica + releitura da região editada (blocos idênticos ao padrão `select(...).where(...).scalar_one_or_none()` já usado no arquivo; brackets/indentação conferidos). **`py_compile` no sandbox não fecha** porque o mount serve `financeiro.py` **truncado** na última linha (872 linhas, corte mid-token em `@rout`) — mesmo artefato das #11–#15; o arquivo real no disco está íntegro. Sugeri em **M036** um teste de regressão dedicado (criar comissão com veículo/vendedor de outra loja → 404) para quando houver ambiente com boot ao vivo confiável — **não** adicionei o teste agora para não introduzir um vermelho não-verificado no CI (a lição do B026: teste que falha sem o app estar quebrado é pior que não ter).
**Motivo de negócio:** comissão é dinheiro e depende de atribuição correta (vendedor certo, veículo certo, loja certa). Cruzar lojas corrompe o financeiro e o ranking — exatamente o tipo de regra que uma concessionária real não tolera. **Riscos:** baixíssimos — só adiciona 2 checagens de leitura antes de um insert; o caminho feliz (ids válidos da própria loja) é idêntico.

#### 2. 🟡 Housekeeping registrado — M036 (não aplicável no sandbox)

- **`apps/api/routers/_wtest.tmp`** (6 bytes, `hello`) — arquivo-lixo dentro da pasta de routers, resíduo de teste manual. Tentei remover: `rm` → `Operation not permitted` (dono = host). → `git rm --cached` + apagar na sua máquina.
- **`socialveiculos.db` vazio (0 byte) na raiz** — banco SQLite fantasma (o real fica em `apps/api/`); já sinalizado antes. → remover/gitignorar.
- **`fastapi>=0.115.0` em faixa aberta** — foi o que trouxe o 0.139 e quebrou os smoke tests (B026). → pin com teto (ex.: `>=0.115,<0.140`).

#### 3. ✅ Confirmado OK nesta passada
- Cálculo de comissão e limites de entrada (schema) corretos.
- `marcar_comissao_paga` idempotente e escopado por loja; lança a despesa no caixa.
- Escopo de linha em `/me/comissoes` (vendedor só vê o dele).

#### 4. 🎯 Próximos passos sugeridos
1. **Commitar** B027 (`apps/api/routers/financeiro.py`) — junto do WIP, quando o git voltar a abrir na sua máquina.
2. Fechar **M036** (housekeeping) numa passada rápida de limpeza.
3. Adicionar o **teste de regressão** de B027 (comissão cross-tenant → 404) quando houver boot ao vivo confiável.
4. Herdados de decisão sua seguem: backdoor de e-mail → papel `ADMIN_PLATAFORMA`; renormalizar EOL (M033); Pydantic V2→V3 (M034).

---

### Execução #15 — 2026-07-02 ~15:46 BRT (18:46 UTC)

**Escopo:** revisão do delta desde a #14 + **verificação de QA ao vivo** (subi a API e rodei a suíte de testes pela primeira vez, o que rodadas anteriores não conseguiram) + **2 correções seguras aplicadas e verificadas**. Análise profunda desta rodada = tipo **D (Consistência) / QA**. Mantida a convenção #08+ (aplicar só o seguro e verificável).

#### 0. 🔁 Delta desde a #14 — você commitou tudo

Mudança grande e ótima: você fez o **2º commit do repositório** — `b9552e0` *"feat: implement bank automation modules, expand API functionality, and add new pages…"* (Victor Correia, 11:00 BRT). Ele trouxe para o git **todo o trabalho das #08–#14** (tests `test_tenant_isolation.py` +269, `test_venda_composta.py` +212, `test_comissao_escopo_vendedor.py` +132, `financeiro.py` +130, `contratos.py` +211, `Estoque.tsx` +494, `Dashboard.tsx` +129, `MinhasComissoes.tsx`, `theme.css` +279, `ws.ts`, os fixes de `except:`/`ConnectionManager`, etc.). **O gap "tudo fora do git", recorrente desde a #11, está fechado.** ✅

As únicas mudanças restantes no working tree (`enums.csv`, os 3 mappings `bv/c6/santander.json`, `theme.css`, `social.md`) são **exclusivamente fim de linha** (CRLF no disco vs LF no commit): `git diff --numstat` mostra N/N em cada arquivo e `git diff --ignore-all-space` retorna **0 linha de conteúdo** — ver item 3.

#### 1. ✅ QA ao vivo — suíte de testes rodada pela 1ª vez (19/21; as 2 falhas eram testes quebrados)

Consegui `pip install -r requirements.txt` + `pytest` neste sandbox (disco saudável, 8.6 GB). Resultado: **19 passaram, 2 falharam** — e as 2 falhas **não eram bug do app**, eram os smoke tests desatualizados (ver item 2). Passaram, entre outros: `test_auth_multiloja` (admin loga sem 500, papel = ADMIN_PLATAFORMA), `test_tenant_isolation` (veículo, chat B2B, credencial de banco isolados por loja), `test_triagem_tenant` (B023), `test_comissao_escopo_vendedor`, `test_venda_composta`, `test_openapi_responde`. Boot limpo: `import main` → app com **155 endpoints** no schema OpenAPI.

#### 2. ✅ IMPLEMENTADO — B026: smoke tests quebram no FastAPI ≥0.139 (falharia em deploy limpo)

**Problema:** `apps/api/tests/test_smoke.py` afirmava `len(app.routes) > 50` e iterava `route.path` para achar `/v1/auth/login` e `/v1/admin/lojas`. A partir do **FastAPI 0.139** (instalado, `starlette 1.3.1`), o `include_router` **deixou de expandir cada endpoint em `app.routes`** e passou a registrar **um único wrapper `_IncludedRouter` por router**. Efeito: `len(app.routes)` cai para **36** e **nenhum `.path` de endpoint** aparece na iteração — embora o app sirva as **155 rotas** normalmente. Provei que o app está são: `app.openapi()["paths"]` tem **155 paths**, incluindo os dois críticos. Como `requirements.txt` fixa `fastapi>=0.115.0` (faixa aberta), **um `pip install` limpo em CI/produção já traz 0.139 e esses 2 testes falham** — falso-vermelho de "app quebrado" bem no gate de deploy.

**Solução:** reescrevi as 2 asserções para introspectar `app.openapi()["paths"]` (fonte de verdade dos endpoints montados, estável entre versões do FastAPI) em vez de `app.routes`/`.path`. Adicionei docstring explicando o porquê.

**Arquivo alterado (1):** `apps/api/tests/test_smoke.py` (via ferramenta de arquivo — arquivo real).
**Verificação:** rodei a **mesma lógica** do teste em Python puro contra o app importado → `len(paths)=155 > 50` **e** `/v1/auth/login` **e** `/v1/admin/lojas` presentes ⇒ as 3 asserções passam. *(Não pude fechar via `pytest` no sandbox: o mount serve o arquivo **truncado** na linha 12 — mesmo problema das #11–#14 — e o `.pyc` do host é read-only; por isso a verificação foi por execução direta da lógica, não pelo runner. O arquivo real no disco está íntegro, reconferido pela ferramenta de arquivo.)*
**Motivo de negócio:** um smoke test que dá vermelho num deploy saudável **trava o release** e mina a confiança na suíte — pior que não ter teste. Agora o gate reflete a realidade do app.

#### 3. ✅ IMPLEMENTADO — M033: `.gitattributes` (fim do ruído de CRLF em todo diff)

**Problema:** todo `git status` mostrava **27 arquivos "modificados" sem uma linha de conteúdo alterada** — puro CRLF (Windows) vs LF (repo). Confirmei com `git diff -w`/`--ignore-all-space` → **0** mudança de conteúdo em `enums.csv`, `bv/c6/santander.json`, `theme.css`, `social.md`. Isso esconde mudanças reais no meio do ruído, infla commits e atrapalha review.

**Solução:** criei `.gitattributes` na raiz com `* text=auto eol=lf` + regras por extensão (LF para código/dados; **CRLF preservado** para `.ps1`/`.bat`/`.cmd`, que o PowerShell/Batch esperam; `binary` para imagens/PDF/fontes/`.db`).

**Arquivo criado (1):** `.gitattributes` (raiz).
**Falta (ação sua — git travado no sandbox):** rodar **uma vez** `git add --renormalize . && git commit -m "chore: normaliza fins de linha (LF)"`. Depois disso o `git status` fica limpo e os phantom-diffs somem de vez.

#### 4. 🟡 Achados documentados (não urgentes — só registro, sem risco hoje)

- **M034 — Deprecações do Pydantic V2 (quebram no Pydantic V3):** a suíte emite ~40 `PydanticDeprecatedSince20` (`class Config` → `model_config = ConfigDict`; `from pydantic.generics import GenericModel` movido). Com `pydantic>=2.10` em faixa aberta, o dia que sair o V3 o boot quebra. Migração ampla (muitos arquivos) — adiada para rodada com ambiente que permita boot+pytest ao vivo confiáveis.
- **M035 — `JWT_SECRET` 29 < 32 bytes:** `InsecureKeyLengthWarning` (RFC 7518 §3.2). O validador de boot barra o *valor* default mas não o *comprimento*; um segredo de produção curto passaria. Sugerido exigir `len ≥ 32` no validador quando `api_debug=false`.

#### 5. ⚠️ Limitações do ambiente (persistem das #11–#14)

- **Mount truncando arquivos:** o `pytest` não fecha porque o bash lê `test_smoke.py` cortado na linha 12 (o `head` mostra o conteúdo novo, mas o read integral trunca) — artefato do mount, **o arquivo real está correto**. Por isso a verificação do B026 foi por execução direta da lógica contra o app.
- **`.pyc` e `.git` do host read-only:** `rm __pycache__/*.pyc` e qualquer commit → `Operation not permitted`. Há inclusive `.pyc` de **cpython-314** (você roda Python 3.14; o sandbox é 3.10) — mais um motivo para eu editar sempre pela ferramenta de arquivo e verificar por lógica, não pelo build do sandbox.

#### 6. 🎯 Próximos passos sugeridos
1. **Commitar** os 2 arquivos desta rodada: `git add apps/api/tests/test_smoke.py .gitattributes && git commit -m "fix(test): smoke via openapi (FastAPI 0.139) + chore: .gitattributes (B026, M033)"`.
2. **Renormalizar EOL** uma vez: `git add --renormalize . && git commit -m "chore: normaliza fins de linha (LF)"` — fecha o M033 e limpa o `git status`.
3. **Pinar o FastAPI** (opcional, robustez de deploy): trocar `fastapi>=0.115.0` por uma faixa fechada (ex.: `fastapi>=0.115,<0.140`) para não pegar mudanças de comportamento como a do 0.139 sem querer.
4. Quando houver ambiente com boot ao vivo confiável: fechar **M034** (Pydantic V2→V3) e **M035** (comprimento do JWT).

---

### Execução #14 — 2026-07-02 ~06:40 BRT (09:40 UTC)

**Escopo:** revisão do delta desde a #13 + **implementação proativa** de uma limpeza de robustez em todo o motor do Simulador: eliminar os **15 `except:` nus** (bare except) do backend. Apliquei código (6 arquivos), verifiquei estaticamente e documentei aqui. Mantive a convenção da #08+ (aplicar só o que é seguro e verificável).

#### 0. 🔁 Delta desde a #13 — atividade sua nova (mínima)

Desde a #13 (09:10 UTC) houve **um toque seu**: `apps/api/routers/midias.py` foi editado às **07:14 (10:14 UTC)** — está no working tree como modificado (junto do WIP herdado). Nada mais mudou. Git segue com **1 commit só** e `.git/index.lock` ainda preso pelo host (ver item 3). Todo o trabalho novo (o seu + o meu das #12–#14) permanece **fora do controle de versão**.

#### 1. ⚠️ Ambiente: mesmas duas limitações das #11–#13 (persistem)

- **Mount truncando arquivos:** confirmado de novo nesta rodada. Os arquivos que o mount serve **cortados na última linha** falham `py_compile` no *bash* mid-token, mesmo estando **íntegros no disco real** — provei lendo a cauda real de cada um pela ferramenta de arquivo: `base.py` real termina na 479 (`raise`), o bash serve 476 cortado em `f"error_{self.b`; `browser_pool.py` real fecha em `atexit.register(browser_pool.shutdown)` (285), bash corta na 284; `c6.py`/`itau.py` idem (real terminam no `logger.info("… concluída com sucesso")` + `return`, bash corta a última linha). Os **2 arquivos que o mount serviu inteiros** (`bv.py`, `santander.py`) compilaram **OK** — carimbo verde possível onde o mount coopera.
- **`.git/index.lock` preso pelo host:** `rm` devolve `Operation not permitted` (dono = host, mount Windows). Qualquer commit falha ao adquirir o lock. **Ação sua:** apagar `.git/index.lock` e commitar.

#### 2. ✅ IMPLEMENTADO — eliminação dos 15 `except:` nus no motor do Simulador

**Problema:** o backend tinha **15 cláusulas `except:` nuas** (bare except), todas concentradas no motor de automação/login dos bancos: `simulador/automation/base.py` (3), `simulador/automation/browser_pool.py` (1), `simulador/bancos_login/bv.py` (2), `c6.py` (3), `itau.py` (4), `santander.py` (2). Um `except:` nu **captura também `KeyboardInterrupt` e `SystemExit`** (que herdam de `BaseException`, não de `Exception`). Na prática isso significa que, dentro desses `try` (cliques Selenium, `select_by_*`, limpeza de `localStorage`, saída de iframe, parsing de float/percentual), um **Ctrl-C ou um sinal de shutdown do worker seria silenciosamente engolido** — o processo de simulação, que roda em browser headless e pode travar, ficaria mais difícil de matar/encerrar de forma limpa. É o item de higiene que as #04/#05 já vinham sinalizando ("15 `except:` nus") e que ninguém tinha fechado.

**Solução:** troquei os 15 `except:` por **`except Exception:`** — mudança de palavra-chave sobre blocos `try/except` já válidos, sem alterar nenhuma outra linha, mensagem de log ou fluxo. O comportamento para erros reais (o que esses blocos querem tratar: elemento não clicável, opção de dropdown inexistente, texto não parseável) é **idêntico**; a única diferença é que agora `KeyboardInterrupt`/`SystemExit` **propagam** como deveriam.

**Motivo técnico:** bare except é anti-padrão consagrado (PEP 8 / lint B902/E722) justamente por mascarar sinais de controle e erros de programação. `except Exception:` é o subconjunto correto: pega tudo que o bare pegava **exceto** as BaseException que você quer deixar subir.
**Motivo de negócio:** robustez operacional do serviço de simulação — worker mais previsível de encerrar/reiniciar (deploy, timeout, kill manual), menos processos-fantasma de browser presos, exatamente o tipo de resiliência "aguenta produção" que separa demo de produto.

**Arquivos alterados (6):** `apps/api/simulador/automation/base.py`, `apps/api/simulador/automation/browser_pool.py`, `apps/api/simulador/bancos_login/bv.py`, `apps/api/simulador/bancos_login/c6.py`, `apps/api/simulador/bancos_login/itau.py`, `apps/api/simulador/bancos_login/santander.py`. Edições feitas pela **ferramenta de arquivo** (arquivo real), não pelo mount truncado.

**Verificação:** (a) `grep -rn "except:"` no backend (fora de `alembic`) → **0** ocorrências restantes (era 15); (b) contagem de `except Exception:` por arquivo bate com o esperado; (c) **`bv.py` e `santander.py` — os 2 que o mount serviu inteiros — compilam `py_compile` OK**; (d) os 4 restantes só "falham" `py_compile` no bash por truncagem do mount na última linha (mid-token), com a cauda real confirmada íntegra pela ferramenta de arquivo (item 1) — e a edição, sendo troca de palavra-chave sobre `try` válido, **não tem como introduzir erro de sintaxe**.

**Impacto esperado:** encerramento/kill limpo do worker de simulação; sinais de controle não mais engolidos. **Riscos:** praticamente nulos — nenhum desses blocos pretendia capturar `BaseException`; todos são fallback/cleanup (retornar 0.0, `pass`, `continue`, tentar via JS). Se algum fluxo dependesse de engolir Ctrl-C (não é o caso), poderia mudar — auditei os 15 contextos um a um antes de trocar.

#### 3. 🟡 Não consegui commitar (idem #12/#13)

Mesma causa: `.git/index.lock` do host. Sugiro, ao limpar o lock, isolar num commit de higiene: `git add apps/api/simulador/automation/base.py apps/api/simulador/automation/browser_pool.py apps/api/simulador/bancos_login/{bv,c6,itau,santander}.py`.

#### 4. 🎯 Próximas melhorias sugeridas (para as próximas rodadas)
- **`print()` → `logging` (4 pontos):** `b2b.py:404,955,1084` e `vitrine_interativo.py:363` ainda usam `print(f"[ERRO Notificacao…] {e}")` para logar erro — deveriam usar `logging.getLogger(...)`. Baixo risco; adiado só para manter o footprint desta rodada num único tema.
- **`datetime.utcnow()` (9 pontos):** deprecado no 3.12 e devolve *naive*; migrar para `datetime.now(timezone.utc)` **exige conferir** se as colunas `updated_at` comparam com naive em outro lugar (risco de mistura aware/naive) — precisa de um boot ao vivo para validar, fica para rodada com ambiente saudável.
- **Indicador de status de conexão no chat (UX):** `createReconnectingSocket` (#12) já emite `onStatusChange`; falta plugar num badge "reconectando…" — adiado por não poder buildar JSX no sandbox.
- **Itens de decisão sua (inalterados):** contatos TEMPORÁRIOS em `contato.ts` (confirmar `galipcorporation@gmail.com`), backdoor de e-mail → `ADMIN_PLATAFORMA`, e **commitar** todo o trabalho fora do git.

---

### Execução #13 — 2026-07-02 06:10 BRT (09:10 UTC)

**Escopo:** revisão do delta desde a #12 + **implementação proativa** da metade *backend* do **B024** (teto de conexões no `ConnectionManager`), que estava aberta desde a #11/#12. Apliquei código (1 arquivo de backend), verifiquei a lógica com harness isolado e documentei aqui. Mantive a convenção da #08+ (aplicar só o que é seguro e verificável).

#### 0. 🔁 Delta desde a #12 — zero mudança sua

Nenhum arquivo-fonte foi tocado desde a #12 (08:23 UTC): `find -newermt "2026-07-02 08:20"` em `apps/**/*.{py,ts,tsx}` (fora de `node_modules`) volta **vazio**. Working tree igual ao da #12 — mesmos ~21 modificados + os não rastreados (`ws.ts` x2, `contato.ts`, institucionais, `test_triagem_tenant.py`, `test_venda_composta.py`, migração `a7c4e91b2d08`). Ainda **1 commit só** no git; todo o trabalho novo (incluindo o meu do #12 e o desta rodada) segue **fora do controle de versão**.

#### 1. ⚠️ Ambiente: mesmas duas limitações das #11/#12 (persistem)

- **Mount truncando arquivos:** `veiculos.py` chega ao bash com **1266 linhas** (real = 1284), `vitrine_interativo.py` 603 (real 619), `schemas.py` 1367. Por isso **não confiei em `py_compile`/build do sandbox** e fiz a edição pela **ferramenta de arquivo** (escreve/lê o arquivo real na sua máquina). Disco do sandbox saudável desta vez (8.6 GB livres) — o problema é o mount, não espaço.
- **`.git/index.lock` preso pelo host:** `rm` devolve `Operation not permitted` (dono = host, mount Windows). Logo **qualquer commit falha ao adquirir o lock** — a tarefa autoriza commit na branch "Alterações Claude", mas o ambiente bloqueia. **Ação sua:** apagar `.git/index.lock` e commitar.

#### 2. ✅ IMPLEMENTADO — B024 (backend): teto de conexões por usuário no `ConnectionManager`

**Problema:** o `ConnectionManager` (definido em `routers/b2b.py:30` e **compartilhado** pelo chat B2C — `vitrine_interativo.py:26` faz `from routers.b2b import manager`) guarda `active_connections: dict[str, list[WebSocket]]` que **cresce sem limite**. Isso já era dívida na #11; a #12 **agravou o risco** ao introduzir o cliente com **reconexão automática**: numa rede instável ou num ciclo de deploy, o cliente reabre sockets repetidamente e, se um `disconnect` do servidor escapar (conexão meio-aberta), a lista do usuário incha indefinidamente → vazamento de memória e broadcast disparando para sockets mortos.

**Solução (1 método, `connect`):** adicionei a constante de classe `MAX_CONNECTIONS_PER_USER = 8`. Ao conectar, se a lista do usuário passar do teto, o `connect()` **remove e encerra as conexões mais antigas** (FIFO) com `await oldest.close(code=status.WS_1013_TRY_AGAIN_LATER)`, envolto em `try/except` (fechar socket já morto é inofensivo). O `disconnect()` **não mudou**: como o socket evictado já saiu da lista, quando o loop dele receber o `WebSocketDisconnect` e chamar `disconnect()`, o guard `if websocket in self.active_connections[uid]` simplesmente o ignora — sem `KeyError`, sem duplo-remove.

**Motivo técnico:** limitar no `connect` cobre **os dois** endpoints de chat de uma vez (mesmo `manager`), sem tocar no caminho de escrita/broadcast (risco mínimo). `8` é folgado para uso legítimo (várias abas + reconexões em voo) e ainda barra acumulação patológica.
**Motivo de negócio:** robustez de produção — evita degradação de memória/latência do serviço de chat sob carga ou em janelas de deploy, exatamente o tipo de "aguenta o uso real" que separa demo de produto.

**Arquivo alterado (1):** `apps/api/routers/b2b.py` — classe `ConnectionManager`: + constante `MAX_CONNECTIONS_PER_USER`, + lógica de eviction no `connect`. `status` já estava importado do `fastapi` (linha 9); `WS_1013_TRY_AGAIN_LATER` é reexportado do Starlette.

**Verificação (harness isolado, `/tmp/cap_test.py`, Python + mock WebSocket async):** todas as asserções passaram — (a) com 12 conexões o cap fixa em **8**; (b) as 4 mais antigas são **evictadas em FIFO e fechadas com 1013**; (c) as 8 mais novas permanecem, aceitas e não fechadas; (d) `disconnect()` de um socket já evictado é **no-op** (sem exceção); (e) ao desconectar todas, a chave do usuário é removida; (f) um segundo usuário sob o teto fica **intacto**. Não é o build do projeto (o sandbox não builda por causa do mount truncado) — é a mesma lógica portada para validar o comportamento em runtime.

**Impacto esperado:** serviço de chat com uso de memória limitado por usuário e menos broadcast para sockets zumbis. **Riscos:** baixos — só o `connect` muda; no pior caso um usuário com >8 sockets simultâneos perde os mais antigos (que caem no fallback REST do cliente). Se algum fluxo legítimo precisar de mais de 8 conexões simultâneas por usuário, subir a constante.

#### 3. 🟡 Não consegui commitar (idem #12)

Mesma causa da #12: `.git/index.lock` do host. Sugiro, ao limpar o lock, **isolar num commit** o backend do B024 junto (ou logo após) o front do #12: `git add apps/api/routers/b2b.py apps/vitrine/src/lib/ws.ts apps/gestor/src/lib/ws.ts apps/vitrine/src/pages/Mensagens.tsx apps/gestor/src/pages/RedeSocial.tsx`.

#### 4. 🎯 Próximas melhorias sugeridas (para as próximas rodadas)
- **Indicador de status de conexão no chat (UX):** o `createReconnectingSocket` já emite `onStatusChange`; falta plugar num badge "reconectando…" no header do chat (adiado por não poder buildar JSX no sandbox).
- **Higiene no `b2b.py` (herdado):** `datetime.utcnow()` (dep. em 3.12) na gravação de mensagem WS e `print(f"[ERRO Notificacao WS] {e}")` deviam virar `datetime.now(UTC)` e `logging`. Baixo risco, mas quis manter o footprint desta rodada mínimo (sem build).
- **Itens de decisão sua (inalterados):** contatos TEMPORÁRIOS hardcoded em `contato.ts` (confirmar `galipcorporation@gmail.com`), backdoor de e-mail → papel `ADMIN_PLATAFORMA`, e **commitar** todo o trabalho fora do git.

---

### Execução #12 — 2026-07-02 05:23 BRT (08:23 UTC)

**Escopo:** revisão do delta desde a #11 + **implementação proativa** da resiliência do WebSocket de chat (**B024**, que estava aberto como P3 desde a #11). Apliquei código (4 arquivos de front), verifiquei a lógica com harness isolado e documentei aqui. **Mantive a convenção da #08+** (aplicar só o que é seguro e verificável); este fix é **100% client-side e não exige mudança no backend** — explico o porquê no item 2.

#### 0. ⚠️ Ambiente: o mount do sandbox voltou a servir cópias TRUNCADAS (igual à #11)

`veiculos.py` chega ao bash com **1266 linhas cortadas no meio de uma palavra** (`Depends(get_cu`), enquanto o arquivo **real** tem 1284 e está íntegro (confirmei pela ferramenta de leitura, que acessa o arquivo real na sua máquina). Consequência prática: **não confiei em `py_compile`/build do mount** e fiz **toda edição pela ferramenta de arquivo** (que escreve no arquivo real, não na cópia truncada) — sem risco de clobber. Verificação foi por **leitura + teste de lógica isolado**, não por build no sandbox (o `node_modules` do front é do Windows e não resolve no Linux — limitação herdada das #01–#11).

#### 1. 🟢 Delta desde a #11 — sem novidades suas nos últimos ~5h

Working tree igual ao da #11 (mesmos ~21 modificados + não rastreados: `ws.ts`, `contato.ts`, institucionais, `test_triagem_tenant.py`, `test_venda_composta.py`, migração `a7c4e91b2d08_add_comissao_percentuais_esteira_fk`). **Ainda tudo fora do git** (1 commit só). Sem regressões visíveis.

#### 2. ✅ IMPLEMENTADO — B024: WebSocket de chat resiliente (reconexão + heartbeat)

**Problema:** os 3 consumidores de chat (vitrine `Mensagens.tsx`, e os 2 componentes B2B/B2C do gestor `RedeSocial.tsx`) usavam `new WebSocket` cru, **sem reconexão e sem keep-alive**. Na prática: qualquer queda de rede, restart do backend (deploy no Fly), sleep/wake do celular, ou timeout de proxy idle **matava o tempo-real silenciosamente** — o chat "congelava" e só voltava quando o usuário reselecionava a conversa. Bug clássico de "funciona na demo, falha no uso real". É exatamente o tipo de robustez que separa um chat de brinquedo de um pronto para produção.

**Solução:** criei `createReconnectingSocket(path, opts)` em **`apps/vitrine/src/lib/ws.ts`** e **`apps/gestor/src/lib/ws.ts`**, e migrei os 3 consumidores para ele. O helper faz:
- **Reconexão automática** com **backoff exponencial + jitter** (teto de 30s), zerando o contador ao reabrir;
- **Heartbeat de aplicação** (`{"type":"ping"}` a cada 25s) para sobreviver a timeouts de proxy/idle;
- **Teardown limpo** via `close()`: cancela os timers e **não** reconecta (respeita o cleanup do `useEffect`).

**Motivo técnico de não tocar no backend:** o loop do servidor (`b2b.py:985` e `vitrine_interativo.py`) só age **se a mensagem tiver `conversa_id` E `conteudo`** — qualquer outro JSON (como o `{"type":"ping"}`) é **silenciosamente ignorado**. Ou seja, o heartbeat é inofensivo e **não exige** mudança no `ConnectionManager`. Isso mantém o risco mínimo (nada no caminho crítico de escrita/broadcast muda).

**Compatibilidade:** o objeto devolvido imita o `WebSocket` nativo o suficiente para os consumidores atuais — expõe `send()` (aceita string ou objeto; devolve `boolean`), `close()` e `readyState` (getter). Por isso os `handleSend` (que fazem `readyState === WebSocket.OPEN` e `.send(JSON.stringify(...))`) **continuam funcionando sem alteração** e o fallback para REST quando o socket está fora do ar **segue intacto**.

**Arquivos alterados (4):**
- `apps/vitrine/src/lib/ws.ts` — + `createReconnectingSocket` + tipos `ReconnectingSocket`/`ReconnectingSocketOptions`.
- `apps/gestor/src/lib/ws.ts` — idem (mesmo helper; `wsUrl` de cada app preservado).
- `apps/vitrine/src/pages/Mensagens.tsx` — import + `socketRef` tipado + efeito do chat migrado.
- `apps/gestor/src/pages/RedeSocial.tsx` — import + 2 `wsRef` tipados + os 2 efeitos (B2B e B2C) migrados.

**Verificação:**
- **Teste de lógica isolado (Node + mock WebSocket + fake timers):** `/tmp/ws_test.mjs`, **14/14 asserts** — conecta 1×, abre, callbacks de status, `send` devolve `true`/`false` conforme estado, **heartbeat dispara**, **reconecta após queda** (dentro do backoff) e **`close()` do usuário impede reconexão e heartbeat futuros**. (Não é o build do projeto — é a mesma lógica portada para JS puro para validar o comportamento em runtime, já que o sandbox não builda o front.)
- **Estático:** `grep` confirma **0 usos remanescentes de `new WebSocket`** no `src` dos apps e **0 `wsUrl` órfão** nos consumidores; os 3 pontos agora usam `createReconnectingSocket`.

**Impacto esperado:** chat volta sozinho após deploy/queda/rede instável; menos "por que a loja não respondeu?" (na verdade a msg chegou, o socket é que tinha morrido) → **menos suporte e menos lead perdido**. **Riscos:** baixos — mudança isolada no client; se algo falhar, o pior caso é o comportamento antigo (recair no fallback REST do `handleSend`). Um proxy que corte a conexão a cada <25s ainda derrubaria (raro; ajustar `heartbeatMs` se aparecer).

#### 3. 🟡 Não consegui commitar (limitação de ambiente, não do código)

A tarefa autoriza commit na branch "Alterações Claude". **Não foi possível:** existe um `.git/index.lock` (0 byte, criado 05:16, dono = host) que **não removo do sandbox** (`Operation not permitted` no mount Windows) — logo qualquer `git commit` falha ao adquirir o lock. **Os 4 arquivos estão prontos e íntegros no working tree**, junto do seu WIP. **Ação para você:** apagar `.git/index.lock` na sua máquina e commitar (sugiro isolar meus 4 arquivos de front num commit próprio, ex.: `git add apps/vitrine/src/lib/ws.ts apps/gestor/src/lib/ws.ts apps/vitrine/src/pages/Mensagens.tsx apps/gestor/src/pages/RedeSocial.tsx`). Reforço o recado herdado: **há bastante trabalho bom fora do git** — vale um commit.

#### 4. 🎯 Próximas melhorias sugeridas (para as próximas rodadas)
- **Indicador de status de conexão no chat (UX):** o helper já emite `onStatusChange`; falta plugar num badge "reconectando…" no header do chat. Deixei de fora agora para não mexer em JSX sem poder buildar.
- **Teto de conexões no `ConnectionManager` (backend, resto do B024):** o `dict` em memória cresce sem limite; sob carga/múltiplas abas vira dívida. Precisa de boot ao vivo para validar — fica para uma rodada com ambiente saudável.
- **Deprecações Pydantic V2→V3** (herdado da #10) e **`enums.csv`/mappings** com diffs grandes a conferir na sua máquina (o mount trunca).

---

### Execução #11 — 2026-07-02 ~00:25 BRT (03:25 UTC)

**Escopo:** revisão do delta desde a #10 (você seguiu desenvolvendo: WebSocket de chat em tempo real, páginas institucionais, KePlaca real, regra de contato por loja) + auditoria de segurança do código novo. **Achado operacional importante logo no item 0 — leia antes de tudo.** Nenhum arquivo de código foi alterado nesta rodada (explico o porquê no item 0).

#### 0. ⚠️ ACHADO CRÍTICO DE MÉTODO — o mount do sandbox estava servindo cópias TRUNCADAS de 3 arquivos (seu código real está OK)

Ao subir a verificação, o sandbox Linux acusou **SyntaxError** em `routers/veiculos.py` (linha 1267, `Depends(get_cu` — cortado no meio da palavra) e depois em `routers/vitrine_interativo.py` (linha 598, `[` nunca fechado). Se eu tivesse confiado nisso, teria concluído "a API não sobe" (falso P0) — e, pior, se tivesse "consertado" reescrevendo pelo bash, teria **gravado a versão truncada por cima do seu arquivo bom** e criado a corrupção que eu estava investigando. Investiguei antes de tocar em nada:

- **Seu arquivo real está íntegro.** Lendo pela ferramenta de arquivo (que acessa o arquivo real na sua máquina, não a cópia do sandbox), `veiculos.py` tem **1284 linhas** com a função `remover_documento` completa e fechada (`await db.commit()` na 1281); `vitrine_interativo.py` fecha o list-comprehension na 604 e segue até a 619; `schemas.py` tem o comentário completo na 1392. O **git HEAD** (seu "Commit inicial") também tem essas funções completas — cruzei as duas fontes.
- **O que estava truncado era só a cópia do mount** do sandbox (veiculos 1266 vs 1284 real; vitrine_interativo 603 vs 619; schemas cortado num comentário de EOF — inofensivo). Provável snapshot parcial de escrita durante o dev ativo, que não re-sincronizou (mtime travado às 23:41).
- **Prova de saúde:** restaurei as caudas numa cópia isolada em `/tmp` (a partir do conteúdo real) e o **backend inteiro compilou com 0 erros** (`py_compile` em todos os `.py`). Ou seja: **na sua máquina a API sobe normal — não há P0 aqui.**
- **Por isso esta rodada não aplicou nenhum patch:** seu código já está correto; qualquer escrita minha vinda do mount arriscava clobberar o arquivo bom. A convenção "#08 aplica fixes seguros" continua — só que "seguro" hoje era **não escrever**.
- **Recomendação de operação:** os 3 arquivos com working-tree divergente ainda são **100% recuperáveis do git HEAD** (mais um motivo de o `git init` da #08+ ter valido ouro). Sugiro **commitar o trabalho novo** (13 arquivos modificados + novos não rastreados listados abaixo) assim que possível — hoje há bastante coisa boa fora do controle de versão.

#### 1. 🟢 Delta desde a #10 — entregas novas, todas revisadas e saudáveis

- **Chat em tempo real (WebSocket) — feature nova relevante.** `b2b.py` (`/v1/b2b/chat/ws`) e `vitrine_interativo.py` (`/chat/ws` B2C) com um `ConnectionManager` em memória. **Auditei a auth:** ambos exigem `token`, decodificam via `decode_access_token`, extraem `sub` e **fecham com `WS_1008` se qualquer etapa falhar**. No `b2b`, antes de gravar/rebroadcast a mensagem, valida que o usuário **é participante da conversa** (`cliente_id` OU membro de `loja_a/loja_b/loja` via `MembroLoja`) — **sem IDOR** (mesmo cuidado do fix B023 da #09/#10). ✅
- **`ws.ts` novo (gestor + vitrine) — correção proativa de produção.** Resolve a URL do WebSocket tratando que **a Vercel NÃO faz proxy de WS**: em produção o front fala direto com o Fly via `VITE_WS_URL`; em dev cai no host local. Isso evitaria um bug clássico de "chat funciona em dev e morre em produção". 👏
- **Regra de negócio de contato (o tipo de coisa que você pediu para eu pegar sozinho).** Novo `vitrine/src/lib/contato.ts` documenta e centraliza a regra: **o contato de um veículo é SEMPRE o WhatsApp da loja que anuncia**; canais globais são só da plataforma (páginas institucionais). Para sustentar isso, `veiculos.py` passou a **hidratar `loja_whatsapp`** no feed **e** no detalhe do veículo, e `schemas.py` ganhou `loja_whatsapp` no `VeiculoB2CResponse`. Consistente ponta a ponta. ✅
- **KePlaca de verdade:** a consulta de placa (`veiculos.py` §5.5) saiu de **stub** para **scraping server-side** real (fecha o resíduo do M019).
- **Páginas institucionais novas:** `Sobre`, `Termos`, `Privacidade`, `Anuncie` (+ `Layout`) — necessárias para produção/LGPD e para revisão de loja de app / Meta.
- **Mappings do simulador** (`bv/c6/santander.json`) e `enums.csv` regenerados (diffs grandes, aparência de reordenação/regeneração — ver ressalva no item 3).

#### 2. ✅ Verificado nesta rodada
- **Sintaxe:** backend inteiro compila **0 erros** (após restaurar, numa cópia isolada, as 3 caudas que o mount truncou — item 0).
- **Auth dos 2 WebSockets:** token obrigatório + validação de participação na conversa (b2b) → sem vazamento entre lojas.
- **Consistência da regra de contato:** `loja_whatsapp` presente no schema **e** hidratado nas duas rotas B2C (feed + detalhe).
- **Git existe** (Fase 0 do deploy, bloqueadora nas #01–#08, **resolvida**). Continua com 1 commit; o delta novo está no working tree.

#### 3. 🟡 Gaps / proativos (para você decidir — nenhum bloqueia uso hoje)
- **Contatos temporários hardcoded** em `contato.ts`: fallback `VITE_CONTATO_WHATSAPP='5517991110057'` e `VITE_CONTATO_EMAIL='galipcorporation@gmail.com'`. O próprio arquivo marca como **TEMPORÁRIO ("trocar antes de escalar")**. Além disso, `galipcorporation@gmail.com` não parece o e-mail da marca "Social Veículos" — **confirmar** e setar as duas envs na Vercel antes de divulgar. (P2)
- **Trabalho novo fora do git:** 13 arquivos modificados + não rastreados (`vitrine/src/lib/{ws,contato}.ts`, `gestor/src/lib/ws.ts`, `vitrine/src/pages/institucional/*`, `vitrine/.env.example`, `tests/test_triagem_tenant.py`). **Commitar** para não perder e para manter a rede de recuperação que salvou o item 0. (P2)
- **WebSocket sem heartbeat/reconexão nem teto de conexões:** o `ConnectionManager` é um `dict` em memória que cresce sem limite e o cliente não tem ping/backoff. Funciona bem no volume atual; vira dívida técnica sob carga / múltiplas abas. Sugiro **B024** (P3): ping periódico + reconnect exponencial no client e limpeza de conexões mortas.
- **`enums.csv` com o header (`enum,tabela,coluna,...`) aparecendo como removido no diff** — provável reordenação/regeneração, mas como o mount trunca arquivos nesta rodada não pude confiar 100% na leitura via bash. **Conferir na sua máquina** que o header e as linhas de `BancoSimulador` seguem íntegros. (P3, verificação)

#### 4. ℹ️ Limitações desta rodada (transparência)
- **Sem boot ao vivo / `pytest` no sandbox** por causa do mount truncado (item 0) — não instalei as deps pinadas (fastapi/sqlalchemy/pytest) porque o gargalo não era dependência, era a integridade dos arquivos servidos ao sandbox. A validação de sintaxe foi feita na cópia isolada e íntegra.
- **Referência:** a #10 já rodou `pytest` **10/10 na sua máquina** (B015/B016/B021/B023 fechados). Nada no delta desta rodada mexe naqueles caminhos, então não há motivo para regressão — mas o ideal é **rodar `pytest` de novo aí** depois de commitar, para carimbar o chat WS e a hidratação de `loja_whatsapp`.

---

### Execução #10 — 2026-07-01 (validação ao vivo, após você liberar disco)

**Escopo:** você liberou o espaço em disco e pediu para rodar o que ficou pendente na #09. Reiniciou o sandbox, subiu limpo, e finalmente validei tudo ao vivo.

#### 1. ✅ Testes ao vivo — os 500 do admin e o fix da triagem confirmados

- **Na sua máquina (deps de produção — Pydantic 2.12):** `pytest` → **10/10 passaram**, incluindo os 7 de `test_auth_multiloja.py` que travam **B015/B016/B021** (admin loga sem 500, com/sem `X-Loja-Id`, gestor não troca de tenant pelo header). **Confirma ao vivo** que os três 500 herdados estão fechados de verdade.
- **No sandbox:** escrevi e rodei um **teste de regressão novo para o B023** — `tests/test_triagem_tenant.py`: cria uma conversa B2C numa **loja alheia** e confirma que o gestor recebe **404** (antes do meu fix, vazava o histórico). **Passou.** Também rodei `py_compile` do backend inteiro: **0 erros**.

#### 2. ℹ️ Sobre os 2 "smoke tests" que falharam só no sandbox (não é bug seu)

No sandbox instalei sem querer versões **bleeding-edge** (fastapi 0.139 / starlette 1.3.1 / pydantic 2.13) em vez das suas fixadas. Nessas versões o `app.routes` mudou de formato (top-level conta 36 e não expõe `.path` igual), então `test_smoke.py::test_app_importa_e_tem_rotas` e `::test_rotas_criticas_presentes` quebram **por introspecção**, não por rota faltando — prova: no mesmo run os endpoints reais (`/v1/auth/login`, `/v1/admin/lojas`, credenciais, openapi) responderam **200** e passaram nos outros testes. **Na sua máquina os 2 passam (10/10).** Nada a corrigir no código. (Se quiser blindar contra versão futura da lib, dá pra deixar o smoke test checar via `app.openapi()["paths"]` em vez de `app.routes` — opcional.)

#### 3. 🟡 Achado proativo (tech-debt, não urgente) — deprecações Pydantic V2→V3

O `pytest` cospe ~44 avisos `PydanticDeprecatedSince20`: `class Config` (dezenas de schemas) e `from pydantic.generics import GenericModel` (`schemas.py:10`). **Não quebra hoje**, mas **quebrará no Pydantic V3**. Migração mecânica quando der: `class Config` → `model_config = ConfigDict(...)` e `GenericModel` → `BaseModel` genérico. Registrei aqui para não virar surpresa no dia do upgrade.

#### 4. 🎯 Estado

B015/B016/B021/B023 **fechados e verificados ao vivo**. Suíte verde no seu ambiente (10/10) + o teste novo do B023 no sandbox. `BUGS.md` atualizado (removidas as ressalvas de "verificação pendente"). Sobra, como antes: confirmar/rodar `git init` (Fase 0 do deploy) e a limpeza opcional (deprecações Pydantic, `Date.now()` em `assistente.py:472`, `except:` nus do Selenium).

---

### Execução #09 — 2026-07-01 ~13:40 BRT (16:40 UTC)

**Escopo:** revisão do delta desde a #08 (você seguiu desenvolvendo forte) + auditoria estática do código novo (esteira, marketing social, stories, triagem, aprovações) + 1 correção de segurança aplicada. **Limitação importante desta rodada declarada de cara no item 0.**

#### 0. ⚠️ Limitação séria — sandbox Linux fora do ar (sem boot/`pytest` nesta run)

Diferente das #02/#06/#07/#08, **não consegui subir a API nem rodar `py_compile`/`pytest`**: o ambiente Linux isolado falhou ao iniciar com **"Not enough disk space to set up the workspace"**. Consequências honestas:
- **Toda a análise abaixo é estática** (leitura de arquivos e busca por padrões), não boot ao vivo.
- Apliquei **apenas** uma correção de 1 linha, de risco mínimo e verificável por releitura (item 2). **Não** apliquei nada que exija compilar/rodar para confirmar — vira patch pronto (item 5).
- **Sugestão de operação:** liberar espaço em disco na máquina/host do sandbox para as próximas rodadas voltarem a validar ao vivo (o `node_modules` do monorepo é enorme; `dist/`, `.vite/`, `.pytest_cache/` e `__pycache__` são candidatos a limpeza).

#### 1. 🟢 Delta desde a #08 — MUITA entrega sua (e 2 gaps antigos fecharam)

Você continuou desenvolvendo. Novidades detectadas no disco desde a #08:
- **Testes automatizados entraram** — `apps/api/tests/{conftest.py,test_smoke.py,test_auth_multiloja.py}` + `apps/api/.pytest_cache/` presente (⇒ o `pytest` **já rodou**). Isso **fecha** o gap "zero testes automatizados" que as #01–#05 apontavam como maior risco de regressão. 👏
- **Migração `d3f8a1c46b90_fix_admin_papel_legado_e_vinculos.py`** — corrige de vez, por dados: **B021** (`UPDATE usuario SET papel='ADMIN_PLATAFORMA' WHERE papel='ADMIN'`) **e B015/B016** (`DELETE` dos vínculos `membro_loja` residuais dos admins de plataforma). É a solução certa e idempotente. Atualizei o `BUGS.md`: B015/B016/B021 → **Corrigidos** (com nota de que a confirmação formal ao vivo — `alembic upgrade head` + login admin — ficou pendente por causa do item 0).
- **Feature nova inteira — Esteira Pós-venda:** `routers/esteira.py`, `esteira_worker.py` (alertas de prazo D-7/vencido, dedup pelo `link`, roda de hora em hora no lifespan), migração `c1a2b3d4e5f6`, `pos_venda_template.py`, `backfill_esteira.py`, `detran_provider.py` (plugável, não inventa dado) + doc `ESTEIRA-POS-VENDA.md`.
- **Outros routers novos:** `marketing_social.py` (OAuth Meta/Instagram + publicação/agendamento, M024, sob paywall `Modulo.MARKETING`), `stories.py` (stories B2B/B2C com delay de exclusividade), `triagem.py` (classificação de lead por IA), `aprovacoes.py` (fila de aprovação B2B).
- **Observabilidade:** Sentry integrado no `main.py` (via `settings.sentry_dsn`/`app_env`) + `sentry-sdk[fastapi]` no `requirements.txt`.
- **Registro de rotas:** `main.py` inclui **25 routers**, todos os novos entre eles; os imports batem com os módulos no disco (padrão B008 sem regressão na leitura estática).

#### 2. 🟢 CORRIGIDO (aplicado nesta run) — B023: vazamento entre lojas na triagem (IDOR)

`POST /v1/gestor/triagem/{conversa_id}` (`routers/triagem.py`) carregava a `Conversa` filtrando só por `id` **+** `tipo == B2C`, **sem** `loja_id`. Como o `_classificar_conversa` monta o histórico das mensagens e o envia à IA (e a rota devolve dados da triagem), um gestor da **loja A** que soubesse/adivinhasse o `conversa_id` de outra loja podia **disparar a triagem e ler o histórico de conversa da loja B**. A rota-irmã `GET /v1/gestor/triagem` (`listar_triagens`) **já** filtrava por `Conversa.loja_id == ctx.loja_id`; só o `triar_conversa` escapava.

**Fix aplicado:** adicionei `Conversa.loja_id == ctx.loja_id` ao `where` do `triar_conversa` (espelha exatamente o filtro já usado e verificado na função de listagem, no mesmo arquivo). **Verificação possível nesta run:** reli o trecho após editar — sem corrupção de bytes, sintaxe coerente, `ctx.loja_id` é válido no escopo. **Verificação ao vivo (pytest/boot) pendente** por causa do item 0. Registrado como **B023** no `BUGS.md`.

> Por que só este e nada mais: é a única mudança que consigo fazer com segurança sem poder compilar — uma linha, num `where` já existente, idêntica a código que já roda ao lado. Editar mais Python "no escuro" (sem `py_compile`, e com o histórico de corrupção do editor no mount Windows relatado na #08) arriscaria derrubar o import da API inteira — exatamente o tipo de regressão que essas rodadas nunca introduzem.

#### 3. ✅ Auditoria do código novo — o resto está bem-feito e multi-tenant seguro

Revisei linha a linha os arquivos novos contra os "Padrões a vigiar" do `BUGS.md` e o anti-padrão `current_user.loja_id` da #08:
- **`esteira.py`** — sólido: todo acesso filtra `loja_id`, `recalcular_estagio`/portão de conclusão coerentes com o `ESTEIRA-POS-VENDA.md`, lançamento financeiro idempotente (dedup por descrição), datas normalizadas para UTC-aware. ✅
- **`esteira_worker.py`** — dedup por `link`, só itens críticos (comunicação de venda / transferência), `except Exception` com log. ✅
- **`aprovacoes.py`, `stories.py`, `marketing_social.py`** — todos filtram `loja_id`/usam `ctx.loja_id`; OAuth Meta guarda `loja_id` no `state`; segredos via Fernet. ✅
- **Anti-padrão `current_user.loja_id`:** **não existe mais** em nenhum router (era só o `notificacoes.py`, corrigido na #08). O `notificacoes.py` segue correto (usa `B2BContext.loja_id`).
- **`main.py`:** sem imports de router inexistente; error handler global, headers OWASP, workers no lifespan — tudo consistente.

#### 4. 🟡 Higiene/menores (herdados, inalterados — não bloqueiam)

- **`Date.now()` resíduo** em `routers/assistente.py:472` — ramo inalcançável (guard sempre falso), não quebra; trocar por `datetime.now(timezone.utc).timestamp()` (candidato **B022**).
- **`except:` nus** (≈15) em `simulador/automation/*` e `bancos_login/*` (Selenium) — trocar por `except Exception:` + log.
- **`print()`** na init do Sentry (`main.py:51/53`) — usar `logging`.
- **`.env.example`:** não consegui reconfirmar o conteúdo nesta run (o `.env`/`.env.example` não apareceu na varredura — provavelmente coberto pelo `.gitignore`). O código novo lê via `os.getenv`: `FERNET_KEY` (marketing_social — sem ela publicar/agendar dá 503), `META_APP_ID/SECRET/REDIRECT_URI` (OAuth Meta), `ANTHROPIC_API_KEY` (triagem cai para "aprovado por padrão"). **Documentar essas chaves no `.env.example`** para quem for fazer deploy.

#### 5. 📌 Deixei para você / próxima run (precisa de boot para validar com segurança)

1. **Confirmar B015/B016/B021/B023 ao vivo** quando o sandbox voltar: `alembic upgrade head` + `pytest` + login admin real. (Marquei como corrigidos no `BUGS.md` com essa ressalva.)
2. **Git (Fase 0 do deploy):** só encontrei `.gitignore`; **não confirmei um repositório `.git/` inicializado**. Se ainda não há, `git init` + 1º commit continua sendo a pendência bloqueadora de deploy.
3. **`deps.py` idempotente** (defesa em profundidade contra a volta de B015/B016) e **backdoor de e-mail** (`rbac.py`/`auth.py`/`deps.py`) — patches das #02/#03 seguem válidos; não reauditei o `deps.py`/`auth.py` a fundo nesta run (foco no código novo).
4. **Documentar secrets no `.env.example`** (item 4).
5. **Housekeeping** do item 4 + liberar disco para o sandbox voltar a validar ao vivo.

#### 6. 🎯 Recado direto

Boa notícia dupla desde a #08: **você fechou o maior risco de qualidade (agora há testes rodando)** e a **migração já resolve os 500 do admin** (B015/B016/B021) da forma certa. Do lado proativo, varri todo o código novo e achei **um** furo real — o vazamento de conversa entre lojas na triagem (B023) — e **corrigi**. O que me segurou de fazer mais foi honesto e concreto: **o sandbox caiu por falta de disco**, então não pude compilar/testar nada, e mexer em Python sem essa rede de segurança arriscaria uma regressão de boot. Quando o disco liberar, a próxima run já valida tudo ao vivo e fecha as ressalvas.

---

### Execução #08 — 2026-07-01 12:40 BRT (15:40 UTC)

**Escopo:** esta rodada foi diferente das 7 anteriores. Detectei **desenvolvimento ativo em tempo real** — a API estava no ar (o WAL do banco foi escrito ~1 min antes da minha checagem) e **8 arquivos de código foram editados nos últimos 30 min**, incluindo um `routers/notificacoes.py` novo em folha. Como você pediu de forma explícita ("seja proativo", "sem que eu precise apontar coisas", citando justamente as notificações), **mudei a postura: passei a aplicar correções seguras e verificadas ao vivo, não só diagnosticar.** Foco na feature que você acabou de escrever (notificações) + saneamento de release de baixo risco. Toda escrita foi verificada contra uma CÓPIA do banco, nunca o banco vivo.

#### 1. 🟢 CORRIGIDO E VERIFICADO — o sino de notificações dava 500 em todo poll

A feature de notificações que você montou tinha um **500 garantido** no caminho de leitura:
- `routers/notificacoes.py` lia `current_user.loja_id`, mas o modelo `Usuario` **não tem** coluna `loja_id` — a loja é resolvida via `membro_loja` / `B2BContext`, como em todo o resto do B2B. Resultado: `AttributeError: 'Usuario' object has no attribute 'loja_id'` → **500** em `GET /v1/notificacoes`, `POST /ler-todas` e `POST /{id}/ler`.
- O `Topbar.tsx` faz `GET /notificacoes` **a cada 10s** e engole o erro com `console.error` — ou seja, o sino estava quebrado silenciosamente o tempo todo para qualquer gestor logado.

**O que fiz (aplicado):** troquei as 3 rotas para resolver a loja via `get_current_b2b_user` → `B2BContext.loja_id` (o mesmo padrão do resto do sistema; os 5 produtores de `Notificacao` já gravam com o `loja_id` da loja destino, então casa perfeitamente).

**Verificação ao vivo** (API subida de verdade contra uma cópia do banco):

| Passo | Antes | Depois |
|---|---|---|
| `GET /v1/notificacoes` (vazio) | 500 AttributeError | **200** `[]` |
| `GET` com 1 notificação semeada | 500 | **200** (1 item) |
| `POST /{id}/ler` | 500 | **200** `{"ok":true}` |
| `POST /ler-todas` | 500 | **200** `{"ok":true}` |
| `GET` após marcar lidas | 500 | **200** `[]` |

Bônus: clientes B2C (papel `CLIENTE`) agora recebem **403** (correto) em vez de 500 — o sino é do Gestor, não da vitrine.

⚠️ **Transparência (incidente de ferramenta):** ao aplicar a 1ª edição, a ferramenta de edição gravou **30 bytes nulos** no meio do arquivo (corrupção de encoding no mount Windows), o que quebraria o import. **Detectei na hora** (`py_compile` + contagem de bytes nulos), reescrevi o arquivo **byte-limpo pelo shell** e reconfirmei: 0 bytes nulos, compila, e a API sobe e responde 200. Daqui pra frente faço toda escrita neste projeto pelo shell.

#### 2. ✅ APLICADO — 5 correções de release/segurança de baixo risco (todas verificadas)

1. **`requirements.txt`:** adicionei `email-validator>=2.0.0`. Sem ela o boot do zero **quebra** (schemas de `auth.py` usam `EmailStr`) — gap arrastado desde a #02.
2. **`config.py` (P0 de segurança):** o `webhook_secret` (autentica o webhook de pagamento) tinha default público e **não** era validado no boot — dava pra forjar confirmação de pagamento em produção. Coloquei no mesmo validador do `jwt_secret`: agora **falha o boot** em produção (`api_debug=false`) com o valor default. Verifiquei: dev sobe normal; prod com default é **bloqueado**.
3. **`.env`:** o `WEBHOOK_SECRET` estava **ausente** (a instância rodava no default público). Gerei e gravei um valor real (dev).
4. **`.env.example`:** documentei `WEBHOOK_SECRET` e as chaves de IA (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`ELEVENLABS_API_KEY`) — antes ninguém tinha como saber que essas variáveis existiam.
5. **`apps/api/package.json`:** o script `dev` tinha `cd apps/api &&` (virava `apps/api/apps/api` e falhava). Removido — `pnpm dev:api` volta a subir a API.

Reconfirmei o **boot completo da app após todas as mudanças: sem regressão** (rotas de notificação em 200, app importa limpo).

#### 3. 🔄 Status atualizado dos bugs herdados (mudou desde a #07)

- **B015/B016 — agora VERDE (não reproduzem mais).** A causa das #02–#07 era o `victorbelocorreia@gmail.com` ter **1 vínculo `membro_loja` inativo** que o `get_current_b2b_user` re-inseria (violando o UNIQUE). Agora o victor@ está com **0 vínculos** (a linha inativa sumiu desde a #07 — você deve ter limpado). Testei ao vivo: victor@ em `GET /v1/notificacoes` → **200 OK**. O **código** do `deps.py` ainda tem a falha latente (insere sem checar se já existe), mas **não está sendo disparado**. Patch pronto no item 5.
- **B021 — ainda VERMELHO.** `admin@socialveiculos.com` tem `papel='ADMIN'` (valor legado fora do enum) → 500 `LookupError`. Reproduzi ao vivo agora. **Não apliquei** porque é escrita no banco vivo (locked pela API no ar — risco de corromper o WAL). O `seed.py` já cria a conta certa (`ADMIN_PLATAFORMA`), então é só dado legado. Comando (com a API parada): `UPDATE usuario SET papel='ADMIN_PLATAFORMA' WHERE papel='ADMIN';`
- **Sem Git** e **sem testes automatizados**: inalterados.

#### 4. 🔎 Revisão do resto do código novo (b2b, vitrine_interativo, admin)

- Varri **todos** os routers atrás do mesmo anti-padrão `current_user.loja_id`: **só existia no `notificacoes.py`** (já corrigido). Nenhum outro endpoint afetado (os `.loja_id` do `admin.py` são path-param/coluna de modelo, não atributo do usuário).
- Os 5 **produtores** de `Notificacao` (`b2b.py` ×4, `vitrine_interativo.py` ×1) estão corretos: gravam com o `loja_id` da loja **destino**, dentro de `try/except`. ✅
- Minúcia (não apliquei): os produtores usam `print(...)` em vez do `logging` do app (mesmo padrão dos 7 `print()` já vigiados).

#### 5. 📌 Deixei para você (sensível mexer com a API no ar) — patches prontos

1. **`deps.py` idempotente** (previne a volta do B015/B016): antes do `db.add(MembroLoja(...))`, buscar vínculo existente (sem filtrar `ativo`) e reativar em vez de inserir. (Trecho na Execução #02, item 1.)
2. **B021:** o `UPDATE` de 1 linha acima (com a API parada).
3. **Backdoor de e-mail** (`rbac.py`/`auth.py`/`deps.py`): trocar `if email == "victorbelocorreia@gmail.com"` por checagem de papel `ADMIN_PLATAFORMA`. (Execução #03, item 2.)
4. **`git init` + 1º commit** (Fase 0 do deploy) — não fiz agora pra não capturar um snapshot no meio das suas edições.
5. **Migração Alembic para `notificacao`** — a tabela não tem migração (só é criada pelo `create_all` no startup, que cobre o runtime). Para paridade com o Alembic em produção, gerar a revisão com o `create_table` do modelo.

#### 6. 🎯 Recado direto

Diferente das 7 rodadas anteriores, **esta mexeu no código** — porque você pediu isso de forma explícita e porque o bug estava justamente na feature que você estava escrevendo agora. **O sino de notificações está funcionando** (verificado ponta a ponta), mais 5 correções de release/segurança aplicadas e verificadas, tudo **sem regressão**. O que sobra é curto e é decisão sua: os 5 patches do item 5 — nenhum bloqueia o uso hoje. Se quiser, na próxima rodada aplico o `deps.py` e a migração do `notificacao` também.

⚠️ *Nota de reconciliação:* editei `routers/notificacoes.py`, `config.py`, `requirements.txt`, `package.json`, `.env` e `.env.example` enquanto você estava editando. Se você tinha alterações não salvas em algum deles, seu save prevalece — confira o diff desses arquivos.

---

### Execução #07 — 2026-07-01 07:23 BRT (10:23 UTC)

**Escopo:** re-verificação de estado (delta desde a #06) + **boot da API ao vivo** com o banco real copiado + reprodução dos dois 500 do acesso admin **pela auth real** (sem contornar `get_current_b2b_user`) + 1 achado menor novo. Nenhum arquivo de código alterado no fim; editei só este `cowork.md`. (Ver a nota de método no item 6.)

#### 1. 🔁 Delta desde a #06: **zero mudança de código** (7ª rodada seguida)

`find apps packages -mmin -75` (fora `.pyc`/`.db`/`dist`) → **vazio**. O fonte mais recente segue sendo `apps/api/routers/veiculos.py` (03:40 UTC) — nada tocado desde a #05/#06. Todos os P0/P1 das #02–#06 permanecem abertos (Git ausente, `email-validator` ausente, `webhook_secret` fora do validador + ausente do `.env`, backdoor de e-mail, B015/B016, B021 do admin@, script `dev`, `.db` vazio na raiz).

#### 2. 🔴 B015/B016 reconfirmados ABERTOS — reproduzidos ao vivo pela auth real

Desta vez subi a API e bati o endpoint **com o usuário admin real** (`victorbelocorreia@gmail.com`, carregado do banco vivo), deixando o `get_current_b2b_user` real rodar:

- `GET /v1/configuracoes/credenciais_banco` → **500 `IntegrityError: UNIQUE constraint failed: membro_loja.usuario_id, membro_loja.loja_id`** no `INSERT INTO membro_loja`.
- Confirma a causa da #02: o admin tem **1 vínculo `membro_loja` inativo** (`ativo=0`, loja `b4cbb4cf…`). Em `deps.py:96` o filtro é `ativo==True` (não acha), cai no `else` (`:104-117`), escolhe a mesma loja e faz `db.add(MembroLoja(...))` do par `(usuario_id, loja_id)` que já existe → viola o `UNIQUE`. **Não feche B015/B016.**

#### 3. 🔴 B021 (admin@socialveiculos.com) reconfirmado — papel legado no enum

`SELECT papel, COUNT(*) FROM usuario` → `ADMIN`(1) · `ADMIN_PLATAFORMA`(1) · `GESTOR`(4) · `VENDEDOR`(1) · `CLIENTE`(3). A conta `admin@socialveiculos.com` (id `6a20c6d5…`) tem `papel='ADMIN'`, valor que **não existe mais** no enum (`PapelUsuario` → `ADMIN_PLATAFORMA`). Carregar a linha via ORM → **`LookupError: 'ADMIN' is not among the defined enum values`**. Fix pronto (1 linha): `UPDATE usuario SET papel='ADMIN_PLATAFORMA' WHERE papel='ADMIN';` + ajustar o `seed.py`. (Entrada B021 pronta para o `BUGS.md`, ver #06.)

#### 4. 🧹 NOVO menor (P3) — resíduo de JS em código Python

`apps/api/routers/assistente.py:472`: o fallback do `message_id` é `f"manual-{Date.now() if 'Date' in globals() else datetime.now().timestamp()}"`. O ramo `Date.now()` é **inalcançável** (o guard `'Date' in globals()` é sempre falso nesse módulo) e `datetime`/`timezone` já estão importados — então **não quebra em runtime**, mas é resíduo de JS num `.py` (o próprio `BUGS.md` vigia isso no padrão #4). Fix trivial: `f"manual-{datetime.now(timezone.utc).timestamp()}"`. Sugiro registrar como **B022** (o B021 já está reservado para o admin@ na #06). Não apliquei (convenção read-only).

#### 5. ✅ Confirmado OK (sem regressão)

- Boot ao vivo: `import main` limpo → **34 rotas** (com `email-validator` instalado no sandbox — reconfirma que o boot do zero exige essa dep, ainda **ausente** do `requirements.txt`).
- Banco vivo: Alembic **no head** `2175ae5b512d`; a `credencial_banco` **já tem** a coluna `usuario_id` e ambas as tabelas de credencial estão vazias → **descarta em definitivo a hipótese de "drift de schema/enum" da #01** como causa do 500 (o erro é 100% da auth, itens 2/3).
- `TAREFAS.md`: **145/0**. `BUGS.md`: B015/B016 seguem em Abertos `[ ]` (confirmei e restaurei — ver item 6).

#### 6. ⚠️ Nota de método (para a #08 não cair na mesma armadilha)

No meio desta run quase repeti o erro da #01: testando os endpoints com o `get_current_b2b_user` **contornado** (via `dependency_overrides`), os dois retornam `200 []` — o que *parece* "resolvido". Cheguei a marcar B015/B016 como `[x]` no `BUGS.md` e a limpar o `Date.now()` no código; **revertesi as duas coisas** ao subir a API pela auth real e ver o 500. Lição registrada: **o 500 mora no `get_current_b2b_user`; qualquer teste que substitua essa dependência dá falso-verde.** Sempre reproduzir com o usuário admin real. (`BUGS.md` e `assistente.py` foram restaurados ao estado original; nada de código ficou alterado nesta run.)

#### 7. 🎯 Recado direto

7ª rodada, **nada mudou no código**. O que separa o projeto de "full pronto" continua sendo aplicar os patches já prontos (nenhum é novo nesta run, exceto o P3 do `Date.now()`). **Ordem inalterada:** 1) `UPDATE membro_loja … ativo=1` (victor@) **+** `UPDATE usuario … papel='ADMIN_PLATAFORMA'` (admin@) → destrava os dois acessos e fecha B015/B016 · 2) corrigir `get_current_b2b_user` (impede reincidência) · 3) `webhook_secret` no boot + `.env.example` *(P0)* · 4) `email-validator` no `requirements.txt` · 5) `git init` + 1º commit · 6) backdoor de e-mail → papel `ADMIN_PLATAFORMA` · 7) housekeeping (script `dev`, `.db` vazio, `except:`→`except Exception:`, `print()`→`logging`, `Date.now()`→`datetime`).

---

### Execução #06 — 2026-07-01 06:20 BRT (09:20 UTC)

**Escopo:** re-verificação de estado (delta desde a #05) + **boot da API ao vivo** (venv com as deps reais) + reprodução direta dos endpoints de credencial + **1 achado NOVO P1** na conta admin. Nenhum arquivo de código alterado; editei só este `cowork.md`.

#### 1. 🔁 Delta desde a #05: **zero mudança de código** (6ª rodada seguida)

`find apps packages -mmin -90` (fora `.pyc`/`.db`) → **vazio**. O arquivo-fonte mais recente segue sendo `apps/api/routers/veiculos.py` (03:40 UTC) — nada tocado desde a #05. Todos os P0/P1 das #02–#05 permanecem abertos (Git ausente, `email-validator` ausente, `webhook_secret` fora do validador + ausente do `.env`, backdoor de e-mail, B015/B016, script `dev`, `.db` vazio na raiz).

#### 2. 🔴 NOVO — B021: **segunda** conta admin quebrada, por papel legado no enum (P1, distinto do #02)

Ao subir a API e carregar usuários pelo ORM, **reproduzi um 500 novo, diferente do da #02**. Hoje existem **duas** contas "admin" e **cada uma quebra por um motivo diferente**:

| Conta | id | papel | Vínculo `membro_loja` | Como quebra (500) |
|---|---|---|---|---|
| `victorbelocorreia@gmail.com` | `76d8b0b9…` | `ADMIN_PLATAFORMA` ✅ | 1 vínculo, **inativo** (Auto Premium) | **#02:** `get_current_b2b_user` re-INSERE o vínculo que já existe → `UNIQUE constraint failed: membro_loja...` |
| `admin@socialveiculos.com` | `6a20c6d5…` | **`ADMIN`** ❌ (não existe no enum) | nenhum | **NOVO (B021):** hidratar a linha via ORM → `LookupError: 'ADMIN' is not among the defined enum values` → falha **já no login** |

**Causa do B021:** `PapelUsuario` foi renomeado de `ADMIN` → `ADMIN_PLATAFORMA` (`models.py:55`); o SQLAlchemy grava o **nome** do membro do enum e a linha antiga ficou com `papel='ADMIN'`. Faltou a migração de dados. Encaixa no padrão "enums renomeados" que o próprio `BUGS.md` já vigia. Contagem atual em `usuario.papel`: `ADMIN`(1, inválido) · `ADMIN_PLATAFORMA`(1) · `GESTOR`(4) · `VENDEDOR`(1) · `CLIENTE`(3).

**Fix pronto (1 linha — NÃO apliquei):**
```sql
UPDATE usuario SET papel = 'ADMIN_PLATAFORMA' WHERE papel = 'ADMIN';
```
E ajustar o `seed.py` para criar a conta como `PapelUsuario.ADMIN_PLATAFORMA` (evita reincidência ao re-semear). Entrada pronta para colar no `tarefa/BUGS.md` (o próprio arquivo diz que o próximo ID livre é **B021**):
> `- [ ] **B021 — Conta admin@socialveiculos.com com papel legado 'ADMIN' quebra o login (500)** · tabela usuario (id 6a20c6d5…) · qualquer carga ORM da linha → LookupError: 'ADMIN' is not among the defined enum values → enum renomeado para ADMIN_PLATAFORMA sem migração de dados. Fix: UPDATE + ajuste no seed.py. P1.`

#### 3. 🔁 B015/B016 — reconfirmados ABERTOS (agora com 2 causas no contexto admin)

Reafirmando o que a #02 corrigiu da #01: os **endpoints em si estão OK**. Rodei as queries exatas de `listar_credenciais_banco` e `listar_credenciais_ia` contra o banco atual (com IDs fixos, **sem** carregar `Usuario`) → **HTTP 200 `[]`** nas duas (tabelas vazias; a coluna `usuario_id` já está presente na `credencial_banco`, então a hipótese do enum/coluna da #01 está mesmo descartada). O 500 vem **antes**, na carga do usuário / `get_current_b2b_user` — e agora há **duas** portas para esse 500 (tabela do item 2). **Mantenha B015/B016 `[ ]`**: fecham junto com a correção da auth (dup-insert do victor@ **e** enum do admin@).

#### 4. ✅ Confirmado OK (sem regressão)

- **Boot ao vivo:** `import main` sobe limpo → **34 rotas** (venv com as deps reais). Reconfirma o gap da #02: **sem `email-validator` o boot quebra** (os schemas de `auth.py` usam `EmailStr`).
- `py_compile` de todo o backend: **0 erros**. Alembic **no head** (`2175ae5b512d`). `TAREFAS.md`: **145 `[x]` / 0 `[ ]`**. `BUGS.md`: B015/B016 seguem em Abertos `[ ]` (ninguém fechou por engano).

#### 5. 📋 Adendo ao bloco "APLICAR TUDO" da #05

O bloco da Execução #05 continua válido — só **acrescente** este passo, junto do passo 1 (auth), porque os dois destravam o acesso admin e, com ele, o B015/B016:
- **(P1) B021:** `UPDATE usuario SET papel='ADMIN_PLATAFORMA' WHERE papel='ADMIN';` + ajustar o `seed.py`.

#### 6. 🎯 Recado direto

6ª rodada, **nada mudou no código** — mas esta trouxe **um achado real e novo**: além do dup-insert do `victorbelocorreia@gmail.com` (#02), a conta `admin@socialveiculos.com` **nem loga** por causa do papel legado `ADMIN` (B021). São **dois** motivos independentes de 500 no acesso admin, ambos com fix de 1 linha. **Prioridade atualizada:** 1) `UPDATE membro_loja … ativo=1` (victor@) **+** `UPDATE usuario … papel` (admin@) — destrava os dois acessos e o B015/B016 · 2) corrigir `get_current_b2b_user` (impede reincidência) · 3) `webhook_secret` no boot + `.env.example` *(P0)* · 4) `email-validator` no `requirements.txt` · 5) `git init` + 1º commit · 6) backdoor de e-mail → papel `ADMIN_PLATAFORMA` · 7) housekeeping (script `dev`, `.db` vazio, `except:`→`except Exception:`, `print()`→`logging`).

---

### Execução #05 — 2026-07-01 05:10 BRT (08:10 UTC)

**Escopo:** re-verificação de estado (delta desde a #04) + auditoria de **completude de configuração/secrets** (`.env`/`.env.example`, chaves de IA) + **bloco consolidado "aplicar tudo"** para o seu retorno. Nenhum arquivo de código alterado; editei só este `cowork.md`.

#### 1. 🔁 Delta desde a #04: **zero mudança de código** (5ª rodada seguida sem movimento)

`find -mmin -90` (fora `.pyc`/`.db`) retornou **vazio**; o arquivo-fonte mais recente segue sendo `routers/veiculos.py` de 03:40 UTC — nada tocado desde a #04. Reconfirmei um a um:

| Item aberto (#01–#04) | Status agora |
|---|---|
| Repositório Git (Fase 0, bloqueadora) | ❌ ainda **sem `.git`** |
| `email-validator` no `requirements.txt` | ❌ ainda **ausente** (20 deps conferidas, nenhuma de e-mail) |
| B015/B016 — dup-insert em `get_current_b2b_user` (`deps.py:96-116`) | ❌ **inalterado** (ainda `db.add(MembroLoja(...))` sem checar vínculo inativo existente) |
| Backdoor de e-mail hardcoded | ❌ **inalterado** — 5 pontos de authz: `deps.py:94`, `rbac.py:69`, `auth.py:268/338/388` (os 3 de `seed.py` são legítimos) |
| `webhook_secret` fora do validador de boot (`config.py:35`) | ❌ **inalterado** (validador `config.py:59` só checa `jwt_secret`) |
| `WEBHOOK_SECRET` no `.env`/`.env.example` | ❌ ainda **ausente nos dois** |
| Script `dev` da API (`cd apps/api &&` duplicado) | ❌ ainda quebrado (`package.json` linha 6) |
| `socialveiculos.db` de 0 byte na raiz | ❌ ainda lá (0 byte, 03:31 UTC; o real é `apps/api/socialveiculos.db`, 946 KB) |

#### 2. 🔴 NOVO — `.env` incompleto: o `JWT` guardado, o `webhook` (que importa) escapando

Confirmei no `.env` real (valores mascarados) o que fecha a história de segurança das #03/#04 com evidência concreta:

- `.env:7` → `API_DEBUG=true` **e** `.env:16` → `JWT_SECRET=troque-esta-chave-em-producao` — ou seja, o `.env` atual carrega **exatamente o placeholder que o validador barra**. A instância só sobe porque `api_debug=true`.
- Ao setar `API_DEBUG=false` para produção: o boot **falha no JWT** (o `model_validator` de `config.py:59` pega) — isso é bom. **Mas** `webhook_secret` **não** está nesse validador, então sobe **silenciosamente** com o default público `troque-webhook-secret-em-producao`, usado direto em `routers/assinaturas.py:235` para validar o webhook de pagamento. Resumindo o risco em uma frase: **o segredo que você não tem como esquecer é o único guardado; o que de fato precisa ser guardado (confirmar pagamento) é o que passa batido.**

#### 3. 🟠 NOVO — chaves de IA e outros secrets **não documentados** no `.env.example`

`.env` e `.env.example` têm **só 8 chaves** (`comm` entre os dois = idênticos): `API_HOST/PORT/DEBUG`, `CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET/ALGORITHM/EXPIRE`. **Faltam por completo:**

- `WEBHOOK_SECRET` (item 2), `S3_*` (upload de mídia — cai em storage local sem elas), `MODULO_*_URL` (SSO dos módulos premium — hoje default `localhost`).
- **Chaves de IA:** `assistente/motor.py:28-30` lê `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` via `os.getenv` — **não são campos do `Settings`/`config.py`**. Quando ausentes, o código **degrada de propósito**: sem `ANTHROPIC_API_KEY` o assistente devolve *"resposta padrão mock"* (`motor.py:147`), sem `OPENAI_API_KEY` pula a transcrição Whisper, sem `ELEVENLABS_API_KEY` pula a voz. **Não quebra** — mas num deploy limpo a IA "responde", só que com texto mock, e **nada no `.env.example` avisa que essas chaves existem.** (Obs.: há também o caminho BYOK por loja — `routers/credenciais_ia.py`, chave cifrada no banco — que é independente dessas globais.)
- → Correção (documentação, baixo risco): adicionar essas chaves comentadas ao `.env.example` para quem for fazer deploy saber que precisa setá-las. Trecho pronto no bloco do item 5.

#### 4. ✅ Confirmado OK (sem regressão) + 🧹 achado menor

- `py_compile` de todo o backend: **0 erros** (exit 0). **24 routers** no disco = **24 `include_router`** no `main.py`. `TAREFAS.md`: **145 `[x]` / 0 `[ ]`**. `BUGS.md`: B015/B016 seguem em **Abertos `[ ]`** (ninguém fechou por engano).
- **Higiene inalterada:** 15 `except:` nus e 7 `print()` em `routers/`.
- **🧹 NOVO menor:** `apps/gestor/src/pages/ferramentas/EmBreve.tsx` (`ModuloEmBreve`) é **código morto** — não é importado nem roteado em lugar nenhum (grep por usos fora do próprio arquivo = 0). Confirma o "stub órfão" da #01; pode apagar. Já os "Em breve" da **vitrine** (login Google em `LoginModal.tsx:256-260` e algumas ações do `Feed.tsx`) são **stubs intencionais de produto** (toast "disponível em breve"), não bugs — deixo registrado só para não reaparecer como surpresa.

#### 5. 📋 Bloco consolidado "APLICAR TUDO" (ordenado, pronto pra colar — ~15 min no seu retorno)

Como esta é a 5ª rodada relatando os mesmos itens sem eu poder tocar no código (convenção read-only), reuni aqui **tudo** o que fecha o projeto, na ordem de aplicar. Os trechos de código vêm das Execuções #02/#03 já verificadas.

**(P1) 1. Fechar B015/B016 — destravar admin + impedir reincidência**
```sql
-- destrava já (reativa o vínculo inativo do admin):
UPDATE membro_loja SET ativo = 1 WHERE usuario_id = '76d8b0b9-0674-402a-bc27-ee95a16d2ec6';
```
```python
# apps/api/deps.py → get_current_b2b_user (ramo admin): reaproveitar vínculo inativo em vez de duplicar
existente = (await db.execute(
    select(MembroLoja).where(
        MembroLoja.usuario_id == current_user.id,
        MembroLoja.loja_id == loja.id,   # sem filtrar por ativo
    )
)).scalar_one_or_none()
if existente:
    existente.ativo = True               # reativa
    membro = existente
else:
    membro = MembroLoja(usuario_id=current_user.id, loja_id=loja.id,
                        papel=PapelUsuario.GESTOR, ativo=True)
    db.add(membro)
await db.commit()
```
Depois: marcar **B015 e B016 como `[x]`** no `tarefa/BUGS.md`.

**(P0) 2. `webhook_secret` no validador de boot** — `apps/api/config.py`, no `validate_secure_jwt_secret`:
```python
if not self.api_debug:
    if not self.jwt_secret or self.jwt_secret == "troque-esta-chave-em-producao":
        raise ValueError("JWT_SECRET deve ser alterado em produção (api_debug=False).")
    if not self.webhook_secret or self.webhook_secret == "troque-webhook-secret-em-producao":
        raise ValueError("WEBHOOK_SECRET deve ser alterado em produção (api_debug=False).")
```

**(P0) 3. `email-validator` no boot** — `apps/api/requirements.txt`: adicionar `email-validator>=2.0.0` (os schemas de `auth.py` usam `EmailStr`; boot limpo falha sem ele).

**4. Documentar secrets no `.env.example`** (e preencher os reais no `.env` de produção):
```dotenv
# Pagamentos
WEBHOOK_SECRET=troque-webhook-secret-em-producao
# IA (lidas via os.getenv em assistente/motor.py — sem elas a IA responde mock / pula voz e transcrição)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
# Storage de mídia (sem isto o upload cai em disco local)
# S3_ENDPOINT_URL= / S3_ACCESS_KEY= / S3_SECRET_KEY= / S3_BUCKET_NAME= / S3_REGION= / S3_PUBLIC_URL=
```
E, para produção: `API_DEBUG=false` + `JWT_SECRET` real (`python -c "import secrets; print(secrets.token_hex(32))")`.

**5. `git init` + 1º commit** — Fase 0 (bloqueadora) do `PLANO-DEPLOY-PRODUCAO.md`. Antes: conferir que o `.gitignore` cobre `.env`, `*.db`, `node_modules/`.

**6. Remover backdoor de e-mail → papel `ADMIN_PLATAFORMA`** — trocar os `if email == "victorbelocorreia@gmail.com"` de `deps.py:94`, `rbac.py:69`, `auth.py:268/338/388` por checagem de papel (o `seed.py` já cria a conta como `ADMIN_PLATAFORMA`). No `deps.py` isso também simplifica o ramo do admin do item 1.

**7. Housekeeping** — corrigir o script `dev` (`apps/api/package.json:6`, tirar `cd apps/api &&`); `rm ./socialveiculos.db` (0 byte da raiz); apagar `EmBreve.tsx` (morto); `except:`→`except Exception:`+log; `print()`→`logging`.

#### 6. 🎯 Recado direto

Nada mudou de novo desde a #01 no que depende de mexer no código — porque **eu, por convenção, não mexo** (a API está no ar e é sua a decisão). O que fiz de mais útil nesta rodada foi **fechar as pontas de configuração** (webhook/JWT no `.env`, chaves de IA não documentadas, `ModuloEmBreve` morto) e **empacotar tudo num único bloco "aplicar tudo"** acima, na ordem certa. Quando voltar: rode os 7 passos (dá ~15 min) ou me autorize (ajustando o texto da tarefa para "aplicar fixes seguros") a tocar sozinho os de baixo risco — `email-validator`, `webhook_secret` no validador + `.env.example`, script `dev`, `.db` vazio, `EmBreve.tsx` e `git init` — deixando pra você só a auth sensível (B015/B016 e o backdoor de e-mail).

---

### Execução #04 — 2026-07-01 04:10 BRT (07:10 UTC)

**Escopo:** re-verificação de estado (delta desde a #03) + confirmação item-a-item dos P0/P1 + um detalhe NOVO que agrava o P0 do `webhook_secret`. Nenhum arquivo de código alterado; editei só este `cowork.md`.

#### 1. 🔁 Delta desde a #03: **zero mudança de código** (4ª rodada seguida sem movimento)

Nenhum arquivo-fonte foi tocado desde a #02 (05:20 UTC). Só os `.pyc` de `__pycache__` foram regravados (~06:10 UTC) — sinal de que a API foi reimportada/reiniciada, **não** de edição de código. Reconfirmei um a um:

| Item aberto (#01–#03) | Status agora |
|---|---|
| Repositório Git (Fase 0, bloqueadora) | ❌ ainda **sem `.git`** |
| `email-validator` no `requirements.txt` | ❌ ainda **ausente** (lista conferida inteira) |
| B015/B016 — dup-insert em `get_current_b2b_user` (`deps.py:104-117`) | ❌ **inalterado** (ainda faz `MembroLoja(...)`+`db.add` sem checar vínculo inativo existente) |
| Backdoor de e-mail hardcoded (`deps.py:94`, + `rbac.py`/`auth.py`) | ❌ **inalterado** |
| `webhook_secret` fora do validador de boot (`config.py:35`) | ❌ **inalterado** |
| Script `dev` da API (`cd apps/api &&` duplicado) | ❌ ainda quebrado (`package.json` sem alteração desde 21/06) |
| `socialveiculos.db` de 0 byte na raiz | ❌ ainda lá (0 byte; o real é `apps/api/socialveiculos.db`, 946 KB) |

#### 2. 🔴 REFORÇO do P0 do `webhook_secret` — o default inseguro **já está valendo agora**

Na #03 o risco foi descrito como "*se* produção subir sem `WEBHOOK_SECRET`". Nesta rodada confirmei que é pior do que hipótese — é o estado atual:

- `WEBHOOK_SECRET` **não existe no `.env`** → a instância atual roda com o default `troque-webhook-secret-em-producao`.
- `WEBHOOK_SECRET` **também não existe no `.env.example`** → quem for fazer deploy **não tem nem como saber** que precisa setá-lo.
- Uso real confirmado: `routers/assinaturas.py:235` compara o header `X-Webhook-Secret` **direto** com `settings.webhook_secret`. Com o default (público, está no código), dá para **forjar confirmação de pagamento e ativar assinatura de graça**.
- → Correção (a da #03, agora em 2 partes): **(a)** adicionar `webhook_secret` ao validador `validate_secure_jwt_secret` do `config.py` (falhar no boot fora de dev se estiver no default, exatamente como já faz com o `jwt_secret`); **(b)** documentar a chave `WEBHOOK_SECRET=` no `.env.example`.

#### 3. ✅ Confirmado OK (sem regressão)

- `py_compile` de todo o backend: **0 erros** (exit 0).
- **24 routers** no disco = **24 `include_router`** no `main.py` (nenhum órfão).
- `tarefa/BUGS.md`: B015/B016 seguem corretamente em **Abertos `[ ]`** — ninguém fechou por engano (bom; era o risco apontado na #01).
- `tarefa/TAREFAS.md`: **145 `[x]` / 0 `[ ]`** → backlog de features 100%.

#### 4. 🟠 Gaps de release que continuam de pé (herdados, nada mudou)

- Sem **Dockerfile** em lugar nenhum do repo → infra de **Chrome headless em produção** (Simulador Selenium) ainda inexistente.
- **S3** só comentado no `.env.example` (`# S3_*`) → upload de mídia caindo em storage local (ok em dev, gap para produção).
- **Zero testes automatizados**; `lint`/`typecheck` da API são `echo 'python — skip'`.
- Higiene menor inalterada: **15 `except:` nus** e **7 `print()`** em `routers/`.

#### 5. ⚠️ Limitação (igual às anteriores)

Typecheck/build do front **não é validável neste sandbox** (`node_modules` instalado no Windows não resolve no Linux — só ruído "cannot find module 'react'"). Banco ao vivo não reaberto (WAL travado pela API rodando). **Assuma B015/B016 reproduzindo para a conta admin.**

#### 6. 🎯 Recado direto — o que separa este projeto de "full pronto"

Esta é a **4ª rodada seguida** relatando exatamente os mesmos itens abertos, com **zero linha de código alterada** — porque a convenção desta tarefa é **só diagnosticar, não mexer no código com você ausente** (mexer na auth com a API no ar, sem você, é arriscado). Consequência honesta: **do jeito atual o projeto não vai ficar "full pronto" sozinho** — os patches estão prontos para colar, mas alguém precisa aplicá-los. Para você chegar e estar redondo, escolha um caminho:

- **(A) Me autorizar** (ajustando o texto da tarefa para "aplicar fixes seguros") a aplicar sozinho o que é de baixo risco: `email-validator` no `requirements.txt`, `webhook_secret` no validador de boot + `.env.example`, corrigir o script `dev`, remover o `.db` vazio e rodar `git init`. Deixo de fora, para você, só o que é sensível mexer com a API no ar — a auth do B015/B016.
- **(B) Aplicar você mesmo** os patches já prontos: correção do `get_current_b2b_user` e `UPDATE membro_loja` (Execução #02, itens 1) + `webhook_secret`/backdoor de e-mail (Execução #03, item 2) — todos com trecho pronto para colar.

**Ordem de prioridade (inalterada):** 1) destravar admin (`UPDATE membro_loja …`) + corrigir `get_current_b2b_user` → fecha B015/B016 · 2) `webhook_secret` no boot + `.env.example` *(P0)* · 3) `email-validator>=2.0.0` no `requirements.txt` · 4) `git init` + 1º commit (Fase 0 do deploy) · 5) remover backdoor de e-mail → papel `ADMIN_PLATAFORMA` · 6) housekeeping (script `dev`, `.db` vazio, `except:`→`except Exception:`+log, `print()`→`logging`).

---

### Execução #03 — 2026-07-01 03:15 BRT (06:15 UTC)

**Escopo:** re-verificação do estado (delta desde a #02) + auditoria de segurança estática. Nenhum arquivo de código alterado; editei só este `cowork.md`.

#### 1. 🔁 Delta desde a #02: **nada mudou** — todos os P0/P1 seguem abertos

Nenhum arquivo (fora `.db`) foi modificado desde 05:20 UTC. Confirmei item a item:

| Item das #01/#02 | Status agora |
|---|---|
| Repositório Git (Fase 0, bloqueadora) | ❌ ainda **sem `.git`** |
| `email-validator` no `requirements.txt` | ❌ ainda **ausente** |
| B015/B016 — dup-insert em `get_current_b2b_user` (`deps.py`) | ❌ **inalterado** (linhas 110/116 ainda inserem sem checar vínculo existente) |
| Script `dev` da API (`cd apps/api` dentro do app) | ❌ ainda quebrado |
| `socialveiculos.db` de 0 byte na raiz | ❌ ainda lá |

Não consegui reabrir o banco ao vivo nesta rodada (`disk I/O error` — provável lock do WAL com a API rodando). Como o `deps.py` não mudou e o `UPDATE` de destravamento não foi aplicado por mim, **assuma que B015/B016 continua reproduzindo para a conta admin.**

#### 2. 🔴 NOVO — 2 achados de segurança (não estavam nas #01/#02)

1. **[P0] `webhook_secret` com default inseguro e fora do validador de boot.** Em `config.py:35`, o padrão é `"troque-webhook-secret-em-producao"` e — ao contrário do `jwt_secret` — **não** entra no validador `validate_secure_jwt_secret`. Esse segredo autentica o webhook de pagamento em `assinaturas.py:235`. Se produção subir sem `WEBHOOK_SECRET` no ambiente, dá para **forjar confirmação de pagamento e ativar assinatura de graça.** → adicionar `webhook_secret` ao mesmo validador que já barra o `jwt_secret` (falhar no boot fora de dev).
2. **[P1] Backdoor de e-mail hardcoded na autorização.** `victorbelocorreia@gmail.com` é tratado como super-admin por **string de e-mail** em `rbac.py:69`, `auth.py:268/338/388` e `deps.py:94` (no `seed.py` o uso é legítimo, só para criar a conta). Autorização por e-mail fixo é frágil e insegura para produção. → usar o papel `ADMIN_PLATAFORMA` (o `seed.py` já cria a conta com ele) e **remover** os `if email == "..."` da camada de authz. Bônus: simplifica o ramo do admin no `deps.py` e ajuda a eliminar a causa do B015/B016.

#### 3. 🟡 NOVO — higiene menor

- **15 `except:` nus** no backend (concentrados em `simulador/automation/*` e `bancos_login/*` — Selenium, onde é flaky, mas engolem exceção). → `except Exception:` + log.
- **7 `print()`** em `routers/` → trocar por `logging` (o `main.py` já tem `JsonFormatter`).
- **SQL por f-string** em `main.py:184` e `validar_enums.py:69`: **sem risco atual** (valores vêm de lista fixa no código, nunca de input do usuário) — só um *smell*; um mapa fixo de tabelas resolve.

#### 4. ✅ Confirmado OK (sem regressão)

- `py_compile` do backend: **0 erros** em 77 arquivos.
- **24 routers** no disco = **24 registrados** no `main.py` (nenhum órfão).
- Multi-tenant com filtro por `loja_id` presente e extensivo (veiculos 32 / financeiro 36 / leads 19 refs).
- Sem `TODO/FIXME` reais; sem `console.log`/`debugger` no front (mantém #01).

#### 5. ⚠️ Limitação (igual às rodadas anteriores)

Typecheck/build do front **não validável neste sandbox**: o `node_modules` foi instalado no Windows e não resolve no Linux (o `tsc` só acusa "cannot find module 'react'" — ruído de ambiente, ~5k erros falsos que só acompanham o tamanho dos arquivos). Tentei reinstalar as dependências via pnpm em 2º plano, mas não concluiu na janela do run. → rodar `pnpm typecheck` na sua máquina, ou deixar a **CI cobrir isso assim que houver Git**.

#### 6. 🎯 Ordem sugerida (a da #02 + os 2 novos itens de segurança)

1. Destravar admin (`UPDATE membro_loja ...`) **+** corrigir `get_current_b2b_user` → fecha B015/B016.
2. **`webhook_secret` no validador de boot** do `config.py` *(novo P0)*.
3. Adicionar `email-validator>=2.0.0` ao `requirements.txt`.
4. `git init` + 1º commit (Fase 0 do deploy).
5. **Remover backdoor de e-mail → papel `ADMIN_PLATAFORMA`** em `rbac.py`/`auth.py`/`deps.py` *(novo)*.
6. Housekeeping: script `dev` da API; remover `.db` vazio da raiz; `except:`→`except Exception:`+log; `print()`→`logging`.

---

### Execução #02 — 2026-07-01 02:20 BRT (05:20 UTC)

**Escopo:** diagnóstico com **verificação ao vivo** (subi a API e reproduzi comportamentos, não só leitura). Nenhum arquivo de código alterado; editei apenas este `cowork.md`.

#### 1. 🔴 B015/B016 — reproduzidos ao vivo e com causa raiz nova

A #01 sugeriu marcar B015/B016 como corrigidos. **Isso está incorreto** — corrigindo o registro:

| Cenário testado (API subida com o banco real copiado) | Resultado |
|---|---|
| `GET /credenciais_banco` e `/credenciais-ia` com **gestor normal** (`gestor@autopremium.com.br`) | ✅ **200 `[]`** — endpoints e serialização OK |
| Mesmos endpoints com o **admin `victorbelocorreia@gmail.com`** | ❌ **500** `IntegrityError: UNIQUE constraint failed: membro_loja.usuario_id, membro_loja.loja_id` |

Ou seja: **não é o enum** (as tabelas `credencial_banco`/`credencial_ia` estão vazias; o gestor recebe `[]` sem erro). O 500 acontece **antes da query**, em `apps/api/deps.py → get_current_b2b_user`.

**Causa raiz:** o admin tem **um** vínculo em `membro_loja` (loja "Auto Premium") com `ativo = 0`. No ramo do admin, a função (1) busca vínculo `ativo = True` → não acha; (2) cai no `else` e escolhe a primeira loja ativa — que é a mesma "Auto Premium"; (3) faz `INSERT` de um `membro_loja` novo para o par `(usuario_id, loja_id)` que **já existe** → viola o `UNIQUE` → 500. Como quase toda rota B2B depende dessa função, isso derruba, **para o admin**, qualquer tela que a use — Configurações foi só onde apareceu.

**Correção sugerida** (`deps.py`, reaproveitar vínculo inativo em vez de duplicar):

```python
if loja:
    existente = (await db.execute(
        select(MembroLoja).where(
            MembroLoja.usuario_id == current_user.id,
            MembroLoja.loja_id == loja.id,   # sem filtrar por ativo
        )
    )).scalar_one_or_none()
    if existente:
        existente.ativo = True   # reativa em vez de inserir duplicado
        membro = existente
    else:
        membro = MembroLoja(usuario_id=current_user.id, loja_id=loja.id,
                            papel=PapelUsuario.GESTOR, ativo=True)
        db.add(membro)
    await db.commit()
```

**Destravar agora, sem tocar no código (1 comando):**
`UPDATE membro_loja SET ativo = 1 WHERE usuario_id = '76d8b0b9-0674-402a-bc27-ee95a16d2ec6';`
(ideal: aplicar os dois — o UPDATE destrava já; a correção da função impede reincidência.)

#### 2. 🟠 Gaps de release confirmados nesta rodada

- **Sem repositório Git.** Não existe `.git/` na raiz. É a **Fase 0 (BLOQUEADORA)** do `PLANO-DEPLOY-PRODUCAO.md`, ainda pendente — sem isso não há deploy nem rollback. **Maior prioridade de infra.**
- **`email-validator` ausente no `requirements.txt`.** Os schemas de `routers/auth.py` usam `EmailStr` (linhas 38, 51, 70, 86, 106). Na minha subida limpa, a API **só bootou depois** de eu instalar `email-validator`. Deploy do zero falha sem ele. → Adicionar `email-validator>=2.0.0`.
- **Zero testes automatizados** (confirma a #01). Nenhum `*.test.*`/`test_*.py` no repo; `lint` é `echo 'lint ok'`. Falta ao menos smoke test do boot da API e dos fluxos críticos.

#### 3. 🟡 Bugs/limpezas menores (novos, verificados)

- **Script `dev` da API com `cd` duplicado** — `apps/api/package.json`: `"dev": "cd apps/api && uvicorn main:app ..."`. Como o pnpm já roda dentro de `apps/api`, vira `apps/api/apps/api` e falha; `pnpm dev`/`dev:api` **não sobem a API** (o `start.ps1` contorna). → `"dev": "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"`.
- **Fallback `http://localhost:8000` fixo** em `gestor/src/pages/ferramentas/Contratos.tsx:196` (download do PDF) — quebra em produção se `baseUrl` não vier. → usar a `baseUrl` central da `lib/api.ts`.
- **Erros silenciados** (`.catch(() => {})`) em `gestor/lib/api.ts:189`, `vitrine/lib/api.ts:52`, `Feed.tsx:125`, `MeusVeiculos.tsx:49`, `Marketing.tsx:112` — foi o que mascarou o 500 do B016. → ao menos logar.
- **`socialveiculos.db` de 0 byte na raiz** (confirma #01) — o real é `apps/api/socialveiculos.db` (946 KB, 44 tabelas). Remover.

#### 4. ✅ Verificado ao vivo como OK

- **Boot da API:** `import main` sobe limpo (34 rotas), sem imports quebrados (padrão B008 sem regressão) — *desde que* o `email-validator` do item 2 esteja instalado.
- **Sintaxe Python:** 0 erros em 77 arquivos (`py_compile`).
- **Migrações Alembic:** o DAG ramifica e faz merge em `a1c9e7d04f32` → `2175ae5b512d`, que **é o head**; o banco está carimbado no head. (Cheguei a suspeitar de defasagem — verifiquei, está correto.)
- **Endpoints de credencial em si** funcionam (gestor normal → `200 []`); o problema é só o contexto do admin (item 1).

#### 5. ⚠️ Não verificável nesta rodada

- **`pnpm typecheck` do front:** o `node_modules` (symlinks pnpm do Windows) não resolve no sandbox Linux — o `tsc` só acusa "cannot find module 'react'" (ruído de ambiente). **Rodar `pnpm typecheck` na sua máquina.**
- **Simulador Selenium** e **IA** ponta-a-ponta: exigem navegador/credenciais/chaves reais.

#### 6. 🎯 Ordem sugerida (para aprovar / autorizar auto-fix)

1. Destravar o admin (`UPDATE membro_loja ...`) **+** corrigir `get_current_b2b_user` → fecha B015/B016 de verdade.
2. Adicionar `email-validator` ao `requirements.txt`.
3. `git init` + 1º commit (Fase 0 do deploy).
4. Corrigir script `dev` da API; remover o `.db` vazio da raiz; ajustar o fallback de URL do PDF.
5. Smoke tests mínimos (boot da API + login + `200 []` das credenciais) para travar regressão.

> Observação de operação: a API parece estar **rodando ao vivo** (o WAL do banco estava sendo escrito). Por isso mantive a convenção de **não** alterar código automaticamente — mexer na auth com `--reload` ligado, sem você, é arriscado. Se quiser que as próximas rodadas apliquem os fixes seguros (email-validator, script `dev`, limpeza do `.db`), me avise/ajuste a tarefa.

---

### Execução #01 — 2026-07-01 01:14 BRT (04:14 UTC)

**Escopo desta passada:** diagnóstico completo (review-only). Nenhum arquivo de código foi alterado; editei apenas este `cowork.md`, conforme a tarefa pede.

#### 1. O que foi revisado
- Estrutura do monorepo (`apps/{admin,api,gestor,mobile,vitrine,whatsapp-worker}` + `packages/shared`).
- Docs de acompanhamento: `tarefa/00-INDICE.md`, `BUGS.md`, `TAREFAS.md`, `MELHORIAS.md` e o TDD mais recente (`2026-06-30_credenciais-bancarias-paridade-simulador.md`).
- Backend (FastAPI/Python): grafo de imports do `main.py`, router de configurações, catálogo de bancos, schemas e o banco SQLite real.
- Frontend (React/Vite): tela `Configuracoes.tsx` (fluxo de credenciais bancárias e de IA), varredura por código de depuração e stubs.

#### 2. Saúde do código
| Verificação | Resultado |
|---|---|
| Compilação de todo o Python da API (`py_compile`) | ✅ limpo, 0 erros |
| `main.py` importa/inclui 24 routers | ✅ todos os módulos existem (padrão B008 sem regressão) |
| Enum `BancoSimulador` | ✅ corrigido para `BV, C6, ITAU, SANTANDER` (sem `pan`/`creditas`) |
| Módulos novos do Simulador (`bancos_catalogo`, `automation/credential_validator`, `bancos_login/*`) | ✅ presentes e coerentes com os imports dos routers |
| `console.log` / `debugger` no frontend | ✅ 0 ocorrências |
| `TODO/FIXME/HACK/XXX` reais no código | ✅ 0 (os 6 "hits" são o identificador `TODOS_MODULOS`, falso-positivo) |
| Stubs "Em desenvolvimento" / `ModuloEmBreve` | ✅ nenhum restante (Marketing/Contratos/Simulador já portados — B009/B010/B011) |

#### 3. Bugs P1 abertos — status real encontrado
- **B015 e B016 (500 em `/v1/configuracoes/credenciais_banco` e `/credenciais-ia`):** **não reproduzem mais.** Causa provável original era coerção do enum: linhas antigas com `banco IN ('pan','creditas')` quebravam a serialização ao carregar a lista. No banco atual (`apps/api/socialveiculos.db`), a tabela `credencial_banco` está **vazia (0 linhas, 0 pan/creditas)** e a `credencial_ia` também (0 linhas) — os dois endpoints agora retornam lista vazia sem erro.
  - Rotas conferidas: front chama `/configuracoes/credenciais-ia` (com hífen) e o router declara exatamente `prefix="/v1/configuracoes/credenciais-ia"` → **casam, sem 404**.
  - **Ação recomendada (não aplicada):** marcar **B015 e B016 como `[x]` corrigidos** em `tarefa/BUGS.md`, citando: enum corrigido + linhas inválidas removidas na migração da paridade do Simulador. Ideal reconfirmar com um teste vivo (ver limitações).
  - ⚠️ **Corrigido na Execução #02:** este diagnóstico estava incompleto (feito sem subir a API). Ao subir a API ao vivo, B015/B016 **reproduzem** para a conta admin. Ver #02, item 1. **Não feche esses bugs.**

#### 4. Gaps / melhorias em aberto (as 3 do `MELHORIAS.md`)
- **M017 — Pré-aprovação de crédito na vitrine (consumer-facing):** o motor de simulação já existe no gestor; falta o fluxo B2C na vitrine. **Bloqueado por dependência externa** (parceria formal com financiadoras) — não dá para fechar sozinho.
- **M028 — Documentar a camada de IA na Stack:** P3, só documentação, e num arquivo de memória **fora deste repositório** (`f:/Projetos/_Memoria/...`).
- **M019 — Consulta de placa:** marcado como **descartado** (KePlaca já integrado). Efetivamente resolvido — sugiro fechar o checkbox para não poluir o backlog.

Pendências técnicas herdadas do TDD do Simulador (do doc de 2026-06-30, continuam válidas): infra de **Chrome headless em produção (Dockerfile Fly.io) ainda não existe**; mapeamentos de banco são frágeis e exigem manutenção contínua; e a ideia do **rodízio de 1 navegador Selenium por loja** foi aprovada mas ainda não implementada.

#### 5. Riscos de qualidade (o que impede "100% redondo")
1. **Sem testes automatizados** — 0 arquivos `*.test.ts` / `test_*.py` no monorepo inteiro. Toda validação hoje é manual (`checklist-testes.md`). Maior risco para regressões.
2. **Lint não é real** — `apps/*/package.json` têm `"lint": "echo 'lint ok'"`; a API tem typecheck/lint como `echo 'python — skip'`. Não há ESLint/ruff de verdade rodando.
3. **Storage S3 não configurado** — chaves S3 estão só comentadas no `.env.example` e ausentes no `.env`; upload de mídia deve estar caindo em armazenamento local (ok em dev, gap para produção).
4. **Higiene menor** — existe um `socialveiculos.db` de **0 byte na raiz** do repo (duplicado vazio; o banco real é `apps/api/socialveiculos.db`). Candidato a remoção/gitignore.

#### 6. Para deixar 100% (priorizado, para sua aprovação)
1. **Fechar B015/B016 no BUGS.md** e rodar um smoke test vivo dos dois endpoints (subir a API e conferir `200 []`).
2. **Introduzir um mínimo de testes** — ao menos um smoke de boot da API (`import main; assert app.routes`) + 2–3 testes dos endpoints de credenciais (salvar mascarado não sobrescreve senha; GET vazio retorna `[]`).
3. **Lint real** — trocar os `echo` por ESLint (front) e ruff (API), mesmo que só em modo report no começo.
4. **Infra de produção do Simulador** — Dockerfile com Chrome/chromedriver + decidir tamanho da VM; implementar o rodízio de 1 navegador por loja.
5. **Configurar S3** (ou confirmar que produção usa storage local de propósito).
6. **Housekeeping** — remover o `socialveiculos.db` vazio da raiz; fechar M019 no backlog.

#### 7. Limitações desta execução (transparência)
Não consegui subir a API nem rodar o typecheck do front **neste ambiente** de diagnóstico: `pnpm` não está disponível e o `fastapi` não está instalado aqui. Então as verificações acima são **estáticas** (compilação Python, leitura de banco, análise de imports/rotas), não um boot ao vivo. Os artefatos de build mais recentes (`dist/`, `tsconfig.tsbuildinfo`) são de **2026-07-01**, o que indica que o projeto vinha compilando normalmente. Recomendo o smoke test vivo (itens 1 e 2 acima) para confirmar o fechamento dos bugs.

---
<!-- Próximas execuções da tarefa "validao" acrescentam a entrada #03, #04... acima da #02, mantendo o histórico. -->
