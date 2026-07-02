"""
Worker de publicação agendada de posts de marketing (M024).
Roda como tarefa periódica via asyncio + loop interno.
Não depende de APScheduler/Celery — usa um loop simples integrado ao lifespan.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from database import async_session
from models import CredencialRedeSocial, PostAgendado

logger = logging.getLogger("marketing_worker")

_INTERVALO_SEGUNDOS = 60  # verifica a cada 1 minuto


async def _processar_post(post: PostAgendado, db) -> None:
    from routers.marketing_social import _publicar_na_rede, _decifrar

    redes = json.loads(post.redes) if post.redes else []
    midia_urls = json.loads(post.midia_urls) if post.midia_urls else []
    midia_url = midia_urls[0] if midia_urls else None

    texto_completo = post.texto
    hashtags = json.loads(post.hashtags) if post.hashtags else []
    if hashtags:
        texto_completo += "\n\n" + " ".join(f"#{h}" for h in hashtags)

    erros = []
    for rede in redes:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == post.loja_id,
            CredencialRedeSocial.rede == rede,
            CredencialRedeSocial.ativo == True,
        )
        cred = (await db.execute(stmt)).scalar_one_or_none()
        if not cred:
            erros.append(f"{rede}: não conectada")
            continue
        resultado = await _publicar_na_rede(rede, texto_completo, midia_url, cred)
        if not resultado.get("sucesso"):
            erros.append(f"{rede}: {resultado.get('erro', 'erro desconhecido')}")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    if erros:
        post.status = "falhou"
        post.erro = "; ".join(erros)
    else:
        post.status = "publicado"
        post.publicado_em = agora
    post.atualizado_em = agora
    await db.commit()


async def worker_loop() -> None:
    """Loop principal: roda indefinidamente até cancelamento."""
    while True:
        try:
            await _tick()
        except Exception as e:
            logger.error(f"marketing_worker erro: {e}")
        await asyncio.sleep(_INTERVALO_SEGUNDOS)


async def _tick() -> None:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    async with async_session() as db:
        stmt = select(PostAgendado).where(
            PostAgendado.status == "agendado",
            PostAgendado.publicar_em <= agora,
        )
        result = await db.execute(stmt)
        posts = result.scalars().all()
        for post in posts:
            try:
                await _processar_post(post, db)
            except Exception as e:
                post.status = "falhou"
                post.erro = str(e)
                await db.commit()
                logger.error(f"Falha ao publicar post {post.id}: {e}")
