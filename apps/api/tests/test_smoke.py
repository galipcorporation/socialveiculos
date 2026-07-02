"""Smoke tests — a API sobe e as rotas essenciais estão montadas."""


def test_app_importa_e_tem_rotas():
    from main import app
    assert len(app.routes) > 50, "Esperado o conjunto completo de rotas registradas."


def test_rotas_criticas_presentes():
    from main import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/v1/auth/login" in paths
    assert "/v1/admin/lojas" in paths


async def test_openapi_responde(client):
    resp = await client.get("/v1/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"]
