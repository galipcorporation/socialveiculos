"""
Social Veículos — Assinaturas, Planos e Módulos Premium (SSO) — Tarefa 09.
Planos públicos, assinatura da loja, gate de módulos, paywall, SSO entre
módulos e webhook idempotente de pagamento.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import settings
from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from auth import create_sso_exchange_token
from modulos import Modulo, modulo_ativo, assinatura_em_dia
from models import (
    Plano,
    Assinatura,
    Pagamento,
    ModuloHabilitado,
    StatusAssinatura,
    StatusPagamento,
    utcnow,
)
from schemas import (
    PlanoResponse,
    AssinaturaResponse,
    MinhaAssinaturaResponse,
    AssinarPlanoRequest,
    ModuloStatusResponse,
    SSOExchangeResponse,
    WebhookPagamentoRequest,
)

router = APIRouter(prefix="/v1/assinaturas", tags=["Assinaturas & Módulos"])

# Grava sempre naive UTC — colunas são TIMESTAMP WITHOUT TIME ZONE (Postgres
# rejeita datetime aware nessas colunas; ver ARMADILHAS-PRODUCAO.md #1).
_now = utcnow


async def _assinatura_atual(db: AsyncSession, loja_id: str) -> Optional[Assinatura]:
    """Assinatura mais recente da loja (qualquer status)."""
    stmt = (
        select(Assinatura)
        .where(Assinatura.loja_id == loja_id)
        .order_by(Assinatura.created_at.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


# ── 9.1 — Planos públicos ──────────────────────────────────────

@router.get("/planos", response_model=List[PlanoResponse])
async def listar_planos(db: AsyncSession = Depends(get_db)):
    """Lista os planos ativos disponíveis para contratação."""
    stmt = select(Plano).where(Plano.ativo == True).order_by(Plano.preco_mensal)
    res = await db.execute(stmt)
    return res.scalars().all()


# ── 9.1 — Assinatura da loja ───────────────────────────────────

@router.get("/minha", response_model=MinhaAssinaturaResponse)
async def minha_assinatura(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Estado da assinatura da loja + módulos liberados agora."""
    assinatura = await _assinatura_atual(db, context.loja_id)
    plano = None
    if assinatura:
        plano = (await db.execute(
            select(Plano).where(Plano.id == assinatura.plano_id)
        )).scalar_one_or_none()

    em_dia = await assinatura_em_dia(db, context.loja_id)
    modulos_ativos: List[str] = []
    if em_dia:
        habilitados = (await db.execute(
            select(ModuloHabilitado).where(
                ModuloHabilitado.loja_id == context.loja_id,
                ModuloHabilitado.ativo == True,
            )
        )).scalars().all()
        modulos_ativos = [m.nome_modulo for m in habilitados]

    return MinhaAssinaturaResponse(
        assinatura=AssinaturaResponse.model_validate(assinatura) if assinatura else None,
        plano=PlanoResponse.model_validate(plano) if plano else None,
        em_dia=em_dia,
        modulos_ativos=modulos_ativos,
    )


@router.post("/assinar", response_model=AssinaturaResponse, status_code=status.HTTP_201_CREATED)
async def assinar_plano(
    data: AssinarPlanoRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Contrata um plano para a loja. Cria a assinatura (SUSPENSA até o primeiro
    pagamento confirmado pelo webhook) e habilita os módulos do plano.
    """
    plano = (await db.execute(
        select(Plano).where(Plano.id == data.plano_id, Plano.ativo == True)
    )).scalar_one_or_none()
    if not plano:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plano não encontrado ou inativo.")

    # Encerra assinatura ativa anterior, se houver
    atual = await _assinatura_atual(db, context.loja_id)
    if atual and atual.status == StatusAssinatura.ATIVA:
        atual.status = StatusAssinatura.CANCELADA
        atual.fim = _now()

    assinatura = Assinatura(
        loja_id=context.loja_id,
        plano_id=plano.id,
        status=StatusAssinatura.SUSPENSA,  # aguarda confirmação de pagamento
        inicio=_now(),
    )
    db.add(assinatura)
    await db.flush()

    # Habilita (inativos) os módulos incluídos no plano
    modulos_incluidos = json.loads(plano.modulos_incluidos) if plano.modulos_incluidos else []
    for nome in modulos_incluidos:
        existente = (await db.execute(
            select(ModuloHabilitado).where(
                ModuloHabilitado.loja_id == context.loja_id,
                ModuloHabilitado.nome_modulo == nome,
            )
        )).scalar_one_or_none()
        if existente:
            existente.ativo = True
        else:
            db.add(ModuloHabilitado(loja_id=context.loja_id, nome_modulo=nome, ativo=True))

    await registrar_auditoria(
        db=db, loja_id=context.loja_id, ator_id=context.usuario.id,
        ator_nome=context.usuario.nome, acao="assinatura.criar",
        entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({"plano_id": plano.id, "modulos": modulos_incluidos}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


# ── 9.2 / 9.3 — Módulos e paywall ──────────────────────────────

@router.get("/modulos", response_model=List[ModuloStatusResponse])
async def status_modulos(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Status de cada módulo para a UI montar paywall: contratado vs. liberado.
    Bloqueado → traz CTA de upgrade (sem quebrar navegação).
    """
    habilitados = {
        m.nome_modulo
        for m in (await db.execute(
            select(ModuloHabilitado).where(
                ModuloHabilitado.loja_id == context.loja_id,
                ModuloHabilitado.ativo == True,
            )
        )).scalars().all()
    }
    em_dia = await assinatura_em_dia(db, context.loja_id)

    out: List[ModuloStatusResponse] = []
    for modulo in Modulo:
        contratado = modulo.value in habilitados
        liberado = contratado and em_dia
        out.append(ModuloStatusResponse(
            modulo=modulo.value,
            contratado=contratado,
            liberado=liberado,
            cta_upgrade=None if liberado else "/v1/assinaturas/planos",
        ))
    return out


# ── 9.4 — SSO entre módulos ────────────────────────────────────

@router.post("/sso/{modulo}", response_model=SSOExchangeResponse)
async def sso_exchange(
    modulo: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Emite um token de troca curto (60s) para abrir um módulo premium sem
    refazer login. Falha com 402 (paywall) se o módulo não está liberado.
    """
    try:
        mod = Modulo(modulo)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Módulo desconhecido.")

    if not await modulo_ativo(db, context.loja_id, mod):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Módulo '{mod.value}' não contratado ou assinatura inadimplente.",
            headers={"X-Paywall-Modulo": mod.value},
        )

    token = create_sso_exchange_token(context.usuario.id, context.loja_id, mod.value)
    return SSOExchangeResponse(exchange_token=token, modulo=mod.value)


# ── 9.8 — Webhook de pagamento (idempotente) ───────────────────

@router.post("/webhook/pagamento", status_code=status.HTTP_200_OK)
async def webhook_pagamento(
    data: WebhookPagamentoRequest,
    x_webhook_secret: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe eventos do gateway e atualiza o estado da assinatura.
    Idempotente: `referencia` é a chave única do evento — reprocessar
    o mesmo evento não duplica pagamento nem reaplica efeitos.
    """
    if x_webhook_secret != settings.webhook_secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Assinatura de webhook inválida.")

    # Idempotência: se já registramos esta referência, devolve o estado atual
    ja_existe = (await db.execute(
        select(Pagamento).where(Pagamento.referencia == data.referencia)
    )).scalar_one_or_none()
    if ja_existe:
        return {"status": "ignorado", "motivo": "evento já processado", "pagamento_id": ja_existe.id}

    assinatura = (await db.execute(
        select(Assinatura).where(Assinatura.id == data.assinatura_id)
    )).scalar_one_or_none()
    if not assinatura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assinatura não encontrada.")

    pagamento = Pagamento(
        assinatura_id=assinatura.id,
        valor=data.valor,
        status=data.status,
        referencia=data.referencia,
        data_pagamento=_now() if data.status == StatusPagamento.PAGO else None,
    )
    db.add(pagamento)

    # Reflete o pagamento no estado da assinatura
    if data.status == StatusPagamento.PAGO:
        assinatura.status = StatusAssinatura.ATIVA
        assinatura.fim = None
    elif data.status == StatusPagamento.FALHOU:
        assinatura.status = StatusAssinatura.SUSPENSA
    elif data.status == StatusPagamento.ESTORNADO:
        assinatura.status = StatusAssinatura.CANCELADA
        assinatura.fim = _now()

    await registrar_auditoria(
        db=db, loja_id=assinatura.loja_id, ator_id=None,
        ator_nome="gateway_pagamento", acao="pagamento.webhook",
        entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "referencia": data.referencia,
            "status_pagamento": data.status.value,
            "novo_status_assinatura": assinatura.status.value,
        }),
    )
    await db.commit()
    return {"status": "processado", "assinatura_status": assinatura.status.value}
