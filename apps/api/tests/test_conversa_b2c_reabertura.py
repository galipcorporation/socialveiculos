"""
Reabrir o chat de um veículo não pode reenviar a saudação inicial.

Bug de campo: no mobile/vitrine, tocar em "Conversar" num anúncio que já tinha
conversa criava outra vez a mensagem "Olá, tenho interesse...". O POST
/v1/vitrine/conversas já reaproveitava a conversa, mas inseria a mensagem
inicial incondicionalmente.

O cenário é montado direto no banco: o banco de dev pode não ter nenhum veículo
publicado, e publicar pela API exigiria upload de foto.
"""
import os
import sys

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete, select  # noqa: E402

from database import async_session  # noqa: E402
from models import Conversa, Loja, Mensagem, StatusVeiculo, Veiculo  # noqa: E402
from tests.conftest import _login  # noqa: E402


CLIENTE_EMAIL = os.environ.get("TESTE_VITRINE_EMAIL", "vitrine@demo.com")
CLIENTE_SENHA = os.environ.get("TESTE_VITRINE_SENHA", "demo123")


@pytest_asyncio.fixture
async def veiculo_publicado():
    """Cria um veículo publicado descartável e o remove no fim."""
    async with async_session() as db:
        loja = (await db.execute(select(Loja).limit(1))).scalar_one_or_none()
        if not loja:
            pytest.skip("Banco sem lojas — rode seed.py antes.")

        veiculo = Veiculo(
            loja_id=loja.id,
            marca="Teste",
            modelo="Reabertura Chat",
            ano_fabricacao=2020,
            ano_modelo=2021,
            preco_venda=50000.0,
            status=StatusVeiculo.DISPONIVEL,
            publicado_marketplace=True,
        )
        db.add(veiculo)
        await db.commit()
        veiculo_id = veiculo.id

    yield veiculo_id

    async with async_session() as db:
        convs = (
            await db.execute(select(Conversa.id).where(Conversa.veiculo_id == veiculo_id))
        ).scalars().all()
        if convs:
            await db.execute(delete(Mensagem).where(Mensagem.conversa_id.in_(convs)))
            await db.execute(delete(Conversa).where(Conversa.id.in_(convs)))
        await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
        await db.commit()


@pytest.mark.asyncio
async def test_reabrir_conversa_nao_duplica_saudacao(client, veiculo_publicado):
    token = await _login(client, CLIENTE_EMAIL, CLIENTE_SENHA)
    if not token:
        pytest.skip("Banco não seedado com a conta de cliente da vitrine.")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"veiculo_id": veiculo_publicado, "mensagem": "Olá, tenho interesse."}

    primeira = await client.post("/v1/vitrine/conversas", json=payload, headers=headers)
    assert primeira.status_code == 201, primeira.text
    conversa_id = primeira.json()["id"]

    msgs_antes = await client.get(f"/v1/vitrine/conversas/{conversa_id}/mensagens", headers=headers)
    assert msgs_antes.status_code == 200, msgs_antes.text
    total_antes = len(msgs_antes.json())
    assert total_antes == 1, "a primeira abertura deve gravar a saudação"

    # Segundo "Conversar" no mesmo veículo: mesma conversa, nenhuma mensagem nova.
    segunda = await client.post("/v1/vitrine/conversas", json=payload, headers=headers)
    assert segunda.status_code == 201, segunda.text
    assert segunda.json()["id"] == conversa_id, "deveria reaproveitar a conversa existente"

    msgs_depois = await client.get(f"/v1/vitrine/conversas/{conversa_id}/mensagens", headers=headers)
    assert msgs_depois.status_code == 200, msgs_depois.text
    assert len(msgs_depois.json()) == total_antes, (
        "reabrir a conversa duplicou a mensagem inicial"
    )


@pytest.mark.asyncio
async def test_reabrir_conversa_devolve_ultima_mensagem_real(client, veiculo_publicado):
    """O preview da conversa reaberta não pode 'voltar no tempo' para a saudação."""
    token = await _login(client, CLIENTE_EMAIL, CLIENTE_SENHA)
    if not token:
        pytest.skip("Banco não seedado com a conta de cliente da vitrine.")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"veiculo_id": veiculo_publicado, "mensagem": "Olá, tenho interesse."}
    primeira = await client.post("/v1/vitrine/conversas", json=payload, headers=headers)
    assert primeira.status_code == 201, primeira.text
    conversa_id = primeira.json()["id"]

    envio = await client.post(
        f"/v1/vitrine/conversas/{conversa_id}/mensagens",
        json={"conteudo": "Ainda está disponível?"},
        headers=headers,
    )
    assert envio.status_code == 200, envio.text

    segunda = await client.post("/v1/vitrine/conversas", json=payload, headers=headers)
    assert segunda.status_code == 201, segunda.text
    assert segunda.json()["ultima_mensagem"] == "Ainda está disponível?"
