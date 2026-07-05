"""
Teste de regressão B030 — OAuth Google: `state` gerado mas nunca validado no
callback (login-CSRF). O callback agora exige o `state` emitido por
`oauth_google.gerar_state()` e rejeita ausente/forjado/expirado.
"""
import oauth_google


def test_gerar_state_e_validar_state_aceita_o_proprio_state():
    state = oauth_google.gerar_state()
    assert oauth_google.validar_state(state) is True


def test_validar_state_rejeita_ausente_ou_forjado():
    assert oauth_google.validar_state(None) is False
    assert oauth_google.validar_state("") is False
    assert oauth_google.validar_state("token-forjado-qualquer") is False


def test_validar_state_rejeita_jwt_de_outro_escopo():
    from auth import create_access_token

    token_outro_escopo = create_access_token(data={"scope": "mfa_pending"})
    assert oauth_google.validar_state(token_outro_escopo) is False


async def test_google_callback_sem_state_e_rejeitado(client):
    resp = await client.get("/v1/auth/google/callback", params={"code": "codigo-qualquer"})
    assert resp.status_code in (302, 307)
    assert "erro=state_invalido" in resp.headers["location"]


async def test_google_callback_com_state_forjado_e_rejeitado(client):
    resp = await client.get(
        "/v1/auth/google/callback",
        params={"code": "codigo-qualquer", "state": "forjado"},
    )
    assert resp.status_code in (302, 307)
    assert "erro=state_invalido" in resp.headers["location"]
