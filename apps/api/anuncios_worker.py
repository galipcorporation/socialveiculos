"""
Worker do integrador de anúncios (M079).

Mesmo padrão do marketing_worker: loop asyncio no lifespan, tick de 60s, sem
Celery. A diferença é o retry — portal cai, e o lojista não fica olhando a tela.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select

from anuncios_service import carregar_veiculo, veiculo_anunciavel
from database import async_session
from models import AnuncioPortal, CredencialPortal, CredencialRedeSocial
from portais import PORTAIS_META, get_adapter, hash_payload, montar_payload

logger = logging.getLogger("anuncios_worker")

_INTERVALO_SEGUNDOS = 60
_MAX_POR_TICK = 20  # teto por rodada: protege o rate limit dos portais

# Backoff: 1min → 5min → 30min → 2h → 6h. Depois disso, erro definitivo.
_BACKOFF_MINUTOS = [1, 5, 30, 120, 360]
_MAX_TENTATIVAS = len(_BACKOFF_MINUTOS)


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _credencial(db, anuncio: AnuncioPortal):
    """Meta usa a credencial do M024; os demais portais, CredencialPortal."""
    if anuncio.portal in PORTAIS_META:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == anuncio.loja_id,
            CredencialRedeSocial.rede == anuncio.portal,
            CredencialRedeSocial.ativo == True,  # noqa: E712
        )
    else:
        stmt = select(CredencialPortal).where(
            CredencialPortal.loja_id == anuncio.loja_id,
            CredencialPortal.portal == anuncio.portal,
            CredencialPortal.ativo == True,  # noqa: E712
        )
    return (await db.execute(stmt)).scalar_one_or_none()


def _falhar(anuncio: AnuncioPortal, erro: str) -> None:
    """Agenda nova tentativa ou desiste com erro definitivo."""
    anuncio.tentativas = (anuncio.tentativas or 0) + 1
    anuncio.erro = erro
    anuncio.atualizado_em = _agora()

    if anuncio.tentativas >= _MAX_TENTATIVAS:
        anuncio.status = "erro"
        anuncio.acao_pendente = None
        anuncio.proxima_tentativa_em = None
        logger.warning(
            "anuncio %s (%s) falhou definitivamente: %s", anuncio.id, anuncio.portal, erro
        )
    else:
        minutos = _BACKOFF_MINUTOS[anuncio.tentativas - 1]
        anuncio.status = "sincronizando"
        anuncio.proxima_tentativa_em = _agora() + timedelta(minutes=minutos)


async def _processar(db, anuncio: AnuncioPortal) -> None:
    adapter = get_adapter(anuncio.portal)
    if adapter is None:
        anuncio.status = "erro"
        anuncio.acao_pendente = None
        anuncio.erro = f"Portal '{anuncio.portal}' não existe mais no sistema."
        anuncio.atualizado_em = _agora()
        return

    acao = anuncio.acao_pendente or "publicar"

    # Portal sem API nunca deveria entrar na fila; se entrou, vira baixa manual.
    if not adapter.disponivel:
        anuncio.status = "baixa_pendente" if acao == "despublicar" else "nao_publicado"
        anuncio.acao_pendente = None
        anuncio.proxima_tentativa_em = None
        anuncio.erro = getattr(adapter, "motivo", "Portal não integrado.")
        anuncio.atualizado_em = _agora()
        return

    cred = await _credencial(db, anuncio)
    if cred is None:
        _falhar(anuncio, f"{adapter.rotulo}: conta não conectada.")
        return

    if acao == "despublicar":
        resultado = await adapter.despublicar(cred, anuncio.anuncio_externo_id)
        if resultado.sucesso:
            anuncio.status = "despublicado"
            anuncio.acao_pendente = None
            anuncio.proxima_tentativa_em = None
            anuncio.erro = None
            anuncio.tentativas = 0
        else:
            # Portal que não sabe despublicar (posts do Meta) não é falha a
            # repetir: é baixa manual. Repetir 5x não removeria o post.
            anuncio.status = "baixa_pendente"
            anuncio.acao_pendente = None
            anuncio.proxima_tentativa_em = None
            anuncio.erro = resultado.erro
        anuncio.atualizado_em = _agora()
        return

    # publicar / atualizar
    veiculo = await carregar_veiculo(db, anuncio.veiculo_id)
    ok, motivo = veiculo_anunciavel(veiculo)
    if not ok:
        anuncio.status = "erro"
        anuncio.acao_pendente = None
        anuncio.proxima_tentativa_em = None
        anuncio.erro = motivo
        anuncio.atualizado_em = _agora()
        return

    payload = montar_payload(veiculo)
    novo_hash = hash_payload(payload)

    if acao == "atualizar" and anuncio.hash_payload == novo_hash:
        # Nada mudou: não gasta chamada de API à toa.
        anuncio.status = "publicado"
        anuncio.acao_pendente = None
        anuncio.proxima_tentativa_em = None
        anuncio.atualizado_em = _agora()
        return

    if acao == "atualizar" and anuncio.anuncio_externo_id:
        resultado = await adapter.atualizar(payload, cred, anuncio.anuncio_externo_id)
    else:
        resultado = await adapter.publicar(payload, cred)

    if resultado.sucesso:
        anuncio.status = "publicado"
        anuncio.acao_pendente = None
        anuncio.proxima_tentativa_em = None
        anuncio.erro = None
        anuncio.tentativas = 0
        anuncio.hash_payload = novo_hash
        anuncio.publicado_em = _agora()
        if resultado.anuncio_externo_id:
            anuncio.anuncio_externo_id = resultado.anuncio_externo_id
        if resultado.url_externa:
            anuncio.url_externa = resultado.url_externa
        anuncio.atualizado_em = _agora()
    else:
        _falhar(anuncio, f"{adapter.rotulo}: {resultado.erro or 'erro desconhecido'}")


async def _tick() -> None:
    agora = _agora()
    async with async_session() as db:
        stmt = (
            select(AnuncioPortal)
            .where(
                AnuncioPortal.acao_pendente.isnot(None),
                or_(
                    AnuncioPortal.proxima_tentativa_em.is_(None),
                    AnuncioPortal.proxima_tentativa_em <= agora,
                ),
            )
            .limit(_MAX_POR_TICK)
        )
        anuncios = (await db.execute(stmt)).scalars().all()

        for anuncio in anuncios:
            try:
                await _processar(db, anuncio)
            except Exception as e:  # nunca deixa um item derrubar a fila
                logger.error("anuncio %s: exceção ao processar: %s", anuncio.id, e)
                _falhar(anuncio, str(e))
            await db.commit()


async def worker_loop() -> None:
    while True:
        try:
            await _tick()
        except Exception as e:
            logger.error("anuncios_worker erro: %s", e)
        await asyncio.sleep(_INTERVALO_SEGUNDOS)
