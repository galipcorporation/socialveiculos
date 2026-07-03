import os
import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import httpx

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import (
    AssistentePermissao,
    AssistenteConfig,
    ConversaWhatsapp,
    MensagemWhatsapp,
    AutonomiaAssistente,
    TomAssistente,
    Usuario,
    MembroLoja,
)
from modulos import exige_modulo, Modulo
from storage import storage_provider
from assistente.motor import (
    transcrever_audio_vendedor,
    clonar_voz_vendedor,
    sintetizar_voz_resposta,
    processar_mensagem_recebida,
    WHATSAPP_WORKER_URL,
    WHATSAPP_WORKER_TOKEN,
)

logger = logging.getLogger("assistente_ia.router")

router = APIRouter(prefix="/v1/assistente", tags=["Assistente de IA (WhatsApp)"])

# ── SCHEMAS PYDANTIC ──────────────────────────────────────────

class AssistenteConfigResponse(BaseModel):
    tom: TomAssistente
    audio_url: Optional[str] = None
    estilo_resumo: Optional[str] = None
    consentimento_voz: bool
    consentimento_timestamp: Optional[datetime] = None

class AssistenteConfigUpdateRequest(BaseModel):
    tom: TomAssistente
    consentimento_voz: bool

class ConversaWhatsappResponse(BaseModel):
    id: str
    contato_nome: str
    contato_numero: str
    conversa_whatsapp_id: str
    autonomia: AutonomiaAssistente
    created_at: datetime
    updated_at: datetime
    ultima_mensagem: Optional[str] = None
    ultima_mensagem_data: Optional[datetime] = None

class MensagemWhatsappResponse(BaseModel):
    id: str
    autor_tipo: str
    conteudo: str
    midia_url: Optional[str] = None
    midia_tipo: Optional[str] = None
    sugestao_ia: Optional[str] = None
    enviada_ia: bool
    created_at: datetime

class EnviarMensagemRequest(BaseModel):
    conteudo: str

class AutonomiaUpdateRequest(BaseModel):
    autonomia: AutonomiaAssistente

class PermissaoVendedorResponse(BaseModel):
    usuario_id: str
    pode_usar: bool
    autonomia_default: AutonomiaAssistente

class PermissaoVendedorUpdateRequest(BaseModel):
    pode_usar: bool
    autonomia_default: AutonomiaAssistente

# ── WEBHOOK SCHEMAS ──────────────────────────────────────────

class WebhookMessagePayload(BaseModel):
    id: str
    from_: str = Form(alias="from")
    fromMe: bool
    body: str
    timestamp: int
    authorName: str

    model_config = ConfigDict(populate_by_name=True)

class WebhookPayload(BaseModel):
    event: str  # "message" ou "connection"
    usuario_id: str
    status: Optional[str] = None
    message: Optional[dict] = None  # Recebemos como dict livre para parse manual

# ── DEPENDÊNCIA DE PERMISSÃO INDIVIDUAL ───────────────────────

async def valida_permissao_assistente(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
) -> B2BContext:
    """
    Valida se o usuário tem permissão para usar o assistente de IA.
    Gestores têm permissão automática; vendedores precisam ter o toggle pode_usar=True.
    """
    # Gestor sempre pode usar
    if context.membro and context.membro.papel.value == "gestor":
        return context

    # Verificar na tabela de permissões
    stmt = select(AssistentePermissao).where(
        AssistentePermissao.loja_id == context.loja_id,
        AssistentePermissao.usuario_id == context.usuario.id,
        AssistentePermissao.pode_usar == True
    )
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu usuário não possui permissão para usar o Assistente de IA do WhatsApp. Contate o gestor."
        )
    return context

# ── ENDPOINTS DE SESSÃO / CONEXÃO ─────────────────────────────

@router.get(
    "/sessao",
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def status_sessao(
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Retorna o status da sessão WhatsApp do vendedor logado."""
    usuario_id = context.usuario.id
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
            response = await client.get(
                f"{WHATSAPP_WORKER_URL}/session/status/{usuario_id}",
                headers=headers,
                timeout=5.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"[WORKER ERROR] Falha ao consultar status de sessao: {e}")
        return {"status": "disconnected", "qr": None, "error": "WhatsApp Worker indisponível"}


@router.post(
    "/sessao/conectar",
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def conectar_sessao(
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Solicita ao worker a geração do QR Code e conexão do WhatsApp."""
    usuario_id = context.usuario.id
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
            response = await client.post(
                f"{WHATSAPP_WORKER_URL}/session/start",
                headers=headers,
                json={"usuario_id": usuario_id},
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"[WORKER ERROR] Falha ao iniciar conexao WhatsApp: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível iniciar a conexão com o WhatsApp Worker."
        )


@router.post(
    "/sessao/desconectar",
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def desconectar_sessao(
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Desconecta a sessão WhatsApp do vendedor atual no worker."""
    usuario_id = context.usuario.id
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
            response = await client.post(
                f"{WHATSAPP_WORKER_URL}/session/stop",
                headers=headers,
                json={"usuario_id": usuario_id},
                timeout=5.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"[WORKER ERROR] Falha ao desconectar WhatsApp: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao encerrar conexao no WhatsApp Worker."
        )

# ── CONFIGURAÇÕES DO ASSISTENTE (VENDEDOR) ────────────────────

@router.get(
    "/config",
    response_model=AssistenteConfigResponse,
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def obter_config(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Obtém configurações de IA e clonagem do vendedor logado."""
    stmt = select(AssistenteConfig).where(
        AssistenteConfig.loja_id == context.loja_id,
        AssistenteConfig.usuario_id == context.usuario.id
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()
    
    if not config:
        # Criar configuracao padrao
        config = AssistenteConfig(
            loja_id=context.loja_id,
            usuario_id=context.usuario.id,
            tom=TomAssistente.AMIGAVEL,
            consentimento_voz=False
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        
    return config


@router.put(
    "/config",
    response_model=AssistenteConfigResponse,
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def atualizar_config(
    data: AssistenteConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Atualiza as configurações de tom e consentimento de voz do vendedor."""
    stmt = select(AssistenteConfig).where(
        AssistenteConfig.loja_id == context.loja_id,
        AssistenteConfig.usuario_id == context.usuario.id
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()
    
    if not config:
        config = AssistenteConfig(
            loja_id=context.loja_id,
            usuario_id=context.usuario.id
        )
        db.add(config)

    config.tom = data.tom
    config.consentimento_voz = data.consentimento_voz
    if data.consentimento_voz and not config.consentimento_timestamp:
        config.consentimento_timestamp = datetime.now(timezone.utc)
    elif not data.consentimento_voz:
        config.consentimento_timestamp = None
        config.voz_id = None  # Revoga voz clonada se desmarcar

    await db.commit()
    await db.refresh(config)
    
    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="assistente.atualizar_config",
        entidade="assistente_config",
        entidade_id=config.id,
        detalhes=f"Tom: {data.tom.value}, Consentimento Voz: {data.consentimento_voz}"
    )
    
    return config


@router.post(
    "/config/audio",
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def upload_audio_config(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Recebe um áudio do vendedor, transcreve com o Whisper para extrair o estilo de escrita.
    Se houver consentimento, clona no ElevenLabs.
    """
    stmt = select(AssistenteConfig).where(
        AssistenteConfig.loja_id == context.loja_id,
        AssistenteConfig.usuario_id == context.usuario.id
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=400, detail="Salve as configuracoes basicas antes do audio.")

    audio_bytes = await file.read()
    
    # 1. Transcrição Whisper
    transcricao = await transcrever_audio_vendedor(audio_bytes, file.filename)
    
    # Formular estilo de escrita (system instruction)
    config.estilo_resumo = (
        f"Estilo baseado na gravacao do vendedor: '{transcricao[:300]}...'\n"
        f"Use frases com pontuacao parecida, respostas empáticas e vocabulário comercial adequado."
    )

    # 2. Clonar Voz (ElevenLabs) se consentido
    if config.consentimento_voz:
        voice_id = await clonar_voz_vendedor(audio_bytes, context.usuario.nome)
        if voice_id:
            config.voz_id = voice_id
            logger.info(f"[ASSISTENTE] Voz clonada criada com ID {voice_id}")

    # Para fins de teste/dev: salvar arquivo localmente
    os.makedirs("static/uploads/assistente", exist_ok=True)
    audio_path = f"static/uploads/assistente/{context.usuario.id}_{file.filename}"
    with open(audio_path, "wb") as f:
        f.write(audio_bytes)
    
    config.audio_url = f"/static/uploads/assistente/{context.usuario.id}_{file.filename}"
    await db.commit()

    return {
        "status": "success",
        "audio_url": config.audio_url,
        "estilo_resumo": config.estilo_resumo,
        "voz_id": config.voz_id
    }

# ── GESTÃO DE CONVERSAS E MENSAGENS ───────────────────────────

@router.get(
    "/conversas",
    response_model=List[ConversaWhatsappResponse],
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def listar_conversas(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Lista as conversas de WhatsApp ativas associadas ao vendedor."""
    stmt = (
        select(ConversaWhatsapp)
        .options(selectinload(ConversaWhatsapp.mensagens))
        .where(
            ConversaWhatsapp.loja_id == context.loja_id,
            ConversaWhatsapp.usuario_id == context.usuario.id
        )
        .order_by(ConversaWhatsapp.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()
    
    response = []
    for c in conversas:
        ultima_msg = c.mensagens[-1] if c.mensagens else None
        response.append(
            ConversaWhatsappResponse(
                id=c.id,
                contato_nome=c.contato_nome,
                contato_numero=c.contato_numero,
                conversa_whatsapp_id=c.conversa_whatsapp_id,
                autonomia=c.autonomia,
                created_at=c.created_at,
                updated_at=c.updated_at,
                ultima_mensagem=ultima_msg.conteudo if ultima_msg else None,
                ultima_mensagem_data=ultima_msg.created_at if ultima_msg else None
            )
        )
    return response


@router.get(
    "/conversas/{conversa_id}/mensagens",
    response_model=List[MensagemWhatsappResponse],
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def listar_mensagens(
    conversa_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Retorna o histórico de mensagens de uma conversa de WhatsApp específica."""
    # Validar propriedade da conversa
    stmt_conv = select(ConversaWhatsapp).where(
        ConversaWhatsapp.id == conversa_id,
        ConversaWhatsapp.loja_id == context.loja_id,
        ConversaWhatsapp.usuario_id == context.usuario.id
    )
    res_conv = await db.execute(stmt_conv)
    if not res_conv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    stmt_msgs = select(MensagemWhatsapp).where(
        MensagemWhatsapp.conversa_id == conversa_id
    ).order_by(MensagemWhatsapp.created_at.asc())
    res_msgs = await db.execute(stmt_msgs)
    
    return res_msgs.scalars().all()


@router.post(
    "/conversas/{conversa_id}/mensagens",
    response_model=MensagemWhatsappResponse,
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def enviar_mensagem(
    conversa_id: str,
    data: EnviarMensagemRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Envia uma mensagem de WhatsApp manual ou envia a sugestão de IA após edições.
    Chama o worker Node para realizar o envio real.
    """
    stmt_conv = select(ConversaWhatsapp).where(
        ConversaWhatsapp.id == conversa_id,
        ConversaWhatsapp.loja_id == context.loja_id,
        ConversaWhatsapp.usuario_id == context.usuario.id
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    # 1. Enviar via worker HTTP
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
            payload = {
                "usuario_id": context.usuario.id,
                "contato_jid": conversa.conversa_whatsapp_id,
                "conteudo": data.conteudo
            }
            response = await client.post(
                f"{WHATSAPP_WORKER_URL}/messages/send",
                headers=headers,
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()
            res_worker = response.json()
            message_id = res_worker.get("messageId", f"manual-{datetime.now(timezone.utc).timestamp()}")
    except Exception as e:
        logger.error(f"[WORKER SEND ERROR] Falha no disparo de mensagem pelo worker: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="WhatsApp Worker falhou ao processar o envio."
        )

    # 2. Salvar mensagem enviada
    msg = MensagemWhatsapp(
        conversa_id=conversa.id,
        mensagem_whatsapp_id=message_id,
        autor_tipo="vendedor",
        conteudo=data.conteudo,
        enviada_ia=False
    )
    db.add(msg)
    
    # 3. Limpar a sugestão de IA da última mensagem recebida (já que foi respondida)
    stmt_ult = select(MensagemWhatsapp).where(
        MensagemWhatsapp.conversa_id == conversa.id,
        MensagemWhatsapp.autor_tipo == "lead"
    ).order_by(MensagemWhatsapp.created_at.desc()).limit(1)
    res_ult = await db.execute(stmt_ult)
    ult_msg = res_ult.scalar_one_or_none()
    if ult_msg:
        ult_msg.sugestao_ia = None

    conversa.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    return msg


@router.post(
    "/conversas/{conversa_id}/mensagens/audio",
    response_model=MensagemWhatsappResponse,
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def enviar_mensagem_audio(
    conversa_id: str,
    data: EnviarMensagemRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Sintetiza o texto (sugestão da IA, possivelmente editada) na voz clonada do
    vendedor e envia como nota de voz (PTT) pelo WhatsApp via worker.
    Modo Copiloto: o vendedor decide enviar; nada sai sem esta ação.
    """
    conteudo = (data.conteudo or "").strip()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Conteúdo do áudio não pode ser vazio.")

    stmt_conv = select(ConversaWhatsapp).where(
        ConversaWhatsapp.id == conversa_id,
        ConversaWhatsapp.loja_id == context.loja_id,
        ConversaWhatsapp.usuario_id == context.usuario.id
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    # 1. Carregar voz clonada do vendedor
    stmt_config = select(AssistenteConfig).where(
        AssistenteConfig.loja_id == context.loja_id,
        AssistenteConfig.usuario_id == context.usuario.id
    )
    res_config = await db.execute(stmt_config)
    config = res_config.scalar_one_or_none()
    voz_id = config.voz_id if config else None
    if not voz_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Você ainda não treinou sua voz. Vá em Configurações da IA, marque o consentimento e envie um áudio de amostra para clonar sua voz."
        )

    # 2. Sintetizar áudio (ElevenLabs) → MP3 bytes
    audio_bytes = await sintetizar_voz_resposta(conteudo, voz_id)
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Não foi possível gerar o áudio. Verifique a configuração da voz (ELEVENLABS_API_KEY) e tente novamente."
        )

    # 3. Subir MP3 no storage (para a UI reproduzir o que foi enviado)
    midia_url = await storage_provider.upload_file(audio_bytes, "resposta.mp3", "audio/mpeg")

    # 4. Enviar via worker como nota de voz
    import base64 as _b64
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
            payload = {
                "usuario_id": context.usuario.id,
                "contato_jid": conversa.conversa_whatsapp_id,
                "audio_base64": _b64.b64encode(audio_bytes).decode("ascii"),
                "transcricao": conteudo,
            }
            response = await client.post(
                f"{WHATSAPP_WORKER_URL}/messages/send-audio",
                headers=headers,
                json=payload,
                timeout=40.0
            )
            response.raise_for_status()
            res_worker = response.json()
            message_id = res_worker.get("messageId", f"audio-{datetime.now(timezone.utc).timestamp()}")
    except Exception as e:
        logger.error(f"[WORKER SEND-AUDIO ERROR] Falha ao enviar áudio pelo worker: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="WhatsApp Worker falhou ao enviar o áudio."
        )

    # 5. Salvar a mensagem com mídia
    msg = MensagemWhatsapp(
        conversa_id=conversa.id,
        mensagem_whatsapp_id=message_id,
        autor_tipo="vendedor",
        conteudo=conteudo,
        midia_url=midia_url,
        midia_tipo="audio",
        enviada_ia=False
    )
    db.add(msg)

    # 6. Limpar a sugestão da última mensagem do lead (já respondida)
    stmt_ult = select(MensagemWhatsapp).where(
        MensagemWhatsapp.conversa_id == conversa.id,
        MensagemWhatsapp.autor_tipo == "lead"
    ).order_by(MensagemWhatsapp.created_at.desc()).limit(1)
    res_ult = await db.execute(stmt_ult)
    ult_msg = res_ult.scalar_one_or_none()
    if ult_msg:
        ult_msg.sugestao_ia = None

    conversa.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    return msg


@router.put(
    "/conversas/{conversa_id}/autonomia",
    response_model=ConversaWhatsappResponse,
    dependencies=[Depends(exige_modulo(Modulo.ASSISTENTE_IA)), Depends(valida_permissao_assistente)]
)
async def atualizar_autonomia_conversa(
    conversa_id: str,
    data: AutonomiaUpdateRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """Muda o toggle de modo Copiloto/Automático para uma conversa específica."""
    stmt_conv = select(ConversaWhatsapp).where(
        ConversaWhatsapp.id == conversa_id,
        ConversaWhatsapp.loja_id == context.loja_id,
        ConversaWhatsapp.usuario_id == context.usuario.id
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    conversa.autonomia = data.autonomia
    await db.commit()
    await db.refresh(conversa)
    
    return ConversaWhatsappResponse(
        id=conversa.id,
        contato_nome=conversa.contato_nome,
        contato_numero=conversa.contato_numero,
        conversa_whatsapp_id=conversa.conversa_whatsapp_id,
        autonomia=conversa.autonomia,
        created_at=conversa.created_at,
        updated_at=conversa.updated_at
    )

# ── WEBHOOK PÚBLICO DO WORKER ─────────────────────────────────

@router.post("/webhook")
async def webhook_recebido(
    payload: WebhookPayload,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook público acionado pelo WhatsApp worker persistente.
    Recebe mensagens novas (enviadas/recebidas) e status de conexões.
    """
    logger.info(f"[WEBHOOK] Evento recebido: '{payload.event}' para o usuario {payload.usuario_id}")

    # 1. Obter a Loja associada ao usuario vendedor (para multitenancy)
    stmt_membro = select(MembroLoja).where(MembroLoja.usuario_id == payload.usuario_id).limit(1)
    res_membro = await db.execute(stmt_membro)
    membro = res_membro.scalar_one_or_none()
    
    if not membro:
        logger.error(f"[WEBHOOK ERROR] Membro de loja nao encontrado para o usuario {payload.usuario_id}")
        return {"status": "ignored", "error": "Vendedor sem loja associada"}

    loja_id = membro.loja_id

    # 2. Processar Evento de Conexão
    if payload.event == "connection":
        logger.info(f"[WEBHOOK] Conexao do usuario {payload.usuario_id} mudou para {payload.status}")
        # Podemos registrar isso na auditoria
        return {"status": "processed"}

    # 3. Processar Evento de Mensagem
    elif payload.event == "message":
        if not payload.message:
            return {"status": "error", "detail": "Payload sem dados da mensagem"}

        msg_data = payload.message
        msg_id = msg_data.get("id")
        from_jid = msg_data.get("from")
        from_me = msg_data.get("fromMe", False)
        body = msg_data.get("body", "")
        author_name = msg_data.get("authorName", "Contato WhatsApp")

        autor_tipo = "vendedor" if from_me else "lead"

        try:
            await processar_mensagem_recebida(
                db=db,
                loja_id=loja_id,
                usuario_id=payload.usuario_id,
                contato_jid=from_jid,
                contato_nome=author_name,
                msg_id=msg_id,
                conteudo=body,
                autor_tipo=autor_tipo
            )
            return {"status": "processed"}
        except Exception as e:
            logger.error(f"[WEBHOOK ERROR] Falha no processamento da mensagem: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return {"status": "ignored"}
