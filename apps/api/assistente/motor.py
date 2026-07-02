import os
import json
import logging
from datetime import datetime, timezone
import httpx
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import async_session
from models import (
    Loja,
    Usuario,
    Lead,
    ClientePF,
    ConversaWhatsapp,
    MensagemWhatsapp,
    AssistenteConfig,
    AssistentePermissao,
    AutonomiaAssistente,
    TomAssistente,
    OrigemLead,
    EtapaLead,
)

logger = logging.getLogger("assistente_ia.motor")

# Configurações de API carregadas do ambiente
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

WHATSAPP_WORKER_URL = os.getenv("WHATSAPP_WORKER_URL", "http://localhost:8090")
WHATSAPP_WORKER_TOKEN = os.getenv("WHATSAPP_WORKER_TOKEN", "whatsapp-worker-secret-token")


async def transcrever_audio_vendedor(audio_content: bytes, filename: str = "audio.mp3") -> str:
    """
    Usa a API do Whisper (OpenAI) para transcrever o áudio do vendedor.
    Retorna o texto transcrito.
    """
    if not OPENAI_API_KEY:
        logger.warning("[WHISPER] Sem OPENAI_API_KEY. Ignorando transcricao.")
        return "Audio enviado (transcricao nao disponível)."

    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            files = {"file": (filename, audio_content, "audio/mpeg")}
            data = {"model": "whisper-1"}
            
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=30.0
            )
            response.raise_for_status()
            res_data = response.json()
            return res_data.get("text", "")
    except Exception as e:
        logger.error(f"[WHISPER ERROR] Falha na transcricao: {e}")
        return "Erro ao transcrever audio."


async def clonar_voz_vendedor(audio_content: bytes, nome_vendedor: str) -> str:
    """
    Usa a API do ElevenLabs para clonar a voz do vendedor a partir do áudio.
    Retorna o voice_id gerado.
    """
    if not ELEVENLABS_API_KEY:
        logger.warning("[ELEVENLABS] Sem ELEVENLABS_API_KEY. Ignorando clonagem de voz.")
        return ""

    try:
        async with httpx.AsyncClient() as client:
            headers = {"xi-api-key": ELEVENLABS_API_KEY}
            files = {"files": ("sample.mp3", audio_content, "audio/mpeg")}
            data = {
                "name": f"SocialVeiculos - {nome_vendedor}",
                "description": "Voz clonada para assistente de vendas da concessionaria."
            }
            
            response = await client.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers=headers,
                files=files,
                data=data,
                timeout=30.0
            )
            response.raise_for_status()
            res_data = response.json()
            return res_data.get("voice_id", "")
    except Exception as e:
        logger.error(f"[ELEVENLABS ERROR] Falha na clonagem de voz: {e}")
        return ""


async def sintetizar_voz_resposta(text: str, voice_id: str) -> bytes:
    """
    Usa o ElevenLabs para ler o texto com a voz clonada do vendedor.
    Retorna os bytes do arquivo de áudio.
    """
    if not ELEVENLABS_API_KEY or not voice_id:
        return b""

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            }
            data = {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers=headers,
                json=data,
                timeout=40.0
            )
            response.raise_for_status()
            return response.content
    except Exception as e:
        logger.error(f"[ELEVENLABS TS ERROR] Falha ao sintetizar audio: {e}")
        return b""


async def gerar_resposta_ia(
    db,
    loja_id: str,
    usuario_id: str,
    conversa: ConversaWhatsapp,
    nova_mensagem: str
) -> str:
    """
    Chama a API do Claude (Anthropic) para formular uma resposta para o lead.
    Garante que o tom e estilo do vendedor configurados sejam seguidos.
    Inclui informações da loja, simulações e CRM.
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("[CLAUDE] Sem ANTHROPIC_API_KEY. Retornando resposta padrão mock.")
        return "[BOT] Olá! Recebemos sua mensagem. Um de nossos vendedores entrará em contato em breve!"

    # 1. Carregar configuração do assistente
    stmt_config = select(AssistenteConfig).where(
        AssistenteConfig.loja_id == loja_id,
        AssistenteConfig.usuario_id == usuario_id
    )
    res_config = await db.execute(stmt_config)
    config = res_config.scalar_one_or_none()

    tom = config.tom.value if config else "amigavel"
    estilo = config.estilo_resumo if config else "Cordial, prestativo e focado em tirar dúvidas de veículos."

    # 2. Carregar informações complementares (Loja e Histórico de conversas)
    stmt_loja = select(Loja).where(Loja.id == loja_id)
    res_loja = await db.execute(stmt_loja)
    loja = res_loja.scalar_one_or_none()
    loja_nome = loja.nome if loja else "Nossa Concessionária"

    # Buscar últimas 10 mensagens
    stmt_msgs = select(MensagemWhatsapp).where(
        MensagemWhatsapp.conversa_id == conversa.id
    ).order_by(MensagemWhatsapp.created_at.desc()).limit(10)
    res_msgs = await db.execute(stmt_msgs)
    msgs = list(reversed(res_msgs.scalars().all()))

    historico_str = ""
    for m in msgs:
        autor = "Lead" if m.autor_tipo == "lead" else "Vendedor (Você)"
        historico_str += f"{autor}: {m.conteudo}\n"

    # 3. Buscar dados de simulação de crédito e CRM para o lead (se houver pelo número)
    # Procurar por cliente cadastrado com o número correspondente
    numero_limpo = conversa.contato_numero.replace("+", "").strip()
    stmt_cli = select(ClientePF).where(
        ClientePF.loja_id == loja_id,
        ClientePF.telefone.like(f"%{numero_limpo[-8:]}%")
    )
    res_cli = await db.execute(stmt_cli)
    cliente = res_cli.scalar_one_or_none()

    contexto_extra = ""
    if cliente:
        # Carregar lead ativo
        stmt_lead = select(Lead).where(
            Lead.loja_id == loja_id,
            Lead.cliente_id == cliente.id,
            Lead.etapa != EtapaLead.PERDIDO,
            Lead.etapa != EtapaLead.FECHAMENTO
        ).order_by(Lead.updated_at.desc()).limit(1)
        res_lead = await db.execute(stmt_lead)
        lead = res_lead.scalar_one_or_none()
        
        if lead:
            contexto_extra += f"- Dados do Lead no CRM: Nome {cliente.nome}, Etapa atual: {lead.etapa.value}, Valor Estimado da compra: R$ {lead.valor_estimado}\n"
            if lead.veiculo_id:
                # buscar modelo do veículo
                from models import Veiculo
                v_res = await db.execute(select(Veiculo).where(Veiculo.id == lead.veiculo_id))
                veiculo = v_res.scalar_one_or_none()
                if veiculo:
                    contexto_extra += f"- Veículo de Interesse: {veiculo.marca} {veiculo.modelo} {veiculo.versao} ({veiculo.ano_modelo}), Preço R$ {veiculo.preco_venda}\n"

            # Buscar simulações ativas
            from models import Simulacao, SimulacaoResultado
            stmt_sim = select(Simulacao).options(selectinload(Simulacao.resultados)).where(
                Simulacao.loja_id == loja_id,
                Simulacao.cliente_id == cliente.id
            ).order_by(Simulacao.created_at.desc()).limit(1)
            res_sim = await db.execute(stmt_sim)
            simulacao = res_sim.scalar_one_or_none()
            if simulacao and simulacao.resultados:
                contexto_extra += f"- Simulação de Crédito recente realizada:\n"
                contexto_extra += f"  Entrada desejada: R$ {simulacao.entrada}, Prazo: {simulacao.prazo_desejado} meses.\n"
                for r in simulacao.resultados:
                    if r.status.value == "aprovado":
                        contexto_extra += f"  * Banco {r.banco.value}: APROVADO - Parcela: R$ {r.parcela} em {r.prazo}x, Taxa {r.taxa}% a.m.\n"

    # 4. Montar o prompt do Claude
    prompt_system = (
        f"Você é um Assistente de Inteligência Artificial que responde mensagens de WhatsApp em nome do vendedor da concessionária {loja_nome}.\n"
        f"Você deve se passar pelo próprio vendedor humano, mantendo o tom de conversa configurado: '{tom}'.\n"
        f"Instruções de estilo de escrita baseadas no áudio do vendedor:\n"
        f"\"\"\"\n{estilo}\n\"\"\"\n\n"
        f"Instruções Importantes:\n"
        f"1. Seja conciso e direto. As pessoas leem no WhatsApp e não gostam de blocos longos de texto.\n"
        f"2. Use emojis de forma moderada e amigável.\n"
        f"3. Responda apenas com base nas informações fornecidas. Se não souber uma informação específica (ex: preço exato de um carro que não está no estoque listado), passe a vez para o atendimento humano de forma educada.\n"
        f"4. Nunca invente taxas ou aprovações de crédito falsas. Use os dados da simulação caso existam.\n"
    )

    if contexto_extra:
        prompt_system += f"\nContexto do Lead e do Veículo obtidos no CRM:\n{contexto_extra}\n"

    # Criar chamada HTTP da API do Claude
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            messages = []
            # Adicionar histórico formatado
            for m in msgs:
                role = "user" if m.autor_tipo == "lead" else "assistant"
                messages.append({"role": role, "content": m.conteudo})
            
            # Adicionar última mensagem caso não esteja no histórico
            if not messages or messages[-1]["content"] != nova_mensagem:
                messages.append({"role": "user", "content": nova_mensagem})

            data = {
                "model": "claude-opus-4-8",
                "max_tokens": 500,
                "system": prompt_system,
                "messages": messages
            }

            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=data,
                timeout=30.0
            )
            response.raise_for_status()
            res_data = response.json()
            content = res_data.get("content", [])
            if content and len(content) > 0:
                return content[0].get("text", "")
            return "[BOT] Obrigado pelo contato. Um momento que irei verificar para você."
    except Exception as e:
        logger.error(f"[CLAUDE ERROR] Erro na chamada do Claude: {e}")
        return "[BOT] Olá! Recebemos sua mensagem. Analisaremos sua proposta e retornaremos o contato em breve."


async def processar_mensagem_recebida(
    db,
    loja_id: str,
    usuario_id: str,
    contato_jid: str,
    contato_nome: str,
    msg_id: str,
    conteudo: str,
    autor_tipo: str  # lead ou vendedor
) -> None:
    """
    Recebe as mensagens originadas pelo Webhook do worker.
    Se for nova conversa, cria conversa no banco.
    Se for do lead, gera resposta da IA (automática ou sugestão copiloto) e atualiza o CRM.
    """
    # 1. Obter ou Criar Conversa
    stmt_conv = select(ConversaWhatsapp).where(
        ConversaWhatsapp.loja_id == loja_id,
        ConversaWhatsapp.usuario_id == usuario_id,
        ConversaWhatsapp.conversa_whatsapp_id == contato_jid
    )
    res_conv = await db.execute(stmt_conv)
    conversa = res_conv.scalar_one_or_none()

    is_nova_conversa = False
    if not conversa:
        numero = contato_jid.split("@")[0]
        conversa = ConversaWhatsapp(
            loja_id=loja_id,
            usuario_id=usuario_id,
            conversa_whatsapp_id=contato_jid,
            contato_nome=contato_nome,
            contato_numero=numero,
            autonomia=AutonomiaAssistente.COPILOTO
        )
        db.add(conversa)
        await db.flush()
        is_nova_conversa = True
        logger.info(f"[ASSISTENTE] Nova conversa iniciada com {contato_nome} ({contato_jid})")

    # 2. Verificar se a mensagem já existe para evitar duplicidades de webhooks
    stmt_msg_check = select(MensagemWhatsapp).where(
        MensagemWhatsapp.conversa_id == conversa.id,
        MensagemWhatsapp.mensagem_whatsapp_id == msg_id
    )
    res_msg_check = await db.execute(stmt_msg_check)
    if res_msg_check.scalar_one_or_none():
        logger.info(f"[ASSISTENTE] Mensagem {msg_id} ja processada. Pulando.")
        return

    # 3. Salvar Mensagem recebida
    mensagem = MensagemWhatsapp(
        conversa_id=conversa.id,
        mensagem_whatsapp_id=msg_id,
        autor_tipo=autor_tipo,
        conteudo=conteudo
    )
    db.add(mensagem)
    conversa.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # 4. Criar Lead Automático no CRM se for nova conversa e mensagem veio do lead
    if is_nova_conversa and autor_tipo == "lead":
        numero_limpo = conversa.contato_numero
        # Verificar se ja existe ClientePF
        stmt_cli = select(ClientePF).where(
            ClientePF.loja_id == loja_id,
            ClientePF.telefone.like(f"%{numero_limpo[-8:]}%")
        )
        res_cli = await db.execute(stmt_cli)
        cliente = res_cli.scalar_one_or_none()

        if not cliente:
            cliente = ClientePF(
                loja_id=loja_id,
                nome=contato_nome,
                email="",
                telefone=numero_limpo
            )
            db.add(cliente)
            await db.flush()

        # Criar Lead
        lead = Lead(
            loja_id=loja_id,
            cliente_id=cliente.id,
            origem=OrigemLead.WHATSAPP,
            etapa=EtapaLead.LEAD,
            valor_estimado=0.0,
            observacoes=f"Lead gerado via Assistente WhatsApp IA do vendedor. Mensagem inicial: {conteudo}"
        )
        db.add(lead)
        await db.commit()
        logger.info(f"[ASSISTENTE] Lead criado no CRM para {contato_nome} via WhatsApp.")

    # 5. Se a mensagem veio do lead, processar a resposta da IA
    if autor_tipo == "lead":
        # Verificar autonomia (se a conversa tem toggle específico, senão busca o default do vendedor)
        autonomia = conversa.autonomia
        if not autonomia:
            stmt_perm = select(AssistentePermissao).where(
                AssistentePermissao.loja_id == loja_id,
                AssistentePermissao.usuario_id == usuario_id
            )
            res_perm = await db.execute(stmt_perm)
            perm = res_perm.scalar_one_or_none()
            autonomia = perm.autonomia_default if perm else AutonomiaAssistente.COPILOTO

        # Chamar a IA
        resposta_ia = await gerar_resposta_ia(db, loja_id, usuario_id, conversa, conteudo)

        if autonomia == AutonomiaAssistente.AUTOMATICO:
            # Modo AUTOMATICO: enviar direto pelo worker
            try:
                async with httpx.AsyncClient() as client:
                    headers = {"Authorization": f"Bearer {WHATSAPP_WORKER_TOKEN}"}
                    send_payload = {
                        "usuario_id": usuario_id,
                        "contato_jid": contato_jid,
                        "conteudo": resposta_ia
                    }
                    response = await client.post(
                        f"{WHATSAPP_WORKER_URL}/messages/send",
                        headers=headers,
                        json=send_payload,
                        timeout=10.0
                    )
                    response.raise_for_status()
                    
                    # Salvar a mensagem da IA no banco
                    msg_ia = MensagemWhatsapp(
                        conversa_id=conversa.id,
                        mensagem_whatsapp_id=f"ia-auto-{datetime.now(timezone.utc).timestamp()}",
                        autor_tipo="ia",
                        conteudo=resposta_ia,
                        enviada_ia=True
                    )
                    db.add(msg_ia)
                    await db.commit()
                    logger.info(f"[ASSISTENTE] Mensagem respondida automaticamente via IA.")
            except Exception as e:
                logger.error(f"[ASSISTENTE ERROR] Falha ao enviar resposta automatica: {e}")
                # Fallback: salva como sugestao se o envio falhar
                mensagem.sugestao_ia = resposta_ia
                await db.commit()
        else:
            # Modo COPILOTO: salvar sugestao de resposta no banco
            mensagem.sugestao_ia = resposta_ia
            await db.commit()
            logger.info(f"[ASSISTENTE] Sugestao de resposta IA salva no banco (modo Copiloto).")
