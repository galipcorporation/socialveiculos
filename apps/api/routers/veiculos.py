"""
Social Veículos — Rotas de Estoque de Veículos (B2B + B2C)
Garante o isolamento por tenant e o redirecionamento de ações restritas de vendedores para a fila de aprovação.

Tarefa 05 — Enriquecido com:
  - Filtros, busca textual e paginação (5.1/5.3)
  - Troca rápida de status com auditoria (5.2)
  - Busca por placa — scraping server-side da KePlaca (5.5)
  - Toggle "Publicar na Vitrine" (5.6)
"""

import json
import math
import re
from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, case

from datetime import datetime, timezone
from storage import storage_provider
from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria, get_optional_user
from models import Veiculo, Midia, Usuario, SolicitacaoAprovacao, StatusAprovacao, TipoAcaoAprovacao, StatusVeiculo, OrigemVeiculo, Negociacao, PapelUsuario, PublicacaoB2B, Favorito, ClientePF, VeiculoDocumento, TipoDocumentoVeiculo, LojaSeguidora, Loja, utcnow
from rbac import exige_permissao, Acao, Recurso, can
from schemas import (
    VeiculoB2BResponse,
    VeiculoB2CResponse,
    VeiculoCreateRequest,
    VeiculoUpdateRequest,
    VeiculoListResponse,
    TrocaEntradaRequest,
    StatusChangeRequest,
    PublicarToggleRequest,
    ConsultaPlacaResponse,
    PrecificacaoResponse,
    FipeConsultaRequest,
    FipeConsultaResponse,
    VeiculoDocumentoCreate,
    VeiculoDocumentoResponse,
    VincularCompradorRequest,
    VeiculoCompradorResponse,
)

router = APIRouter(prefix="/v1", tags=["Estoque & Vitrine"])


async def sincronizar_publicacao_b2b(veiculo: Veiculo, db: AsyncSession, autor_id: Optional[str] = None):
    """
    Sincroniza automaticamente a PublicacaoB2B com base no status do veículo.
    Se status for REPASSE, cria/ativa a publicação. Caso contrário, desativa.
    """
    if veiculo.status == StatusVeiculo.REPASSE:
        stmt = select(PublicacaoB2B).where(PublicacaoB2B.veiculo_id == veiculo.id)
        res = await db.execute(stmt)
        pub = res.scalar_one_or_none()
        if pub:
            pub.ativa = True
            pub.valor_repasse = veiculo.preco_venda
            pub.updated_at = utcnow()
        else:
            pub = PublicacaoB2B(
                loja_id=veiculo.loja_id,
                veiculo_id=veiculo.id,
                autor_id=autor_id,
                valor_repasse=veiculo.preco_venda,
                ativa=True
            )
            db.add(pub)
    else:
        stmt = select(PublicacaoB2B).where(PublicacaoB2B.veiculo_id == veiculo.id)
        res = await db.execute(stmt)
        pub = res.scalar_one_or_none()
        if pub:
            pub.ativa = False
            pub.updated_at = utcnow()


# ═══════════════════════════════════════════════════════════════
# ── ROTAS PÚBLICAS (Vitrine B2C)
# ═══════════════════════════════════════════════════════════════

@router.get("/vitrine/veiculos", response_model=List[VeiculoB2CResponse])
async def get_veiculos_vitrine(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os veículos publicados da vitrine B2C pública.
    🔒 Filtro de Saída B2C: utiliza estritamente o VeiculoB2CResponse (oculta placa, custo e margem).
    """
    offset = (page - 1) * per_page
    stmt = (
        select(Veiculo)
        .join(Loja, Veiculo.loja_id == Loja.id)
        .options(selectinload(Veiculo.midias))
        .where(
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
            Loja.ativa == True
        )
        .order_by(Veiculo.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/marketplace/categorias", response_model=List[str])
async def get_marketplace_categorias(db: AsyncSession = Depends(get_db)):
    """Retorna carrocerias distintas com veículos publicados disponíveis."""
    stmt = (
        select(Veiculo.carroceria)
        .where(
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
            Veiculo.carroceria.isnot(None),
            Veiculo.carroceria != "",
        )
        .distinct()
        .order_by(Veiculo.carroceria)
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


@router.get("/marketplace/feed", response_model=List[VeiculoB2CResponse])
async def get_marketplace_feed(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    q: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    preco_max: Optional[float] = Query(None),
    ordenacao: Optional[str] = Query(None),
    carroceria: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Usuario] = Depends(get_optional_user)
):
    """
    Feed público B2C. Retorna apenas veículos publicados e com status disponível.
    🔒 Filtro de Saída B2C: utiliza estritamente o VeiculoB2CResponse.
    """
    stmt = (
        select(Veiculo)
        .join(Loja, Veiculo.loja_id == Loja.id)
        .options(selectinload(Veiculo.midias), selectinload(Veiculo.loja))
        .where(
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
            Loja.ativa == True
        )
    )

    if q:
        search_term = f"%{q}%"
        stmt = stmt.where(
            or_(
                Veiculo.marca.ilike(search_term),
                Veiculo.modelo.ilike(search_term),
                Veiculo.versao.ilike(search_term)
            )
        )

    if marca:
        stmt = stmt.where(Veiculo.marca.ilike(f"%{marca}%"))

    if preco_max:
        stmt = stmt.where(Veiculo.preco_venda <= preco_max)

    if carroceria:
        stmt = stmt.where(Veiculo.carroceria.ilike(carroceria))

    if ordenacao == "ofertas":
        stmt = stmt.order_by(Veiculo.preco_venda.asc())
    elif ordenacao == "novidades":
        stmt = stmt.order_by(Veiculo.created_at.desc())
    else:
        stmt = stmt.order_by(Veiculo.created_at.desc())

    offset = (page - 1) * per_page
    # Query more items if needed to allow deduplication and still satisfy per_page limit
    stmt_no_limit = stmt.offset(offset).limit(per_page * 3)
    result = await db.execute(stmt_no_limit)
    raw_vehicles = result.scalars().all()

    # Deduplicate in python based on unique characteristics
    seen = set()
    vehicles = []
    for v in raw_vehicles:
        key = (v.marca.lower(), v.modelo.lower(), v.versao.lower() if v.versao else "", v.preco_venda)
        if key not in seen:
            seen.add(key)
            vehicles.append(v)
            if len(vehicles) >= per_page:
                break

    # Lojas que o usuário segue (1 query só) para preencher seguindo_loja
    lojas_seguidas: set[str] = set()
    if current_user:
        seg_stmt = select(LojaSeguidora.loja_id).where(LojaSeguidora.usuario_id == current_user.id)
        seg_res = await db.execute(seg_stmt)
        lojas_seguidas = set(seg_res.scalars().all())

    for v in vehicles:
        # Calcular total favoritos
        count_stmt = select(func.count(Favorito.id)).where(Favorito.veiculo_id == v.id)
        count_res = await db.execute(count_stmt)
        v.total_favoritos = count_res.scalar() or 0

        # Verificar se está favoritado pelo usuário atual
        if current_user:
            check_stmt = select(Favorito).where(Favorito.veiculo_id == v.id, Favorito.usuario_id == current_user.id)
            check_res = await db.execute(check_stmt)
            v.favoritado_por_mim = check_res.scalar_one_or_none() is not None
        else:
            v.favoritado_por_mim = False

        # Dados da loja (vitrine social: feed = carros, mas mostra a loja que anuncia)
        loja = v.loja
        v.loja_nome = loja.nome if loja else None
        v.loja_logo = loja.logo_url if loja else None
        v.loja_cidade = loja.cidade if loja else None
        v.loja_estado = loja.estado if loja else None
        v.loja_whatsapp = loja.whatsapp if loja else None
        v.loja_verificada = bool(loja.verificada) if loja else False
        v.seguindo_loja = v.loja_id in lojas_seguidas

    return vehicles



@router.get("/vitrine/veiculos/{id}", response_model=VeiculoB2CResponse)
async def get_veiculo_vitrine_detalhes(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Usuario] = Depends(get_optional_user)
):
    """
    Retorna os detalhes públicos de um veículo específico na Vitrine.
    🔒 Filtro de Saída B2C: oculta campos confidenciais de negócio.
    """
    stmt = (
        select(Veiculo)
        .join(Loja, Veiculo.loja_id == Loja.id)
        .options(selectinload(Veiculo.midias), selectinload(Veiculo.loja))
        .where(
            Veiculo.id == id,
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
            Loja.ativa == True
        )
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado ou não publicado."
        )

    # Calcular total favoritos
    count_stmt = select(func.count(Favorito.id)).where(Favorito.veiculo_id == veiculo.id)
    count_res = await db.execute(count_stmt)
    veiculo.total_favoritos = count_res.scalar() or 0

    # Verificar se está favoritado pelo usuário atual
    if current_user:
        check_stmt = select(Favorito).where(Favorito.veiculo_id == veiculo.id, Favorito.usuario_id == current_user.id)
        check_res = await db.execute(check_stmt)
        veiculo.favoritado_por_mim = check_res.scalar_one_or_none() is not None
    else:
        veiculo.favoritado_por_mim = False

    # Dados da loja que anuncia (mesma hidratação do feed)
    loja = veiculo.loja
    veiculo.loja_nome = loja.nome if loja else None
    veiculo.loja_logo = loja.logo_url if loja else None
    veiculo.loja_cidade = loja.cidade if loja else None
    veiculo.loja_estado = loja.estado if loja else None
    veiculo.loja_whatsapp = loja.whatsapp if loja else None
    veiculo.loja_verificada = bool(loja.verificada) if loja else False

    return veiculo



# ═══════════════════════════════════════════════════════════════
# ── ROTAS GESTOR (B2B Tenant-Isolated)
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/veiculos",
    response_model=VeiculoListResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.VEICULO))]
)
async def get_veiculos_b2b(
    # Paginação
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    # Ordenação
    sort_by: str = Query("created_at", description="Campo de ordenação: created_at, preco_venda, km, ano_modelo, marca"),
    sort_order: str = Query("desc", description="Direção: asc ou desc"),
    # Filtros
    status_filter: Optional[str] = Query(None, alias="status", description="Filtrar por status: disponivel, reservado, vendido, repasse, inativo"),
    preco_min: Optional[float] = Query(None, ge=0, description="Preço mínimo de venda"),
    preco_max: Optional[float] = Query(None, ge=0, description="Preço máximo de venda"),
    km_max: Optional[int] = Query(None, ge=0, description="Quilometragem máxima"),
    ano_min: Optional[int] = Query(None, description="Ano mínimo do modelo"),
    ano_max: Optional[int] = Query(None, description="Ano máximo do modelo"),
    marca: Optional[str] = Query(None, description="Filtrar por marca (exato ou parcial)"),
    modelo: Optional[str] = Query(None, description="Filtrar por modelo (parcial)"),
    placa: Optional[str] = Query(None, description="Filtrar por placa (parcial)"),
    publicado: Optional[bool] = Query(None, description="Filtrar por publicado na vitrine"),
    # Busca textual
    q: Optional[str] = Query(None, min_length=1, description="Busca textual por placa, marca ou modelo"),
    # Deps
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna o estoque da Loja (Tenant) com filtros, busca e paginação.
    🔒 Isolamento por Tenant: filtra estritamente por loja_id do contexto.
    """
    # Base query — rascunhos nunca aparecem no estoque normal
    base_where = [
        Veiculo.loja_id == context.loja_id,
        Veiculo.status != StatusVeiculo.RASCUNHO,
    ]

    # ── Filtros ──
    if status_filter:
        try:
            status_enum = StatusVeiculo(status_filter)
            base_where.append(Veiculo.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status inválido: {status_filter}. Use: disponivel, reservado, vendido, repasse, inativo."
            )

    if preco_min is not None:
        base_where.append(Veiculo.preco_venda >= preco_min)
    if preco_max is not None:
        base_where.append(Veiculo.preco_venda <= preco_max)
    if km_max is not None:
        base_where.append(Veiculo.km <= km_max)
    if ano_min is not None:
        base_where.append(Veiculo.ano_modelo >= ano_min)
    if ano_max is not None:
        base_where.append(Veiculo.ano_modelo <= ano_max)
    if marca:
        base_where.append(Veiculo.marca.ilike(f"%{marca}%"))
    if modelo:
        base_where.append(Veiculo.modelo.ilike(f"%{modelo}%"))
    if placa:
        base_where.append(Veiculo.placa.ilike(f"%{placa}%"))
    if publicado is not None:
        base_where.append(Veiculo.publicado_marketplace == publicado)

    # ── Busca textual (FTS simples) ──
    if q:
        search_term = f"%{q}%"
        base_where.append(
            or_(
                Veiculo.placa.ilike(search_term),
                Veiculo.marca.ilike(search_term),
                Veiculo.modelo.ilike(search_term),
                Veiculo.versao.ilike(search_term),
            )
        )

    # ── Contagem total ──
    count_stmt = select(func.count(Veiculo.id)).where(*base_where)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    # ── Ordenação ──
    sort_columns = {
        "created_at": Veiculo.created_at,
        "preco_venda": Veiculo.preco_venda,
        "km": Veiculo.km,
        "ano_modelo": Veiculo.ano_modelo,
        "marca": Veiculo.marca,
    }
    sort_col = sort_columns.get(sort_by, Veiculo.created_at)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    # Prioridade de status: DISPONIVEL (1), RESERVADO (2), REPASSE (3), VENDIDO (4), INATIVO (5)
    status_priority = case(
        (Veiculo.status == StatusVeiculo.DISPONIVEL, 1),
        (Veiculo.status == StatusVeiculo.RESERVADO, 2),
        (Veiculo.status == StatusVeiculo.REPASSE, 3),
        (Veiculo.status == StatusVeiculo.VENDIDO, 4),
        (Veiculo.status == StatusVeiculo.INATIVO, 5),
        else_=6
    )

    # ── Query paginada ──
    offset = (page - 1) * per_page
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(*base_where)
        .order_by(status_priority, order)
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return VeiculoListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 1,
    )


@router.get(
    "/veiculos/{id}",
    response_model=VeiculoB2BResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.VEICULO))]
)
async def get_veiculo_b2b_detalhes(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna os detalhes de um veículo do estoque privado.
    🔒 Isolamento por Tenant: garante que pertence ao mesmo tenant.
    """
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id, Veiculo.loja_id == context.loja_id)
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()
    
    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado no estoque desta loja."
        )
        
    return veiculo


@router.post(
    "/veiculos",
    response_model=VeiculoB2BResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.VEICULO))]
)
async def criar_veiculo(
    data: VeiculoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Cadastra um novo veículo no estoque da loja.
    """
    # Garante vinculação automática com o tenant
    novo_veiculo = Veiculo(
        loja_id=context.loja_id,
        **data.model_dump()
    )
    db.add(novo_veiculo)
    await db.commit()

    # Pre-carregar midias para evitar erro de lazy loading/MissingGreenlet
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == novo_veiculo.id)
    )
    res = await db.execute(stmt)
    novo_veiculo = res.scalar_one()

    # Registrar Auditoria
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.criar",
        entidade="veiculo",
        entidade_id=novo_veiculo.id,
        detalhes=json.dumps({"modelo": novo_veiculo.modelo, "preco_venda": novo_veiculo.preco_venda}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Sincronizar B2B
    await sincronizar_publicacao_b2b(novo_veiculo, db, autor_id=context.usuario.id)
    await db.commit()

    return novo_veiculo


@router.post(
    "/veiculos/troca",
    response_model=VeiculoB2BResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.VEICULO))]
)
async def registrar_troca(
    data: TrocaEntradaRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Registra um veículo recebido em TROCA/ROLO:
      1. Cria o veículo no estoque com origem=troca, custo = valor de avaliação
         e vínculo à negociação de origem (rastreável).
      2. Registra o valor de avaliação como entrada/abatimento na negociação de origem.
    """
    # Valida a negociação de origem (se informada) dentro do tenant
    negociacao = None
    if data.negociacao_origem_id:
        stmt_neg = (
            select(Negociacao)
            .join(Negociacao.lead)
            .where(Negociacao.id == data.negociacao_origem_id)
        )
        negociacao = (await db.execute(stmt_neg)).scalar_one_or_none()
        if negociacao is not None and negociacao.lead.loja_id != context.loja_id:
            negociacao = None
        if negociacao is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Negociação de origem não encontrada."
            )

    # 1. Cria o veículo recebido em troca
    novo_veiculo = Veiculo(
        loja_id=context.loja_id,
        marca=data.marca,
        modelo=data.modelo,
        versao=data.versao,
        ano_fabricacao=data.ano_fabricacao,
        ano_modelo=data.ano_modelo,
        placa=data.placa,
        km=data.km,
        cor=data.cor,
        preco_custo=data.valor_avaliacao,
        status=StatusVeiculo.DISPONIVEL,
        origem=OrigemVeiculo.TROCA,
        negociacao_origem_id=data.negociacao_origem_id,
    )
    db.add(novo_veiculo)

    # 2. Registra o valor de avaliação na negociação (abatimento / entrada)
    if negociacao is not None:
        negociacao.valor_entrada = (negociacao.valor_entrada or 0.0) + data.valor_avaliacao

    await db.commit()

    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == novo_veiculo.id)
    )
    novo_veiculo = (await db.execute(stmt)).scalar_one()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.troca",
        entidade="veiculo",
        entidade_id=novo_veiculo.id,
        detalhes=json.dumps({
            "modelo": novo_veiculo.modelo,
            "valor_avaliacao": data.valor_avaliacao,
            "negociacao_origem_id": data.negociacao_origem_id,
        }),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    await sincronizar_publicacao_b2b(novo_veiculo, db, autor_id=context.usuario.id)
    await db.commit()

    return novo_veiculo


@router.patch(
    "/veiculos/{id}",
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.VEICULO))]
)
async def atualizar_veiculo(
    id: str,
    data: VeiculoUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Atualiza dados do veículo.
    🔒 Fila de Aprovação (Vendedor): se for vendedor alterando preço, desvia para aprovação.
    """
    # 1. Buscar veículo no tenant
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id, Veiculo.loja_id == context.loja_id)
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado."
        )

    # 2. Verificar se vendedor está mudando preço
    alteracao_preco = False
    preco_proposto = None
    
    body_data = data.model_dump(exclude_unset=True)
    if "preco_venda" in body_data and body_data["preco_venda"] != veiculo.preco_venda:
        alteracao_preco = True
        preco_proposto = body_data["preco_venda"]

    # Se for vendedor (não tem permissão de aprovação direta no veículo)
    if alteracao_preco and not can(context.usuario, Acao.APROVAR, Recurso.VEICULO):
        # Desviar a alteração de preço para a Fila de Aprovações
        solicitacao = SolicitacaoAprovacao(
            loja_id=context.loja_id,
            requisitante_id=context.usuario.id,
            tipo_acao=TipoAcaoAprovacao.ALTERAR_PRECO,
            entidade_id=veiculo.id,
            dados_novos=json.dumps({"preco_venda": preco_proposto}),
            status=StatusAprovacao.PENDENTE,
            motivo=data.motivo
        )
        db.add(solicitacao)
        
        # Salvar as demais edições do vendedor, se houver, excluindo a alteração de preço
        body_data.pop("preco_venda", None)
        body_data.pop("motivo", None)
        for key, value in body_data.items():
            setattr(veiculo, key, value)
            
        await db.commit()
        
        # Registrar Auditoria
        await registrar_auditoria(
            db=db,
            loja_id=context.loja_id,
            ator_id=context.usuario.id,
            ator_nome=context.usuario.nome,
            acao="veiculo.solicitar_alteracao_preco",
            entidade="veiculo",
            entidade_id=veiculo.id,
            detalhes=json.dumps({"preco_proposto": preco_proposto}),
            ip=request.client.host if request.client else None
        )
        await db.commit()

        return {
            "status": "APROVACAO_PENDENTE",
            "message": f"Alteração de preço de venda para R$ {preco_proposto} enviada para aprovação do gestor.",
            "veiculo": veiculo
        }

    # Se for gestor ou se não estiver alterando preço, atualiza normalmente
    for key, value in body_data.items():
        setattr(veiculo, key, value)
        
    await db.commit()
    await db.refresh(veiculo)

    # Registrar Auditoria
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.editar",
        entidade="veiculo",
        entidade_id=veiculo.id,
        detalhes=json.dumps(body_data),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Sincronizar B2B
    await sincronizar_publicacao_b2b(veiculo, db, autor_id=context.usuario.id)
    await db.commit()

    return veiculo


@router.delete(
    "/veiculos/{id}",
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.VEICULO))]
)
async def deletar_veiculo(
    id: str,
    request: Request,
    motivo: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exclui um veículo.
    🔒 Fila de Aprovação (Vendedor): vendedor não pode excluir diretamente; desvia para aprovação.
    """
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id, Veiculo.loja_id == context.loja_id)
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado."
        )

    # Se o usuário for vendedor e não tiver permissão para excluir direto (ou seja, Acao.EXCLUIR no VEICULO)
    if not can(context.usuario, Acao.EXCLUIR, Recurso.VEICULO):
        # Desvia para a Fila de Aprovações
        # Verifica se já existe uma solicitação de exclusão pendente
        stmt_check = select(SolicitacaoAprovacao).where(
            SolicitacaoAprovacao.entidade_id == veiculo.id,
            SolicitacaoAprovacao.tipo_acao == TipoAcaoAprovacao.EXCLUIR_VEICULO,
            SolicitacaoAprovacao.status == StatusAprovacao.PENDENTE
        )
        check_res = await db.execute(stmt_check)
        if check_res.scalar_one_or_none():
            return {
                "status": "APROVACAO_PENDENTE",
                "message": "Já existe uma solicitação de exclusão pendente para este veículo."
            }

        solicitacao = SolicitacaoAprovacao(
            loja_id=context.loja_id,
            requisitante_id=context.usuario.id,
            tipo_acao=TipoAcaoAprovacao.EXCLUIR_VEICULO,
            entidade_id=veiculo.id,
            status=StatusAprovacao.PENDENTE,
            motivo=motivo
        )
        db.add(solicitacao)
        await db.commit()

        # Registrar Auditoria
        await registrar_auditoria(
            db=db,
            loja_id=context.loja_id,
            ator_id=context.usuario.id,
            ator_nome=context.usuario.nome,
            acao="veiculo.solicitar_exclusao",
            entidade="veiculo",
            entidade_id=veiculo.id,
            ip=request.client.host if request.client else None
        )
        await db.commit()

        return {
            "status": "APROVACAO_PENDENTE",
            "message": "Solicitação de exclusão de veículo enviada para aprovação do gestor."
        }

    # Gestor / Admin: Exclui diretamente
    await db.delete(veiculo)
    await db.commit()

    # Registrar Auditoria
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.excluir",
        entidade="veiculo",
        entidade_id=id,
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return {"message": "Veículo excluído com sucesso."}


# ═══════════════════════════════════════════════════════════════
# ── 5.2 — TROCA RÁPIDA DE STATUS
# ═══════════════════════════════════════════════════════════════

@router.patch(
    "/veiculos/{id}/status",
    response_model=VeiculoB2BResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.VEICULO))]
)
async def trocar_status_veiculo(
    id: str,
    data: StatusChangeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Troca rápida de status do veículo.
    Se status mudar para vendido ou inativo, despublica automaticamente.
    """
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id, Veiculo.loja_id == context.loja_id)
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado."
        )

    status_anterior = veiculo.status
    veiculo.status = data.status

    # Auto-despublicar se status virar vendido ou inativo
    if data.status in (StatusVeiculo.VENDIDO, StatusVeiculo.INATIVO):
        veiculo.publicado_marketplace = False

    await db.commit()
    await db.refresh(veiculo)

    # Registrar Auditoria
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.trocar_status",
        entidade="veiculo",
        entidade_id=veiculo.id,
        detalhes=json.dumps({"de": status_anterior.value, "para": data.status.value}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Sincronizar B2B
    await sincronizar_publicacao_b2b(veiculo, db, autor_id=context.usuario.id)
    await db.commit()

    # Re-carregar para retornar atualizado com midias
    stmt2 = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id)
    )
    res2 = await db.execute(stmt2)
    return res2.scalar_one()


# ═══════════════════════════════════════════════════════════════
# ── 5.6 — TOGGLE "PUBLICAR NA VITRINE"
# ═══════════════════════════════════════════════════════════════

@router.patch(
    "/veiculos/{id}/publicar",
    response_model=VeiculoB2BResponse,
    dependencies=[Depends(exige_permissao(Acao.PUBLICAR, Recurso.VEICULO))]
)
@router.post(
    "/veiculos/{id}/publicar",
    response_model=VeiculoB2BResponse,
    dependencies=[Depends(exige_permissao(Acao.PUBLICAR, Recurso.VEICULO))]
)
async def toggle_publicar_veiculo(
    id: str,
    data: PublicarToggleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Toggle de publicação na Vitrine B2C.
    Só permite publicar se o veículo estiver com status 'disponível'.
    """
    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id, Veiculo.loja_id == context.loja_id)
    )
    res = await db.execute(stmt)
    veiculo = res.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado."
        )

    # Só publicar se estiver disponível
    if data.publicado and veiculo.status != StatusVeiculo.DISPONIVEL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Só é possível publicar veículos com status 'disponível'. Status atual: {veiculo.status.value}."
        )

    veiculo.publicado_marketplace = data.publicado
    await db.commit()
    await db.refresh(veiculo)

    # Registrar Auditoria
    evento = "veiculo_publicado" if data.publicado else "veiculo_despublicado"
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao=f"veiculo.{evento}",
        entidade="veiculo",
        entidade_id=veiculo.id,
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Re-carregar para retornar atualizado com midias
    stmt2 = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == id)
    )
    res2 = await db.execute(stmt2)
    return res2.scalar_one()


# ═══════════════════════════════════════════════════════════════
# ── 5.5 — CONSULTA DE PLACA (KePlaca — scraping server-side)
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/veiculos/consulta-placa/{placa}",
    response_model=ConsultaPlacaResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.VEICULO))]
)
async def consulta_placa(
    placa: str,
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Consulta dados de um veículo pela placa via scraping server-side da KePlaca.
    O servidor faz a requisição e parseia o HTML — nunca inventa dados.
    Se a placa não for encontrada ou o site estiver indisponível, retorna encontrado=False.
    """
    # Normalizar placa (remover espaços e hifens, uppercase)
    placa_limpa = re.sub(r"[\s\-]", "", placa).upper()

    # Validação básica do formato (Mercosul ou antigo)
    if not re.match(r"^[A-Z]{3}\d[A-Z0-9]\d{2}$", placa_limpa):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de placa inválido. Use o formato ABC1D23 (Mercosul) ou ABC1234 (antigo)."
        )

    return await _scrape_keplaca(placa_limpa)


def _extrair_campo_keplaca(soup: "BeautifulSoup", rotulo: str) -> Optional[str]:
    """Acha a célula de valor a partir do rótulo na tabela fipeTablePriceDetail da KePlaca."""
    for td in soup.select("table.fipeTablePriceDetail td"):
        texto = td.get_text(strip=True)
        if texto.lower().startswith(rotulo.lower()):
            irmao = td.find_next_sibling("td")
            if irmao:
                valor = irmao.get_text(strip=True)
                return valor or None
    return None


async def _scrape_keplaca(placa_limpa: str) -> "ConsultaPlacaResponse":
    url = f"https://www.keplaca.com/placa?placa-fipe={placa_limpa}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
        "Accept-Language": "pt-BR,pt;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError:
        return ConsultaPlacaResponse(
            placa=placa_limpa,
            encontrado=False,
            mensagem="Não foi possível consultar a placa agora. Preencha os dados manualmente.",
        )

    soup = BeautifulSoup(html, "html.parser")
    marca = _extrair_campo_keplaca(soup, "Marca")
    modelo = _extrair_campo_keplaca(soup, "Modelo")
    ano_txt = _extrair_campo_keplaca(soup, "Ano Modelo") or _extrair_campo_keplaca(soup, "Ano")

    ano = None
    if ano_txt:
        m = re.search(r"(\d{4})", ano_txt)
        if m:
            ano = int(m.group(1))

    if not marca and not modelo:
        return ConsultaPlacaResponse(
            placa=placa_limpa,
            encontrado=False,
            mensagem="Placa não encontrada. Preencha os dados manualmente.",
        )

    return ConsultaPlacaResponse(
        placa=placa_limpa,
        encontrado=True,
        marca=marca,
        modelo=modelo,
        ano_fabricacao=ano,
        ano_modelo=ano,
    )


# ═══════════════════════════════════════════════════════════════
# ── PRECIFICAÇÃO FIPE (Melhoria 15)
# ═══════════════════════════════════════════════════════════════

@router.get("/veiculos/{veiculo_id}/precificacao", response_model=PrecificacaoResponse)
async def precificacao_veiculo(
    veiculo_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna dados de precificação FIPE + dias no estoque para um veículo."""
    from fipe_api import consultar_preco
    from datetime import datetime, timezone

    stmt = select(Veiculo).where(
        Veiculo.id == veiculo_id,
        Veiculo.loja_id == ctx.loja.id,
    )
    result = await db.execute(stmt)
    veiculo = result.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    # Busca valor FIPE real se os códigos estiverem gravados
    fipe = None
    if veiculo.fipe_marca_codigo and veiculo.fipe_modelo_codigo and veiculo.fipe_ano_codigo:
        try:
            fipe = await consultar_preco(
                veiculo.fipe_marca_codigo,
                veiculo.fipe_modelo_codigo,
                veiculo.fipe_ano_codigo,
                veiculo.tipo or "carro",
            )
        except Exception:
            fipe = None

    # Dias no estoque
    dias = 0
    if veiculo.created_at:
        delta = datetime.now(timezone.utc) - veiculo.created_at.replace(tzinfo=timezone.utc)
        dias = max(0, delta.days)

    # Margem sobre FIPE
    margem = None
    if fipe and veiculo.preco_venda:
        margem = round(((veiculo.preco_venda - fipe) / fipe) * 100, 1)

    return PrecificacaoResponse(
        fipe=fipe,
        preco_venda=veiculo.preco_venda,
        margem_sobre_fipe=margem,
        dias_no_estoque=dias,
        alerta_encalhe=dias > 30,
        fipe_disponivel=fipe is not None,
    )


# ── CONSULTA FIPE AVULSA (M016)
# ═══════════════════════════════════════════════════════════════

@router.get("/veiculos/fipe/marcas")
async def fipe_marcas(tipo: str = "carro", _ctx: B2BContext = Depends(get_current_b2b_user)):
    from fipe_api import listar_marcas
    return await listar_marcas(tipo)


@router.get("/veiculos/fipe/marcas/{marca_codigo}/modelos")
async def fipe_modelos(marca_codigo: str, tipo: str = "carro", _ctx: B2BContext = Depends(get_current_b2b_user)):
    from fipe_api import listar_modelos
    return await listar_modelos(marca_codigo, tipo)


@router.get("/veiculos/fipe/marcas/{marca_codigo}/modelos/{modelo_codigo}/anos")
async def fipe_anos(marca_codigo: str, modelo_codigo: str, tipo: str = "carro", _ctx: B2BContext = Depends(get_current_b2b_user)):
    from fipe_api import listar_anos
    return await listar_anos(marca_codigo, modelo_codigo, tipo)


@router.post("/veiculos/fipe/consultar", response_model=FipeConsultaResponse)
async def consultar_fipe_avulsa(
    data: FipeConsultaRequest,
    _ctx: B2BContext = Depends(get_current_b2b_user),
):
    """Consulta o valor FIPE pelos códigos exatos selecionados pelo usuário."""
    from fipe_api import consultar_preco
    fipe = await consultar_preco(data.marca_codigo, data.modelo_codigo, data.ano_codigo, tipo=data.tipo)
    return FipeConsultaResponse(fipe=fipe, fipe_disponivel=fipe is not None)


# ── CARTEIRA DO PROPRIETÁRIO — GESTOR (M018)
# ═══════════════════════════════════════════════════════════════

@router.get("/veiculos/{veiculo_id}/venda", response_model=VeiculoCompradorResponse)
async def get_venda_veiculo(
    veiculo_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna comprador vinculado e documentos do veículo."""
    stmt = (
        select(Veiculo)
        .where(Veiculo.id == veiculo_id, Veiculo.loja_id == ctx.loja.id)
        .options(selectinload(Veiculo.documentos), selectinload(Veiculo.comprador))
    )
    result = await db.execute(stmt)
    veiculo = result.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    docs = [
        VeiculoDocumentoResponse(
            id=d.id, tipo=d.tipo.value, nome=d.nome, url=d.url,
            visivel_comprador=d.visivel_comprador, created_at=d.created_at,
        )
        for d in veiculo.documentos
    ]
    return VeiculoCompradorResponse(
        veiculo_id=veiculo_id,
        comprador_id=veiculo.comprador_id,
        comprador_nome=veiculo.comprador.nome if veiculo.comprador else None,
        comprador_telefone=veiculo.comprador.telefone if veiculo.comprador else None,
        documentos=docs,
    )


@router.put("/veiculos/{veiculo_id}/venda/comprador", response_model=VeiculoCompradorResponse)
async def vincular_comprador(
    veiculo_id: str,
    data: VincularCompradorRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Vincula um ClientePF como comprador do veículo."""
    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == ctx.loja.id)
    result = await db.execute(stmt)
    veiculo = result.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    # Verifica se cliente pertence à loja
    stmt_cli = select(ClientePF).where(ClientePF.id == data.comprador_id, ClientePF.loja_id == ctx.loja.id)
    res_cli = await db.execute(stmt_cli)
    cliente = res_cli.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    veiculo.comprador_id = data.comprador_id
    await db.commit()
    await db.refresh(veiculo)

    return VeiculoCompradorResponse(
        veiculo_id=veiculo_id,
        comprador_id=cliente.id,
        comprador_nome=cliente.nome,
        comprador_telefone=cliente.telefone,
        documentos=[],
    )


@router.delete("/veiculos/{veiculo_id}/venda/comprador", status_code=204)
async def desvincular_comprador(
    veiculo_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove o vínculo de comprador do veículo."""
    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == ctx.loja.id)
    result = await db.execute(stmt)
    veiculo = result.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    veiculo.comprador_id = None
    await db.commit()


@router.post("/veiculos/{veiculo_id}/documentos", response_model=VeiculoDocumentoResponse, status_code=201)
async def adicionar_documento(
    veiculo_id: str,
    data: VeiculoDocumentoCreate,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Adiciona documento ao veículo (contrato, NF, garantia etc.)."""
    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == ctx.loja.id)
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    tipo_enum = TipoDocumentoVeiculo(data.tipo) if data.tipo in TipoDocumentoVeiculo._value2member_map_ else TipoDocumentoVeiculo.OUTRO
    doc = VeiculoDocumento(
        veiculo_id=veiculo_id,
        loja_id=ctx.loja.id,
        tipo=tipo_enum,
        nome=data.nome,
        url=data.url,
        visivel_comprador=data.visivel_comprador,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return VeiculoDocumentoResponse(
        id=doc.id, tipo=doc.tipo.value, nome=doc.nome, url=doc.url,
        visivel_comprador=doc.visivel_comprador, created_at=doc.created_at,
    )


@router.post("/veiculos/{veiculo_id}/documentos/upload", response_model=VeiculoDocumentoResponse, status_code=201)
async def upload_documento(
    veiculo_id: str,
    file: UploadFile = File(...),
    tipo: str = Form("outro"),
    visivel_comprador: bool = Form(True),
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload de PDF como documento do veículo."""
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos.")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 20MB.")

    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == ctx.loja.id)
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    url = await storage_provider.upload_file(
        content, file.filename or "documento.pdf", "application/pdf",
        prefixo=f"lojas/{ctx.loja.id}/documentos",
    )
    tipo_enum = TipoDocumentoVeiculo(tipo) if tipo in TipoDocumentoVeiculo._value2member_map_ else TipoDocumentoVeiculo.OUTRO
    doc = VeiculoDocumento(
        veiculo_id=veiculo_id,
        loja_id=ctx.loja.id,
        tipo=tipo_enum,
        nome=file.filename or "documento.pdf",
        url=url,
        visivel_comprador=visivel_comprador,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return VeiculoDocumentoResponse(
        id=doc.id, tipo=doc.tipo.value, nome=doc.nome, url=doc.url,
        visivel_comprador=doc.visivel_comprador, created_at=doc.created_at,
    )


@router.delete("/veiculos/{veiculo_id}/documentos/{doc_id}", status_code=204)
async def remover_documento(
    veiculo_id: str,
    doc_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove um documento do veículo."""
    stmt = select(VeiculoDocumento).where(
        VeiculoDocumento.id == doc_id,
        VeiculoDocumento.veiculo_id == veiculo_id,
        VeiculoDocumento.loja_id == ctx.loja.id,
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    await db.delete(doc)
    await db.commit()


