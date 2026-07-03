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
from models import Veiculo, Loja, Favorito, StatusVeiculo
from schemas import VeiculoB2CResponse

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
    for v in vehicles:
        count_stmt = select(func.count(Favorito.id)).where(Favorito.veiculo_id == v.id)
        count_res = await db.execute(count_stmt)
        v.total_favoritos = count_res.scalar() or 0
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
