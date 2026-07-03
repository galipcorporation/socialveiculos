"""
Social Veículos — Credencial de consulta DETRAN (BYOF) por loja.
Permite ao gestor cadastrar o próprio fornecedor de consulta veicular
(débitos IPVA/multas/licenciamento e situação da ATPV-e).

Contrato esperado do fornecedor (documentado na UI):
    POST {api_url}/debitos   Auth: Bearer {chave}   → {ipva, licenciamento, multas, total}
    POST {api_url}/situacao  Auth: Bearer {chave}   → {atpve_emitida, transferencia_concluida, proprietario_atual}
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import CredencialDetran
from rbac import exige_permissao, Acao, Recurso
from simulador.crypt import encrypt_credentials

router = APIRouter(prefix="/v1/configuracoes/credenciais-detran", tags=["Credencial DETRAN (BYOF)"])


class CredencialDetranRequest(BaseModel):
    api_url: str = Field(..., min_length=8, description="URL base do fornecedor, ex: https://api.fornecedor.com/detran")
    api_key: str = Field(..., min_length=8)


class CredencialDetranResponse(BaseModel):
    configurada: bool
    api_url: Optional[str] = None
    ativo: bool = False

    model_config = ConfigDict(from_attributes=True)


def _to_response(c: Optional[CredencialDetran]) -> dict:
    if not c:
        return {"configurada": False, "api_url": None, "ativo": False}
    return {"configurada": True, "api_url": c.api_url, "ativo": c.ativo}


@router.get("", response_model=CredencialDetranResponse,
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))])
async def obter_credencial_detran(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Retorna o status da credencial DETRAN da loja (nunca devolve a api_key)."""
    res = await db.execute(select(CredencialDetran).where(CredencialDetran.loja_id == context.loja_id))
    return _to_response(res.scalar_one_or_none())


@router.post("", response_model=CredencialDetranResponse,
             dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def salvar_credencial_detran(
    data: CredencialDetranRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Salva/atualiza o fornecedor DETRAN da loja."""
    api_url = data.api_url.strip()
    if not api_url.startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="A URL deve começar com http:// ou https://")

    api_key_cifrada = encrypt_credentials(data.api_key)

    res = await db.execute(select(CredencialDetran).where(CredencialDetran.loja_id == context.loja_id))
    cred = res.scalar_one_or_none()
    if cred:
        cred.api_url = api_url
        cred.api_key_cifrada = api_key_cifrada
        cred.ativo = True
    else:
        cred = CredencialDetran(
            loja_id=context.loja_id,
            api_url=api_url,
            api_key_cifrada=api_key_cifrada,
            ativo=True,
        )
        db.add(cred)

    await db.commit()
    await db.refresh(cred)
    return _to_response(cred)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def remover_credencial_detran(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    res = await db.execute(select(CredencialDetran).where(CredencialDetran.loja_id == context.loja_id))
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nenhum fornecedor DETRAN configurado.")
    await db.delete(cred)
    await db.commit()
