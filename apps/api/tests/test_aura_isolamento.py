"""
AURA (M124) — testes das fronteiras da seção 8 da spec.

Cada item de "o que a AURA nunca faz" vira um teste aqui:
(a) não atravessa a fronteira da loja — busca só enxerga o estoque próprio;
(b) não atravessa a fronteira do papel — vendedor sem módulo financeiro não vê custo;
(c) não expõe custo alheio — margem de parceiro fica fora até para o gestor;
(d) conversa privada por pessoa — gestor não alcança a mensagem do vendedor;
(e) gate comercial — sem o módulo `assistente_ia`, 402;
(f) cota — estourou o teto do mês, 429 antes de gastar token.

Os testes de busca chamam o motor direto: não há chamada de IA no caminho, de
propósito — a busca é determinística (ADR-2).
"""
import uuid

import pytest
from sqlalchemy import delete, select

from aura.busca import buscar_veiculos
from aura.interpretador import CriteriosBusca
from aura.permissoes import EscopoAura
from auth import create_access_token
from database import async_session
from models import (
    AURA_AUTOR_AURA,
    AURA_AUTOR_USUARIO,
    Assinatura,
    AuraConversa,
    AuraMensagem,
    Loja,
    MembroLoja,
    ModuloHabilitado,
    PapelUsuario,
    Plano,
    PublicacaoB2B,
    StatusAssinatura,
    StatusVeiculo,
    Usuario,
    Veiculo,
    utcnow,
)


def _uid() -> str:
    return uuid.uuid4().hex[:32]


def _escopo(*, papel=PapelUsuario.GESTOR, custo=True) -> EscopoAura:
    return EscopoAura(
        papel=papel,
        ve_custo_e_margem=custo,
        ve_financeiro=custo,
        ve_comissao_de_terceiros=papel == PapelUsuario.GESTOR,
        ve_equipe=papel == PapelUsuario.GESTOR,
        edita_memoria_da_loja=papel == PapelUsuario.GESTOR,
    )


def _veiculo(loja_id: str, **campos) -> Veiculo:
    padrao = dict(
        id=_uid(),
        loja_id=loja_id,
        marca="Toyota",
        modelo="Corolla",
        ano_fabricacao=2021,
        ano_modelo=2022,
        km=40000,
        cor="prata",
        preco_venda=120000.0,
        preco_custo=100000.0,
        status=StatusVeiculo.DISPONIVEL,
    )
    padrao.update(campos)
    return Veiculo(**padrao)


# ─────────────────────────────────────────────────────────────
# (a) Fronteira da loja
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_busca_nao_atravessa_a_fronteira_da_loja():
    """Veículo da loja B nunca aparece no estoque próprio da loja A."""
    loja_a, loja_b = _uid(), _uid()
    v_a, v_b = _uid(), _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_a, nome="Loja A (aura)", slug=f"aura-a-{loja_a[:8]}", cidade="Uberlândia", estado="MG"))
        db.add(Loja(id=loja_b, nome="Loja B (aura)", slug=f"aura-b-{loja_b[:8]}", cidade="Uberaba", estado="MG"))
        db.add(_veiculo(loja_a, id=v_a))
        db.add(_veiculo(loja_b, id=v_b))
        await db.commit()

    try:
        async with async_session() as db:
            loja = await db.get(Loja, loja_a)
            resultado = await buscar_veiculos(
                db=db, loja_id=loja_a, loja=loja,
                criterios=CriteriosBusca(modelo="Corolla"), escopo=_escopo(),
            )
        ids = {v.id for v in resultado.proprios}
        assert v_a in ids, "A busca não achou o veículo da própria loja."
        assert v_b not in ids, "VAZAMENTO: veículo de outra loja apareceu no estoque próprio."
    finally:
        async with async_session() as db:
            await db.execute(delete(Veiculo).where(Veiculo.id.in_([v_a, v_b])))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a, loja_b])))
            await db.commit()


@pytest.mark.asyncio
async def test_repasse_exclui_a_propria_loja_e_ordena_por_proximidade():
    """
    O feed de parceiros nunca devolve a publicação da própria loja, e o parceiro
    da mesma cidade vem antes do de outro estado (passo 5, v1).
    """
    loja_a, loja_mesma_cidade, loja_outro_estado = _uid(), _uid(), _uid()
    v_a, v_perto, v_longe = _uid(), _uid(), _uid()
    pub_a, pub_perto, pub_longe = _uid(), _uid(), _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_a, nome="Loja A (aura)", slug=f"aura-a-{loja_a[:8]}", cidade="Uberlândia", estado="MG"))
        db.add(Loja(id=loja_mesma_cidade, nome="Parceiro Perto", slug=f"aura-p-{loja_mesma_cidade[:8]}", cidade="Uberlândia", estado="MG"))
        db.add(Loja(id=loja_outro_estado, nome="Parceiro Longe", slug=f"aura-l-{loja_outro_estado[:8]}", cidade="Curitiba", estado="PR"))

        for veiculo_id, loja_id in ((v_a, loja_a), (v_perto, loja_mesma_cidade), (v_longe, loja_outro_estado)):
            db.add(_veiculo(loja_id, id=veiculo_id, status=StatusVeiculo.REPASSE))
        for pub_id, loja_id, veiculo_id in (
            (pub_a, loja_a, v_a), (pub_perto, loja_mesma_cidade, v_perto), (pub_longe, loja_outro_estado, v_longe),
        ):
            db.add(PublicacaoB2B(id=pub_id, loja_id=loja_id, veiculo_id=veiculo_id, valor_repasse=110000.0, ativa=True))
        await db.commit()

    try:
        async with async_session() as db:
            loja = await db.get(Loja, loja_a)
            resultado = await buscar_veiculos(
                db=db, loja_id=loja_a, loja=loja,
                criterios=CriteriosBusca(modelo="Corolla"), escopo=_escopo(),
            )

        ids_parceiros = [v.publicacao_id for v in resultado.parceiros]
        assert pub_a not in ids_parceiros, "A própria loja apareceu no feed de repasse."
        assert pub_perto in ids_parceiros and pub_longe in ids_parceiros
        assert ids_parceiros.index(pub_perto) < ids_parceiros.index(pub_longe), (
            "Parceiro da mesma cidade deveria vir antes do de outro estado."
        )
    finally:
        async with async_session() as db:
            await db.execute(delete(PublicacaoB2B).where(PublicacaoB2B.id.in_([pub_a, pub_perto, pub_longe])))
            await db.execute(delete(Veiculo).where(Veiculo.id.in_([v_a, v_perto, v_longe])))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a, loja_mesma_cidade, loja_outro_estado])))
            await db.commit()


# ─────────────────────────────────────────────────────────────
# (b) e (c) Fronteira do papel e custo alheio
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_vendedor_sem_financeiro_nao_ve_custo_e_parceiro_nunca_expoe_margem():
    loja_a, loja_parceira = _uid(), _uid()
    v_a, v_parceiro, pub = _uid(), _uid(), _uid()

    async with async_session() as db:
        db.add(Loja(id=loja_a, nome="Loja A (aura)", slug=f"aura-a-{loja_a[:8]}", cidade="Uberlândia", estado="MG"))
        db.add(Loja(id=loja_parceira, nome="Parceiro", slug=f"aura-p-{loja_parceira[:8]}", cidade="Uberlândia", estado="MG"))
        db.add(_veiculo(loja_a, id=v_a))
        db.add(_veiculo(loja_parceira, id=v_parceiro, status=StatusVeiculo.REPASSE))
        db.add(PublicacaoB2B(id=pub, loja_id=loja_parceira, veiculo_id=v_parceiro, valor_repasse=110000.0, ativa=True))
        await db.commit()

    try:
        async with async_session() as db:
            loja = await db.get(Loja, loja_a)
            criterios = CriteriosBusca(modelo="Corolla")

            como_vendedor = await buscar_veiculos(
                db=db, loja_id=loja_a, loja=loja, criterios=criterios,
                escopo=_escopo(papel=PapelUsuario.VENDEDOR, custo=False),
            )
            como_gestor = await buscar_veiculos(
                db=db, loja_id=loja_a, loja=loja, criterios=criterios, escopo=_escopo(),
            )

        assert all(v.preco_custo is None for v in como_vendedor.proprios), (
            "VAZAMENTO: vendedor sem módulo financeiro recebeu preço de custo."
        )
        assert any(v.preco_custo is not None for v in como_gestor.proprios), (
            "Gestor deveria enxergar o custo do próprio estoque."
        )
        assert all(v.preco_custo is None for v in como_gestor.parceiros), (
            "VAZAMENTO: custo/margem de loja parceira exposto ao gestor."
        )
        assert all(v.valor_repasse is not None for v in como_gestor.parceiros), (
            "O valor de repasse publicado pelo parceiro deveria aparecer."
        )
    finally:
        async with async_session() as db:
            await db.execute(delete(PublicacaoB2B).where(PublicacaoB2B.id == pub))
            await db.execute(delete(Veiculo).where(Veiculo.id.in_([v_a, v_parceiro])))
            await db.execute(delete(Loja).where(Loja.id.in_([loja_a, loja_parceira])))
            await db.commit()


# ─────────────────────────────────────────────────────────────
# (d) (e) (f) Rotas
# ─────────────────────────────────────────────────────────────

async def _montar_loja_com_aura(db, *, com_modulo: bool) -> tuple[str, str, str]:
    """Cria loja + gestor com (ou sem) o módulo `assistente_ia` ativo."""
    loja_id, usuario_id, membro_id = _uid(), _uid(), _uid()
    email = f"aura_{usuario_id[:8]}@teste.com"

    db.add(Loja(id=loja_id, nome="Loja AURA", slug=f"aura-{loja_id[:8]}", cidade="Uberlândia", estado="MG"))
    db.add(Usuario(id=usuario_id, nome="Gestor AURA", email=email, senha_hash="hash_fake",
                   papel=PapelUsuario.GESTOR, ativo=True))
    db.add(MembroLoja(id=membro_id, usuario_id=usuario_id, loja_id=loja_id,
                      papel=PapelUsuario.GESTOR, ativo=True))

    if com_modulo:
        plano = (await db.execute(select(Plano).limit(1))).scalars().first()
        if plano is None:
            return "", "", ""
        db.add(Assinatura(id=_uid(), loja_id=loja_id, plano_id=plano.id,
                          status=StatusAssinatura.ATIVA, proximo_vencimento=None))
        db.add(ModuloHabilitado(id=_uid(), loja_id=loja_id, nome_modulo="assistente_ia", ativo=True))

    await db.commit()
    return loja_id, usuario_id, email


async def _limpar(loja_ids: list[str], usuario_ids: list[str]):
    async with async_session() as db:
        await db.execute(delete(AuraMensagem).where(AuraMensagem.loja_id.in_(loja_ids)))
        await db.execute(delete(AuraConversa).where(AuraConversa.loja_id.in_(loja_ids)))
        await db.execute(delete(ModuloHabilitado).where(ModuloHabilitado.loja_id.in_(loja_ids)))
        await db.execute(delete(Assinatura).where(Assinatura.loja_id.in_(loja_ids)))
        await db.execute(delete(MembroLoja).where(MembroLoja.loja_id.in_(loja_ids)))
        await db.execute(delete(Usuario).where(Usuario.id.in_(usuario_ids)))
        await db.execute(delete(Loja).where(Loja.id.in_(loja_ids)))
        await db.commit()


@pytest.mark.asyncio
async def test_sem_modulo_assistente_ia_responde_402(client):
    async with async_session() as db:
        loja_id, usuario_id, email = await _montar_loja_com_aura(db, com_modulo=False)

    token = create_access_token(data={"sub": usuario_id, "email": email, "papel": PapelUsuario.GESTOR.value, "typ": "access"})
    try:
        resp = await client.get("/v1/aura/conversa", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 402, (
            f"Sem o módulo contratado a AURA deveria devolver paywall -> {resp.status_code} {resp.text}"
        )
    finally:
        await _limpar([loja_id], [usuario_id])


@pytest.mark.asyncio
async def test_conversa_da_aura_e_privada_por_pessoa(client):
    """Gestor não alcança a mensagem que o vendedor trocou com a AURA."""
    async with async_session() as db:
        loja_id, gestor_id, email_gestor = await _montar_loja_com_aura(db, com_modulo=True)
        if not loja_id:
            pytest.skip("Nenhum plano cadastrado — rode seed.py antes.")

        vendedor_id, conversa_id, mensagem_id = _uid(), _uid(), _uid()
        db.add(Usuario(id=vendedor_id, nome="Vendedor", email=f"vend_{vendedor_id[:8]}@teste.com",
                       senha_hash="hash_fake", papel=PapelUsuario.VENDEDOR, ativo=True))
        db.add(MembroLoja(id=_uid(), usuario_id=vendedor_id, loja_id=loja_id,
                          papel=PapelUsuario.VENDEDOR, ativo=True))
        db.add(AuraConversa(id=conversa_id, loja_id=loja_id, usuario_id=vendedor_id))
        db.add(AuraMensagem(id=mensagem_id, conversa_id=conversa_id, loja_id=loja_id,
                            autor=AURA_AUTOR_AURA, conteudo="Resposta ao vendedor."))
        await db.commit()

    token = create_access_token(data={"sub": gestor_id, "email": email_gestor, "papel": PapelUsuario.GESTOR.value, "typ": "access"})
    headers = {"Authorization": f"Bearer {token}"}
    try:
        listagem = await client.get("/v1/aura/mensagens", headers=headers)
        assert listagem.status_code == 200
        assert all(m["id"] != mensagem_id for m in listagem.json()), (
            "VAZAMENTO: o gestor leu a conversa da AURA do vendedor."
        )

        avaliar = await client.post(
            f"/v1/aura/mensagens/{mensagem_id}/avaliar", json={"util": True}, headers=headers,
        )
        assert avaliar.status_code == 404, (
            f"Gestor alcançou mensagem de outra pessoa -> {avaliar.status_code} {avaliar.text}"
        )
    finally:
        await _limpar([loja_id], [gestor_id, vendedor_id])


@pytest.mark.asyncio
async def test_cota_esgotada_bloqueia_antes_de_gastar_token(client):
    """Estourada a cota do mês, `/perguntar` devolve 429 sem chamar a IA."""
    async with async_session() as db:
        loja_id, usuario_id, email = await _montar_loja_com_aura(db, com_modulo=True)
        if not loja_id:
            pytest.skip("Nenhum plano cadastrado — rode seed.py antes.")

        loja = await db.get(Loja, loja_id)
        loja.aura_cota_mensal = 1  # teto por loja sobrescreve AURA_COTA_PADRAO

        conversa_id = _uid()
        db.add(AuraConversa(id=conversa_id, loja_id=loja_id, usuario_id=usuario_id))
        db.add(AuraMensagem(id=_uid(), conversa_id=conversa_id, loja_id=loja_id,
                            autor=AURA_AUTOR_USUARIO, conteudo="pergunta que já contou",
                            created_at=utcnow()))
        await db.commit()

    token = create_access_token(data={"sub": usuario_id, "email": email, "papel": PapelUsuario.GESTOR.value, "typ": "access"})
    try:
        resp = await client.post(
            "/v1/aura/perguntar",
            json={"pergunta": "tem corolla prata até 45 mil km?"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 429, (
            f"Cota estourada deveria bloquear a pergunta -> {resp.status_code} {resp.text}"
        )
        assert "Cota da AURA" in resp.json().get("detail", "")
    finally:
        await _limpar([loja_id], [usuario_id])
