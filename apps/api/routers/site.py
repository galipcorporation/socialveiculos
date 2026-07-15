"""
Social Veículos — Construtor de Sites (M038, Fase 1 e 2)

Site próprio/white-label por loja: builder no gestor + resolução por host
+ captura de lead pública para o app público (apps/site). Fase 1 cobre só
subdomínio automático ({slug}.socialveiculos.com.br); domínio próprio/SSL
(Cloudflare for SaaS) é Fase 2. Rascunho (`rascunho_json`) nunca vaza ao
público — só o conteúdo publicado é servido em /public/site/{host}.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import settings
from database import get_db
from deps import get_current_b2b_user, B2BContext
from limiter import rate_limit
from models import SiteLoja, Loja, Veiculo, ClientePF, Lead, OrigemLead, EtapaLead, StatusVeiculo
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
# DOMÍNIO PRÓPRIO (M038 — Cloudflare for SaaS)
# ═══════════════════════════════════════════════════════════════

class DominioRequest(BaseModel):
    dominio: str = Field(..., min_length=4, max_length=255)


class DominioResponse(BaseModel):
    dominio_customizado: Optional[str] = None
    dominio_status: str
    dns_target: Optional[str] = None      # CNAME que o cliente deve criar
    txt_name: Optional[str] = None        # registro TXT de validação (enquanto pendente)
    txt_value: Optional[str] = None
    instrucoes: Optional[str] = None


def _normalizar_dominio(bruto: str) -> str:
    d = bruto.strip().lower()
    for prefixo in ("https://", "http://"):
        if d.startswith(prefixo):
            d = d[len(prefixo):]
    d = d.strip("/").split("/")[0]
    return d


@router.post("/dominio", response_model=DominioResponse,
             dependencies=[Depends(exige_modulo(Modulo.SITE)), Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def conectar_dominio(
    data: DominioRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Conecta um domínio próprio ao site da loja via Cloudflare for SaaS.
    Registra o custom hostname e devolve as instruções de DNS (CNAME + TXT)
    que o lojista deve criar no registrador dele. A validação e o SSL são
    conferidos depois em GET /dominio."""
    from cloudflare_saas import criar_custom_hostname

    dominio = _normalizar_dominio(data.dominio)
    if "." not in dominio or " " in dominio:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Informe um domínio válido, ex.: www.sualoja.com.br")

    site = await _carregar_ou_criar(db, context.loja_id)

    # Domínio já usado por outra loja?
    res = await db.execute(
        select(SiteLoja).where(SiteLoja.dominio_customizado == dominio, SiteLoja.loja_id != context.loja_id)
    )
    if res.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Este domínio já está em uso por outra loja.")

    try:
        cf = await criar_custom_hostname(dominio)
    except RuntimeError as e:
        # Cloudflare não configurado na plataforma.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:  # httpx erros da API Cloudflare
        logger.error(f"[CLOUDFLARE] Falha ao criar custom hostname {dominio}: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar o domínio na Cloudflare. Tente novamente.")

    site.dominio_customizado = dominio
    site.dominio_cf_id = cf["id"]
    site.dominio_status = cf["status"]
    site.dominio_txt_name = cf["txt_name"]
    site.dominio_txt_value = cf["txt_value"]
    await db.commit()
    await db.refresh(site)

    return _dominio_response(site, cf["dns_target"])


@router.get("/dominio", response_model=DominioResponse,
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))])
async def status_dominio(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Consulta o status atual do domínio próprio, atualizando-o a partir da
    Cloudflare (validação DNS + emissão do certificado SSL)."""
    from cloudflare_saas import status_custom_hostname

    site = await _carregar_ou_criar(db, context.loja_id)
    if not site.dominio_customizado or not site.dominio_cf_id:
        return DominioResponse(dominio_status="pendente")

    try:
        cf = await status_custom_hostname(site.dominio_cf_id)
        site.dominio_status = cf["status"]
        if cf["txt_name"]:
            site.dominio_txt_name = cf["txt_name"]
            site.dominio_txt_value = cf["txt_value"]
        await db.commit()
        await db.refresh(site)
        dns_target = cf["dns_target"]
    except RuntimeError:
        dns_target = settings.cloudflare_fallback_origin
    except Exception as e:
        logger.warning(f"[CLOUDFLARE] Falha ao consultar status de {site.dominio_customizado}: {e}")
        dns_target = settings.cloudflare_fallback_origin

    return _dominio_response(site, dns_target)


@router.delete("/dominio", response_model=DominioResponse,
               dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def desconectar_dominio(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Remove o domínio próprio (o site continua no subdomínio automático)."""
    from cloudflare_saas import remover_custom_hostname

    site = await _carregar_ou_criar(db, context.loja_id)
    if site.dominio_cf_id:
        try:
            await remover_custom_hostname(site.dominio_cf_id)
        except Exception as e:
            logger.warning(f"[CLOUDFLARE] Falha ao remover custom hostname: {e}")  # segue removendo local

    site.dominio_customizado = None
    site.dominio_cf_id = None
    site.dominio_status = "pendente"
    site.dominio_txt_name = None
    site.dominio_txt_value = None
    await db.commit()
    await db.refresh(site)
    return DominioResponse(dominio_status="pendente")


def _dominio_response(site: SiteLoja, dns_target: Optional[str]) -> DominioResponse:
    instr = None
    if site.dominio_customizado and site.dominio_status != "ativo":
        instr = (
            f"No seu registrador de domínio, crie um CNAME de '{site.dominio_customizado}' "
            f"apontando para '{dns_target}'."
        )
        if site.dominio_txt_name:
            instr += f" E um registro TXT '{site.dominio_txt_name}' com o valor fornecido, para validar o SSL."
    return DominioResponse(
        dominio_customizado=site.dominio_customizado,
        dominio_status=site.dominio_status,
        dns_target=dns_target,
        txt_name=site.dominio_txt_name,
        txt_value=site.dominio_txt_value,
        instrucoes=instr,
    )


# ═══════════════════════════════════════════════════════════════
# SITEMAP (consumido pelo prerender de apps/site)
# ═══════════════════════════════════════════════════════════════

@public_router.get("/_sitemap/hosts")
async def listar_hosts_publicados(db: AsyncSession = Depends(get_db)):
    """Lista os hosts (subdomínio, e domínio próprio quando ativo) de todos os
    sites publicados — consumido pelo script de prerender do apps/site."""
    res = await db.execute(select(SiteLoja).where(SiteLoja.publicado == True))
    sites = res.scalars().all()
    hosts = []
    for s in sites:
        hosts.append(f"{s.subdominio}.socialveiculos.com.br")
        if s.dominio_customizado and s.dominio_status == "ativo":
            hosts.append(s.dominio_customizado)
    return {"hosts": hosts}


# ═══════════════════════════════════════════════════════════════
# RESOLUÇÃO POR HOST (público — consumido pelo futuro app apps/site)
# ═══════════════════════════════════════════════════════════════

async def _resolver_site_publicado(db: AsyncSession, host: str) -> SiteLoja:
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
    return site


@public_router.get("/{host}")
async def obter_site_publico(host: str, db: AsyncSession = Depends(get_db)):
    """Resolve um host (subdomínio ou domínio próprio) para a config publicada
    do site + identidade da loja. Nunca retorna rascunho não publicado."""
    site = await _resolver_site_publicado(db, host)

    res_loja = await db.execute(select(Loja).where(Loja.id == site.loja_id, Loja.ativa == True))
    loja = res_loja.scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada ou inativa.")

    total_veiculos_res = await db.execute(
        select(Veiculo.id).where(
            Veiculo.loja_id == loja.id,
            Veiculo.publicado_marketplace == True,
            Veiculo.status == StatusVeiculo.DISPONIVEL,
        )
    )
    total_veiculos = len(total_veiculos_res.all())

    return {
        "site": _to_response(site),
        "loja": {
            "id": loja.id,
            "nome": loja.nome,
            "slug": loja.slug,
            "whatsapp": loja.whatsapp,
            "cidade": loja.cidade,
            "estado": loja.estado,
            "verificada": bool(loja.verificada),
            "total_veiculos": total_veiculos,
        },
    }


# ═══════════════════════════════════════════════════════════════
# CAPTURA DE LEAD (público, anônimo — form de contato do site)
# ═══════════════════════════════════════════════════════════════

class LeadSiteRequest(BaseModel):
    host: str
    nome: str = Field(..., min_length=2, max_length=200)
    telefone: str = Field(..., min_length=8, max_length=20)
    email: Optional[EmailStr] = None
    mensagem: Optional[str] = Field(None, max_length=1000)
    veiculo_id: Optional[str] = None


@public_router.post("/lead", dependencies=[Depends(rate_limit(5, 60))])
async def criar_lead_site(data: LeadSiteRequest, db: AsyncSession = Depends(get_db)):
    """Formulário de contato do site público → Lead no CRM da loja, com
    origem `site_proprio`. Endpoint anônimo — protegido por rate limit
    (5/min) já que não exige autenticação nem publicação prévia de conta."""
    site = await _resolver_site_publicado(db, data.host)

    # Reaproveita ClientePF existente pelo telefone, ou cria um novo (sem exigir login).
    res_cliente = await db.execute(
        select(ClientePF).where(ClientePF.loja_id == site.loja_id, ClientePF.telefone == data.telefone)
    )
    cliente = res_cliente.scalar_one_or_none()
    if not cliente:
        cliente = ClientePF(loja_id=site.loja_id, nome=data.nome, telefone=data.telefone, email=data.email)
        db.add(cliente)
        await db.flush()

    lead = Lead(
        loja_id=site.loja_id,
        cliente_id=cliente.id,
        veiculo_id=data.veiculo_id,
        origem=OrigemLead.SITE_PROPRIO,
        etapa=EtapaLead.LEAD,
        observacoes=f"Lead gerado via site próprio. Mensagem: {data.mensagem}" if data.mensagem else "Lead gerado via site próprio.",
    )
    db.add(lead)
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# SEO TÉCNICO — sitemap.xml e robots.txt por host publicado
# ═══════════════════════════════════════════════════════════════

@public_router.get("/{host}/sitemap.xml")
async def sitemap_site(host: str, db: AsyncSession = Depends(get_db)):
    """Sitemap XML das páginas estáticas + estoque do site publicado deste host."""
    site = await _resolver_site_publicado(db, host)
    base = f"https://{host}"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls = [(f"{base}/", now), (f"{base}/contato", now)]
    secoes = json.loads(site.secoes_ativas) if site.secoes_ativas else {}
    if secoes.get("estoque", True):
        urls.append((f"{base}/estoque", now))
    if secoes.get("sobre", True) and site.sobre_texto:
        urls.append((f"{base}/sobre", now))
    if secoes.get("financiamento", True):
        urls.append((f"{base}/financiamento", now))

    itens = "".join(
        f"<url><loc>{xml_escape(loc)}</loc><lastmod>{lastmod}</lastmod></url>"
        for loc, lastmod in urls
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{itens}"
        "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@public_router.get("/{host}/robots.txt")
async def robots_site(host: str, db: AsyncSession = Depends(get_db)):
    """robots.txt do site publicado — 404 (bloqueia indexação implicitamente
    via ausência) se o host não corresponder a nenhum site publicado."""
    await _resolver_site_publicado(db, host)
    sitemap_url = f"{settings.api_base_url}/v1/public/site/{host}/sitemap.xml"
    corpo = f"User-agent: *\nAllow: /\n\nSitemap: {sitemap_url}\n"
    return Response(content=corpo, media_type="text/plain")
