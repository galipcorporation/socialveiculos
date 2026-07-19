import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from database import get_db
from deps import get_current_user, registrar_auditoria
from models import Usuario, Favorito, Mensagem, Sessao, PapelUsuario
from limiter import rate_limit

router = APIRouter(prefix="/v1/lgpd", tags=["LGPD"])

@router.get("/exportar", dependencies=[Depends(rate_limit(5, 60))])
async def exportar_dados(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Exporta todos os dados pessoais do usuário em conformidade com a LGPD.
    """
    # 1. Dados do Perfil
    dados_perfil = {
        "id": current_user.id,
        "nome": current_user.nome,
        "email": current_user.email,
        "telefone": current_user.telefone,
        "papel": current_user.papel.value,
        "ativo": current_user.ativo,
        "mfa_ativo": current_user.mfa_ativo,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }

    # 2. Favoritos (B2C)
    stmt_favs = select(Favorito).where(Favorito.usuario_id == current_user.id)
    res_favs = await db.execute(stmt_favs)
    favoritos = res_favs.scalars().all()
    dados_favoritos = [
        {
            "id": fav.id,
            "veiculo_id": fav.veiculo_id,
            "created_at": fav.created_at.isoformat() if fav.created_at else None
        }
        for fav in favoritos
    ]

    # 3. Mensagens enviadas
    stmt_msgs = select(Mensagem).where(Mensagem.autor_id == current_user.id)
    res_msgs = await db.execute(stmt_msgs)
    mensagens = res_msgs.scalars().all()
    dados_mensagens = [
        {
            "id": msg.id,
            "conversa_id": msg.conversa_id,
            "conteudo": msg.conteudo,
            "lida": msg.lida,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
        for msg in mensagens
    ]

    # 4. Sessões ativas/históricas
    stmt_sessoes = select(Sessao).where(Sessao.usuario_id == current_user.id)
    res_sessoes = await db.execute(stmt_sessoes)
    sessoes = res_sessoes.scalars().all()
    dados_sessoes = [
        {
            "id": sessao.id,
            "ip": sessao.ip,
            "user_agent": sessao.user_agent,
            "revogada": sessao.revogada,
            "created_at": sessao.created_at.isoformat() if sessao.created_at else None,
            "expira_em": sessao.expira_em.isoformat() if sessao.expira_em else None
        }
        for sessao in sessoes
    ]

    return {
        "perfil": dados_perfil,
        "favoritos": dados_favoritos,
        "mensagens": dados_mensagens,
        "sessoes": dados_sessoes
    }


@router.delete("/excluir", status_code=status.HTTP_200_OK, dependencies=[Depends(rate_limit(5, 60))])
async def excluir_dados(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Solicita a exclusão e anonimização dos dados do usuário (exclusivo para clientes finais B2C).
    Contas B2B (Gestores e Vendedores) devem ser inativadas pelo administrador da loja para evitar órfãos em logs financeiros e de estoque.
    """
    if current_user.papel != PapelUsuario.CLIENTE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas clientes B2C podem solicitar autoexclusão direta via LGPD. Usuários B2B devem solicitar a inativação ao gestor da loja."
        )

    client_ip = request.client.host if request.client else None

    # 1. Registrar Auditoria do pedido de exclusão
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=current_user.id,
        ator_nome=current_user.nome,
        acao="lgpd.excluir",
        entidade="usuario",
        entidade_id=current_user.id,
        detalhes="Autoexclusão e anonimização de conta sob solicitação LGPD.",
        ip=client_ip
    )

    # 2. Deletar sessões ativas do usuário
    await db.execute(delete(Sessao).where(Sessao.usuario_id == current_user.id))

    # 3. Deletar favoritos do usuário
    await db.execute(delete(Favorito).where(Favorito.usuario_id == current_user.id))

    # 4. Deletar mensagens enviadas pelo usuário (para limpar conteúdo privado)
    await db.execute(delete(Mensagem).where(Mensagem.autor_id == current_user.id))

    # 5. Anonimizar o cadastro do usuário
    anon_id = str(uuid.uuid4())[:8]
    current_user.nome = "Usuário Anonimizado"
    current_user.email = f"anonimo_{anon_id}@lgpd.socialveiculos.com.br"
    current_user.telefone = None
    current_user.senha_hash = "anonimo-bloqueado"
    current_user.avatar_url = None
    current_user.ativo = False
    current_user.mfa_ativo = False
    current_user.mfa_secret = None

    await db.commit()

    return {"message": "Sua conta foi anonimizada com sucesso e todos os dados pessoais e mensagens associadas foram excluídos."}
