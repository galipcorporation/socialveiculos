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
from models import LeadTriagem, Conversa, Mensagem, MarketingUsage, TipoConversa

router = APIRouter(prefix="/v1", tags=["Triagem IA"])

# IA da plataforma: Groq (Llama), API compatível com OpenAI — mesma stack do
# Marketing e do Assistente do Vendedor.
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_TRIAGEM_MODEL = os.getenv("GROQ_TRIAGEM_MODEL", "llama-3.3-70b-versatile")

# Só as últimas mensagens interessam: o interesse do cliente é o estado ATUAL da
# conversa, não o histórico inteiro (e mantém o prompt barato).
TRIAGEM_ULTIMAS_MENSAGENS = 3


def _now() -> datetime:
    # NAIVE UTC: colunas são TIMESTAMP WITHOUT TIME ZONE; o Postgres/asyncpg
    # rejeita datetime aware em escrita E em comparação. Ver ARMADILHAS-PRODUCAO.md #1.
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Schemas ────────────────────────────────────────────────────

class TriagemOut(BaseModel):
    conversa_id: str
    score: int
    classificacao: str  # quente | ruido | pendente_revisao
    justificativa: Optional[str] = None
    precisa_revisao_manual: bool = False
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TriagemListItem(BaseModel):
    conversa_id: str
    score: int
    classificacao: str
    justificativa: Optional[str] = None
    precisa_revisao_manual: bool = False
    updated_at: datetime


# ── Lógica de triagem ──────────────────────────────────────────

async def _classificar_conversa(mensagens: list[Mensagem]) -> dict:
    """Classifica o lead com a IA da plataforma. Retorna score + classificacao + justificativa."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {
            "score": 50,
            "classificacao": "pendente_revisao",
            "justificativa": "IA não configurada — classificação pendente, defina manualmente.",
            "precisa_revisao_manual": True,
        }

    recentes = mensagens[-TRIAGEM_ULTIMAS_MENSAGENS:]
    historico = "\n".join(
        f"{'Cliente' if m.autor_id is None else 'Vendedor'}: {m.conteudo}"
        for m in recentes
    )

    prompt = f"""Você é um especialista em vendas de veículos. Analise as últimas mensagens desta conversa entre cliente e vendedor de uma loja de veículos.

ÚLTIMAS MENSAGENS:
{historico}

Classifique o interesse do cliente e responda SOMENTE com JSON válido no formato:
{{
  "score": <inteiro 0-100>,
  "classificacao": "<quente|ruido>",
  "justificativa": "<1 frase curta explicando>"
}}

Critérios:
- quente (score >= 60): cliente sinaliza intenção real de fechar — quer agendar test drive, pede simulação de financiamento/entrada, negocia condições dentro do razoável, pergunta sobre documentação ou disponibilidade para comprar agora.
- ruido (score < 60): cliente só curioso ou pesquisando preço, compra adiada para um futuro distante, oferta muito abaixo do valor pedido, mensagens vazias/ofensivas, testando o bot.

IMPORTANTE: os sinais de ruído têm PRECEDÊNCIA. Falar de preço ou pedir informação
NÃO torna o lead quente por si só — o que vale é a intenção real de comprar.
Exemplos: "faz por metade do preço?" é ruido (oferta irreal), "só olhando, compro
daqui uns anos" é ruido (sem intenção agora), mesmo citando preço ou o veículo.

Responda APENAS o JSON, sem mais nada."""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": GROQ_TRIAGEM_MODEL,
                    "max_tokens": 150,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            text = payload["choices"][0]["message"]["content"].strip()
            bruto = json.loads(text)

            # A IA pode devolver JSON válido com chaves faltando ou fora do
            # domínio esperado; normaliza aqui para o endpoint nunca quebrar.
            classificacao = str(bruto.get("classificacao", "")).lower().strip()
            if classificacao not in ("quente", "ruido"):
                raise ValueError(f"classificacao inesperada: {classificacao!r}")
            score = int(bruto["score"])
            if not 0 <= score <= 100:
                raise ValueError(f"score fora de 0-100: {score}")

            usage = payload.get("usage", {})
            return {
                "score": score,
                "classificacao": classificacao,
                "justificativa": str(bruto.get("justificativa") or "").strip() or None,
                "precisa_revisao_manual": False,
                "tokens_input": usage.get("prompt_tokens", 0),
                "tokens_output": usage.get("completion_tokens", 0),
            }
    except Exception:
        return {
            "score": 50,
            "classificacao": "pendente_revisao",
            "justificativa": "Erro na classificação por IA — defina manualmente.",
            "precisa_revisao_manual": True,
        }


# ── Endpoint: classificar conversa (chamado ao iniciar ou atualizar) ──

@router.post("/gestor/triagem/{conversa_id}", response_model=TriagemOut)
async def triar_conversa(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    """Classifica (ou reclassifica) uma conversa B2C com IA."""
    # Sem loja no contexto (admin sem X-Loja-Id) o filtro por loja_id viraria
    # `IS NULL` e deixaria de isolar o tenant — corta antes de consultar.
    if not ctx.loja_id:
        raise HTTPException(status_code=409, detail="Selecione uma loja para triar conversas.")

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

    # Consumo sempre atribuído à loja DONA da conversa (já validada acima),
    # nunca ao operador — admin de suporte não polui a conta de outra loja.
    if resultado.get("tokens_input") or resultado.get("tokens_output"):
        db.add(MarketingUsage(
            loja_id=conversa.loja_id,
            usuario_id=ctx.usuario.id,
            funcionalidade="triagem",
            provedor="groq",
            modelo=GROQ_TRIAGEM_MODEL,
            tokens_input=resultado.get("tokens_input", 0),
            tokens_output=resultado.get("tokens_output", 0),
            byok=False,
        ))

    triagem_res = await db.execute(
        select(LeadTriagem).where(LeadTriagem.conversa_id == conversa_id)
    )
    triagem = triagem_res.scalar_one_or_none()
    agora = _now()

    if triagem:
        triagem.score = resultado["score"]
        triagem.classificacao = resultado["classificacao"]
        triagem.justificativa = resultado.get("justificativa")
        triagem.precisa_revisao_manual = resultado.get("precisa_revisao_manual", False)
        triagem.updated_at = agora
    else:
        triagem = LeadTriagem(
            conversa_id=conversa_id,
            score=resultado["score"],
            classificacao=resultado["classificacao"],
            justificativa=resultado.get("justificativa"),
            precisa_revisao_manual=resultado.get("precisa_revisao_manual", False),
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
    filtro: Optional[str] = None,  # quente | ruido | pendente_revisao
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
    if filtro in ("quente", "ruido", "pendente_revisao"):
        stmt = stmt.where(LeadTriagem.classificacao == filtro)

    res = await db.execute(stmt)
    triagens = res.scalars().all()
    return [
        TriagemListItem(
            conversa_id=t.conversa_id,
            score=t.score,
            classificacao=t.classificacao,
            justificativa=t.justificativa,
            precisa_revisao_manual=t.precisa_revisao_manual,
            updated_at=t.updated_at,
        )
        for t in triagens
    ]
