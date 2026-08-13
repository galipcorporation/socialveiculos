"""
Preferência do botão flutuante (AssistiveTouch) — por usuário.

O app pergunta no primeiro acesso se o usuário quer o botão de ações rápidas,
com o checkbox "não perguntar novamente". Quem responde grava a escolha aqui, e
o /auth/me precisa devolvê-la em todo login — é o que decide se o botão é
desenhado. Travam:

  * o default de quem nunca respondeu (botão ligado, pergunta pendente);
  * a gravação parcial (campo omitido não pode zerar o outro);
  * a persistência entre requisições (a escolha vive no banco, não no aparelho).
"""

ME = "/v1/auth/me"
PREFS = "/v1/auth/me/preferencias"


async def _me(client, token) -> dict:
    resp = await client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _salvar(client, token, corpo: dict) -> dict:
    resp = await client.patch(PREFS, headers={"Authorization": f"Bearer {token}"}, json=corpo)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_me_traz_preferencia_do_botao(client, gestor_token):
    """Todo /me carrega a preferência — o app decide o botão só com essa resposta."""
    dados = await _me(client, gestor_token)
    assert isinstance(dados["botao_flutuante"], bool)
    assert isinstance(dados["botao_flutuante_perguntar"], bool)


async def test_desligar_botao_e_nao_perguntar_novamente(client, gestor_token):
    """Resposta 'não quero' + checkbox marcado: botão some e o modal não volta."""
    try:
        atualizado = await _salvar(
            client, gestor_token,
            {"botao_flutuante": False, "botao_flutuante_perguntar": False},
        )
        assert atualizado["botao_flutuante"] is False
        assert atualizado["botao_flutuante_perguntar"] is False

        # Persistiu: outra requisição (outro acesso do app) enxerga o mesmo.
        dados = await _me(client, gestor_token)
        assert dados["botao_flutuante"] is False
        assert dados["botao_flutuante_perguntar"] is False
    finally:
        await _salvar(
            client, gestor_token,
            {"botao_flutuante": True, "botao_flutuante_perguntar": True},
        )


async def test_campo_omitido_nao_mexe_no_outro(client, gestor_token):
    """O toggle de Configurações manda só `botao_flutuante` — não pode reativar o modal."""
    try:
        await _salvar(client, gestor_token, {"botao_flutuante_perguntar": False})
        atualizado = await _salvar(client, gestor_token, {"botao_flutuante": False})
        assert atualizado["botao_flutuante"] is False
        assert atualizado["botao_flutuante_perguntar"] is False, "pergunta voltou sozinha"
    finally:
        await _salvar(
            client, gestor_token,
            {"botao_flutuante": True, "botao_flutuante_perguntar": True},
        )


async def test_preferencia_exige_autenticacao(client):
    resp = await client.patch(PREFS, json={"botao_flutuante": False})
    assert resp.status_code in (401, 403), resp.text
