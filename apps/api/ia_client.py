"""
Social Veículos — Cliente de IA compartilhado.

Rotina única de chamada ao modelo, com cadeia de provedores
(BYOK da loja → Groq → OpenAI → Anthropic), retentativa por provedor e
telemetria em `marketing_usage`.

Nasceu dentro de `routers/marketing.py` (`_chamar_ia`) e foi promovida a
utilitário quando a AURA (M124) passou a precisar da mesma cadeia. Nenhuma
funcionalidade deve criar um segundo cliente de IA: a contagem de tokens, o
BYOK e o fallback entre provedores vivem aqui.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import CredencialIA, MarketingUsage

logger = logging.getLogger("ia_client")

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODELO_PADRAO = os.getenv("GROQ_MARKETING_MODEL", "llama-3.3-70b-versatile")
OPENAI_MODELO_PADRAO = "gpt-4o-mini"
ANTHROPIC_MODELO_PADRAO = "claude-haiku-4-5-20251001"


@dataclass
class RespostaIA:
    """Retorno de uma chamada bem-sucedida ao modelo."""
    texto: str
    provedor: str
    modelo: str
    tokens_input: int
    tokens_output: int
    byok: bool


@dataclass
class _Candidato:
    provedor: str
    api_key: str
    base_url: str
    modelo: str
    byok: bool


async def _byok_da_loja(db: AsyncSession, loja_id: str) -> list[_Candidato]:
    """Chaves que a própria loja cadastrou (cifradas). Têm prioridade na cadeia."""
    from simulador.crypt import decrypt_credentials

    res = await db.execute(
        select(CredencialIA).where(
            CredencialIA.loja_id == loja_id,
            CredencialIA.ativo == True,  # noqa: E712 — SQLAlchemy
        )
    )
    candidatos: list[_Candidato] = []
    for cred in res.scalars().all():
        try:
            chave = decrypt_credentials(cred.api_key_cifrada)
        except Exception as exc:  # chave corrompida não pode derrubar a cadeia
            logger.error(f"[IA] BYOK ilegível da loja {loja_id} ({cred.provedor}): {exc}")
            continue
        if not chave:
            continue
        if cred.provedor == "anthropic":
            candidatos.append(_Candidato(
                "anthropic", chave, "https://api.anthropic.com/v1",
                cred.modelo_padrao or ANTHROPIC_MODELO_PADRAO, True,
            ))
        elif cred.provedor == "openai":
            candidatos.append(_Candidato(
                "openai", chave, "https://api.openai.com/v1",
                cred.modelo_padrao or OPENAI_MODELO_PADRAO, True,
            ))
        elif cred.provedor == "groq":
            candidatos.append(_Candidato(
                "groq", chave, GROQ_BASE_URL,
                cred.modelo_padrao or GROQ_MODELO_PADRAO, True,
            ))
    return candidatos


def _da_plataforma(modelo_groq: Optional[str] = None) -> list[_Candidato]:
    """Chaves da plataforma, em ordem de preferência (mais barata primeiro)."""
    candidatos: list[_Candidato] = []
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    if groq_key:
        candidatos.append(_Candidato(
            "groq", groq_key, GROQ_BASE_URL, modelo_groq or GROQ_MODELO_PADRAO, False,
        ))
    if openai_key:
        candidatos.append(_Candidato(
            "openai", openai_key, "https://api.openai.com/v1", OPENAI_MODELO_PADRAO, False,
        ))
    if anthropic_key:
        candidatos.append(_Candidato(
            "anthropic", anthropic_key, "https://api.anthropic.com/v1", ANTHROPIC_MODELO_PADRAO, False,
        ))
    return candidatos


async def chamar_ia(
    *,
    db: AsyncSession,
    loja_id: str,
    usuario_id: Optional[str],
    funcionalidade: str,
    prompt_system: str,
    conteudo: str,
    max_tokens: int = 700,
    temperatura: float = 0.4,
    json_mode: bool = False,
    modelo_groq: Optional[str] = None,
    usar_byok: bool = True,
    registrar_consumo: bool = True,
) -> RespostaIA:
    """
    Chama o modelo pela cadeia de provedores e devolve texto + telemetria.

    `funcionalidade` vai para `marketing_usage.funcionalidade` e é o que separa
    o consumo por área no painel do admin ("marketing", "aura", "triagem", ...).

    Levanta 503 se não há nenhuma chave configurada e 502 se todos os provedores
    falharam — nunca devolve texto inventado.
    """
    candidatos: list[_Candidato] = []
    if usar_byok and loja_id:
        candidatos.extend(await _byok_da_loja(db, loja_id))
    candidatos.extend(_da_plataforma(modelo_groq))

    if not candidatos:
        raise HTTPException(
            status_code=503,
            detail=(
                "Nenhuma chave de IA configurada. Cadastre a chave da loja em "
                "Configurações → Inteligência Artificial, ou defina GROQ_API_KEY no servidor."
            ),
        )

    erros: list[str] = []

    async with httpx.AsyncClient() as client:
        for cand in candidatos:
            try:
                if cand.provedor == "anthropic":
                    texto, tokens_in, tokens_out = await _chamar_anthropic(
                        client, cand, prompt_system, conteudo, max_tokens, temperatura,
                    )
                else:
                    texto, tokens_in, tokens_out = await _chamar_openai_compat(
                        client, cand, prompt_system, conteudo, max_tokens, temperatura, json_mode,
                    )

                if not texto:
                    erros.append(f"{cand.provedor}: resposta vazia")
                    continue

                if registrar_consumo:
                    db.add(MarketingUsage(
                        loja_id=loja_id,
                        usuario_id=usuario_id,
                        funcionalidade=funcionalidade,
                        provedor=cand.provedor,
                        modelo=cand.modelo,
                        tokens_input=tokens_in,
                        tokens_output=tokens_out,
                        byok=cand.byok,
                    ))
                    await db.commit()

                return RespostaIA(
                    texto=texto,
                    provedor=cand.provedor,
                    modelo=cand.modelo,
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                    byok=cand.byok,
                )
            except httpx.HTTPStatusError as exc:
                corpo = exc.response.text[:200]
                logger.error(f"[IA:{funcionalidade}] {cand.provedor} HTTP {exc.response.status_code}: {corpo}")
                erros.append(f"{cand.provedor}: HTTP {exc.response.status_code}")
            except httpx.RequestError as exc:
                logger.error(f"[IA:{funcionalidade}] {cand.provedor} erro de conexão: {exc}")
                erros.append(f"{cand.provedor}: erro de conexão")
            except Exception as exc:
                logger.error(f"[IA:{funcionalidade}] {cand.provedor} erro inesperado: {exc}")
                erros.append(f"{cand.provedor}: {exc}")

    raise HTTPException(
        status_code=502,
        detail=f"Falha ao conectar com o serviço de IA ({' | '.join(erros)}).",
    )


async def _chamar_anthropic(
    client: httpx.AsyncClient,
    cand: _Candidato,
    prompt_system: str,
    conteudo: str,
    max_tokens: int,
    temperatura: float,
) -> tuple[str, int, int]:
    resp = await client.post(
        f"{cand.base_url}/messages",
        headers={
            "x-api-key": cand.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": cand.modelo,
            "max_tokens": max_tokens,
            "temperature": temperatura,
            "system": prompt_system,
            "messages": [{"role": "user", "content": conteudo}],
        },
        timeout=45.0,
    )
    resp.raise_for_status()
    data = resp.json()
    blocos = data.get("content", [])
    texto = blocos[0].get("text", "") if blocos else ""
    uso = data.get("usage", {})
    return texto, uso.get("input_tokens", 0), uso.get("output_tokens", 0)


async def _chamar_openai_compat(
    client: httpx.AsyncClient,
    cand: _Candidato,
    prompt_system: str,
    conteudo: str,
    max_tokens: int,
    temperatura: float,
    json_mode: bool,
) -> tuple[str, int, int]:
    corpo = {
        "model": cand.modelo,
        "max_tokens": max_tokens,
        "temperature": temperatura,
        "messages": [
            {"role": "system", "content": prompt_system},
            {"role": "user", "content": conteudo},
        ],
    }
    headers = {"Authorization": f"Bearer {cand.api_key}", "content-type": "application/json"}

    corpo_envio = {**corpo, "response_format": {"type": "json_object"}} if json_mode else corpo
    resp = await client.post(
        f"{cand.base_url}/chat/completions", headers=headers, json=corpo_envio, timeout=45.0,
    )
    # Nem todo modelo aceita response_format; cair para a chamada sem ele é melhor
    # que perder o provedor inteiro da cadeia.
    if resp.status_code == 400 and json_mode and "response_format" in resp.text:
        resp = await client.post(
            f"{cand.base_url}/chat/completions", headers=headers, json=corpo, timeout=45.0,
        )

    resp.raise_for_status()
    data = resp.json()
    escolhas = data.get("choices", [])
    texto = escolhas[0].get("message", {}).get("content", "") if escolhas else ""
    uso = data.get("usage", {})
    return texto, uso.get("prompt_tokens", 0), uso.get("completion_tokens", 0)
