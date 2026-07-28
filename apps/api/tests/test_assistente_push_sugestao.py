"""
Push de "lead respondeu" no modo Copiloto do Assistente do Vendedor.

Pendência registrada no M060: no Copiloto nada é enviado ao lead sem aprovação
do vendedor, então uma sugestão da IA ficava parada até ele abrir o app por
conta própria. O motor salvava `sugestao_ia` e não avisava ninguém.

Estes testes exercem `processar_mensagem_recebida` direto (o motor não tem
rota HTTP própria — quem o chama é o webhook do worker de WhatsApp), com a IA
e o envio de push mockados: o que importa aqui é *se* o push sai, para *quem*,
e com que link — não o conteúdo gerado pela LLM.

Regras cobertas:
  1. Copiloto  → push para o vendedor dono da conversa, link `assistente:{id}:{nome}`.
  2. Automático→ nenhum push (a IA já respondeu sozinha, não há o que aprovar).
  3. Falha no push não derruba o processamento — a sugestão continua salva.
"""
import os
import sys
import uuid

import pytest
import pytest_asyncio
import sqlalchemy as sa

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import async_session  # noqa: E402
from models import (  # noqa: E402
    AutonomiaAssistente,
    ConversaWhatsapp,
    Loja,
    MembroLoja,
    MensagemWhatsapp,
)
import assistente.motor as motor  # noqa: E402


JID_TESTE = "5511988887777@c.us"


@pytest_asyncio.fixture
async def contexto_loja():
    """Pega uma loja com membro do banco seedado e limpa as conversas criadas."""
    async with async_session() as db:
        res = await db.execute(sa.select(MembroLoja).limit(1))
        membro = res.scalar_one_or_none()
        if membro is None:
            pytest.skip("Banco sem MembroLoja seedado.")

        res_loja = await db.execute(sa.select(Loja).where(Loja.id == membro.loja_id))
        if res_loja.scalar_one_or_none() is None:
            pytest.skip("Membro sem loja correspondente.")

        yield {"loja_id": membro.loja_id, "usuario_id": membro.usuario_id}

    # Teardown: remove as conversas do jid de teste (mensagens caem por cascade).
    async with async_session() as db:
        res = await db.execute(
            sa.select(ConversaWhatsapp).where(
                ConversaWhatsapp.conversa_whatsapp_id == JID_TESTE
            )
        )
        for conv in res.scalars().all():
            await db.execute(
                sa.delete(MensagemWhatsapp).where(MensagemWhatsapp.conversa_id == conv.id)
            )
            await db.delete(conv)
        await db.commit()


class _EspiaoPush:
    """Captura as chamadas de push em vez de bater na API do Expo."""

    def __init__(self, excecao: Exception | None = None):
        self.chamadas: list[dict] = []
        self.excecao = excecao

    async def __call__(self, db, usuario_id, titulo, corpo, link=None, tipo=None):
        self.chamadas.append(
            {
                "usuario_id": usuario_id,
                "titulo": titulo,
                "corpo": corpo,
                "link": link,
                "tipo": tipo,
            }
        )
        if self.excecao:
            raise self.excecao


@pytest.fixture
def ia_mockada(monkeypatch):
    """Neutraliza a chamada à LLM — sem isso o teste dependeria de rede e chave."""

    async def _resposta(*args, **kwargs):
        return "Claro! Esse carro está disponível, posso agendar uma visita?"

    monkeypatch.setattr(motor, "gerar_resposta_ia", _resposta)


def _instalar_espiao(monkeypatch, espiao):
    """O motor faz `from push import enviar_push_usuario` dentro da função,
    então o patch precisa ser no módulo `push`, não em `motor`."""
    import push

    monkeypatch.setattr(push, "enviar_push_usuario", espiao)


async def _processar(ctx, autonomia: AutonomiaAssistente, conteudo: str):
    """Cria a conversa com a autonomia desejada e entrega uma mensagem do lead."""
    async with async_session() as db:
        conversa = ConversaWhatsapp(
            loja_id=ctx["loja_id"],
            usuario_id=ctx["usuario_id"],
            conversa_whatsapp_id=JID_TESTE,
            contato_nome="Fulano da Silva",
            contato_numero="5511988887777",
            autonomia=autonomia,
        )
        db.add(conversa)
        await db.commit()
        conversa_id = conversa.id

    async with async_session() as db:
        await motor.processar_mensagem_recebida(
            db=db,
            loja_id=ctx["loja_id"],
            usuario_id=ctx["usuario_id"],
            contato_jid=JID_TESTE,
            contato_nome="Fulano da Silva",
            msg_id=f"msg-teste-{uuid.uuid4()}",
            conteudo=conteudo,
            autor_tipo="lead",
        )
    return conversa_id


@pytest.mark.asyncio
async def test_copiloto_dispara_push_para_o_vendedor(contexto_loja, ia_mockada, monkeypatch):
    espiao = _EspiaoPush()
    _instalar_espiao(monkeypatch, espiao)

    conversa_id = await _processar(
        contexto_loja, AutonomiaAssistente.COPILOTO, "Esse Corolla ainda está disponível?"
    )

    assert len(espiao.chamadas) == 1, "Copiloto deve avisar o vendedor exatamente uma vez"
    chamada = espiao.chamadas[0]
    assert chamada["usuario_id"] == contexto_loja["usuario_id"]
    assert "Fulano da Silva" in chamada["titulo"]
    assert chamada["tipo"] == "assistente_sugestao"
    # O link precisa levar o app direto à conversa certa (deep link do RootNavigator).
    assert chamada["link"] == f"assistente:{conversa_id}:Fulano da Silva"


@pytest.mark.asyncio
async def test_modo_automatico_nao_dispara_push(contexto_loja, ia_mockada, monkeypatch):
    espiao = _EspiaoPush()
    _instalar_espiao(monkeypatch, espiao)

    # Sem worker de WhatsApp no ambiente de teste o envio falha e cai no
    # fallback (salva como sugestão) — o que importa é que o caminho
    # AUTOMATICO não passa pelo bloco de push do Copiloto.
    await _processar(contexto_loja, AutonomiaAssistente.AUTOMATICO, "Qual o valor?")

    assert espiao.chamadas == [], "Modo automático não tem sugestão pendente de aprovação"


@pytest.mark.asyncio
async def test_falha_no_push_nao_perde_a_sugestao(contexto_loja, ia_mockada, monkeypatch):
    espiao = _EspiaoPush(excecao=RuntimeError("Expo fora do ar"))
    _instalar_espiao(monkeypatch, espiao)

    conversa_id = await _processar(
        contexto_loja, AutonomiaAssistente.COPILOTO, "Aceita troca no meu carro?"
    )

    assert len(espiao.chamadas) == 1
    # A sugestão precisa sobreviver ao push quebrado — ela é o produto do
    # Copiloto; a notificação é só a conveniência.
    async with async_session() as db:
        res = await db.execute(
            sa.select(MensagemWhatsapp)
            .where(MensagemWhatsapp.conversa_id == conversa_id)
            .where(MensagemWhatsapp.autor_tipo == "lead")
        )
        mensagens = res.scalars().all()
    assert mensagens, "A mensagem do lead deve estar gravada"
    assert any(m.sugestao_ia for m in mensagens), "A sugestão da IA não pode se perder"


def test_resumo_do_push_cabe_numa_linha():
    longo = "palavra " * 100
    resumo = motor._resumir_para_push(longo)
    assert len(resumo) <= 120
    assert "\n" not in resumo
    # Texto vazio (ex.: áudio sem transcrição) ainda gera corpo utilizável.
    assert motor._resumir_para_push("") != ""
    assert motor._resumir_para_push("   \n  ") != ""
