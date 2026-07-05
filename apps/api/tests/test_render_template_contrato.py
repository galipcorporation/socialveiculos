"""Garante que contratos sem template_id continuam usando o gerador legado,
e que contratos com template_id usam o motor Jinja2 novo."""
import uuid
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, TemplateContrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


@pytest.mark.asyncio
async def test_contrato_sem_template_usa_gerador_legado(client):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Legado", slug=f"loja-legado-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp_contrato = await client.post(
            "/v1/contratos", json={"tipo": "garantia", "valor_venda": 50000}, headers=headers
        )
        assert resp_contrato.status_code == 201, resp_contrato.text
        contrato_id = resp_contrato.json()["id"]

        resp_pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert resp_pdf.status_code == 200
        assert "TERMO DE GARANTIA DE VEÍCULO" in resp_pdf.text
        assert "CLÁUSULAS" in resp_pdf.text
    finally:
        async with async_session() as db:
            from models import Contrato
            await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()


@pytest.mark.asyncio
async def test_contrato_com_template_usa_jinja2(client):
    loja_id = _uid()
    gestor_id = _uid()
    membro_id = _uid()
    template_id = _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Nova", slug=f"loja-nova-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        db.add(TemplateContrato(
            id=template_id, loja_id=loja_id, nome="Modelo Custom",
            conteudo_html="<p>Contrato {{contrato.numero}} — Garantia: {{garantia_meses}} meses</p>",
            campos_extras='[{"chave": "garantia_meses", "label": "Meses de garantia"}]',
            ativo=True,
        ))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp_contrato = await client.post(
            "/v1/contratos",
            json={
                "tipo": "consignacao",
                "valor_venda": 50000,
                "template_id": template_id,
                "dados_extras": {"garantia_meses": "12"},
            },
            headers=headers,
        )
        assert resp_contrato.status_code == 201, resp_contrato.text
        contrato_id = resp_contrato.json()["id"]

        resp_pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert resp_pdf.status_code == 200
        assert "Garantia: 12 meses" in resp_pdf.text
        assert "CLÁUSULAS" not in resp_pdf.text  # não usou o gerador legado
    finally:
        async with async_session() as db:
            from models import Contrato
            await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
            await db.execute(delete(TemplateContrato).where(TemplateContrato.id == template_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()
