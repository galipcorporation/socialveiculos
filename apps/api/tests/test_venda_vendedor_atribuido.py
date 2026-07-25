"""
Atribuição do vendedor responsável na venda (B088).

Antes do fix, o `POST /veiculos/{id}/vender` sempre creditava a comissão a
`ctx.usuario.id`: o gestor que registrava a venda de um vendedor ficava com a
comissão, enquanto o app mobile exibia o nome (e o %) de outra pessoa.

Cobre:
  (a) gestor atribui a venda a um vendedor → ComissaoVenda e EsteiraPosVenda
      ficam com o vendedor atribuído, e o percentual é o DELE (override do
      membro), não o de quem registrou;
  (b) vendedor tentando atribuir a venda a outra pessoa → 403, e nada é gravado;
  (c) vendedor_id de outra loja → rejeitado (isolamento multi-tenant / IDOR),
      e nada é gravado;
  (d) sem vendedor_id → comportamento histórico preservado (credita a quem
      registrou), garantindo a compatibilidade com clientes antigos.
"""
import uuid

import pytest
from sqlalchemy import delete, select

from database import async_session
from models import (
    ClientePF, ComissaoVenda, Contrato, EsteiraPosVenda, ItemChecklist,
    LancamentoFinanceiro, Loja, MembroLoja, PapelUsuario, StatusVeiculo,
    Usuario, Veiculo,
)
from tests.conftest import _login

VENDEDOR_EMAIL = "carlos@autopremium.com.br"
VENDEDOR_SENHA = "demo123"

# % distintos de propósito: se o backend usar o membro errado, o valor da
# comissão sai diferente e o assert quebra.
PCT_VENDEDOR = 3.0
PCT_LOJA_PADRAO = 9.0


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _sufixo() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture
async def vendedor_token(client):
    token = await _login(client, VENDEDOR_EMAIL, VENDEDOR_SENHA)
    if not token:
        pytest.skip("Banco não seedado com o vendedor demo — rode seed.py antes.")
    return token


async def _criar_veiculo(client, token: str, preco_venda: float) -> dict:
    resp = await client.post(
        "/v1/veiculos",
        headers=_auth(token),
        json={
            "marca": "TESTE-B088",
            "modelo": f"Atribuicao {_sufixo()}",
            "ano_fabricacao": 2020,
            "ano_modelo": 2021,
            "preco_venda": preco_venda,
        },
    )
    assert resp.status_code in (200, 201), f"Falha ao criar veículo: {resp.status_code} {resp.text}"
    return resp.json()


async def _limpar_venda(veiculo_id: str, resultado: dict | None, cliente_nome: str | None = None):
    """Remove tudo que a venda criou (ordem respeita FKs)."""
    async with async_session() as db:
        contrato_id = (resultado or {}).get("contrato_id")
        esteira_id = (resultado or {}).get("esteira_id")
        trocas_ids = (resultado or {}).get("trocas_veiculo_ids") or []

        if esteira_id:
            await db.execute(delete(ItemChecklist).where(ItemChecklist.esteira_id == esteira_id))
            await db.execute(delete(EsteiraPosVenda).where(EsteiraPosVenda.id == esteira_id))
        await db.execute(delete(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo_id))
        await db.execute(delete(LancamentoFinanceiro).where(LancamentoFinanceiro.veiculo_id == veiculo_id))
        for tid in trocas_ids:
            await db.execute(delete(Veiculo).where(Veiculo.id == tid))
        if contrato_id:
            await db.execute(delete(Contrato).where(Contrato.id == contrato_id))
        await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
        if cliente_nome:
            await db.execute(delete(ClientePF).where(ClientePF.nome == cliente_nome))
        await db.commit()


async def _preparar_percentuais(client, gestor_token: str, vendedor_usuario_id: str) -> float | None:
    """Fixa % da loja e override do vendedor. Devolve o % anterior do membro."""
    r_cfg = await client.patch(
        "/v1/configuracoes/loja",
        headers=_auth(gestor_token),
        json={"percentual_comissao_padrao": PCT_LOJA_PADRAO},
    )
    assert r_cfg.status_code == 200, r_cfg.text

    equipe = await client.get("/v1/equipe", headers=_auth(gestor_token))
    assert equipe.status_code == 200, equipe.text
    membro = next(m for m in equipe.json() if m["usuario_id"] == vendedor_usuario_id)
    anterior = membro["percentual_comissao"]

    r_pct = await client.patch(
        f"/v1/equipe/{membro['id']}",
        headers=_auth(gestor_token),
        json={"percentual_comissao": PCT_VENDEDOR},
    )
    assert r_pct.status_code == 200, r_pct.text
    assert r_pct.json()["percentual_comissao"] == PCT_VENDEDOR
    return anterior


async def _restaurar_percentual(client, gestor_token: str, vendedor_usuario_id: str, valor):
    equipe = await client.get("/v1/equipe", headers=_auth(gestor_token))
    if equipe.status_code != 200:
        return
    membro = next((m for m in equipe.json() if m["usuario_id"] == vendedor_usuario_id), None)
    if not membro:
        return
    await client.patch(
        f"/v1/equipe/{membro['id']}",
        headers=_auth(gestor_token),
        json={"percentual_comissao": valor},
    )


@pytest.mark.asyncio
async def test_gestor_atribui_venda_a_vendedor(client, gestor_token, vendedor_token):
    """(a) Comissão e esteira vão para o vendedor atribuído, com o % DELE."""
    me = await client.get("/v1/auth/me", headers=_auth(vendedor_token))
    assert me.status_code == 200, me.text
    vendedor_usuario_id = me.json()["id"]

    me_gestor = await client.get("/v1/auth/me", headers=_auth(gestor_token))
    assert me_gestor.status_code == 200, me_gestor.text
    gestor_usuario_id = me_gestor.json()["id"]
    assert gestor_usuario_id != vendedor_usuario_id

    pct_anterior = await _preparar_percentuais(client, gestor_token, vendedor_usuario_id)

    valor_venda = 50000.0
    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=valor_venda)
    cliente_nome = f"Cliente B088 Atribuido {_sufixo()}"
    resultado = None

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=_auth(gestor_token),
            json={
                "cliente_novo": {"nome": cliente_nome},
                "valor_venda": valor_venda,
                "pagamento_dinheiro": valor_venda,
                "vendedor_id": vendedor_usuario_id,
            },
        )
        assert resp.status_code == 200, f"Venda atribuída falhou: {resp.status_code} {resp.text}"
        resultado = resp.json()

        async with async_session() as db:
            comissao = (await db.execute(
                select(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo["id"])
            )).scalar_one()
            assert comissao.vendedor_id == vendedor_usuario_id, \
                "comissão foi creditada a quem registrou a venda, não ao vendedor atribuído"
            # O % é o override do vendedor, não o padrão da loja nem o do gestor
            assert comissao.percentual == PCT_VENDEDOR
            assert comissao.valor_comissao == round(valor_venda * PCT_VENDEDOR / 100.0, 2)

            esteira = (await db.execute(
                select(EsteiraPosVenda).where(EsteiraPosVenda.id == resultado["esteira_id"])
            )).scalar_one()
            assert esteira.vendedor_id == vendedor_usuario_id, \
                "esteira pós-venda ficou com o registrador em vez do vendedor atribuído"
    finally:
        await _limpar_venda(veiculo["id"], resultado, cliente_nome)
        await _restaurar_percentual(client, gestor_token, vendedor_usuario_id, pct_anterior)


@pytest.mark.asyncio
async def test_vendedor_nao_atribui_venda_a_outro(client, gestor_token, vendedor_token):
    """(b) Vendedor mandando vendedor_id de outra pessoa → 403 e nada gravado."""
    me_gestor = await client.get("/v1/auth/me", headers=_auth(gestor_token))
    assert me_gestor.status_code == 200, me_gestor.text
    gestor_usuario_id = me_gestor.json()["id"]

    # O veículo é criado pelo gestor (mesma loja); a venda é tentada pelo vendedor.
    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=30000.0)
    cliente_nome = f"Cliente B088 Negado {_sufixo()}"

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=_auth(vendedor_token),
            json={
                "cliente_novo": {"nome": cliente_nome},
                "valor_venda": 30000.0,
                "vendedor_id": gestor_usuario_id,
            },
        )
        assert resp.status_code == 403, f"Esperava 403, veio {resp.status_code}: {resp.text}"

        async with async_session() as db:
            intacto = (await db.execute(
                select(Veiculo).where(Veiculo.id == veiculo["id"])
            )).scalar_one()
            assert intacto.status != StatusVeiculo.VENDIDO, "veículo foi vendido apesar do 403"

            comissoes = (await db.execute(
                select(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo["id"])
            )).scalars().all()
            assert comissoes == [], "comissão foi gravada apesar do 403"

            cliente = (await db.execute(
                select(ClientePF).where(ClientePF.nome == cliente_nome)
            )).scalar_one_or_none()
            assert cliente is None, "cliente foi criado apesar do 403"
    finally:
        await _limpar_venda(veiculo["id"], None, cliente_nome)


@pytest.mark.asyncio
async def test_vendedor_de_outra_loja_rejeitado(client, gestor_token):
    """(c) vendedor_id existente mas de OUTRA loja → rejeitado (IDOR)."""
    loja_outra_id = uuid.uuid4().hex[:32]
    usuario_outro_id = uuid.uuid4().hex[:32]
    membro_outro_id = uuid.uuid4().hex[:32]

    async with async_session() as db:
        db.add(Loja(
            id=loja_outra_id,
            nome="Loja Outra (B088)",
            slug=f"loja-b088-{loja_outra_id[:8]}",
        ))
        db.add(Usuario(
            id=usuario_outro_id,
            nome="Vendedor de Outra Loja",
            email=f"vendedor_b088_{usuario_outro_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.VENDEDOR,
            ativo=True,
        ))
        db.add(MembroLoja(
            id=membro_outro_id,
            usuario_id=usuario_outro_id,
            loja_id=loja_outra_id,
            papel=PapelUsuario.VENDEDOR,
            ativo=True,
        ))
        await db.commit()

    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=25000.0)
    cliente_nome = f"Cliente B088 Vazamento {_sufixo()}"

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=_auth(gestor_token),
            json={
                "cliente_novo": {"nome": cliente_nome},
                "valor_venda": 25000.0,
                "vendedor_id": usuario_outro_id,
            },
        )
        assert resp.status_code in (400, 404), \
            f"vendedor de outra loja foi aceito ({resp.status_code}): {resp.text}"

        async with async_session() as db:
            intacto = (await db.execute(
                select(Veiculo).where(Veiculo.id == veiculo["id"])
            )).scalar_one()
            assert intacto.status != StatusVeiculo.VENDIDO

            # Nenhuma comissão cruzando o tenant
            comissoes = (await db.execute(
                select(ComissaoVenda).where(ComissaoVenda.vendedor_id == usuario_outro_id)
            )).scalars().all()
            assert comissoes == [], "comissão criada para vendedor de outra loja"
    finally:
        await _limpar_venda(veiculo["id"], None, cliente_nome)
        async with async_session() as db:
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_outro_id))
            await db.execute(delete(Usuario).where(Usuario.id == usuario_outro_id))
            await db.execute(delete(Loja).where(Loja.id == loja_outra_id))
            await db.commit()


@pytest.mark.asyncio
async def test_sem_vendedor_id_credita_quem_registrou(client, gestor_token):
    """(d) Compatibilidade: sem vendedor_id, credita quem registrou (comportamento antigo)."""
    me_gestor = await client.get("/v1/auth/me", headers=_auth(gestor_token))
    assert me_gestor.status_code == 200, me_gestor.text
    gestor_usuario_id = me_gestor.json()["id"]

    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=20000.0)
    cliente_nome = f"Cliente B088 Legado {_sufixo()}"
    resultado = None

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=_auth(gestor_token),
            json={"cliente_novo": {"nome": cliente_nome}, "valor_venda": 20000.0},
        )
        assert resp.status_code == 200, resp.text
        resultado = resp.json()

        async with async_session() as db:
            comissao = (await db.execute(
                select(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo["id"])
            )).scalar_one()
            assert comissao.vendedor_id == gestor_usuario_id
    finally:
        await _limpar_venda(veiculo["id"], resultado, cliente_nome)
