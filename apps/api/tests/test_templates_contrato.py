"""Testes de CRUD e isolamento multi-tenant de templates de contrato."""
import uuid
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, TemplateContrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def _criar_loja_e_gestor(db):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"
    db.add(Loja(id=loja_id, nome="Loja Templates", slug=f"loja-tpl-{loja_id[:8]}"))
    db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
    db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
    await db.commit()
    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    return loja_id, gestor_id, membro_id, token


@pytest.mark.asyncio
async def test_crud_template_contrato(client):
    async with async_session() as db:
        loja_id, gestor_id, membro_id, token = await _criar_loja_e_gestor(db)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Criar
        resp = await client.post(
            "/v1/templates-contrato",
            json={
                "nome": "Modelo Teste",
                "conteudo_html": "<p>{{cliente.nome}} compra {{veiculo.marca}}</p>",
                "campos_extras": [{"chave": "garantia_meses", "label": "Meses de garantia"}],
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        template_id = resp.json()["id"]
        assert resp.json()["campos_extras"][0]["chave"] == "garantia_meses"

        # Listar
        resp_list = await client.get("/v1/templates-contrato", headers=headers)
        assert resp_list.status_code == 200
        assert any(t["id"] == template_id for t in resp_list.json()["items"])

        # Editar
        resp_patch = await client.patch(
            f"/v1/templates-contrato/{template_id}",
            json={"nome": "Modelo Editado"},
            headers=headers,
        )
        assert resp_patch.status_code == 200
        assert resp_patch.json()["nome"] == "Modelo Editado"

        # Duplicar
        resp_dup = await client.post(f"/v1/templates-contrato/{template_id}/duplicar", headers=headers)
        assert resp_dup.status_code == 201
        assert resp_dup.json()["id"] != template_id

        # Excluir (soft delete)
        resp_del = await client.delete(f"/v1/templates-contrato/{template_id}", headers=headers)
        assert resp_del.status_code == 204

        resp_list2 = await client.get("/v1/templates-contrato", headers=headers)
        assert not any(t["id"] == template_id for t in resp_list2.json()["items"])
    finally:
        async with async_session() as db:
            await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()


@pytest.mark.asyncio
async def test_template_contrato_isolamento_tenant(client):
    """Gestor da loja A não pode ler/editar/excluir template da loja B."""
    async with async_session() as db:
        loja_a_id, gestor_a_id, membro_a_id, token_a = await _criar_loja_e_gestor(db)

        loja_b_id = _uid()
        template_b_id = _uid()
        db.add(Loja(id=loja_b_id, nome="Loja B Templates", slug=f"loja-b-tpl-{loja_b_id[:8]}"))
        db.add(TemplateContrato(
            id=template_b_id, loja_id=loja_b_id, nome="Template B",
            conteudo_html="<p>segredo da loja B</p>", campos_extras=None, ativo=True,
        ))
        await db.commit()

    headers = {"Authorization": f"Bearer {token_a}"}
    try:
        resp_get = await client.get(f"/v1/templates-contrato/{template_b_id}", headers=headers)
        assert resp_get.status_code == 404

        resp_patch = await client.patch(
            f"/v1/templates-contrato/{template_b_id}", json={"nome": "hack"}, headers=headers
        )
        assert resp_patch.status_code == 404

        resp_del = await client.delete(f"/v1/templates-contrato/{template_b_id}", headers=headers)
        assert resp_del.status_code == 404
    finally:
        async with async_session() as db:
            await db.execute(delete(TemplateContrato).where(TemplateContrato.id == template_b_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()
