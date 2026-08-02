"""
Social Veículos — Rotas da AURA (M124), a assistente interna do lojista.

Protegida pelo módulo `assistente_ia`. A conversa é privada por usuário: nenhuma
rota aqui aceita `usuario_id` do cliente — o dono da conversa é sempre quem está
autenticado, e a loja vem do contexto, nunca do corpo da requisição.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from aura import motor
from aura.dominios import FERRAMENTAS
from aura.permissoes import resolver_escopo
from database import get_db
from deps import B2BContext
from models import AURA_AUTOR_AURA, AuraConversa, AuraMensagem, utcnow
from modulos import Modulo, exige_modulo

router = APIRouter(prefix="/v1/aura", tags=["AURA"])

DESTINOS_VALIDOS = {rota for _, rota in FERRAMENTAS.values()}


# ─────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────

class AtalhoResponse(BaseModel):
    rotulo: str
    destino: str
    params: dict = Field(default_factory=dict)


class MensagemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    autor: str
    conteudo: str
    atalhos: list[AtalhoResponse] = Field(default_factory=list)
    avaliacao: Optional[int] = None
    latencia_ms: Optional[int] = None
    created_at: Optional[str] = None


class CotaResponse(BaseModel):
    usadas: int
    limite: int
    restantes: int
    tokens_input: int
    tokens_output: int


class ConversaResponse(BaseModel):
    id: str
    silenciada: bool
    cota: CotaResponse
    escopo: dict


class PerguntarRequest(BaseModel):
    pergunta: str = Field(min_length=1, max_length=2000)


class PerguntarResponse(BaseModel):
    pergunta: MensagemResponse
    resposta: MensagemResponse
    cota: CotaResponse


class AvaliarRequest(BaseModel):
    util: bool


class AtalhoSeguidoRequest(BaseModel):
    destino: str = Field(max_length=100)


class SilenciarRequest(BaseModel):
    silenciada: bool


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _para_response(msg: AuraMensagem) -> MensagemResponse:
    atalhos: list[AtalhoResponse] = []
    if msg.atalhos:
        try:
            bruto = json.loads(msg.atalhos)
        except (ValueError, TypeError):
            bruto = []
        if isinstance(bruto, list):
            atalhos = [AtalhoResponse(**a) for a in bruto if isinstance(a, dict)]

    return MensagemResponse(
        id=msg.id,
        autor=msg.autor,
        conteudo=msg.conteudo,
        atalhos=atalhos,
        avaliacao=msg.avaliacao,
        latencia_ms=msg.latencia_ms,
        created_at=msg.created_at.isoformat() if msg.created_at else None,
    )


async def _cota(db: AsyncSession, context: B2BContext) -> CotaResponse:
    limite = motor.cota_da_loja(context.loja)
    usadas = await motor.consumo_do_mes(db, context.loja.id)
    custo = await motor.custo_do_mes(db, context.loja.id)
    return CotaResponse(
        usadas=usadas,
        limite=limite,
        restantes=max(limite - usadas, 0),
        tokens_input=custo["tokens_input"],
        tokens_output=custo["tokens_output"],
    )


async def _minha_conversa(db: AsyncSession, context: B2BContext) -> AuraConversa:
    """Conversa do usuário autenticado nesta loja. Não existe rota para a de outro."""
    return await motor.obter_ou_criar_conversa(db, context.loja.id, context.usuario.id)


async def _minha_mensagem(db: AsyncSession, context: B2BContext, mensagem_id: str) -> AuraMensagem:
    """
    Mensagem da conversa de quem está autenticado.

    O filtro é por conversa DO USUÁRIO, não só por loja: sem isso um gestor
    conseguiria avaliar (e portanto enumerar) o que o vendedor perguntou.
    """
    conversa = await _minha_conversa(db, context)
    res = await db.execute(
        select(AuraMensagem).where(
            AuraMensagem.id == mensagem_id,
            AuraMensagem.conversa_id == conversa.id,
            AuraMensagem.loja_id == context.loja.id,
        )
    )
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")
    return msg


# ─────────────────────────────────────────────────────────────
# Rotas
# ─────────────────────────────────────────────────────────────

@router.get("/conversa", response_model=ConversaResponse)
async def obter_conversa(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """Conversa fixada da AURA para este usuário nesta loja (cria na primeira vez)."""
    conversa = await _minha_conversa(db, context)
    escopo = resolver_escopo(context)
    return ConversaResponse(
        id=conversa.id,
        silenciada=conversa.silenciada,
        cota=await _cota(db, context),
        escopo={
            "papel": escopo.papel.value,
            "ve_custo_e_margem": escopo.ve_custo_e_margem,
            "ve_financeiro": escopo.ve_financeiro,
            "edita_memoria_da_loja": escopo.edita_memoria_da_loja,
        },
    )


@router.get("/mensagens", response_model=list[MensagemResponse])
async def listar_mensagens(
    limite: int = 50,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """Histórico da conversa do usuário autenticado, do mais antigo para o mais novo."""
    conversa = await _minha_conversa(db, context)
    res = await db.execute(
        select(AuraMensagem)
        .where(AuraMensagem.conversa_id == conversa.id)
        .order_by(AuraMensagem.created_at.desc())
        .limit(min(max(limite, 1), 200))
    )
    return [_para_response(m) for m in reversed(res.scalars().all())]


@router.post("/perguntar", response_model=PerguntarResponse)
async def perguntar(
    payload: PerguntarRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """Uma pergunta à AURA. A resposta vem inteira — não há transmissão progressiva na v1."""
    conversa = await _minha_conversa(db, context)
    try:
        msg_usuario, msg_aura = await motor.responder(
            db=db, context=context, conversa=conversa, pergunta=payload.pergunta,
        )
    except motor.CotaEsgotada as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Cota da AURA esgotada neste mês ({exc.usadas} de {exc.cota} perguntas). "
                "Fale com o suporte para aumentar o limite."
            ),
            headers={"X-Aura-Cota": str(exc.cota)},
        ) from exc

    return PerguntarResponse(
        pergunta=_para_response(msg_usuario),
        resposta=_para_response(msg_aura),
        cota=await _cota(db, context),
    )


@router.post("/mensagens/{mensagem_id}/avaliar", response_model=MensagemResponse)
async def avaliar(
    mensagem_id: str,
    payload: AvaliarRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """Evento `aura_resposta_avaliada` — insumo de melhoria e alerta de resposta ruim."""
    msg = await _minha_mensagem(db, context, mensagem_id)
    if msg.autor != AURA_AUTOR_AURA:
        raise HTTPException(status_code=400, detail="Só a resposta da AURA pode ser avaliada.")
    msg.avaliacao = 1 if payload.util else -1
    await db.commit()
    await db.refresh(msg)
    return _para_response(msg)


@router.post("/mensagens/{mensagem_id}/atalho", status_code=status.HTTP_204_NO_CONTENT)
async def registrar_atalho(
    mensagem_id: str,
    payload: AtalhoSeguidoRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """
    Evento `aura_atalho_seguido` — o indicador mais importante do produto.

    Só aceita destino do mapa de ferramentas: o campo vai para o banco e não pode
    virar depósito de texto arbitrário vindo do cliente.
    """
    msg = await _minha_mensagem(db, context, mensagem_id)
    if payload.destino not in DESTINOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Destino desconhecido.")
    msg.atalho_seguido = payload.destino
    await db.commit()


@router.post("/silenciar", response_model=ConversaResponse)
async def silenciar(
    payload: SilenciarRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    conversa = await _minha_conversa(db, context)
    conversa.silenciada = payload.silenciada
    await db.commit()
    await db.refresh(conversa)
    escopo = resolver_escopo(context)
    return ConversaResponse(
        id=conversa.id,
        silenciada=conversa.silenciada,
        cota=await _cota(db, context),
        escopo={
            "papel": escopo.papel.value,
            "ve_custo_e_margem": escopo.ve_custo_e_margem,
            "ve_financeiro": escopo.ve_financeiro,
            "edita_memoria_da_loja": escopo.edita_memoria_da_loja,
        },
    )


@router.delete("/mensagens", status_code=status.HTTP_204_NO_CONTENT)
async def limpar_historico(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(exige_modulo(Modulo.ASSISTENTE_IA)),
):
    """
    Apaga o histórico da própria conversa (LGPD).

    A conversa sobrevive: só o conteúdo sai. O consumo já contabilizado em
    `marketing_usage` fica — é registro de faturamento, não conteúdo pessoal.
    """
    conversa = await _minha_conversa(db, context)
    await db.execute(delete(AuraMensagem).where(AuraMensagem.conversa_id == conversa.id))
    conversa.ultima_mensagem_em = utcnow()
    await db.commit()
