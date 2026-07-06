"""
Social Veículos — Rotas de Clientes (CRM B2B)
CRUD de clientes pessoa física com isolamento estrito por tenant (loja).
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import ClientePF
from rbac import exige_permissao, Acao, Recurso
from schemas import (
    ClienteResponse,
    ClienteCreateRequest,
    ClienteUpdateRequest,
)

router = APIRouter(prefix="/v1", tags=["Clientes (CRM)"])


@router.get(
    "/clientes",
    response_model=List[ClienteResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_CLIENTE))]
)
async def listar_clientes(
    q: Optional[str] = None,
    cpf: Optional[str] = None,
    telefone: Optional[str] = None,
    per_page: int = 50,
    page: int = 1,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Lista os clientes da loja do usuário autenticado, com filtros opcionais.
    🔒 Isolamento por Tenant: filtra estritamente por loja_id do contexto.
    """
    stmt = select(ClientePF).where(ClientePF.loja_id == context.loja_id)

    if q:
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(
                ClientePF.nome.ilike(f"%{q}%"),
                ClientePF.cpf.ilike(f"%{q}%"),
                ClientePF.telefone.ilike(f"%{q}%"),
            )
        )
    if cpf:
        stmt = stmt.where(ClientePF.cpf.ilike(f"%{cpf}%"))
    if telefone:
        stmt = stmt.where(ClientePF.telefone.ilike(f"%{telefone}%"))

    stmt = stmt.order_by(ClientePF.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/clientes/{id}",
    response_model=ClienteResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_CLIENTE))]
)
async def detalhe_cliente(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna os detalhes de um cliente do CRM.
    🔒 Isolamento por Tenant: garante que pertence ao mesmo tenant.
    """
    stmt = select(ClientePF).where(
        ClientePF.id == id,
        ClientePF.loja_id == context.loja_id
    )
    res = await db.execute(stmt)
    cliente = res.scalar_one_or_none()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado nesta loja."
        )

    return cliente


@router.post(
    "/clientes",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.CRM_CLIENTE))]
)
async def criar_cliente(
    data: ClienteCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Cadastra um novo cliente no CRM da loja.
    🔒 Isolamento por Tenant: vincula automaticamente ao loja_id do contexto.
    """
    novo_cliente = ClientePF(
        loja_id=context.loja_id,
        **data.model_dump()
    )
    db.add(novo_cliente)
    await db.commit()
    await db.refresh(novo_cliente)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="cliente.criar",
        entidade="cliente",
        entidade_id=novo_cliente.id,
        detalhes=json.dumps({"nome": novo_cliente.nome, "cpf": novo_cliente.cpf}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return novo_cliente


@router.patch(
    "/clientes/{id}",
    response_model=ClienteResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_CLIENTE))]
)
async def atualizar_cliente(
    id: str,
    data: ClienteUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Atualiza os dados de um cliente.
    🔒 Isolamento por Tenant: só atualiza clientes da própria loja.
    """
    stmt = select(ClientePF).where(
        ClientePF.id == id,
        ClientePF.loja_id == context.loja_id
    )
    res = await db.execute(stmt)
    cliente = res.scalar_one_or_none()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado nesta loja."
        )

    body_data = data.model_dump(exclude_unset=True)
    for key, value in body_data.items():
        setattr(cliente, key, value)

    await db.commit()
    await db.refresh(cliente)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="cliente.editar",
        entidade="cliente",
        entidade_id=cliente.id,
        detalhes=json.dumps(body_data, default=str),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return cliente


@router.delete(
    "/clientes/{id}",
    dependencies=[Depends(exige_permissao(Acao.EXCLUIR, Recurso.CRM_CLIENTE))]
)
async def deletar_cliente(
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exclui um cliente do CRM.
    🔒 Isolamento por Tenant: só exclui clientes da própria loja.
    Vendedores não possuem a permissão EXCLUIR (HTTP 403 automático).
    """
    stmt = select(ClientePF).where(
        ClientePF.id == id,
        ClientePF.loja_id == context.loja_id
    )
    res = await db.execute(stmt)
    cliente = res.scalar_one_or_none()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado nesta loja."
        )

    await db.delete(cliente)
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="cliente.excluir",
        entidade="cliente",
        entidade_id=id,
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return {"message": "Cliente excluído com sucesso."}
