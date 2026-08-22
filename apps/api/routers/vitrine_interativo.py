"""
Social Veículos — Rotas Interativas da Vitrine B2C (Favoritos & Chat)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from deps import get_current_user
from limiter import rate_limit
from models import (
    utcnow,
    Usuario, Veiculo, Favorito, Conversa, Mensagem, Loja,
    ClientePF, Lead, EtapaLead, OrigemLead, TipoConversa, StatusVeiculo
)
from schemas import (
    FavoritoResponse, FavoritoRequest, VeiculoB2CResponse,
    ConversaB2CResponse, MensagemB2CResponse, ConversaB2CCreateRequest,
    MensagemB2CCreateRequest,
    MeuVeiculoResponse, VeiculoDocumentoResponse,
)
from auth import decode_access_token
from conversas_service import reabrir_conversa
from routers.b2b import manager

router = APIRouter(prefix="/v1/vitrine", tags=["Vitrine Interativa B2C"])

# Conversa arquivada é somente-leitura: o veículo que a originou saiu do estoque.
# Quem quer falar de outro carro abre o anúncio dele e inicia uma conversa nova —
# é isso que mantém "um chat = um veículo" e a gestão do vendedor por carro.
_ERRO_ARQUIVADA = (
    "Esta conversa foi arquivada porque o veículo não está mais disponível. "
    "Para falar sobre outro veículo, inicie um novo contato pelo anúncio dele."
)


def _conversa_editavel(conversa: Conversa) -> None:
    if conversa.arquivada_em is not None or conversa.ativa is False:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_ERRO_ARQUIVADA)


# ═══════════════════════════════════════════════════════════════
# ── FAVORITOS
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/favoritos",
    response_model=FavoritoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(20, 60))],
)
async def favoritar_veiculo(
    data: FavoritoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Adiciona um veículo aos favoritos do usuário logado.
    """
    # Validar se o veículo existe
    v_stmt = select(Veiculo).where(Veiculo.id == data.veiculo_id, Veiculo.publicado_marketplace == True)
    v_res = await db.execute(v_stmt)
    if not v_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado ou não publicado.")

    # Verificar se já é favoritado
    check_stmt = select(Favorito).where(Favorito.veiculo_id == data.veiculo_id, Favorito.usuario_id == current_user.id)
    check_res = await db.execute(check_stmt)
    if check_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Veículo já favoritado.")

    favorito = Favorito(usuario_id=current_user.id, veiculo_id=data.veiculo_id)
    db.add(favorito)
    await db.commit()
    await db.refresh(favorito)
    return favorito


@router.delete("/favoritos/{veiculo_id}", status_code=status.HTTP_200_OK)
async def desfavoritar_veiculo(
    veiculo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Remove um veículo dos favoritos do usuário logado.
    """
    stmt = select(Favorito).where(Favorito.veiculo_id == veiculo_id, Favorito.usuario_id == current_user.id)
    res = await db.execute(stmt)
    favorito = res.scalar_one_or_none()
    if not favorito:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorito não encontrado.")

    await db.delete(favorito)
    await db.commit()
    return {"message": "Veículo removido dos favoritos com sucesso."}


@router.get("/favoritos", response_model=List[VeiculoB2CResponse])
async def listar_favoritos(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna a lista de veículos favoritados pelo usuário atual.
    """
    stmt = (
        select(Veiculo)
        .join(Favorito, Favorito.veiculo_id == Veiculo.id)
        .options(selectinload(Veiculo.midias), selectinload(Veiculo.loja))
        .where(Favorito.usuario_id == current_user.id)
        .order_by(Favorito.created_at.desc())
    )
    res = await db.execute(stmt)
    vehicles = res.scalars().all()

    for v in vehicles:
        # Calcular total favoritos
        count_stmt = select(func.count(Favorito.id)).where(Favorito.veiculo_id == v.id)
        count_res = await db.execute(count_stmt)
        v.total_favoritos = count_res.scalar() or 0
        v.favoritado_por_mim = True

        # Dados da loja que anuncia (mesma hidratação do feed)
        loja = v.loja
        v.loja_slug = loja.slug if loja else None
        v.loja_nome = loja.nome if loja else None
        v.loja_logo = loja.logo_url if loja else None
        v.loja_cidade = loja.cidade if loja else None
        v.loja_estado = loja.estado if loja else None
        v.loja_whatsapp = loja.whatsapp if loja else None
        v.loja_verificada = bool(loja.verificada) if loja else False

    return vehicles


# ═══════════════════════════════════════════════════════════════
# ── CHAT B2C (Conversas & Mensagens)
# ═══════════════════════════════════════════════════════════════

@router.get("/conversas", response_model=List[ConversaB2CResponse])
async def listar_conversas_cliente(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todas as conversas B2C do cliente atual.
    """
    stmt = (
        select(Conversa)
        .where(
            Conversa.cliente_id == current_user.id,
            Conversa.tipo == TipoConversa.B2C,
            Conversa.deletada_em == None,
            Conversa.excluido == False,
        )
        .order_by(Conversa.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    if not conversas:
        return []

    conversa_ids = [c.id for c in conversas]
    loja_ids = {c.loja_id for c in conversas}
    veiculo_ids = {c.veiculo_id for c in conversas if c.veiculo_id}

    lojas_res = await db.execute(select(Loja.id, Loja.nome, Loja.slug).where(Loja.id.in_(loja_ids)))
    dados_loja = {lid: (nome, slug) for lid, nome, slug in lojas_res.all()}

    veiculos_por_id: dict[str, Veiculo] = {}
    if veiculo_ids:
        veiculos_res = await db.execute(select(Veiculo).options(selectinload(Veiculo.midias)).where(Veiculo.id.in_(veiculo_ids)))
        veiculos_por_id = {v.id: v for v in veiculos_res.scalars().all()}

    unread_res = await db.execute(
        select(Mensagem.conversa_id, func.count(Mensagem.id))
        .where(
            Mensagem.conversa_id.in_(conversa_ids),
            Mensagem.autor_id != current_user.id,
            Mensagem.lida == False,
        )
        .group_by(Mensagem.conversa_id)
    )
    unread_por_conversa = {cid: count for cid, count in unread_res.all()}

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

    response_data = []
    for c in conversas:
        veiculo = veiculos_por_id.get(c.veiculo_id) if c.veiculo_id else None
        last_msg = ultima_msg_por_conversa.get(c.id)

        response_data.append(
            ConversaB2CResponse(
                id=c.id,
                tipo=c.tipo,
                loja_id=c.loja_id,
                loja_nome=dados_loja.get(c.loja_id, ("Loja Parceira", None))[0],
                loja_slug=dados_loja.get(c.loja_id, (None, None))[1],
                cliente_id=c.cliente_id,
                cliente_nome=current_user.nome,
                veiculo_id=c.veiculo_id,
                veiculo_modelo=veiculo.modelo if veiculo else None,
                veiculo_marca=veiculo.marca if veiculo else None,
                veiculo_foto=veiculo.midias[0].url if veiculo and getattr(veiculo, "midias", None) and len(veiculo.midias) > 0 else None,
                veiculo_status=veiculo.status.value if veiculo and veiculo.status else None,
                ativa=c.ativa,
                arquivada_em=c.arquivada_em,
                motivo_arquivo=c.motivo_arquivo,
                created_at=c.created_at,
                updated_at=c.updated_at,
                ultima_mensagem=last_msg[0] if last_msg else None,
                ultima_mensagem_data=last_msg[1] if last_msg else None,
                mensagens_nao_lidas=unread_por_conversa.get(c.id, 0)
            )
        )

    return response_data


@router.get("/chat/conversas", response_model=List[ConversaB2CResponse])
async def listar_conversas_b2c_loja(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista conversas B2C recebidas pela loja do usuário gestor."""
    from deps import get_current_b2b_user, B2BContext
    ctx: B2BContext = await get_current_b2b_user(current_user=current_user, db=db)
    if not ctx.loja_id:
        return []

    stmt = (
        select(Conversa)
        .where(
            Conversa.loja_id == ctx.loja_id,
            Conversa.tipo == TipoConversa.B2C,
            Conversa.deletada_em == None,
            Conversa.excluido == False,
        )
        .order_by(Conversa.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    if not conversas:
        return []

    conversa_ids = [c.id for c in conversas]
    cliente_ids = {c.cliente_id for c in conversas}
    veiculo_ids = {c.veiculo_id for c in conversas if c.veiculo_id}
    cliente_da_conversa = {c.id: c.cliente_id for c in conversas}

    clientes_res = await db.execute(select(Usuario.id, Usuario.nome).where(Usuario.id.in_(cliente_ids)))
    nomes_cliente = {uid: nome for uid, nome in clientes_res.all()}

    veiculos_por_id: dict[str, Veiculo] = {}
    if veiculo_ids:
        veiculos_res = await db.execute(select(Veiculo).options(selectinload(Veiculo.midias)).where(Veiculo.id.in_(veiculo_ids)))
        veiculos_por_id = {v.id: v for v in veiculos_res.scalars().all()}

    # Não-lidas = mensagens enviadas pelo cliente de cada conversa (perspectiva do lojista).
    unread_res = await db.execute(
        select(Mensagem.conversa_id, Mensagem.autor_id, func.count(Mensagem.id))
        .where(Mensagem.conversa_id.in_(conversa_ids), Mensagem.lida == False)
        .group_by(Mensagem.conversa_id, Mensagem.autor_id)
    )
    unread_por_conversa: dict[str, int] = {}
    for cid, autor_id, count in unread_res.all():
        if autor_id == cliente_da_conversa.get(cid):
            unread_por_conversa[cid] = unread_por_conversa.get(cid, 0) + count

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

    response_data = []
    for c in conversas:
        veiculo = veiculos_por_id.get(c.veiculo_id) if c.veiculo_id else None
        last_msg = ultima_msg_por_conversa.get(c.id)

        response_data.append(ConversaB2CResponse(
            id=c.id, tipo=c.tipo,
            loja_id=c.loja_id, loja_nome=ctx.loja.nome if ctx.loja else "",
            loja_slug=ctx.loja.slug if ctx.loja else None,
            cliente_id=c.cliente_id, cliente_nome=nomes_cliente.get(c.cliente_id, "Cliente"),
            veiculo_id=c.veiculo_id,
            veiculo_marca=veiculo.marca if veiculo else None,
            veiculo_modelo=veiculo.modelo if veiculo else None,
            veiculo_foto=veiculo.midias[0].url if veiculo and getattr(veiculo, "midias", None) and len(veiculo.midias) > 0 else None,
            veiculo_status=veiculo.status.value if veiculo and veiculo.status else None,
            ativa=c.ativa,
            arquivada_em=c.arquivada_em,
            motivo_arquivo=c.motivo_arquivo,
            created_at=c.created_at, updated_at=c.updated_at,
            ultima_mensagem=last_msg[0] if last_msg else None,
            ultima_mensagem_data=last_msg[1] if last_msg else None,
            mensagens_nao_lidas=unread_por_conversa.get(c.id, 0)
        ))
    return response_data


@router.get("/chat/conversas/{conversa_id}/mensagens", response_model=List[MensagemB2CResponse])
async def listar_mensagens_b2c_loja(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista mensagens de uma conversa B2C para o vendedor."""
    from deps import get_current_b2b_user, B2BContext
    ctx: B2BContext = await get_current_b2b_user(current_user=current_user, db=db)

    conv_res = await db.execute(
        select(Conversa).where(Conversa.id == conversa_id, Conversa.loja_id == ctx.loja_id)
    )
    conv = conv_res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    msgs_res = await db.execute(
        select(Mensagem).where(Mensagem.conversa_id == conversa_id).order_by(Mensagem.created_at)
    )
    mensagens = msgs_res.scalars().all()
    
    # Marcar mensagens recebidas do cliente como lidas
    mensagens_alteradas = False
    for m in mensagens:
        if m.autor_id == conv.cliente_id and not m.lida:
            m.lida = True
            mensagens_alteradas = True
            
    if mensagens_alteradas:
        await db.commit()

    return [
        MensagemB2CResponse(
            id=m.id, conversa_id=m.conversa_id,
            autor_id=m.autor_id, conteudo=m.conteudo,
            autor_nome="Sistema" if m.sistema else None,
            autor_tipo="sistema" if m.sistema else ("cliente" if m.autor_id == conv.cliente_id else "loja"),
            lida=m.lida, sistema=bool(m.sistema), created_at=m.created_at,
        )
        for m in mensagens
    ]


@router.post(
    "/chat/conversas/{conversa_id}/mensagens",
    response_model=MensagemB2CResponse,
    dependencies=[Depends(rate_limit(15, 60))],
)
async def enviar_mensagem_b2c_loja(
    conversa_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Envia uma mensagem na conversa B2C como lojista."""
    from deps import get_current_b2b_user, B2BContext
    ctx: B2BContext = await get_current_b2b_user(current_user=current_user, db=db)
    
    # Validar conversa
    conv_res = await db.execute(
        select(Conversa).where(Conversa.id == conversa_id, Conversa.loja_id == ctx.loja_id)
    )
    conversa = conv_res.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa não encontrada ou sem acesso.")

    _conversa_editavel(conversa)

    conteudo = payload.get("conteudo")
    if not conteudo:
        raise HTTPException(status_code=400, detail="Conteúdo da mensagem é obrigatório.")

    # Criar mensagem
    nova_msg = Mensagem(
        conversa_id=conversa_id,
        autor_id=current_user.id,
        conteudo=conteudo
    )
    db.add(nova_msg)
    conversa.updated_at = utcnow()
    
    # Commit e refresh
    await db.commit()
    await db.refresh(nova_msg)

    # Broadcast via websocket
    msg_dict = {
        "id": nova_msg.id,
        "conversa_id": conversa_id,
        "autor_id": current_user.id,
        "autor_nome": current_user.nome,
        "conteudo": nova_msg.conteudo,
        "lida": False,
        "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
    }
    await manager.broadcast_to_conversation(conversa_id, msg_dict, db)

    return MensagemB2CResponse(
        id=nova_msg.id,
        conversa_id=nova_msg.conversa_id,
        autor_id=nova_msg.autor_id,
        autor_nome=current_user.nome,
        autor_tipo="loja",
        conteudo=nova_msg.conteudo,
        lida=nova_msg.lida,
        created_at=nova_msg.created_at
    )



@router.post(
    "/conversas",
    response_model=ConversaB2CResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(15, 60))],
)
async def iniciar_conversa_b2c(
    data: ConversaB2CCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Inicia uma conversa B2C associada a um veículo, enviando a mensagem inicial.
    Cria automaticamente ClientePF e Lead no CRM da loja se for o primeiro contato.
    """
    # 1. Validar veículo (permite conversa sobre carro publicado e ativo)
    v_stmt = select(Veiculo).where(
        Veiculo.id == data.veiculo_id,
        Veiculo.publicado_marketplace == True,
        Veiculo.status.in_([StatusVeiculo.DISPONIVEL, StatusVeiculo.REPASSE])
    )
    v_res = await db.execute(v_stmt)
    veiculo = v_res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado ou não disponível para contato.")


    # loja_id sempre derivado do veículo — nunca confiar no valor enviado pelo cliente
    loja_id = veiculo.loja_id

    # 2. Verificar se já existe conversa ativa para este cliente + veículo
    check_stmt = select(Conversa).where(
        Conversa.cliente_id == current_user.id,
        Conversa.veiculo_id == data.veiculo_id,
        Conversa.tipo == TipoConversa.B2C
    )
    check_res = await db.execute(check_stmt)
    conversa = check_res.scalar_one_or_none()

    nova_conversa_criada = False
    if not conversa:
        conversa = Conversa(
            tipo=TipoConversa.B2C,
            loja_id=loja_id,
            cliente_id=current_user.id,
            veiculo_id=data.veiculo_id
        )
        db.add(conversa)
        await db.flush() # Gerar ID da conversa
        nova_conversa_criada = True
    elif conversa.arquivada_em is not None or not conversa.ativa:
        # O veículo voltou a ficar disponível (reserva desfeita, venda cancelada):
        # a mesma conversa volta à vida em vez de nascer uma duplicata do par
        # cliente+veículo. A saudação NÃO é reenviada (ver B104).
        reabrir_conversa(conversa)

    # 3. Adicionar mensagem inicial — SÓ quando a conversa acabou de nascer.
    # Reabrir o chat de um veículo já negociado ("Conversar" de novo) não pode
    # reenviar a saudação: o cliente vê a mesma frase repetida e a loja recebe
    # uma notificação vazia de conteúdo novo.
    msg_texto = (data.mensagem and data.mensagem.strip()) or f"Olá, tenho interesse no veículo {veiculo.marca} {veiculo.modelo}."
    nova_msg: Optional[Mensagem] = None
    if nova_conversa_criada:
        nova_msg = Mensagem(
            conversa_id=conversa.id,
            autor_id=current_user.id,
            conteudo=msg_texto
        )
        db.add(nova_msg)
        conversa.updated_at = utcnow()
        await db.flush()

    # 4. Criar Lead e ClientePF automaticamente se for nova conversa
    if nova_conversa_criada:
        # Verificar se já existe ClientePF associado a este e-mail/CPF na loja
        cli_stmt = select(ClientePF).where(
            ClientePF.loja_id == loja_id,
            ClientePF.email == current_user.email
        )
        cli_res = await db.execute(cli_stmt)
        cliente = cli_res.scalar_one_or_none()

        if not cliente:
            cliente = ClientePF(
                loja_id=loja_id,
                nome=current_user.nome,
                email=current_user.email,
                telefone=getattr(current_user, 'telefone', None) or ""
            )
            db.add(cliente)
            await db.flush()

        # Criar Lead
        lead = Lead(
            loja_id=loja_id,
            cliente_id=cliente.id,
            veiculo_id=data.veiculo_id,
            origem=OrigemLead.VITRINE,
            etapa=EtapaLead.LEAD,
            valor_proposta=veiculo.preco_venda or 0.0,
            observacoes=f"Lead gerado via Chat Vitrine B2C. Mensagem inicial: {msg_texto}"
        )
        db.add(lead)
        await db.flush()

    # Buscar informações da loja
    loja_stmt = select(Loja).where(Loja.id == conversa.loja_id)
    loja_res = await db.execute(loja_stmt)
    loja = loja_res.scalar_one_or_none()

    # Só há o que transmitir/notificar quando a saudação foi realmente criada.
    if nova_msg is not None:
        # Transmitir via websocket para usuários da loja associada, se conectados
        msg_dict = {
            "id": nova_msg.id,
            "conversa_id": conversa.id,
            "autor_id": current_user.id,
            "autor_nome": current_user.nome,
            "conteudo": nova_msg.conteudo,
            "lida": False,
            "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
        }
        # Criar Notificação para a loja (gestores/vendedores)
        try:
            from models import Notificacao
            from uuid import uuid4
            notif = Notificacao(
                id=str(uuid4()),
                loja_id=conversa.loja_id,
                titulo="Nova Mensagem de Cliente",
                conteudo=f"{current_user.nome}: {nova_msg.conteudo[:60]}",
                tipo="chat_b2c",
                link=f"chat:{conversa.id}",
            )
            db.add(notif)
            await db.flush()
            # Push remoto para os membros da loja (não notifica o próprio cliente)
            from push import enviar_push_loja
            await enviar_push_loja(
                db, conversa.loja_id,
                titulo="Nova mensagem de cliente",
                corpo=f"{current_user.nome}: {nova_msg.conteudo[:60]}",
                link=f"chat:{conversa.id}", tipo="chat_b2c",
            )
        except Exception as e:
            print(f"[ERRO Notificacao B2C REST] {e}")

        # Broadcast para todos os membros da loja e o próprio cliente
        await manager.broadcast_to_conversation(conversa.id, msg_dict, db)

    # Ao reabrir uma conversa existente não há saudação nova: o preview tem de
    # mostrar a última mensagem real, senão a lista "volta no tempo".
    ultima_msg = nova_msg
    if ultima_msg is None:
        ult_stmt = (
            select(Mensagem)
            .where(Mensagem.conversa_id == conversa.id)
            .order_by(Mensagem.created_at.desc())
            .limit(1)
        )
        ult_res = await db.execute(ult_stmt)
        ultima_msg = ult_res.scalar_one_or_none()

    # Construir a resposta ANTES de commitar para evitar expiração dos objetos (MissingGreenlet)
    response = ConversaB2CResponse(
        id=conversa.id,
        tipo=conversa.tipo,
        loja_id=conversa.loja_id,
        loja_nome=loja.nome if loja else "Loja Parceira",
        loja_slug=loja.slug if loja else None,
        cliente_id=conversa.cliente_id,
        cliente_nome=current_user.nome,
        veiculo_id=conversa.veiculo_id,
        veiculo_modelo=veiculo.modelo,
        veiculo_marca=veiculo.marca,
        veiculo_status=veiculo.status.value if veiculo.status else None,
        ativa=conversa.ativa,
        arquivada_em=conversa.arquivada_em,
        motivo_arquivo=conversa.motivo_arquivo,
        created_at=conversa.created_at,
        updated_at=conversa.updated_at,
        ultima_mensagem=ultima_msg.conteudo if ultima_msg else None,
        ultima_mensagem_data=ultima_msg.created_at if ultima_msg else None
    )

    await db.commit()
    return response


@router.get("/conversas/{id}/mensagens", response_model=List[MensagemB2CResponse])
async def listar_mensagens_conversa(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna o histórico de mensagens de uma conversa B2C específica.
    """
    c_stmt = select(Conversa).where(Conversa.id == id, Conversa.cliente_id == current_user.id)
    c_res = await db.execute(c_stmt)
    conversa = c_res.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada.")

    m_stmt = (
        select(Mensagem)
        .where(Mensagem.conversa_id == id)
        .order_by(Mensagem.created_at.asc())
    )
    m_res = await db.execute(m_stmt)
    mensagens = m_res.scalars().all()

    # Marcar mensagens recebidas da loja como lidas para o cliente
    mensagens_alteradas = False
    for m in mensagens:
        if m.autor_id != current_user.id and not m.lida:
            m.lida = True
            mensagens_alteradas = True

    if mensagens_alteradas:
        await db.commit()

    response_data = []
    for m in mensagens:
        # Determinar nome do autor
        autor_nome = "Você"
        if m.sistema:
            autor_nome = "Sistema"
        elif m.autor_id != current_user.id:
            autor_stmt = select(Usuario).where(Usuario.id == m.autor_id)
            autor_res = await db.execute(autor_stmt)
            autor = autor_res.scalar_one_or_none()
            autor_nome = autor.nome if autor else "Loja"

        response_data.append(
            MensagemB2CResponse(
                id=m.id,
                conversa_id=m.conversa_id,
                autor_id=m.autor_id,
                autor_nome=autor_nome,
                autor_tipo="sistema" if m.sistema else ("cliente" if m.autor_id == current_user.id else "loja"),
                conteudo=m.conteudo,
                lida=m.lida,
                sistema=bool(m.sistema),
                created_at=m.created_at
            )
        )

    return response_data


@router.post(
    "/conversas/{id}/mensagens",
    response_model=MensagemB2CResponse,
    dependencies=[Depends(rate_limit(15, 60))],
)
async def enviar_mensagem_conversa(
    id: str,
    data: MensagemB2CCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Envia uma nova mensagem em uma conversa B2C existente.
    """
    c_stmt = select(Conversa).where(Conversa.id == id, Conversa.cliente_id == current_user.id)
    c_res = await db.execute(c_stmt)
    conversa = c_res.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada.")

    _conversa_editavel(conversa)

    nova_msg = Mensagem(
        conversa_id=id,
        autor_id=current_user.id,
        conteudo=data.conteudo
    )
    db.add(nova_msg)
    conversa.updated_at = utcnow()
    await db.commit()
    await db.refresh(nova_msg)

    # Transmitir via websocket
    msg_dict = {
        "id": nova_msg.id,
        "conversa_id": conversa.id,
        "autor_id": current_user.id,
        "autor_nome": current_user.nome,
        "conteudo": nova_msg.conteudo,
        "lida": False,
        "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
    }
    await manager.broadcast_to_conversation(conversa.id, msg_dict, db)

    return MensagemB2CResponse(
        id=nova_msg.id,
        conversa_id=nova_msg.conversa_id,
        autor_id=nova_msg.autor_id,
        autor_nome=current_user.nome,
        autor_tipo="cliente",
        conteudo=nova_msg.conteudo,
        lida=nova_msg.lida,
        created_at=nova_msg.created_at
    )


# ═══════════════════════════════════════════════════════════════
# ── WEBSOCKET B2C
# ═══════════════════════════════════════════════════════════════

@router.websocket("/chat/ws")
async def chat_websocket_b2c_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """
    Endpoint WebSocket para clientes na Vitrine B2C receberem/enviarem mensagens em tempo real.
    """
    # Cookie httpOnly (M6) é a fonte preferida quando o WS trafega pelo mesmo
    # host do front (proxy). Quando o front conecta direto no host da API
    # (cross-origin de verdade — VITE_WS_URL), o cookie não vai no handshake,
    # daí o `?token=` com um token curto de /auth/ws-token (`typ=ws`).
    # Mobile também usa `?token=`, mas com o access_token normal (sem cookie
    # jar de browser, não tem o problema de vazamento em log/Referer do M1).
    token = token or websocket.cookies.get("sv_access")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload or payload.get("typ") not in ("access", "ws"):
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
                # Criar sessão de db manual para operações assíncronas no loop do WS
                async with async_session() as db:
                    # Validar se a conversa pertence a este cliente
                    c_stmt = select(Conversa).where(Conversa.id == conversa_id, Conversa.cliente_id == usuario_id)
                    c_res = await db.execute(c_stmt)
                    conversa = c_res.scalar_one_or_none()

                    # Conversa arquivada (veículo saiu) é somente-leitura também no
                    # socket — sem isso o REST bloqueia e o WS continua aceitando.
                    if conversa and (conversa.arquivada_em is not None or conversa.ativa is False):
                        await websocket.send_json({"erro": _ERRO_ARQUIVADA, "conversa_id": conversa_id})
                    elif conversa:
                        # Adicionar mensagem
                        nova_msg = Mensagem(
                            conversa_id=conversa_id,
                            autor_id=usuario_id,
                            conteudo=conteudo
                        )
                        db.add(nova_msg)
                        conversa.updated_at = utcnow()
                        await db.commit()
                        await db.refresh(nova_msg)

                        # Broadcast
                        msg_dict = {
                            "id": nova_msg.id,
                            "conversa_id": conversa_id,
                            "autor_id": usuario_id,
                            "autor_nome": payload.get("nome", "Você"),
                            "conteudo": conteudo,
                            "lida": False,
                            "created_at": nova_msg.created_at.isoformat() if nova_msg.created_at else None
                        }
                        await manager.broadcast_to_conversation(conversa_id, msg_dict, db)

    except WebSocketDisconnect:
        manager.disconnect(usuario_id, websocket)
    except Exception:
        manager.disconnect(usuario_id, websocket)


# ── CARTEIRA DO PROPRIETÁRIO — VITRINE (M018)
# ═══════════════════════════════════════════════════════════════

@router.get("/meus-veiculos", response_model=list[MeuVeiculoResponse])
async def meus_veiculos(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista veículos comprados pelo usuário logado na vitrine, com documentos visíveis."""
    # Localiza o ClientePF vinculado ao usuário logado
    stmt_cli = select(ClientePF).where(ClientePF.usuario_id == current_user.id)
    res_cli = await db.execute(stmt_cli)
    clientes = res_cli.scalars().all()
    if not clientes:
        return []

    cliente_ids = [c.id for c in clientes]

    stmt = (
        select(Veiculo)
        .where(Veiculo.comprador_id.in_(cliente_ids))
        .options(
            selectinload(Veiculo.documentos),
            selectinload(Veiculo.loja),
            selectinload(Veiculo.midias),
        )
    )
    result = await db.execute(stmt)
    veiculos = result.scalars().all()

    from fipe_api import consultar_preco
    import asyncio

    async def _fipe(v) -> float | None:
        if v.fipe_marca_codigo and v.fipe_modelo_codigo and v.fipe_ano_codigo:
            try:
                return await consultar_preco(v.fipe_marca_codigo, v.fipe_modelo_codigo, v.fipe_ano_codigo, v.tipo or "carro")
            except Exception:
                pass
        return None

    fipe_values = await asyncio.gather(*[_fipe(v) for v in veiculos])

    out = []
    for v, fipe_val in zip(veiculos, fipe_values):
        foto = next((m.url for m in v.midias if m.url), None)
        docs = [
            VeiculoDocumentoResponse(
                id=d.id, tipo=d.tipo.value, nome=d.nome, url=d.url,
                visivel_comprador=d.visivel_comprador, created_at=d.created_at,
            )
            for d in v.documentos if d.visivel_comprador
        ]
        out.append(MeuVeiculoResponse(
            veiculo_id=v.id,
            marca=v.marca,
            modelo=v.modelo,
            ano_fabricacao=v.ano_fabricacao,
            ano_modelo=v.ano_modelo,
            placa=v.placa,
            cor=v.cor,
            km=v.km,
            foto_url=foto,
            loja_nome=v.loja.nome_fantasia if v.loja else "",
            documentos=docs,
            valor_fipe_atual=fipe_val,
        ))
    return out


@router.post("/chat/conversas/{conversa_id}/arquivar")
async def arquivar_conversa_b2c(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Arquiva manualmente uma conversa."""
    from models import utcnow
    stmt = select(Conversa).where(Conversa.id == conversa_id)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    conv.arquivada_em = utcnow()
    conv.motivo_arquivo = "manual"
    conv.ativa = False
    await db.commit()
    return {"sucesso": True, "id": conversa_id, "status": "arquivada"}


@router.post("/chat/conversas/{conversa_id}/excluir")
async def excluir_conversa_b2c(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Aplica exclusão lógica (soft delete) em uma conversa."""
    from models import utcnow
    stmt = select(Conversa).where(Conversa.id == conversa_id)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    conv.deletada_em = utcnow()
    conv.excluido = True
    conv.ativa = False
    await db.commit()
    return {"sucesso": True, "id": conversa_id, "status": "excluida"}

