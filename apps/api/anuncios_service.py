"""
Núcleo do integrador de anúncios (M079).

Fica fora dos routers de propósito: o gancho de venda precisa ser chamado de
`contratos.py` e `b2b.py` sem que eles importem o router de anúncios.
"""

import logging
from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import AnuncioPortal, StatusVeiculo, Veiculo
from portais import REGISTRY, get_adapter

logger = logging.getLogger("anuncios")

# Estados em que o anúncio está no ar (ou a caminho) — os que a venda precisa derrubar.
STATUS_ATIVOS = ("publicado", "sincronizando", "erro")


def _agora() -> datetime:
    """Naive UTC, como o resto do projeto grava (ARMADILHAS-PRODUCAO.md §1)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def obter_ou_criar(db, loja_id: str, veiculo_id: str, portal: str) -> AnuncioPortal:
    stmt = select(AnuncioPortal).where(
        AnuncioPortal.veiculo_id == veiculo_id,
        AnuncioPortal.portal == portal,
    )
    anuncio = (await db.execute(stmt)).scalar_one_or_none()
    if anuncio is None:
        anuncio = AnuncioPortal(
            loja_id=loja_id,
            veiculo_id=veiculo_id,
            portal=portal,
            status="nao_publicado",
        )
        db.add(anuncio)
    return anuncio


def _enfileirar(anuncio: AnuncioPortal, acao: str) -> None:
    anuncio.acao_pendente = acao
    anuncio.status = "sincronizando"
    anuncio.erro = None
    anuncio.tentativas = 0
    anuncio.proxima_tentativa_em = _agora()
    anuncio.atualizado_em = _agora()


async def enfileirar_acao(
    db,
    loja_id: str,
    veiculo_id: str,
    portais: Iterable[str],
    acao: str,
) -> list[AnuncioPortal]:
    """Coloca veículo × portais na fila do worker. Não commita — quem chama decide."""
    afetados = []
    for portal in portais:
        if portal not in REGISTRY:
            continue
        anuncio = await obter_ou_criar(db, loja_id, veiculo_id, portal)
        _enfileirar(anuncio, acao)
        afetados.append(anuncio)
    return afetados


async def enfileirar_sync_veiculo(db, veiculo: Veiculo, acao: str) -> list[AnuncioPortal]:
    """Gancho único de venda/cancelamento (TDD §3.4).

    Chamado de contratos.py e b2b.py **dentro da mesma transação** da venda —
    não commita aqui.

    acao="despublicar": todo anúncio ativo sai do ar. Onde o portal não tem API
    (Webmotors, iCarros, OLX e também os posts do Meta), vira `baixa_pendente`
    na hora: ninguém consegue remover por nós, então isso precisa virar tarefa
    visível em vez de sumir.

    acao="publicar": usado no cancelamento da venda, para republicar onde estava.
    """
    stmt = select(AnuncioPortal).where(AnuncioPortal.veiculo_id == veiculo.id)
    anuncios = (await db.execute(stmt)).scalars().all()
    afetados = []

    for anuncio in anuncios:
        adapter = get_adapter(anuncio.portal)
        if adapter is None:
            continue

        if acao == "despublicar":
            if anuncio.status not in STATUS_ATIVOS:
                continue
            if adapter.disponivel:
                _enfileirar(anuncio, "despublicar")
            else:
                anuncio.status = "baixa_pendente"
                anuncio.acao_pendente = None
                anuncio.erro = getattr(adapter, "motivo", "Remoção manual necessária.")
                anuncio.atualizado_em = _agora()
        elif acao == "publicar":
            # Cancelamento da venda: só volta o que a venda derrubou.
            if anuncio.status not in ("despublicado", "baixa_pendente"):
                continue
            if adapter.disponivel:
                _enfileirar(anuncio, "publicar")
            else:
                anuncio.status = "baixa_pendente"
                anuncio.erro = "Venda cancelada — republique manualmente neste portal."
                anuncio.atualizado_em = _agora()
        afetados.append(anuncio)

    if afetados:
        logger.info(
            "anuncios: veiculo=%s acao=%s afetados=%d", veiculo.id, acao, len(afetados)
        )
    return afetados


async def carregar_veiculo(db, veiculo_id: str, loja_id: Optional[str] = None) -> Optional[Veiculo]:
    stmt = select(Veiculo).options(selectinload(Veiculo.midias)).where(Veiculo.id == veiculo_id)
    if loja_id:
        stmt = stmt.where(Veiculo.loja_id == loja_id)
    return (await db.execute(stmt)).scalar_one_or_none()


def veiculo_anunciavel(veiculo: Optional[Veiculo]) -> tuple[bool, str]:
    """Regra única de 'pode publicar?' — usada pelo router e pelo worker."""
    if veiculo is None:
        return False, "Veículo não encontrado."
    if veiculo.status != StatusVeiculo.DISPONIVEL:
        return False, "Veículo não está disponível (vendido ou inativo)."
    if not veiculo.preco_venda:
        return False, "Veículo sem preço de venda definido."
    return True, ""
