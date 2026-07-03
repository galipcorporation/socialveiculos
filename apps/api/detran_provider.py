"""
Provedor plugável de consultas ao DETRAN para a esteira pós-venda
(ESTEIRA-POS-VENDA.md §11 Fase 3): débitos (IPVA/licenciamento/multas),
situação da ATPV-e e vistoria.

BYOF (Bring Your Own Fornecedor): cada loja contrata o próprio agregador
(Infosimples, despachante-tech, etc.) e cadastra URL + chave em
Configurações → Consulta DETRAN. A credencial fica cifrada por loja
(models.CredencialDetran). Sem credencial ativa → `disponivel=False` e a UI
mostra "consulta indisponível" — nunca um valor fake (social.md §6).

Contrato HTTP esperado do fornecedor da loja (documentado na UI):
    POST {api_url}/debitos   Auth: Bearer {chave}   body: {"placa", "renavam"}
      → {"ipva", "licenciamento", "multas", "total", "fonte"?}
    POST {api_url}/situacao  Auth: Bearer {chave}   body: {"placa", "renavam"}
      → {"atpve_emitida", "transferencia_concluida", "proprietario_atual", "fonte"?}
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import CredencialDetran
from simulador.crypt import decrypt_credentials

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(15.0)


@dataclass
class ConsultaDebitos:
    disponivel: bool = False
    total: Optional[float] = None
    ipva: Optional[float] = None
    licenciamento: Optional[float] = None
    multas: Optional[float] = None
    fonte: Optional[str] = None
    mensagem: str = "Consulta de débitos indisponível — nenhum provedor configurado."


@dataclass
class ConsultaSituacao:
    disponivel: bool = False
    atpve_emitida: Optional[bool] = None
    transferencia_concluida: Optional[bool] = None
    proprietario_atual: Optional[str] = None
    fonte: Optional[str] = None
    mensagem: str = "Consulta de situação indisponível — nenhum provedor configurado."


def _as_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _as_bool(v) -> Optional[bool]:
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, str):
        return v.strip().lower() in {"true", "1", "sim", "yes"}
    return bool(v)


async def _carregar_credencial(loja_id: str, db: AsyncSession) -> Optional[CredencialDetran]:
    res = await db.execute(
        select(CredencialDetran).where(
            CredencialDetran.loja_id == loja_id,
            CredencialDetran.ativo == True,  # noqa: E712
        )
    )
    return res.scalar_one_or_none()


async def _post(cred: CredencialDetran, path: str, placa: str, renavam: Optional[str]) -> Optional[dict]:
    """Chama o fornecedor da loja. Retorna dict da resposta ou None em falha
    (mantém a regra: nunca inventa dado — falha vira indisponível)."""
    api_key = decrypt_credentials(cred.api_key_cifrada)
    url = cred.api_url.rstrip("/") + path
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
                json={"placa": placa, "renavam": renavam},
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.error(f"[DETRAN] Falha ao consultar {url}: {e}")
        return None


async def consultar_debitos(loja_id: str, placa: str, db: AsyncSession, renavam: Optional[str] = None) -> ConsultaDebitos:
    cred = await _carregar_credencial(loja_id, db)
    if not cred:
        return ConsultaDebitos()
    data = await _post(cred, "/debitos", placa, renavam)
    if data is None:
        return ConsultaDebitos(mensagem="Consulta de débitos temporariamente indisponível — falha no provedor.")
    return ConsultaDebitos(
        disponivel=True,
        total=_as_float(data.get("total")),
        ipva=_as_float(data.get("ipva")),
        licenciamento=_as_float(data.get("licenciamento")),
        multas=_as_float(data.get("multas")),
        fonte=data.get("fonte") or "Fornecedor configurado",
        mensagem="",
    )


async def consultar_situacao(loja_id: str, placa: str, db: AsyncSession, renavam: Optional[str] = None) -> ConsultaSituacao:
    cred = await _carregar_credencial(loja_id, db)
    if not cred:
        return ConsultaSituacao()
    data = await _post(cred, "/situacao", placa, renavam)
    if data is None:
        return ConsultaSituacao(mensagem="Consulta de situação temporariamente indisponível — falha no provedor.")
    return ConsultaSituacao(
        disponivel=True,
        atpve_emitida=_as_bool(data.get("atpve_emitida")),
        transferencia_concluida=_as_bool(data.get("transferencia_concluida")),
        proprietario_atual=data.get("proprietario_atual"),
        fonte=data.get("fonte") or "Fornecedor configurado",
        mensagem="",
    )
