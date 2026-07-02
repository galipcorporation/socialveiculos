"""Smoke tests — a API sobe e as rotas essenciais estão montadas.

As asserções introspectam o schema OpenAPI (``app.openapi()["paths"]``), e não
``app.routes``: a partir do FastAPI 0.139 o ``include_router`` passou a registrar
um wrapper interno (``_IncludedRouter``) em ``app.routes`` em vez de expandir cada
endpoint, então ``len(app.routes)`` e ``route.path`` deixaram de refletir os
endpoints reais. O schema OpenAPI continua sendo a fonte de verdade dos paths
efetivamente montados, independentemente da versão do FastAPI.
"""


def test_app_importa_e_tem_rotas():
    from main import app
    paths = app.openapi()["paths"]
    assert len(paths) > 50, "Esperado o conjunto completo de rotas registradas."


def test_rotas_criticas_presentes():
    from main import app
    paths = app.openapi()["paths"]
    assert "/v1/auth/login" in paths
    assert "/v1/admin/lojas" in paths


async def test_openapi_responde(client):
    resp = await client.get("/v1/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"]
