"""
Regressão do quadro Kanban do CRM (B0xx — 500 em GET /v1/leads/kanban).

O bug: LeadResponse declara `interacoes` e `responsavel_nome`, mas as rotas de
listagem só faziam selectinload de cliente/negociações. Na serialização o
FastAPI estourava ResponseValidationError (28 erros com o seed atual) — 500 pro
cliente. Sob driver async o mesmo acesso lazy vira MissingGreenlet.
Bastava a loja ter leads para a tela quebrar.

Cobre também /v1/leads (mesma causa) e o responsavel_nome, que o kanban
não preenchia por não carregar o relationship `responsavel`.
"""
import pytest


@pytest.mark.asyncio
async def test_kanban_nao_da_500_e_traz_colunas(client, gestor_token):
    """O quadro responde 200 com as 5 colunas canônicas do funil."""
    resp = await client.get(
        "/v1/leads/kanban",
        headers={"Authorization": f"Bearer {gestor_token}"},
    )
    assert resp.status_code == 200, resp.text

    colunas = resp.json()["colunas"]
    etapas = [c["etapa"] for c in colunas]
    assert etapas == ["lead", "proposta", "negociacao", "fechamento", "perdido"]


@pytest.mark.asyncio
async def test_kanban_serializa_interacoes_do_lead(client, gestor_token):
    """Cada lead do quadro traz `interacoes` — o campo que causava o 500."""
    resp = await client.get(
        "/v1/leads/kanban",
        headers={"Authorization": f"Bearer {gestor_token}"},
    )
    assert resp.status_code == 200, resp.text

    leads = [lead for c in resp.json()["colunas"] for lead in c["leads"]]
    if not leads:
        pytest.skip("Banco sem leads na loja demo — rode seed.py antes.")

    for lead in leads:
        assert isinstance(lead["interacoes"], list)
        assert "responsavel_nome" in lead


@pytest.mark.asyncio
async def test_total_da_coluna_bate_com_os_leads(client, gestor_token):
    """`total` é derivado dos leads da coluna, não contado à parte."""
    resp = await client.get(
        "/v1/leads/kanban",
        headers={"Authorization": f"Bearer {gestor_token}"},
    )
    assert resp.status_code == 200, resp.text

    for coluna in resp.json()["colunas"]:
        assert coluna["total"] == len(coluna["leads"])


@pytest.mark.asyncio
async def test_listagem_de_leads_tambem_serializa(client, gestor_token):
    """GET /v1/leads tinha o mesmo selectinload incompleto do kanban."""
    resp = await client.get(
        "/v1/leads",
        headers={"Authorization": f"Bearer {gestor_token}"},
    )
    assert resp.status_code == 200, resp.text

    for lead in resp.json():
        assert isinstance(lead["interacoes"], list)


@pytest.mark.asyncio
async def test_kanban_exige_autenticacao(client):
    """Rota de tenant não responde sem token."""
    resp = await client.get("/v1/leads/kanban")
    assert resp.status_code in (401, 403)
