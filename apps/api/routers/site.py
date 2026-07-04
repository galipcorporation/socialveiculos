"""
Social Veículos — Construtor de Sites (M038, Fase 1)

Site próprio/white-label por loja: builder no gestor + resolução por host
para o futuro app público (apps/site, fora de escopo desta fase). Fase 1
cobre só subdomínio automático ({slug}.socialveiculos.com.br); domínio
próprio/SSL fica para a Fase 2. Rascunho (`rascunho_json`) nunca vaza ao
público — só o conteúdo publicado é servido em /public/site/{host}.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import SiteLoja, Loja
from modulos import Modulo, exige_modulo
from rbac import exige_permissao, Acao, Recurso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/site", tags=["Construtor de Sites"])
public_router = APIRouter(prefix="/v1/public/site", tags=["Construtor de Sites (público)"])


# ═══════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════

class SiteLojaRequest(BaseModel):
    template: str = "clean"
    cor_primaria: Optional[str] = None
    cor_secundaria: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    favicon_url: Optional[str] = None
    hero_titulo: Optional[str] = None
    hero_subtitulo: Optional[str] = None
    hero_cta: Optional[str] = None
    sobre_texto: Optional[str] = None
    secoes_ativas: Optional[dict] = None
    redes: Optional[dict] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_url: Optional[str] = None
    ga4_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None


class SiteLojaResponse(BaseModel):
    id: str
    subdominio: str
    dominio_customizado: Optional[str] = None
    dominio_status: str
    publicado: bool
    template: str
    cor_primaria: Optional[str] = None
    cor_secundaria: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    favicon_url: Optional[str] = None
    hero_titulo: Optional[str] = None
    hero_subtitulo: Optional[str] = None
    hero_cta: Optional[str] = None
    sobre_texto: Optional[str] = None
    secoes_ativas: Optional[dict] = None
    redes: Optional[dict] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_url: Optional[str] = None
    ga4_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


def _to_response(s: SiteLoja) -> dict:
    return {
        "id": s.id,
        "subdominio": s.subdominio,
        "dominio_customizado": s.dominio_customizado,
        "dominio_status": s.dominio_status,
        "publicado": bool(s.publicado),
        "template": s.template,
        "cor_primaria": s.cor_primaria,
        "cor_secundaria": s.cor_secundaria,
        "logo_url": s.logo_url,
        "banner_url": s.banner_url,
        "favicon_url": s.favicon_url,
        "hero_titulo": s.hero_titulo,
        "hero_subtitulo": s.hero_subtitulo,
        "hero_cta": s.hero_cta,
        "sobre_texto": s.sobre_texto,
        "secoes_ativas": json.loads(s.secoes_ativas) if s.secoes_ativas else None,
        "redes": json.loads(s.redes) if s.redes else None,
        "seo_title": s.seo_title,
        "seo_description": s.seo_description,
        "og_image_url": s.og_image_url,
        "ga4_id": s.ga4_id,
        "meta_pixel_id": s.meta_pixel_id,
    }


async def _carregar_ou_criar(db: AsyncSession, loja_id: str) -> SiteLoja:
    res = await db.execute(select(SiteLoja).where(SiteLoja.loja_id == loja_id))
    site = res.scalar_one_or_none()
    if site:
        return site

    res_loja = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res_loja.scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    site = SiteLoja(loja_id=loja_id, subdominio=loja.slug, logo_url=loja.logo_url)
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return site


# ═══════════════════════════════════════════════════════════════
# BUILDER (gestor)
# ═══════════════════════════════════════════════════════════════

@router.get("", response_model=SiteLojaResponse,
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))])
async def obter_site(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    site = await _carregar_ou_criar(db, context.loja_id)
    return _to_response(site)


@router.put("", response_model=SiteLojaResponse,
            dependencies=[Depends(exige_modulo(Modulo.SITE)), Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def salvar_site(
    data: SiteLojaRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    site = await _carregar_ou_criar(db, context.loja_id)

    campos = data.model_dump(exclude={"secoes_ativas", "redes"})
    for k, v in campos.items():
        setattr(site, k, v)
    site.secoes_ativas = json.dumps(data.secoes_ativas) if data.secoes_ativas is not None else site.secoes_ativas
    site.redes = json.dumps(data.redes) if data.redes is not None else site.redes

    await db.commit()
    await db.refresh(site)
    return _to_response(site)


@router.post("/publicar", response_model=SiteLojaResponse,
             dependencies=[Depends(exige_modulo(Modulo.SITE)), Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def publicar_site(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    site = await _carregar_ou_criar(db, context.loja_id)
    if not site.hero_titulo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Configure ao menos o título do site antes de publicar.")
    site.publicado = True
    await db.commit()
    await db.refresh(site)
    return _to_response(site)


@router.post("/despublicar", response_model=SiteLojaResponse,
             dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def despublicar_site(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    site = await _carregar_ou_criar(db, context.loja_id)
    site.publicado = False
    await db.commit()
    await db.refresh(site)
    return _to_response(site)


# ═══════════════════════════════════════════════════════════════
# RESOLUÇÃO POR HOST (público — consumido pelo futuro app apps/site)
# ═══════════════════════════════════════════════════════════════

@public_router.get("/{host}")
async def obter_site_publico(host: str, db: AsyncSession = Depends(get_db)):
    """Resolve um host (subdomínio ou domínio próprio) para a config publicada
    do site + identidade da loja. Nunca retorna rascunho não publicado."""
    subdominio = host.split(".")[0] if "." in host else host
    res = await db.execute(
        select(SiteLoja).where(
            (SiteLoja.subdominio == subdominio) | (SiteLoja.dominio_customizado == host),
            SiteLoja.publicado == True,
        )
    )
    site = res.scalar_one_or_none()
    if not site:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site não encontrado ou não publicado.")

    res_loja = await db.execute(select(Loja).where(Loja.id == site.loja_id, Loja.ativa == True))
    loja = res_loja.scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada ou inativa.")

    return {
        "site": _to_response(site),
        "loja": {"id": loja.id, "nome": loja.nome, "slug": loja.slug, "whatsapp": loja.whatsapp},
    }
