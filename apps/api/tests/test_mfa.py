"""
Testes de MFA real (M029) — enroll, confirm, login com desvio de MFA, código errado.

Roda contra o banco de dev seedado (conta gestor demo), como o resto da suíte.
Sempre desativa o MFA no final do teste que o ativa, para não deixar a conta
demo travada para outros testes/uso manual.
"""
import pyotp

from tests.conftest import GESTOR_EMAIL, GESTOR_SENHA


async def test_mfa_enroll_confirm_e_login_exige_codigo(client, gestor_token):
    headers = {"Authorization": f"Bearer {gestor_token}"}

    # 1. Enroll — gera secret + QR
    resp = await client.post("/v1/auth/mfa/enroll", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    secret = body["secret"]
    assert body["otpauth_url"].startswith("otpauth://totp/")
    assert body["qr_code_base64"]

    try:
        # 2. Confirm com código errado é rejeitado
        resp = await client.post("/v1/auth/mfa/confirm", json={"codigo": "000000"}, headers=headers)
        assert resp.status_code == 401

        # 3. Confirm com código certo ativa o MFA
        codigo = pyotp.TOTP(secret).now()
        resp = await client.post("/v1/auth/mfa/confirm", json={"codigo": codigo}, headers=headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["mfa_ativo"] is True

        # 4. Login por senha agora retorna challenge, não tokens finais
        resp = await client.post("/v1/auth/login", json={"email": GESTOR_EMAIL, "senha": GESTOR_SENHA})
        assert resp.status_code == 200, resp.text
        challenge_body = resp.json()
        assert challenge_body.get("mfa_required") is True
        challenge_token = challenge_body["mfa_challenge_token"]
        assert "access_token" not in challenge_body

        # 5. verify-login com código errado é rejeitado
        resp = await client.post(
            "/v1/auth/mfa/verify-login",
            json={"mfa_challenge_token": challenge_token, "codigo": "000000"},
        )
        assert resp.status_code == 401

        # 6. verify-login com código certo emite os tokens finais
        codigo = pyotp.TOTP(secret).now()
        resp = await client.post(
            "/v1/auth/mfa/verify-login",
            json={"mfa_challenge_token": challenge_token, "codigo": codigo},
        )
        assert resp.status_code == 200, resp.text
        final_body = resp.json()
        assert final_body["access_token"]
        assert final_body["user"]["email"] == GESTOR_EMAIL
    finally:
        # Sempre desativa no final, mesmo se alguma asserção falhar no meio.
        await client.post("/v1/auth/mfa/disable", json={"senha": GESTOR_SENHA}, headers=headers)


async def test_mfa_disable_exige_senha_correta(client, gestor_token):
    headers = {"Authorization": f"Bearer {gestor_token}"}

    resp = await client.post("/v1/auth/mfa/enroll", headers=headers)
    secret = resp.json()["secret"]
    codigo = pyotp.TOTP(secret).now()
    await client.post("/v1/auth/mfa/confirm", json={"codigo": codigo}, headers=headers)

    try:
        resp = await client.post("/v1/auth/mfa/disable", json={"senha": "senha-errada"}, headers=headers)
        assert resp.status_code == 401
    finally:
        await client.post("/v1/auth/mfa/disable", json={"senha": GESTOR_SENHA}, headers=headers)


async def test_mfa_enroll_com_mfa_ativo_exige_senha_e_nao_desativa(client, gestor_token):
    """B031: reiniciar o enroll com MFA já ativo não pode derrubar o MFA sem senha."""
    headers = {"Authorization": f"Bearer {gestor_token}"}

    resp = await client.post("/v1/auth/mfa/enroll", headers=headers)
    secret_original = resp.json()["secret"]
    codigo = pyotp.TOTP(secret_original).now()
    await client.post("/v1/auth/mfa/confirm", json={"codigo": codigo}, headers=headers)

    try:
        # Sem senha (ou senha errada): enroll é rejeitado e o MFA ativo não é tocado.
        resp = await client.post("/v1/auth/mfa/enroll", json={"senha": "senha-errada"}, headers=headers)
        assert resp.status_code == 401

        resp = await client.post("/v1/auth/mfa/enroll", headers=headers)
        assert resp.status_code == 401

        # Login por senha continua exigindo o desafio de MFA (não foi desativado).
        resp = await client.post("/v1/auth/login", json={"email": GESTOR_EMAIL, "senha": GESTOR_SENHA})
        assert resp.status_code == 200
        assert resp.json().get("mfa_required") is True

        # Com a senha correta, reinicia o enroll — mas o MFA antigo segue ativo até confirmar o novo.
        resp = await client.post("/v1/auth/mfa/enroll", json={"senha": GESTOR_SENHA}, headers=headers)
        assert resp.status_code == 200, resp.text
        novo_secret = resp.json()["secret"]
        assert novo_secret != secret_original

        resp = await client.post("/v1/auth/login", json={"email": GESTOR_EMAIL, "senha": GESTOR_SENHA})
        assert resp.json().get("mfa_required") is True

        # Confirma o novo secret e verifica que o login final exige o novo código (não o antigo).
        novo_codigo = pyotp.TOTP(novo_secret).now()
        resp = await client.post("/v1/auth/mfa/confirm", json={"codigo": novo_codigo}, headers=headers)
        assert resp.status_code == 200, resp.text
    finally:
        await client.post("/v1/auth/mfa/disable", json={"senha": GESTOR_SENHA}, headers=headers)
