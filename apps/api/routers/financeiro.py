"""
Social Veículos — Rotas de Dashboard, Métricas e Financeiro (Gestor B2B)
KPIs e métricas calculados de dados reais; loja sem dados retorna estado vazio (zeros).
Sem dados falsos (social.md §6). Tudo escopado por tenant (loja_id).
"""

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import (
    LancamentoFinanceiro,
    ComissaoVenda,
    Veiculo,
    Lead,
    TipoLancamento,
    StatusVeiculo,
    StatusPagamento,
    EtapaLead,
)
from rbac import exige_permissao, Acao, Recurso
from schemas import (
    LancamentoResponse,
    LancamentoCreateRequest,
    LancamentoUpdateRequest,
    CustoVeiculoCreateRequest,
    CustosVeiculoResponse,
    ComissaoResponse,
    ComissaoCreateRequest,
    FinanceiroResumoResponse,
    DashboardKpisResponse,
    MetricasResponse,
    RankingVeiculoResponse,
)

router = APIRouter(prefix="/v1", tags=["Dashboard, Métricas & Financeiro"])


# ═══════════════════════════════════════════════════════════════
# ── Helpers
# ═══════════════════════════════════════════════════════════════

def _inicio_mes_corrente() -> datetime:
    agora = datetime.now(timezone.utc)
    return datetime(agora.year, agora.month, 1, tzinfo=timezone.utc)


async def _calcular_resumo(
    db: AsyncSession, 
    loja_id: str, 
    mes: Optional[int] = None, 
    ano: Optional[int] = None
) -> FinanceiroResumoResponse:
    """
    Resumo financeiro da loja: receitas − despesas = saldo.
    🔒 Isolamento por Tenant: agrega estritamente lançamentos da loja.
    """
    # Soma de lançamentos por tipo (Apenas PAGO)
    stmt = (
        select(LancamentoFinanceiro.tipo, func.coalesce(func.sum(LancamentoFinanceiro.valor), 0.0))
        .where(
            LancamentoFinanceiro.loja_id == loja_id,
            LancamentoFinanceiro.status_pagamento == StatusPagamento.PAGO
        )
    )
    if mes is not None and ano is not None:
        stmt = stmt.where(
            func.extract('month', LancamentoFinanceiro.data) == mes,
            func.extract('year', LancamentoFinanceiro.data) == ano
        )
    stmt = stmt.group_by(LancamentoFinanceiro.tipo)
    res = await db.execute(stmt)
    por_tipo = {tipo: float(total) for tipo, total in res.all()}

    receitas = por_tipo.get(TipoLancamento.RECEITA, 0.0)
    despesas = por_tipo.get(TipoLancamento.DESPESA, 0.0)
    comissoes = por_tipo.get(TipoLancamento.COMISSAO, 0.0)

    # Saldo: receitas − (despesas + comissões lançadas como saída)
    saldo = receitas - despesas - comissoes

    # Custo de estoque: soma do preco_custo dos veículos em estoque ativo (não vendido/inativo)
    stmt_custo = (
        select(func.coalesce(func.sum(Veiculo.preco_custo), 0.0))
        .where(
            Veiculo.loja_id == loja_id,
            Veiculo.status.in_([StatusVeiculo.DISPONIVEL, StatusVeiculo.RESERVADO, StatusVeiculo.REPASSE]),
        )
    )
    res_custo = await db.execute(stmt_custo)
    custo_estoque = float(res_custo.scalar() or 0.0)

    # Comissões ainda não pagas (tabela comissao)
    stmt_com = (
        select(func.coalesce(func.sum(ComissaoVenda.valor_comissao), 0.0))
        .where(ComissaoVenda.loja_id == loja_id, ComissaoVenda.pago == False)
    )
    res_com = await db.execute(stmt_com)
    comissoes_pendentes = float(res_com.scalar() or 0.0)

    return FinanceiroResumoResponse(
        receitas=receitas,
        despesas=despesas,
        comissoes=comissoes,
        saldo=saldo,
        custo_estoque=custo_estoque,
        comissoes_pendentes=comissoes_pendentes,
    )


# ═══════════════════════════════════════════════════════════════
# ── 8.1 DASHBOARD — KPIs reais da loja
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/dashboard/kpis",
    response_model=DashboardKpisResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.VEICULO))],
)
async def get_dashboard_kpis(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    KPIs reais da loja autenticada. Zeros quando a loja ainda não tem dados (estado vazio).
    🔒 Isolamento por Tenant: filtra estritamente por loja_id do contexto.
    """
    loja_id = context.loja_id

    # Estoque ativo (disponível)
    stmt_estoque = (
        select(func.count()).select_from(Veiculo)
        .where(Veiculo.loja_id == loja_id, Veiculo.status == StatusVeiculo.DISPONIVEL)
    )
    estoque_ativo = (await db.execute(stmt_estoque)).scalar() or 0

    # Leads ativos (fora de fechamento/perdido)
    stmt_leads = (
        select(func.count()).select_from(Lead)
        .where(
            Lead.loja_id == loja_id,
            Lead.etapa.notin_([EtapaLead.FECHAMENTO, EtapaLead.PERDIDO]),
        )
    )
    leads_ativos = (await db.execute(stmt_leads)).scalar() or 0

    # Vendas do mês (veículos com status vendido, atualizados no mês corrente)
    inicio_mes = _inicio_mes_corrente()
    stmt_vendas = (
        select(func.count()).select_from(Veiculo)
        .where(
            Veiculo.loja_id == loja_id,
            Veiculo.status == StatusVeiculo.VENDIDO,
            Veiculo.updated_at >= inicio_mes,
        )
    )
    vendas_mes = (await db.execute(stmt_vendas)).scalar() or 0

    # Receita do mês (lançamentos de receita no mês corrente, APENAS PAGO)
    stmt_receita = (
        select(func.coalesce(func.sum(LancamentoFinanceiro.valor), 0.0))
        .where(
            LancamentoFinanceiro.loja_id == loja_id,
            LancamentoFinanceiro.tipo == TipoLancamento.RECEITA,
            LancamentoFinanceiro.status_pagamento == StatusPagamento.PAGO,
            LancamentoFinanceiro.data >= inicio_mes,
        )
    )
    receita_mes = float((await db.execute(stmt_receita)).scalar() or 0.0)

    # Veículos publicados na vitrine
    stmt_pub = (
        select(func.count()).select_from(Veiculo)
        .where(Veiculo.loja_id == loja_id, Veiculo.publicado_marketplace == True)
    )
    veiculos_publicados = (await db.execute(stmt_pub)).scalar() or 0

    return DashboardKpisResponse(
        estoque_ativo=estoque_ativo,
        leads_ativos=leads_ativos,
        vendas_mes=vendas_mes,
        receita_mes=receita_mes,
        veiculos_publicados=veiculos_publicados,
    )


# ═══════════════════════════════════════════════════════════════
# ── 8.2 MÉTRICAS — agregados para gráficos
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/metricas",
    response_model=MetricasResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.VEICULO))],
)
async def get_metricas(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Métricas agregadas da loja para gráficos: estoque por status, leads por etapa,
    ranking de veículos por leads e resumo financeiro.
    🔒 Isolamento por Tenant.
    """
    loja_id = context.loja_id

    # Estoque por status
    stmt_status = (
        select(Veiculo.status, func.count())
        .where(Veiculo.loja_id == loja_id)
        .group_by(Veiculo.status)
    )
    res_status = await db.execute(stmt_status)
    estoque_por_status = {
        (s.value if hasattr(s, "value") else str(s)): int(c) for s, c in res_status.all()
    }

    # Leads por etapa
    stmt_etapa = (
        select(Lead.etapa, func.count())
        .where(Lead.loja_id == loja_id)
        .group_by(Lead.etapa)
    )
    res_etapa = await db.execute(stmt_etapa)
    leads_por_etapa = {
        (e.value if hasattr(e, "value") else str(e)): int(c) for e, c in res_etapa.all()
    }

    # Ranking de veículos por número de leads
    stmt_rank = (
        select(Veiculo.id, Veiculo.marca, Veiculo.modelo, func.count(Lead.id).label("qtd"))
        .join(Lead, Lead.veiculo_id == Veiculo.id)
        .where(Veiculo.loja_id == loja_id)
        .group_by(Veiculo.id, Veiculo.marca, Veiculo.modelo)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    res_rank = await db.execute(stmt_rank)
    ranking = [
        RankingVeiculoResponse(veiculo_id=vid, marca=marca, modelo=modelo, leads=int(qtd))
        for vid, marca, modelo, qtd in res_rank.all()
    ]

    resumo = await _calcular_resumo(db, loja_id)

    return MetricasResponse(
        estoque_por_status=estoque_por_status,
        leads_por_etapa=leads_por_etapa,
        ranking_veiculos=ranking,
        resumo_financeiro=resumo,
    )


# ═══════════════════════════════════════════════════════════════
# ── 8.3 FINANCEIRO — lançamentos, comissões e saldo
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/financeiro/resumo",
    response_model=FinanceiroResumoResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))],
)
async def get_financeiro_resumo(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None),
):
    """
    Resumo financeiro consolidado da loja (receitas − despesas = saldo).
    🔒 Isolamento por Tenant.
    """
    return await _calcular_resumo(db, context.loja_id, mes, ano)


@router.get(
    "/financeiro/lancamentos",
    response_model=List[LancamentoResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))],
)
async def listar_lancamentos(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
    tipo: Optional[TipoLancamento] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None),
):
    """
    Lista os lançamentos financeiros da loja (filtro opcional por tipo, mes, ano).
    🔒 Isolamento por Tenant.
    """
    stmt = (
        select(LancamentoFinanceiro, Veiculo.marca, Veiculo.modelo, Veiculo.placa)
        .outerjoin(Veiculo, LancamentoFinanceiro.veiculo_id == Veiculo.id)
        .where(LancamentoFinanceiro.loja_id == context.loja_id)
        .order_by(LancamentoFinanceiro.data.desc())
    )
    if tipo is not None:
        stmt = stmt.where(LancamentoFinanceiro.tipo == tipo)
    
    if mes is not None and ano is not None:
        stmt = stmt.where(
            func.extract('month', LancamentoFinanceiro.data) == mes,
            func.extract('year', LancamentoFinanceiro.data) == ano
        )
        
    res = await db.execute(stmt)
    
    resultados = []
    for row in res.all():
        lanc, marca, modelo, placa = row
        nome_veiculo = None
        if marca and modelo:
            nome_veiculo = f"{marca} {modelo}"
            if placa:
                nome_veiculo += f" ({placa})"
                
        lanc_dict = {
            "id": lanc.id,
            "loja_id": lanc.loja_id,
            "tipo": lanc.tipo,
            "descricao": lanc.descricao,
            "valor": lanc.valor,
            "data": lanc.data,
            "veiculo_id": lanc.veiculo_id,
            "veiculo_nome": nome_veiculo,
            "categoria": lanc.categoria,
            "observacoes": lanc.observacoes,
            "status_pagamento": lanc.status_pagamento.value if hasattr(lanc.status_pagamento, 'value') else lanc.status_pagamento,
            "created_at": lanc.created_at,
        }
        resultados.append(lanc_dict)
        
    return resultados


@router.post(
    "/financeiro/lancamentos",
    response_model=LancamentoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.FINANCEIRO))],
)
async def criar_lancamento(
    data: LancamentoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Cria um lançamento financeiro (receita, despesa ou comissão) na loja.
    🔒 Isolamento por Tenant: vincula automaticamente ao loja_id do contexto.
    """
    payload = data.model_dump()
    if payload.get("data") is None:
        payload["data"] = datetime.now(timezone.utc)

    lancamento = LancamentoFinanceiro(
        loja_id=context.loja_id,
        status_pagamento=data.status_pagamento,
        **payload
    )
    db.add(lancamento)
    await db.commit()
    await db.refresh(lancamento)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lancamento.criar",
        entidade="lancamento_financeiro",
        entidade_id=lancamento.id,
        detalhes=json.dumps({"tipo": lancamento.tipo.value, "valor": lancamento.valor}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return lancamento


@router.patch(
    "/financeiro/lancamentos/{id}",
    response_model=LancamentoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.FINANCEIRO))],
)
async def atualizar_lancamento(
    id: str,
    data: LancamentoUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Atualiza um lançamento financeiro da loja.
    🔒 Isolamento por Tenant: garante que o lançamento pertence à loja.
    """
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.id == id, LancamentoFinanceiro.loja_id == context.loja_id
    )
    lancamento = (await db.execute(stmt)).scalar_one_or_none()
    if not lancamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado.")

    body = data.model_dump(exclude_unset=True)
    for key, value in body.items():
        setattr(lancamento, key, value)
    await db.commit()
    await db.refresh(lancamento)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lancamento.editar",
        entidade="lancamento_financeiro",
        entidade_id=lancamento.id,
        detalhes=json.dumps({k: (v.value if hasattr(v, "value") else v) for k, v in body.items()}, default=str),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return lancamento


@router.delete(
    "/financeiro/lancamentos/{id}",
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.FINANCEIRO))],
)
async def deletar_lancamento(
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Exclui um lançamento financeiro da loja.
    🔒 Isolamento por Tenant.
    """
    stmt = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.id == id, LancamentoFinanceiro.loja_id == context.loja_id
    )
    lancamento = (await db.execute(stmt)).scalar_one_or_none()
    if not lancamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado.")

    await db.delete(lancamento)
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="lancamento.excluir",
        entidade="lancamento_financeiro",
        entidade_id=id,
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return {"message": "Lançamento excluído com sucesso."}


# ── Custos de preparação por veículo ────────────────────────────

async def _montar_custos_veiculo(db: AsyncSession, veiculo: Veiculo) -> CustosVeiculoResponse:
    """Lista as despesas de preparação do veículo e consolida os totais."""
    stmt = (
        select(LancamentoFinanceiro)
        .where(
            LancamentoFinanceiro.loja_id == veiculo.loja_id,
            LancamentoFinanceiro.veiculo_id == veiculo.id,
            LancamentoFinanceiro.tipo == TipoLancamento.DESPESA,
        )
        .order_by(LancamentoFinanceiro.data.desc())
    )
    custos = (await db.execute(stmt)).scalars().all()
    total_preparacao = round(sum(c.valor for c in custos), 2)
    custo_total = float(veiculo.preco_custo or 0.0)
    return CustosVeiculoResponse(
        veiculo_id=veiculo.id,
        preco_compra=round(custo_total - total_preparacao, 2),
        total_preparacao=total_preparacao,
        custo_total=round(custo_total, 2),
        custos=custos,
    )


@router.get(
    "/financeiro/veiculos/{veiculo_id}/custos",
    response_model=CustosVeiculoResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))],
)
async def listar_custos_veiculo(
    veiculo_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Lista os custos de preparação (despesas vinculadas) de um veículo e os totais.
    🔒 Isolamento por Tenant.
    """
    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == context.loja_id)
    veiculo = (await db.execute(stmt)).scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado.")
    return await _montar_custos_veiculo(db, veiculo)


@router.post(
    "/financeiro/veiculos/{veiculo_id}/custos",
    response_model=CustosVeiculoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.FINANCEIRO))],
)
async def adicionar_custo_veiculo(
    veiculo_id: str,
    data: CustoVeiculoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Adiciona um custo de preparação ao veículo: cria uma despesa no financeiro
    vinculada ao veiculo_id e soma o valor ao preço de custo do veículo (atômico).
    🔒 Isolamento por Tenant.
    """
    stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == context.loja_id)
    veiculo = (await db.execute(stmt)).scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado.")

    # 1. Lança a despesa no financeiro, vinculada ao veículo
    lancamento = LancamentoFinanceiro(
        loja_id=context.loja_id,
        tipo=TipoLancamento.DESPESA,
        descricao=data.descricao,
        valor=data.valor,
        data=datetime.now(timezone.utc),
        veiculo_id=veiculo.id,
        categoria=data.categoria,
        observacoes=data.observacoes,
    )
    db.add(lancamento)

    # 2. Atualiza dinamicamente o preço de custo do veículo
    veiculo.preco_custo = round(float(veiculo.preco_custo or 0.0) + data.valor, 2)

    await db.commit()
    await db.refresh(veiculo)
    await db.refresh(lancamento)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.custo_preparacao",
        entidade="lancamento_financeiro",
        entidade_id=lancamento.id,
        detalhes=json.dumps({"veiculo_id": veiculo.id, "valor": data.valor, "descricao": data.descricao}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return await _montar_custos_veiculo(db, veiculo)


@router.delete(
    "/financeiro/veiculos/{veiculo_id}/custos/{lancamento_id}",
    response_model=CustosVeiculoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.FINANCEIRO))],
)
async def remover_custo_veiculo(
    veiculo_id: str,
    lancamento_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Remove um custo de preparação: exclui a despesa vinculada e abate o valor
    do preço de custo do veículo (atômico).
    🔒 Isolamento por Tenant.
    """
    stmt_v = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == context.loja_id)
    veiculo = (await db.execute(stmt_v)).scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado.")

    stmt_l = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.id == lancamento_id,
        LancamentoFinanceiro.loja_id == context.loja_id,
        LancamentoFinanceiro.veiculo_id == veiculo_id,
        LancamentoFinanceiro.tipo == TipoLancamento.DESPESA,
    )
    lancamento = (await db.execute(stmt_l)).scalar_one_or_none()
    if not lancamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custo não encontrado.")

    valor = lancamento.valor
    await db.delete(lancamento)
    veiculo.preco_custo = round(max(0.0, float(veiculo.preco_custo or 0.0) - valor), 2)

    await db.commit()
    await db.refresh(veiculo)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="veiculo.custo_preparacao.remover",
        entidade="lancamento_financeiro",
        entidade_id=lancamento_id,
        detalhes=json.dumps({"veiculo_id": veiculo.id, "valor": valor}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return await _montar_custos_veiculo(db, veiculo)


# ── Comissões ───────────────────────────────────────────────────

@router.get(
    "/financeiro/comissoes",
    response_model=List[ComissaoResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))],
)
async def listar_comissoes(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
    pago: Optional[bool] = Query(None),
):
    """
    Lista as comissões de venda da loja (filtro opcional por status de pagamento).
    🔒 Isolamento por Tenant.
    """
    stmt = (
        select(ComissaoVenda)
        .where(ComissaoVenda.loja_id == context.loja_id)
        .order_by(ComissaoVenda.created_at.desc())
    )
    if pago is not None:
        stmt = stmt.where(ComissaoVenda.pago == pago)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/financeiro/comissoes",
    response_model=ComissaoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.FINANCEIRO))],
)
async def criar_comissao(
    data: ComissaoCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Registra uma comissão de venda. O valor da comissão é derivado de valor_venda × percentual.
    🔒 Isolamento por Tenant.
    """
    valor_comissao = round(data.valor_venda * (data.percentual / 100.0), 2)
    comissao = ComissaoVenda(
        loja_id=context.loja_id,
        vendedor_id=data.vendedor_id,
        veiculo_id=data.veiculo_id,
        valor_venda=data.valor_venda,
        percentual=data.percentual,
        valor_comissao=valor_comissao,
        pago=False,
    )
    db.add(comissao)
    await db.commit()
    await db.refresh(comissao)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="comissao.criar",
        entidade="comissao",
        entidade_id=comissao.id,
        detalhes=json.dumps({"valor_comissao": valor_comissao, "vendedor_id": data.vendedor_id}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return comissao


@router.patch(
    "/financeiro/comissoes/{id}/pagar",
    response_model=ComissaoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.FINANCEIRO))],
)
async def marcar_comissao_paga(
    id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Marca uma comissão como paga e registra a despesa correspondente no caixa.
    🔒 Isolamento por Tenant.
    """
    stmt = select(ComissaoVenda).where(
        ComissaoVenda.id == id, ComissaoVenda.loja_id == context.loja_id
    )
    comissao = (await db.execute(stmt)).scalar_one_or_none()
    if not comissao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comissão não encontrada.")

    if comissao.pago:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comissão já está paga.")

    comissao.pago = True

    # Lança a comissão como saída no financeiro
    lancamento = LancamentoFinanceiro(
        loja_id=context.loja_id,
        tipo=TipoLancamento.COMISSAO,
        descricao=f"Pagamento de comissão {comissao.id}",
        valor=comissao.valor_comissao,
        data=datetime.now(timezone.utc),
        veiculo_id=comissao.veiculo_id,
        status_pagamento=StatusPagamento.PAGO
    )
    db.add(lancamento)
    await db.commit()
    await db.refresh(comissao)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="comissao.pagar",
        entidade="comissao",
        entidade_id=comissao.id,
        detalhes=json.dumps({"valor_comissao": comissao.valor_comissao}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return comissao
