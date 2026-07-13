# Armadilhas de Produção — leia antes de mexer em banco, migrations ou deploy

> Escrito em 2026-07-12, logo após o primeiro deploy real (API no Fly + 4 fronts
> na Vercel + APK). Cada item abaixo **quebrou produção** e custou horas, porque
> a mensagem de erro aponta para a causa errada.
>
> Público: qualquer pessoa ou IA que for mexer no `apps/api`, em migrations ou em
> deploy. Ler antes, não depois.

---

## 1. Datetime: sempre grave *naive* UTC

**Sintoma:** login retorna `500`. Qualquer escrita no banco falha em produção,
mas funciona em dev.

**Causa:** as colunas são `DateTime` sem timezone (`TIMESTAMP WITHOUT TIME
ZONE`). O SQLite (dev) aceita um datetime *aware*; o **Postgres (produção)
rejeita**, com uma mensagem que não ajuda em nada:

```
can't subtract offset-naive and offset-aware datetimes
```

**Regra:**

```python
from models import utcnow            # naive UTC

obj.updated_at = utcnow()                      # ✅ certo
obj.updated_at = datetime.now(timezone.utc)    # ❌ 500 em produção
```

`datetime.now(timezone.utc)` **continua válido** para comparações e leituras
(`.year`, `.strftime()`, subtrações, comparar com valores em memória). O erro é
só na **escrita de coluna**.

Isso já foi corrigido em 28 escritas espalhadas por 9 routers (commit
`1197327`). Ao escrever código novo, use `utcnow()`.

**Relacionado:** enums persistem pelo **NOME**, não pelo valor (`COMPRA`, não
`compra`).

---

## 2. Migrations: as 29 antigas são SQLite-only e NÃO rodam em Postgres

**Sintoma:** `alembic upgrade head` contra o Postgres falha com
`syntax error at or near "PRAGMA"`. Em produção, isso derruba o container em
loop de restart no boot (o `start.sh` roda `alembic upgrade head`).

**Causa:** as migrations existentes usam `PRAGMA table_info(...)`,
`sqlite_master` e `batch_alter_table` — sintaxe e workarounds que só existem no
SQLite. Toda a engenharia de idempotência delas foi feita para o SQLite (cujo
DDL não é transacional).

**Como o schema de produção foi criado:** por **baseline**, não por elas —
`Base.metadata.create_all` + `alembic stamp head` (revisão `b8227b6208e4`). As 29
migrations antigas são **histórico morto**: não são re-executáveis contra
Postgres.

**Ao escrever uma migration NOVA:**

- SQL compatível com Postgres: `information_schema` em vez de `PRAGMA`,
  `ALTER TABLE` nativo em vez de `batch_alter_table`.
- Para provisionar um banco Postgres do zero: use **baseline**
  (`create_all` + `stamp head`), **não** `upgrade head`.
- `alembic check` diz se os models divergiram do schema atual.

**Não remova o escape em `alembic/env.py`:**

```python
config.set_main_option("sqlalchemy.url", _get_async_url().replace("%", "%%"))
```

`set_main_option` grava no `configparser`, que trata `%` como sintaxe de
interpolação e **rejeita senhas percent-encoded** (`%23` = `#`). Sem o escape, o
deploy falha com um erro de interpolação que não menciona a senha.

---

## 3. Deploy na Vercel: sempre a partir da RAIZ do monorepo

**Sintoma:** o build morre em `tsc: command not found`. Parece dependência
faltando — não é.

**Causa:** deployar de dentro de `apps/<app>/` faz a Vercel enviar **só aquela
pasta**, sem o `pnpm-lock.yaml` (que vive na raiz). Sem o lockfile e sem o
workspace, o pnpm instala ~12 pacotes e o `tsc` nunca chega lá.

**Como deployar** (da raiz, um `vercel.<app>.json` por app):

```bash
vercel deploy --prod --local-config vercel.gestor.json  --project gestor
vercel deploy --prod --local-config vercel.vitrine.json --project vitrine
vercel deploy --prod --local-config vercel.admin.json   --project admin
vercel deploy --prod --local-config vercel.site.json    --project site
```

**`--project` é obrigatório.** Sem ele, a CLI reusa o link salvo em
`.vercel/project.json` e publica **o app errado no projeto errado** (aconteceu:
a vitrine foi parar no projeto do gestor).

**Nunca use `cd ../..` no `buildCommand`.** No servidor de build não existe raiz
de monorepo: o pnpm responde "Already up-to-date" sem instalar nada e o build
**trava por dezenas de minutos** sem erro.

**`packageManager` precisa estar no `package.json` do app.** Sem ele, a Vercel
não enxerga o `pnpm@10.10.0` da raiz e usa um pnpm incompatível com o Node 24:

```
ERR_PNPM_META_FETCH_FAIL: Value of "this" must be of type URLSearchParams
```

---

## Produção — o que está no ar

| | |
|---|---|
| API | https://socialveiculos-api.fly.dev (Fly, região `gru`, app `socialveiculos-api`) |
| Gestor | https://gestor-sigma-cyan.vercel.app |
| Vitrine | https://vitrine-cyan.vercel.app |
| Admin | https://admin-three-bay-23.vercel.app |
| Site | https://site-one-nu-70.vercel.app |
| Banco | Supabase Postgres 17 |
| Mobile | EAS `@mototrip022/socialveiculos-mobile` — perfil `preview` gera o APK |

**O WhatsApp worker NÃO está deployado** (`apps/whatsapp-worker`, Baileys) — o
assistente de WhatsApp está fora do ar. Ele precisa de um volume no Fly para
persistir as sessões do Baileys.

Secrets de produção vivem nos painéis (Fly, Vercel, EAS), **não** em `.env`.
`JWT_SECRET` exige no mínimo 32 bytes quando `api_debug=false`.

### Pendências de segurança

O seed criou contas com **senhas fracas num banco exposto na internet**:
`admin123` (owner) e `demo123` (loja demo). Trocar antes de qualquer uso real.
