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


async def _renovar_se_perto_de_expirar(cred: CredencialRedeSocial, db) -> None:
    from routers.marketing_social import _decifrar, _cifrar, META_APP_ID, META_APP_SECRET
    import httpx
    from datetime import timedelta

    if not cred.token_expira_em or not cred.access_token_cifrado:
        return

    agora = datetime.now(timezone.utc)
    token_exp = cred.token_expira_em.replace(tzinfo=timezone.utc) if cred.token_expira_em.tzinfo is None else cred.token_expira_em

    if token_exp - agora < timedelta(days=7):
        logger.info(f"Token de {cred.rede} (loja {cred.loja_id}) perto de expirar. Renovando...")
        try:
            token_atual = _decifrar(cred.access_token_cifrado)
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://graph.facebook.com/v19.0/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": META_APP_ID,
                        "client_secret": META_APP_SECRET,
                        "fb_exchange_token": token_atual,
                    },
                    timeout=15.0,
                )
                if r.status_code == 200:
                    novo_token = r.json().get("access_token")
                    expires_in = r.json().get("expires_in", 5184000)
                    cred.access_token_cifrado = _cifrar(novo_token)
                    cred.token_expira_em = agora.replace(tzinfo=None) + timedelta(seconds=expires_in)
                    cred.atualizado_em = agora.replace(tzinfo=None)
                    await db.commit()
                    logger.info(f"Token de {cred.rede} (loja {cred.loja_id}) renovado com sucesso.")
                else:
                    logger.error(f"Erro ao renovar token de {cred.rede} (loja {cred.loja_id}): {r.text}")
        except Exception as e:
            logger.error(f"Exceção ao renovar token de {cred.rede} (loja {cred.loja_id}): {e}")


async def _processar_post(post: PostAgendado, db) -> None:
    from routers.marketing_social import _publicar_na_rede

    redes = json.loads(post.redes) if post.redes else []
    midia_urls = json.loads(post.midia_urls) if post.midia_urls else []
    midia_url = midia_urls[0] if midia_urls else None

    texto_completo = post.texto
    hashtags = json.loads(post.hashtags) if post.hashtags else []
    if hashtags:
        texto_completo += "\n\n" + " ".join(f"#{h}" for h in hashtags)

    erros = []
    for rede in redes:
        if rede == "instagram" and not midia_url:
            erros.append("instagram: Instagram exige ao menos uma foto no veículo.")
            continue

        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == post.loja_id,
            CredencialRedeSocial.rede == rede,
            CredencialRedeSocial.ativo == True,
        )
        cred = (await db.execute(stmt)).scalar_one_or_none()
        if not cred:
            erros.append(f"{rede}: não conectada")
            continue

        # Renova se perto de expirar
        await _renovar_se_perto_de_expirar(cred, db)

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
    tick_count = 0
    while True:
        try:
            await _tick()
            tick_count += 1
            if tick_count >= 1440:  # ~24 horas
                tick_count = 0
                await _varrer_e_renovar_tokens()
        except Exception as e:
            logger.error(f"marketing_worker erro: {e}")
        await asyncio.sleep(_INTERVALO_SEGUNDOS)


async def _varrer_e_renovar_tokens() -> None:
    logger.info("Iniciando varredura diária de tokens Meta...")
    async with async_session() as db:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.ativo == True
        )
        res = await db.execute(stmt)
        creds = res.scalars().all()
        for cred in creds:
            try:
                await _renovar_se_perto_de_expirar(cred, db)
            except Exception as e:
                logger.error(f"Erro ao renovar token de {cred.rede} (loja {cred.loja_id}) na varredura: {e}")


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
