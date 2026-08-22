"""Contrato B2B do admin: variáveis resolvidas do banco, PDF e envio por e-mail.

Cobre a regressão que motivou a mudança: o editor do admin passava
`variaveis={[]}` e nada puxava os dados do lojista, então o contrato saía com
`{{loja.cnpj}}` cru no texto.
"""
import uuid

import pytest
from sqlalchemy import delete

from auth import create_access_token
from database import async_session
from models import (
    Assinatura,
    ContratoAssinaturaVersao,
    Loja,
    MembroLoja,
    PapelUsuario,
    Plano,
    StatusAssinatura,
    Usuario,
)
from routers.admin import aplicar_variaveis_contrato

MODELO = (
    "<p>{{plataforma.nome}} e {{loja.nome}}, CNPJ {{loja.cnpj}}, "
    "sede {{loja.cidade}}/{{loja.estado}}, rep. por {{responsavel.nome}}. "
    "Plano {{plano.nome}} por {{assinatura.valor_mensal}}.</p>"
)


def _uid() -> str:
    return uuid.uuid4().hex[:32]


@pytest.fixture
async def cenario():
    """Loja com gestor, plano e assinatura + uma versão de contrato."""
    ids = {k: _uid() for k in ("loja", "admin", "gestor", "membro", "plano", "assinatura", "versao")}
    email_admin = f"admin_{ids['admin'][:8]}@teste.com"
    email_gestor = f"gestor_{ids['gestor'][:8]}@teste.com"

    async with async_session() as db:
        db.add(Loja(
            id=ids["loja"], nome="Loja Contrato", slug=f"loja-contrato-{ids['loja'][:8]}",
            cnpj="11.222.333/0001-44", cidade="Porto Alegre", estado="RS",
            endereco="Rua das Flores, 42", email="contato@lojacontrato.com.br",
        ))
        db.add(Usuario(
            id=ids["admin"], nome="Admin", email=email_admin, senha_hash="hash",
            papel=PapelUsuario.ADMIN_PLATAFORMA, ativo=True,
        ))
        db.add(Usuario(
            id=ids["gestor"], nome="Maria Gestora", email=email_gestor, senha_hash="hash",
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        db.add(MembroLoja(
            id=ids["membro"], usuario_id=ids["gestor"], loja_id=ids["loja"],
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        db.add(Plano(
            id=ids["plano"], nome="Profissional", preco_mensal=299.90,
            modulos_incluidos='["contratos", "simulador"]', ativo=True,
        ))
        db.add(Assinatura(
            id=ids["assinatura"], loja_id=ids["loja"], plano_id=ids["plano"],
            status=StatusAssinatura.ATIVA, valor_mensal=249.90,
        ))
        db.add(ContratoAssinaturaVersao(
            id=ids["versao"], versao=f"T-{ids['versao'][:6]}", conteudo_html=MODELO,
            vigente=False, criado_por_admin_id=ids["admin"],
        ))
        await db.commit()

    token = create_access_token(data={
        "sub": ids["admin"], "email": email_admin, "papel": PapelUsuario.ADMIN_PLATAFORMA.value, "typ": "access",
    })
    yield {"ids": ids, "headers": {"Authorization": f"Bearer {token}"}}

    async with async_session() as db:
        from models import LogAuditoria
        await db.execute(delete(LogAuditoria).where(LogAuditoria.loja_id == ids["loja"]))
        await db.execute(delete(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.id == ids["versao"]))
        await db.execute(delete(Assinatura).where(Assinatura.id == ids["assinatura"]))
        await db.execute(delete(Plano).where(Plano.id == ids["plano"]))
        await db.execute(delete(MembroLoja).where(MembroLoja.id == ids["membro"]))
        await db.execute(delete(Usuario).where(Usuario.id.in_([ids["admin"], ids["gestor"]])))
        await db.execute(delete(Loja).where(Loja.id == ids["loja"]))
        await db.commit()


@pytest.mark.asyncio
async def test_variaveis_trazem_dados_reais_da_loja(client, cenario):
    r = await client.get(
        "/v1/admin/contrato-assinatura/variaveis",
        params={"loja_id": cenario["ids"]["loja"]},
        headers=cenario["headers"],
    )
    assert r.status_code == 200, r.text
    valores = {v["chave"]: v["valor"] for v in r.json()["variaveis"]}

    assert valores["loja.nome"] == "Loja Contrato"
    assert valores["loja.cnpj"] == "11.222.333/0001-44"
    assert valores["loja.cidade"] == "Porto Alegre"
    assert valores["responsavel.nome"] == "Maria Gestora"
    assert valores["plano.nome"] == "Profissional"
    # valor_mensal da assinatura tem precedência sobre o preço de tabela do plano
    assert valores["assinatura.valor_mensal"] == "R$ 249,90"
    assert "Contratos" in valores["plano.modulos"]


@pytest.mark.asyncio
async def test_variaveis_sem_loja_nao_vazam_chave_crua(client, cenario):
    r = await client.get("/v1/admin/contrato-assinatura/variaveis", headers=cenario["headers"])
    assert r.status_code == 200
    valores = {v["chave"]: v["valor"] for v in r.json()["variaveis"]}
    assert "{{" not in valores["loja.nome"]
    assert valores["plataforma.nome"]  # não depende da loja


@pytest.mark.asyncio
async def test_preview_substitui_todas_as_variaveis(client, cenario):
    r = await client.post(
        "/v1/admin/contrato-assinatura/preview",
        json={"conteudo_html": MODELO, "loja_id": cenario["ids"]["loja"]},
        headers=cenario["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nao_resolvidas"] == []
    assert "{{" not in body["conteudo_html"]
    assert "Loja Contrato" in body["conteudo_html"]
    assert "Maria Gestora" in body["conteudo_html"]


@pytest.mark.asyncio
async def test_preview_reporta_variavel_desconhecida(client, cenario):
    r = await client.post(
        "/v1/admin/contrato-assinatura/preview",
        json={"conteudo_html": "<p>{{loja.nome}} {{foo.bar}}</p>", "loja_id": cenario["ids"]["loja"]},
        headers=cenario["headers"],
    )
    assert r.status_code == 200
    assert r.json()["nao_resolvidas"] == ["foo.bar"]


def test_valores_sao_escapados_no_html():
    """Nome com & não pode quebrar o HTML do contrato."""
    html, _ = aplicar_variaveis_contrato("<p>{{loja.nome}}</p>", {"loja.nome": "Auto & Cia <b>"})
    assert "&amp;" in html
    assert "<b>" not in html


@pytest.mark.asyncio
async def test_documento_gera_pdf(client, cenario):
    r = await client.get(
        "/v1/admin/contrato-assinatura/documento",
        params={"loja_id": cenario["ids"]["loja"], "versao_id": cenario["ids"]["versao"]},
        headers=cenario["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


@pytest.mark.asyncio
async def test_documento_formato_html_para_impressao(client, cenario):
    r = await client.get(
        "/v1/admin/contrato-assinatura/documento",
        params={
            "loja_id": cenario["ids"]["loja"],
            "versao_id": cenario["ids"]["versao"],
            "formato": "html",
        },
        headers=cenario["headers"],
    )
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Loja Contrato" in r.text
    assert "{{" not in r.text


@pytest.mark.asyncio
async def test_documento_versao_inexistente_404(client, cenario):
    r = await client.get(
        "/v1/admin/contrato-assinatura/documento",
        params={"versao_id": "nao-existe"},
        headers=cenario["headers"],
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_enviar_usa_email_da_loja(client, cenario):
    r = await client.post(
        "/v1/admin/contrato-assinatura/enviar",
        json={"loja_id": cenario["ids"]["loja"], "versao_id": cenario["ids"]["versao"]},
        headers=cenario["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enviado"] is True
    assert body["email"] == "contato@lojacontrato.com.br"


@pytest.mark.asyncio
async def test_enviar_aceita_destinatario_explicito(client, cenario):
    r = await client.post(
        "/v1/admin/contrato-assinatura/enviar",
        json={
            "loja_id": cenario["ids"]["loja"],
            "versao_id": cenario["ids"]["versao"],
            "email": "juridico@outracasa.com.br",
            "mensagem": "Segue para assinatura.",
        },
        headers=cenario["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "juridico@outracasa.com.br"


@pytest.mark.asyncio
async def test_endpoints_exigem_admin_plataforma(client, cenario):
    """Gestor não pode ler nem enviar o contrato B2B da plataforma."""
    token_gestor = create_access_token(data={
        "sub": cenario["ids"]["gestor"],
        "email": "gestor@x.com",
        "papel": PapelUsuario.GESTOR.value,
        "typ": "access",
    })
    headers = {"Authorization": f"Bearer {token_gestor}"}

    r = await client.get("/v1/admin/contrato-assinatura/variaveis", headers=headers)
    assert r.status_code == 403

    r = await client.post(
        "/v1/admin/contrato-assinatura/enviar",
        json={"loja_id": cenario["ids"]["loja"]},
        headers=headers,
    )
    assert r.status_code == 403
