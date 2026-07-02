"""
Testes do esquema de comissão + escopo de visão do vendedor (TDD 2026-07-02).

Cobrem:
  - Dashboard ramificado por papel (vendedor NÃO recebe receita global da loja).
  - Rotas /me/* com escopo de linha (vendedor só vê o que é dele).
  - Venda formal cria ComissaoVenda automaticamente com % resolvido
    (override do membro → padrão da loja).

Rodam contra o banco dev seedado (mesmo padrão do test_auth_multiloja).
Recursos criados recebem prefixo TESTE-COMISSAO para identificação.
"""
import pytest

from tests.conftest import _login

VENDEDOR_EMAIL = "carlos@autopremium.com.br"
VENDEDOR_SENHA = "demo123"


@pytest.fixture
async def vendedor_token(client):
    token = await _login(client, VENDEDOR_EMAIL, VENDEDOR_SENHA)
    if not token:
        pytest.skip("Banco não seedado com o vendedor demo — rode seed.py antes.")
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dashboard_vendedor_sem_receita_global(client, vendedor_token):
    """Vendedor recebe escopo próprio e NUNCA a receita global da loja."""
    resp = await client.get("/v1/dashboard/kpis", headers=_auth(vendedor_token))
    assert resp.status_code == 200, resp.text
    kpis = resp.json()
    assert kpis["escopo"] == "vendedor"
    assert kpis["receita_mes"] is None, "receita global da loja vazou para o vendedor"
    assert kpis["minhas_comissoes_pendentes"] is not None
    assert kpis["minhas_comissoes_pagas_mes"] is not None


@pytest.mark.asyncio
async def test_dashboard_gestor_escopo_loja(client, gestor_token):
    """Gestor mantém o comportamento original (KPIs da loja inteira)."""
    resp = await client.get("/v1/dashboard/kpis", headers=_auth(gestor_token))
    assert resp.status_code == 200, resp.text
    kpis = resp.json()
    assert kpis["escopo"] == "loja"
    assert isinstance(kpis["receita_mes"], (int, float))


@pytest.mark.asyncio
async def test_me_comissoes_escopo_de_linha(client, gestor_token, vendedor_token):
    """Vendedor vê apenas as comissões dele; a avulsa de outro não aparece."""
    # Quem é o vendedor?
    me = await client.get("/v1/auth/me", headers=_auth(vendedor_token))
    assert me.status_code == 200, me.text
    vendedor_id = me.json()["id"]

    # Gestor cria uma comissão para o vendedor e uma avulsa sem vendedor
    r1 = await client.post(
        "/v1/financeiro/comissoes",
        headers=_auth(gestor_token),
        json={"vendedor_id": vendedor_id, "valor_venda": 50000, "percentual": 2},
    )
    assert r1.status_code in (200, 201), r1.text
    r2 = await client.post(
        "/v1/financeiro/comissoes",
        headers=_auth(gestor_token),
        json={"valor_venda": 30000, "percentual": 1},
    )
    assert r2.status_code in (200, 201), r2.text

    # Vendedor lista /me/comissoes → só linhas com o vendedor_id dele
    resp = await client.get("/v1/me/comissoes", headers=_auth(vendedor_token))
    assert resp.status_code == 200, resp.text
    comissoes = resp.json()
    assert len(comissoes) >= 1
    assert all(c["vendedor_id"] == vendedor_id for c in comissoes), \
        "comissão de outro vendedor vazou no /me/comissoes"

    # Vendedor NÃO acessa o financeiro completo da loja (RBAC inalterado)
    resp_fin = await client.get("/v1/financeiro/comissoes", headers=_auth(vendedor_token))
    assert resp_fin.status_code == 403, "vendedor não deveria listar comissões da loja inteira"


@pytest.mark.asyncio
async def test_venda_cria_comissao_automatica(client, gestor_token):
    """Fluxo Vender: comissão nasce automática com o % padrão da loja e esteira_id."""
    h = _auth(gestor_token)

    # % padrão da loja = 5
    r_cfg = await client.patch(
        "/v1/configuracoes/loja", headers=h, json={"percentual_comissao_padrao": 5}
    )
    assert r_cfg.status_code == 200, r_cfg.text
    assert r_cfg.json()["percentual_comissao_padrao"] == 5

    # Veículo + cliente de teste
    r_v = await client.post("/v1/veiculos", headers=h, json={
        "marca": "TESTE-COMISSAO", "modelo": "Sedan", "ano_fabricacao": 2020,
        "ano_modelo": 2021, "km": 10000, "preco_venda": 40000,
    })
    assert r_v.status_code == 201, r_v.text
    veiculo_id = r_v.json()["id"]

    r_c = await client.post("/v1/clientes", headers=h, json={
        "nome": "Cliente Teste Comissao", "telefone": "11999990000",
    })
    assert r_c.status_code == 201, r_c.text
    cliente_id = r_c.json()["id"]

    # Vender
    r_venda = await client.post(
        f"/v1/veiculos/{veiculo_id}/vender", headers=h,
        json={"cliente_id": cliente_id, "valor_venda": 40000},
    )
    assert r_venda.status_code == 200, r_venda.text
    esteira_id = r_venda.json()["esteira_id"]

    # Comissão automática criada, vinculada à esteira, com % da loja
    r_lista = await client.get("/v1/financeiro/comissoes", headers=h)
    assert r_lista.status_code == 200, r_lista.text
    da_venda = [c for c in r_lista.json() if c.get("esteira_id") == esteira_id]
    assert len(da_venda) == 1, "venda formal não criou comissão automática"
    comissao = da_venda[0]
    assert comissao["percentual"] == 5
    assert comissao["valor_comissao"] == 2000.0  # 5% de 40.000
    assert comissao["pago"] is False
