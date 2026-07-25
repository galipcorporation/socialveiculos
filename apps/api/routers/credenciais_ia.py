"""
Social Veículos — Credenciais de IA (BYOK) por loja (M024)
Permite ao gestor cadastrar sua própria chave de API de IA (Anthropic, OpenAI, Gemini).
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import CredencialIA
from rbac import exige_permissao, Acao, Recurso
from simulador.crypt import encrypt_credentials, decrypt_credentials

router = APIRouter(prefix="/v1/configuracoes/credenciais-ia", tags=["Credenciais IA (BYOK)"])
logger = logging.getLogger(__name__)

PROVEDORES_VALIDOS = {"anthropic", "openai", "gemini"}


class CredencialIARequest(BaseModel):
    provedor: str = Field(..., description='"anthropic" | "openai" | "gemini"')
    api_key: str = Field(..., min_length=10)
    modelo_padrao: Optional[str] = None


class CredencialIAResponse(BaseModel):
    id: str
    loja_id: str
    provedor: str
    modelo_padrao: Optional[str]
    configurada: bool
    ativo: bool

    model_config = ConfigDict(from_attributes=True)


def _to_response(c: CredencialIA) -> dict:
    return {
        "id": c.id,
        "loja_id": c.loja_id,
        "provedor": c.provedor,
        "modelo_padrao": c.modelo_padrao,
        "configurada": True,
        "ativo": c.ativo,
    }


@router.get("", response_model=List[CredencialIAResponse],
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))])
async def listar_credenciais_ia(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Lista provedores configurados (nunca devolve a api_key)."""
    res = await db.execute(select(CredencialIA).where(CredencialIA.loja_id == context.loja_id))
    return [_to_response(c) for c in res.scalars().all()]


@router.post("", response_model=CredencialIAResponse,
             dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def salvar_credencial_ia(
    data: CredencialIARequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Salva/atualiza a api_key de um provedor. Valida a chave antes de persistir."""
    provedor = data.provedor.lower()
    if provedor not in PROVEDORES_VALIDOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Provedor inválido. Use: {', '.join(PROVEDORES_VALIDOS)}")

    # Validação rápida da chave chamando o provedor
    await _validar_chave(provedor, data.api_key)

    api_key_cifrada = encrypt_credentials(data.api_key)

    res = await db.execute(
        select(CredencialIA).where(
            CredencialIA.loja_id == context.loja_id,
            CredencialIA.provedor == provedor,
        )
    )
    cred = res.scalar_one_or_none()
    if cred:
        cred.api_key_cifrada = api_key_cifrada
        cred.modelo_padrao = data.modelo_padrao
        cred.ativo = True
    else:
        cred = CredencialIA(
            loja_id=context.loja_id,
            provedor=provedor,
            api_key_cifrada=api_key_cifrada,
            modelo_padrao=data.modelo_padrao,
            ativo=True,
        )
        db.add(cred)

    await db.commit()
    await db.refresh(cred)
    return _to_response(cred)


@router.delete("/{provedor}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def remover_credencial_ia(
    provedor: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    res = await db.execute(
        select(CredencialIA).where(
            CredencialIA.loja_id == context.loja_id,
            CredencialIA.provedor == provedor.lower(),
        )
    )
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Credencial não encontrada.")
    await db.delete(cred)
    await db.commit()


async def _validar_chave(provedor: str, api_key: str) -> None:
    """Faz chamada mínima ao provedor para validar a chave antes de salvar.

    Só considera a chave válida se a chamada realmente confirmou isso (2xx ou
    um erro de auth explícito do provedor). Falha de rede/timeout não bloqueia
    o save mas também NÃO aprova a chave — sobe 503 pedindo nova tentativa.
    Qualquer exceção fora desse esperado é logada como erro real e propagada,
    nunca tratada como "chave válida".
    """
    try:
        if provedor == "anthropic":
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-haiku-4-5-20251001", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
                    timeout=10.0,
                )
                if r.status_code == 401:
                    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chave Anthropic inválida ou sem permissão.")
                r.raise_for_status()
        elif provedor == "openai":
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10.0,
                )
                if r.status_code == 401:
                    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chave OpenAI inválida.")
                r.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        # Rede/API fora do ar: não sabemos se a chave é válida, então não aprova.
        logger.warning("Falha de rede ao validar chave %s: %s", provedor, e)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível validar a chave agora (falha de rede/API fora do ar). Tente novamente.",
        )
    except Exception:
        # Qualquer outra exceção (ex.: schema de resposta mudou) é um erro real,
        # não sinal de chave válida — loga e propaga em vez de engolir.
        logger.error("Erro inesperado ao validar chave %s", provedor, exc_info=True)
        raise


async def resolver_api_key_ia(loja_id: str, db: AsyncSession) -> tuple[str, str]:
    """Retorna (api_key, provedor). BYOK tem prioridade; fallback é chave da plataforma."""
    import os
    res = await db.execute(
        select(CredencialIA).where(
            CredencialIA.loja_id == loja_id,
            CredencialIA.ativo == True,
            CredencialIA.provedor == "anthropic",
        )
    )
    cred = res.scalar_one_or_none()
    if cred:
        return decrypt_credentials(cred.api_key_cifrada), "anthropic"
    platform_key = os.getenv("ANTHROPIC_API_KEY", "")
    if platform_key:
        return platform_key, "anthropic"
    raise HTTPException(
        status_code=503,
        detail="Nenhuma chave de IA configurada. Vá em Configurações → Inteligência Artificial.",
    )
