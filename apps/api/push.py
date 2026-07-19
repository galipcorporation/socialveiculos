"""
Envio de push notifications via Expo Push API.

O app mobile (Expo) registra o token do dispositivo em `/v1/notificacoes/dispositivo`.
Este módulo entrega uma notificação a todos os dispositivos de um usuário (ou de
todos os usuários de uma loja) chamando https://exp.host/--/api/v2/push/send.

Falha de push nunca deve derrubar a request que a originou: todas as funções
engolem exceções e apenas logam. Tokens inválidos ("DeviceNotRegistered")
retornados pela Expo são removidos do banco para não acumular lixo.
"""
from __future__ import annotations

import logging
from typing import Iterable, Optional

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DispositivoPush, MembroLoja

logger = logging.getLogger("push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _tokens_do_usuario(db: AsyncSession, usuario_id: str) -> list[str]:
    res = await db.execute(
        select(DispositivoPush.token).where(DispositivoPush.usuario_id == usuario_id)
    )
    return [t for (t,) in res.all()]


async def _enviar_para_tokens(
    db: AsyncSession,
    tokens: list[str],
    titulo: str,
    corpo: str,
    data: Optional[dict] = None,
) -> None:
    tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not tokens:
        return

    mensagens = [
        {"to": t, "title": titulo, "body": corpo, "sound": "default", "data": data or {}}
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(EXPO_PUSH_URL, json=mensagens)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:  # noqa: BLE001 — push nunca pode quebrar a request
        logger.warning("Falha ao enviar push para %d dispositivo(s): %s", len(tokens), exc)
        return

    # A Expo devolve um "data" com 1 ticket por mensagem, na ordem enviada.
    tickets = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(tickets, list):
        return
    invalidos: list[str] = []
    for token, ticket in zip(tokens, tickets):
        if isinstance(ticket, dict) and ticket.get("status") == "error":
            detalhe = (ticket.get("details") or {}).get("error")
            if detalhe == "DeviceNotRegistered":
                invalidos.append(token)
    if invalidos:
        try:
            await db.execute(delete(DispositivoPush).where(DispositivoPush.token.in_(invalidos)))
            await db.commit()
        except Exception:  # noqa: BLE001
            await db.rollback()


async def enviar_push_usuario(
    db: AsyncSession,
    usuario_id: Optional[str],
    titulo: str,
    corpo: str,
    link: Optional[str] = None,
    tipo: Optional[str] = None,
) -> None:
    """Envia um push a todos os dispositivos de um usuário. No-op se o usuário
    não tem token registrado ou se usuario_id é None."""
    if not usuario_id:
        return
    tokens = await _tokens_do_usuario(db, usuario_id)
    data = {k: v for k, v in {"link": link, "tipo": tipo}.items() if v}
    await _enviar_para_tokens(db, tokens, titulo, corpo, data)


async def enviar_push_usuarios(
    db: AsyncSession,
    usuario_ids: Iterable[str],
    titulo: str,
    corpo: str,
    link: Optional[str] = None,
    tipo: Optional[str] = None,
) -> None:
    """Envia o mesmo push a vários usuários (ex.: todos os membros de uma loja)."""
    ids = [u for u in usuario_ids if u]
    if not ids:
        return
    res = await db.execute(
        select(DispositivoPush.token).where(DispositivoPush.usuario_id.in_(ids))
    )
    tokens = [t for (t,) in res.all()]
    data = {k: v for k, v in {"link": link, "tipo": tipo}.items() if v}
    await _enviar_para_tokens(db, tokens, titulo, corpo, data)


async def enviar_push_loja(
    db: AsyncSession,
    loja_id: Optional[str],
    titulo: str,
    corpo: str,
    link: Optional[str] = None,
    tipo: Optional[str] = None,
    excluir_usuario_id: Optional[str] = None,
) -> None:
    """Envia um push a todos os membros ATIVOS de uma loja (gestores/vendedores).
    `excluir_usuario_id` pula o autor da ação (não notificar a si mesmo)."""
    if not loja_id:
        return
    res = await db.execute(
        select(MembroLoja.usuario_id).where(
            MembroLoja.loja_id == loja_id, MembroLoja.ativo == True  # noqa: E712
        )
    )
    ids = [u for (u,) in res.all() if u and u != excluir_usuario_id]
    await enviar_push_usuarios(db, ids, titulo, corpo, link, tipo)
