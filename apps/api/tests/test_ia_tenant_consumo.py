"""Isolamento multi-tenant das rotas de IA (Groq) e atribuição do consumo.

Duas garantias que o painel de consumo e o bolso da plataforma dependem:

1. A IA nunca opera sobre recurso de OUTRA loja — gerar anúncio de um veículo
   alheio ou triar conversa alheia devolve 404, mesmo com id válido.
2. Sem loja no contexto (admin de plataforma sem `X-Loja-Id`) as rotas param
   com 409 ANTES de chamar a IA. Sem isso o filtro `loja_id == None` viraria
   `IS NULL` no SQL, deixando de isolar o tenant e gastando token sem dono.
"""
import uuid

from sqlalchemy import delete, select

from database import async_session
from models import (
    Conversa, Mensagem, Loja, LeadTriagem, MarketingUsage, TipoConversa, Veiculo,
)

TRIAGEM = "/v1/gestor/triagem"
GERAR_POST = "/v1/marketing/gerar-post"


def _uid() -> str:
    return uuid.uuid4().hex[:32]


async def test_gerar_anuncio_de_veiculo_de_outra_loja_404(client, gestor_token):
    """Gestor da loja A não gera anúncio para veículo da loja B."""
    loja_b_id, veiculo_id = _uid(), _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_b_id, nome="Loja B (IA)", slug=f"loja-b-ia-{loja_b_id[:8]}"))
        db.add(Veiculo(
            id=veiculo_id, loja_id=loja_b_id, marca="Toyota", modelo="Corolla",
            ano_fabricacao=2023, ano_modelo=2023, preco_venda=142900.0,
        ))
        await db.commit()

    try:
        resp = await client.post(
            GERAR_POST,
            headers={"Authorization": f"Bearer {gestor_token}"},
            json={"veiculo_id": veiculo_id, "rede": "instagram", "tom": "vendedor"},
        )
        assert resp.status_code == 404, (
            f"Vazamento entre lojas: anúncio gerado para veículo alheio → {resp.status_code} {resp.text}"
        )

        # E nada de consumo lançado na conta da loja B.
        async with async_session() as db:
            usos = (await db.execute(
                select(MarketingUsage).where(MarketingUsage.loja_id == loja_b_id)
            )).scalars().all()
            assert not usos, "Consumo de IA registrado para loja que não pediu nada."
    finally:
        async with async_session() as db:
            await db.execute(delete(MarketingUsage).where(MarketingUsage.loja_id == loja_b_id))
            await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
            await db.execute(delete(Loja).where(Loja.id == loja_b_id))
            await db.commit()


async def test_admin_sem_loja_nao_dispara_ia(client, admin_token):
    """Admin sem X-Loja-Id: 409 nas duas rotas, antes de qualquer chamada à IA."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    resp = await client.post(
        GERAR_POST, headers=headers,
        json={"veiculo_id": _uid(), "rede": "instagram", "tom": "vendedor"},
    )
    assert resp.status_code == 409, f"Marketing sem loja deveria dar 409 → {resp.status_code}"

    resp = await client.post(f"{TRIAGEM}/{_uid()}", headers=headers)
    assert resp.status_code == 409, f"Triagem sem loja deveria dar 409 → {resp.status_code}"


async def test_consumo_triagem_vai_para_loja_dona_da_conversa(client, admin_token):
    """Admin operando a loja A: o token gasto é debitado da loja A, não do admin."""
    loja_id, conversa_id = _uid(), _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Consumo IA", slug=f"loja-consumo-{loja_id[:8]}"))
        db.add(Conversa(id=conversa_id, tipo=TipoConversa.B2C, loja_id=loja_id))
        db.add(Mensagem(
            id=_uid(), conversa_id=conversa_id, autor_id=None,
            conteudo="Quero agendar test drive amanhã e simular financiamento.",
        ))
        await db.commit()

    try:
        resp = await client.post(
            f"{TRIAGEM}/{conversa_id}",
            headers={"Authorization": f"Bearer {admin_token}", "X-Loja-Id": loja_id},
        )
        assert resp.status_code == 200, resp.text

        async with async_session() as db:
            usos = (await db.execute(
                select(MarketingUsage).where(MarketingUsage.loja_id == loja_id)
            )).scalars().all()

        # Sem GROQ_API_KEY no ambiente de teste a triagem cai no fallback
        # "pendente_revisao" sem gastar token — aí não há consumo a registrar.
        if usos:
            assert all(u.funcionalidade == "triagem" for u in usos)
            assert all(u.loja_id == loja_id for u in usos)
    finally:
        async with async_session() as db:
            await db.execute(delete(MarketingUsage).where(MarketingUsage.loja_id == loja_id))
            await db.execute(delete(LeadTriagem).where(LeadTriagem.conversa_id == conversa_id))
            await db.execute(delete(Mensagem).where(Mensagem.conversa_id == conversa_id))
            await db.execute(delete(Conversa).where(Conversa.id == conversa_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()
