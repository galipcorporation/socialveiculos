# Modelos de Contrato Editáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada loja crie modelos de contrato livres e ilimitados, combinando texto fixo com variáveis do sistema (cliente/veículo/loja/valores) e campos personalizados, renderizados via Jinja2, sem quebrar os contratos já existentes (que continuam usando o gerador legado).

**Architecture:** Nova tabela `template_contrato` (FK `loja_id`) com `conteudo_html` (placeholders `{{ }}`) e `campos_extras` (JSON serializado como Text). `Contrato` ganha `template_id` (nullable) e `dados_extras` (Text/JSON nullable). `GET /contratos/{id}/pdf` bifurca: `template_id` setado → novo `_render_template_contrato` (Jinja2, autoescape); `template_id` nulo → `_gerar_html_contrato` legado (inalterado). CRUD de templates em `apps/api/routers/contratos.py` (mesmo arquivo, mesmo router). Frontend: nova aba "Modelos" dentro de `Contratos.tsx`, editor `contentEditable` com painel de variáveis clicáveis, e `NovoContratoModal` ganha seletor de template + campos extras dinâmicos.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + Jinja2 (já instalado, 3.1.6) no backend; React + TypeScript no frontend (`apps/gestor`).

## Global Constraints

- Toda query de `template_contrato` DEVE filtrar por `loja_id == ctx.loja.id` (isolamento multi-tenant, ver `docs/superpowers/specs/2026-07-05-modelos-contrato-design.md`).
- `Jinja2.Environment(autoescape=True)` obrigatório no render de template para evitar XSS.
- Contratos existentes (sem `template_id`) devem continuar gerando o HTML idêntico ao atual — não alterar `_gerar_html_contrato`.
- Sem novas dependências de frontend (nenhuma lib de rich-text — usar `contentEditable` nativo).
- Seguir padrão de migração Alembic já usado no projeto (ver `apps/api/alembic/versions/f1b8d3e20a59_add_credencial_ia_marketing_usage.py`).

---

### Task 1: Migração Alembic — tabelas e colunas novas

**Files:**
- Create: `apps/api/alembic/versions/a1c3e7f92b04_add_template_contrato.py`

**Interfaces:**
- Produces: tabela `template_contrato` (`id`, `loja_id`, `nome`, `conteudo_html`, `campos_extras`, `ativo`, `created_at`, `updated_at`) e colunas novas em `contrato`: `template_id` (nullable FK), `dados_extras` (Text nullable).

- [ ] **Step 1: Verificar head atual do Alembic**

Run: `cd apps/api && python -m alembic heads`
Expected: `89f7c9b5aa21 (head)`

- [ ] **Step 2: Escrever a migração**

```python
"""Add template_contrato table + contrato.template_id/dados_extras (modelos editáveis)

Revision ID: a1c3e7f92b04
Revises: 89f7c9b5aa21
Create Date: 2026-07-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c3e7f92b04'
down_revision: Union[str, None] = '89f7c9b5aa21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'template_contrato',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('loja_id', sa.String(36), nullable=False),
        sa.Column('nome', sa.String(200), nullable=False),
        sa.Column('conteudo_html', sa.Text(), nullable=False),
        sa.Column('campos_extras', sa.Text(), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['loja_id'], ['loja.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_template_contrato_loja', 'template_contrato', ['loja_id'])

    op.add_column('contrato', sa.Column('template_id', sa.String(36), nullable=True))
    op.add_column('contrato', sa.Column('dados_extras', sa.Text(), nullable=True))
    op.create_foreign_key(
        'fk_contrato_template', 'contrato', 'template_contrato',
        ['template_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_contrato_template', 'contrato', type_='foreignkey')
    op.drop_column('contrato', 'dados_extras')
    op.drop_column('contrato', 'template_id')
    op.drop_index('ix_template_contrato_loja', table_name='template_contrato')
    op.drop_table('template_contrato')
```

- [ ] **Step 3: Rodar a migração**

Run: `cd apps/api && python -m alembic upgrade head`
Expected: aplica sem erro; `python -m alembic heads` mostra `a1c3e7f92b04 (head)`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/alembic/versions/a1c3e7f92b04_add_template_contrato.py
git commit -m "feat(contratos): migracao para template_contrato e colunas em contrato"
```

---

### Task 2: Model `TemplateContrato` + campos novos em `Contrato`

**Files:**
- Modify: `apps/api/models.py` (após a classe `Contrato`, linha 1287; e dentro de `Contrato`, linhas 1264-1273)

**Interfaces:**
- Consumes: `_uuid()` (linha 42), `_now()` (linha 46) — já existentes em `models.py`.
- Produces: classe `TemplateContrato` com atributos `id, loja_id, nome, conteudo_html, campos_extras, ativo, created_at, updated_at, loja` (relationship); `Contrato.template_id`, `Contrato.dados_extras`, `Contrato.template` (relationship).

- [ ] **Step 1: Adicionar colunas em `Contrato`**

Em `apps/api/models.py`, logo após a linha 1270 (`dados_ocr = Column(Text, nullable=True)`), adicionar:

```python
    template_id = Column(String(36), ForeignKey("template_contrato.id", ondelete="SET NULL"), nullable=True)
    dados_extras = Column(Text, nullable=True)  # JSON com valores dos campos personalizados do template
```

E após a linha 1278 (`veiculo = relationship(...)`), adicionar:

```python
    template = relationship("TemplateContrato")
```

- [ ] **Step 2: Criar a classe `TemplateContrato`**

Logo após o fechamento da classe `Contrato` (após a linha 1287, antes do comentário `# CARTEIRA DO PROPRIETÁRIO`), adicionar:

```python
class TemplateContrato(Base):
    """Modelo de contrato editável pela loja — texto fixo + placeholders Jinja2."""
    __tablename__ = "template_contrato"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)

    nome = Column(String(200), nullable=False)
    conteudo_html = Column(Text, nullable=False)
    campos_extras = Column(Text, nullable=True)  # JSON: [{"chave": "...", "label": "..."}]
    ativo = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    loja = relationship("Loja")

    __table_args__ = (
        Index("ix_template_contrato_loja_dup", "loja_id"),
    )
```

Nota: o índice já foi criado pela migração (`ix_template_contrato_loja`); usar nome diferente aqui (`ix_template_contrato_loja_dup`) evitaria conflito, mas como o SQLAlchemy `__table_args__` só declara metadados (a migração já criou o índice real no banco), o ideal é **não duplicar declaração de índice**. Portanto: **remover o bloco `__table_args__` inteiro** da classe acima — o índice já existe via migração Alembic, e o model não precisa redeclará-lo.

- [ ] **Step 3: Verificar import de `Boolean` já existe**

Run: `grep -n "^from sqlalchemy import\|    Boolean," apps/api/models.py | head -5`
Expected: `Boolean` já está entre os imports (usado em outras tabelas como `credencial_ia.ativo`). Se não aparecer, adicionar `Boolean` ao import existente do SQLAlchemy no topo do arquivo.

- [ ] **Step 4: Testar import do módulo**

Run: `cd apps/api && python -c "from models import TemplateContrato, Contrato; print(TemplateContrato.__tablename__, Contrato.template_id)"`
Expected: imprime `template_contrato Contrato.template_id` sem erro.

- [ ] **Step 5: Commit**

```bash
git add apps/api/models.py
git commit -m "feat(contratos): model TemplateContrato e colunas template_id/dados_extras"
```

---

### Task 3: Schemas Pydantic para templates e ajuste de `ContratoCreateRequest`

**Files:**
- Modify: `apps/api/schemas.py` (perto das linhas 1096-1148, junto aos schemas de Contrato)

**Interfaces:**
- Produces: `CampoExtraTemplate`, `TemplateContratoCreateRequest`, `TemplateContratoUpdateRequest`, `TemplateContratoResponse`, `TemplateContratoListResponse`.
- Modifica: `ContratoCreateRequest` ganha `template_id: Optional[str]` e `dados_extras: Optional[dict]`.

- [ ] **Step 1: Adicionar schema de campo extra e de template**

Em `apps/api/schemas.py`, logo antes da linha 1096 (`class ContratoCreateRequest`), adicionar:

```python
class CampoExtraTemplate(BaseModel):
    chave: str = Field(..., min_length=1, max_length=60)
    label: str = Field(..., min_length=1, max_length=120)


class TemplateContratoCreateRequest(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    conteudo_html: str = Field(..., min_length=1)
    campos_extras: Optional[List[CampoExtraTemplate]] = None


class TemplateContratoUpdateRequest(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    conteudo_html: Optional[str] = None
    campos_extras: Optional[List[CampoExtraTemplate]] = None
    ativo: Optional[bool] = None


class TemplateContratoResponse(BaseModel):
    id: str
    loja_id: str
    nome: str
    conteudo_html: str
    campos_extras: List[CampoExtraTemplate] = []
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateContratoListResponse(BaseModel):
    items: List[TemplateContratoResponse]
```

- [ ] **Step 2: Ajustar `ContratoCreateRequest`**

Em `apps/api/schemas.py` linha 1096-1104, alterar:

```python
class ContratoCreateRequest(BaseModel):
    tipo: TipoContrato = TipoContrato.COMPRA_VENDA
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    valor_venda: Optional[float] = None
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    dados_ocr: Optional[str] = None
    template_id: Optional[str] = None
    dados_extras: Optional[dict] = None
```

- [ ] **Step 3: Ajustar `ContratoResponse`**

Em `apps/api/schemas.py` linha 1119-1139, adicionar campo depois de `dados_ocr` (linha 1131):

```python
    template_id: Optional[str] = None
    dados_extras: Optional[dict] = None
```

- [ ] **Step 4: Testar import**

Run: `cd apps/api && python -c "from schemas import TemplateContratoCreateRequest, TemplateContratoResponse, ContratoCreateRequest; print('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add apps/api/schemas.py
git commit -m "feat(contratos): schemas de TemplateContrato e campos novos em ContratoCreateRequest/Response"
```

---

### Task 4: Motor de renderização Jinja2 + endpoint `/pdf` bifurcado

**Files:**
- Modify: `apps/api/routers/contratos.py` (imports linha 1-35, função `_gerar_html_contrato` linha 543, endpoint `gerar_pdf_contrato` linha 267-297)
- Modify: `apps/api/requirements.txt`

**Interfaces:**
- Consumes: `Contrato.template_id`, `Contrato.dados_extras` (Task 2/3), `TemplateContrato.conteudo_html` (Task 2).
- Produces: `_render_template_contrato(template: TemplateContrato, contrato: Contrato, loja) -> str`.

- [ ] **Step 1: Adicionar `jinja2` ao requirements.txt**

Em `apps/api/requirements.txt`, adicionar ao final:

```
jinja2>=3.1.0
```

- [ ] **Step 2: Adicionar import e função de render**

Em `apps/api/routers/contratos.py`, adicionar ao bloco de imports (após linha 18):

```python
import json
from jinja2 import Environment
```

E em `models` import (linha 22-26), adicionar `TemplateContrato`:

```python
from models import (
    Contrato, Veiculo, ClientePF, StatusContrato, TipoContrato,
    StatusVeiculo, LancamentoFinanceiro, TipoLancamento,
    EsteiraPosVenda, OrigemLead, OrigemVeiculo, ComissaoVenda, MembroLoja,
    TemplateContrato,
)
```

Adicionar a função de render logo antes de `_gerar_html_contrato` (linha 543), reaproveitando o helper `fmt_brl` já existente dentro de `_gerar_html_contrato` — extraído para módulo:

```python
_jinja_env = Environment(autoescape=True)


def _fmt_brl(v):
    if v is None:
        return "R$ ___________"
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _render_template_contrato(template: TemplateContrato, contrato: Contrato, loja) -> str:
    """Renderiza um TemplateContrato com Jinja2 usando os dados do contrato."""
    veiculo = contrato.veiculo
    cliente = contrato.cliente
    dados_extras = json.loads(contrato.dados_extras) if contrato.dados_extras else {}

    contexto = {
        "cliente": {
            "nome": cliente.nome if cliente else "___________",
            "cpf": (cliente.cpf if cliente else None) or "___.___.___-__",
            "rg": (cliente.rg if cliente else None) or "___________",
            "telefone": (cliente.telefone if cliente else None) or "___________",
            "endereco": (cliente.endereco if cliente else None) or "___________",
            "cidade": (cliente.cidade if cliente else None) or "___________",
            "estado": (cliente.estado if cliente else None) or "__",
        },
        "veiculo": {
            "marca": (veiculo.marca if veiculo else None) or "___________",
            "modelo": (veiculo.modelo if veiculo else None) or "___________",
            "versao": (veiculo.versao if veiculo else None) or "",
            "ano_fabricacao": veiculo.ano_fabricacao if veiculo else "____",
            "ano_modelo": veiculo.ano_modelo if veiculo else "____",
            "placa": (veiculo.placa if veiculo else None) or "___________",
            "cor": (veiculo.cor if veiculo else None) or "___________",
            "km": veiculo.km if veiculo else 0,
            "combustivel": (veiculo.combustivel if veiculo else None) or "___________",
        },
        "loja": {
            "nome": loja.nome,
            "cnpj": loja.cnpj or "___.___.___/____-__",
            "endereco": loja.endereco or "___________",
            "cidade": loja.cidade or "___________",
            "estado": loja.estado or "__",
            "telefone": loja.telefone or loja.whatsapp or "___________",
        },
        "contrato": {
            "numero": contrato.numero,
            "valor_venda": _fmt_brl(contrato.valor_venda),
            "valor_entrada": _fmt_brl(contrato.valor_entrada),
            "parcelas": contrato.parcelas or "___",
            "observacoes": contrato.observacoes or "",
            "data": contrato.created_at.strftime("%d/%m/%Y") if contrato.created_at else "___/___/______",
        },
        **dados_extras,
    }

    return _jinja_env.from_string(template.conteudo_html).render(**contexto)
```

- [ ] **Step 3: Bifurcar o endpoint `/pdf`**

Em `apps/api/routers/contratos.py`, substituir dentro de `gerar_pdf_contrato` (linhas 274-288):

```python
    from sqlalchemy.orm import selectinload
    stmt = select(Contrato).where(
        Contrato.id == contrato_id,
        Contrato.loja_id == ctx.loja.id,
    ).options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
        selectinload(Contrato.template),
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one_or_none()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")

    if contrato.template_id and contrato.template:
        html_content = _render_template_contrato(contrato.template, contrato, ctx.loja)
    else:
        html_content = _gerar_html_contrato(contrato, ctx.loja)
```

- [ ] **Step 4: Instalar dependência e testar import**

Run: `cd apps/api && pip install jinja2>=3.1.0 && python -c "from routers.contratos import _render_template_contrato; print('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add apps/api/routers/contratos.py apps/api/requirements.txt
git commit -m "feat(contratos): motor de render Jinja2 e bifurcacao legado/template no endpoint pdf"
```

---

### Task 5: CRUD de `/templates-contrato` + `POST /contratos` aceitando `template_id`/`dados_extras`

**Files:**
- Modify: `apps/api/routers/contratos.py` (novo bloco de rotas + ajuste em `criar_contrato`, linhas 159-205)
- Test: `apps/api/tests/test_templates_contrato.py`

**Interfaces:**
- Consumes: `TemplateContratoCreateRequest/UpdateRequest/Response/ListResponse` (Task 3), `TemplateContrato` model (Task 2).
- Produces: `GET/POST /templates-contrato`, `GET/PATCH/DELETE /templates-contrato/{id}`, `POST /templates-contrato/{id}/duplicar`.

- [ ] **Step 1: Escrever teste de isolamento e CRUD (falhando)**

Criar `apps/api/tests/test_templates_contrato.py`:

```python
"""Testes de CRUD e isolamento multi-tenant de templates de contrato."""
import uuid
import json
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, TemplateContrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def _criar_loja_e_gestor(db):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"
    db.add(Loja(id=loja_id, nome="Loja Templates", slug=f"loja-tpl-{loja_id[:8]}"))
    db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
    db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
    await db.commit()
    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    return loja_id, gestor_id, membro_id, token


@pytest.mark.asyncio
async def test_crud_template_contrato(client):
    async with async_session() as db:
        loja_id, gestor_id, membro_id, token = await _criar_loja_e_gestor(db)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Criar
        resp = await client.post(
            "/v1/templates-contrato",
            json={
                "nome": "Modelo Teste",
                "conteudo_html": "<p>{{cliente.nome}} compra {{veiculo.marca}}</p>",
                "campos_extras": [{"chave": "garantia_meses", "label": "Meses de garantia"}],
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        template_id = resp.json()["id"]
        assert resp.json()["campos_extras"][0]["chave"] == "garantia_meses"

        # Listar
        resp_list = await client.get("/v1/templates-contrato", headers=headers)
        assert resp_list.status_code == 200
        assert any(t["id"] == template_id for t in resp_list.json()["items"])

        # Editar
        resp_patch = await client.patch(
            f"/v1/templates-contrato/{template_id}",
            json={"nome": "Modelo Editado"},
            headers=headers,
        )
        assert resp_patch.status_code == 200
        assert resp_patch.json()["nome"] == "Modelo Editado"

        # Duplicar
        resp_dup = await client.post(f"/v1/templates-contrato/{template_id}/duplicar", headers=headers)
        assert resp_dup.status_code == 201
        assert resp_dup.json()["id"] != template_id

        # Excluir (soft delete)
        resp_del = await client.delete(f"/v1/templates-contrato/{template_id}", headers=headers)
        assert resp_del.status_code == 204

        resp_list2 = await client.get("/v1/templates-contrato", headers=headers)
        assert not any(t["id"] == template_id for t in resp_list2.json()["items"])
    finally:
        async with async_session() as db:
            await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()


@pytest.mark.asyncio
async def test_template_contrato_isolamento_tenant(client):
    """Gestor da loja A não pode ler/editar/excluir template da loja B."""
    async with async_session() as db:
        loja_a_id, gestor_a_id, membro_a_id, token_a = await _criar_loja_e_gestor(db)

        loja_b_id = _uid()
        template_b_id = _uid()
        db.add(Loja(id=loja_b_id, nome="Loja B Templates", slug=f"loja-b-tpl-{loja_b_id[:8]}"))
        db.add(TemplateContrato(
            id=template_b_id, loja_id=loja_b_id, nome="Template B",
            conteudo_html="<p>segredo da loja B</p>", campos_extras=None, ativo=True,
        ))
        await db.commit()

    headers = {"Authorization": f"Bearer {token_a}"}
    try:
        resp_get = await client.get(f"/v1/templates-contrato/{template_b_id}", headers=headers)
        assert resp_get.status_code == 404

        resp_patch = await client.patch(
            f"/v1/templates-contrato/{template_b_id}", json={"nome": "hack"}, headers=headers
        )
        assert resp_patch.status_code == 404

        resp_del = await client.delete(f"/v1/templates-contrato/{template_b_id}", headers=headers)
        assert resp_del.status_code == 404
    finally:
        async with async_session() as db:
            await db.execute(delete(TemplateContrato).where(TemplateContrato.id == template_b_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `cd apps/api && python -m pytest tests/test_templates_contrato.py -v`
Expected: FAIL — rota `/v1/templates-contrato` não existe (404 genérico do FastAPI ou erro de rota).

- [ ] **Step 3: Implementar o CRUD de templates**

Em `apps/api/routers/contratos.py`, adicionar (logo antes da seção `# ── AÇÃO DE VENDA`, ou seja, antes da linha 300):

```python
# ═══════════════════════════════════════════════════════════════
# ── CRUD DE MODELOS DE CONTRATO (TEMPLATES)
# ═══════════════════════════════════════════════════════════════

def _template_to_response(t: TemplateContrato) -> TemplateContratoResponse:
    campos = json.loads(t.campos_extras) if t.campos_extras else []
    return TemplateContratoResponse(
        id=t.id,
        loja_id=t.loja_id,
        nome=t.nome,
        conteudo_html=t.conteudo_html,
        campos_extras=campos,
        ativo=t.ativo,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("/templates-contrato", response_model=TemplateContratoListResponse)
async def listar_templates_contrato(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista modelos de contrato ativos da loja."""
    stmt = select(TemplateContrato).where(
        TemplateContrato.loja_id == ctx.loja.id,
        TemplateContrato.ativo == True,  # noqa: E712
    ).order_by(TemplateContrato.nome)
    result = await db.execute(stmt)
    templates = result.scalars().all()
    return TemplateContratoListResponse(items=[_template_to_response(t) for t in templates])


@router.post("/templates-contrato", response_model=TemplateContratoResponse, status_code=201)
async def criar_template_contrato(
    body: TemplateContratoCreateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria um novo modelo de contrato editável."""
    campos_json = json.dumps([c.model_dump() for c in body.campos_extras]) if body.campos_extras else None
    template = TemplateContrato(
        loja_id=ctx.loja.id,
        nome=body.nome,
        conteudo_html=body.conteudo_html,
        campos_extras=campos_json,
        ativo=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


async def _obter_template_ou_404(template_id: str, loja_id: str, db: AsyncSession) -> TemplateContrato:
    stmt = select(TemplateContrato).where(
        TemplateContrato.id == template_id,
        TemplateContrato.loja_id == loja_id,
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de contrato não encontrado")
    return template


@router.get("/templates-contrato/{template_id}", response_model=TemplateContratoResponse)
async def obter_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    return _template_to_response(template)


@router.patch("/templates-contrato/{template_id}", response_model=TemplateContratoResponse)
async def atualizar_template_contrato(
    template_id: str,
    body: TemplateContratoUpdateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    update_data = body.model_dump(exclude_unset=True)
    if "campos_extras" in update_data:
        campos = update_data.pop("campos_extras")
        template.campos_extras = json.dumps(campos) if campos else None
    for key, value in update_data.items():
        setattr(template, key, value)
    template.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


@router.delete("/templates-contrato/{template_id}", status_code=204)
async def excluir_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — marca como inativo."""
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    template.ativo = False
    template.updated_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/templates-contrato/{template_id}/duplicar", response_model=TemplateContratoResponse, status_code=201)
async def duplicar_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    original = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    copia = TemplateContrato(
        loja_id=ctx.loja.id,
        nome=f"{original.nome} (cópia)",
        conteudo_html=original.conteudo_html,
        campos_extras=original.campos_extras,
        ativo=True,
    )
    db.add(copia)
    await db.commit()
    await db.refresh(copia)
    return _template_to_response(copia)
```

E adicionar os schemas ao import (linha 28-35):

```python
from schemas import (
    ContratoCreateRequest,
    ContratoUpdateRequest,
    ContratoResponse,
    ContratoListResponse,
    VenderVeiculoRequest,
    VenderVeiculoResponse,
    TemplateContratoCreateRequest,
    TemplateContratoUpdateRequest,
    TemplateContratoResponse,
    TemplateContratoListResponse,
)
```

- [ ] **Step 4: Ajustar `criar_contrato` para aceitar `template_id`/`dados_extras`**

Em `apps/api/routers/contratos.py`, dentro de `criar_contrato` (linhas 168-180), alterar a construção do `Contrato`:

```python
    contrato = Contrato(
        loja_id=ctx.loja.id,
        veiculo_id=body.veiculo_id,
        cliente_id=body.cliente_id,
        tipo=body.tipo,
        status=StatusContrato.RASCUNHO,
        numero=numero,
        valor_venda=body.valor_venda,
        valor_entrada=body.valor_entrada,
        parcelas=body.parcelas,
        observacoes=body.observacoes,
        dados_ocr=body.dados_ocr,
        template_id=body.template_id,
        dados_extras=json.dumps(body.dados_extras) if body.dados_extras else None,
    )
```

- [ ] **Step 5: Rodar os testes e verificar que passam**

Run: `cd apps/api && python -m pytest tests/test_templates_contrato.py -v`
Expected: PASS — ambos os testes (`test_crud_template_contrato`, `test_template_contrato_isolamento_tenant`).

- [ ] **Step 6: Rodar suíte completa de contratos/tenant para checar regressão**

Run: `cd apps/api && python -m pytest tests/test_tenant_isolation.py tests/test_venda_composta.py -v`
Expected: PASS (sem quebra nos testes existentes).

- [ ] **Step 7: Commit**

```bash
git add apps/api/routers/contratos.py apps/api/tests/test_templates_contrato.py
git commit -m "feat(contratos): CRUD de templates-contrato e criar_contrato aceita template_id/dados_extras"
```

---

### Task 6: Seed de migração — 3 templates padrão por loja existente

**Files:**
- Modify: `apps/api/alembic/versions/a1c3e7f92b04_add_template_contrato.py` (mesma migração da Task 1 — adicionar seed via `data migration` em nova revisão para manter a Task 1 focada em DDL)

Nota de decisão: em vez de misturar DDL com seed de dados na mesma revisão (harder to rollback cleanly), esta task cria uma **segunda migração** exclusiva para o seed.

**Interfaces:**
- Consumes: tabela `template_contrato` e `loja` (via `op.get_bind()` / conexão raw SQL, padrão Alembic sem depender do model async).

- [ ] **Step 1: Criar a migração de seed**

Create: `apps/api/alembic/versions/b2d4f803c615_seed_templates_contrato_padrao.py`

```python
"""Seed de 3 templates de contrato padrão (Compra e Venda, Consignação, Garantia) por loja existente

Revision ID: b2d4f803c615
Revises: a1c3e7f92b04
Create Date: 2026-07-05 00:05:00.000000
"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision: str = 'b2d4f803c615'
down_revision: Union[str, None] = 'a1c3e7f92b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TEMPLATES = {
    "Compra e Venda (padrão)": """<h1>CONTRATO DE COMPRA E VENDA DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>VENDEDOR (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}} — {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}</p>
<h2>COMPRADOR</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}} — {{cliente.endereco}}, {{cliente.cidade}} - {{cliente.estado}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}} — {{veiculo.ano_fabricacao}}/{{veiculo.ano_modelo}} — Placa {{veiculo.placa}}</p>
<h2>CONDIÇÕES</h2>
<p>Valor da Venda: {{contrato.valor_venda}} — Entrada: {{contrato.valor_entrada}} — Parcelas: {{contrato.parcelas}}x</p>
<h2>CLÁUSULAS</h2>
<p>1. O VENDEDOR declara que o veículo descrito acima é de sua propriedade, livre e desembaraçado de quaisquer ônus.</p>
<p>2. O COMPRADOR declara ter examinado o veículo e estar de acordo com suas condições.</p>
<p>3. A transferência de propriedade junto ao DETRAN é de responsabilidade do COMPRADOR, devendo ser realizada no prazo máximo de 30 dias.</p>
<p>4. O VENDEDOR se responsabiliza por quaisquer multas e infrações anteriores à data deste contrato.</p>
<p>5. Este contrato é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores.</p>""",
    "Consignação (padrão)": """<h1>TERMO DE CONSIGNAÇÃO DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>CONSIGNATÁRIO (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}} — {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}</p>
<h2>CONSIGNANTE</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}} — Placa {{veiculo.placa}}</p>
<h2>CONDIÇÕES</h2>
<p>Valor de referência: {{contrato.valor_venda}}</p>
<h2>CLÁUSULAS</h2>
<p>1. O veículo permanece em consignação até a efetiva venda ou devolução ao CONSIGNANTE.</p>
<p>2. A LOJA não se responsabiliza por danos decorrentes de uso indevido durante o período de exposição.</p>""",
    "Garantia (padrão)": """<h1>TERMO DE GARANTIA DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>VENDEDOR (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}}</p>
<h2>COMPRADOR</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} — Placa {{veiculo.placa}}</p>
<h2>CLÁUSULAS</h2>
<p>1. A LOJA garante o veículo pelo prazo e condições descritas nas observações deste contrato.</p>
<p>2. {{contrato.observacoes}}</p>""",
}


def upgrade() -> None:
    conn = op.get_bind()
    lojas = conn.execute(sa.text("SELECT id FROM loja")).fetchall()
    now = datetime.now(timezone.utc)

    template_table = sa.table(
        'template_contrato',
        sa.column('id', sa.String),
        sa.column('loja_id', sa.String),
        sa.column('nome', sa.String),
        sa.column('conteudo_html', sa.Text),
        sa.column('campos_extras', sa.Text),
        sa.column('ativo', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )

    rows = []
    for (loja_id,) in lojas:
        for nome, conteudo in _TEMPLATES.items():
            rows.append({
                'id': uuid.uuid4().hex,
                'loja_id': loja_id,
                'nome': nome,
                'conteudo_html': conteudo,
                'campos_extras': None,
                'ativo': True,
                'created_at': now,
                'updated_at': now,
            })

    if rows:
        op.bulk_insert(template_table, rows)


def downgrade() -> None:
    conn = op.get_bind()
    nomes = tuple(_TEMPLATES.keys())
    conn.execute(
        sa.text("DELETE FROM template_contrato WHERE nome IN :nomes").bindparams(
            sa.bindparam('nomes', expanding=True)
        ),
        {"nomes": list(nomes)},
    )
```

- [ ] **Step 2: Rodar a migração**

Run: `cd apps/api && python -m alembic upgrade head`
Expected: aplica sem erro; `python -m alembic heads` mostra `b2d4f803c615 (head)`.

- [ ] **Step 3: Validar o seed manualmente**

Run: `cd apps/api && python -c "
import asyncio
from database import async_session
from sqlalchemy import text

async def check():
    async with async_session() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM template_contrato'))
        print('templates:', r.scalar())

asyncio.run(check())
"`
Expected: imprime `templates: N` onde N = (nº de lojas existentes) × 3.

- [ ] **Step 4: Commit**

```bash
git add apps/api/alembic/versions/b2d4f803c615_seed_templates_contrato_padrao.py
git commit -m "feat(contratos): seed de 3 templates padrao por loja existente"
```

---

### Task 7: Frontend — aba "Modelos" com editor de template

**Files:**
- Modify: `apps/gestor/src/pages/ferramentas/Contratos.tsx` (adicionar tabs no topo, novo componente `ModelosTab` e `EditorTemplateModal`)

**Interfaces:**
- Consumes: `api.get/post/patch/delete` (`apps/gestor/src/lib/api.ts:137-167`), `useUIStore` (toast/error), `SearchSelect` não usado aqui.
- Produces: componente `ModelosTab()`, componente `EditorTemplateModal({ template, onClose, onSaved })`, tipo `TemplateItem`, tipo `CampoExtra`.

- [ ] **Step 1: Adicionar tipos e estado de abas**

Em `apps/gestor/src/pages/ferramentas/Contratos.tsx`, após a interface `VeiculoItem` (linha 56), adicionar:

```tsx
interface CampoExtra {
  chave: string
  label: string
}

interface TemplateItem {
  id: string
  loja_id: string
  nome: string
  conteudo_html: string
  campos_extras: CampoExtra[]
  ativo: boolean
  created_at: string
  updated_at: string
}
```

Catálogo de variáveis do sistema (adicionar junto aos outros consts, após `STATUS_CLASSES`, linha 94):

```tsx
const CATALOGO_VARIAVEIS: { grupo: string; itens: { chave: string; label: string }[] }[] = [
  {
    grupo: 'Cliente',
    itens: [
      { chave: 'cliente.nome', label: 'Nome' },
      { chave: 'cliente.cpf', label: 'CPF' },
      { chave: 'cliente.rg', label: 'RG' },
      { chave: 'cliente.telefone', label: 'Telefone' },
      { chave: 'cliente.endereco', label: 'Endereço' },
      { chave: 'cliente.cidade', label: 'Cidade' },
      { chave: 'cliente.estado', label: 'Estado' },
    ],
  },
  {
    grupo: 'Veículo',
    itens: [
      { chave: 'veiculo.marca', label: 'Marca' },
      { chave: 'veiculo.modelo', label: 'Modelo' },
      { chave: 'veiculo.versao', label: 'Versão' },
      { chave: 'veiculo.ano_fabricacao', label: 'Ano fabricação' },
      { chave: 'veiculo.ano_modelo', label: 'Ano modelo' },
      { chave: 'veiculo.placa', label: 'Placa' },
      { chave: 'veiculo.cor', label: 'Cor' },
      { chave: 'veiculo.km', label: 'KM' },
      { chave: 'veiculo.combustivel', label: 'Combustível' },
    ],
  },
  {
    grupo: 'Loja',
    itens: [
      { chave: 'loja.nome', label: 'Razão social' },
      { chave: 'loja.cnpj', label: 'CNPJ' },
      { chave: 'loja.endereco', label: 'Endereço' },
      { chave: 'loja.cidade', label: 'Cidade' },
      { chave: 'loja.estado', label: 'Estado' },
      { chave: 'loja.telefone', label: 'Telefone' },
    ],
  },
  {
    grupo: 'Contrato / Valores',
    itens: [
      { chave: 'contrato.numero', label: 'Número' },
      { chave: 'contrato.data', label: 'Data' },
      { chave: 'contrato.valor_venda', label: 'Valor da venda' },
      { chave: 'contrato.valor_entrada', label: 'Entrada' },
      { chave: 'contrato.parcelas', label: 'Parcelas' },
      { chave: 'contrato.observacoes', label: 'Observações' },
    ],
  },
]
```

- [ ] **Step 2: Adicionar abas no `ContratosPage`**

Em `ContratosPage` (linha 154+), adicionar estado de aba logo após `const [showModal, setShowModal] = useState(false)` (linha 165):

```tsx
  const [aba, setAba] = useState<'contratos' | 'modelos'>('contratos')
```

Substituir o header (linhas 236-245) para incluir os botões de aba, mantendo o header existente e adicionando abaixo dele:

```tsx
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>Gestão de Contratos</h2>
          <p>Crie, gerencie e compartilhe contratos de compra e venda, consignação e garantia.</p>
        </div>
        {aba === 'contratos' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <PlusIcon /> Novo Contrato
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${aba === 'contratos' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
          onClick={() => setAba('contratos')}
        >
          Contratos
        </button>
        <button
          className={`btn ${aba === 'modelos' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
          onClick={() => setAba('modelos')}
        >
          Modelos
        </button>
      </div>

      {aba === 'modelos' ? <ModelosTab /> : <ContratosTabContent
        contratos={contratos}
        total={total}
        loading={loading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setPage={setPage}
        search={search}
        setSearch={setSearch}
        handleDownloadPdf={handleDownloadPdf}
        handleShareWhatsApp={handleShareWhatsApp}
        handleStatusChange={handleStatusChange}
        navigate={navigate}
      />}
```

Nota: o corpo que hoje está inline (KPIs, filtros, tabela — linhas 247-398) deve ser extraído para um novo componente `ContratosTabContent(props)` que recebe exatamente esses valores/handlers como props (mesmo corpo JSX, apenas movido para fora de `ContratosPage`, sem lógica nova). Isso mantém `ContratosPage` como orquestrador de abas.

- [ ] **Step 3: Criar `ModelosTab` e `EditorTemplateModal`**

Adicionar ao final do arquivo (após o fechamento de `NovoContratoModal`, linha 586):

```tsx
/* ══════════════════════════════════════════════════════════════
   TAB — Modelos de Contrato
   ══════════════════════════════════════════════════════════════ */

function ModelosTab() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TemplateItem | null>(null)
  const [creating, setCreating] = useState(false)

  const toast = (type: 'success' | 'error' | 'info', message: string) => useUIStore.getState().showToast(message, type)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ items: TemplateItem[] }>('/templates-contrato')
      setTemplates(data.items)
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao carregar modelos', details)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleDuplicar = async (t: TemplateItem) => {
    try {
      await api.post(`/templates-contrato/${t.id}/duplicar`)
      toast('success', 'Modelo duplicado')
      fetchTemplates()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao duplicar modelo', details)
    }
  }

  const handleExcluir = async (t: TemplateItem) => {
    try {
      await api.delete(`/templates-contrato/${t.id}`)
      toast('success', 'Modelo excluído')
      fetchTemplates()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao excluir modelo', details)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon /> Novo Modelo
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Carregando modelos...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <DocIcon />
          <h3>Nenhum modelo criado</h3>
          <p>Crie seu primeiro modelo de contrato clicando em "Novo Modelo".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {templates.map(t => (
            <div key={t.id} className="kpi-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontWeight: 600 }}>{t.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>
                {t.campos_extras.length > 0 ? `${t.campos_extras.length} campo(s) personalizado(s)` : 'Sem campos personalizados'}
              </div>
              <div className="actions-cell">
                <button className="action-btn" title="Editar" onClick={() => setEditing(t)}>
                  <DocIcon />
                </button>
                <button className="action-btn" title="Duplicar" onClick={() => handleDuplicar(t)}>
                  <PlusIcon />
                </button>
                <button className="action-btn" title="Excluir" onClick={() => handleExcluir(t)}>
                  <XIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <EditorTemplateModal
          template={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            toast('success', 'Modelo salvo com sucesso!')
            fetchTemplates()
          }}
        />
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════
   MODAL — Editor de Modelo de Contrato
   ══════════════════════════════════════════════════════════════ */

function EditorTemplateModal({ template, onClose, onSaved }: {
  template: TemplateItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(template?.nome || '')
  const [campos, setCampos] = useState<CampoExtra[]>(template?.campos_extras || [])
  const [novoCampoChave, setNovoCampoChave] = useState('')
  const [novoCampoLabel, setNovoCampoLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const toast = (type: 'success' | 'error' | 'info', message: string) => useUIStore.getState().showToast(message, type)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = template?.conteudo_html || '<p>Digite o texto do contrato aqui...</p>'
    }
  }, [template])

  const inserirVariavel = (chave: string) => {
    const placeholder = `{{${chave}}}`
    editorRef.current?.focus()
    document.execCommand('insertText', false, placeholder)
  }

  const adicionarCampoExtra = () => {
    if (!novoCampoChave.trim() || !novoCampoLabel.trim()) return
    setCampos(prev => [...prev, { chave: novoCampoChave.trim(), label: novoCampoLabel.trim() }])
    setNovoCampoChave('')
    setNovoCampoLabel('')
  }

  const removerCampoExtra = (chave: string) => {
    setCampos(prev => prev.filter(c => c.chave !== chave))
  }

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast('error', 'Informe o nome do modelo')
      return
    }
    setSaving(true)
    try {
      const conteudo_html = editorRef.current?.innerHTML || ''
      const payload = { nome, conteudo_html, campos_extras: campos }
      if (template) {
        await api.patch(`/templates-contrato/${template.id}`, payload)
      } else {
        await api.post('/templates-contrato', payload)
      }
      onSaved()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao salvar modelo', details)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h3>{template ? 'Editar Modelo' : 'Novo Modelo'}</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Nome do modelo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Compra e Venda — Sedans" />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Texto do contrato</label>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                style={{
                  minHeight: 320,
                  border: '1px solid var(--sv-border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--sv-input-bg)',
                  overflowY: 'auto',
                }}
              />

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Campos personalizados</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="chave (ex: garantia_meses)"
                    value={novoCampoChave}
                    onChange={e => setNovoCampoChave(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="rótulo (ex: Meses de garantia)"
                    value={novoCampoLabel}
                    onChange={e => setNovoCampoLabel(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-outline" onClick={adicionarCampoExtra}>Adicionar</button>
                </div>
                {campos.map(c => (
                  <div key={c.chave} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{c.label} (<code>{`{{${c.chave}}}`}</code>)</span>
                    <button className="action-btn" onClick={() => removerCampoExtra(c.chave)}><XIcon /></button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: 260 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Variáveis do sistema</label>
              <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--sv-border)', borderRadius: 8, padding: 8 }}>
                {CATALOGO_VARIAVEIS.map(grupo => (
                  <div key={grupo.grupo} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-text-muted)', marginBottom: 4 }}>{grupo.grupo}</div>
                    {grupo.itens.map(item => (
                      <button
                        key={item.chave}
                        className="btn btn-outline"
                        style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '4px 8px', marginBottom: 4 }}
                        onClick={() => inserirVariavel(item.chave)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar `useRef` ao import do React**

Em `apps/gestor/src/pages/ferramentas/Contratos.tsx` linha 1, alterar:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
```

- [ ] **Step 5: Rodar typecheck/build do gestor**

Run: `cd apps/gestor && npx tsc --noEmit 2>&1 | head -60`
Expected: sem erros novos relacionados a `Contratos.tsx` (corrigir quaisquer erros de tipo apontados, ex: props de `ContratosTabContent`).

- [ ] **Step 6: Commit**

```bash
git add apps/gestor/src/pages/ferramentas/Contratos.tsx
git commit -m "feat(contratos): aba Modelos com editor contentEditable e catalogo de variaveis"
```

---

### Task 8: Frontend — `NovoContratoModal` usa template + campos extras dinâmicos

**Files:**
- Modify: `apps/gestor/src/pages/ferramentas/Contratos.tsx` (dentro de `NovoContratoModal`, linhas 420-586)

**Interfaces:**
- Consumes: `TemplateItem` (Task 7), `api.get('/templates-contrato')`.
- Produces: `POST /contratos` agora envia `template_id` e `dados_extras`.

- [ ] **Step 1: Buscar templates disponíveis no modal**

Em `NovoContratoModal` (linha 420+), adicionar estado logo após `const [saving, setSaving] = useState(false)` (linha 430):

```tsx
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [templateId, setTemplateId] = useState('')
  const [valoresExtras, setValoresExtras] = useState<Record<string, string>>({})

  useEffect(() => {
    api.get<{ items: TemplateItem[] }>('/templates-contrato')
      .then(data => setTemplates(data.items))
      .catch(() => { /* ignore */ })
  }, [])

  const templateSelecionado = templates.find(t => t.id === templateId)
```

- [ ] **Step 2: Adicionar select de template e campos extras no form**

Em `NovoContratoModal`, logo após o bloco "Tipo" (linhas 497-505), adicionar:

```tsx
            {/* Modelo */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Modelo de Contrato</label>
              <select value={templateId} onChange={e => { setTemplateId(e.target.value); setValoresExtras({}) }}>
                <option value="">Nenhum (usar layout padrão do sistema)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            {templateSelecionado && templateSelecionado.campos_extras.length > 0 && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Campos do modelo "{templateSelecionado.nome}"</label>
                {templateSelecionado.campos_extras.map(campo => (
                  <input
                    key={campo.chave}
                    type="text"
                    placeholder={campo.label}
                    value={valoresExtras[campo.chave] || ''}
                    onChange={e => setValoresExtras(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </div>
            )}
```

- [ ] **Step 3: Enviar `template_id`/`dados_extras` no submit**

Em `NovoContratoModal`, alterar `handleSubmit` (linhas 466-485):

```tsx
  const handleSubmit = async () => {
    setSaving(true)
    try {
      await api.post('/contratos', {
        tipo,
        cliente_id: clienteId || null,
        veiculo_id: veiculoId || null,
        valor_venda: parseMoeda(valorStr) || null,
        valor_entrada: parseMoeda(entradaStr) || null,
        parcelas: parcelas ? parseInt(parcelas) : null,
        observacoes: observacoes || null,
        template_id: templateId || null,
        dados_extras: Object.keys(valoresExtras).length > 0 ? valoresExtras : null,
      })
      onSaved()
    } catch (err) {
      const { message, details } = extractErrorDetails(err)
      useUIStore.getState().showError(message || 'Erro ao criar contrato', details)
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 4: Rodar typecheck**

Run: `cd apps/gestor && npx tsc --noEmit 2>&1 | head -60`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add apps/gestor/src/pages/ferramentas/Contratos.tsx
git commit -m "feat(contratos): NovoContratoModal seleciona modelo e preenche campos personalizados"
```

---

### Task 9: Teste end-to-end de render (legado intacto + template novo)

**Files:**
- Test: `apps/api/tests/test_render_template_contrato.py`

**Interfaces:**
- Consumes: `_gerar_html_contrato`, `_render_template_contrato` (Task 4), `TemplateContrato` (Task 2).

- [ ] **Step 1: Escrever o teste**

Create: `apps/api/tests/test_render_template_contrato.py`

```python
"""Garante que contratos sem template_id continuam usando o gerador legado,
e que contratos com template_id usam o motor Jinja2 novo."""
import uuid
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, TemplateContrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


@pytest.mark.asyncio
async def test_contrato_sem_template_usa_gerador_legado(client):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Legado", slug=f"loja-legado-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp_contrato = await client.post(
            "/v1/contratos", json={"tipo": "compra_venda", "valor_venda": 50000}, headers=headers
        )
        assert resp_contrato.status_code == 201, resp_contrato.text
        contrato_id = resp_contrato.json()["id"]

        resp_pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert resp_pdf.status_code == 200
        assert "CONTRATO DE COMPRA E VENDA DE VEÍCULO" in resp_pdf.text
        assert "CLÁUSULAS" in resp_pdf.text
    finally:
        async with async_session() as db:
            from models import Contrato
            await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()


@pytest.mark.asyncio
async def test_contrato_com_template_usa_jinja2(client):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    template_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Nova", slug=f"loja-nova-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        db.add(TemplateContrato(
            id=template_id, loja_id=loja_id, nome="Modelo Custom",
            conteudo_html="<p>Contrato {{contrato.numero}} — Garantia: {{garantia_meses}} meses</p>",
            campos_extras='[{"chave": "garantia_meses", "label": "Meses de garantia"}]',
            ativo=True,
        ))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp_contrato = await client.post(
            "/v1/contratos",
            json={
                "tipo": "compra_venda",
                "valor_venda": 50000,
                "template_id": template_id,
                "dados_extras": {"garantia_meses": "12"},
            },
            headers=headers,
        )
        assert resp_contrato.status_code == 201, resp_contrato.text
        contrato_id = resp_contrato.json()["id"]

        resp_pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert resp_pdf.status_code == 200
        assert "Garantia: 12 meses" in resp_pdf.text
        assert "CLÁUSULAS" not in resp_pdf.text  # não usou o gerador legado
    finally:
        async with async_session() as db:
            from models import Contrato
            await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
            await db.execute(delete(TemplateContrato).where(TemplateContrato.id == template_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()
```

- [ ] **Step 2: Rodar e verificar que passam**

Run: `cd apps/api && python -m pytest tests/test_render_template_contrato.py -v`
Expected: PASS — ambos os testes.

- [ ] **Step 3: Rodar toda a suíte de testes da API para checar regressão geral**

Run: `cd apps/api && python -m pytest tests/ -v 2>&1 | tail -60`
Expected: todos os testes passam (incluindo os pré-existentes).

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/test_render_template_contrato.py
git commit -m "test(contratos): cobertura de render legado vs template novo via Jinja2"
```

---

## Fora de escopo (confirmado no spec)

- Rich-text avançado (Tiptap/Quill) — usar `contentEditable` simples.
- Versionamento de templates.
- Condicionais/loops Jinja2 expostos na UI.
- Templates compartilhados entre lojas.
