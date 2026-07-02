"""
Venda composta (Fechar Venda) — cliente novo no ato, trocas como pagamento
e excedente virando comissão do vendedor.

Regras cobertas (design 2026-07-02):
  - cliente_novo cria o ClientePF na mesma transação da venda;
  - cada troca vira Veiculo rascunho (origem=troca, custo=avaliação) apontando
    para o contrato da venda via contrato_origem_id;
  - receita financeira = só o que entra em caixa (dinheiro + financiado),
    nunca o valor das trocas;
  - composto > venda NÃO gera "volta ao cliente": o excedente soma na
    comissão automática do vendedor;
  - venda sem cliente_id e sem cliente_novo é rejeitada (422).
"""
import uuid

from sqlalchemy import delete, select

from database import async_session
from models import (
    ClientePF, ComissaoVenda, Contrato, EsteiraPosVenda, ItemChecklist,
    LancamentoFinanceiro, OrigemVeiculo, StatusVeiculo, TipoLancamento, Veiculo,
)


def _sufixo() -> str:
    return uuid.uuid4().hex[:8]


async def _criar_veiculo(client, token: str, preco_venda: float) -> dict:
    resp = await client.post(
        "/v1/veiculos",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "marca": "TESTE",
            "modelo": f"Venda Composta {_sufixo()}",
            "ano_fabricacao": 2020,
            "ano_modelo": 2021,
            "preco_venda": preco_venda,
        },
    )
    assert resp.status_code in (200, 201), f"Falha ao criar veículo de teste: {resp.status_code} {resp.text}"
    return resp.json()


async def _limpar_venda(veiculo_id: str, resultado: dict | None, cliente_nome: str | None = None):
    """Remove tudo que a venda composta criou (ordem respeita FKs)."""
    async with async_session() as db:
        contrato_id = (resultado or {}).get("contrato_id")
        esteira_id = (resultado or {}).get("esteira_id")
        trocas_ids = (resultado or {}).get("trocas_veiculo_ids") or []

        if esteira_id:
            await db.execute(delete(ItemChecklist).where(ItemChecklist.esteira_id == esteira_id))
            await db.execute(delete(EsteiraPosVenda).where(EsteiraPosVenda.id == esteira_id))
        await db.execute(delete(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo_id))
        await db.execute(delete(LancamentoFinanceiro).where(LancamentoFinanceiro.veiculo_id == veiculo_id))
        for tid in trocas_ids:
            await db.execute(delete(Veiculo).where(Veiculo.id == tid))
        if contrato_id:
            await db.execute(delete(Contrato).where(Contrato.id == contrato_id))
        await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
        if cliente_nome:
            await db.execute(delete(ClientePF).where(ClientePF.nome == cliente_nome))
        await db.commit()


async def test_venda_composta_cliente_novo_e_troca(client, gestor_token):
    """Cliente novo + troca + dinheiro + financiamento num ato só."""
    headers = {"Authorization": f"Bearer {gestor_token}"}
    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=32000.0)
    cliente_nome = f"Cliente Teste Composto {_sufixo()}"
    resultado = None

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=headers,
            json={
                "cliente_novo": {"nome": cliente_nome, "telefone": "(51) 99999-0000"},
                "valor_venda": 32000.0,
                "pagamento_dinheiro": 5000.0,
                "financiamento": {"valor": 15000.0, "parcelas": 48},
                "trocas": [{
                    "marca": "FIAT",
                    "modelo": "ARGO DRIVE 1.0",
                    "placa": "TST1A23",
                    "ano_fabricacao": 2019,
                    "ano_modelo": 2020,
                    "km": 45000,
                    "valor_avaliacao": 12000.0,
                }],
            },
        )
        assert resp.status_code == 200, f"Venda composta falhou: {resp.status_code} {resp.text}"
        resultado = resp.json()
        assert resultado["contrato_id"]
        assert len(resultado["trocas_veiculo_ids"]) == 1
        assert resultado["comissao_excedente"] is None  # composto == venda

        async with async_session() as db:
            # Cliente criado no ato, na loja do veículo
            cliente = (await db.execute(
                select(ClientePF).where(ClientePF.nome == cliente_nome)
            )).scalar_one()
            assert cliente.loja_id == veiculo["loja_id"]

            # Veículo vendido e fora da vitrine
            vendido = (await db.execute(
                select(Veiculo).where(Veiculo.id == veiculo["id"])
            )).scalar_one()
            assert vendido.status == StatusVeiculo.VENDIDO
            assert vendido.publicado_marketplace is False
            assert vendido.comprador_id == cliente.id

            # Troca virou rascunho no estoque, com custo = avaliação e rastreio
            troca = (await db.execute(
                select(Veiculo).where(Veiculo.id == resultado["trocas_veiculo_ids"][0])
            )).scalar_one()
            assert troca.origem == OrigemVeiculo.TROCA
            assert troca.status == StatusVeiculo.RASCUNHO
            assert troca.preco_custo == 12000.0
            assert troca.contrato_origem_id == resultado["contrato_id"]
            assert troca.publicado_marketplace is False

            # Receita = só o que entra em caixa (5.000 + 15.000), não os 32.000
            receita = (await db.execute(
                select(LancamentoFinanceiro).where(
                    LancamentoFinanceiro.veiculo_id == veiculo["id"],
                    LancamentoFinanceiro.tipo == TipoLancamento.RECEITA,
                )
            )).scalar_one()
            assert receita.valor == 20000.0

            # Contrato: entrada = dinheiro + troca; dação registrada
            contrato = (await db.execute(
                select(Contrato).where(Contrato.id == resultado["contrato_id"])
            )).scalar_one()
            assert contrato.valor_entrada == 17000.0
            assert contrato.parcelas == 48
            assert "Dação em pagamento" in (contrato.observacoes or "")
            assert "ARGO" in contrato.observacoes
    finally:
        await _limpar_venda(veiculo["id"], resultado, cliente_nome)


async def test_rolo_excedente_vira_comissao_sem_receita(client, gestor_token):
    """Trocas somam mais que a venda: excedente vai pra comissão, caixa fica intocado."""
    headers = {"Authorization": f"Bearer {gestor_token}"}
    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=32000.0)
    cliente_nome = f"Cliente Teste Rolo {_sufixo()}"
    resultado = None

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=headers,
            json={
                "cliente_novo": {"nome": cliente_nome},
                "valor_venda": 32000.0,
                "trocas": [
                    {"marca": "VW", "modelo": "GOL 1.6 MSI", "valor_avaliacao": 28000.0},
                    {"marca": "HONDA", "modelo": "CB 650R", "valor_avaliacao": 7000.0},
                ],
            },
        )
        assert resp.status_code == 200, f"Rolo falhou: {resp.status_code} {resp.text}"
        resultado = resp.json()
        assert len(resultado["trocas_veiculo_ids"]) == 2
        assert resultado["comissao_excedente"] == 3000.0

        async with async_session() as db:
            # Nada entrou em caixa → nenhum lançamento de receita
            receitas = (await db.execute(
                select(LancamentoFinanceiro).where(
                    LancamentoFinanceiro.veiculo_id == veiculo["id"],
                    LancamentoFinanceiro.tipo == TipoLancamento.RECEITA,
                )
            )).scalars().all()
            assert receitas == []

            # Excedente somado à comissão automática do vendedor
            comissao = (await db.execute(
                select(ComissaoVenda).where(ComissaoVenda.veiculo_id == veiculo["id"])
            )).scalar_one()
            esperado = round(32000.0 * (comissao.percentual / 100.0) + 3000.0, 2)
            assert comissao.valor_comissao == esperado
            assert comissao.pago is False
    finally:
        await _limpar_venda(veiculo["id"], resultado, cliente_nome)


async def test_venda_sem_cliente_rejeitada(client, gestor_token):
    """Sem cliente_id e sem cliente_novo → 422, e nada é gravado."""
    headers = {"Authorization": f"Bearer {gestor_token}"}
    veiculo = await _criar_veiculo(client, gestor_token, preco_venda=10000.0)

    try:
        resp = await client.post(
            f"/v1/veiculos/{veiculo['id']}/vender",
            headers=headers,
            json={"valor_venda": 10000.0},
        )
        assert resp.status_code == 422, f"Esperava 422, veio {resp.status_code}: {resp.text}"

        async with async_session() as db:
            intacto = (await db.execute(
                select(Veiculo).where(Veiculo.id == veiculo["id"])
            )).scalar_one()
            assert intacto.status != StatusVeiculo.VENDIDO
    finally:
        await _limpar_venda(veiculo["id"], None)
