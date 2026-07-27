"""
Social Veículos — Integrador de Anúncios em portais (M079).

Publica/despublica um veículo do estoque em vários portais e mantém o estado de
cada célula (veículo × portal). Gate: Modulo.MARKETING — o integrador é uma aba
do módulo Marketing, não um módulo à parte (TDD §3.5).

Permissão: módulo liberado dá CRUD completo. Sem checagem por papel (TDD §4.1).
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from anuncios_service import carregar_veiculo, enfileirar_acao, veiculo_anunciavel
from database import get_db
from deps import B2BContext, get_current_b2b_user
from models import (
    AnuncioPortal,
    CredencialPortal,
    CredencialRedeSocial,
    StatusVeiculo,
    Veiculo,
)
from modulos import Modulo, exige_modulo
from portais import PORTAIS_META, REGISTRY, get_adapter, hash_payload, montar_payload

router = APIRouter(prefix="/v1/anuncios", tags=["Integrador de Anúncios"])


# ══════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════

class PortalInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome: str
    rotulo: str
    disponivel: bool
    requer_parceria: bool
    tipo_auth: str
    conectado: bool
    motivo: Optional[str] = None


class CelulaAnuncio(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    portal: str
    status: str
    url_externa: Optional[str] = None
    erro: Optional[str] = None
    publicado_em: Optional[datetime] = None


class LinhaGrade(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    veiculo_id: str
    titulo: str
    placa: Optional[str] = None
    preco_venda: Optional[float] = None
    foto: Optional[str] = None
    vendido: bool
    celulas: list[CelulaAnuncio]


class GradeResponse(BaseModel):
    total: int
    itens: list[LinhaGrade]


class AcaoRequest(BaseModel):
    veiculo_ids: list[str]
    portais: list[str]


class AcaoResponse(BaseModel):
    enfileirados: int
    ignorados: list[str] = []


class PendenciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    veiculo_id: str
    titulo: str
    portal: str
    rotulo_portal: str
    erro: Optional[str] = None


# ══════════════════════════════════════════════════════════════
# PORTAIS
# ══════════════════════════════════════════════════════════════

async def _portais_conectados(db: AsyncSession, loja_id: str) -> set[str]:
    """Meta vem do M024 (CredencialRedeSocial); os demais, de CredencialPortal."""
    redes = (await db.execute(
        select(CredencialRedeSocial.rede).where(
            CredencialRedeSocial.loja_id == loja_id,
            CredencialRedeSocial.ativo == True,  # noqa: E712
        )
    )).scalars().all()
    portais = (await db.execute(
        select(CredencialPortal.portal).where(
            CredencialPortal.loja_id == loja_id,
            CredencialPortal.ativo == True,  # noqa: E712
        )
    )).scalars().all()
    return set(redes) | set(portais)


@router.get(
    "/portais",
    response_model=list[PortalInfo],
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def listar_portais(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Catálogo de portais com o estado de conexão da loja."""
    conectados = await _portais_conectados(db, ctx.loja_id)
    return [
        PortalInfo(
            nome=a.nome,
            rotulo=a.rotulo,
            disponivel=a.disponivel,
            requer_parceria=a.requer_parceria,
            tipo_auth=a.tipo_auth,
            conectado=a.nome in conectados,
            motivo=getattr(a, "motivo", None) if not a.disponivel else None,
        )
        for a in REGISTRY.values()
    ]


@router.post(
    "/portais/{portal}/testar",
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def testar_conexao(
    portal: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    adapter = get_adapter(portal)
    if adapter is None:
        raise HTTPException(404, "Portal desconhecido.")
    if not adapter.disponivel:
        raise HTTPException(503, getattr(adapter, "motivo", "Portal não integrado."))

    if portal in PORTAIS_META:
        cred = (await db.execute(select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == ctx.loja_id,
            CredencialRedeSocial.rede == portal,
            CredencialRedeSocial.ativo == True,  # noqa: E712
        ))).scalar_one_or_none()
    else:
        cred = (await db.execute(select(CredencialPortal).where(
            CredencialPortal.loja_id == ctx.loja_id,
            CredencialPortal.portal == portal,
            CredencialPortal.ativo == True,  # noqa: E712
        ))).scalar_one_or_none()

    resultado = await adapter.testar_conexao(cred)
    return {"sucesso": resultado.sucesso, "erro": resultado.erro}


@router.delete(
    "/portais/{portal}",
    status_code=204,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def desconectar_portal(
    portal: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Desconecta portal não-Meta. As redes do Meta seguem em /configuracoes/redes-sociais."""
    if portal in PORTAIS_META:
        raise HTTPException(400, "Use /v1/configuracoes/redes-sociais para desconectar Facebook/Instagram.")
    cred = (await db.execute(select(CredencialPortal).where(
        CredencialPortal.loja_id == ctx.loja_id,
        CredencialPortal.portal == portal,
    ))).scalar_one_or_none()
    if cred:
        await db.delete(cred)
        await db.commit()


# ══════════════════════════════════════════════════════════════
# GRADE
# ══════════════════════════════════════════════════════════════

def _titulo(v: Veiculo) -> str:
    partes = " ".join(p for p in (v.marca, v.modelo, v.versao) if p)
    return f"{partes} {v.ano_fabricacao}/{v.ano_modelo}".strip()


@router.get(
    "/grade",
    response_model=GradeResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def grade(
    status: Optional[str] = Query(None, description="Filtra por status de célula"),
    portal: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Grade veículo × portal. Vendidos com pendência aparecem primeiro."""
    base = select(Veiculo).where(Veiculo.loja_id == ctx.loja_id)

    if busca:
        termo = f"%{busca.strip()}%"
        base = base.where(
            func.lower(Veiculo.marca).like(func.lower(termo))
            | func.lower(Veiculo.modelo).like(func.lower(termo))
            | func.lower(Veiculo.placa).like(func.lower(termo))
        )

    if status or portal:
        sub = select(AnuncioPortal.veiculo_id).where(AnuncioPortal.loja_id == ctx.loja_id)
        if status:
            sub = sub.where(AnuncioPortal.status == status)
        if portal:
            sub = sub.where(AnuncioPortal.portal == portal)
        base = base.where(Veiculo.id.in_(sub))
    else:
        # Sem filtro: só o estoque vivo + vendidos que ainda têm pendência.
        pend = select(AnuncioPortal.veiculo_id).where(
            AnuncioPortal.loja_id == ctx.loja_id,
            AnuncioPortal.status.in_(("baixa_pendente", "sincronizando", "erro")),
        )
        base = base.where(
            (Veiculo.status == StatusVeiculo.DISPONIVEL) | Veiculo.id.in_(pend)
        )

    total = (await db.execute(
        select(func.count()).select_from(base.subquery())
    )).scalar_one()

    veiculos = (await db.execute(
        base.options(selectinload(Veiculo.midias))
        .order_by(Veiculo.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()

    ids = [v.id for v in veiculos]
    anuncios = (await db.execute(
        select(AnuncioPortal).where(AnuncioPortal.veiculo_id.in_(ids))
    )).scalars().all() if ids else []

    por_veiculo: dict[str, dict[str, AnuncioPortal]] = {}
    for a in anuncios:
        por_veiculo.setdefault(a.veiculo_id, {})[a.portal] = a

    itens = []
    for v in veiculos:
        existentes = por_veiculo.get(v.id, {})
        celulas = []
        for nome in REGISTRY:
            a = existentes.get(nome)
            if a:
                celulas.append(CelulaAnuncio(
                    id=a.id, portal=nome, status=a.status,
                    url_externa=a.url_externa, erro=a.erro, publicado_em=a.publicado_em,
                ))
            else:
                celulas.append(CelulaAnuncio(portal=nome, status="nao_publicado"))

        fotos = [m.url for m in sorted(v.midias, key=lambda m: m.ordem or 0)
                 if m.url and getattr(m.tipo, "value", m.tipo) == "foto"]
        itens.append(LinhaGrade(
            veiculo_id=v.id,
            titulo=_titulo(v),
            placa=v.placa,
            preco_venda=v.preco_venda,
            foto=fotos[0] if fotos else None,
            vendido=v.status != StatusVeiculo.DISPONIVEL,
            celulas=celulas,
        ))

    return GradeResponse(total=total, itens=itens)


# ══════════════════════════════════════════════════════════════
# AÇÕES
# ══════════════════════════════════════════════════════════════

@router.post(
    "/publicar",
    response_model=AcaoResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def publicar(
    body: AcaoRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    enfileirados = 0
    ignorados: list[str] = []

    for veiculo_id in body.veiculo_ids:
        veiculo = await carregar_veiculo(db, veiculo_id, ctx.loja_id)
        ok, motivo = veiculo_anunciavel(veiculo)
        if not ok:
            ignorados.append(f"{veiculo_id}: {motivo}")
            continue

        alvos = []
        for portal in body.portais:
            adapter = get_adapter(portal)
            if adapter is None:
                ignorados.append(f"{portal}: portal desconhecido.")
                continue
            if not adapter.disponivel:
                ignorados.append(f"{adapter.rotulo}: {getattr(adapter, 'motivo', 'não integrado')}")
                continue
            alvos.append(portal)

        afetados = await enfileirar_acao(db, ctx.loja_id, veiculo_id, alvos, "publicar")
        enfileirados += len(afetados)

    await db.commit()
    return AcaoResponse(enfileirados=enfileirados, ignorados=ignorados)


@router.post(
    "/despublicar",
    response_model=AcaoResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def despublicar(
    body: AcaoRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    enfileirados = 0
    for veiculo_id in body.veiculo_ids:
        veiculo = await carregar_veiculo(db, veiculo_id, ctx.loja_id)
        if veiculo is None:
            continue
        afetados = await enfileirar_acao(db, ctx.loja_id, veiculo_id, body.portais, "despublicar")
        enfileirados += len(afetados)

    await db.commit()
    return AcaoResponse(enfileirados=enfileirados)


@router.post(
    "/sincronizar-todos",
    response_model=AcaoResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def sincronizar_todos(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Reenvia aos portais só o que mudou de verdade (compara hash_payload)."""
    anuncios = (await db.execute(
        select(AnuncioPortal).where(
            AnuncioPortal.loja_id == ctx.loja_id,
            AnuncioPortal.status == "publicado",
        )
    )).scalars().all()

    enfileirados = 0
    cache: dict[str, Optional[str]] = {}

    for anuncio in anuncios:
        if anuncio.veiculo_id not in cache:
            veiculo = await carregar_veiculo(db, anuncio.veiculo_id, ctx.loja_id)
            ok, _ = veiculo_anunciavel(veiculo)
            cache[anuncio.veiculo_id] = hash_payload(montar_payload(veiculo)) if ok else None

        novo = cache[anuncio.veiculo_id]
        if novo and novo != anuncio.hash_payload:
            await enfileirar_acao(db, ctx.loja_id, anuncio.veiculo_id, [anuncio.portal], "atualizar")
            enfileirados += 1

    await db.commit()
    return AcaoResponse(enfileirados=enfileirados)


# ══════════════════════════════════════════════════════════════
# BAIXA MANUAL (portais sem API)
# ══════════════════════════════════════════════════════════════

@router.get(
    "/pendencias",
    response_model=list[PendenciaResponse],
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def pendencias(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Baixas manuais em aberto — alimenta o badge e o filtro do mobile."""
    linhas = (await db.execute(
        select(AnuncioPortal, Veiculo)
        .join(Veiculo, Veiculo.id == AnuncioPortal.veiculo_id)
        .where(
            AnuncioPortal.loja_id == ctx.loja_id,
            AnuncioPortal.status == "baixa_pendente",
        )
        .order_by(AnuncioPortal.atualizado_em.desc())
    )).all()

    return [
        PendenciaResponse(
            id=a.id,
            veiculo_id=v.id,
            titulo=_titulo(v),
            portal=a.portal,
            rotulo_portal=get_adapter(a.portal).rotulo if get_adapter(a.portal) else a.portal,
            erro=a.erro,
        )
        for a, v in linhas
    ]


@router.post(
    "/{anuncio_id}/confirmar-baixa",
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def confirmar_baixa(
    anuncio_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """"Já removi" — o usuário declara que tirou o anúncio do portal.

    Não há como verificar sem API: é declaração, por isso registramos quem e
    quando (rastreabilidade, não permissão — TDD §4.1).
    """
    anuncio = (await db.execute(
        select(AnuncioPortal).where(
            AnuncioPortal.id == anuncio_id,
            AnuncioPortal.loja_id == ctx.loja_id,
        )
    )).scalar_one_or_none()

    if anuncio is None:
        raise HTTPException(404, "Anúncio não encontrado.")
    if anuncio.status != "baixa_pendente":
        raise HTTPException(409, "Este anúncio não tem baixa pendente.")

    from anuncios_service import _agora

    anuncio.status = "despublicado"
    anuncio.erro = None
    anuncio.baixa_confirmada_em = _agora()
    anuncio.baixa_confirmada_por = ctx.usuario.id
    anuncio.atualizado_em = _agora()
    await db.commit()

    return {"ok": True}
