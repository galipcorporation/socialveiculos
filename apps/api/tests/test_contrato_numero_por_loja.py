"""Numeração de contrato é por loja.

`gerar_numero_contrato` sempre numerou por loja (CV-2026-0001 em cada uma), mas
a coluna tinha unique global: a segunda loja a emitir o primeiro contrato do ano
levava IntegrityError e o gestor via 500 ao tentar criar o contrato.
"""
import uuid
import pytest
from sqlalchemy import delete

from database import async_session
from models import Loja, Usuario, MembroLoja, PapelUsuario, Contrato
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def _loja_com_gestor(nome: str):
    loja_id, gestor_id, membro_id = _uid(), _uid(), _uid()
    email = f"gestor_{gestor_id[:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome=nome, slug=f"num-{loja_id[:8]}"))
        db.add(Usuario(id=gestor_id, nome="Gestor", email=email, senha_hash="hash", papel=PapelUsuario.GESTOR, ativo=True))
        db.add(MembroLoja(id=membro_id, usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR, ativo=True))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email, "papel": PapelUsuario.GESTOR.value, "typ": "access"})
    return (loja_id, gestor_id, membro_id), {"Authorization": f"Bearer {token}"}


async def _limpar(loja_id: str, gestor_id: str, membro_id: str):
    async with async_session() as db:
        await db.execute(delete(Contrato).where(Contrato.loja_id == loja_id))
        await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
        await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
        await db.execute(delete(Loja).where(Loja.id == loja_id))
        await db.commit()


@pytest.mark.asyncio
async def test_duas_lojas_emitem_o_mesmo_numero_sem_conflito(client):
    (loja_a, gestor_a, membro_a), headers_a = await _loja_com_gestor("Loja Num A")
    (loja_b, gestor_b, membro_b), headers_b = await _loja_com_gestor("Loja Num B")

    try:
        a = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers_a)
        b = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers_b)

        assert a.status_code == 201, a.text
        assert b.status_code == 201, b.text
        # Cada loja tem sua própria sequência: o mesmo número nas duas é o certo.
        assert a.json()["numero"] == b.json()["numero"]
    finally:
        await _limpar(loja_a, gestor_a, membro_a)
        await _limpar(loja_b, gestor_b, membro_b)


@pytest.mark.asyncio
async def test_sequencia_avanca_dentro_da_loja(client):
    (loja_id, gestor_id, membro_id), headers = await _loja_com_gestor("Loja Num Seq")

    try:
        emitidos = []
        for _ in range(3):
            resp = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers)
            assert resp.status_code == 201, resp.text
            emitidos.append(resp.json())

        assert [c["numero"][-4:] for c in emitidos] == ["0001", "0002", "0003"]

        # Some o do meio: contar contratos faria o próximo voltar para 0003, que
        # ainda está vivo — colisão. Continuar do maior número emitido não erra.
        async with async_session() as db:
            await db.execute(delete(Contrato).where(Contrato.id == emitidos[1]["id"]))
            await db.commit()

        quarto = await client.post("/v1/contratos", json={"tipo": "compra_venda"}, headers=headers)
        assert quarto.status_code == 201, quarto.text
        assert quarto.json()["numero"].endswith("-0004")
    finally:
        await _limpar(loja_id, gestor_id, membro_id)
