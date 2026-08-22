"""
Regressão do fluxo de "observar loja como gestor" (admin → impersonar).

B128 (2026-08-21) fez get_current_user rejeitar todo JWT sem `typ: "access"`
— correto contra o mfa_challenge_token/reset_token valendo como sessão, mas
travou também o token de impersonação (`typ: "impersonar"`), que é
intencionalmente uma sessão real de 15 min. Nenhum teste cobria esse fluxo
antes, por isso passou despercebido até aparecer no M6. Trava aqui.
"""
import pytest


@pytest.mark.asyncio
async def test_impersonar_gera_codigo_troca_e_autentica(client, admin_token):
    lojas_resp = await client.get("/v1/admin/lojas", headers={"Authorization": f"Bearer {admin_token}"})
    assert lojas_resp.status_code == 200, lojas_resp.text
    lojas = lojas_resp.json()
    assert lojas, "Precisa de ao menos uma loja seedada para o teste."
    loja_id = lojas[0]["id"]

    gerar_resp = await client.post(
        f"/v1/admin/lojas/{loja_id}/impersonar",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert gerar_resp.status_code == 200, gerar_resp.text
    codigo = gerar_resp.json()["codigo"]

    trocar_resp = await client.post("/v1/admin/impersonar/trocar", json={"codigo": codigo})
    assert trocar_resp.status_code == 200, trocar_resp.text
    token = trocar_resp.json()["access_token"]

    # O token de impersonação precisa funcionar como Bearer normal em /v1/me —
    # era exatamente isso que B128 quebrou sem querer.
    me_resp = await client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, me_resp.text
    assert me_resp.json()["papel"] == "gestor"

    # Uso único: o mesmo código não troca de novo.
    trocar_de_novo = await client.post("/v1/admin/impersonar/trocar", json={"codigo": codigo})
    assert trocar_de_novo.status_code == 400


@pytest.mark.asyncio
async def test_impersonar_codigo_invalido_e_rejeitado(client):
    resp = await client.post("/v1/admin/impersonar/trocar", json={"codigo": "codigo-que-nao-existe"})
    assert resp.status_code == 400
