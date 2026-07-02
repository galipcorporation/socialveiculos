"""
Testes de regressão do acesso de suporte multi-loja.

Travam os bugs históricos que derrubavam a conta admin:
  * B021 — papel legado 'ADMIN' quebrava o login (LookupError → 500).
  * B015/B016 — get_current_b2b_user re-inseria vínculo membro_loja duplicado
    (UNIQUE constraint → 500) ao acessar rotas de credenciais como admin.

E o comportamento novo do modelo de suporte:
  * admin sem X-Loja-Id → 409 (front abre o seletor);
  * admin com X-Loja-Id válido → 200;
  * admin com X-Loja-Id inexistente → 404;
  * gestor/vendedor ignoram o header (não vazam tenant).
"""

CRED_BANCO = "/v1/configuracoes/credenciais_banco"
CRED_IA = "/v1/configuracoes/credenciais-ia"


# ── B021 / login do admin ──────────────────────────────────────

async def test_admin_loga_sem_500(admin_token):
    # Se o fixture chegou até aqui, o login retornou 200 (papel legado corrigido).
    assert admin_token


async def test_admin_papel_e_admin_plataforma(client, admin_token):
    resp = await client.post(
        "/v1/auth/login",
        json={"email": "victorbelocorreia@gmail.com", "senha": "admin123"},
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["papel"] == "admin_plataforma"


# ── B015/B016 + modelo multi-loja ──────────────────────────────

async def test_admin_sem_loja_recebe_409(client, admin_token):
    """Sem X-Loja-Id o admin não deve dar 500 nem retornar dados — deve pedir loja."""
    resp = await client.get(CRED_BANCO, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 409, resp.text


async def _primeira_loja(client, admin_token) -> str:
    resp = await client.get("/v1/admin/lojas", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200, resp.text
    lojas = resp.json()
    assert lojas, "Banco precisa ter ao menos uma loja seedada."
    return lojas[0]["id"]


async def test_admin_com_loja_recebe_200(client, admin_token):
    loja_id = await _primeira_loja(client, admin_token)
    headers = {"Authorization": f"Bearer {admin_token}", "X-Loja-Id": loja_id}
    assert (await client.get(CRED_BANCO, headers=headers)).status_code == 200
    assert (await client.get(CRED_IA, headers=headers)).status_code == 200


async def test_admin_loja_inexistente_recebe_404(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}", "X-Loja-Id": "loja-que-nao-existe"}
    resp = await client.get(CRED_BANCO, headers=headers)
    assert resp.status_code == 404, resp.text


# ── Regressão: gestor normal continua funcionando ──────────────

async def test_gestor_sem_header_funciona(client, gestor_token):
    resp = await client.get(CRED_BANCO, headers={"Authorization": f"Bearer {gestor_token}"})
    assert resp.status_code == 200, resp.text


async def test_gestor_ignora_header_de_loja_alheia(client, gestor_token):
    """Gestor não pode trocar de tenant via header — o backend deve ignorá-lo."""
    resp = await client.get(
        CRED_BANCO,
        headers={"Authorization": f"Bearer {gestor_token}", "X-Loja-Id": "outra-loja"},
    )
    assert resp.status_code == 200, resp.text
