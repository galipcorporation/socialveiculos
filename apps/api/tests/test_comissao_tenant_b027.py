"""
Regressão do B027 — POST /v1/financeiro/comissoes não pode referenciar
veículo/vendedor de outra loja (nem id inexistente).

Contexto: `criar_comissao` deriva a comissão a partir de `valor_venda × percentual`
e herda `loja_id` do contexto autenticado. Antes do fix (Execução #16), os campos
`veiculo_id`/`vendedor_id` do corpo eram persistidos SEM checagem de tenant — um
gestor da loja A conseguia atribuir a comissão a um veículo/vendedor da loja B
(ou a um id inexistente, pois a FK é ON DELETE SET NULL e o SQLite não força FK),
corrompendo atribuição de comissão, relatórios e ranking de vendedores.

Este teste é autossuficiente (cria seus próprios tenants/usuários), no mesmo
padrão de `test_tenant_isolation.py`. Verificado ao vivo na Execução #17.
"""
import uuid

import pytest
from sqlalchemy import delete

from database import async_session
from models import (
    Loja,
    Veiculo,
    Usuario,
    MembroLoja,
    ComissaoVenda,
    PapelUsuario,
    StatusVeiculo,
)
from auth import create_access_token


def _uid() -> str:
    return uuid.uuid4().hex[:32]


@pytest.mark.asyncio
async def test_criar_comissao_cross_tenant_404(client):
    """Gestor da loja A não pode criar comissão apontando para veículo/vendedor da loja B,
    nem para id inexistente. Caminho feliz (sem referências) segue 201."""
    loja_a_id = _uid()
    gestor_a_id = _uid()
    membro_a_id = _uid()

    loja_b_id = _uid()
    veiculo_b_id = _uid()
    vendedor_b_id = _uid()
    membro_b_id = _uid()

    async with async_session() as db:
        # Loja A + Gestor A (solicitante)
        db.add(Loja(id=loja_a_id, nome="Loja A (B027)", slug=f"loja-a-{loja_a_id[:8]}"))
        db.add(Usuario(
            id=gestor_a_id, nome="Gestor A",
            email=f"gestor_a_{gestor_a_id[:8]}@teste.com",
            senha_hash="hash_fake", papel=PapelUsuario.GESTOR, ativo=True,
        ))
        db.add(MembroLoja(
            id=membro_a_id, usuario_id=gestor_a_id, loja_id=loja_a_id,
            papel=PapelUsuario.GESTOR, ativo=True,
        ))

        # Loja B + veículo B + vendedor B (membro da B)
        db.add(Loja(id=loja_b_id, nome="Loja B (B027)", slug=f"loja-b-{loja_b_id[:8]}"))
        db.add(Veiculo(
            id=veiculo_b_id, loja_id=loja_b_id, marca="Fiat", modelo="Argo",
            ano_fabricacao=2021, ano_modelo=2022, km=20000,
            preco_venda=70000.0, preco_custo=55000.0, status=StatusVeiculo.DISPONIVEL,
        ))
        db.add(Usuario(
            id=vendedor_b_id, nome="Vendedor B",
            email=f"vendedor_b_{vendedor_b_id[:8]}@teste.com",
            senha_hash="hash_fake", papel=PapelUsuario.VENDEDOR, ativo=True,
        ))
        db.add(MembroLoja(
            id=membro_b_id, usuario_id=vendedor_b_id, loja_id=loja_b_id,
            papel=PapelUsuario.VENDEDOR, ativo=True,
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_a_id, "email": f"gestor_a_{gestor_a_id[:8]}@teste.com",
              "papel": PapelUsuario.GESTOR.value}
    )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # 1. veículo de outra loja -> 404
        r = await client.post("/v1/financeiro/comissoes", headers=headers, json={
            "veiculo_id": veiculo_b_id, "valor_venda": 70000.0, "percentual": 2.0,
        })
        assert r.status_code == 404, (
            f"Vazamento: comissão aceitou veículo de outra loja -> {r.status_code} {r.text}"
        )

        # 2. vendedor de outra loja -> 404
        r = await client.post("/v1/financeiro/comissoes", headers=headers, json={
            "vendedor_id": vendedor_b_id, "valor_venda": 70000.0, "percentual": 2.0,
        })
        assert r.status_code == 404, (
            f"Vazamento: comissão aceitou vendedor de outra loja -> {r.status_code} {r.text}"
        )

        # 3. id inexistente -> 404
        r = await client.post("/v1/financeiro/comissoes", headers=headers, json={
            "veiculo_id": _uid(), "valor_venda": 70000.0, "percentual": 2.0,
        })
        assert r.status_code == 404, (
            f"Comissão aceitou veiculo_id inexistente -> {r.status_code} {r.text}"
        )

        # 4. caminho feliz (sem referências cruzadas) -> 201
        r = await client.post("/v1/financeiro/comissoes", headers=headers, json={
            "valor_venda": 50000.0, "percentual": 3.0,
        })
        assert r.status_code == 201, (
            f"Caminho feliz da comissão quebrou -> {r.status_code} {r.text}"
        )
        assert round(r.json()["valor_comissao"], 2) == 1500.0
    finally:
        async with async_session() as db:
            await db.execute(delete(ComissaoVenda).where(ComissaoVenda.loja_id.in_([loja_a_id, loja_b_id])))
            await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_b_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id.in_([membro_a_id, membro_b_id])))
            await db.execute(delete(Usuario).where(Usuario.id.in_([gestor_a_id, vendedor_b_id])))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()
