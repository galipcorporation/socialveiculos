"""
Social Veículos — Rotas da Fila de Aprovação (B2B)
Gestores revisam e aprovam/rejeitam as solicitações dos vendedores.
"""

import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import Veiculo, SolicitacaoAprovacao, StatusAprovacao, TipoAcaoAprovacao
from rbac import exige_permissao, Acao, Recurso
from schemas import SolicitacaoAprovacaoResponse, ProcessaSolicitacaoRequest

router = APIRouter(prefix="/v1/aprovacoes", tags=["Aprovações B2B"])


@router.get(
    "/pendentes",
    response_model=List[SolicitacaoAprovacaoResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.APROVACOES))]
)
async def get_solicitacoes_pendentes(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Lista todas as solicitações pendentes no tenant da loja.
    """
    stmt = (
        select(SolicitacaoAprovacao)
        .options(selectinload(SolicitacaoAprovacao.requisitante))
        .where(
            SolicitacaoAprovacao.loja_id == context.loja_id,
            SolicitacaoAprovacao.status == StatusAprovacao.PENDENTE
        )
        .order_by(SolicitacaoAprovacao.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/{id}/processar",
    response_model=SolicitacaoAprovacaoResponse,
    dependencies=[Depends(exige_permissao(Acao.APROVAR, Recurso.APROVACOES))]
)
async def processar_solicitacao(
    id: str,
    data: ProcessaSolicitacaoRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Processa (aprova ou rejeita) uma solicitação pendente.
    """
    # 1. Buscar a solicitação no tenant
    stmt = (
        select(SolicitacaoAprovacao)
        .options(selectinload(SolicitacaoAprovacao.requisitante))
        .where(
            SolicitacaoAprovacao.id == id,
            SolicitacaoAprovacao.loja_id == context.loja_id
        )
    )
    res = await db.execute(stmt)
    solicitacao = res.scalar_one_or_none()

    if not solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada."
        )

    if solicitacao.status != StatusAprovacao.PENDENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta solicitação já foi processada."
        )

    # 2. Processar decisão
    solicitacao.status = data.status
    if data.status == StatusAprovacao.REJEITADO:
        solicitacao.justificativa_rejeicao = data.justificativa_rejeicao
        await db.commit()

        # Auditoria de Rejeição
        await registrar_auditoria(
            db=db,
            loja_id=context.loja_id,
            ator_id=context.usuario.id,
            ator_nome=context.usuario.nome,
            acao="solicitacao.rejeitar",
            entidade="solicitacao_aprovacao",
            entidade_id=solicitacao.id,
            detalhes=json.dumps({"tipo_acao": solicitacao.tipo_acao, "justificativa": data.justificativa_rejeicao}),
            ip=request.client.host if request.client else None
        )
        await db.commit()
        return solicitacao

    # Se APROVADO:
    # 3. Aplicar as alterações solicitadas
    stmt_veiculo = select(Veiculo).where(Veiculo.id == solicitacao.entidade_id, Veiculo.loja_id == context.loja_id)
    res_veiculo = await db.execute(stmt_veiculo)
    veiculo = res_veiculo.scalar_one_or_none()

    if solicitacao.tipo_acao == TipoAcaoAprovacao.ALTERAR_PRECO:
        if not veiculo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível aprovar esta solicitação pois o veículo associado foi removido do estoque."
            )
        
        try:
            novos_dados = json.loads(solicitacao.dados_novos) if solicitacao.dados_novos else {}
            preco_novo = novos_dados.get("preco_venda")
            if preco_novo is None:
                raise ValueError("Preço não informado nos dados novos.")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dados da solicitação corrompidos: {str(e)}"
            )

        preco_antigo = veiculo.preco_venda
        veiculo.preco_venda = float(preco_novo)
        await db.commit()

        # Auditoria de Preço Aprovado
        await registrar_auditoria(
            db=db,
            loja_id=context.loja_id,
            ator_id=context.usuario.id,
            ator_nome=context.usuario.nome,
            acao="veiculo.alterar_preco_aprovado",
            entidade="veiculo",
            entidade_id=veiculo.id,
            detalhes=json.dumps({"preco_antigo": preco_antigo, "preco_novo": preco_novo, "solicitacao_id": solicitacao.id}),
            ip=request.client.host if request.client else None
        )

    elif solicitacao.tipo_acao == TipoAcaoAprovacao.EXCLUIR_VEICULO:
        if not veiculo:
            # Se já foi deletado de outra forma, apenas marca como aprovado
            pass
        else:
            await db.delete(veiculo)
            await db.commit()

            # Auditoria de Exclusão Aprovada
            await registrar_auditoria(
                db=db,
                loja_id=context.loja_id,
                ator_id=context.usuario.id,
                ator_nome=context.usuario.nome,
                acao="veiculo.excluir_aprovado",
                entidade="veiculo",
                entidade_id=solicitacao.entidade_id,
                detalhes=json.dumps({"solicitacao_id": solicitacao.id}),
                ip=request.client.host if request.client else None
            )

    await db.commit()
    await db.refresh(solicitacao)
    return solicitacao
