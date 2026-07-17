"""
Worker de vencimento de assinatura (cobrança manual via Pix).

Duas responsabilidades, uma vez por dia:
  - D-7: avisa a loja (notificação in-app + e-mail) que a assinatura vence em breve.
  - Vencida: marca a assinatura como EXPIRADA e desativa a loja (Loja.ativa = False),
    cortando o login de todo mundo — mesmo bloqueio que hoje só existia via toggle manual do admin.

Deduplica o aviso de D-7 pelo campo `link` da notificação (mesmo padrão do
esteira_worker), sem tabela extra. Integrado ao lifespan via asyncio, roda 1x/dia.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from database import async_session
from email_service import enviar_email, render_aviso_vencimento_assinatura
from models import (
    Assinatura,
    Loja,
    MembroLoja,
    Usuario,
    Notificacao,
    StatusAssinatura,
    PapelUsuario,
)

logger = logging.getLogger("assinatura_worker")

INTERVALO_SEGUNDOS = 86400  # 1x/dia
DIAS_ANTECEDENCIA = 7


def _naive_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


async def _ja_notificado(db, loja_id: str, link: str) -> bool:
    stmt = select(Notificacao.id).where(
        Notificacao.loja_id == loja_id,
        Notificacao.link == link,
    ).limit(1)
    return (await db.execute(stmt)).first() is not None


async def _emails_gestores(db, loja: Loja) -> list[str]:
    stmt = (
        select(Usuario.email)
        .join(MembroLoja, MembroLoja.usuario_id == Usuario.id)
        .where(
            MembroLoja.loja_id == loja.id,
            MembroLoja.papel == PapelUsuario.GESTOR,
            MembroLoja.ativo == True,
        )
    )
    emails = {row[0] for row in (await db.execute(stmt)).all() if row[0]}
    if loja.email:
        emails.add(loja.email)
    return list(emails)


async def _avisar_d7(db, assinatura: Assinatura, loja: Loja, dias: int) -> None:
    link = f"assinatura:{assinatura.id}:d7"
    if await _ja_notificado(db, loja.id, link):
        return

    titulo = f"Assinatura vence em {dias} dia(s)"
    conteudo = (
        f"A assinatura da loja vence em {assinatura.proximo_vencimento.strftime('%d/%m/%Y')}. "
        "Regularize o pagamento para não perder o acesso ao sistema."
    )
    db.add(Notificacao(
        loja_id=loja.id,
        titulo=titulo,
        conteudo=conteudo,
        tipo="assinatura_vencimento",
        link=link,
    ))

    html = render_aviso_vencimento_assinatura(
        loja_nome=loja.nome,
        vencimento=assinatura.proximo_vencimento,
        dias=dias,
    )
    for email in await _emails_gestores(db, loja):
        await enviar_email(to=email, subject=titulo, html=html)


async def _expirar(db, assinatura: Assinatura, loja: Loja) -> None:
    link = f"assinatura:{assinatura.id}:expirada"
    assinatura.status = StatusAssinatura.EXPIRADA
    loja.ativa = False

    if not await _ja_notificado(db, loja.id, link):
        db.add(Notificacao(
            loja_id=loja.id,
            titulo="Assinatura vencida — acesso suspenso",
            conteudo=(
                f"A assinatura venceu em {assinatura.proximo_vencimento.strftime('%d/%m/%Y')} "
                "e não foi renovada. O acesso ao sistema foi suspenso até a regularização."
            ),
            tipo="assinatura_vencimento",
            link=link,
        ))
        html = render_aviso_vencimento_assinatura(
            loja_nome=loja.nome,
            vencimento=assinatura.proximo_vencimento,
            dias=0,
            vencida=True,
        )
        for email in await _emails_gestores(db, loja):
            await enviar_email(to=email, subject="Assinatura vencida — acesso suspenso", html=html)

    logger.warning("assinatura_worker: loja %s desativada por vencimento (assinatura %s)", loja.id, assinatura.id)


async def _tick() -> None:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    limiar_d7 = agora + timedelta(days=DIAS_ANTECEDENCIA)

    async with async_session() as db:
        stmt = (
            select(Assinatura, Loja)
            .join(Loja, Assinatura.loja_id == Loja.id)
            .where(
                Assinatura.status == StatusAssinatura.ATIVA,
                Assinatura.proximo_vencimento.is_not(None),
            )
        )
        rows = (await db.execute(stmt)).all()

        alterados = 0
        for assinatura, loja in rows:
            vencimento = _naive_utc(assinatura.proximo_vencimento)

            if vencimento < agora:
                await _expirar(db, assinatura, loja)
                alterados += 1
            elif vencimento <= limiar_d7:
                dias = max((vencimento - agora).days, 0)
                await _avisar_d7(db, assinatura, loja, dias)
                alterados += 1

        if alterados:
            await db.commit()
            logger.info("assinatura_worker: %d assinatura(s) processada(s)", alterados)


async def worker_loop() -> None:
    while True:
        try:
            await _tick()
        except Exception as e:  # noqa: BLE001
            logger.error("assinatura_worker erro: %s", e)
        await asyncio.sleep(INTERVALO_SEGUNDOS)
