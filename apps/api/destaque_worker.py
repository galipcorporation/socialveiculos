"""
Worker de vencimento do destaque pago (patrocínio na vitrine, cobrança manual via Pix).

Uma responsabilidade, uma vez por dia: quando `Loja.destaque_ate` vence,
desliga `Loja.destaque` e notifica o gestor in-app — diferente do
assinatura_worker, aqui não há corte de acesso ao sistema, só a perda do
posicionamento priorizado no feed público.

Mesmo padrão de dedupe por `link` da notificação usado em assinatura_worker/
esteira_worker, sem tabela extra. Integrado ao lifespan via asyncio, roda 1x/dia.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from database import async_session
from models import Loja, Notificacao

logger = logging.getLogger("destaque_worker")

INTERVALO_SEGUNDOS = 86400  # 1x/dia


def _naive_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


async def _ja_notificado(db, loja_id: str, link: str) -> bool:
    stmt = select(Notificacao.id).where(
        Notificacao.loja_id == loja_id,
        Notificacao.link == link,
    ).limit(1)
    return (await db.execute(stmt)).first() is not None


async def _expirar(db, loja: Loja) -> None:
    link = f"destaque:{loja.id}:expirado:{loja.destaque_ate.isoformat()}"
    loja.destaque = False

    if not await _ja_notificado(db, loja.id, link):
        db.add(Notificacao(
            loja_id=loja.id,
            titulo="Destaque na vitrine expirou",
            conteudo=(
                "O período de destaque (patrocínio) da loja na vitrine pública expirou "
                "e os veículos voltaram à ordenação normal do feed. Renove com a equipe "
                "Social Veículos para manter a prioridade."
            ),
            tipo="destaque_vencimento",
            link=link,
        ))

    logger.info("destaque_worker: destaque da loja %s expirado e desativado", loja.id)


async def _tick() -> None:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    async with async_session() as db:
        stmt = select(Loja).where(
            Loja.destaque == True,
            Loja.destaque_ate.is_not(None),
        )
        lojas = (await db.execute(stmt)).scalars().all()

        alterados = 0
        for loja in lojas:
            if _naive_utc(loja.destaque_ate) < agora:
                await _expirar(db, loja)
                alterados += 1

        if alterados:
            await db.commit()
            logger.info("destaque_worker: %d destaque(s) expirado(s)", alterados)


async def worker_loop() -> None:
    while True:
        try:
            await _tick()
        except Exception as e:  # noqa: BLE001
            logger.error("destaque_worker erro: %s", e)
        await asyncio.sleep(INTERVALO_SEGUNDOS)
