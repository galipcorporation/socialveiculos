"""
Social Veículos — Rotas de Leads, Funil Kanban e Negociações (CRM B2B)
Funil de vendas com isolamento estrito por tenant e auditoria das movimentações.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import Lead, Negociacao, ClientePF, EtapaLead
from rbac import exige_permissao, Acao, Recurso
from schemas import (
    LeadResponse,
    LeadCreateRequest,
    LeadUpdateRequest,
    LeadMoverEtapaRequest,
    NegociacaoResponse,
    NegociacaoCreateRequest,
    KanbanBoardResponse,
    KanbanColunaResponse,
)

router = APIRouter(prefix="/v1", tags=["CRM Leads & Kanban"])


async def _buscar_lead_da_loja(db: AsyncSession, lead_id: str, loja_id: Optional[str]) -> Lead:
    """Carrega um lead da loja (com cliente e negociações) ou lança 404."""
    stmt = (
        select(Lead)
        .options(selectinload(Lead.cliente), selectinload(Lead.negociacoes))
        .where(Lead.id == lead_id, Lead.loja_id == loja_id)
    )
    res = await db.execute(stmt)
    lead = res.scalar_one_or_none()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead não encontrado nesta loja."
        )
    return lead


# ═══════════════════════════════════════════════════════════════
# ── LEADS
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/leads",
    response_model=List[LeadResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_LEAD))]
)
async def listar_leads(
    etapa: Optional[EtapaLead] = None,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Lista os leads da loja, opcionalmente filtrados por etapa do funil.
    🔒 Isolamento por Tenant: filtra estritamente por loja_id do contexto.
    """
    stmt = (
        select(Lead)
        .options(selectinload(Lead.cliente), selectinload(Lead.negociacoes))
        .where(Lead.loja_id == context.loja_id)
    )
    if etapa:
        stmt = stmt.where(Lead.etapa == etapa)

    stmt = stmt.order_by(Lead.updated_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/leads/kanban",
    response_model=KanbanBoardResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_LEAD))]
)
async def quadro_kanban(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna o quadro Kanban do funil com as 5 colunas (etapas) e os leads de cada uma.
    🔒 Isolamento por Tenant: apenas leads da loja do contexto.
    Rota declarada antes de /leads/{id} para evitar colisão de roteamento.
    """
    stmt = (
        select(Lead)
        .options(selectinload(Lead.cliente), selectinload(Lead.negociacoes))
        .where(Lead.loja_id == context.loja_id)
        .order_by(Lead.updated_at.desc())
    )
    result = await db.execute(stmt)
    leads = result.scalars().all()

    # Agrupa por etapa, mantendo a ordem canônica do funil
    por_etapa: dict[EtapaLead, list] = {etapa: [] for etapa in EtapaLead}
    for lead in leads:
        por_etapa[lead.etapa].append(lead)

    colunas = [
        KanbanColunaResponse(
            etapa=etapa,
            total=len(itens),
            leads=itens,
        )
        for etapa, itens in por_etapa.items()
    ]
    return KanbanBoardResponse(colunas=colunas)


@router.get(
    "/leads/{id}",
    response_model=LeadResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_LEAD))]
)
async def detalhe_lead(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna os detalhes de um lead, incluindo cliente e negociações.
    🔒 Isolamento por Tenant: garante que pertence ao mesmo tenant.
    """
    return await _buscar_lead_da_loja(db, id, context.loja_id)


@router.post(
    "/leads",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.CRM_LEAD))]
)
async def criar_lead(
    data: LeadCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Cria um lead no funil, vinculado a um cliente da loja.
    🔒 Isolamento por Tenant: valida que o cliente pertence ao mesmo tenant.
    """
    # Valida que o cliente é da mesma loja (6.2 — vínculos)
    cli_stmt = select(ClientePF).where(
        ClientePF.id == data.cliente_id,
        ClientePF.loja_id == context.loja_id
    )
    cli_res = await db.execute(cli_stmt)
    if not cli_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado nesta loja."
        )

    novo_lead = Lead(
        loja_id=context.loja_id,
        **data.model_dump()
    )
    db.add(novo_lead)
    await db.commit()

    lead = await _buscar_lead_da_loja(db, novo_lead.id, context.loja_id)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lead.criar",
        entidade="lead",
        entidade_id=lead.id,
        detalhes=json.dumps({
            "cliente_id": lead.cliente_id,
            "etapa": lead.etapa.value,
            "origem": lead.origem.value,
        }),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return lead


@router.patch(
    "/leads/{id}/etapa",
    response_model=LeadResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_LEAD))]
)
async def mover_etapa_lead(
    id: str,
    data: LeadMoverEtapaRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Move o lead de etapa no funil (drag-and-drop do Kanban).
    🔒 Isolamento por Tenant + auditoria obrigatória da transição (DoD 6.3).
    """
    lead = await _buscar_lead_da_loja(db, id, context.loja_id)

    etapa_anterior = lead.etapa
    if data.etapa == etapa_anterior:
        return lead  # sem mudança, nada a auditar

    lead.etapa = data.etapa
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lead.mover_etapa",
        entidade="lead",
        entidade_id=lead.id,
        detalhes=json.dumps({
            "etapa_anterior": etapa_anterior.value,
            "etapa_nova": data.etapa.value,
        }),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return await _buscar_lead_da_loja(db, id, context.loja_id)


@router.patch(
    "/leads/{id}",
    response_model=LeadResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_LEAD))]
)
async def atualizar_lead(
    id: str,
    data: LeadUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Atualiza dados do lead (veículo de interesse, valor, observações).
    🔒 Isolamento por Tenant: só atualiza leads da própria loja.
    """
    lead = await _buscar_lead_da_loja(db, id, context.loja_id)

    body_data = data.model_dump(exclude_unset=True)
    for key, value in body_data.items():
        setattr(lead, key, value)

    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lead.editar",
        entidade="lead",
        entidade_id=lead.id,
        detalhes=json.dumps(body_data, default=str),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return await _buscar_lead_da_loja(db, id, context.loja_id)


@router.delete(
    "/leads/{id}",
    dependencies=[Depends(exige_permissao(Acao.EXCLUIR, Recurso.CRM_LEAD))]
)
async def deletar_lead(
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exclui um lead do funil.
    🔒 Isolamento por Tenant. Vendedores não possuem EXCLUIR (HTTP 403 automático).
    """
    lead = await _buscar_lead_da_loja(db, id, context.loja_id)

    await db.delete(lead)
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lead.excluir",
        entidade="lead",
        entidade_id=id,
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return {"message": "Lead excluído com sucesso."}


# ═══════════════════════════════════════════════════════════════
# ── NEGOCIAÇÕES / PROPOSTAS (6.5)
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/leads/{id}/negociacoes",
    response_model=List[NegociacaoResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_LEAD))]
)
async def listar_negociacoes(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Lista as propostas/negociações de um lead.
    🔒 Isolamento por Tenant: valida o lead da loja antes de listar.
    """
    await _buscar_lead_da_loja(db, id, context.loja_id)

    stmt = (
        select(Negociacao)
        .where(Negociacao.lead_id == id)
        .order_by(Negociacao.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/leads/{id}/negociacoes",
    response_model=NegociacaoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.CRM_LEAD))]
)
async def criar_negociacao(
    id: str,
    data: NegociacaoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Cria uma proposta/negociação vinculada ao lead (cliente + veículo).
    🔒 Isolamento por Tenant: valida o lead da loja antes de criar.
    """
    await _buscar_lead_da_loja(db, id, context.loja_id)

    nova_negociacao = Negociacao(
        lead_id=id,
        **data.model_dump()
    )
    db.add(nova_negociacao)
    await db.commit()
    await db.refresh(nova_negociacao)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="negociacao.criar",
        entidade="negociacao",
        entidade_id=nova_negociacao.id,
        detalhes=json.dumps({
            "lead_id": id,
            "veiculo_id": nova_negociacao.veiculo_id,
            "valor_proposta": nova_negociacao.valor_proposta,
        }),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return nova_negociacao
