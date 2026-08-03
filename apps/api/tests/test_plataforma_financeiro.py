"""
Caixa da plataforma e prestação de contas (/v1/admin/plataforma/*).

Cobre o que quebra silenciosamente aqui: rota de admin exposta a gestor, número
do resumo que não reflete o lançamento recém-criado, projeção que ignora o caixa
real e relatório mensal que não fecha a conta (saldo inicial + movimento = final).
"""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_gestor_nao_acessa_caixa_da_plataforma(client, gestor_token):
    """Caixa da empresa é do admin da plataforma; gestor de loja não enxerga."""
    for rota in ("/v1/admin/plataforma/resumo", "/v1/admin/plataforma/projecao"):
        resp = await client.get(rota, headers=_auth(gestor_token))
        assert resp.status_code == 403, f"{rota} devolveu {resp.status_code}"


@pytest.mark.asyncio
async def test_sem_token_nao_acessa(client):
    resp = await client.get("/v1/admin/plataforma/resumo")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_resumo_tem_os_kpis_da_prestacao_de_contas(client, admin_token):
    resp = await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))
    assert resp.status_code == 200
    d = resp.json()
    for campo in (
        "caixa", "mrr", "pagantes", "trials", "receita_mes", "despesa_mes",
        "aporte_mes", "burn_mensal", "custo_fixo_estimado", "ticket_medio",
    ):
        assert campo in d, f"KPI ausente: {campo}"
    assert d["custo_fixo_estimado"] > 0, "custo fixo nunca deve ser 0 (quebra a projeção)"
    assert d["ticket_medio"] > 0


@pytest.mark.asyncio
async def test_lancamento_entra_no_caixa_e_sai_ao_excluir(client, admin_token):
    """Criar → o caixa muda pelo valor exato; excluir → volta ao que era."""
    antes = (await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))).json()

    criar = await client.post(
        "/v1/admin/plataforma/lancamentos",
        headers=_auth(admin_token),
        json={"tipo": "aporte", "categoria": "Teste automatizado", "valor": 1234.56,
              "descricao": "aporte de teste"},
    )
    assert criar.status_code == 201, criar.text
    lanc_id = criar.json()["id"]

    try:
        depois = (await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))).json()
        assert round(depois["caixa"] - antes["caixa"], 2) == 1234.56
        assert round(depois["aporte_mes"] - antes["aporte_mes"], 2) == 1234.56

        socios = {i["chave"]: i["valor"] for i in depois["aportes_por_socio"]}
        assert socios.get("Teste automatizado") == pytest.approx(1234.56)

        listagem = await client.get(
            "/v1/admin/plataforma/lancamentos",
            headers=_auth(admin_token), params={"tipo": "aporte"},
        )
        assert listagem.status_code == 200
        assert any(i["id"] == lanc_id for i in listagem.json())
    finally:
        apagar = await client.delete(
            f"/v1/admin/plataforma/lancamentos/{lanc_id}", headers=_auth(admin_token)
        )
        assert apagar.status_code == 204

    final = (await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))).json()
    assert round(final["caixa"], 2) == round(antes["caixa"], 2)


@pytest.mark.asyncio
async def test_valor_invalido_e_categoria_vazia_sao_recusados(client, admin_token):
    """422 na entrada, não 500 no insert: categoria é NOT NULL e valor tem que ser > 0."""
    for payload in (
        {"tipo": "despesa", "categoria": "Infra", "valor": 0},
        {"tipo": "despesa", "categoria": "Infra", "valor": -50},
        {"tipo": "despesa", "categoria": "   ", "valor": 10},
        {"tipo": "inexistente", "categoria": "Infra", "valor": 10},
    ):
        resp = await client.post(
            "/v1/admin/plataforma/lancamentos", headers=_auth(admin_token), json=payload
        )
        assert resp.status_code == 422, f"{payload} devolveu {resp.status_code}"


@pytest.mark.asyncio
async def test_projecao_parte_do_caixa_real_e_traz_os_tres_cenarios(client, admin_token):
    resumo = (await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))).json()
    resp = await client.get(
        "/v1/admin/plataforma/projecao", headers=_auth(admin_token), params={"meses": 12}
    )
    assert resp.status_code == 200
    d = resp.json()

    assert d["caixa_inicial"] == pytest.approx(resumo["caixa"], abs=0.01)
    assert {c["id"] for c in d["cenarios"]} == {"base", "pessimista", "otimista"}

    for cen in d["cenarios"]:
        assert len(cen["pontos"]) == 13, "13 pontos = hoje + 12 meses"
        assert cen["pontos"][0]["mes"] == 0
        assert cen["pontos"][0]["caixa"] == pytest.approx(d["caixa_inicial"], abs=0.01)
        assert cen["pico_negativo"] <= cen["pontos"][0]["caixa"] + 0.01

    por_id = {c["id"]: c for c in d["cenarios"]}
    fim = lambda c: por_id[c]["pontos"][-1]["caixa"]  # noqa: E731
    assert fim("otimista") > fim("base") > fim("pessimista"), "mais vendas tem que dar mais caixa"


@pytest.mark.asyncio
async def test_projecao_precifica_loja_nova_pela_entrada_nao_pela_carteira(client, admin_token):
    """
    Loja nova entra pelo plano mais barato, não pela média da carteira.

    Se a carteira tiver só um cliente no plano caro, projetar as próximas por
    essa média infla a receita futura — o erro que faz a projeção mentir.
    """
    resumo = (await client.get("/v1/admin/plataforma/resumo", headers=_auth(admin_token))).json()
    proj = (await client.get("/v1/admin/plataforma/projecao", headers=_auth(admin_token))).json()
    planos = (await client.get("/v1/admin/planos", headers=_auth(admin_token))).json()

    ativos = [p["preco_mensal"] for p in planos if p["ativo"]]
    if ativos:
        assert proj["preco_nova_loja"] == pytest.approx(min(ativos), abs=0.01)
    assert proj["preco_nova_loja"] <= resumo["ticket_medio"] + 0.01


@pytest.mark.asyncio
async def test_projecao_respeita_override_de_custo(client, admin_token):
    """Custo fixo maior tem que derrubar o caixa final — senão o parâmetro é decorativo."""
    base = await client.get(
        "/v1/admin/plataforma/projecao", headers=_auth(admin_token),
        params={"meses": 12, "custo_fixo": 500},
    )
    caro = await client.get(
        "/v1/admin/plataforma/projecao", headers=_auth(admin_token),
        params={"meses": 12, "custo_fixo": 5000},
    )
    assert base.status_code == caro.status_code == 200
    fim = lambda r: [c for c in r.json()["cenarios"] if c["id"] == "base"][0]["pontos"][-1]["caixa"]  # noqa: E731
    assert fim(caro) < fim(base)


@pytest.mark.asyncio
async def test_prestacao_de_contas_html_e_pdf(client, admin_token):
    mes = datetime.now().strftime("%Y-%m")

    html = await client.get(
        "/v1/admin/plataforma/prestacao-contas", headers=_auth(admin_token),
        params={"mes": mes, "formato": "html"},
    )
    assert html.status_code == 200
    assert "text/html" in html.headers["content-type"]
    corpo = html.text
    for secao in ("Prestação de contas", "Resumo do mês", "Saldo final em caixa",
                  "Assinaturas ativas", "Mensalidades recebidas"):
        assert secao in corpo, f"seção ausente no relatório: {secao}"

    pdf = await client.get(
        "/v1/admin/plataforma/prestacao-contas", headers=_auth(admin_token),
        params={"mes": mes, "formato": "pdf"},
    )
    assert pdf.status_code == 200
    # Sem a lib de PDF no ambiente, o endpoint cai para HTML de propósito.
    assert pdf.headers["content-type"].startswith(("application/pdf", "text/html"))
    if pdf.headers["content-type"].startswith("application/pdf"):
        assert pdf.content[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_prestacao_de_contas_recusa_mes_invalido(client, admin_token):
    for mes in ("2026-13", "agosto", "2026", ""):
        resp = await client.get(
            "/v1/admin/plataforma/prestacao-contas", headers=_auth(admin_token),
            params={"mes": mes},
        )
        assert resp.status_code == 422, f"mes={mes!r} devolveu {resp.status_code}"


@pytest.mark.asyncio
async def test_relatorio_fecha_a_conta_com_o_lancamento_do_mes(client, admin_token):
    """Despesa lançada hoje tem que aparecer no relatório do mês corrente."""
    mes = datetime.now().strftime("%Y-%m")
    criar = await client.post(
        "/v1/admin/plataforma/lancamentos",
        headers=_auth(admin_token),
        json={"tipo": "despesa", "categoria": "Infra", "valor": 777.77,
              "descricao": "servidor de teste", "recorrente": True},
    )
    assert criar.status_code == 201
    lanc_id = criar.json()["id"]

    try:
        rel = await client.get(
            "/v1/admin/plataforma/prestacao-contas", headers=_auth(admin_token),
            params={"mes": mes, "formato": "html"},
        )
        assert "777,77" in rel.text
        assert "servidor de teste" in rel.text

        # Marcado como recorrente ⇒ vira base do custo fixo da projeção.
        proj = (await client.get("/v1/admin/plataforma/projecao", headers=_auth(admin_token))).json()
        assert proj["custo_fixo_mensal"] >= 777.77
    finally:
        await client.delete(f"/v1/admin/plataforma/lancamentos/{lanc_id}", headers=_auth(admin_token))
