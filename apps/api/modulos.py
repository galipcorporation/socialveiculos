"""
Social Veículos — Gate Central de Módulos Premium (SSO)
Protege rotas/UI premium: só passa quem tem o módulo contratado e a assinatura em dia.
"""

import enum
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Callable

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import ModuloHabilitado, Assinatura, StatusAssinatura


class Modulo(str, enum.Enum):
    """Módulos premium contratáveis por loja."""
    CONTRATOS = "contratos"
    SIMULADOR = "simulador"
    MARKETING = "marketing"
    ASSISTENTE_IA = "assistente_ia"


# Status de assinatura que permitem acesso aos módulos.
# Inadimplente (SUSPENSA/EXPIRADA/CANCELADA) bloqueia mesmo com módulo habilitado.
STATUS_LIBERA_MODULO = {StatusAssinatura.ATIVA}


async def assinatura_em_dia(db: AsyncSession, loja_id: str) -> bool:
    """True se a loja tem ao menos uma assinatura em estado que libera módulos."""
    stmt = (
        select(Assinatura)
        .where(
            Assinatura.loja_id == loja_id,
            Assinatura.status.in_(STATUS_LIBERA_MODULO),
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


async def modulo_ativo(db: AsyncSession, loja_id: str, modulo: Modulo) -> bool:
    """
    Gate central: True somente se o módulo está habilitado para a loja
    E a assinatura está em dia. Use em rotas e para montar a UI/paywall.
    """
    if not await assinatura_em_dia(db, loja_id):
        return False

    stmt = (
        select(ModuloHabilitado)
        .where(
            ModuloHabilitado.loja_id == loja_id,
            ModuloHabilitado.nome_modulo == modulo.value,
            ModuloHabilitado.ativo == True,
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


def exige_modulo(modulo: Modulo) -> Callable:
    """
    Dependência FastAPI que lança 402 Payment Required (paywall) se a loja
    não tem o módulo contratado ou está inadimplente.
    """
    async def dependencia(
        context: B2BContext = Depends(get_current_b2b_user),
        db: AsyncSession = Depends(get_db),
    ) -> B2BContext:
        if not context.loja_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário sem loja associada.",
            )
        if not await modulo_ativo(db, context.loja_id, modulo):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Módulo '{modulo.value}' não contratado ou assinatura inadimplente.",
                headers={"X-Paywall-Modulo": modulo.value},
            )
        return context

    return dependencia
