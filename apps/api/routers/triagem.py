"""
Social Veículos — Triagem IA de Leads B2C
Classifica automaticamente conversas de clientes finais como 'quente' ou 'ruido'.
Não se aplica a conversas B2B entre vendedores.
"""
import os
import json
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import LeadTriagem, Conversa, Mensagem, TipoConversa

router = APIRouter(prefix="/v1", tags=["Triagem IA"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def _now() -> datetime:
    # NAIVE UTC: colunas são TIMESTAMP WITHOUT TIME ZONE; o Postgres/asyncpg
    # rejeita datetime aware em escrita E em comparação. Ver ARMADILHAS-PRODUCAO.md #1.
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Schemas ────────────────────────────────────────────────────

class TriagemOut(BaseModel):
    conversa_id: str
    score: int
    classificacao: str  # quente | ruido
    justificativa: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TriagemListItem(BaseModel):
    conversa_id: str
    score: int
    classificacao: str
    justificativa: Optional[str] = None
    updated_at: datetime


# ── Lógica de triagem ──────────────────────────────────────────

async def _classificar_conversa(mensagens: list[Mensagem]) -> dict:
    """Chama Claude para classificar o lead. Retorna score + classificacao + justificativa."""
    if not ANTHROPIC_API_KEY:
        return {"score": 50, "classificacao": "quente", "justificativa": "IA não configurada — aprovado por padrão."}

    historico = "\n".join(
        f"{'Cliente' if m.autor_id is None else 'Vendedor'}: {m.conteudo}"
        for m in mensagens[:20]  # máximo 20 mensagens para economizar tokens
    )

    prompt = f"""Você é um especialista em vendas de veículos. Analise esta conversa entre cliente e vendedor de uma loja de veículos.

CONVERSA:
{historico}

Classifique o interesse do cliente e responda SOMENTE com JSON válido no formato:
{{
  "score": <inteiro 0-100>,
  "classificacao": "<quente|ruido>",
  "justificativa": "<1 frase curta explicando>"
}}

Critérios:
- quente (score >= 60): cliente faz perguntas específicas sobre preço, financiamento, test drive, documentação, disponibilidade
- ruido (score < 60): cliente só curioso, pedindo desconto absurdo, sem interesse real, testando o bot, mensagens vazias/ofensivas

Responda APENAS o JSON, sem mais nada."""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 150,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            text = resp.json()["content"][0]["text"].strip()
            return json.loads(text)
    except Exception:
        return {"score": 50, "classificacao": "quente", "justificativa": "Erro na classificação — aprovado por padrão."}


# ── Endpoint: classificar conversa (chamado ao iniciar ou atualizar) ──

@router.post("/gestor/triagem/{conversa_id}", response_model=TriagemOut)
async def triar_conversa(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    """Classifica (ou reclassifica) uma conversa B2C com IA."""
    conv_res = await db.execute(
        select(Conversa)
        .options(selectinload(Conversa.mensagens))
        .where(
            Conversa.id == conversa_id,
            Conversa.tipo == TipoConversa.B2C,
            Conversa.loja_id == ctx.loja_id,
        )
    )
    conversa = conv_res.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa B2C não encontrada.")

    if not conversa.mensagens:
        raise HTTPException(status_code=400, detail="Conversa sem mensagens para classificar.")

    resultado = await _classificar_conversa(conversa.mensagens)

    triagem_res = await db.execute(
        select(LeadTriagem).where(LeadTriagem.conversa_id == conversa_id)
    )
    triagem = triagem_res.scalar_one_or_none()
    agora = _now()

    if triagem:
        triagem.score = resultado["score"]
        triagem.classificacao = resultado["classificacao"]
        triagem.justificativa = resultado.get("justificativa")
        triagem.updated_at = agora
    else:
        triagem = LeadTriagem(
            conversa_id=conversa_id,
            score=resultado["score"],
            classificacao=resultado["classificacao"],
            justificativa=resultado.get("justificativa"),
            created_at=agora,
            updated_at=agora,
        )
        db.add(triagem)

    await db.commit()
    await db.refresh(triagem)
    return triagem


# ── Listar triagens da loja ────────────────────────────────────

@router.get("/gestor/triagem", response_model=List[TriagemListItem])
async def listar_triagens(
    filtro: Optional[str] = None,  # quente | ruido
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    """Lista triagens de conversas B2C da loja. filtro=ruido traz só os ruins."""
    stmt = (
        select(LeadTriagem)
        .join(Conversa, LeadTriagem.conversa_id == Conversa.id)
        .where(
            Conversa.tipo == TipoConversa.B2C,
            Conversa.loja_id == ctx.loja_id,
        )
        .order_by(LeadTriagem.score.desc())
    )
    if filtro in ("quente", "ruido"):
        stmt = stmt.where(LeadTriagem.classificacao == filtro)

    res = await db.execute(stmt)
    triagens = res.scalars().all()
    return [
        TriagemListItem(
            conversa_id=t.conversa_id,
            score=t.score,
            classificacao=t.classificacao,
            justificativa=t.justificativa,
            updated_at=t.updated_at,
        )
        for t in triagens
    ]
