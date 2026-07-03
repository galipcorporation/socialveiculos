"""
Testes de regressão de isolamento multi-tenant.

Garante que:
(a) Veículos/Estoque: Gestor da loja A não pode ler, editar ou deletar veículos da loja B (esperar 404).
(b) Chat/Conversas B2B: Gestor da loja A não acessa conversas ou mensagens da loja B.
(c) Configurações/Credenciais Bancárias: Credencial da loja B é invisível para a loja A.

Esses testes são totalmente independentes de banco de dados previamente seedado,
criando dinamicamente seus próprios tenants, usuários gestores e tokens de acesso.
"""
import uuid
import json
import pytest
from sqlalchemy import delete

from database import async_session
from models import (
    Loja,
    Veiculo,
    Conversa,
    Mensagem,
    CredencialBanco,
    CredencialDetran,
    TipoConversa,
    StatusVeiculo,
    BancoSimulador,
    Usuario,
    MembroLoja,
    PapelUsuario
)
from auth import create_access_token
from simulador.crypt import encrypt_credentials

def _uid() -> str:
    return uuid.uuid4().hex[:32]

@pytest.mark.asyncio
async def test_veiculo_isolamento_tenant(client):
    """Gestor da loja A tenta ler, editar ou deletar veículo da loja B -> 404."""
    loja_a_id = _uid()
    gestor_a_id = _uid()
    membro_a_id = _uid()

    loja_b_id = _uid()
    veiculo_b_id = _uid()

    async with async_session() as db:
        # Cria Loja A e Gestor A para gerar o token do solicitante
        db.add(Loja(id=loja_a_id, nome="Loja A (isolamento)", slug=f"loja-a-{loja_a_id[:8]}"))
        db.add(Usuario(
            id=gestor_a_id,
            nome="Gestor A",
            email=f"gestor_a_{gestor_a_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))
        db.add(MembroLoja(
            id=membro_a_id,
            usuario_id=gestor_a_id,
            loja_id=loja_a_id,
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))

        # Cria Loja B e Veículo B
        db.add(Loja(id=loja_b_id, nome="Loja B (isolamento)", slug=f"loja-b-{loja_b_id[:8]}"))
        db.add(Veiculo(
            id=veiculo_b_id,
            loja_id=loja_b_id,
            marca="Chevrolet",
            modelo="Onix",
            ano_fabricacao=2020,
            ano_modelo=2021,
            km=10000,
            preco_venda=65000.0,
            preco_custo=50000.0,
            status=StatusVeiculo.DISPONIVEL
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_a_id, "email": f"gestor_a_{gestor_a_id[:8]}@teste.com", "papel": PapelUsuario.GESTOR.value}
    )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # 1. Ler (GET) -> Espera 404
        resp_get = await client.get(f"/v1/veiculos/{veiculo_b_id}", headers=headers)
        assert resp_get.status_code == 404, (
            f"Vazamento (GET veiculo): gestor acessou veiculo de outra loja -> {resp_get.status_code} {resp_get.text}"
        )

        # 2. Editar (PATCH) -> Espera 404
        resp_patch = await client.patch(
            f"/v1/veiculos/{veiculo_b_id}",
            json={"km": 15000},
            headers=headers
        )
        assert resp_patch.status_code == 404, (
            f"Vazamento (PATCH veiculo): gestor editou veiculo de outra loja -> {resp_patch.status_code} {resp_patch.text}"
        )

        # 3. Deletar (DELETE) -> Espera 404
        resp_delete = await client.delete(f"/v1/veiculos/{veiculo_b_id}", headers=headers)
        assert resp_delete.status_code == 404, (
            f"Vazamento (DELETE veiculo): gestor deletou veiculo de outra loja -> {resp_delete.status_code} {resp_delete.text}"
        )

    finally:
        async with async_session() as db:
            await db.execute(delete(Veiculo).where(Veiculo.id == veiculo_b_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()

@pytest.mark.asyncio
async def test_chat_b2b_isolamento_tenant(client):
    """Gestor da loja A tenta acessar conversa ou enviar mensagem de outra conversa B2B (loja B <-> loja C) -> 404."""
    loja_a_id = _uid()
    gestor_a_id = _uid()
    membro_a_id = _uid()

    loja_b_id = _uid()
    loja_c_id = _uid()
    conversa_id = _uid()
    mensagem_id = _uid()

    async with async_session() as db:
        # Cria Loja A e Gestor A para gerar o token do solicitante
        db.add(Loja(id=loja_a_id, nome="Loja A (isolamento)", slug=f"loja-a-{loja_a_id[:8]}"))
        db.add(Usuario(
            id=gestor_a_id,
            nome="Gestor A",
            email=f"gestor_a_{gestor_a_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))
        db.add(MembroLoja(
            id=membro_a_id,
            usuario_id=gestor_a_id,
            loja_id=loja_a_id,
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))

        # Cria Lojas B e C
        db.add(Loja(id=loja_b_id, nome="Loja B", slug=f"loja-b-{loja_b_id[:8]}"))
        db.add(Loja(id=loja_c_id, nome="Loja C", slug=f"loja-c-{loja_c_id[:8]}"))
        # Cria Conversa B2B entre B e C
        db.add(Conversa(
            id=conversa_id,
            tipo=TipoConversa.B2B,
            loja_a_id=loja_b_id,
            loja_b_id=loja_c_id,
            ativa=True
        ))
        # Cria Mensagem nessa conversa
        db.add(Mensagem(
            id=mensagem_id,
            conversa_id=conversa_id,
            autor_id=None,
            conteudo="Mensagem secreta B2B"
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_a_id, "email": f"gestor_a_{gestor_a_id[:8]}@teste.com", "papel": PapelUsuario.GESTOR.value}
    )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # 1. Ler mensagens (GET) -> Espera 404
        resp_get = await client.get(f"/v1/b2b/chat/conversas/{conversa_id}/mensagens", headers=headers)
        assert resp_get.status_code == 404, (
            f"Vazamento (GET mensagens B2B): gestor acessou chat de outra loja -> {resp_get.status_code} {resp_get.text}"
        )

        # 2. Enviar mensagem (POST) -> Espera 404
        resp_post = await client.post(
            f"/v1/b2b/chat/conversas/{conversa_id}/mensagens",
            json={"conteudo": "Ataque IDOR"},
            headers=headers
        )
        assert resp_post.status_code == 404, (
            f"Vazamento (POST mensagens B2B): gestor enviou mensagem em chat de outra loja -> {resp_post.status_code} {resp_post.text}"
        )

    finally:
        async with async_session() as db:
            await db.execute(delete(Mensagem).where(Mensagem.conversa_id == conversa_id))
            await db.execute(delete(Conversa).where(Conversa.id == conversa_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id, loja_c_id])))
            await db.commit()

@pytest.mark.asyncio
async def test_credencial_banco_isolamento_tenant(client):
    """Gestor da loja A lista credenciais bancárias -> credencial da loja B não deve vir no payload."""
    loja_a_id = _uid()
    gestor_a_id = _uid()
    membro_a_id = _uid()

    loja_b_id = _uid()
    credencial_b_id = _uid()

    # Encripta a credencial fictícia no padrão do sistema
    crypted = encrypt_credentials(json.dumps({"usuario": "user_b", "senha": "password_b"}))

    async with async_session() as db:
        # Cria Loja A e Gestor A para gerar o token do solicitante
        db.add(Loja(id=loja_a_id, nome="Loja A (isolamento)", slug=f"loja-a-{loja_a_id[:8]}"))
        db.add(Usuario(
            id=gestor_a_id,
            nome="Gestor A",
            email=f"gestor_a_{gestor_a_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))
        db.add(MembroLoja(
            id=membro_a_id,
            usuario_id=gestor_a_id,
            loja_id=loja_a_id,
            papel=PapelUsuario.GESTOR,
            ativo=True
        ))

        # Cria Loja B
        db.add(Loja(id=loja_b_id, nome="Loja B", slug=f"loja-b-{loja_b_id[:8]}"))
        # Cria CredencialBanco para a Loja B
        db.add(CredencialBanco(
            id=credencial_b_id,
            loja_id=loja_b_id,
            usuario_id=None,
            banco=BancoSimulador.BV,
            credenciais_cifradas=crypted,
            ativo=True
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_a_id, "email": f"gestor_a_{gestor_a_id[:8]}@teste.com", "papel": PapelUsuario.GESTOR.value}
    )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Listar credenciais (GET)
        resp = await client.get("/v1/configuracoes/credenciais_banco", headers=headers)
        assert resp.status_code == 200, f"Falha ao listar credenciais bancárias -> {resp.status_code} {resp.text}"

        credenciais_listadas = resp.json()
        ids_listados = [c["id"] for c in credenciais_listadas]

        # A credencial da Loja B NÃO deve estar na lista da Loja A
        assert credencial_b_id not in ids_listados, (
            f"Vazamento (CredencialBanco): gestor da loja A visualizou credencial da loja B ({credencial_b_id})"
        )

    finally:
        async with async_session() as db:
            await db.execute(delete(CredencialBanco).where(CredencialBanco.id == credencial_b_id))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()


@pytest.mark.asyncio
async def test_credencial_detran_isolamento_tenant(client):
    """Gestor da loja A consulta o fornecedor DETRAN -> vê o SEU fornecedor,
    nunca o da loja B; loja sem credencial retorna configurada=false."""
    loja_a_id = _uid()
    gestor_a_id = _uid()
    membro_a_id = _uid()

    loja_b_id = _uid()

    crypted = encrypt_credentials("chave-secreta-loja-b")

    async with async_session() as db:
        db.add(Loja(id=loja_a_id, nome="Loja A (detran)", slug=f"loja-a-{loja_a_id[:8]}"))
        db.add(Usuario(
            id=gestor_a_id,
            nome="Gestor A",
            email=f"gestor_a_{gestor_a_id[:8]}@teste.com",
            senha_hash="hash_fake",
            papel=PapelUsuario.GESTOR,
            ativo=True,
        ))
        db.add(MembroLoja(
            id=membro_a_id, usuario_id=gestor_a_id, loja_id=loja_a_id,
            papel=PapelUsuario.GESTOR, ativo=True,
        ))
        # Loja B com fornecedor DETRAN configurado
        db.add(Loja(id=loja_b_id, nome="Loja B", slug=f"loja-b-{loja_b_id[:8]}"))
        db.add(CredencialDetran(
            loja_id=loja_b_id,
            api_url="https://fornecedor-secreto-da-loja-b.com",
            api_key_cifrada=crypted,
            ativo=True,
        ))
        await db.commit()

    token = create_access_token(
        data={"sub": gestor_a_id, "email": f"gestor_a_{gestor_a_id[:8]}@teste.com", "papel": PapelUsuario.GESTOR.value}
    )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Loja A ainda não configurou -> configurada=false, sem vazar a URL da B
        resp = await client.get("/v1/configuracoes/credenciais-detran", headers=headers)
        assert resp.status_code == 200, f"GET detran falhou -> {resp.status_code} {resp.text}"
        data = resp.json()
        assert data["configurada"] is False, "Loja A não configurou, mas veio configurada=true"
        assert data.get("api_url") != "https://fornecedor-secreto-da-loja-b.com", (
            "Vazamento (CredencialDetran): loja A enxergou a URL do fornecedor da loja B"
        )
    finally:
        async with async_session() as db:
            await db.execute(delete(CredencialDetran).where(CredencialDetran.loja_id.in_([loja_a_id, loja_b_id])))
            await db.execute(delete(MembroLoja).where(MembroLoja.id == membro_a_id))
            await db.execute(delete(Usuario).where(Usuario.id == gestor_a_id))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a_id, loja_b_id])))
            await db.commit()
