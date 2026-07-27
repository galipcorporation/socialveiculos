"""
Integrador de anúncios em portais (M079) — Fases 1 e 2.

Cobre o que não pode quebrar em silêncio:
(a) portal sem API nunca finge que publicou;
(b) venda tira o veículo do ar e vira baixa_pendente onde não há API;
(c) cancelamento da venda reverte;
(d) isolamento multi-tenant (loja A não enxerga nem baixa anúncio da loja B).
"""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from auth import create_access_token
from database import async_session
from models import (
    AnuncioPortal,
    Assinatura,
    Loja,
    MembroLoja,
    ModuloHabilitado,
    PapelUsuario,
    Plano,
    StatusAssinatura,
    StatusVeiculo,
    Usuario,
    Veiculo,
)


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def _criar_loja_com_marketing(nome: str) -> dict:
    """Loja + gestor + assinatura ativa + módulo marketing (gate do integrador)."""
    ids = {k: _uid() for k in ("loja", "gestor", "membro", "plano", "assinatura", "modulo", "veiculo")}
    email = f"gestor_{ids['gestor'][:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(id=ids["loja"], nome=nome, slug=f"{nome.lower().replace(' ', '-')}-{ids['loja'][:8]}"))
        db.add(Usuario(
            id=ids["gestor"], nome=f"Gestor {nome}", email=email, senha_hash="hash",
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        db.add(MembroLoja(
            id=ids["membro"], usuario_id=ids["gestor"], loja_id=ids["loja"],
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        db.add(Plano(
            id=ids["plano"], nome=f"Plano {ids['plano'][:6]}", preco_mensal=299.90,
            modulos_incluidos='["marketing"]', ativo=True,
        ))
        db.add(Assinatura(
            id=ids["assinatura"], loja_id=ids["loja"], plano_id=ids["plano"],
            status=StatusAssinatura.ATIVA, valor_mensal=299.90,
        ))
        db.add(ModuloHabilitado(
            id=ids["modulo"], loja_id=ids["loja"], nome_modulo="marketing", ativo=True,
        ))
        db.add(Veiculo(
            id=ids["veiculo"], loja_id=ids["loja"], marca="Fiat", modelo="Argo",
            ano_fabricacao=2020, ano_modelo=2021, preco_venda=65000.0,
            status=StatusVeiculo.DISPONIVEL, km=30000,
        ))
        await db.commit()

    token = create_access_token(data={
        "sub": ids["gestor"], "email": email, "papel": PapelUsuario.GESTOR.value,
    })
    ids["headers"] = {"Authorization": f"Bearer {token}"}
    return ids


async def _limpar(ids: dict) -> None:
    async with async_session() as db:
        await db.execute(delete(AnuncioPortal).where(AnuncioPortal.loja_id == ids["loja"]))
        await db.execute(delete(Veiculo).where(Veiculo.loja_id == ids["loja"]))
        await db.execute(delete(ModuloHabilitado).where(ModuloHabilitado.loja_id == ids["loja"]))
        await db.execute(delete(Assinatura).where(Assinatura.id == ids["assinatura"]))
        await db.execute(delete(Plano).where(Plano.id == ids["plano"]))
        await db.execute(delete(MembroLoja).where(MembroLoja.id == ids["membro"]))
        await db.execute(delete(Usuario).where(Usuario.id == ids["gestor"]))
        await db.execute(delete(Loja).where(Loja.id == ids["loja"]))
        await db.commit()


@pytest_asyncio.fixture
async def loja_a():
    ids = await _criar_loja_com_marketing("Loja A Anuncios")
    yield ids
    await _limpar(ids)


@pytest_asyncio.fixture
async def loja_b():
    ids = await _criar_loja_com_marketing("Loja B Anuncios")
    yield ids
    await _limpar(ids)


# ══════════════════════════════════════════════════════════════
# CATÁLOGO DE PORTAIS
# ══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_portais_expoem_disponibilidade_honesta(client, loja_a):
    """Portal sem API precisa se declarar indisponível, com motivo."""
    r = await client.get("/v1/anuncios/portais", headers=loja_a["headers"])
    assert r.status_code == 200

    portais = {p["nome"]: p for p in r.json()}
    assert {"facebook", "instagram", "mercadolivre", "olx", "webmotors", "icarros"} <= set(portais)

    assert portais["facebook"]["disponivel"] is True
    for nome in ("webmotors", "icarros", "olx", "mercadolivre"):
        assert portais[nome]["disponivel"] is False, f"{nome} não deveria estar disponível"
        assert portais[nome]["motivo"], f"{nome} precisa explicar por que não dá"


@pytest.mark.asyncio
async def test_publicar_em_portal_sem_api_nao_enfileira(client, loja_a):
    """Não basta falhar: não pode nem entrar na fila fingindo que vai publicar."""
    r = await client.post(
        "/v1/anuncios/publicar",
        headers=loja_a["headers"],
        json={"veiculo_ids": [loja_a["veiculo"]], "portais": ["webmotors"]},
    )
    assert r.status_code == 200
    assert r.json()["enfileirados"] == 0
    assert any("Webmotors" in i for i in r.json()["ignorados"])


@pytest.mark.asyncio
async def test_publicar_veiculo_sem_preco_e_recusado(client, loja_a):
    async with async_session() as db:
        v = (await db.execute(select(Veiculo).where(Veiculo.id == loja_a["veiculo"]))).scalar_one()
        v.preco_venda = None
        await db.commit()

    r = await client.post(
        "/v1/anuncios/publicar",
        headers=loja_a["headers"],
        json={"veiculo_ids": [loja_a["veiculo"]], "portais": ["facebook"]},
    )
    assert r.status_code == 200
    assert r.json()["enfileirados"] == 0
    assert any("preço" in i.lower() for i in r.json()["ignorados"])


# ══════════════════════════════════════════════════════════════
# GANCHO DE VENDA — o requisito nº 1 (TDD §3.4)
# ══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_venda_gera_baixa_pendente_em_portal_sem_api(loja_a):
    """Vendeu: portal com API entra na fila; portal sem API vira baixa manual."""
    from anuncios_service import enfileirar_sync_veiculo

    async with async_session() as db:
        db.add(AnuncioPortal(
            id=_uid(), loja_id=loja_a["loja"], veiculo_id=loja_a["veiculo"],
            portal="webmotors", status="publicado",
        ))
        db.add(AnuncioPortal(
            id=_uid(), loja_id=loja_a["loja"], veiculo_id=loja_a["veiculo"],
            portal="facebook", status="publicado",
        ))
        await db.commit()

        veiculo = (await db.execute(
            select(Veiculo).where(Veiculo.id == loja_a["veiculo"])
        )).scalar_one()
        veiculo.status = StatusVeiculo.VENDIDO
        await enfileirar_sync_veiculo(db, veiculo, "despublicar")
        await db.commit()

        anuncios = {
            a.portal: a for a in (await db.execute(
                select(AnuncioPortal).where(AnuncioPortal.veiculo_id == loja_a["veiculo"])
            )).scalars().all()
        }

    assert anuncios["webmotors"].status == "baixa_pendente"
    assert anuncios["webmotors"].erro, "baixa pendente precisa dizer o que fazer"
    assert anuncios["facebook"].status == "sincronizando"
    assert anuncios["facebook"].acao_pendente == "despublicar"


@pytest.mark.asyncio
async def test_cancelar_venda_reverte(loja_a):
    """Venda cancelada republica onde a venda tinha derrubado."""
    from anuncios_service import enfileirar_sync_veiculo

    async with async_session() as db:
        db.add(AnuncioPortal(
            id=_uid(), loja_id=loja_a["loja"], veiculo_id=loja_a["veiculo"],
            portal="facebook", status="despublicado",
        ))
        await db.commit()

        veiculo = (await db.execute(
            select(Veiculo).where(Veiculo.id == loja_a["veiculo"])
        )).scalar_one()
        await enfileirar_sync_veiculo(db, veiculo, "publicar")
        await db.commit()

        anuncio = (await db.execute(
            select(AnuncioPortal).where(AnuncioPortal.veiculo_id == loja_a["veiculo"])
        )).scalar_one()

    assert anuncio.status == "sincronizando"
    assert anuncio.acao_pendente == "publicar"


@pytest.mark.asyncio
async def test_pendencias_e_confirmar_baixa(client, loja_a):
    """O ciclo completo da baixa manual: aparece na lista e some ao confirmar."""
    anuncio_id = _uid()
    async with async_session() as db:
        db.add(AnuncioPortal(
            id=anuncio_id, loja_id=loja_a["loja"], veiculo_id=loja_a["veiculo"],
            portal="webmotors", status="baixa_pendente",
            erro="Remova manualmente do site da Webmotors.",
        ))
        await db.commit()

    r = await client.get("/v1/anuncios/pendencias", headers=loja_a["headers"])
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [anuncio_id]
    assert r.json()[0]["rotulo_portal"] == "Webmotors"

    r = await client.post(f"/v1/anuncios/{anuncio_id}/confirmar-baixa", headers=loja_a["headers"])
    assert r.status_code == 200

    async with async_session() as db:
        anuncio = (await db.execute(
            select(AnuncioPortal).where(AnuncioPortal.id == anuncio_id)
        )).scalar_one()

    assert anuncio.status == "despublicado"
    assert anuncio.baixa_confirmada_em is not None
    assert anuncio.baixa_confirmada_por == loja_a["gestor"], "precisa registrar quem confirmou"

    # Confirmar de novo não é idempotente à toa: 409 evita mascarar erro de UI.
    r = await client.post(f"/v1/anuncios/{anuncio_id}/confirmar-baixa", headers=loja_a["headers"])
    assert r.status_code == 409


# ══════════════════════════════════════════════════════════════
# ISOLAMENTO MULTI-TENANT (TDD §4.1)
# ══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_grade_nao_vaza_veiculo_de_outra_loja(client, loja_a, loja_b):
    r = await client.get("/v1/anuncios/grade", headers=loja_a["headers"])
    assert r.status_code == 200
    ids = {i["veiculo_id"] for i in r.json()["itens"]}
    assert loja_a["veiculo"] in ids
    assert loja_b["veiculo"] not in ids


@pytest.mark.asyncio
async def test_loja_a_nao_confirma_baixa_da_loja_b(client, loja_a, loja_b):
    """A pendência é da loja B: para a loja A, ela simplesmente não existe."""
    anuncio_id = _uid()
    async with async_session() as db:
        db.add(AnuncioPortal(
            id=anuncio_id, loja_id=loja_b["loja"], veiculo_id=loja_b["veiculo"],
            portal="olx", status="baixa_pendente",
        ))
        await db.commit()

    r = await client.post(f"/v1/anuncios/{anuncio_id}/confirmar-baixa", headers=loja_a["headers"])
    assert r.status_code == 404

    async with async_session() as db:
        anuncio = (await db.execute(
            select(AnuncioPortal).where(AnuncioPortal.id == anuncio_id)
        )).scalar_one()
    assert anuncio.status == "baixa_pendente", "anúncio da loja B foi alterado por outra loja"


@pytest.mark.asyncio
async def test_sem_modulo_marketing_bate_no_paywall(client, loja_a):
    """Gate é Modulo.MARKETING (TDD §3.5): sem ele, 402."""
    async with async_session() as db:
        modulo = (await db.execute(
            select(ModuloHabilitado).where(ModuloHabilitado.loja_id == loja_a["loja"])
        )).scalar_one()
        modulo.ativo = False
        await db.commit()

    r = await client.get("/v1/anuncios/portais", headers=loja_a["headers"])
    assert r.status_code == 402
    assert r.headers.get("X-Paywall-Modulo") == "marketing"
