import pytest
from fiscal_gateway import montar_payload_venda
from models import ConfiguracaoFiscal, Loja, ClientePF, Veiculo

def test_montar_payload_venda_pf():
    config = ConfiguracaoFiscal(
        natureza_operacao="Venda de veículo",
        cfop_venda="5102",
        origem_mercadoria="0",
        csosn="102",
        ncm_padrao="87032310"
    )
    loja = Loja(cnpj="12345678000199")
    cliente = ClientePF(nome="Cliente Teste PF", cpf="123.456.789-00")
    veiculo = Veiculo(id="vei-123", marca="Fiat", modelo="Uno", ano_modelo=2020)
    
    payload = montar_payload_venda(config, loja, cliente, veiculo, 15000.0)
    
    assert payload["nome_destinatario"] == "Cliente Teste PF"
    assert payload["cpf_destinatario"] == "123.456.789-00"
    assert "cnpj_destinatario" not in payload

def test_montar_payload_venda_pj():
    config = ConfiguracaoFiscal(
        natureza_operacao="Venda de veículo",
        cfop_venda="5102",
        origem_mercadoria="0",
        csosn="102",
        ncm_padrao="87032310"
    )
    loja = Loja(cnpj="12345678000199")
    cliente = ClientePF(nome="Cliente Teste PJ", cnpj="98.765.432/0001-99", cpf=None)
    veiculo = Veiculo(id="vei-123", marca="Fiat", modelo="Uno", ano_modelo=2020)
    
    payload = montar_payload_venda(config, loja, cliente, veiculo, 15000.0)
    
    assert payload["nome_destinatario"] == "Cliente Teste PJ"
    assert payload.get("cnpj_destinatario") == "98.765.432/0001-99"

@pytest.mark.asyncio
async def test_query_parameter_auth(client):
    from database import async_session
    from models import Loja, Usuario, MembroLoja, PapelUsuario
    from auth import create_access_token
    import uuid

    loja_id = uuid.uuid4().hex[:32]
    gestor_id = uuid.uuid4().hex[:32]
    membro_id = uuid.uuid4().hex[:32]

    async with async_session() as db:
        db.add(Loja(id=loja_id, nome="Loja Query Auth", slug=f"loja-q-{loja_id[:8]}", ativa=True))
        db.add(Usuario(
            id=gestor_id,
            nome="Gestor Query Auth",
            email=f"gestor_q_{gestor_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.GESTOR,
            ativo=True,
        ))
        db.add(MembroLoja(
            id=membro_id, usuario_id=gestor_id, loja_id=loja_id,
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_id, "email": f"gestor_q_{gestor_id[:8]}@teste.com", "papel": PapelUsuario.GESTOR.value}
    )

    try:
        # Request without header but with query token parameter
        resp = await client.get(f"/v1/fiscal/config?token={token}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["configurada"] is False
    finally:
        async with async_session() as db:
            from sqlalchemy import delete
            from models import ConfiguracaoFiscal
            await db.execute(delete(ConfiguracaoFiscal).where(ConfiguracaoFiscal.loja_id == loja_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_id))
            await db.execute(delete(Loja).where(Loja.id == loja_id))
            await db.commit()

