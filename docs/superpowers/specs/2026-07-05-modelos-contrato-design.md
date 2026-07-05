# Modelos de Contrato Editáveis

## Contexto

Hoje `apps/api/routers/contratos.py` (`_gerar_html_contrato`, linhas 543-655) gera o HTML do contrato com f-strings Python chumbadas no código — texto fixo, 3 tipos hardcoded (`compra_venda`, `consignacao`, `garantia`), sem nenhuma forma de o usuário editar cláusulas. `apps/gestor/src/pages/ferramentas/Contratos.tsx` só permite escolher o tipo fixo ao criar contrato e trocar status depois; não há edição de texto.

Objetivo: permitir que o usuário crie/edite modelos de contrato livres (não presos aos 3 tipos), combinando texto fixo com variáveis do sistema (cliente, veículo, loja, valores) e campos personalizados preenchidos na hora de gerar o contrato.

## Decisões

- **Modelos livres e ilimitados** — usuário nomeia e cria quantos quiser, não vinculados aos 3 tipos fixos atuais.
- **Editor**: área de texto `contentEditable` nativa (sem lib nova — projeto não tem rich-text instalado) + painel lateral de variáveis do sistema, clicáveis, inserem `{{cliente.nome}}` etc. no cursor.
- **Variáveis**: catálogo fixo do sistema (cliente.*, veiculo.*, loja.*, contrato/valores.*) **+ campos personalizados** que o autor do modelo define (chave + label); esses campos extras são preenchidos pelo vendedor no momento de criar o contrato (não no modelo).
- **Motor de renderização**: migrar de f-string manual para **Jinja2**. Sintaxe `{{ }}` no editor mapeia 1:1 para o motor.
- **Compatibilidade**: contratos existentes continuam usando `_gerar_html_contrato` legado (sem `template_id`). Ao subir a feature, seed cria 3 templates padrão por loja (Compra e Venda, Consignação, Garantia) convertendo o HTML atual para Jinja2 — ponto de partida editável, não obrigatório.
- **Localização UI**: nova aba "Modelos" dentro da página Contratos existente (`apps/gestor/.../Contratos.tsx`), ao lado da listagem atual.

## Backend

### Modelo de dados

Nova tabela `template_contrato`:
- `id`, `loja_id` (FK, isolamento multi-tenant como já existe em `Contrato`)
- `nome` (string)
- `conteudo_html` (Text) — HTML com placeholders Jinja2
- `campos_extras` (JSON) — lista de `{chave: str, label: str}`
- `ativo` (bool), `created_at`, `updated_at`

Alteração em `Contrato` (models.py):
- `template_id` (FK nullable → `template_contrato.id`)
- `dados_extras` (JSON nullable) — valores preenchidos pelo vendedor para os campos personalizados daquele contrato específico, guardados para permitir re-render.

### Renderização

Nova função substitui `_gerar_html_contrato` quando `contrato.template_id` está setado:

```python
def _render_template_contrato(template, contrato, veiculo, cliente, loja, dados_extras):
    contexto = {
        "cliente": {...},  # mesmos campos hoje usados em f-string
        "veiculo": {...},
        "loja": {...},
        "contrato": {...},  # numero, valor_venda, valor_entrada, parcelas, observacoes
        **dados_extras,
    }
    return Template(template.conteudo_html).render(**contexto)
```

`GET /contratos/{id}/pdf` passa a checar: se `template_id` setado → `_render_template_contrato`; senão → `_gerar_html_contrato` (legado, inalterado).

### Endpoints novos

- `GET /templates-contrato` — lista templates da loja
- `POST /templates-contrato` — cria (nome, conteudo_html, campos_extras)
- `GET /templates-contrato/{id}` — detalhe
- `PATCH /templates-contrato/{id}` — edita
- `DELETE /templates-contrato/{id}` — soft delete (`ativo=false`)
- `POST /templates-contrato/{id}/duplicar` — clona template

### Ajuste em contratos existentes

- `POST /contratos` aceita `template_id` opcional e `dados_extras` (dict) quando o template escolhido tem `campos_extras`.
- Seed de migração (Alembic): para cada loja existente, criar os 3 templates padrão com o HTML atual convertido para `{{ }}` Jinja2, mantendo o texto/cláusulas idênticos ao gerado hoje.

### Segurança

- Jinja2 `Template().render()` com contexto controlado (não é `SandboxedEnvironment` necessário pois o autor do template é usuário autenticado da própria loja — mesma confiança que hoje editando `observacoes`). Ainda assim, usar `jinja2.Environment(autoescape=True)` para evitar XSS ao renderizar o HTML final.
- Isolamento multi-tenant: toda query de `template_contrato` filtrada por `loja_id`, seguindo o padrão já testado em `test_tenant_isolation.py`.

## Frontend

### Aba "Modelos" em Contratos.tsx

- Lista em cards: nome do modelo, badge se é um dos 3 padrão, ações (editar, duplicar, excluir).
- Botão "+ Novo Modelo".

### Editor de modelo (`EditorTemplateModal`)

- Campo "Nome do modelo".
- Área de edição `contentEditable` (div estilizada) para o texto/HTML do contrato.
- Painel lateral com catálogo de variáveis agrupado por categoria (Cliente, Veículo, Loja, Valores) — clique insere o placeholder no ponto do cursor.
- Seção "Campos personalizados": lista de `{chave, label}` que o autor adiciona/remove; esses viram inputs no formulário de criação de contrato.
- Botão "Pré-visualizar" — renderiza com dados fictícios de exemplo (sem chamar backend, apenas replace client-side ilustrativo, já que o render real é Jinja2 no servidor).
- Salvar → `POST`/`PATCH /templates-contrato`.

### Ajuste no fluxo de criação de contrato

- `NovoContratoModal`: campo "Modelo" (select) substitui/complementa o "Tipo" fixo, listando os templates ativos da loja.
- Se o modelo escolhido tem `campos_extras`, renderiza inputs adicionais no formulário; valores vão em `dados_extras` no `POST /contratos`.
- Download/impressão (`handleDownloadPdf`) continua chamando `GET /contratos/{id}/pdf` sem mudança de contrato de API — o backend decide legado vs. template novo.

## Fora de escopo (YAGNI)

- Rich-text avançado (negrito/itálico/listas via lib como Tiptap) — pode vir depois se pedido; `contentEditable` simples resolve o essencial.
- Versionamento de templates (histórico de alterações).
- Condicionais/loops Jinja2 na UI (o motor suporta, mas o editor não expõe isso agora — só substituição simples de variáveis).
- Templates compartilhados entre lojas (cada modelo pertence a uma loja só).

## Testes

- Backend: teste de isolamento multi-tenant para `template_contrato` (mesmo padrão de `test_tenant_isolation.py`).
- Backend: teste de render Jinja2 com campos ausentes (fallback igual ao atual `'___________'`).
- Backend: teste de que contratos antigos (sem `template_id`) continuam gerando o HTML legado inalterado.
- Frontend: `testar-sistema` — fluxo de criar modelo, inserir variável, salvar, criar contrato usando o modelo, baixar PDF.
