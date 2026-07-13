# Tarefas — Social Veículos

Backlog de implementação derivado de [social.md](../social.md). Cada arquivo é um épico/módulo com tarefas codificáveis (não documentação de produto). Ordenadas por dependência: o que está no topo destrava o resto.

> ⚠️ **ANTES de mexer em banco, migrations ou deploy:** leia [ARMADILHAS-PRODUCAO.md](ARMADILHAS-PRODUCAO.md). Três coisas já quebraram produção (datetime aware em coluna naive, migrations SQLite-only que não rodam em Postgres, deploy Vercel fora da raiz do monorepo) e a mensagem de erro de cada uma aponta para a causa errada.
> 🐛 **Bugs:** registro contínuo em [BUGS.md](BUGS.md) — adicionar/referenciar a cada ajuste.
> ✨ **Melhorias/ajustes de UX:** registro contínuo em [MELHORIAS.md](MELHORIAS.md) (consolidou os antigos arquivos soltos `melhorias/01..19`).
> 📐 **Specs/planos de design:** arquivados em [specs/](specs/) (recuperados de `docs/superpowers/` em 2026-07-11). **Regra:** toda documentação nova vai para `documentos/tarefa/` — não criar outras pastas de docs na raiz.

## Stack assumida (decisões já tomadas, ver T00)
- **Monorepo** (pnpm workspaces): `apps/gestor`, `apps/vitrine`, `apps/api`, `packages/*`.
- **Backend**: Hono (TS) servindo API REST versionada (`/v1`). Web + futuro app consomem a mesma API.
- **Frontend**: Vite + React SPA (Gestor) e Vite + React SSR/SSG para a Vitrine (SEO).
- **Banco**: PostgreSQL (multitenant por `loja_id` + RLS). **Cache/realtime**: Redis. **Storage**: S3-compatível. **Busca**: Postgres FTS na Fase 1, OpenSearch quando escalar.

## Fundação (fazer primeiro)
- [01 — Setup do monorepo e infra base](TAREFAS.md#01--setup-do-monorepo-e-infra-base)
- [02 — Modelo de dados e migrações](TAREFAS.md#02--modelo-de-dados-e-migrações)
- [03 — Autenticação, sessões e MFA](TAREFAS.md#03--autenticação-sessões-e-mfa)
- [04 — Multitenancy, RBAC e isolamento](TAREFAS.md#04--multitenancy-rbac-e-isolamento)

## Gestor (B2B)
- [05 — Estoque de veículos](TAREFAS.md#05--estoque-de-veículos-gestor)
- [06 — Clientes, leads e CRM Kanban](TAREFAS.md#06--clientes-leads-e-crm-kanban-gestor)
- [07 — Rede social B2B (repasses + chat lojas)](TAREFAS.md#07--rede-social-b2b-repasses--chat-entre-lojas)
- [08 — Dashboard, métricas e financeiro](TAREFAS.md#08--dashboard-métricas-e-financeiro-gestor)
- [09 — Assinaturas, planos e módulos premium (SSO)](TAREFAS.md#09--assinaturas-planos-e-módulos-premium-sso)

## Vitrine (B2C)
- [10 — Feed público e gate de login](TAREFAS.md#10--feed-público-e-gate-de-login-vitrine-b2c)
- [11 — Card, página do carro e página da loja (SEO)](TAREFAS.md#11--card-página-do-carro-e-página-da-loja-seo)
- [12 — Chat interno, favoritos e ponte WhatsApp](TAREFAS.md#12--chat-interno-favoritos-e-ponte-whatsapp-vitrine-b2c)

## Transversais
- [13 — Mídia (upload unificado foto/vídeo)](TAREFAS.md#13--mídia-upload-unificado-fotovídeo)
- [14 — Segurança, LGPD, auditoria e rate limiting](TAREFAS.md#14--segurança-lgpd-auditoria-e-rate-limiting)
- [15 — DevOps, CI/CD e observabilidade](TAREFAS.md#15--devops-cicd-e-observabilidade)

## Módulos premium (worker persistente — não serverless)
- [17 — Módulo Simulador de crédito (motor V2 + fallback browser)](TAREFAS.md#17--módulo-simulador-de-crédito-motor-v2--fallback-browser)
- [18 — Módulo Assistente de IA do vendedor (WhatsApp)](TAREFAS.md#18--módulo-assistente-de-ia-do-vendedor-whatsapp)
- Ferramentas: submenu + páginas dedicadas → ver **M021** em [MELHORIAS.md](MELHORIAS.md)

## Dívida técnica
- [19 — Vitrine: trocar tokens `--sv-*` órfãos por `--vt-*`](TAREFAS.md#19--vitrine-trocar-tokens---sv--órfãos-por---vt-)

## Convenções
- Cada tarefa: `[ ]` pendente, `[x]` feita. Subtarefas são commits/PRs pequenos.
- **DoD** (Definition of Done) por tarefa no fim de cada arquivo.
- **Sem dados falsos**: telas exibem dado real ou estado vazio (regra do social.md §6).
- **Mídia unificada**: foto e vídeo num único campo `image/*,video/*`, nunca separados.
- **Regra de ouro**: nunca vazar dado de loja (custo, repasse, margem) para a Vitrine B2C.
