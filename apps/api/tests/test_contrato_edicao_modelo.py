"""Edição do modelo de um contrato já criado.

Contratos nascidos sem `template_id` (é o caso de tudo que o app do celular
gerava) ficavam presos ao layout legado: o PATCH aceitava o campo, respondia
200 e descartava em silêncio, porque `ContratoUpdateRequest` não o declarava.
"""
import uuid
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, TemplateContrato, Contrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def _cenario(nome_loja: str, conteudo_html: str, campos_extras: str | None = None):
    """Cria loja + gestor + modelo e devolve (ids, headers)."""
    loja_id, gestor_id, membro_id, template_id = _uid(), _uid(), _uid(), _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome=nome_loja, slug=f"{nome_loja.lower().replace(' ', '-')}-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        db.add(TemplateContrato(
            id=template_id, loja_id=loja_id, nome=f"Modelo {nome_loja}",
            conteudo_html=conteudo_html, campos_extras=campos_extras, ativo=True,
        ))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value, "typ": "access"})
    return (loja_id, gestor_id, membro_id, template_id), {"Authorization": f"Bearer {token}"}


async def _limpar(loja_id: str, gestor_id: str, membro_id: str):
    async with async_session() as db:
        await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
        await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
        await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
        await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
        await db.execute(delete(Loja).where(Loja.id == loja_id))
        await db.commit()


@pytest.mark.asyncio
async def test_patch_anexa_modelo_e_documento_passa_a_usar(client):
    (loja_id, gestor_id, membro_id, template_id), headers = await _cenario(
        "Loja Anexa",
        "<p>MODELO DO LOJISTA — garantia de {{garantia_meses}} meses</p>",
        '[{"chave": "garantia_meses", "label": "Meses de garantia", "padrao": "3"}]',
    )

    try:
        # Contrato criado sem modelo, como o app fazia.
        criado = await client.post(
            "/v1/contratos", json={"tipo": "compra_venda", "valor_venda": 50000}, headers=headers
        )
        assert criado.status_code == 201, criado.text
        contrato_id = criado.json()["id"]
        assert criado.json()["template_id"] is None

        antes = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert "MODELO DO LOJISTA" not in antes.text

        # Edição: anexa o modelo e preenche o campo dele.
        patch = await client.patch(
            f"/v1/contratos/{contrato_id}",
            json={"template_id": template_id, "dados_extras": {"garantia_meses": "12"}},
            headers=headers,
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["template_id"] == template_id
        assert patch.json()["dados_extras"] == {"garantia_meses": "12"}

        depois = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert "MODELO DO LOJISTA" in depois.text
        assert "garantia de 12 meses" in depois.text
    finally:
        await _limpar(loja_id, gestor_id, membro_id)


@pytest.mark.asyncio
async def test_patch_sem_dados_extras_usa_padrao_do_modelo(client):
    (loja_id, gestor_id, membro_id, template_id), headers = await _cenario(
        "Loja Padrao",
        "<p>Garantia de {{garantia_meses}} meses</p>",
        '[{"chave": "garantia_meses", "label": "Meses de garantia", "padrao": "3"}]',
    )

    try:
        criado = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers)
        contrato_id = criado.json()["id"]

        patch = await client.patch(
            f"/v1/contratos/{contrato_id}", json={"template_id": template_id}, headers=headers
        )
        assert patch.status_code == 200, patch.text

        pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert "Garantia de 3 meses" in pdf.text
    finally:
        await _limpar(loja_id, gestor_id, membro_id)


@pytest.mark.asyncio
async def test_patch_desvincula_modelo_com_template_id_nulo(client):
    (loja_id, gestor_id, membro_id, template_id), headers = await _cenario(
        "Loja Desvincula", "<p>MODELO DO LOJISTA</p>"
    )

    try:
        criado = await client.post(
            "/v1/contratos",
            json={"tipo": "compra_venda", "template_id": template_id},
            headers=headers,
        )
        contrato_id = criado.json()["id"]
        assert "MODELO DO LOJISTA" in (await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)).text

        patch = await client.patch(
            f"/v1/contratos/{contrato_id}", json={"template_id": None}, headers=headers
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["template_id"] is None

        pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers)
        assert "MODELO DO LOJISTA" not in pdf.text
        assert "CONTRATO DE COMPRA E VENDA DE VEÍCULO" in pdf.text
    finally:
        await _limpar(loja_id, gestor_id, membro_id)


@pytest.mark.asyncio
async def test_patch_recusa_modelo_de_outra_loja(client):
    (loja_a, gestor_a, membro_a, _), headers_a = await _cenario("Loja A", "<p>Modelo da A</p>")
    (loja_b, gestor_b, membro_b, template_b), _ = await _cenario("Loja B", "<p>Modelo da B</p>")

    try:
        criado = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers_a)
        contrato_id = criado.json()["id"]

        # Gestor da loja A tentando usar o modelo da loja B.
        patch = await client.patch(
            f"/v1/contratos/{contrato_id}", json={"template_id": template_b}, headers=headers_a
        )
        assert patch.status_code == 404, patch.text

        pdf = await client.get(f"/v1/contratos/{contrato_id}/pdf", headers=headers_a)
        assert "Modelo da B" not in pdf.text
    finally:
        await _limpar(loja_a, gestor_a, membro_a)
        await _limpar(loja_b, gestor_b, membro_b)
