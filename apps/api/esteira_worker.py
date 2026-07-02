"""
Worker de alertas de prazo da esteira pós-venda (ESTEIRA-POS-VENDA.md §6.6 / Fase 2).

Foca nos dois prazos que protegem a loja:
  - comunicacao_venda (60d)  → sem ela, multa do comprador cai na loja
  - transferencia_concluida (30d)

Dispara uma Notificacao quando o item pendente entra em D-7 e no vencimento.
Deduplica pelo campo `link` da notificação (esteira/{id}/item/{chave}#fase),
sem tabela extra. Integrado ao lifespan via asyncio (mesmo padrão do
marketing_worker), roda a cada hora.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from database import async_session
from models import (
    ItemChecklist,
    EsteiraPosVenda,
    Notificacao,
    StatusItemChecklist,
    EstagioPosVenda,
)

logger = logging.getLogger("esteira_worker")

INTERVALO_SEGUNDOS = 3600  # verifica de hora em hora
DIAS_ANTECEDENCIA = 7

# itens críticos que geram alerta (chave → rótulo curto p/ a notificação)
_ITENS_ALERTA = {
    "comunicacao_venda": "Comunicação de venda",
    "transferencia_concluida": "Transferência",
}


def _naive_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


async def _ja_notificado(db, loja_id: str, link: str) -> bool:
    stmt = select(Notificacao.id).where(
        Notificacao.loja_id == loja_id,
        Notificacao.link == link,
    ).limit(1)
    return (await db.execute(stmt)).first() is not None


async def _tick() -> None:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    limiar_d7 = agora + timedelta(days=DIAS_ANTECEDENCIA)

    async with async_session() as db:
        stmt = (
            select(ItemChecklist, EsteiraPosVenda)
            .join(EsteiraPosVenda, ItemChecklist.esteira_id == EsteiraPosVenda.id)
            .where(
                ItemChecklist.chave.in_(list(_ITENS_ALERTA.keys())),
                ItemChecklist.prazo_em.is_not(None),
                ItemChecklist.status.in_([
                    StatusItemChecklist.PENDENTE,
                    StatusItemChecklist.EM_ANDAMENTO,
                ]),
                EsteiraPosVenda.estagio != EstagioPosVenda.CONCLUIDO,
            )
        )
        rows = (await db.execute(stmt)).all()

        criadas = 0
        for item, esteira in rows:
            prazo = _naive_utc(item.prazo_em)
            rotulo = _ITENS_ALERTA[item.chave]

            fase = None
            if prazo < agora:
                fase = "vencido"
            elif prazo <= limiar_d7:
                fase = "d7"
            if fase is None:
                continue

            link = f"/pos-venda/{esteira.id}?item={item.chave}#{fase}"
            if await _ja_notificado(db, esteira.loja_id, link):
                continue

            if fase == "vencido":
                titulo = f"{rotulo} VENCIDA — risco na loja"
                conteudo = (
                    f"O prazo de '{item.titulo}' venceu em "
                    f"{prazo.strftime('%d/%m/%Y')}. "
                    + ("Sem a comunicação de venda, multas do comprador recaem sobre a loja."
                       if item.chave == "comunicacao_venda"
                       else "Carro ainda no nome da loja é risco.")
                )
            else:
                dias = max((prazo - agora).days, 0)
                titulo = f"{rotulo} vence em {dias} dia(s)"
                conteudo = f"'{item.titulo}' vence em {prazo.strftime('%d/%m/%Y')}."

            db.add(Notificacao(
                loja_id=esteira.loja_id,
                usuario_id=esteira.vendedor_id,
                titulo=titulo,
                conteudo=conteudo,
                tipo="esteira_prazo",
                link=link,
            ))
            criadas += 1

        if criadas:
            await db.commit()
            logger.info("esteira_worker: %d alerta(s) de prazo criados", criadas)


async def worker_loop() -> None:
    while True:
        try:
            await _tick()
        except Exception as e:  # noqa: BLE001
            logger.error("esteira_worker erro: %s", e)
        await asyncio.sleep(INTERVALO_SEGUNDOS)
