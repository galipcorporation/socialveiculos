"""
Testes da edição de usuários pelo painel admin (/v1/admin/usuarios/*).

Travam o bug que originou a feature:
  * vendedor com vínculo ATIVO em duas lojas quebrava o login com 500
    (scalar_one_or_none → MultipleResultsFound em auth.py). Era exatamente o
    caso do usuário que aparecia na aba Usuários como "Anacar, Auto Premium".

E o comportamento novo da edição pelo painel:
  * PATCH /usuarios/{id} — nome/email/telefone/papel/ativo, e-mail duplicado → 409;
  * POST /usuarios/{id}/vinculos — vincula a loja, repetido → 409;
  * PATCH .../vinculos/{membro_id} — troca papel / desativa;
  * DELETE .../vinculos/{membro_id} — tira o usuário da loja errada.
"""
import uuid

import pytest
import pytest_asyncio


SENHA = "teste123"


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _lojas(client, admin_token) -> list:
    resp = await client.get("/v1/admin/lojas", headers=_h(admin_token))
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _achar_usuario(client, admin_token, email: str) -> dict | None:
    resp = await client.get(f"/v1/admin/usuarios?busca={email}", headers=_h(admin_token))
    assert resp.status_code == 200, resp.text
    return next((u for u in resp.json() if u["email"] == email), None)


@pytest_asyncio.fixture
async def vendedor_multiloja(client, admin_token, _vendedor_criado):
    """Repõe os dois vínculos do vendedor de teste antes de cada teste.

    O usuário é criado uma única vez (`_vendedor_criado`): `register-b2c` tem
    rate_limit(10, 60) e um cadastro por teste estourava 429 — a mesma armadilha
    que o cache de token do conftest resolve para o login.
    """
    uid = _vendedor_criado["id"]
    lojas = _vendedor_criado["lojas"]

    atual = await _achar_usuario(client, admin_token, _vendedor_criado["email"])
    assert atual, "usuário de teste sumiu da busca do admin"
    for v in atual["vinculos"]:
        await client.delete(
            f"/v1/admin/usuarios/{uid}/vinculos/{v['membro_id']}", headers=_h(admin_token)
        )
    await client.patch(
        f"/v1/admin/usuarios/{uid}",
        headers=_h(admin_token),
        json={"nome": "Vendedor Multiloja", "papel": "vendedor"},
    )
    for loja in lojas:
        resp = await client.post(
            f"/v1/admin/usuarios/{uid}/vinculos",
            headers=_h(admin_token),
            json={"loja_id": loja["id"], "papel": "vendedor"},
        )
        assert resp.status_code == 200, resp.text

    return _vendedor_criado


@pytest_asyncio.fixture(scope="module")
async def _vendedor_criado(client, admin_token):
    """Cria um vendedor de teste uma vez por módulo e o deixa sem vínculos no fim."""
    lojas = await _lojas(client, admin_token)
    if len(lojas) < 2:
        pytest.skip("Precisa de ao menos duas lojas seedadas para testar multi-loja.")

    email = f"vendedor-multiloja-{uuid.uuid4().hex[:8]}@teste-sv.com"
    resp = await client.post(
        "/v1/auth/register-b2c",
        json={"nome": "Vendedor Multiloja", "email": email, "senha": SENHA},
    )
    assert resp.status_code in (200, 201), resp.text

    usuario = await _achar_usuario(client, admin_token, email)
    assert usuario, "usuário recém-criado não apareceu na busca do admin"
    uid = usuario["id"]

    resp = await client.patch(
        f"/v1/admin/usuarios/{uid}", headers=_h(admin_token), json={"papel": "vendedor"}
    )
    assert resp.status_code == 200, resp.text

    yield {"id": uid, "email": email, "lojas": lojas[:2]}

    # Limpa só os vínculos DESTE usuário de teste — nunca toca em conta seedada.
    atual = await _achar_usuario(client, admin_token, email)
    if atual:
        assert atual["email"] == email, "guarda: limpeza só pode agir no usuário do fixture"
        for v in atual["vinculos"]:
            await client.delete(
                f"/v1/admin/usuarios/{uid}/vinculos/{v['membro_id']}", headers=_h(admin_token)
            )


# ── O bug do 500 ───────────────────────────────────────────────

async def test_login_com_duas_lojas_ativas_nao_da_500(client, vendedor_multiloja):
    """Regressão: MultipleResultsFound em _emitir_sessao_login virava 500."""
    resp = await client.post(
        "/v1/auth/login", json={"email": vendedor_multiloja["email"], "senha": SENHA}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["papel"] == "vendedor"
    # Entra por uma das lojas vinculadas (a mais antiga), nunca sem loja.
    assert body["user"]["loja_id"] in {l["id"] for l in vendedor_multiloja["lojas"]}


async def test_usuario_lista_os_dois_vinculos(client, admin_token, vendedor_multiloja):
    u = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    assert len(u["vinculos"]) == 2
    assert all(v["papel"] == "vendedor" and v["ativo"] for v in u["vinculos"])


# ── Edição de vínculo ──────────────────────────────────────────

async def test_remover_vinculo_tira_usuario_da_loja(client, admin_token, vendedor_multiloja):
    uid = vendedor_multiloja["id"]
    u = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    alvo = u["vinculos"][1]

    resp = await client.delete(
        f"/v1/admin/usuarios/{uid}/vinculos/{alvo['membro_id']}", headers=_h(admin_token)
    )
    assert resp.status_code == 200, resp.text

    depois = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    assert [v["loja_id"] for v in depois["vinculos"]] == [u["vinculos"][0]["loja_id"]]


async def test_trocar_papel_no_vinculo(client, admin_token, vendedor_multiloja):
    uid = vendedor_multiloja["id"]
    u = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    membro_id = u["vinculos"][0]["membro_id"]

    resp = await client.patch(
        f"/v1/admin/usuarios/{uid}/vinculos/{membro_id}",
        headers=_h(admin_token),
        json={"papel": "gestor"},
    )
    assert resp.status_code == 200, resp.text

    depois = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    alvo = next(v for v in depois["vinculos"] if v["membro_id"] == membro_id)
    assert alvo["papel"] == "gestor"


async def test_vinculo_duplicado_da_409(client, admin_token, vendedor_multiloja):
    resp = await client.post(
        f"/v1/admin/usuarios/{vendedor_multiloja['id']}/vinculos",
        headers=_h(admin_token),
        json={"loja_id": vendedor_multiloja["lojas"][0]["id"], "papel": "vendedor"},
    )
    assert resp.status_code == 409, resp.text


async def test_papel_invalido_da_422(client, admin_token, vendedor_multiloja):
    resp = await client.post(
        f"/v1/admin/usuarios/{vendedor_multiloja['id']}/vinculos",
        headers=_h(admin_token),
        json={"loja_id": vendedor_multiloja["lojas"][0]["id"], "papel": "chefe"},
    )
    assert resp.status_code == 422, resp.text


# ── Edição dos dados da conta ──────────────────────────────────

async def test_editar_nome_e_telefone(client, admin_token, vendedor_multiloja):
    uid = vendedor_multiloja["id"]
    resp = await client.patch(
        f"/v1/admin/usuarios/{uid}",
        headers=_h(admin_token),
        json={"nome": "Nome Corrigido", "telefone": "51999998888"},
    )
    assert resp.status_code == 200, resp.text

    u = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    assert u["nome"] == "Nome Corrigido"
    assert u["telefone"] == "51999998888"


async def test_email_duplicado_da_409(client, admin_token, vendedor_multiloja):
    """E-mail é a chave de login (UNIQUE): não pode virar 500 de integridade."""
    resp = await client.patch(
        f"/v1/admin/usuarios/{vendedor_multiloja['id']}",
        headers=_h(admin_token),
        json={"email": "gestor@autopremium.com.br"},
    )
    assert resp.status_code == 409, resp.text


async def test_vinculo_para_loja_removida_nao_some_com_usuario(client, admin_token, vendedor_multiloja):
    """LEFT JOIN: vínculo órfão (loja apagada) some com o usuário da lista no
    INNER JOIN — justo o registro quebrado que o admin precisa achar pra corrigir."""
    u = await _achar_usuario(client, admin_token, vendedor_multiloja["email"])
    assert u is not None
    assert len(u["vinculos"]) == 2


async def test_usuario_inexistente_da_404(client, admin_token):
    resp = await client.patch(
        "/v1/admin/usuarios/nao-existe", headers=_h(admin_token), json={"nome": "Fulano"}
    )
    assert resp.status_code == 404, resp.text


# ── Autorização ────────────────────────────────────────────────

async def test_gestor_nao_edita_usuarios(client, gestor_token, vendedor_multiloja):
    resp = await client.patch(
        f"/v1/admin/usuarios/{vendedor_multiloja['id']}",
        headers=_h(gestor_token),
        json={"nome": "Invasor"},
    )
    assert resp.status_code in (401, 403), resp.text


async def test_sem_token_nao_edita(client, vendedor_multiloja):
    resp = await client.patch(
        f"/v1/admin/usuarios/{vendedor_multiloja['id']}", json={"nome": "Anon"}
    )
    assert resp.status_code in (401, 403), resp.text
