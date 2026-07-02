"""
Social Veículos — Rotas de Equipe (Membros da Loja) — Tarefa 8.4
Gestão da equipe da concessionária: convidar, listar, editar papel/módulos e desativar membros.
Escopado por tenant (loja_id) e protegido por RBAC (Recurso.MEMBRO_EQUIPE).
"""

import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from auth import hash_password
from models import Usuario, MembroLoja, PapelUsuario
from rbac import exige_permissao, Acao, Recurso
from schemas import (
    MembroEquipeResponse,
    ConvidarMembroRequest,
    AtualizarMembroRequest,
)

router = APIRouter(prefix="/v1/equipe", tags=["Equipe (Membros da Loja)"])


# Papéis que podem existir DENTRO de uma loja (nunca admin_plataforma via equipe)
PAPEIS_PERMITIDOS_NA_LOJA = {PapelUsuario.GESTOR, PapelUsuario.VENDEDOR}


def _montar_membro_response(membro: MembroLoja, usuario: Usuario) -> dict:
    """Combina o vínculo e o usuário no formato do MembroEquipeResponse."""
    return {
        "id": membro.id,
        "usuario_id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "telefone": usuario.telefone,
        "avatar_url": usuario.avatar_url,
        "papel": membro.papel,
        "modulos": membro.modulos,
        "ativo": membro.ativo,
        "created_at": membro.created_at,
    }


@router.get(
    "",
    response_model=List[MembroEquipeResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.MEMBRO_EQUIPE))],
)
async def listar_equipe(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Lista os membros da equipe da loja autenticada.
    🔒 Isolamento por Tenant: filtra estritamente por loja_id do contexto.
    """
    stmt = (
        select(MembroLoja, Usuario)
        .join(Usuario, MembroLoja.usuario_id == Usuario.id)
        .where(MembroLoja.loja_id == context.loja_id)
        .order_by(MembroLoja.created_at.desc())
    )
    res = await db.execute(stmt)
    return [_montar_membro_response(membro, usuario) for membro, usuario in res.all()]


@router.post(
    "",
    response_model=MembroEquipeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exige_permissao(Acao.CRIAR, Recurso.MEMBRO_EQUIPE))],
)
async def convidar_membro(
    data: ConvidarMembroRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Convida um novo membro para a equipe da loja.
    Se o e-mail já existir, reaproveita o usuário; senão, cria um novo.
    🔒 Isolamento por Tenant: vincula sempre à loja do contexto.
    """
    if data.papel not in PAPEIS_PERMITIDOS_NA_LOJA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Papel inválido para um membro de loja. Use gestor ou vendedor.",
        )

    email = data.email.strip().lower()

    # 1. Localizar ou criar o usuário
    res = await db.execute(select(Usuario).where(Usuario.email == email))
    usuario = res.scalar_one_or_none()

    if usuario is None:
        usuario = Usuario(
            nome=data.nome,
            email=email,
            telefone=data.telefone,
            senha_hash=hash_password(data.senha),
            papel=data.papel,
            ativo=True,
        )
        db.add(usuario)
        await db.flush()  # obtém o id do usuário
    else:
        # Cliente final não pode ser promovido a membro de equipe por aqui
        if usuario.papel == PapelUsuario.ADMIN_PLATAFORMA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível adicionar um admin de plataforma como membro.",
            )

    # 2. Garantir que ainda não é membro desta loja
    res_vinc = await db.execute(
        select(MembroLoja).where(
            MembroLoja.usuario_id == usuario.id,
            MembroLoja.loja_id == context.loja_id,
        )
    )
    if res_vinc.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este usuário já faz parte da equipe desta loja.",
        )

    # 3. Criar o vínculo
    membro = MembroLoja(
        usuario_id=usuario.id,
        loja_id=context.loja_id,
        papel=data.papel,
        modulos=data.modulos,
        ativo=True,
    )
    db.add(membro)
    await db.commit()
    await db.refresh(membro)
    await db.refresh(usuario)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="equipe.convidar",
        entidade="membro_loja",
        entidade_id=membro.id,
        detalhes=json.dumps({"email": email, "papel": data.papel.value}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return _montar_membro_response(membro, usuario)


@router.patch(
    "/{membro_id}",
    response_model=MembroEquipeResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.MEMBRO_EQUIPE))],
)
async def atualizar_membro(
    membro_id: str,
    data: AtualizarMembroRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Atualiza papel, módulos liberados ou status (ativo/inativo) de um membro.
    🔒 Isolamento por Tenant: só altera membros da própria loja.
    """
    res = await db.execute(
        select(MembroLoja, Usuario)
        .join(Usuario, MembroLoja.usuario_id == Usuario.id)
        .where(MembroLoja.id == membro_id, MembroLoja.loja_id == context.loja_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado nesta loja.",
        )
    membro, usuario = row

    # Não permitir o gestor rebaixar/desativar a si mesmo (evita travar a loja)
    if usuario.id == context.usuario.id and (data.ativo is False or data.papel == PapelUsuario.VENDEDOR):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode rebaixar ou desativar o seu próprio acesso.",
        )

    body = data.model_dump(exclude_unset=True)

    if "papel" in body:
        if body["papel"] not in PAPEIS_PERMITIDOS_NA_LOJA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Papel inválido para um membro de loja.",
            )
        membro.papel = body["papel"]
    if "modulos" in body:
        membro.modulos = body["modulos"]
    if "ativo" in body:
        membro.ativo = body["ativo"]

    await db.commit()
    await db.refresh(membro)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="equipe.editar",
        entidade="membro_loja",
        entidade_id=membro.id,
        detalhes=json.dumps({k: (v.value if hasattr(v, "value") else v) for k, v in body.items()}),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return _montar_membro_response(membro, usuario)


@router.delete(
    "/{membro_id}",
    dependencies=[Depends(exige_permissao(Acao.EXCLUIR, Recurso.MEMBRO_EQUIPE))],
)
async def remover_membro(
    membro_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Remove o vínculo de um membro com a loja (não exclui o usuário em si).
    🔒 Isolamento por Tenant: só remove membros da própria loja.
    """
    res = await db.execute(
        select(MembroLoja).where(
            MembroLoja.id == membro_id, MembroLoja.loja_id == context.loja_id
        )
    )
    membro = res.scalar_one_or_none()
    if not membro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado nesta loja.",
        )

    if membro.usuario_id == context.usuario.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode remover o seu próprio vínculo com a loja.",
        )

    await db.delete(membro)
    await db.commit()

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="equipe.remover",
        entidade="membro_loja",
        entidade_id=membro_id,
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return {"message": "Membro removido da equipe com sucesso."}


@router.get(
    "/{usuario_id}/assistente",
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.MEMBRO_EQUIPE))],
)
async def obter_permissao_assistente(
    usuario_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Retorna a permissão do assistente de IA para um vendedor específico.
    🔒 Isolamento por Tenant: checa se o usuario pertence à loja.
    """
    # Validar se o usuário pertence à equipe desta loja
    vinc_stmt = select(MembroLoja).where(
        MembroLoja.usuario_id == usuario_id,
        MembroLoja.loja_id == context.loja_id
    )
    res_vinc = await db.execute(vinc_stmt)
    if not res_vinc.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não é membro da equipe desta loja."
        )

    # Buscar permissão na tabela assistente_permissao
    from models import AssistentePermissao, AutonomiaAssistente
    stmt = select(AssistentePermissao).where(
        AssistentePermissao.loja_id == context.loja_id,
        AssistentePermissao.usuario_id == usuario_id
    )
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()

    if not perm:
        # Se não existe, retorna desligado por padrão
        return {
            "usuario_id": usuario_id,
            "pode_usar": False,
            "autonomia_default": AutonomiaAssistente.COPILOTO.value
        }

    return {
        "usuario_id": perm.usuario_id,
        "pode_usar": perm.pode_usar,
        "autonomia_default": perm.autonomia_default.value
    }


@router.put(
    "/{usuario_id}/assistente",
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.MEMBRO_EQUIPE))],
)
async def atualizar_permissao_assistente(
    usuario_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Atualiza se o vendedor pode usar o assistente de IA e sua autonomia padrão.
    🔒 Isolamento por Tenant: garante que o gestor só altera vendedores de sua própria loja.
    """
    # Validar se o usuário pertence à equipe desta loja
    vinc_stmt = select(MembroLoja).where(
        MembroLoja.usuario_id == usuario_id,
        MembroLoja.loja_id == context.loja_id
    )
    res_vinc = await db.execute(vinc_stmt)
    if not res_vinc.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não é membro da equipe desta loja."
        )

    pode_usar = body.get("pode_usar", False)
    autonomia_raw = body.get("autonomia_default", "copiloto")

    from models import AssistentePermissao, AutonomiaAssistente
    try:
        autonomia = AutonomiaAssistente(autonomia_raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Autonomia padrão inválida. Use 'copiloto' ou 'automatico'."
        )

    # Buscar ou criar registro
    stmt = select(AssistentePermissao).where(
        AssistentePermissao.loja_id == context.loja_id,
        AssistentePermissao.usuario_id == usuario_id
    )
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()

    if not perm:
        perm = AssistentePermissao(
            loja_id=context.loja_id,
            usuario_id=usuario_id,
            pode_usar=pode_usar,
            autonomia_default=autonomia
        )
        db.add(perm)
    else:
        perm.pode_usar = pode_usar
        perm.autonomia_default = autonomia

    await db.commit()
    await db.refresh(perm)

    return {
        "usuario_id": perm.usuario_id,
        "pode_usar": perm.pode_usar,
        "autonomia_default": perm.autonomia_default.value
    }
