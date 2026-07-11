# TAREFAS — Registro Geral e Status

> Arquivo unificado contendo todo o escopo, tarefas e critérios de aceitação (DoD) dos módulos da plataforma SocialVeiculos.
>
> **Regra de documentação:** toda documentação do projeto vive SOMENTE em `documentos/tarefa/` (specs detalhados em `documentos/tarefa/specs/`). Não criar `docs/`, `docs/superpowers/` ou qualquer outra pasta de documentação — se aparecer, mover o conteúdo para cá e excluir.

---

## 01 — Setup do monorepo e infra base

> Fundação. Destrava todo o resto. Nada de feature aqui — só esqueleto e ferramentas.

### Tarefas
- [x] **1.1 Monorepo pnpm** — criar workspace com `apps/api`, `apps/gestor`, `apps/vitrine`, `packages/db`, `packages/shared`, `packages/ui`. Configurar `pnpm-workspace.yaml`, `tsconfig` base compartilhado, paths.
- [x] **1.2 Lint/format/test** — ESLint + Prettier + Vitest na raiz, com scripts `lint`, `build`, `test`, `typecheck` que rodam em todos os pacotes.
- [x] **1.3 `apps/api` (FastAPI)** — bootstrap FastAPI com roteamento `/v1`, middleware de erro padronizado (JSON `{ error, code }`), health check `/v1/health`, CORS, validação com Pydantic.
- [x] **1.4 `apps/gestor` (Vite SPA)** — Vite + React + React Router, layout shell (sidebar densa), tema claro/escuro via CSS vars, cliente HTTP tipado apontando para a API.
- [x] **1.5 `apps/vitrine` (Vite SSR/SSG)** — Vite + React com renderização no servidor para SEO; rota raiz = feed. Separado do Gestor para multi-domínio.
- [x] **1.6 `packages/shared`** — tipos de domínio (enums de status de veículo, papéis, DTOs) e schemas Zod reutilizados por API e fronts.
- [x] **1.7 Variáveis de ambiente** — `.env.example` por app; carregamento tipado e validado (falha no boot se faltar var obrigatória).
- [x] **1.8 Docker Compose dev** — (SQLite local usado via de regra) Postgres + Redis + MinIO (S3 local) subindo com um comando para ambiente local reproduzível.

### DoD (Definition of Done)
- `pnpm install && pnpm build && pnpm typecheck` passa limpo na raiz.
- `docker compose up` sobe Postgres/Redis/MinIO; API responde em `/v1/health`.
- Gestor e Vitrine abrem com tema claro/escuro funcionando.

---

## 02 — Modelo de dados e migrações

> Schema do banco. Toda entidade do social.md §7 modelada com `loja_id` onde aplicável. Depende de [01].

### Tarefas
- [x] **2.1 ORM e migrações** — configurar SQLAlchemy em `apps/api` (com SQLite em dev) e migrações versionadas com Alembic e seed scripts.
- [x] **2.2 Tenancy e usuários** — `loja` (tenant), `usuario`, `papel` (gestor/vendedor/cliente/admin_plataforma), `membro_loja` (vínculo usuario↔loja↔papel), `sessao`.
- [x] **2.3 Catálogo canônico** — `catalogo_marca`, `catalogo_modelo` (FIPE-style) populados via seed a partir da fonte do SimuladorFacil. Veículo referencia o catálogo.
- [x] **2.4 Estoque** — `veiculo` (placa, marca, modelo, ano, km, cor, câmbio, combustível, tipo, preço_venda, preço_custo*, status enum `disponivel|reservado|vendido|repasse|inativo`, publicado_marketplace bool). *campos sensíveis nunca expostos ao B2C.
- [x] **2.5 Mídia** — `midia` (tipo `foto|video`, url, ordem, veiculo_id). Tabela única, unificada.
- [x] **2.6 Clientes e CRM** — `cliente_pf`, `lead` (origem `vitrine|manual`, etapa enum `lead|proposta|negociacao|fechamento|perdido`), `negociacao` (cliente + veículo + proposta).
- [x] **2.7 Vitrine social** — `favorito` (cliente↔veiculo, com contador derivável), `publicacao_b2b`, `comentario`, `curtida`.
- [x] **2.8 Chat** — `conversa` (B2C cliente↔loja e B2B loja↔loja), `mensagem`. Conversa B2C referencia o veículo de contexto.
- [x] **2.9 Financeiro** — `lancamento_financeiro` (receita/despesa/comissão), `comissao`.
- [x] **2.10 Assinaturas** — `plano`, `assinatura`, `pagamento`, `modulo_habilitado` (por loja).
- [x] **2.11 Auditoria** — `log_auditoria` (ator, ação, entidade, loja_id, ip, timestamp). Append-only.
- [x] **2.12 Índices** — índices em `loja_id`, FKs, `placa`, `publicado_marketplace`, e FTS para busca de veículos.

### DoD
- Migrações sobem do zero e revertem sem erro.
- Seed popula catálogo FIPE + 1 loja demo + veículos de teste.
- Diagrama ER gerado e versionado em `packages/db/ERD.md`.

---

## 03 — Autenticação, sessões e MFA

> Depende de [02]. Backend-first: a API é a fonte de verdade; web e futuro app usam o mesmo fluxo.

### Tarefas
- [x] **3.1 Registro e login B2B** — endpoints `/v1/auth/register`, `/v1/auth/login` para gestor/vendedor. Hash de senha (argon2/bcrypt). Validação Pydantic.
- [x] **3.2 Sessão por token** — sessões via JWT de acesso curto + refresh token rotativo persistido em `sessao` (revogável). Cookie httpOnly no web, bearer no app.
- [x] **3.3 Conta leve do cliente (B2C)** — cadastro simples (nome + e-mail/telefone) e login social (Google) opcional. Conta de cliente nunca acessa o Gestor.
- [x] **3.4 Recuperação de conta** — fluxo de "esqueci a senha" com token de uso único por e-mail, expiração corta.
- [x] **3.5 Middleware de auth** — guard na API que injeta `usuario`, `loja_id` e `papel` no contexto; rejeita sem sessão válida.
- [x] **3.6 MFA (estrutura, ativável depois)** — modelar segredo TOTP em `usuario` e endpoints de enroll/verify desligados por flag, para ligar na Fase 2 sem refactor.
- [x] **3.7 Modal de login na Vitrine** — gate de login como **modal** (não página), disparado ao tentar interagir ou após rolar bastante o feed.

### DoD
- Login/refresh/logout funcionam e a sessão é revogável.
- Recuperação de senha testada ponta a ponta.
- Cliente B2C não consegue acessar nenhuma rota do Gestor (teste negativo).

---

## 04 — Multitenancy, RBAC e isolamento

> Depende de [03]. A "regra de ouro": uma loja nunca enxerga dados de outra, e o B2C nunca vê dado interno da loja.

### Tarefas
- [x] **4.1 Escopo por tenant** — toda query do Gestor filtra por `loja_id` do contexto. Centralizar num repositório/middleware para não esquecer em endpoint algum.
- [x] **4.2 Isolamento Lógico (Aplicação)** — políticas de filtro por `loja_id` aplicadas via dependências (Deps) no FastAPI, garantindo isolamento sem depender de RLS de banco no SQLite.
- [x] **4.3 Matriz de permissões (RBAC)** — implementar a matriz do social.md §8: `admin_plataforma`, `gestor`, `vendedor`, `cliente` × ações (criar/editar/excluir/ver/aprovar/publicar/administrar). Helper `can(usuario, acao, recurso)`.
- [x] **4.4 Ações que exigem aprovação do gestor** — vendedor tem subset; ações restritas (ex: excluir veículo, alterar preço) entram em fila de aprovação do gestor.
- [x] **4.5 Admin da plataforma** — escopo acima das lojas: listar lojas, métricas globais, auditoria. Rotas `/v1/admin/*` protegidas só para esse papel.
- [x] **4.6 Filtro de saída B2C** — serializers da Vitrine removem campos sensíveis (preço_custo, repasse, margem, funil). Teste automatizado que falha se um campo proibido vazar no payload público.

### DoD
- Teste de isolamento: usuário da loja A não lê nenhum dado da loja B (app + RLS).
- Teste de vazamento: payload público da Vitrine não contém nenhum campo da blacklist.
- Matriz de permissões coberta por testes por papel.

---

## 05 — Estoque de veículos (Gestor)

> social.md §4.1. Depende de [02], [04], [13].

### Tarefas
- [x] **5.1 CRUD de veículos (API)** — `/v1/veiculos` GET/POST/PATCH/DELETE, escopados por loja, validados por Pydantic no FastAPI.
- [x] **5.2 Status do veículo** — troca rápida de status (`disponivel|reservado|vendido|repasse|inativo`); registra no histórico/auditoria.
- [x] **5.3 Filtros e busca** — filtros por status, preço, km, ano; busca por placa, marca, modelo.
- [x] **5.4 Catálogo canônico (autocomplete)** — endpoint de marcas/modelos do catálogo FIPE-style; UI usa autocomplete em vez de texto livre.
- [x] **5.5 Busca por placa (plugável)** — integração de consulta de placa que preenche marca/modelo/ano. Provider configurável; sem provider, campo fica manual.
- [x] **5.6 Interruptor "Publicar na Vitrine"** — toggle `publicado_marketplace` por veículo; só publicados vão ao feed B2C. Emite evento `veiculo_publicado`.
- [x] **5.7 UI de estoque (Gestor)** — lista densa com filtros, formulário de criação/edição com mídia unificada, placeholder estilizado quando sem foto.

### DoD
- CRUD completo testado com escopo de loja.
- Publicar/despublicar reflete no feed B2C em tempo hábil.
- Veículo sem foto mostra placeholder estilizado, nunca texto cru.

---

## 06 — Clientes, leads e CRM Kanban (Gestor)

> social.md §4.2 e §4.3. Depende de [05].

### Tarefas
- [x] **6.1 CRUD de clientes** — `/v1/clientes` (nome, CPF, telefone…), filtros por nome/CPF/telefone, escopo de loja.
- [x] **6.2 Vínculos** — cliente/lead se associam a veículos e negociações.
- [x] **6.3 Funil Kanban (API)** — `lead` com etapa `lead|proposta|negociacao|fechamento|perdido`; endpoint para mover de etapa.
- [x] **6.4 Quadro Kanban (UI)** — colunas arrastáveis (drag-and-drop), card de lead, modal de detalhes da negociação.
- [x] **6.5 Propostas** — criar proposta vinculando cliente + veículo; modal de detalhes.
- [x] **6.6 Lead automático da Vitrine** — toda conversa iniciada por cliente no chat B2C cria um lead na etapa `lead` automaticamente (consome evento `chat_iniciado`).

### DoD
- Arrastar card entre colunas persiste e audita a mudança.
- Conversa nova na Vitrine aparece como lead no Kanban da loja correta.

---

## 07 — Rede social B2B (repasses + chat entre lojas)

> social.md §4.4. Separado do feed B2C. Depende de [05].

### Tarefas
- [x] **7.1 Feed de repasses** — `publicacao_b2b`: loja publica veículo para repasse; listar/criar post. Curtir e comentar.
- [x] **7.2 Proposta de repasse** — proposta direta entre lojas vinculada a um veículo.
- [x] **7.3 Chat B2B em tempo real** — `conversa`/`mensagem` entre lojistas via WebSocket.
- [x] **7.4 Diretório de parceiros** — buscar e conectar com outras lojas, com filtros (região, tipo).
- [x] **7.5 Separação B2B/B2C** — garantir que o feed B2B nunca se mistura com o feed público. Endpoints e UI distintos.

### DoD
- Post de repasse aparece só para lojas, nunca no B2C.
- Chat entre duas lojas entrega mensagem em tempo real.

---

## 08 — Dashboard, métricas e financeiro (Gestor)

> social.md §4.5. Depende de [05], [06]. Sem dados falsos: KPIs reais ou estado vazio.

### Tarefas
- [x] **8.1 Dashboard da loja** — KPIs reais: estoque ativo, leads ativos, receita/vendas do mês, simulações. Alertas e ações rápidas.
- [x] **8.2 Métricas** — gráficos: vendas, estoque, ranking de veículos, resumo financeiro.
- [x] **8.3 Financeiro** — receitas, despesas, saldo, comissões, custo de estoque.
- [x] **8.4 Equipe** — gestão de membros e permissões da loja (consome RBAC de [04]).
- [x] **8.5 Perfil/Configurações** — dados da loja e do usuário, tema, integrações.

### DoD
- KPIs calculados de dados reais; loja sem dados mostra estado vazio limpo.
- Financeiro fecha (receitas − despesas = saldo) em teste.

---

## 09 — Assinaturas, planos e módulos premium (SSO)

> social.md §4.6. Depende de [03], [04].

### Tarefas
- [x] **9.1 Planos e assinaturas** — `plano`, `assinatura`, `pagamento`; estado da assinatura por loja (ativa/inadimplente/cancelada).
- [x] **9.2 Habilitação de módulos** — `modulo_habilitado` por loja; gate central `modulo_ativo(loja, modulo)` que protege rotas/UI premium.
- [x] **9.3 Paywall** — gate devolve **402** + `X-Paywall-Modulo`, e UI exibe o fluxo correspondente para upgrade.
- [x] **9.4 SSO entre módulos** — token de troca curto (60s, `typ=sso`) em `auth.py`; validação antes do redirecionamento.
- [x] **9.5 Módulo Contratos** — app separado. Habilitação/SSO integrados.
- [x] **9.6 Módulo Simulador** — app separado. Habilitação/SSO integrados.
- [x] **9.7 Módulo Marketing** — app separado. Habilitação/SSO integrados.
- [x] **9.8 Integração de pagamento** — webhook de pagamento idempotente.

### DoD
- Loja sem módulo vê paywall; com módulo, acessa via SSO sem novo login.
- Webhook de pagamento altera estado da assinatura de forma idempotente.

---

## 10 — Feed público e gate de login (Vitrine B2C)

> social.md §5.1, §5.2, §5.4. O coração do produto. Depende de [05], [11].

### Tarefas
- [x] **10.1 Feed público (API)** — `/v1/marketplace/feed` paginado (cursor), só veículos `publicado_marketplace = true`.
- [x] **10.2 Feed infinito deslogado** — visitante deslogado vê o feed completo, sem filtros, sem busca, sem chips. Scroll infinito.
- [x] **10.3 Filtros pós-login** — após logar, aparecem busca e chips (categoria/marca, faixa de preço).
- [x] **10.4 Stories / atalhos de descoberta** — no topo: "Ofertas" (mais baratos), "Novidades" (mais recentes), "Destaques".
- [x] **10.5 Gate de login (modal)** — login como modal disparado ao tentar interagir ou após rolar bastante.
- [x] **10.6 Navegação mobile-first** — barra inferior: Explorar / Favoritos / Mensagens / Perfil.

### DoD
- Deslogado rola o feed inteiro sem ver busca/chips e sem barreira.
- Tentar favoritar/conversar abre o modal de login.
- Logado vê filtros e stories funcionando.

---

## 11 — Card, página do carro e página da loja (SEO)

> social.md §5.3, §5.5. SEO-first. Renderização no servidor (SSG/Prerender) em `apps/vitrine`.

### Tarefas
- [x] **11.1 Card do carro (rico)** — cabeçalho social, galeria de mídias, título + preço, ficha rápida e ações rápidas (favoritar, chat, WhatsApp).
- [x] **11.2 Página do carro (SSR/Prerender)** — galeria completa, ficha técnica, descrição, similares, canal de proposta. URL amigável.
- [x] **11.3 SEO da página do carro** — meta tags, Open Graph, JSON-LD (`Vehicle`), sitemap dinâmico.
- [x] **11.4 Página da loja (vitrine da loja)** — lista de carros à venda da loja com identidade e selo "verificada".
- [x] **11.5 SEO da página da loja** — meta tags + JSON-LD `AutoDealer`, entra no sitemap.
- [x] **11.6 Placeholders e estado vazio** — layouts limpos para mídias ou estoques inexistentes.

### DoD
- Página do carro renderiza no servidor com meta/JSON-LD válidos.
- Sitemap lista todos os carros publicados e atualiza dinamicamente.

---

## 12 — Chat interno, favoritos e ponte WhatsApp (Vitrine B2C)

> social.md §5.3, §5.6. Depende de [03], [06].

### Tarefas
- [x] **12.1 Infra realtime** — WebSocket no backend + Redis pub/sub para entrega em tempo real.
- [x] **12.2 Chat interno B2C** — conversa contextualizada a partir do veículo com mensagens instantâneas.
- [x] **12.3 Lead automático** — abrir conversa emite evento e gera um lead no CRM da loja automaticamente.
- [x] **12.4 Favoritos** — favoritar/desfavoritar com login, exibindo contador real na Vitrine.
- [x] **12.5 Ponte WhatsApp** — atalho wa.me contextualizado com o veículo para continuar atendimento.

### DoD
- Mensagem entregue em tempo real entre cliente e loja.
- Primeira mensagem do cliente cria exatamente um lead na loja certa.
- Contador de favoritos reflete o número real.

---

## 13 — Mídia (upload unificado foto/vídeo)

> Transversal. social.md §6. Usado por Estoque, B2B, Vitrine.

### Tarefas
- [x] **13.1 Upload para storage** — endpoint de upload híbrido (S3/local fallback) recebendo arquivo `image/*,video/*` num único campo.
- [x] **13.2 Validação e limites** — validação de tipos, tamanhos e limites máximos.
- [x] **13.3 Processamento** — geração de thumbnails/posters de forma assíncrona.
- [x] **13.4 Ordenação e capa** — alteração da ordem manual e definição de capa do anúncio.
- [x] **13.5 Componente de upload (UI)** — campo arrastar-e-soltar com preview e progresso no Gestor.
- [x] **13.6 Entrega** — URLs servidas de maneira otimizada com fallback de placeholders.

### DoD
- Upload de foto e vídeo pelo mesmo campo funciona e gera thumbnail/poster.
- Reordenar e definir capa persiste e reflete na Vitrine.

---

## 14 — Segurança, LGPD, auditoria e rate limiting

> Transversal. social.md §Segurança e §10.

### Tarefas
- [x] **14.1 Proteções OWASP** — validação de entrada estrita, proteção contra XSS/CSRF, headers de segurança (CSP, HSTS).
- [x] **14.2 Rate limiting** — limites de requisições baseados em IP em rotas críticas (auth, cadastro, chat).
- [x] **14.3 Criptografia** — tráfego HTTPS/TLS, criptografia em repouso e hashes robustos para senhas.
- [x] **14.4 Auditoria** — log de auditoria append-only guardando ações críticas do sistema.
- [x] **14.5 LGPD** — exportação, exclusão de dados e termos de consentimento ativos.
- [x] **14.6 Antifraude / antiabuso** — detecção de spam e abusos no chat e favoritos.
- [x] **14.7 Logs estruturados** — logs padronizados em formato JSON sem vazamento de PII.

### DoD
- Endpoints sensíveis com rate limit testado.
- Titular consegue exportar e excluir seus dados (fluxo LGPD).
- Toda ação crítica gera registro de auditoria imutável.

---

## 15 — DevOps, CI/CD e observabilidade

> Transversal. social.md §11.

### Tarefas
- [x] **15.1 Ambientes** — separação e isolamento total das configurações de dev, staging e prod.
- [x] **15.2 CI** — esteira automatizada no GitHub Actions rodando build, lints e testes em cada PR.
- [x] **15.3 CD** — deploys automatizados e execução de migrações nos ambientes corretos.
- [x] **15.4 Observabilidade** — medições de latência, erros e throughput da API (Sentry/OpenTelemetry).
- [x] **15.5 Monitoramento e alertas** — alertas em tempo real sobre falhas do sistema.
- [x] **15.6 Logs centralizados** — agregação e facilitação de busca de logs de aplicação.
- [x] **15.7 Backup e restore** — rotinas robustas de backup do banco SQLite/Postgres.
- [x] **15.8 Escalabilidade** — design stateless preparado para escalonamento horizontal.

### DoD
- PR não mergeia com CI vermelho.
- Deploy em staging é automático; prod é controlado.
- Restore de backup testado e documentado.

---

## 16 — Tema claro: varrer `rgba(255,255,255,…)` hardcoded fora da /estoque

> UX/UI. Redesign de tema claro do Gestor com paridade total. Concluído em 2026-06-25.

### Tarefas
- [x] **16.1 Migração de cores hardcoded** — substituição das ocorrências de branco translúcido fixo por tokens semânticos adaptativos (`--sv-overlay-soft`, `--sv-overlay`, etc.) e uso de `color-mix`.

### DoD
- Alternar o toggle de tema em todas as rotas renderiza corretamente sem elementos sumirem no claro.
- Build estático do Vite sem erros de lint ou CSS.

---

## 17 — Módulo Simulador de Crédito (motor V2 + fallback browser)

> Módulo Premium. Depende de [03], [04], [09]. Reaproveita o orquestrador e os motores de bancos do SimuladorFacil. Concluído em 2026-06-27.

### Tarefas
- [x] **17.1 Portar contratos e orquestrador** — estruturar `OrquestradorV2` no backend.
- [x] **17.2 Portar motores V2 (BV, PAN, Creditas)** — integração paralela via HTTP e armazenamento cifrado de credenciais de bancos por tenant.
- [x] **17.3 Modelo de dados** — tabelas `simulacao` e `simulacao_resultado` ligadas ao CRM e Veículos.
- [x] **17.4 Router simulador** — endpoints `/v1/simulador` e histórico protegidos por paywall/modulo.
- [x] **17.5 Credenciais de banco (Gestor)** — interface e backend para gerenciamento de chaves e acessos às financeiras.
- [x] **17.6 Fallback browser (CDP)** — integração via extensão/CDP para bancos que exigem fluxo via browser.
- [x] **17.7 Worker persistente** — infraestrutura dedicada para rodar o crawler fora de ambientes serverless.
- [x] **17.8 UI do Gestor** — recriação completa da tela de simulação em 3 blocos (Bancos, Pessoa, Veículo) com impressão em PDF e preenchimento automático.
- [x] **17.9 Lead/anexo** — resultados persistidos diretamente junto ao lead no CRM.

### DoD
- Loja com módulo ativo executa simulações reais em paralelo e vê resultados detalhados por banco.
- Paywall 402 é acionado caso o módulo esteja inativo.
- Senhas e credenciais de bancos armazenadas de forma segura.

---

## 18 — Módulo Assistente de IA do Vendedor (WhatsApp)

> Módulo Premium. Depende de [03], [04], [06], [09], [13]. Motor de IA (Claude) integrado a worker WhatsApp (Baileys) para suporte em conversas. Concluído em 2026-06-26.

### Tarefas
- [x] **18.1 Registrar módulo** — habilitar paywall/configurações do módulo `assistente_ia`.
- [x] **18.2 Permissão por vendedor (gestor)** — gerenciar acesso individual dos membros de equipe da loja ao assistente.
- [x] **18.3 Worker WhatsApp (Baileys)** — worker Node persistente rodando sessões Baileys e expondo QR codes de conexão.
- [x] **18.4 Conexão/QR (UI + API)** — tela de pareamento via QR code no gestor com leitura de status.
- [x] **18.5 Chat estilo WhatsApp** — interface de atendimento integrada às mensagens recebidas via worker.
- [x] **18.6 Motor de resposta IA** — orquestração de resposta com contexto CRM + simulação usando Claude (modelo `claude-opus-4-8`).
- [x] **18.7 Configuração do vendedor (botão)** — upload de áudio, transcrição para estilo de escrita, síntese de voz (TTS) e definição de tom.
- [x] **18.8 Consentimento & LGPD** — aceite explícito para clonagem de voz e logs auditáveis dos envios da IA.
- [x] **18.9 Lead automático** — novos contatos no WhatsApp criam novos leads no funil do CRM.
- [x] **18.10 Guard rails** — controles anti-ban, limitação de taxa e fallback imediato para atendimento humano.

### DoD
- QR Code funcional conectando o WhatsApp pessoal/comercial do vendedor.
- Alternância entre copiloto e modo 100% automático respeitada por conversa.
- Termos de consentimento LGPD aceitos antes do uso de áudios.

---

## 19 — Vitrine: trocar tokens `--sv-*` órfãos por `--vt-*`

> Dívida técnica. Separação visual do design system do Gestor (`--sv-*`) e da Vitrine (`--vt-*`). Concluído em 2026-06-26.

### Tarefas
- [x] **19.1 Substituição de variáveis no front** — varredura de arquivos `CarCard.tsx`, `Mensagens.tsx`, `Favoritos.tsx` e `Feed.tsx` para substituir `--sv-text-dim` e `--sv-text-primary` pelas equivalentes `--vt-text-dim` e `--vt-text`.

### DoD
- Build estático da Vitrine roda limpo e nenhuma cor padrão herda valores incorretos no tema light.

---

## 20 — Ferramentas: submenu + páginas dedicadas (sem modal/mock)

> UX/UI & Navegação. Módulos premium integrados como páginas filhas da Sidebar. Concluído em 2026-06-27.

### Tarefas
- [x] **20.1 Submenu expansível no Sidebar** — Sidebar unificada com menu agrupado expansível para "Ferramentas" contendo links diretos para cada módulo premium.
- [x] **20.2 Remoção de mocks e dados fakes** — substituição de stubs e overlays por páginas de redirecionamento ou páginas de status honesto (Contratos/Marketing em Roadmap, Simulador e Assistente IA ativos).
- [x] **20.3 Rotas e páginas dedicadas** — configuração no `App.tsx` para as rotas `/ferramentas/simulador`, `/ferramentas/contratos`, `/ferramentas/marketing` e suas respectivas telas de destino.

### DoD
- Sidebar expande/colapsa e auto-abre ao acessar rotas filhas.
- Build do TypeScript e build de produção executam com sucesso.
- Telas abrem individualmente sem sobreposição de modais/mocks.

---

## 21 — Humanizar mensagens de erro (Vitrine + Gestor)

> UX. Erros técnicos da API (`HTTP 401`, `HTTP 500`) estão sendo exibidos diretamente ao usuário. Substituir por mensagens em português humanizadas.

### Contexto

O `api.ts` de ambos os apps lança `HTTP ${response.status}` quando a API não retorna `error.error`. O `LoginModal` da Vitrine propaga esse `err.message` cru direto na tela. Capturado em produção: modal de login exibindo **"HTTP 401"** para o usuário.

### Tarefas
- [x] **21.1 Mapa de erros em `api.ts` (ambos os apps)** — `friendlyHttpMessage` já existia; corrigido o único path restante (retry após refresh) que ainda usava `throw new Error(\`HTTP ${retryRes.status}\`)` → agora usa `throw new ApiError(friendlyHttpMessage(...))`. _(2026-06-28)_
- [x] **21.2 Ajustar `LoginModal.tsx` (Vitrine)** — já usa `err.message || 'E-mail ou senha incorretos.'`; com 21.1 aplicado, `err.message` já vem humanizado da camada `api.ts`. _(2026-06-28)_

### DoD
- Modal de login exibe "E-mail ou senha incorretos." em vez de "HTTP 401".
- Qualquer erro de rede/timeout exibe "Algo deu errado. Tente novamente."
- Nenhum toast ou modal exibe "HTTP XXX" para o usuário final.
- Build limpo em ambos os apps após as alterações.

---

## 22 — Rota /admin redireciona silenciosamente para Dashboard (Gestor)

> Correção de Bug / Navegação. Concluído em 2026-06-29.

### Tarefas
- [x] **22.1 Rota e feedback no Guard** — Adicionado alias alternativo para a rota `/admin` no `App.tsx` e atualizado o `AdminGuard` para disparar um toast explicativo ("Acesso restrito a administradores") via Zustand store no redirecionamento.

### DoD
- Ao acessar `/admin` como gestor comum, é redirecionado para `/` com toast informativo.
- Administradores acessam o painel de administração normalmente.

---

## 23 — URL /dashboard redireciona para / em vez de manter a rota (Gestor)

> Correção de Bug / Roteamento. Concluído em 2026-06-29.

### Tarefas
- [x] **23.1 Suporte a rota alias /dashboard** — Adicionado a rota `/dashboard` mapeando diretamente para o componente `<Dashboard />` para que deep links e o botão de voltar funcionem sem alterar a URL para `/`.

### DoD
- Acessar `/dashboard` mantém a URL no navegador e exibe a tela de Dashboard corretamente.

---

## 24 — Feed da vitrine e estoque sem fotos nos cards (Vitrine + Gestor)

> Correção de Bug / Dados & Seeds. Concluído em 2026-06-29.

### Tarefas
- [x] **24.1 Adicionar mídias nos seeds** — Atualizado o script `seed.py` para gerar registros de `Midia` (fotos via Unsplash) para todos os veículos de demonstração padrão.
- [x] **24.2 Tratamento de erro de fotos quebradas (Vitrine)** — Adicionado estado `imageError` e fallback dinâmico para renderizar placeholder cinza neutro e informativo se a imagem falhar ao carregar no `CarCard.tsx`.

### DoD
- Feed da vitrine e listagem do estoque exibem fotos reais no onboarding.
- Fotos quebradas (404) ou inexistentes exibem o placeholder cinza suave com "Sem foto disponível".

---

## 25 — Payload divergente em cadastro B2B (API)

> Correção de Bug / API. Concluído em 2026-06-29.

### Tarefas
- [x] **25.1 Suporte a aliases no schema RegisterB2BRequest** — Adicionado validador dinâmico com fallback em `RegisterB2BRequest` para aceitar indistintamente `loja_nome` ou `nome_loja`, e gerar um `nome` padrão para o gestor se omitido.

### DoD
- O endpoint `/register-b2b` completa cadastros com sucesso sem erros 422 ao receber payloads com nomenclaturas alternativas de testes.

---

## 26 — Envio de veículos campos inconsistentes e publicar 405 (API + Gestor)

> Correção de Bug / API & Estoque. Concluído em 2026-06-29.

### Tarefas
- [x] **26.1 Fallback de ano e enums na API** — Adicionado `@model_validator` no `VeiculoCreateRequest` e `VeiculoUpdateRequest` mapeando a propriedade `ano` para `ano_fabricacao` e `ano_modelo`, e transformando `cambio` e `combustivel` para caixa baixa.
- [x] **26.2 Suporte a POST no toggle publicar** — Adicionado decorator `@router.post` na rota `/veiculos/{id}/publicar` como alias à requisição PATCH original da UI.

### DoD
- Cadastro de veículo através da API aceita propriedades simplificadas de testes e enums em maiúsculas.
- Rota de publicação suporta métodos POST e PATCH sem 405.

---

## 27 — Erro 404 ao processar aprovação de veículo deletado (API)

> Correção de Bug / Aprovações. Concluído em 2026-06-29.

### Tarefas
- [x] **27.1 Validação de aprovação orfã** — Atualizada a rota `POST /aprovacoes/{id}/processar` em `aprovacoes.py` para levantar `400 Bad Request` com explicação inteligível em vez de `404 Not Found` caso o veículo alvo da aprovação tenha sido removido.

### DoD
- Rejeitar ou processar aprovações associadas a entidades excluídas não retorna erro 404 de rota/recurso.

---

## 28 — Erro MissingGreenlet 500 no simulador de crédito (API)

> Correção de Bug / Simulador. Concluído em 2026-06-29.

### Tarefas
- [x] **28.1 Prevenir lazy loading no commit do simulador** — Ajustado o retorno do endpoint de simulação em `simulador_router.py` para reler o registro com `selectinload(Simulacao.resultados)` pós-commit, eliminando o erro de inicialização assíncrona do Pydantic.

### DoD
- `POST /v1/simulador` retorna resultados sem 500.

---

## 29 — Erro 400 no parser de UTF-8 (API)

> Correção de Bug / Encoding. Concluído em 2026-06-29.

### Tarefas
- [x] **29.1 Middleware de fallback de encoding** — Desenvolvido o `SafeBodyDecodeMiddleware` em `main.py` para interceptar requests JSON e tentar decodificar a carga em UTF-8. Caso falhe (caracteres acentuados enviados como raw bytes/Latin-1), faz fallback seguro para `latin-1` e re-codifica para UTF-8.

### DoD
- Endpoints de clientes e lançamentos aceitam acentos (ex: "João", "Mecânica") sem erros 400 de parser do uvicorn.

---

## 30 — Credenciais do administrador incorretas e verificação de conta vitrine (Auth / Seed)

> Ajuste / Onboarding. Concluído em 2026-06-29.

### Tarefas
- [x] **30.1 Atualizar credenciais de testes** — Documentado em `.env.example` e na memória do projeto as senhas corretas (`admin123` para admin da plataforma, `demo123` para o cliente vitrine `vitrine@demo.com`).

### DoD
- Todas as contas do seed de testes estão acessíveis.

---

## 31 — TypeError no console ao abrir configurações (Gestor)

> Correção de Bug / Configurações. Concluído em 2026-06-29.

### Tarefas
- [x] **31.1 Tratar falhas em requisições paralelas** — Envolvido todas as requisições paralelas de carregamento de `/configuracoes` com blocos `.catch()`, prevenindo que a ausência de endpoints como `/redes-sociais` aborte o fluxo e lance erros de fetch não capturados no console.

### DoD
- Página de configurações carrega sem erros de stack trace no console.

---

## 32 — Chevrolet Tracker duplicada 5x no feed vitrine (Marketplace)

> Correção de Bug / Marketplace. Concluído em 2026-06-29.

### Tarefas
- [x] **32.1 Deduplicação no feed B2C** — Adicionado filtro em memória no endpoint `/marketplace/feed` para garantir que veículos com marca, modelo, versão e preço idênticos sejam agregados e apenas o exemplar mais recente conste na resposta.
- [x] **32.2 Limpeza de dados** — Criado script utilitário para limpar registros duplicados residuais resultantes de execuções de testes acumuladas no SQLite.

### DoD
- Feed exibe variedade de marcas/modelos em vez de repetições sequenciais.

---

## 33 — Sidebar perde o item "Dashboards" ao navegar (Gestor)

> Correção de Bug / Sidebar. Concluído em 2026-06-29.

### Tarefas
- [x] **33.1 Forçar visibilidade e marcação ativa** — Atualizado o `Sidebar.tsx` para assegurar que a rota `/` (ou `/dashboard`) seja sempre visível para perfis de gestores/vendedores e marcada com o estado ativo se corresponder à página atual.

### DoD
- Menu "Dashboards" permanece fixado como primeiro item do menu lateral.

---

## 34 — Toggle "Vitrine" invisível no tema light (Gestor)

> Correção de Bug / UI & CSS. Concluído em 2026-06-29.

### Tarefas
- [x] **34.1 Markup do toggle** — Atualizado o arquivo [Estoque.tsx](file:///f:/Projetos/SocialVeiculos/apps/gestor/src/pages/Estoque.tsx) para aplicar as classes `.is-on` e `.is-off` condicionalmente no label do toggle.
- [x] **34.2 Estilização sólida** — Atualizado o arquivo [theme.css](file:///f:/Projetos/SocialVeiculos/apps/gestor/src/styles/theme.css) para definir cores sólidas e visíveis em light mode para `.toggle-publish.is-off .toggle-slider` (`#cbd5e1`) e `.toggle-publish.is-on .toggle-slider` (`#16a34a`), mantendo as cores translúcidas apenas no tema escuro (`[data-theme='dark']`).

### DoD
- Toggle de publicação na vitrine visível e funcional em ambos os temas (light e dark).

---

## 35 — Credenciais Bancárias (Simulador) — paridade com SimuladorFacil

> Paridade com SimuladorFacil na tela Configurações > Credenciais Bancárias (Simulador), suportando 4 bancos reais de login (BV, C6, Itaú, Santander) com Selenium server-side adaptado para consumir mapeamentos. Concluído em 2026-06-30.

### Tarefas
- [x] **35.1 Corrigir catálogo de bancos (fonte única)** — enum `BancoSimulador` atualizado para `BV, C6, ITAU, SANTANDER`, criação do endpoint `GET /v1/configuracoes/bancos` e integração no front-end em `Configuracoes.tsx`.
- [x] **35.2 Mascaramento de senha no update** — alteração do `POST /credenciais_banco` para não sobrescrever a senha caso seja enviado o valor mascarado (`••••••••`).
- [x] **35.3 Portar infraestrutura Selenium** — migração de `credential_validator.py`, `browser_pool.py` e motores de bancos (`bv.py`, `c6.py`, `itau.py`, `santander.py`), com suporte ao formato dos mapeamentos dinâmicos (array).
- [x] **35.4 Endpoint de teste de conexão + UI** — endpoint `POST /v1/configuracoes/credenciais_banco/testar` síncrono rodando em threadpool (`run_in_executor`) e integração no front com botão de teste e estados de feedback.

### DoD
- Zero referências hardcoded à lista antiga de bancos.
- `POST /credenciais_banco` com senha mascarada preserva a senha cifrada original no banco.
- Botão "Testar conexão" funcional no front-end, validando as credenciais de forma real contra os bancos.

---

## 36 — Gaps de Lançamento (P0) — Recuperação de Senha, WebSockets e LGPD

> Resolução dos principais bloqueadores técnicos de lançamento identificados no diagnóstico de 2026-07-01. Concluído em 2026-07-02.

### Tarefas
- [x] **36.1 Recuperação de senha por e-mail real** — Integração com Resend para envio de e-mails de redefinição de senha real e uso de `FRONTEND_URL` por variável de ambiente.
- [x] **36.2 WebSockets com VITE_WS_URL** — Correção das conexões WebSocket nos dois chats (Vitrine e Gestor) usando `VITE_WS_URL` de ambiente para evitar quebras em produção (Vercel rewrite).
- [x] **36.3 Páginas estáticas institucionais e LGPD** — Criação das páginas "Sobre", "Termos de Uso", "Privacidade" e "Anuncie" com footer navegável na Vitrine.
- [x] **36.4 Ajuste do WhatsApp por veículo** — Correção para que o link de WhatsApp use o número cadastrado da própria loja em vez do número global (B024/M030).

### DoD
- Recuperação de senha funcional com e-mail real enviado.
- Chats conectando via WebSocket em produção usando endereço dinâmico de produção.
- Rodapés e links institucionais carregando páginas válidas.

---

## 37 — Comissão Automática e Restrição de Escopo do Vendedor

> Configuração de comissões padrões por loja, overrides por vendedor, geração automática de comissões após venda e separação visual do faturamento da loja para papéis de vendedor. Concluído em 2026-07-02.

### Tarefas
- [x] **37.1 Modelo e migração** — Adicionados campos `percentual_comissao_padrao` em `Loja`, `percentual_comissao` em `MembroLoja` e `esteira_id` em `ComissaoVenda`.
- [x] **37.2 Comissão automática na venda** — Geração automática de `ComissaoVenda` com percentual herdado da loja/vendedor ao concretizar venda formal.
- [x] **37.3 Rotas próprias e dashboard de vendedor** — Implementadas as rotas `/me/vendas`, `/me/comissoes` e dashboard segregado para vendedores sem expor a receita global da loja.
- [x] **37.4 Interface do Gestor** — Dashboard atualizado, aba "Minhas comissões" e configurações de comissão adicionadas nas telas de Equipe, Configurações e Financeiro.

### DoD
- Vendas formais criam automaticamente os registros de comissão.
- Vendedores autenticados não têm acesso a dados financeiros agregados/globais da loja no dashboard nem em rotas da API.
- Gestores conseguem parametrizar comissões padrão e por funcionário e visualizá-las no painel financeiro.

---

## 38 — App Mobile Fase 2 — Módulos completos (CRM, Estoque, Chat, Mais)

> Substituição dos placeholders do app mobile pelos módulos completos do gestor. Specs detalhados em `specs/2026-07-07-mobile-fase2-parte{1..4}-*.md`. Concluído em 2026-07-10 (M045+M071, 26/28 sub-tarefas).

### Tarefas
- [x] **38.1 Infra compartilhada + CRM** — Port das libs puras do gestor (`mascaras`, `cep`, `veiculo`, `modulos`) e `uiStore` (Toast/Alert nativo); CRM completo: Kanban por abas de estágio, detalhe de lead, negociações, CRUD de clientes.
- [x] **38.2 Estoque** — Lista de veículos, formulário multi-step (Dados → Mídia → Custos → Venda), fluxo de rascunho, consulta de placa, upload unificado foto/vídeo via `expo-image-picker` e fechamento de venda.
- [x] **38.3 Chat** — Conversas B2B+B2C unificadas com WebSocket (reuso de `lib/ws.ts`), feed de repasses, propostas e busca de lojas parceiras; não-lidos derivados client-side como no gestor web.
- [x] **38.4 Mais** — Menu que navega para PosVenda (esteira com checklist), Minhas Comissões (leitura), Financeiro (KPIs + lançamentos) e Equipe (membros, módulos, comissão).

### DoD
- Nenhuma aba do app exibe placeholder; todos os módulos navegáveis e funcionais.
- Regras de negócio idênticas ao gestor web (mesmos endpoints, mesmos estágios/etapas).

---

## 39 — App Mobile — API real (Onda 3)

> Troca da camada `apps/mobile/src/services/*` de mock (AsyncStorage) para HTTP no `apps/api` real, sem alterar telas/stores/hooks. Spec em `specs/2026-07-10-mobile-api-real.md`. Concluído em 2026-07-10 (commit dfc2c2d).

### Tarefas
- [x] **39.1 ApiClient** — `src/lib/api.ts` fetch-based (porta do gestor), com auth e tratamento de erro.
- [x] **39.2 Services reescritos** — Cada service chama `api.*` preservando assinaturas; mappers locais onde o DTO diverge de `types.ts`.
- [x] **39.3 Remoção do mock** — `db.ts`/`seed.ts` removidos; externos/IA e Vitrine B2C ligados na API real.
- [x] **39.4 Máscaras de input** — CPF/RG/data/placa/telefone/moeda aplicadas nos formulários (commit ee38666).

### DoD
- App funciona apenas contra a API real; nenhum resíduo de AsyncStorage-mock.
- Assinaturas exportadas em `services/index.ts` inalteradas (telas não mudaram).

---

## 40 — App Mobile — Usabilidade do painel lojista (M073)

> 6 fases de usabilidade: venda ponta a ponta, módulos do vendedor, hub Mais/CRM reorganizados, notificações, cadastro rápido e polimentos. Spec em `specs/2026-07-10-usabilidade-mobile-design.md`. Concluído em 2026-07-11.

### Tarefas
- [x] **40.1 Venda ponta a ponta** — Fluxo completo de registro de venda pelo vendedor no app.
- [x] **40.2 Módulos do vendedor** — Escopo restrito (sem receita global) espelhando o gestor web.
- [x] **40.3 Hub Mais + CRM** — Grade de atalhos + lista agrupada no "Mais"; sem tab dedicada por papel (decisão fechada).
- [x] **40.4 Notificações, cadastro rápido e polimentos** — Fases 4–6 do spec.

### DoD
- Vendedor completa uma venda inteira pelo app sem recorrer ao gestor web.
- Decisões de produto do spec (sem aprovação de venda pelo gestor, sem tab por papel) refletidas no app.

---

## 41 — Vitrine white-label por host

> Infraestrutura de site white-label: resolução por host, componentes de hero, footer e página "Sobre" customizados por loja. Commits 1695344 e f7fbf7d (2026-07-10).

### Tarefas
- [x] **41.1 Infra por host** — Resolução da loja pelo domínio/host da requisição.
- [x] **41.2 Componentes customizados** — Hero, footer e página Sobre parametrizados por loja.

### DoD
- Loja com domínio próprio vê vitrine com identidade própria sem código específico por loja.

---

## 42 — Esteira pós-venda — Alertas automáticos de prazo

> Alertas automáticos de vencimento para checklists da esteira pós-venda, com dashboard e componentes de UI de apoio. Commit 9c9831b (2026-07-11).

### Tarefas
- [x] **42.1 Worker de alertas** — `esteira_worker.py` gera alertas de prazo dos checklists.
- [x] **42.2 UI de apoio** — Dashboard e componentes atualizados (gestor + mobile) para exibir alertas.

### DoD
- Checklist com prazo vencido/próximo gera alerta visível no dashboard sem ação manual.


