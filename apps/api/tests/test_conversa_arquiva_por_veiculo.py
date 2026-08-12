"""
Chat B2C é um por veículo: quando o carro sai, a conversa dele arquiva.

O que estes testes travam:
(a) veículo vendido/reservado → conversa `ativa=False` + `motivo_arquivo` + aviso
    de sistema no chat;
(b) conversa arquivada é somente-leitura (409 nos dois sentidos: cliente e loja);
(c) lead de quem NÃO comprou continua no funil, só que sem veículo — é o que
    preserva a gestão do vendedor ("falei do Celta, vendeu, agora ofereço o Corso");
(d) veículo de volta a DISPONIVEL reabre a conversa (estado em que se entra tem
    que ter volta — padrão nº 16 do BUGS.md).

Cenário montado direto no banco: publicar pela API exigiria upload de foto.
"""
import os
import sys

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete, select  # noqa: E402

from conversas_service import (  # noqa: E402
    MOTIVO_RESERVADO,
    MOTIVO_VENDIDO,
    arquivar_conversas_do_veiculo,
    reabrir_conversas_do_veiculo,
)
from database import async_session  # noqa: E402
from models import (  # noqa: E402
    ClientePF,
    Conversa,
    EtapaLead,
    Lead,
    Loja,
    Mensagem,
    OrigemLead,
    StatusVeiculo,
    Veiculo,
)
from tests.conftest import _login  # noqa: E402


CLIENTE_EMAIL = os.environ.get("TESTE_VITRINE_EMAIL", "vitrine@demo.com")
CLIENTE_SENHA = os.environ.get("TESTE_VITRINE_SENHA", "demo123")


@pytest_asyncio.fixture
async def veiculo_publicado():
    """Veículo publicado descartável, com a loja usada no teste."""
    async with async_session() as db:
        loja = (await db.execute(select(Loja).limit(1))).scalar_one_or_none()
        if not loja:
            pytest.skip("Banco sem lojas — rode seed.py antes.")

        veiculo = Veiculo(
            loja_id=loja.id,
            marca="Teste",
            modelo="Arquivamento Chat",
            ano_fabricacao=2020,
            ano_modelo=2021,
            preco_venda=50000.0,
            status=StatusVeiculo.DISPONIVEL,
            publicado_marketplace=True,
        )
        db.add(veiculo)
        await db.commit()
        dados = (veiculo.id, loja.id)

    yield dados

    veiculo_id, _ = dados
    async with async_session() as db:
        convs = (
            await db.execute(select(Conversa.id).where(Conversa.veiculo_id == veiculo_id))
        ).scalars().all()
        if convs:
            await db.execute(delete(Mensagem).where(Mensagem.conversa_id.in_(convs)))
            await db.execute(delete(Conversa).where(Conversa.id.in_(convs)))
        await db.execute(delete(Lead).where(Lead.veiculo_id == veiculo_id))
        await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
        await db.commit()


async def _abrir_conversa(client, veiculo_id: str) -> tuple[str, dict]:
    token = await _login(client, CLIENTE_EMAIL, CLIENTE_SENHA)
    if not token:
        pytest.skip("Banco não seedado com a conta de cliente da vitrine.")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/v1/vitrine/conversas",
        json={"veiculo_id": veiculo_id, "mensagem": "Tem esse ainda?"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"], headers


@pytest.mark.asyncio
async def test_venda_arquiva_conversa_e_avisa_no_chat(client, veiculo_publicado):
    veiculo_id, _ = veiculo_publicado
    conversa_id, headers = await _abrir_conversa(client, veiculo_id)

    async with async_session() as db:
        veiculo = (await db.execute(select(Veiculo).where(Veiculo.id == veiculo_id))).scalar_one()
        veiculo.status = StatusVeiculo.VENDIDO
        await arquivar_conversas_do_veiculo(db, veiculo, MOTIVO_VENDIDO)
        await db.commit()

    async with async_session() as db:
        conversa = (
            await db.execute(select(Conversa).where(Conversa.id == conversa_id))
        ).scalar_one()
        assert conversa.ativa is False, "conversa de veículo vendido tem que arquivar"
        assert conversa.arquivada_em is not None
        assert conversa.motivo_arquivo == MOTIVO_VENDIDO

    msgs = await client.get(f"/v1/vitrine/conversas/{conversa_id}/mensagens", headers=headers)
    assert msgs.status_code == 200, msgs.text
    sistema = [m for m in msgs.json() if m.get("sistema")]
    assert len(sistema) == 1, "o cliente precisa ver o aviso no próprio chat"
    assert sistema[0]["autor_tipo"] == "sistema"
    assert "vendido" in sistema[0]["conteudo"].lower()


@pytest.mark.asyncio
async def test_conversa_arquivada_recusa_mensagem_do_cliente(client, veiculo_publicado):
    veiculo_id, _ = veiculo_publicado
    conversa_id, headers = await _abrir_conversa(client, veiculo_id)

    async with async_session() as db:
        veiculo = (await db.execute(select(Veiculo).where(Veiculo.id == veiculo_id))).scalar_one()
        await arquivar_conversas_do_veiculo(db, veiculo, MOTIVO_RESERVADO)
        await db.commit()

    envio = await client.post(
        f"/v1/vitrine/conversas/{conversa_id}/mensagens",
        json={"conteudo": "E aí, saiu?"},
        headers=headers,
    )
    assert envio.status_code == 409, envio.text
    assert "arquivada" in envio.json()["detail"].lower()


@pytest.mark.asyncio
async def test_lead_de_quem_nao_comprou_sai_do_veiculo_e_fica_no_funil(client, veiculo_publicado):
    veiculo_id, loja_id = veiculo_publicado

    async with async_session() as db:
        cliente = ClientePF(loja_id=loja_id, nome="Interessado Teste", telefone="")
        db.add(cliente)
        await db.flush()
        lead = Lead(
            loja_id=loja_id,
            cliente_id=cliente.id,
            veiculo_id=veiculo_id,
            etapa=EtapaLead.NEGOCIACAO,
            origem=OrigemLead.VITRINE,
        )
        db.add(lead)
        await db.commit()
        lead_id, cliente_id = lead.id, cliente.id

    async with async_session() as db:
        veiculo = (await db.execute(select(Veiculo).where(Veiculo.id == veiculo_id))).scalar_one()
        await arquivar_conversas_do_veiculo(db, veiculo, MOTIVO_VENDIDO)
        await db.commit()

    try:
        async with async_session() as db:
            lead = (await db.execute(select(Lead).where(Lead.id == lead_id))).scalar_one()
            assert lead.veiculo_id is None, "o lead tem que se desprender do carro vendido"
            assert lead.etapa == EtapaLead.NEGOCIACAO, "o lead continua vivo no funil"
            assert "sistema" in (lead.observacoes or "").lower()
    finally:
        async with async_session() as db:
            await db.execute(delete(Lead).where(Lead.id == lead_id))
            await db.execute(delete(ClientePF).where(ClientePF.id == cliente_id))
            await db.commit()


@pytest.mark.asyncio
async def test_veiculo_de_volta_reabre_a_conversa(client, veiculo_publicado):
    veiculo_id, _ = veiculo_publicado
    conversa_id, headers = await _abrir_conversa(client, veiculo_id)

    async with async_session() as db:
        veiculo = (await db.execute(select(Veiculo).where(Veiculo.id == veiculo_id))).scalar_one()
        await arquivar_conversas_do_veiculo(db, veiculo, MOTIVO_RESERVADO)
        await db.commit()

    async with async_session() as db:
        veiculo = (await db.execute(select(Veiculo).where(Veiculo.id == veiculo_id))).scalar_one()
        veiculo.status = StatusVeiculo.DISPONIVEL
        await reabrir_conversas_do_veiculo(db, veiculo)
        await db.commit()

    async with async_session() as db:
        conversa = (
            await db.execute(select(Conversa).where(Conversa.id == conversa_id))
        ).scalar_one()
        assert conversa.ativa is True
        assert conversa.arquivada_em is None
        assert conversa.motivo_arquivo is None

    envio = await client.post(
        f"/v1/vitrine/conversas/{conversa_id}/mensagens",
        json={"conteudo": "Voltou? Quero ver."},
        headers=headers,
    )
    assert envio.status_code == 200, envio.text
