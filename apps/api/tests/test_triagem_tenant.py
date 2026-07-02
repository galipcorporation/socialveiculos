"""
Regressão do B023 — isolamento multi-tenant na triagem de leads B2C.

`POST /v1/gestor/triagem/{conversa_id}` NÃO pode carregar/classificar uma
conversa de OUTRA loja. Antes do fix o endpoint filtrava só por id + tipo,
vazando o histórico de mensagens de outro tenant para o gestor. O teste cria
uma conversa B2C numa loja alheia e confirma que o gestor recebe 404.
"""
import uuid

from sqlalchemy import delete

from database import async_session
from models import Conversa, Mensagem, Loja, LeadTriagem, TipoConversa


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def test_gestor_nao_tria_conversa_de_outra_loja(client, gestor_token):
    """Gestor da loja A → 404 ao tentar triar conversa B2C da loja B (B023)."""
    loja_b_id = _uid()
    conversa_id = _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_b_id, nome="Loja B (teste B023)", slug=f"loja-b-{loja_b_id[:8]}"))
        db.add(Conversa(id=conversa_id, tipo=TipoConversa.B2C, loja_id=loja_b_id))
        db.add(Mensagem(
            id=_uid(), conversa_id=conversa_id, autor_id=None,
            conteudo="Quero saber preço e financiamento desse carro.",
        ))
        await db.commit()

    try:
        resp = await client.post(
            f"/v1/gestor/triagem/{conversa_id}",
            headers={"Authorization": f"Bearer {gestor_token}"},
        )
        assert resp.status_code == 404, (
            "Vazamento entre lojas (B023): gestor acessou conversa de outra loja "
            f"→ {resp.status_code} {resp.text}"
        )
    finally:
        async with async_session() as db:
            await db.execute(delete(LeadTriagem).where(LeadTriagem.conversa_id == conversa_id))
            await db.execute(delete(Mensagem).where(Mensagem.conversa_id == conversa_id))
            await db.execute(delete(Conversa).where(Conversa.id == conversa_id))
            await db.execute(delete(Loja).where(Loja.id == loja_b_id))
            await db.commit()
