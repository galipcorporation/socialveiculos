"""
Social Veículos — Rotas de Notificações (/v1/notificacoes)
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import Notificacao
from schemas import NotificacaoResponse

router = APIRouter(prefix="/v1/notificacoes", tags=["Notificações"])


@router.get(
    "",
    response_model=List[NotificacaoResponse]
)
async def get_notificacoes(
    context: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a lista de todas as notificações não lidas da loja do usuário logado.
    """
    stmt = (
        select(Notificacao)
        .where(
            Notificacao.loja_id == context.loja_id,
            Notificacao.lida == False
        )
        .order_by(Notificacao.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/ler-todas",
    status_code=status.HTTP_200_OK
)
async def marcar_todas_lidas(
    context: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Marca todas as notificações da loja do usuário como lidas.
    """
    stmt = (
        update(Notificacao)
        .where(
            Notificacao.loja_id == context.loja_id,
            Notificacao.lida == False
        )
        .values(lida=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.post(
    "/{notif_id}/ler",
    status_code=status.HTTP_200_OK
)
async def marcar_como_lida(
    notif_id: str,
    context: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Marca uma notificação específica como lida.
    """
    res = await db.execute(
        select(Notificacao).where(
            Notificacao.id == notif_id,
            Notificacao.loja_id == context.loja_id
        )
    )
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")

    notif.lida = True
    await db.commit()
    return {"ok": True}
