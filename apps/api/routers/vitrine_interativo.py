"""
Social Veículos — Rotas Interativas da Vitrine B2C (Favoritos & Chat)
"""

import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_user, get_optional_user
from models import (
    Usuario, Veiculo, Favorito, Conversa, Mensagem, Loja,
    ClientePF, Lead, EtapaLead, OrigemLead, TipoConversa, StatusVeiculo, VeiculoDocumento
)
from schemas import (
    FavoritoResponse, FavoritoRequest, VeiculoB2CResponse,
    ConversaB2CResponse, MensagemB2CResponse, ConversaB2CCreateRequest,
    MeuVeiculoResponse, VeiculoDocumentoResponse,
)
from auth import decode_access_token
from routers.b2b import manager

router = APIRouter(prefix="/v1/vitrine", tags=["Vitrine Interativa B2C"])


# ═══════════════════════════════════════════════════════════════
# ── FAVORITOS
# ═══════════════════════════════════════════════════════════════

@router.post("/favoritos", response_model=FavoritoResponse, status_code=status.HTTP_201_CREATED)
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
        .options(selectinload(Veiculo.midias))
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
        .options(selectinload(Conversa.mensagens))
        .where(Conversa.cliente_id == current_user.id, Conversa.tipo == TipoConversa.B2C)
        .order_by(Conversa.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    response_data = []
    for c in conversas:
        # Buscar nome da loja
        loja_stmt = select(Loja).where(Loja.id == c.loja_id)
        loja_res = await db.execute(loja_stmt)
        loja = loja_res.scalar_one_or_none()

        # Buscar veículo se houver
        veiculo = None
        if c.veiculo_id:
            v_stmt = select(Veiculo).where(Veiculo.id == c.veiculo_id)
            v_res = await db.execute(v_stmt)
            veiculo = v_res.scalar_one_or_none()

        ultima_msg = c.mensagens[-1] if c.mensagens else None

        response_data.append(
            ConversaB2CResponse(
                id=c.id,
                tipo=c.tipo,
                loja_id=c.loja_id,
                loja_nome=loja.nome if loja else "Loja Parceira",
                cliente_id=c.cliente_id,
                cliente_nome=current_user.nome,
                veiculo_id=c.veiculo_id,
                veiculo_modelo=veiculo.modelo if veiculo else None,
                veiculo_marca=veiculo.marca if veiculo else None,
                ativa=c.ativa,
                created_at=c.created_at,
                updated_at=c.updated_at,
                ultima_mensagem=ultima_msg.conteudo if ultima_msg else None,
                ultima_mensagem_data=ultima_msg.created_at if ultima_msg else None
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
        .options(selectinload(Conversa.mensagens))
        .where(Conversa.loja_id == ctx.loja_id, Conversa.tipo == TipoConversa.B2C)
        .order_by(Conversa.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    response_data = []
    for c in conversas:
        cliente_res = await db.execute(select(Usuario).where(Usuario.id == c.cliente_id))
        cliente = cliente_res.scalar_one_or_none()
        veiculo = None
        if c.veiculo_id:
            v_res = await db.execute(select(Veiculo).where(Veiculo.id == c.veiculo_id))
            veiculo = v_res.scalar_one_or_none()
        ultima_msg = c.mensagens[-1] if c.mensagens else None
        response_data.append(ConversaB2CResponse(
            id=c.id, tipo=c.tipo,
            loja_id=c.loja_id, loja_nome=ctx.loja.nome if ctx.loja else "",
            cliente_id=c.cliente_id, cliente_nome=cliente.nome if cliente else "Cliente",
            veiculo_id=c.veiculo_id,
            veiculo_marca=veiculo.marca if veiculo else None,
            veiculo_modelo=veiculo.modelo if veiculo else None,
            ativa=c.ativa, created_at=c.created_at, updated_at=c.updated_at,
            ultima_mensagem=ultima_msg.conteudo if ultima_msg else None,
            ultima_mensagem_data=ultima_msg.created_at if ultima_msg else None,
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
    return [
        MensagemB2CResponse(
            id=m.id, conversa_id=m.conversa_id,
            autor_id=m.autor_id, conteudo=m.conteudo,
            lida=m.lida, created_at=m.created_at,
        )
        for m in msgs_res.scalars().all()
    ]


@router.post("/conversas", response_model=ConversaB2CResponse, status_code=status.HTTP_201_CREATED)
async def iniciar_conversa_b2c(
    data: ConversaB2CCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Inicia uma conversa B2C associada a um veículo, enviando a mensagem inicial.
    Cria automaticamente ClientePF e Lead no CRM da loja se for o primeiro contato.
    """
    # 1. Validar veículo
    v_stmt = select(Veiculo).where(Veiculo.id == data.veiculo_id)
    v_res = await db.execute(v_stmt)
    veiculo = v_res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado.")

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
            loja_id=data.loja_id,
            cliente_id=current_user.id,
            veiculo_id=data.veiculo_id
        )
        db.add(conversa)
        await db.flush() # Gerar ID da conversa
        nova_conversa_criada = True

    # 3. Adicionar mensagem inicial
    nova_msg = Mensagem(
        conversa_id=conversa.id,
        autor_id=current_user.id,
        conteudo=data.mensagem
    )
    db.add(nova_msg)
    conversa.updated_at = datetime.utcnow()
    await db.commit()

    # 4. Criar Lead e ClientePF automaticamente se for nova conversa
    if nova_conversa_criada:
        # Verificar se já existe ClientePF associado a este e-mail/CPF na loja
        cli_stmt = select(ClientePF).where(
            ClientePF.loja_id == data.loja_id,
            ClientePF.email == current_user.email
        )
        cli_res = await db.execute(cli_stmt)
        cliente = cli_res.scalar_one_or_none()

        if not cliente:
            cliente = ClientePF(
                loja_id=data.loja_id,
                nome=current_user.nome,
                email=current_user.email,
                telefone=getattr(current_user, 'telefone', None) or ""
            )
            db.add(cliente)
            await db.flush()

        # Criar Lead
        lead = Lead(
            loja_id=data.loja_id,
            cliente_id=cliente.id,
            veiculo_id=data.veiculo_id,
            origem=OrigemLead.VITRINE,
            etapa=EtapaLead.LEAD,
            valor_estimado=veiculo.preco_venda or 0.0,
            observacoes=f"Lead gerado via Chat Vitrine B2C. Mensagem inicial: {data.mensagem}"
        )
        db.add(lead)
        await db.commit()

    # Buscar informações da loja
    loja_stmt = select(Loja).where(Loja.id == conversa.loja_id)
    loja_res = await db.execute(loja_stmt)
    loja = loja_res.scalar_one_or_none()

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
            link="/rede-social",
        )
        db.add(notif)
        await db.commit()
    except Exception as e:
        print(f"[ERRO Notificacao B2C REST] {e}")

    # Broadcast para todos os membros da loja e o próprio cliente
    await manager.broadcast_to_conversation(conversa.id, msg_dict, db)

    return ConversaB2CResponse(
        id=conversa.id,
        tipo=conversa.tipo,
        loja_id=conversa.loja_id,
        loja_nome=loja.nome if loja else "Loja Parceira",
        cliente_id=conversa.cliente_id,
        cliente_nome=current_user.nome,
        veiculo_id=conversa.veiculo_id,
        veiculo_modelo=veiculo.modelo,
        veiculo_marca=veiculo.marca,
        ativa=conversa.ativa,
        created_at=conversa.created_at,
        updated_at=conversa.updated_at,
        ultima_mensagem=nova_msg.conteudo,
        ultima_mensagem_data=nova_msg.created_at
    )


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

    response_data = []
    for m in mensagens:
        # Determinar nome do autor
        autor_nome = "Você"
        if m.autor_id != current_user.id:
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
                conteudo=m.conteudo,
                lida=m.lida,
                created_at=m.created_at
            )
        )

    return response_data


@router.post("/conversas/{id}/mensagens", response_model=MensagemB2CResponse)
async def enviar_mensagem_conversa(
    id: str,
    data: ConversaB2CCreateRequest, # Podemos usar para mandar a mensagem (reaproveitando o campo mensagem)
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

    nova_msg = Mensagem(
        conversa_id=id,
        autor_id=current_user.id,
        conteudo=data.mensagem
    )
    db.add(nova_msg)
    conversa.updated_at = datetime.utcnow()
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
                # Criar sessão de db manual para operações assíncronas no loop do WS
                async with async_session() as db:
                    # Validar se a conversa pertence a este cliente
                    c_stmt = select(Conversa).where(Conversa.id == conversa_id, Conversa.cliente_id == usuario_id)
                    c_res = await db.execute(c_stmt)
                    conversa = c_res.scalar_one_or_none()

                    if conversa:
                        # Adicionar mensagem
                        nova_msg = Mensagem(
                            conversa_id=conversa_id,
                            autor_id=usuario_id,
                            conteudo=conteudo
                        )
                        db.add(nova_msg)
                        conversa.updated_at = datetime.utcnow()
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
