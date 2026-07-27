"""Modelos de contrato entregues prontos (compra de PF e venda CDC).

Garante que a loja nasce com os modelos, que toda variável usada é resolvida
pelo backend e que o contrato sai redigido mesmo sem o gestor preencher os
campos extras — o motivo de existirem os `padrao`.
"""
import datetime
import json
import re
import uuid

import pytest
from jinja2 import Environment, meta

from contrato_modelos_padrao import MODELOS_PADRAO, semear_modelos_padrao
from database import async_session
from models import (
    ClientePF, Contrato, Loja, StatusContrato, TemplateContrato,
    TipoCombustivel, TipoContrato, Veiculo,
)
from routers.contratos import _render_template_contrato

_GRUPOS = {"cliente", "veiculo", "loja", "contrato"}


def _uid() -> str:
    return uuid.uuid4().hex[:32]


def _cenario_completo():
    """Loja/cliente/veículo com todos os campos preenchidos."""
    loja = Loja(
        nome="Auto Premium LTDA", slug="auto-premium", cnpj="12.345.678/0001-90",
        inscricao_estadual="123456789", endereco="Av. Brasil, 100",
        cidade="Porto Alegre", estado="RS", cep="90000-000",
        telefone="(51) 99999-0000", email="contato@autopremium.com.br",
        representante_nome="Victor Correia", representante_cpf="123.456.789-00",
        representante_rg="1234567 SSP/RS",
    )
    cliente = ClientePF(
        nome="Maria Silva", cpf="987.654.321-00", rg="7654321", telefone="(51) 98888-1111",
        email="maria@exemplo.com", endereco="Rua A, 20", cidade="Canoas", estado="RS",
        nacionalidade="brasileira", estado_civil="casada", profissao="engenheira",
        cnh="01234567890", cnh_categoria="B",
    )
    veiculo = Veiculo(
        marca="Fiat", modelo="Toro", versao="Freedom 1.8", ano_fabricacao=2021,
        ano_modelo=2022, placa="ABC1D23", chassi="9BD1234567890ABCD",
        renavam="12345678901", cor="Prata", km=52300, combustivel=TipoCombustivel.FLEX,
    )
    contrato = Contrato(
        numero="CT-0001", valor_venda=125900.0, valor_entrada=30000.0, parcelas=48,
        created_at=datetime.datetime(2026, 7, 26),
    )
    contrato.veiculo = veiculo
    contrato.cliente = cliente
    return loja, contrato


@pytest.mark.parametrize("nome", list(MODELOS_PADRAO))
def test_variaveis_do_modelo_sao_resolvidas(nome):
    """Nenhuma variável do modelo fica órfã: ou é grupo do sistema, ou campo extra."""
    html, campos = MODELOS_PADRAO[nome]
    usadas = meta.find_undeclared_variables(Environment().parse(html))
    declaradas = {c["chave"] for c in campos}
    assert (usadas - _GRUPOS) <= declaradas, f"variáveis sem campo extra: {usadas - _GRUPOS - declaradas}"
    assert declaradas <= usadas, f"campos extras não usados no texto: {declaradas - usadas}"


@pytest.mark.parametrize("nome", list(MODELOS_PADRAO))
def test_render_sem_campos_extras_usa_padroes(nome):
    """Gestor não preencheu nada: o contrato sai redigido, não com buracos."""
    html, campos = MODELOS_PADRAO[nome]
    loja, contrato = _cenario_completo()
    template = TemplateContrato(nome=nome, conteudo_html=html, campos_extras=json.dumps(campos))

    corpo = _render_template_contrato(template, contrato, loja)
    # Linhas de assinatura e a de dados bancários do vendedor são lacuna por
    # definição — só a loja/vendedor tem esses dados no ato da assinatura.
    clausulas = corpo.split("<strong>TESTEMUNHAS")[0]
    clausulas = "\n".join(
        linha for linha in clausulas.splitlines()
        if not linha.startswith("<p>_____") and "Dados Bancários" not in linha
    )

    assert "___________" not in clausulas, "sobrou lacuna numa cláusula"
    assert "{{" not in corpo and "Undefined" not in corpo
    # Valores usuais entregues prontos
    if "CDC" in nome:
        assert "prazo de 90 dias" in re.sub(r"<[^>]+>", "", corpo)
    assert "10%" in re.sub(r"<[^>]+>", "", corpo)


def test_valor_e_data_por_extenso_no_contrato():
    nome = "Venda ao Consumidor — CDC (padrão)"
    html, campos = MODELOS_PADRAO[nome]
    loja, contrato = _cenario_completo()
    template = TemplateContrato(nome=nome, conteudo_html=html, campos_extras=json.dumps(campos))

    texto = re.sub(r"<[^>]+>", "", _render_template_contrato(template, contrato, loja))
    assert "R$ 125.900,00 (cento e vinte e cinco mil e novecentos reais)" in texto
    assert "26 de julho de 2026" in texto


def test_foro_cai_na_cidade_da_loja():
    """Modelo de compra elege o foro da loja quando a comarca não é informada."""
    nome = "Compra de Veículo — Pessoa Física (padrão)"
    html, campos = MODELOS_PADRAO[nome]
    loja, contrato = _cenario_completo()
    template = TemplateContrato(nome=nome, conteudo_html=html, campos_extras=json.dumps(campos))

    texto = re.sub(r"<[^>]+>", "", _render_template_contrato(template, contrato, loja))
    assert "Foro da Comarca de Porto Alegre - RS" in texto


@pytest.mark.asyncio
async def test_semear_modelos_padrao_e_idempotente():
    async with async_session() as db:
        loja_id = _uid()
        db.add(Loja(id=loja_id, nome="Loja Seed", slug=f"loja-seed-{loja_id[:8]}"))
        await db.flush()

        assert await semear_modelos_padrao(db, loja_id) == len(MODELOS_PADRAO)
        await db.commit()

        # Segunda passada não duplica.
        assert await semear_modelos_padrao(db, loja_id) == 0
        await db.commit()

        from sqlalchemy import select
        res = await db.execute(
            select(TemplateContrato.nome).where(TemplateContrato.loja_id == loja_id)
        )
        nomes = res.scalars().all()
        assert sorted(nomes) == sorted(MODELOS_PADRAO)

        from sqlalchemy import delete
        await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
        await db.execute(delete(Loja).where(Loja.id == loja_id))
        await db.commit()


@pytest.mark.asyncio
async def test_loja_criada_pelo_admin_ja_tem_os_modelos(client, admin_token):
    """Cadastro de loja pelo painel do admin entrega os contratos prontos."""
    sufixo = uuid.uuid4().hex[:8]
    resp = await client.post(
        "/v1/admin/lojas",
        json={
            "nome": f"Loja Nova {sufixo}",
            "cnpj": None,
            "cidade": "Canoas",
            "estado": "RS",
            "gestor_nome": "Gestor Novo",
            "gestor_email": f"gestor.{sufixo}@teste.com",
            "gestor_senha": "senha-forte-123",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    loja_id = resp.json()["id"]

    async with async_session() as db:
        from sqlalchemy import delete, select
        nomes = (await db.execute(
            select(TemplateContrato.nome).where(TemplateContrato.loja_id == loja_id)
        )).scalars().all()
        assert sorted(nomes) == sorted(MODELOS_PADRAO)

        from models import MembroLoja, Usuario
        gestor_ids = (await db.execute(
            select(MembroLoja.usuario_id).where(MembroLoja.loja_id == loja_id)
        )).scalars().all()
        await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
        await db.execute(delete(MembroLoja).where(MembroLoja.loja_id == loja_id))
        await db.execute(delete(Loja).where(Loja.id == loja_id))
        if gestor_ids:
            await db.execute(delete(Usuario).where(Usuario.id.in_(gestor_ids)))
        await db.commit()


@pytest.mark.asyncio
async def test_contrato_real_renderiza_modelo_padrao(client):
    """Render de ponta a ponta com o modelo semeado e um contrato persistido."""
    async with async_session() as db:
        loja_id, cliente_id, veiculo_id, contrato_id = _uid(), _uid(), _uid(), _uid()
        db.add(Loja(
            id=loja_id, nome="Loja Render", slug=f"loja-render-{loja_id[:8]}",
            cidade="Canoas", estado="RS",
        ))
        db.add(ClientePF(id=cliente_id, loja_id=loja_id, nome="João Souza", cpf="111.222.333-44"))
        db.add(Veiculo(
            id=veiculo_id, loja_id=loja_id, marca="VW", modelo="Gol",
            ano_fabricacao=2020, ano_modelo=2021, chassi="9BW111222333444", renavam="99988877766",
        ))
        db.add(Contrato(
            id=contrato_id, loja_id=loja_id, cliente_id=cliente_id, veiculo_id=veiculo_id,
            numero="CT-RENDER", tipo=TipoContrato.COMPRA_VENDA, status=StatusContrato.RASCUNHO,
            valor_venda=48000.0,
        ))
        await db.flush()
        await semear_modelos_padrao(db, loja_id)
        await db.commit()

        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        template = (await db.execute(
            select(TemplateContrato).where(
                TemplateContrato.loja_id == loja_id,
                TemplateContrato.nome == "Venda ao Consumidor — CDC (padrão)",
            )
        )).scalar_one()
        contrato = (await db.execute(
            select(Contrato)
            .options(selectinload(Contrato.cliente), selectinload(Contrato.veiculo))
            .where(Contrato.id == contrato_id)
        )).scalar_one()
        loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one()

        texto = re.sub(r"<[^>]+>", "", _render_template_contrato(template, contrato, loja))
        assert "João Souza" in texto
        assert "9BW111222333444" in texto            # chassi vindo do estoque
        assert "quarenta e oito mil reais" in texto  # valor por extenso
        assert "prazo de 90 dias" in texto           # padrão do campo extra

        from sqlalchemy import delete
        await db.execute(delete(Contrato).where(Contrato.id == contrato_id))
        await db.execute(delete(TemplateContrato).where(TemplateContrato.loja_id == loja_id))
        await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_id))
        await db.execute(delete(ClientePF).where(ClientePF.id == cliente_id))
        await db.execute(delete(Loja).where(Loja.id == loja_id))
        await db.commit()
