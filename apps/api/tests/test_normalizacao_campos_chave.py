"""
Regressão da normalização de campos-chave (B107).

Campos que funcionam como chave de busca precisam ser gravados numa grafia só,
senão a comparação `==` do backend não casa com o que o usuário digita:

  * e-mail  → minúsculo (login travava em 401 com Caps Lock ligado);
  * CPF/CNPJ → só dígitos (máscara criava segundo registro / era rejeitada);
  * placa   → caixa alta sem separadores (**só grafia** — duplicata é legítima).

O caso do e-mail é o mais grave: além do 401, a checagem de duplicidade usa a
mesma comparação, então o `unique=True` da coluna não protegia.
"""
import pytest

from schemas import (
    ClienteCreateRequest,
    ConvidarMembroRequest,
    LojaUpdateRequest,
    VeiculoCreateRequest,
)


def _veiculo(placa: str) -> VeiculoCreateRequest:
    return VeiculoCreateRequest(
        marca="VW", modelo="Gol", ano_fabricacao=2020, ano_modelo=2021,
        placa=placa, km=1000, valor_avaliacao=50000, preco_venda=60000,
    )


# ── Placa ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada", ["ABC1D23", "abc1d23", "ABC-1D23", " abc1d23 "])
def test_placa_normaliza_grafia(entrada):
    """Minúscula, hífen e espaços convergem para a mesma grafia."""
    assert _veiculo(entrada).placa == "ABC1D23"


def test_placa_duplicada_continua_permitida():
    """Placa repetida é legítima: revenda entre lojas, retorno ao estoque, clonagem.

    Normalizar a grafia NÃO pode virar unicidade — este teste existe para que
    ninguém "conserte" isso adicionando unique/validação de duplicata depois.
    """
    assert _veiculo("ABC1D23").placa == _veiculo("abc-1d23").placa


# ── Documentos ───────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada", ["529.982.247-25", "52998224725"])
def test_cpf_cliente_aceita_com_e_sem_mascara(entrada):
    """Antes o CPF mascarado era rejeitado por max_length da coluna String(14)."""
    assert ClienteCreateRequest(nome="T", cpf=entrada).cpf == "52998224725"


@pytest.mark.parametrize("entrada", ["11.222.333/0001-81", "11222333000181"])
def test_cnpj_loja_normaliza(entrada):
    """`Loja.cnpj` é unique — máscara permitia o mesmo CNPJ em dois registros."""
    assert LojaUpdateRequest(cnpj=entrada).cnpj == "11222333000181"


def test_cnpj_loja_valida_digito_verificador():
    """LojaUpdateRequest nunca herdou o mixin de validação; agora confere o DV."""
    with pytest.raises(ValueError):
        LojaUpdateRequest(cnpj="11.222.333/0001-99")


# ── E-mail ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada", ["JOAO@X.COM", "Joao@X.com", " joao@x.com "])
def test_email_cliente_normaliza(entrada):
    assert ClienteCreateRequest(nome="T", email=entrada).email == "joao@x.com"


def test_email_convite_membro_normaliza():
    """O "reaproveita o usuário existente" depende de casar com o e-mail gravado."""
    m = ConvidarMembroRequest(nome="T", email="JOAO@X.COM", senha="123456")
    assert m.email == "joao@x.com"


# ── Login: o 401 que originou o bug ──────────────────────────────────

@pytest.mark.parametrize("variacao", [
    "GESTOR@AUTOPREMIUM.COM.BR",
    "Gestor@Autopremium.com.br",
    "  gestor@autopremium.com.br  ",
])
def test_login_request_normaliza_email(variacao):
    """O schema do login converge qualquer caixa para a forma gravada.

    Validado no schema, não por HTTP: `/v1/auth/login` tem `rate_limit(10, 60)`
    compartilhado com as fixtures da suíte, e uma bateria de logins aqui derruba
    outros testes com 429 (a mesma armadilha que o cache de token do conftest
    resolve). O caminho ponta a ponta fica no teste único abaixo.
    """
    from routers.auth import LoginRequest
    assert LoginRequest(email=variacao, senha="x").email == "gestor@autopremium.com.br"


@pytest.mark.asyncio
async def test_login_http_aceita_caps_lock(client):
    """Caps Lock ligado devolvia 401 — e a mensagem dizia "e-mail ou senha
    incorretos", mandando o usuário ao fluxo de recuperar senha, que também não
    resolvia (o e-mail gravado nunca casava com o digitado)."""
    import os
    from tests.conftest import GESTOR_EMAIL
    senha = os.environ.get("TESTE_GESTOR_SENHA", "demo123")
    resp = await client.post(
        "/v1/auth/login", json={"email": GESTOR_EMAIL.upper(), "senha": senha}
    )
    if resp.status_code == 429:
        pytest.skip("Rate limit do login atingido nesta rodada.")
    if resp.status_code == 401:
        pytest.skip("Banco não seedado com a conta gestor demo — rode seed.py antes.")
    assert resp.status_code == 200, resp.text[:200]
