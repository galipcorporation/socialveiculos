"""
Social Veículos — Rotas públicas do Marketplace B2C (loja pública + sitemap SEO).
Sem autenticação. Filtro de saída B2C: nunca expõe placa/custo/margem.
"""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, ConfigDict

from config import settings
from database import get_db
from lib_formatacao import formatar_moeda
from limiter import rate_limit
from models import Veiculo, Loja, Favorito, StatusVeiculo, ClientePF, Lead, EtapaLead, OrigemLead, Notificacao
from schemas import VeiculoB2CResponse
from pydantic import Field

router = APIRouter(prefix="/v1/marketplace", tags=["Marketplace Público B2C"])


# ── Schemas públicos da loja ───────────────────────────────────

class LojaPublicaResponse(BaseModel):
    """Identidade pública da loja na vitrine. Nunca expõe dados internos."""
    id: str
    nome: str
    slug: str
    logo_url: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    whatsapp: Optional[str] = None
    verificada: bool = False
    total_veiculos: int = 0
    veiculos: List[VeiculoB2CResponse] = []

    model_config = ConfigDict(from_attributes=True)


async def _hidratar_favoritos(db: AsyncSession, vehicles: list) -> None:
    """Anexa total_favoritos a cada veículo (B2C público não tem 'favoritado_por_mim')."""
    if not vehicles:
        return
    veiculo_ids = [v.id for v in vehicles]
    count_res = await db.execute(
        select(Favorito.veiculo_id, func.count(Favorito.id))
        .where(Favorito.veiculo_id.in_(veiculo_ids))
        .group_by(Favorito.veiculo_id)
    )
    favoritos_por_veiculo = {vid: count for vid, count in count_res.all()}
    for v in vehicles:
        v.total_favoritos = favoritos_por_veiculo.get(v.id, 0)
        v.favoritado_por_mim = False


# ── Página da loja (vitrine da loja) ───────────────────────────

@router.get("/loja/{slug}", response_model=LojaPublicaResponse)
async def get_loja_publica(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Identidade da loja + veículos publicados disponíveis.
    Usada pela página /loja/:slug da vitrine (SSG/SEO).
    """
    loja_stmt = select(Loja).where(Loja.slug == slug, Loja.ativa == True)
    loja_res = await db.execute(loja_stmt)
    loja = loja_res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    v_stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(
            Veiculo.loja_id == loja.id,
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
            Veiculo.midias.any(),
        )
        .order_by(Veiculo.created_at.desc())
    )
    v_res = await db.execute(v_stmt)
    veiculos = v_res.scalars().all()
    await _hidratar_favoritos(db, veiculos)

    return LojaPublicaResponse(
        id=loja.id,
        nome=loja.nome,
        slug=loja.slug,
        logo_url=loja.logo_url,
        cidade=loja.cidade,
        estado=loja.estado,
        whatsapp=loja.whatsapp,
        verificada=loja.verificada,
        total_veiculos=len(veiculos),
        veiculos=veiculos,
    )


# ── Sitemap (JSON p/ o prerender) ──────────────────────────────

class SitemapResponse(BaseModel):
    car_ids: List[str] = []
    store_slugs: List[str] = []


@router.get("/sitemap", response_model=SitemapResponse)
async def get_sitemap_data(db: AsyncSession = Depends(get_db)):
    """
    IDs de carros publicados + slugs de lojas ativas.
    Consumido pelo script de prerender da vitrine para gerar as rotas estáticas.
    """
    car_stmt = select(Veiculo.id).where(
        Veiculo.publicado_marketplace == True,
        Veiculo.status == StatusVeiculo.DISPONIVEL,
        Veiculo.midias.any(),
    )
    car_res = await db.execute(car_stmt)
    car_ids = [row[0] for row in car_res.all()]

    store_stmt = select(Loja.slug).where(Loja.ativa == True)
    store_res = await db.execute(store_stmt)
    store_slugs = [row[0] for row in store_res.all()]

    return SitemapResponse(car_ids=car_ids, store_slugs=store_slugs)


# ── sitemap.xml (para crawlers) ────────────────────────────────

@router.get("/sitemap.xml")
async def get_sitemap_xml(db: AsyncSession = Depends(get_db)):
    """
    Sitemap XML padrão para Google/Bing. Atualiza automaticamente ao
    publicar/despublicar veículos (lê o estado atual do banco).
    """
    base = settings.vitrine_base_url.rstrip("/")
    data = await get_sitemap_data(db)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls = [f"{base}/", f"{base}/feed"]
    urls += [f"{base}/carro/{cid}" for cid in data.car_ids]
    urls += [f"{base}/loja/{slug}" for slug in data.store_slugs]

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        body.append(f"  <url><loc>{u}</loc><lastmod>{now}</lastmod></url>")
    body.append("</urlset>")

    return Response(content="\n".join(body), media_type="application/xml")


# ── Pré-aprovação de crédito (M017) ────────────────────────────
# Captura de lead consumer-facing. NÃO roda o motor de simulação real — sem
# parceria formal com banco, simular parcela ao consumidor é risco jurídico/LGPD.
# O pedido vira um Lead (origem pre_aprovacao) no CRM da loja, que dá sequência.
# Quando houver banco parceiro, é só ligar o OrquestradorV2 aqui (motor já existe).

class PreAprovacaoRequest(BaseModel):
    veiculo_id: str
    nome: str = Field(..., min_length=2, max_length=200)
    cpf: Optional[str] = Field(None, max_length=14)   # substituiu telefone — obrigatório no front
    email: Optional[str] = Field(None, max_length=200)
    renda_mensal: Optional[float] = Field(None, ge=0)
    entrada: Optional[float] = Field(None, ge=0)


@router.post("/pre-aprovacao", dependencies=[Depends(rate_limit(5, 60))])
async def solicitar_pre_aprovacao(data: PreAprovacaoRequest, db: AsyncSession = Depends(get_db)):
    """Formulário público de pré-aprovação de crédito → Lead no CRM da loja dona
    do veículo. Endpoint anônimo (rate limit 5/min). Não simula nem promete
    aprovação — apenas encaminha o interesse à loja."""
    res = await db.execute(
        select(Veiculo).where(
            Veiculo.id == data.veiculo_id,
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
        )
    )
    veiculo = res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado ou indisponível.")

    # Reaproveita ClientePF pelo CPF na loja, ou cria (sem exigir login).
    cpf_limpo = (data.cpf or "").replace(".", "").replace("-", "").strip()
    cliente = None
    if cpf_limpo:
        res_cliente = await db.execute(
            select(ClientePF).where(ClientePF.loja_id == veiculo.loja_id, ClientePF.cpf == cpf_limpo)
        )
        cliente = res_cliente.scalar_one_or_none()
    if not cliente:
        cliente = ClientePF(loja_id=veiculo.loja_id, nome=data.nome, cpf=cpf_limpo or None, email=data.email)
        db.add(cliente)
        await db.flush()

    partes = ["Pedido de pré-aprovação de crédito via vitrine."]
    if data.renda_mensal is not None:
        partes.append(f"Renda informada: {formatar_moeda(data.renda_mensal)}.")
    if data.entrada is not None:
        partes.append(f"Entrada pretendida: {formatar_moeda(data.entrada)}.")

    lead = Lead(
        loja_id=veiculo.loja_id,
        cliente_id=cliente.id,
        veiculo_id=veiculo.id,
        origem=OrigemLead.PRE_APROVACAO,
        etapa=EtapaLead.LEAD,
        observacoes=" ".join(partes),
    )
    db.add(lead)
    await db.flush()

from urllib.parse import quote


# ── Captura de Lead da Vitrine (M108) ──────────────────────────
class LeadVitrineRequest(BaseModel):
    veiculo_id: str
    nome: str = Field(..., min_length=2, max_length=200)
    telefone: str = Field(..., min_length=8, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    mensagem: Optional[str] = Field(None, max_length=1000)


@router.post("/lead-vitrine", dependencies=[Depends(rate_limit(10, 60))])
async def cadastrar_lead_vitrine(data: LeadVitrineRequest, db: AsyncSession = Depends(get_db)):
    """Formulário público de contato da Vitrine → Lead no CRM da loja dona do veículo.
    Gera notificação em tempo real para a loja e devolve o link formatado do WhatsApp."""
    res = await db.execute(
        select(Veiculo).where(
            Veiculo.id == data.veiculo_id,
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
        )
    )
    veiculo = res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado ou indisponível.")

    # Buscar informações da loja (para número do WhatsApp)
    res_loja = await db.execute(select(Loja).where(Loja.id == veiculo.loja_id))
    loja = res_loja.scalar_one_or_none()

    # Reaproveita ClientePF pelo telefone na loja, ou cria (sem exigir login).
    res_cliente = await db.execute(
        select(ClientePF).where(ClientePF.loja_id == veiculo.loja_id, ClientePF.telefone == data.telefone)
    )
    cliente = res_cliente.scalar_one_or_none()
    if not cliente:
        cliente = ClientePF(loja_id=veiculo.loja_id, nome=data.nome, telefone=data.telefone, email=data.email)
        db.add(cliente)
        await db.flush()
    elif data.nome and cliente.nome != data.nome:
        cliente.nome = data.nome
        if data.email:
            cliente.email = data.email
        await db.flush()

    obs = f"Lead vindo da Vitrine/Showcase. Mensagem inicial: {data.mensagem}" if data.mensagem else "Lead vindo da Vitrine/Showcase."

    lead = Lead(
        loja_id=veiculo.loja_id,
        cliente_id=cliente.id,
        veiculo_id=veiculo.id,
        origem=OrigemLead.VITRINE,
        etapa=EtapaLead.LEAD,
        valor_proposta=veiculo.preco_venda or 0.0,
        observacoes=obs,
    )
    db.add(lead)
    await db.flush()

    db.add(Notificacao(
        loja_id=veiculo.loja_id,
        titulo=f"Novo lead da Vitrine: {cliente.nome}",
        conteudo=f"{cliente.nome} ({cliente.telefone}) demonstrou interesse no veículo {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo or ''}.",
        tipo="lead",
        link=f"lead:{lead.id}",
    ))
    await db.commit()

    # Monta URL do WhatsApp se a loja tiver telefone cadastrado
    num_wa = (loja.whatsapp if loja and loja.whatsapp else None) or (loja.telefone if loja and loja.telefone else None)
    num_limpo = "".join(filter(str.isdigit, num_wa or "")) if num_wa else ""
    
    msg_wa = f"Olá! Meu nome é {cliente.nome}. Tenho interesse no {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo or ''} que vi na Vitrine."
    whatsapp_url = f"https://wa.me/{num_limpo}?text={quote(msg_wa)}" if num_limpo else None

    return {
        "ok": True,
        "lead_id": lead.id,
        "whatsapp_url": whatsapp_url,
        "mensagem": "Lead cadastrado com sucesso no CRM da loja."
    }

