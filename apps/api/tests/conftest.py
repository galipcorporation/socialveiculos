"""
Fixtures de teste da API Social Veículos.

Os testes rodam contra o banco de desenvolvimento seedado (o mesmo usado pelo
app), via ASGITransport — sem subir servidor HTTP real. Exercem o fluxo de
autenticação de ponta a ponta, que é onde moram os bugs históricos (B015/B016/B021).

Requer que o seed já tenha rodado (contas admin/gestor demo). Se o banco não
estiver seedado, os testes que dependem disso são pulados com mensagem clara.
"""
import asyncio
import os
import sys

import pytest
import pytest_asyncio

# Garante que os módulos da API (main, deps, ...) sejam importáveis.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx  # noqa: E402
from httpx import ASGITransport  # noqa: E402

from main import app  # noqa: E402


ADMIN_EMAIL = "victorbelocorreia@gmail.com"
ADMIN_SENHA = os.environ.get("OWNER_SENHA", "admin123")
GESTOR_EMAIL = "gestor@autopremium.com.br"
GESTOR_SENHA = "demo123"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


_token_cache: dict[str, str] = {}


async def _login(client: httpx.AsyncClient, email: str, senha: str) -> str | None:
    """Faz login e devolve o access_token, ou None se a conta não existir/senha errada.

    Cacheia o token por e-mail durante a sessão de testes: o login tem
    rate_limit(5/60s) e cada fixture refazia login — a partir do 6º teste vinha
    429 e os testes skipavam com mensagem enganosa de "banco não seedado".
    """
    if email in _token_cache:
        return _token_cache[email]
    resp = await client.post("/v1/auth/login", json={"email": email, "senha": senha})
    if resp.status_code != 200:
        return None
    token = resp.json().get("access_token")
    if token:
        _token_cache[email] = token
    return token


@pytest_asyncio.fixture
async def admin_token(client):
    token = await _login(client, ADMIN_EMAIL, ADMIN_SENHA)
    if not token:
        pytest.skip("Banco não seedado com a conta admin — rode seed.py antes.")
    return token


@pytest_asyncio.fixture
async def gestor_token(client):
    token = await _login(client, GESTOR_EMAIL, GESTOR_SENHA)
    if not token:
        pytest.skip("Banco não seedado com a conta gestor demo — rode seed.py antes.")
    return token
