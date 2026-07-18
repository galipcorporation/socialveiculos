"""
Social Veículos — Rotas de B2B (Feed de Repasses, Propostas e Chat)
Isolamento estrito entre tenants e comunicação segura B2B.
"""

import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import (
    utcnow,
    PublicacaoB2B, Comentario, Curtida, PropostaRepasse,
    Conversa, Mensagem, Loja, Veiculo, StatusVeiculo,
    StatusPropostaRepasse, TipoConversa, Usuario, MembroLoja
)
from schemas import (
    PublicacaoB2BResponse, ComentarioB2BResponse, ComentarioB2BCreateRequest,
    PropostaRepasseResponse, PropostaRepasseCreateRequest, PropostaRepasseStatusRequest,
    ConversaB2BResponse, MensagemB2BResponse, MensagemB2BCreateRequest,
    LojaResponse
)
from auth import decode_access_token

class ConnectionManager:
    # Teto de conexões simultâneas por usuário. Protege o dict em memória contra
    # crescimento ilimitado quando o cliente com reconexão automática (B024) deixa
    # sockets meio-abertos acumulados (várias abas, rede instável, deploy).
    MAX_CONNECTIONS_PER_USER = 8

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, usuario_id: str, websocket: WebSocket):
        await websocket.accept()
        conns = self.active_connections.setdefault(usuario_id, [])
        conns.append(websocket)
        # Se exceder o teto, encerra as conexões mais antigas (best-effort).
        # A conexão evicta é removida da lista aqui; quando o loop dela receber o
        # WebSocketDisconnect e chamar disconnect(), o guard `websocket in [...]`
        # já a ignora — sem KeyError e sem duplo-remove.
        while len(conns) > self.MAX_CONNECTIONS_PER_USER:
            oldest = conns.pop(0)
            try:
                await oldest.close(code=status.WS_1013_TRY_AGAIN_LATER)
            except Exception:
                pass

    def disconnect(self, usuario_id: str, websocket: WebSocket):
        if usuario_id in self.active_connections:
            if websocket in self.active_connections[usuario_id]:
                self.active_connections[usuario_id].remove(websocket)
            if not self.active_connections[usuario_id]:
                del self.active_connections[usuario_id]

    async def send_personal_message(self, message: dict, usuario_id: str):
        if usuario_id in self.active_connections:
            for connection in self.active_connections[usuario_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast_to_conversation(self, conversa_id: str, message: dict, db: AsyncSession):
        stmt = select(Conversa).where(Conversa.id == conversa_id)
        res = await db.execute(stmt)
        conversa = res.scalar_one_or_none()
        if not conversa:
            return

        user_ids = []
        if conversa.tipo == TipoConversa.B2B:
            stmt_members = select(Usuario.id).join(MembroLoja, MembroLoja.usuario_id == Usuario.id).where(
                or_(
                    MembroLoja.loja_id == conversa.loja_a_id,
                    MembroLoja.loja_id == conversa.loja_b_id
                )
            )
            res_members = await db.execute(stmt_members)
            user_ids = [row[0] for row in res_members.all()]
        else:
            if conversa.cliente_id:
                user_ids.append(conversa.cliente_id)
            if conversa.loja_id:
                stmt_members = select(Usuario.id).join(MembroLoja, MembroLoja.usuario_id == Usuario.id).where(
                    MembroLoja.loja_id == conversa.loja_id
                )
                res_members = await db.execute(stmt_members)
                user_ids.extend([row[0] for row in res_members.all()])

        for uid in set(user_ids):
            await self.send_personal_message(message, uid)

manager = ConnectionManager()


router = APIRouter(prefix="/v1/b2b", tags=["B2B Social"])


# ───────────────────────────────────────────────────────────────
# 7.1 — Feed de Repasses (Cross-tenant)
# ───────────────────────────────────────────────────────────────

@router.get("/repasses", response_model=List[PublicacaoB2BResponse])
async def listar_repasses(
    marca: Optional[str] = None,
    modelo: Optional[str] = None,
    ano_modelo: Optional[int] = None,
    preco_max: Optional[float] = None,
    combustivel: Optional[str] = None,
    cidade: Optional[str] = None,
    estado: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna as publicações de repasse ativas de outras lojas.
    Filtra por marca, modelo, ano, preço máximo, combustível e localização.
    """
    stmt = (
        select(PublicacaoB2B)
        .join(Veiculo, PublicacaoB2B.veiculo_id == Veiculo.id)
        .join(Loja, PublicacaoB2B.loja_id == Loja.id)
        .options(
            selectinload(PublicacaoB2B.curtidas),
            selectinload(PublicacaoB2B.comentarios),
            selectinload(PublicacaoB2B.veiculo).selectinload(Veiculo.midias),
            selectinload(PublicacaoB2B.loja),
        )
        .where(
            PublicacaoB2B.ativa == True,
            Veiculo.status == StatusVeiculo.REPASSE
        )
    )

    if marca:
        stmt = stmt.where(Veiculo.marca.ilike(f"%{marca}%"))
    if modelo:
        stmt = stmt.where(Veiculo.modelo.ilike(f"%{modelo}%"))
    if ano_modelo:
        stmt = stmt.where(Veiculo.ano_modelo == ano_modelo)
    if preco_max:
        # No B2B o valor do repasse é o preço de repasse (valor_repasse) ou preco_venda
        stmt = stmt.where(
            or_(
                PublicacaoB2B.valor_repasse <= preco_max,
                and_(PublicacaoB2B.valor_repasse == None, Veiculo.preco_venda <= preco_max)
            )
        )
    if combustivel:
        stmt = stmt.where(Veiculo.combustivel == combustivel)
    if cidade:
        stmt = stmt.where(Loja.cidade.ilike(f"%{cidade}%"))
    if estado:
        stmt = stmt.where(Loja.estado.ilike(f"%{estado}%"))

    stmt = (
        stmt.order_by(PublicacaoB2B.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    res = await db.execute(stmt)
    pubs = res.scalars().all()

    # Batch: nomes de todos os autores (publicações + comentários) numa query só,
    # em vez de 1 SELECT por publicação + 1 SELECT por comentário.
    autor_ids = {pub.autor_id for pub in pubs if pub.autor_id}
    for pub in pubs:
        autor_ids.update(com.autor_id for com in pub.comentarios if com.autor_id)

    autores_por_id: dict[str, str] = {}
    if autor_ids:
        autores_res = await db.execute(select(Usuario.id, Usuario.nome).where(Usuario.id.in_(autor_ids)))
        autores_por_id = {uid: nome for uid, nome in autores_res.all()}

    # Preencher informações extras
    result = []
    for pub in pubs:
        autor_name = autores_por_id.get(pub.autor_id, "Lojista")

        # Curtido por mim
        curtido = any(c.usuario_id == context.usuario.id for c in pub.curtidas)

        # Comentários detalhados
        comentarios_response = sorted(
            (
                ComentarioB2BResponse(
                    id=com.id,
                    publicacao_id=com.publicacao_id,
                    autor_id=com.autor_id,
                    autor_nome=autores_por_id.get(com.autor_id, "Lojista"),
                    conteudo=com.conteudo,
                    created_at=com.created_at
                )
                for com in pub.comentarios
            ),
            key=lambda x: x.created_at,
        )

        result.append(
            PublicacaoB2BResponse(
                id=pub.id,
                loja_id=pub.loja_id,
                loja_nome=pub.loja.nome if pub.loja else "Loja Parceira",
                veiculo_id=pub.veiculo_id,
                veiculo=pub.veiculo,
                autor_id=pub.autor_id,
                autor_nome=autor_name,
                conteudo=pub.conteudo,
                valor_repasse=pub.valor_repasse,
                ativa=pub.ativa,
                created_at=pub.created_at,
                updated_at=pub.updated_at,
                comentarios=comentarios_response,
                curtidas=pub.curtidas,
                curtido_por_mim=curtido
            )
        )

    return result


@router.post("/repasses/{pub_id}/curtir")
async def curtir_repasse(
    pub_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Curte ou descurte (toggle) uma publicação de repasse.
    """
    # Verifica se a publicação existe
    stmt_pub = select(PublicacaoB2B).where(PublicacaoB2B.id == pub_id, PublicacaoB2B.ativa == True)
    res_pub = await db.execute(stmt_pub)
    pub = res_pub.scalar_one_or_none()
    if not pub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Publicação não encontrada ou inativa."
        )

    # Verifica se já está curtida
    stmt_curtida = select(Curtida).where(
        Curtida.publicacao_id == pub_id,
        Curtida.usuario_id == context.usuario.id
    )
    res_curtida = await db.execute(stmt_curtida)
    curtida = res_curtida.scalar_one_or_none()

    if curtida:
        # Descurtir
        await db.delete(curtida)
        message = "Curtida removida."
    else:
        # Curtir
        nova_curtida = Curtida(
            publicacao_id=pub_id,
            usuario_id=context.usuario.id
        )
        db.add(nova_curtida)
        message = "Curtida adicionada."

    await db.commit()
    return {"message": message}


@router.post("/repasses/{pub_id}/comentarios", response_model=ComentarioB2BResponse)
async def comentar_repasse(
    pub_id: str,
    data: ComentarioB2BCreateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Adiciona um comentário em uma publicação de repasse.
    """
    stmt_pub = select(PublicacaoB2B).where(PublicacaoB2B.id == pub_id, PublicacaoB2B.ativa == True)
    res_pub = await db.execute(stmt_pub)
    pub = res_pub.scalar_one_or_none()
    if not pub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Publicação não encontrada ou inativa."
        )

    novo_comentario = Comentario(
        publicacao_id=pub_id,
        autor_id=context.usuario.id,
        conteudo=data.conteudo
    )
    db.add(novo_comentario)
    await db.commit()
    await db.refresh(novo_comentario)

    return ComentarioB2BResponse(
        id=novo_comentario.id,
        publicacao_id=novo_comentario.publicacao_id,
        autor_id=novo_comentario.autor_id,
        autor_nome=context.usuario.nome,
        conteudo=novo_comentario.conteudo,
        created_at=novo_comentario.created_at
    )


# ───────────────────────────────────────────────────────────────
# 7.2 — Propostas de Repasse
# ───────────────────────────────────────────────────────────────

@router.post("/propostas", response_model=PropostaRepasseResponse, status_code=status.HTTP_201_CREATED)
async def criar_proposta_repasse(
    data: PropostaRepasseCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Envia uma proposta de repasse direto para o proprietário de um veículo.
    """
    # Obter veículo e validar status
    stmt_veic = select(Veiculo).options(selectinload(Veiculo.midias)).where(Veiculo.id == data.veiculo_id)
    res_veic = await db.execute(stmt_veic)
    veiculo = res_veic.scalar_one_or_none()

    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado."
        )

    if veiculo.status != StatusVeiculo.REPASSE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propostas de repasse só podem ser feitas para veículos com status REPASSE."
        )

    if veiculo.loja_id == context.loja_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode fazer uma proposta para sua própria loja."
        )

    nova_proposta = PropostaRepasse(
        loja_proponente_id=context.loja_id,
        loja_destino_id=veiculo.loja_id,
        veiculo_id=veiculo.id,
        valor_proposta=data.valor_proposta,
        observacoes=data.observacoes,
        status=StatusPropostaRepasse.PENDENTE
    )
    db.add(nova_proposta)
    await db.commit()
    await db.refresh(nova_proposta)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="b2b.proposta.enviar",
        entidade="proposta_repasse",
        entidade_id=nova_proposta.id,
        detalhes=json.dumps({"veiculo_id": veiculo.id, "valor": data.valor_proposta}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Preencher nomes
    stmt_lojas = select(Loja).where(Loja.id.in_([context.loja_id, veiculo.loja_id]))
    res_lojas = await db.execute(stmt_lojas)
    lojas = res_lojas.scalars().all()
    loja_prop_nome = next((l.nome for l in lojas if l.id == context.loja_id), "Minha Loja")
    loja_dest_nome = next((l.nome for l in lojas if l.id == veiculo.loja_id), "Loja Parceira")

    # Criar Notificação para a loja destino
    try:
        from models import Notificacao
        from uuid import uuid4
        msg_notif = f"A loja {loja_prop_nome} enviou uma proposta de R$ {nova_proposta.valor_proposta:,.2f} para o veículo {veiculo.marca} {veiculo.modelo}."
        notif = Notificacao(
            id=str(uuid4()),
            loja_id=veiculo.loja_id,
            titulo="Nova Proposta de Repasse",
            conteudo=msg_notif,
            tipo="proposta",
            link="rede_social:",
        )
        db.add(notif)
        await db.commit()
    except Exception as e:
        print(f"[ERRO Notificacao] Falha ao criar notificacao: {e}")

    return PropostaRepasseResponse(
        id=nova_proposta.id,
        loja_proponente_id=nova_proposta.loja_proponente_id,
        loja_proponente_nome=loja_prop_nome,
        loja_destino_id=nova_proposta.loja_destino_id,
        loja_destino_nome=loja_dest_nome,
        veiculo_id=nova_proposta.veiculo_id,
        veiculo=veiculo,
        valor_proposta=nova_proposta.valor_proposta,
        status=nova_proposta.status,
        observacoes=nova_proposta.observacoes,
        created_at=nova_proposta.created_at,
        updated_at=nova_proposta.updated_at
    )


@router.get("/propostas/recebidas", response_model=List[PropostaRepasseResponse])
async def listar_propostas_recebidas(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna as propostas de repasse recebidas pela loja do usuário.
    """
    stmt = (
        select(PropostaRepasse)
        .join(Veiculo, PropostaRepasse.veiculo_id == Veiculo.id)
        .options(selectinload(PropostaRepasse.veiculo).selectinload(Veiculo.midias))
        .where(PropostaRepasse.loja_destino_id == context.loja_id)
        .order_by(PropostaRepasse.created_at.desc())
    )
    res = await db.execute(stmt)
    propostas = res.scalars().all()

    result = []
    for prop in propostas:
        # Obter nomes das lojas
        stmt_prop_loja = select(Loja).where(Loja.id == prop.loja_proponente_id)
        res_prop_loja = await db.execute(stmt_prop_loja)
        loja_prop = res_prop_loja.scalar_one_or_none()

        stmt_dest_loja = select(Loja).where(Loja.id == prop.loja_destino_id)
        res_dest_loja = await db.execute(stmt_dest_loja)
        loja_dest = res_dest_loja.scalar_one_or_none()

        result.append(
            PropostaRepasseResponse(
                id=prop.id,
                loja_proponente_id=prop.loja_proponente_id,
                loja_proponente_nome=loja_prop.nome if loja_prop else "Loja Parceira",
                loja_destino_id=prop.loja_destino_id,
                loja_destino_nome=loja_dest.nome if loja_dest else "Minha Loja",
                veiculo_id=prop.veiculo_id,
                veiculo=prop.veiculo,
                valor_proposta=prop.valor_proposta,
                status=prop.status,
                observacoes=prop.observacoes,
                created_at=prop.created_at,
                updated_at=prop.updated_at
            )
        )
    return result


@router.get("/propostas/enviadas", response_model=List[PropostaRepasseResponse])
async def listar_propostas_enviadas(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna as propostas de repasse enviadas pela loja do usuário.
    """
    stmt = (
        select(PropostaRepasse)
        .join(Veiculo, PropostaRepasse.veiculo_id == Veiculo.id)
        .options(selectinload(PropostaRepasse.veiculo).selectinload(Veiculo.midias))
        .where(PropostaRepasse.loja_proponente_id == context.loja_id)
        .order_by(PropostaRepasse.created_at.desc())
    )
    res = await db.execute(stmt)
    propostas = res.scalars().all()

    result = []
    for prop in propostas:
        # Obter nomes das lojas
        stmt_prop_loja = select(Loja).where(Loja.id == prop.loja_proponente_id)
        res_prop_loja = await db.execute(stmt_prop_loja)
        loja_prop = res_prop_loja.scalar_one_or_none()

        stmt_dest_loja = select(Loja).where(Loja.id == prop.loja_destino_id)
        res_dest_loja = await db.execute(stmt_dest_loja)
        loja_dest = res_dest_loja.scalar_one_or_none()

        result.append(
            PropostaRepasseResponse(
                id=prop.id,
                loja_proponente_id=prop.loja_proponente_id,
                loja_proponente_nome=loja_prop.nome if loja_prop else "Minha Loja",
                loja_destino_id=prop.loja_destino_id,
                loja_destino_nome=loja_dest.nome if loja_dest else "Loja Parceira",
                veiculo_id=prop.veiculo_id,
                veiculo=prop.veiculo,
                valor_proposta=prop.valor_proposta,
                status=prop.status,
                observacoes=prop.observacoes,
                created_at=prop.created_at,
                updated_at=prop.updated_at
            )
        )
    return result


@router.patch("/propostas/{id}/status", response_model=PropostaRepasseResponse)
async def processar_proposta_repasse(
    id: str,
    data: PropostaRepasseStatusRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Processa uma proposta de repasse (aceita, rejeita ou cancela).
    """
    stmt = (
        select(PropostaRepasse)
        .options(selectinload(PropostaRepasse.veiculo).selectinload(Veiculo.midias))
        .where(
            or_(
                PropostaRepasse.loja_destino_id == context.loja_id,
                PropostaRepasse.loja_proponente_id == context.loja_id
            ),
            PropostaRepasse.id == id
        )
    )
    res = await db.execute(stmt)
    proposta = res.scalar_one_or_none()

    if not proposta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposta não encontrada."
        )

    # Regras de transição de status
    if data.status == StatusPropostaRepasse.CANCELADA:
        if proposta.loja_proponente_id != context.loja_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas a loja proponente pode cancelar a proposta."
            )
        if proposta.status != StatusPropostaRepasse.PENDENTE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apenas propostas pendentes podem ser canceladas."
            )
        proposta.status = StatusPropostaRepasse.CANCELADA
    
    elif data.status in [StatusPropostaRepasse.ACEITA, StatusPropostaRepasse.REJEITADA]:
        if proposta.loja_destino_id != context.loja_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas a loja de destino pode aceitar/rejeitar a proposta."
            )
        if proposta.status != StatusPropostaRepasse.PENDENTE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apenas propostas pendentes podem ser processadas."
            )

        # Venda dupla: o veículo pode ter sido vendido no balcão (contrato)
        # enquanto esta proposta B2B ainda estava pendente.
        if data.status == StatusPropostaRepasse.ACEITA and proposta.veiculo:
            if proposta.veiculo.status == StatusVeiculo.VENDIDO:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Veículo já foi vendido por outro canal."
                )

        proposta.status = data.status

        # Se for aceita, marca o veículo como vendido e as outras propostas pendentes como rejeitadas
        if data.status == StatusPropostaRepasse.ACEITA:
            if proposta.veiculo:
                proposta.veiculo.status = StatusVeiculo.VENDIDO
                proposta.veiculo.publicado_marketplace = False
                proposta.veiculo.updated_at = utcnow()
                # Atualizar a publicação B2B correspondente
                pub_stmt = select(PublicacaoB2B).where(PublicacaoB2B.veiculo_id == proposta.veiculo_id)
                pub_res = await db.execute(pub_stmt)
                pub = pub_res.scalar_one_or_none()
                if pub:
                    pub.ativa = False

                # Auto-rejeitar outras propostas pendentes do mesmo veículo
                stmt_outras = select(PropostaRepasse).where(
                    PropostaRepasse.veiculo_id == proposta.veiculo_id,
                    PropostaRepasse.id != proposta.id,
                    PropostaRepasse.status == StatusPropostaRepasse.PENDENTE
                )
                res_outras = await db.execute(stmt_outras)
                for outra in res_outras.scalars().all():
                    outra.status = StatusPropostaRepasse.REJEITADA

    proposta.updated_at = utcnow()
    await db.commit()
    await db.refresh(proposta)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao=f"b2b.proposta.{data.status.value}",
        entidade="proposta_repasse",
        entidade_id=proposta.id,
        detalhes=json.dumps({"veiculo_id": proposta.veiculo_id}),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    # Preencher nomes
    stmt_prop_loja = select(Loja).where(Loja.id == proposta.loja_proponente_id)
    res_prop_loja = await db.execute(stmt_prop_loja)
    loja_prop = res_prop_loja.scalar_one_or_none()

    stmt_dest_loja = select(Loja).where(Loja.id == proposta.loja_destino_id)
    res_dest_loja = await db.execute(stmt_dest_loja)
    loja_dest = res_dest_loja.scalar_one_or_none()

    return PropostaRepasseResponse(
        id=proposta.id,
        loja_proponente_id=proposta.loja_proponente_id,
        loja_proponente_nome=loja_prop.nome if loja_prop else "Loja Parceira",
        loja_destino_id=proposta.loja_destino_id,
        loja_destino_nome=loja_dest.nome if loja_dest else "Loja Parceira",
        veiculo_id=proposta.veiculo_id,
        veiculo=proposta.veiculo,
        valor_proposta=proposta.valor_proposta,
        status=proposta.status,
        observacoes=proposta.observacoes,
        created_at=proposta.created_at,
        updated_at=proposta.updated_at
    )


# ───────────────────────────────────────────────────────────────
# 7.4 — Diretório de Parceiros
# ───────────────────────────────────────────────────────────────

@router.get("/parceiros", response_model=List[LojaResponse])
async def listar_parceiros(
    q: Optional[str] = None,
    cidade: Optional[str] = None,
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna a lista de outras lojas ativas na plataforma para iniciar conversas ou parcerias.
    """
    stmt = select(Loja).where(
        Loja.id != context.loja_id,
        Loja.ativa == True
    )

    if q:
        stmt = stmt.where(or_(Loja.nome.ilike(f"%{q}%"), Loja.slug.ilike(f"%{q}%")))
    if cidade:
        stmt = stmt.where(Loja.cidade.ilike(f"%{cidade}%"))
    if estado:
        stmt = stmt.where(Loja.estado.ilike(f"%{estado}%"))

    stmt = stmt.order_by(Loja.nome.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


# ───────────────────────────────────────────────────────────────
# 7.3 — Chat B2B (REST / Polling)
# ───────────────────────────────────────────────────────────────

@router.get("/chat/unread-count")
async def contar_nao_lidas(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Contagem agregada de mensagens não lidas (B2B + B2C) para o badge do sidebar.
    Só 2 COUNTs — substitui baixar as listas completas de conversas via polling.
    """
    b2b_res = await db.execute(
        select(func.count(Mensagem.id))
        .select_from(Mensagem)
        .join(Conversa, Mensagem.conversa_id == Conversa.id)
        .where(
            Conversa.tipo == TipoConversa.B2B,
            Conversa.ativa == True,
            or_(Conversa.loja_a_id == context.loja_id, Conversa.loja_b_id == context.loja_id),
            Mensagem.autor_id != context.usuario.id,
            Mensagem.lida == False,
        )
    )
    unread_b2b = b2b_res.scalar() or 0

    b2c_res = await db.execute(
        select(func.count(Mensagem.id))
        .select_from(Mensagem)
        .join(Conversa, Mensagem.conversa_id == Conversa.id)
        .where(
            Conversa.tipo == TipoConversa.B2C,
            Conversa.loja_id == context.loja_id,
            Mensagem.autor_id == Conversa.cliente_id,
            Mensagem.lida == False,
        )
    )
    unread_b2c = b2c_res.scalar() or 0

    return {"unread_b2b": unread_b2b, "unread_b2c": unread_b2c}


@router.get("/chat/conversas", response_model=List[ConversaB2BResponse])
async def listar_conversas_b2b(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna as conversas B2B (entre lojas) que envolvem a loja do usuário.
    """
    stmt = (
        select(Conversa)
        .where(
            Conversa.tipo == TipoConversa.B2B,
            Conversa.ativa == True,
            or_(
                Conversa.loja_a_id == context.loja_id,
                Conversa.loja_b_id == context.loja_id
            )
        )
        .order_by(Conversa.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    if not conversas:
        return []

    conversa_ids = [c.id for c in conversas]
    loja_ids = {c.loja_a_id for c in conversas} | {c.loja_b_id for c in conversas}

    # Batch: lojas de todas as conversas numa query só (era 2 por conversa).
    lojas_res = await db.execute(select(Loja.id, Loja.nome).where(Loja.id.in_(loja_ids)))
    nomes_loja = {lid: nome for lid, nome in lojas_res.all()}

    # Batch: contagem de não-lidas de todas as conversas, agrupada (era 1 query por conversa).
    unread_res = await db.execute(
        select(Mensagem.conversa_id, func.count(Mensagem.id))
        .where(
            Mensagem.conversa_id.in_(conversa_ids),
            Mensagem.autor_id != context.usuario.id,
            Mensagem.lida == False,
        )
        .group_by(Mensagem.conversa_id)
    )
    unread_por_conversa = {cid: count for cid, count in unread_res.all()}

    # Batch: última mensagem de cada conversa via subquery de MAX(created_at) + join.
    ultima_data_sub = (
        select(Mensagem.conversa_id, func.max(Mensagem.created_at).label("max_data"))
        .where(Mensagem.conversa_id.in_(conversa_ids))
        .group_by(Mensagem.conversa_id)
        .subquery()
    )
    ultima_msg_res = await db.execute(
        select(Mensagem.conversa_id, Mensagem.conteudo, Mensagem.created_at).join(
            ultima_data_sub,
            and_(
                Mensagem.conversa_id == ultima_data_sub.c.conversa_id,
                Mensagem.created_at == ultima_data_sub.c.max_data,
            ),
        )
    )
    ultima_msg_por_conversa = {
        cid: (conteudo, created_at) for cid, conteudo, created_at in ultima_msg_res.all()
    }

    result = []
    for conv in conversas:
        last_msg = ultima_msg_por_conversa.get(conv.id)
        result.append(
            ConversaB2BResponse(
                id=conv.id,
                tipo=conv.tipo,
                loja_a_id=conv.loja_a_id,
                loja_a_nome=nomes_loja.get(conv.loja_a_id, "Loja Parceira"),
                loja_b_id=conv.loja_b_id,
                loja_b_nome=nomes_loja.get(conv.loja_b_id, "Loja Parceira"),
                ativa=conv.ativa,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                ultima_mensagem=last_msg[0] if last_msg else None,
                ultima_mensagem_data=last_msg[1] if last_msg else None,
                mensagens_nao_lidas=unread_por_conversa.get(conv.id, 0)
            )
        )

    return result


class IniciarConversaRequest(dict):
    # Dicionário customizado p/ FastAPI aceitar body flexível ou estruturado
    pass


@router.post("/chat/conversas", response_model=ConversaB2BResponse)
async def iniciar_conversa_b2b(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Inicia uma nova conversa B2B ou recupera uma existente entre a loja do usuário e outra.
    """
    outra_loja_id = payload.get("outra_loja_id")
    if not outra_loja_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="outra_loja_id é obrigatório."
        )

    if outra_loja_id == context.loja_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode iniciar um chat com a sua própria loja."
        )

    # Validar que a outra loja existe
    stmt_loja = select(Loja).where(Loja.id == outra_loja_id, Loja.ativa == True)
    res_loja = await db.execute(stmt_loja)
    outra_loja = res_loja.scalar_one_or_none()
    if not outra_loja:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outra loja não encontrada ou inativa."
        )

    # Verificar se já existe uma conversa B2B entre elas
    stmt_existente = select(Conversa).where(
        Conversa.tipo == TipoConversa.B2B,
        or_(
            and_(Conversa.loja_a_id == context.loja_id, Conversa.loja_b_id == outra_loja_id),
            and_(Conversa.loja_a_id == outra_loja_id, Conversa.loja_b_id == context.loja_id)
        )
    )
    res_existente = await db.execute(stmt_existente)
    conversa = res_existente.scalar_one_or_none()

    if not conversa:
        # Criar nova conversa B2B
        conversa = Conversa(
            tipo=TipoConversa.B2B,
            loja_a_id=context.loja_id,
            loja_b_id=outra_loja_id,
            ativa=True
        )
        db.add(conversa)
        await db.commit()
        await db.refresh(conversa)

    # Carregar dados para resposta
    stmt_loja_a = select(Loja).where(Loja.id == conversa.loja_a_id)
    res_loja_a = await db.execute(stmt_loja_a)
    loja_a = res_loja_a.scalar_one_or_none()

    stmt_loja_b = select(Loja).where(Loja.id == conversa.loja_b_id)
    res_loja_b = await db.execute(stmt_loja_b)
    loja_b = res_loja_b.scalar_one_or_none()

    # Obter contagem de mensagens não lidas (será 0 para uma nova conversa, mas calculamos por segurança se for existente)
    stmt_unread = (
        select(func.count(Mensagem.id))
        .where(
            Mensagem.conversa_id == conversa.id,
            Mensagem.autor_id != context.usuario.id,
            Mensagem.lida == False
        )
    )
    res_unread = await db.execute(stmt_unread)
    unread_count = res_unread.scalar() or 0

    return ConversaB2BResponse(
        id=conversa.id,
        tipo=conversa.tipo,
        loja_a_id=conversa.loja_a_id,
        loja_a_nome=loja_a.nome if loja_a else "Loja Parceira",
        loja_b_id=conversa.loja_b_id,
        loja_b_nome=loja_b.nome if loja_b else "Loja Parceira",
        ativa=conversa.ativa,
        created_at=conversa.created_at,
        updated_at=conversa.updated_at,
        mensagens_nao_lidas=unread_count
    )


@router.get("/chat/conversas/{id}/mensagens", response_model=List[MensagemB2BResponse])
async def listar_mensagens_b2b(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Retorna as mensagens de uma conversa B2B. Marca como lidas as mensagens recebidas.
    """
    # Validar conversa e se pertence ao usuário
    stmt_conv = select(Conversa).where(
        Conversa.id == id,
        Conversa.tipo == TipoConversa.B2B,
        or_(
            Conversa.loja_a_id == context.loja_id,
            Conversa.loja_b_id == context.loja_id
        )
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()

    if not conversa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada."
        )

    # Se a conversa estiver arquivada no R2/S3/local
    if conversa.backup_url:
        try:
            from storage import storage_provider
            import json
            raw_data = await storage_provider.download_json(conversa.backup_url)
            data = json.loads(raw_data)
            messages_list = data.get("historico_mensagens", [])
            
            result = []
            for m in messages_list:
                result.append(
                    MensagemB2BResponse(
                        id=m.get("id"),
                        conversa_id=m.get("conversa_id"),
                        autor_id=m.get("autor_id"),
                        autor_nome=m.get("autor_nome", "Lojista"),
                        conteudo=m.get("conteudo"),
                        lida=m.get("lida", True),
                        created_at=datetime.fromisoformat(m.get("created_at")) if m.get("created_at") else datetime.now(timezone.utc)
                    )
                )
            return result
        except Exception as e:
            print(f"[ERRO Backup R2] Falha ao baixar mensagens arquivadas: {e}")

    # Obter mensagens
    stmt_msg = (
        select(Mensagem)
        .where(Mensagem.conversa_id == id)
        .order_by(Mensagem.created_at.asc())
    )
    res_msg = await db.execute(stmt_msg)
    mensagens = res_msg.scalars().all()

    # Marcar mensagens recebidas e não lidas como lidas
    mensagens_alteradas = False
    for msg in mensagens:
        if msg.autor_id != context.usuario.id and not msg.lida:
            msg.lida = True
            mensagens_alteradas = True

    if mensagens_alteradas:
        await db.commit()

    # Preencher informações extras (autor_nome)
    result = []
    for msg in mensagens:
        autor_name = "Lojista"
        if msg.autor_id:
            autor_stmt = select(Usuario).where(Usuario.id == msg.autor_id)
            autor_res = await db.execute(autor_stmt)
            autor_obj = autor_res.scalar_one_or_none()
            if autor_obj:
                autor_name = autor_obj.nome

        result.append(
            MensagemB2BResponse(
                id=msg.id,
                conversa_id=msg.conversa_id,
                autor_id=msg.autor_id,
                autor_nome=autor_name,
                conteudo=msg.conteudo,
                lida=msg.lida,
                created_at=msg.created_at
            )
        )

    return result


@router.post("/chat/conversas/{id}/arquivar")
async def arquivar_conversa_b2b(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Exporta todas as mensagens de uma conversa B2B para um arquivo JSON,
    faz o upload para o Cloudflare R2 (ou local) e limpa as mensagens do banco relacional.
    """
    stmt_conv = select(Conversa).where(
        Conversa.id == id,
        Conversa.tipo == TipoConversa.B2B,
        or_(
            Conversa.loja_a_id == context.loja_id,
            Conversa.loja_b_id == context.loja_id
        )
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()

    if not conversa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada."
        )

    if conversa.backup_url:
        return {"status": "success", "message": "Conversa já arquivada anteriormente.", "backup_url": conversa.backup_url}

    # Obter mensagens ativas do banco
    stmt_msg = select(Mensagem).where(Mensagem.conversa_id == id).order_by(Mensagem.created_at.asc())
    res_msg = await db.execute(stmt_msg)
    mensagens = res_msg.scalars().all()

    # Preencher informações para serialização
    stmt_loja_a = select(Loja).where(Loja.id == conversa.loja_a_id)
    res_loja_a = await db.execute(stmt_loja_a)
    loja_a = res_loja_a.scalar_one_or_none()

    stmt_loja_b = select(Loja).where(Loja.id == conversa.loja_b_id)
    res_loja_b = await db.execute(stmt_loja_b)
    loja_b = res_loja_b.scalar_one_or_none()

    messages_json = []
    for msg in mensagens:
        autor_name = "Lojista"
        if msg.autor_id:
            autor_stmt = select(Usuario).where(Usuario.id == msg.autor_id)
            autor_res = await db.execute(autor_stmt)
            autor_obj = autor_res.scalar_one_or_none()
            if autor_obj:
                autor_name = autor_obj.nome

        messages_json.append({
            "id": msg.id,
            "conversa_id": msg.conversa_id,
            "autor_id": msg.autor_id,
            "autor_nome": autor_name,
            "conteudo": msg.conteudo,
            "lida": msg.lida,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        })

    conversa_data = {
        "id": conversa.id,
        "tipo": conversa.tipo,
        "loja_a": {
            "id": conversa.loja_a_id,
            "nome": loja_a.nome if loja_a else "Loja Parceira"
        },
        "loja_b": {
            "id": conversa.loja_b_id,
            "nome": loja_b.nome if loja_b else "Loja Parceira"
        },
        "ativa": conversa.ativa,
        "created_at": conversa.created_at.isoformat() if conversa.created_at else None,
        "updated_at": conversa.updated_at.isoformat() if conversa.updated_at else None,
        "historico_mensagens": messages_json
    }

    from storage import storage_provider
    import json
    
    json_bytes = json.dumps(conversa_data, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"{conversa.id}.json"
    
    try:
        backup_url = await storage_provider.upload_json(json_bytes, filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao subir arquivo JSON para o Storage/R2: {str(e)}"
        )

    # Deletar mensagens do banco de dados relacional
    from sqlalchemy import delete
    stmt_del = delete(Mensagem).where(Mensagem.conversa_id == id)
    await db.execute(stmt_del)

    # Registrar URL de backup na conversa
    conversa.backup_url = backup_url
    await db.commit()

    return {
        "status": "success",
        "message": "Conversa arquivada com sucesso e mensagens migradas para o Storage.",
        "backup_url": backup_url
    }


@router.post("/chat/conversas/{id}/mensagens", response_model=MensagemB2BResponse, status_code=status.HTTP_201_CREATED)
async def enviar_mensagem_b2b(
    id: str,
    data: MensagemB2BCreateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Envia uma mensagem na conversa B2B.
    """
    # Validar conversa e se pertence ao usuário
    stmt_conv = select(Conversa).where(
        Conversa.id == id,
        Conversa.tipo == TipoConversa.B2B,
        or_(
            Conversa.loja_a_id == context.loja_id,
            Conversa.loja_b_id == context.loja_id
        )
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()

    if not conversa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada."
        )

    nova_msg = Mensagem(
        conversa_id=id,
        autor_id=context.usuario.id,
        conteudo=data.conteudo,
        lida=False,
        created_at=utcnow()
    )
    db.add(nova_msg)

    # Atualizar timestamp da conversa para reposicioná-la no topo
    conversa.updated_at = utcnow()

    await db.commit()
    await db.refresh(nova_msg)

    # Criar Notificação para a loja parceira
    try:
        from models import Notificacao
        from uuid import uuid4
        dest_loja_id = conversa.loja_b_id if conversa.loja_a_id == context.loja_id else conversa.loja_a_id
        stmt_loja = select(Loja).where(Loja.id == context.loja_id)
        res_loja = await db.execute(stmt_loja)
        loja_obj = res_loja.scalar_one_or_none()
        loja_nome = loja_obj.nome if loja_obj else "Parceiro"

        notif = Notificacao(
            id=str(uuid4()),
            loja_id=dest_loja_id,
            titulo=f"Mensagem de {loja_nome}",
            conteudo=f"{context.usuario.nome}: {nova_msg.conteudo[:60]}",
            tipo="chat_b2b",
            link=f"chat:{conversa.id}",
        )
        db.add(notif)
        await db.flush()
    except Exception as e:
        print(f"[ERRO Notificacao] Falha ao criar notificacao: {e}")

    # Enviar via WebSocket em tempo real
    msg_dict = {
        "id": nova_msg.id,
        "conversa_id": nova_msg.conversa_id,
        "autor_id": nova_msg.autor_id,
        "autor_nome": context.usuario.nome,
        "conteudo": nova_msg.conteudo,
        "lida": nova_msg.lida,
        "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
    }
    await manager.broadcast_to_conversation(conversa.id, msg_dict, db)

    # Construir resposta antes de commitar para não expirar nova_msg
    response = MensagemB2BResponse(
        id=nova_msg.id,
        conversa_id=nova_msg.conversa_id,
        autor_id=nova_msg.autor_id,
        autor_nome=context.usuario.nome,
        conteudo=nova_msg.conteudo,
        lida=nova_msg.lida,
        created_at=nova_msg.created_at
    )
    
    await db.commit()
    return response


@router.websocket("/chat/ws")
async def chat_websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    usuario_id = payload.get("sub")
    if not usuario_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(usuario_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            conversa_id = data.get("conversa_id")
            conteudo = data.get("conteudo")

            if conversa_id and conteudo:
                async with async_session() as db:
                    # Validar conversa e se o usuário é participante
                    stmt_conv = select(Conversa).where(
                        Conversa.id == conversa_id,
                        or_(
                            Conversa.cliente_id == usuario_id,
                            Conversa.loja_a_id.in_(
                                select(MembroLoja.loja_id).where(MembroLoja.usuario_id == usuario_id)
                            ),
                            Conversa.loja_b_id.in_(
                                select(MembroLoja.loja_id).where(MembroLoja.usuario_id == usuario_id)
                            ),
                            Conversa.loja_id.in_(
                                select(MembroLoja.loja_id).where(MembroLoja.usuario_id == usuario_id)
                            )
                        )
                    )
                    res_conv = await db.execute(stmt_conv)
                    conversa = res_conv.scalar_one_or_none()

                    if conversa:
                        stmt_user = select(Usuario).where(Usuario.id == usuario_id)
                        res_user = await db.execute(stmt_user)
                        user = res_user.scalar_one_or_none()

                        nova_msg = Mensagem(
                            conversa_id=conversa_id,
                            autor_id=usuario_id,
                            conteudo=conteudo,
                            lida=False,
                            created_at=utcnow()
                        )
                        db.add(nova_msg)
                        conversa.updated_at = utcnow()
                        await db.flush()

                        # Criar Notificação correspondente
                        try:
                            from models import Notificacao, MembroLoja
                            from uuid import uuid4
                            
                            if conversa.tipo == "b2b":
                                # Obter loja do remetente
                                stmt_membro = select(MembroLoja).where(MembroLoja.usuario_id == usuario_id, MembroLoja.ativo == True)
                                res_membro = await db.execute(stmt_membro)
                                membro = res_membro.scalar_one_or_none()
                                if membro:
                                    sender_loja_id = membro.loja_id
                                    dest_loja_id = conversa.loja_b_id if conversa.loja_a_id == sender_loja_id else conversa.loja_a_id
                                    
                                    stmt_loja = select(Loja).where(Loja.id == sender_loja_id)
                                    res_loja = await db.execute(stmt_loja)
                                    loja = res_loja.scalar_one_or_none()
                                    loja_nome = loja.nome if loja else "Parceiro"

                                    notif = Notificacao(
                                        id=str(uuid4()),
                                        loja_id=dest_loja_id,
                                        titulo=f"Mensagem de {loja_nome}",
                                        conteudo=f"{user.nome if user else 'Lojista'}: {conteudo[:60]}",
                                        tipo="chat_b2b",
                                        link=f"chat:{conversa_id}",
                                    )
                                    db.add(notif)
                                    await db.flush()
                            elif conversa.tipo == "b2c":
                                # Se o remetente for o cliente, notifica a loja
                                if conversa.cliente_id == usuario_id:
                                    notif = Notificacao(
                                        id=str(uuid4()),
                                        loja_id=conversa.loja_id,
                                        titulo="Nova Mensagem de Cliente",
                                        conteudo=f"{user.nome if user else 'Cliente'}: {conteudo[:60]}",
                                        tipo="chat_b2c",
                                        link=f"chat:{conversa_id}",
                                    )
                                    db.add(notif)
                                    await db.flush()
                        except Exception as e:
                            print(f"[ERRO Notificacao WS] {e}")

                        msg_dict = {
                            "id": nova_msg.id,
                            "conversa_id": nova_msg.conversa_id,
                            "autor_id": nova_msg.autor_id,
                            "autor_nome": user.nome if user else "Usuário",
                            "conteudo": nova_msg.conteudo,
                            "lida": nova_msg.lida,
                            "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
                        }
                        await manager.broadcast_to_conversation(conversa_id, msg_dict, db)
                        await db.commit()

    except WebSocketDisconnect:
        manager.disconnect(usuario_id, websocket)
    except Exception:
        manager.disconnect(usuario_id, websocket)

