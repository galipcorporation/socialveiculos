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
from models import (
    Lead, Negociacao, ClientePF, EtapaLead, InteracaoLead, TipoInteracao, MembroLoja,
)
from rbac import exige_permissao, Acao, Recurso
from schemas import (
    LeadResponse,
    LeadCreateRequest,
    LeadUpdateRequest,
    LeadMoverEtapaRequest,
    NegociacaoResponse,
    NegociacaoCreateRequest,
    NegociacaoUpdateRequest,
    InteracaoResponse,
    InteracaoCreateRequest,
    InteracaoUpdateRequest,
    ClienteUpdateRequest,
    KanbanBoardResponse,
    KanbanColunaResponse,
)

router = APIRouter(prefix="/v1", tags=["CRM Leads & Kanban"])

# Carregamento padrão do lead: cliente + propostas + timeline.
_LEAD_LOADS = (
    selectinload(Lead.cliente),
    selectinload(Lead.negociacoes),
    selectinload(Lead.interacoes),
    selectinload(Lead.responsavel),
)


def _com_responsavel(lead: Lead) -> Lead:
    """Expõe responsavel_nome (campo derivado do relationship) no response."""
    lead.responsavel_nome = lead.responsavel.nome if lead.responsavel else None
    return lead


async def _buscar_lead_da_loja(db: AsyncSession, lead_id: str, loja_id: Optional[str]) -> Lead:
    """Carrega um lead da loja (com cliente, negociações e timeline) ou lança 404."""
    stmt = (
        select(Lead)
        .options(*_LEAD_LOADS)
        .where(Lead.id == lead_id, Lead.loja_id == loja_id)
    )
    res = await db.execute(stmt)
    lead = res.scalar_one_or_none()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead não encontrado nesta loja."
        )
    return _com_responsavel(lead)


async def _registrar_interacao(
    db: AsyncSession,
    lead_id: str,
    tipo: TipoInteracao,
    texto: str,
    context: B2BContext,
) -> InteracaoLead:
    """Cria uma entrada na timeline do lead (sem commit — quem chama controla)."""
    interacao = InteracaoLead(
        lead_id=lead_id,
        tipo=tipo,
        texto=texto,
        autor_id=context.usuario.id,
        autor_nome=context.usuario.nome,
    )
    db.add(interacao)
    return interacao


async def _validar_responsavel(db: AsyncSession, responsavel_id: str, loja_id: Optional[str]) -> None:
    """🔒 O responsável precisa ser membro da mesma loja (vínculo em MembroLoja)."""
    res = await db.execute(
        select(MembroLoja.id).where(
            MembroLoja.usuario_id == responsavel_id,
            MembroLoja.loja_id == loja_id,
        )
    )
    if not res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsável não encontrado nesta loja."
        )


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
        .options(*_LEAD_LOADS)
        .where(Lead.loja_id == context.loja_id)
    )
    if etapa:
        stmt = stmt.where(Lead.etapa == etapa)

    stmt = stmt.order_by(Lead.updated_at.desc())
    result = await db.execute(stmt)
    return [_com_responsavel(lead) for lead in result.scalars().all()]


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
        .options(*_LEAD_LOADS)
        .where(Lead.loja_id == context.loja_id)
        .order_by(Lead.updated_at.desc())
    )
    result = await db.execute(stmt)
    leads = result.scalars().all()

    # Agrupa por etapa, mantendo a ordem canônica do funil.
    # Etapa desconhecida (dado legado) não derruba o quadro: fica fora das colunas.
    por_etapa: dict[EtapaLead, list] = {etapa: [] for etapa in EtapaLead}
    for lead in leads:
        if lead.etapa in por_etapa:
            por_etapa[lead.etapa].append(_com_responsavel(lead))

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
    Cria um lead no funil, com um cliente existente (cliente_id) ou cadastrando
    o cliente na hora (bloco `cliente` — fluxo do mobile, que não tem tela de
    clientes separada).
    🔒 Isolamento por Tenant: valida/cria o cliente sempre no tenant do contexto.
    """
    if data.cliente_id:
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
        cliente_id = data.cliente_id
    else:
        novo_cliente = ClientePF(
            loja_id=context.loja_id,
            **data.cliente.model_dump(exclude_none=True)
        )
        db.add(novo_cliente)
        await db.flush()
        cliente_id = novo_cliente.id

    if data.responsavel_id:
        await _validar_responsavel(db, data.responsavel_id, context.loja_id)

    campos = data.model_dump(exclude={"cliente", "cliente_id"})
    novo_lead = Lead(
        loja_id=context.loja_id,
        cliente_id=cliente_id,
        **campos
    )
    db.add(novo_lead)
    await db.flush()

    await _registrar_interacao(
        db, novo_lead.id, TipoInteracao.SISTEMA, "Lead criado", context
    )
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
    if data.etapa == EtapaLead.PERDIDO:
        lead.motivo_perda = data.motivo_perda
        lead.motivo_perda_detalhe = data.motivo_perda_detalhe
    else:
        # Saiu de "perdido": o motivo antigo não vale mais.
        lead.motivo_perda = None
        lead.motivo_perda_detalhe = None

    rotulos = {
        EtapaLead.LEAD: "Lead",
        EtapaLead.PROPOSTA: "Proposta",
        EtapaLead.NEGOCIACAO: "Em negociação",
        EtapaLead.FECHAMENTO: "Fechamento",
        EtapaLead.PERDIDO: "Perdido",
    }
    texto = f"Etapa alterada: {rotulos[etapa_anterior]} → {rotulos[data.etapa]}"
    if data.etapa == EtapaLead.PERDIDO and data.motivo_perda:
        texto += f" (motivo: {data.motivo_perda.value.replace('_', ' ')})"
    await _registrar_interacao(db, lead.id, TipoInteracao.SISTEMA, texto, context)

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
    if body_data.get("responsavel_id"):
        await _validar_responsavel(db, body_data["responsavel_id"], context.loja_id)

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
    await db.flush()

    valor = nova_negociacao.valor_proposta or 0
    await _registrar_interacao(
        db, id, TipoInteracao.PROPOSTA,
        f"Proposta registrada: R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
        context,
    )
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


@router.patch(
    "/leads/{id}/cliente",
    response_model=LeadResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_CLIENTE))]
)
async def atualizar_cliente_do_lead(
    id: str,
    data: ClienteUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Edita os dados do cliente sem sair do lead — no mobile o lead É o cadastro
    do cliente, então CPF/e-mail/endereço precisam ser editáveis daqui.
    🔒 Isolamento por Tenant: o cliente é alcançado através do lead da loja.
    """
    lead = await _buscar_lead_da_loja(db, id, context.loja_id)

    res = await db.execute(
        select(ClientePF).where(
            ClientePF.id == lead.cliente_id,
            ClientePF.loja_id == context.loja_id,
        )
    )
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

    return await _buscar_lead_da_loja(db, id, context.loja_id)


async def _buscar_negociacao_da_loja(
    db: AsyncSession, lead_id: str, neg_id: str, loja_id: Optional[str]
) -> Negociacao:
    """🔒 Garante que a proposta pertence a um lead da loja do contexto."""
    await _buscar_lead_da_loja(db, lead_id, loja_id)
    res = await db.execute(
        select(Negociacao).where(Negociacao.id == neg_id, Negociacao.lead_id == lead_id)
    )
    negociacao = res.scalar_one_or_none()
    if not negociacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposta não encontrada neste lead."
        )
    return negociacao


@router.patch(
    "/leads/{id}/negociacoes/{negociacao_id}",
    response_model=NegociacaoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_LEAD))]
)
async def atualizar_negociacao(
    id: str,
    negociacao_id: str,
    data: NegociacaoUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Corrige uma proposta já registrada (valor, entrada, parcelas, observações).
    🔒 Isolamento por Tenant. Vendedor pode editar; excluir é só do gestor.
    """
    negociacao = await _buscar_negociacao_da_loja(db, id, negociacao_id, context.loja_id)

    body_data = data.model_dump(exclude_unset=True)
    for key, value in body_data.items():
        setattr(negociacao, key, value)

    await db.commit()
    await db.refresh(negociacao)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="negociacao.editar",
        entidade="negociacao",
        entidade_id=negociacao_id,
        detalhes=json.dumps(body_data, default=str),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return negociacao


@router.delete(
    "/leads/{id}/negociacoes/{negociacao_id}",
    dependencies=[Depends(exige_permissao(Acao.EXCLUIR, Recurso.CRM_LEAD))]
)
async def deletar_negociacao(
    id: str,
    negociacao_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exclui uma proposta do histórico do lead.
    🔒 Isolamento por Tenant. Vendedores não possuem EXCLUIR (HTTP 403 automático).
    """
    negociacao = await _buscar_negociacao_da_loja(db, id, negociacao_id, context.loja_id)
    valor = negociacao.valor_proposta

    await db.delete(negociacao)
    await db.flush()

    await _registrar_interacao(
        db, id, TipoInteracao.SISTEMA,
        f"Proposta de R$ {(valor or 0):,.2f} excluída".replace(",", "X").replace(".", ",").replace("X", "."),
        context,
    )
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="negociacao.excluir",
        entidade="negociacao",
        entidade_id=negociacao_id,
        detalhes=json.dumps({"lead_id": id, "valor_proposta": valor}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return {"message": "Proposta excluída com sucesso."}


# ═══════════════════════════════════════════════════════════════
# ── TIMELINE DE INTERAÇÕES
# ═══════════════════════════════════════════════════════════════

async def _buscar_interacao_da_loja(
    db: AsyncSession, lead_id: str, interacao_id: str, loja_id: Optional[str]
) -> InteracaoLead:
    """🔒 Garante que a interação pertence a um lead da loja do contexto."""
    await _buscar_lead_da_loja(db, lead_id, loja_id)
    res = await db.execute(
        select(InteracaoLead).where(
            InteracaoLead.id == interacao_id,
            InteracaoLead.lead_id == lead_id,
        )
    )
    interacao = res.scalar_one_or_none()
    if not interacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interação não encontrada neste lead."
        )
    return interacao


@router.get(
    "/leads/{id}/interacoes",
    response_model=List[InteracaoResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CRM_LEAD))]
)
async def listar_interacoes(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Lista a timeline do lead (mais recente primeiro).
    🔒 Isolamento por Tenant: valida o lead da loja antes de listar.
    """
    await _buscar_lead_da_loja(db, id, context.loja_id)

    res = await db.execute(
        select(InteracaoLead)
        .where(InteracaoLead.lead_id == id)
        .order_by(InteracaoLead.created_at.desc())
    )
    return res.scalars().all()


@router.post(
    "/leads/{id}/interacoes",
    response_model=InteracaoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.CRM_LEAD))]
)
async def criar_interacao(
    id: str,
    data: InteracaoCreateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Registra um toque com o cliente (nota, ligação, WhatsApp, visita, e-mail).
    🔒 Isolamento por Tenant: valida o lead da loja antes de criar.
    """
    await _buscar_lead_da_loja(db, id, context.loja_id)

    # SISTEMA é reservado para eventos gerados pelo próprio backend.
    tipo = TipoInteracao.NOTA if data.tipo == TipoInteracao.SISTEMA else data.tipo
    interacao = await _registrar_interacao(db, id, tipo, data.texto.strip(), context)
    await db.commit()
    await db.refresh(interacao)

    return interacao


@router.patch(
    "/leads/{id}/interacoes/{interacao_id}",
    response_model=InteracaoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CRM_LEAD))]
)
async def atualizar_interacao(
    id: str,
    interacao_id: str,
    data: InteracaoUpdateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Edita uma anotação da timeline.
    🔒 Isolamento por Tenant. Marcos do sistema não são editáveis.
    """
    interacao = await _buscar_interacao_da_loja(db, id, interacao_id, context.loja_id)
    if interacao.tipo == TipoInteracao.SISTEMA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registros automáticos do sistema não podem ser editados."
        )

    body_data = data.model_dump(exclude_unset=True)
    if body_data.get("tipo") == TipoInteracao.SISTEMA:
        body_data.pop("tipo")
    if "texto" in body_data:
        body_data["texto"] = body_data["texto"].strip()
    for key, value in body_data.items():
        setattr(interacao, key, value)

    await db.commit()
    await db.refresh(interacao)

    return interacao


@router.delete(
    "/leads/{id}/interacoes/{interacao_id}",
    dependencies=[Depends(exige_permissao(Acao.EXCLUIR, Recurso.CRM_LEAD))]
)
async def deletar_interacao(
    id: str,
    interacao_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exclui uma anotação da timeline.
    🔒 Isolamento por Tenant. Marcos do sistema são preservados (auditoria).
    """
    interacao = await _buscar_interacao_da_loja(db, id, interacao_id, context.loja_id)
    if interacao.tipo == TipoInteracao.SISTEMA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registros automáticos do sistema não podem ser excluídos."
        )

    await db.delete(interacao)
    await db.commit()

    return {"message": "Interação excluída com sucesso."}
