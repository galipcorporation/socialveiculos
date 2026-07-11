"""
Social Veículos — Marketing: Redes Sociais + Agendamento (M024)
OAuth Meta (Instagram/Facebook), publicação imediata e agendamento de posts.
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from cryptography.fernet import Fernet

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import CredencialRedeSocial, PostAgendado, Veiculo
from modulos import exige_modulo, Modulo

router = APIRouter(prefix="/v1", tags=["Marketing Social"])

# ── Fernet (reutiliza a mesma chave das credenciais bancárias) ──
_FERNET_KEY = os.getenv("FERNET_KEY", "")
_fernet: Optional[Fernet] = Fernet(_FERNET_KEY.encode()) if _FERNET_KEY else None


def _cifrar(texto: str) -> str:
    if not _fernet:
        raise HTTPException(503, "Chave de criptografia não configurada (FERNET_KEY).")
    return _fernet.encrypt(texto.encode()).decode()


def _decifrar(cifrado: str) -> str:
    if not _fernet:
        raise HTTPException(503, "Chave de criptografia não configurada (FERNET_KEY).")
    return _fernet.decrypt(cifrado.encode()).decode()


# ══════════════════════════════════════════════════════════════
# REDES SOCIAIS — listagem de conexões
# ══════════════════════════════════════════════════════════════

class RedeSocialStatus(BaseModel):
    rede: str
    page_id: Optional[str] = None
    instagram_account_id: Optional[str] = None
    token_expira_em: Optional[str] = None
    conectada: bool


@router.get(
    "/configuracoes/redes-sociais",
    response_model=list[RedeSocialStatus],
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def listar_redes_sociais(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CredencialRedeSocial).where(
        CredencialRedeSocial.loja_id == ctx.loja_id,
        CredencialRedeSocial.ativo == True,
    )
    result = await db.execute(stmt)
    creds = result.scalars().all()
    return [
        RedeSocialStatus(
            rede=c.rede,
            page_id=c.page_id,
            instagram_account_id=c.instagram_account_id,
            token_expira_em=c.token_expira_em.isoformat() if c.token_expira_em else None,
            conectada=True,
        )
        for c in creds
    ]


@router.delete(
    "/configuracoes/redes-sociais/{rede}",
    status_code=204,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def desconectar_rede(
    rede: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CredencialRedeSocial).where(
        CredencialRedeSocial.loja_id == ctx.loja_id,
        CredencialRedeSocial.rede == rede,
    )
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()
    if cred:
        await db.delete(cred)
        await db.commit()


# ══════════════════════════════════════════════════════════════
# OAUTH META — Instagram + Facebook
# ══════════════════════════════════════════════════════════════

META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "")  # ex: https://app.socialveiculos.com.br/api/v1/social-auth/meta/callback

_META_SCOPES = "pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement,pages_manage_posts"


# Sessões pendentes de OAuth Meta para escolha de página (chave: nonce)
_oauth_sessions: dict[str, dict] = {}


def _gerar_state_assinado(loja_id: str, origem: str = "web") -> tuple[str, str]:
    import hmac
    import hashlib
    import time
    import base64
    import uuid
    nonce = str(uuid.uuid4())
    ts = int(time.time())
    payload = json.dumps({"loja_id": loja_id, "nonce": nonce, "ts": ts, "origem": origem}, separators=(',', ':'))
    sig = hmac.new(_FERNET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw_state = f"{payload}.{sig}"
    state = base64.urlsafe_b64encode(raw_state.encode()).decode().rstrip("=")
    return state, nonce


def _verificar_state_assinado(state: str) -> tuple[str, str, str]:
    import hmac
    import hashlib
    import time
    import base64
    try:
        padding = 4 - (len(state) % 4)
        if padding < 4:
            state += "=" * padding
        raw_state = base64.urlsafe_b64decode(state.encode()).decode()
        parts = raw_state.rsplit(".", 1)
        if len(parts) != 2:
            raise HTTPException(400, "State inválido.")
        payload_json, sig = parts
        expected_sig = hmac.new(_FERNET_KEY.encode(), payload_json.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise HTTPException(400, "State inválido.")
        payload = json.loads(payload_json)
        if int(time.time()) - payload["ts"] > 600:
            raise HTTPException(400, "State expirado.")
        return payload["loja_id"], payload["nonce"], payload.get("origem", "web")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(400, "State inválido ou expirado.")


def _redirect_final(origem: str, escolher_nonce: Optional[str] = None) -> str:
    """Monta a URL de retorno pós-OAuth: deep link do app mobile ou path do gestor web."""
    if origem == "app":
        base = "socialveiculos://meta-callback"
        return f"{base}?escolher={escolher_nonce}" if escolher_nonce else base
    base = "/configuracoes"
    return f"{base}?escolher={escolher_nonce}" if escolher_nonce else base


@router.get("/social-auth/meta/iniciar")
async def meta_oauth_iniciar(
    origem: str = Query("web", pattern="^(web|app)$"),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    """Gera URL de autorização OAuth do Meta. Frontend redireciona para ela."""
    if not META_APP_ID or not META_REDIRECT_URI:
        raise HTTPException(503, "OAuth Meta não configurado (META_APP_ID / META_REDIRECT_URI ausentes).")
    state, _ = _gerar_state_assinado(ctx.loja_id, origem)
    url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={META_APP_ID}"
        f"&redirect_uri={META_REDIRECT_URI}"
        f"&scope={_META_SCOPES}"
        f"&state={state}"
        f"&response_type=code"
    )
    return {"url": url}


@router.get("/social-auth/meta/callback")
async def meta_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Troca code por access_token de longa duração e salva credencial."""
    if not META_APP_ID or not META_APP_SECRET or not META_REDIRECT_URI:
        raise HTTPException(503, "OAuth Meta não configurado.")

    loja_id, nonce, origem = _verificar_state_assinado(state)

    # Troca code por token curto
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "redirect_uri": META_REDIRECT_URI,
                "code": code,
            },
            timeout=15.0,
        )
        if r.status_code != 200:
            raise HTTPException(502, f"Erro ao obter token Meta: {r.text}")
        short_token = r.json().get("access_token", "")

        # Troca por token de longa duração (60 dias)
        r2 = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "fb_exchange_token": short_token,
            },
            timeout=15.0,
        )
        long_token = r2.json().get("access_token", "")
        expires_in = r2.json().get("expires_in", 5184000)  # 60 dias default

        # Busca páginas e conta IG vinculada
        r3 = await client.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": long_token, "fields": "id,name,instagram_business_account"},
            timeout=15.0,
        )
        pages = r3.json().get("data", [])

    from datetime import timedelta
    expira = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Se houver mais de uma página, guarda na sessão pendente e redireciona para a escolha no front
    if len(pages) > 1:
        # Limpa sessões expiradas
        agora = datetime.now(timezone.utc)
        for k in list(_oauth_sessions.keys()):
            if (agora - _oauth_sessions[k]["created_at"]).total_seconds() > 600:
                _oauth_sessions.pop(k, None)

        paginas_list = []
        for p in pages:
            ig_id = None
            if p.get("instagram_business_account"):
                ig_id = p["instagram_business_account"].get("id")
            paginas_list.append({
                "page_id": p["id"],
                "name": p["name"],
                "instagram_account_id": ig_id
            })

        _oauth_sessions[nonce] = {
            "loja_id": loja_id,
            "long_token": long_token,
            "expira": expira,
            "paginas": paginas_list,
            "created_at": agora
        }

        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=_redirect_final(origem, nonce))

    page_id = pages[0]["id"] if pages else None
    ig_id = None
    if pages and pages[0].get("instagram_business_account"):
        ig_id = pages[0]["instagram_business_account"].get("id")

    # Salva / atualiza credencial
    for rede in (["instagram"] if ig_id else []) + ["facebook"]:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == loja_id,
            CredencialRedeSocial.rede == rede,
        )
        res = await db.execute(stmt)
        cred = res.scalar_one_or_none()
        token_cifrado = _cifrar(long_token)
        if cred:
            cred.access_token_cifrado = token_cifrado
            cred.token_expira_em = expira
            cred.page_id = page_id
            cred.instagram_account_id = ig_id
            cred.ativo = True
            cred.atualizado_em = datetime.now(timezone.utc)
        else:
            db.add(CredencialRedeSocial(
                loja_id=loja_id, rede=rede,
                access_token_cifrado=token_cifrado,
                token_expira_em=expira,
                page_id=page_id,
                instagram_account_id=ig_id,
                ativo=True,
            ))
    await db.commit()
    # Redireciona de volta para Configurações (web) ou app mobile via deep link
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=_redirect_final(origem))


@router.get("/social-auth/meta/paginas")
async def meta_oauth_listar_paginas(
    nonce: str = Query(...),
):
    """Retorna as páginas temporárias para escolha do usuário."""
    sessao = _oauth_sessions.get(nonce)
    if not sessao:
        raise HTTPException(400, "Sessão expirada ou inválida.")
    # Verifica expiração (10 min)
    if (datetime.now(timezone.utc) - sessao["created_at"]).total_seconds() > 600:
        _oauth_sessions.pop(nonce, None)
        raise HTTPException(400, "Sessão expirada.")
    return sessao["paginas"]


class ConfirmarPaginaRequest(BaseModel):
    nonce: str
    page_id: str


@router.post("/social-auth/meta/confirmar")
async def meta_oauth_confirmar_pagina(
    data: ConfirmarPaginaRequest,
    db: AsyncSession = Depends(get_db),
):
    """Confirma a página escolhida pelo usuário e salva as credenciais."""
    sessao = _oauth_sessions.pop(data.nonce, None)
    if not sessao:
        raise HTTPException(400, "Sessão expirada ou inválida.")
    if (datetime.now(timezone.utc) - sessao["created_at"]).total_seconds() > 600:
        raise HTTPException(400, "Sessão expirada.")

    pagina_escolhida = next((p for p in sessao["paginas"] if p["page_id"] == data.page_id), None)
    if not pagina_escolhida:
        raise HTTPException(400, "Página inválida.")

    loja_id = sessao["loja_id"]
    long_token = sessao["long_token"]
    expira = sessao["expira"]
    page_id = pagina_escolhida["page_id"]
    ig_id = pagina_escolhida["instagram_account_id"]

    for rede in (["instagram"] if ig_id else []) + ["facebook"]:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == loja_id,
            CredencialRedeSocial.rede == rede,
        )
        res = await db.execute(stmt)
        cred = res.scalar_one_or_none()
        token_cifrado = _cifrar(long_token)
        if cred:
            cred.access_token_cifrado = token_cifrado
            cred.token_expira_em = expira
            cred.page_id = page_id
            cred.instagram_account_id = ig_id
            cred.ativo = True
            cred.atualizado_em = datetime.now(timezone.utc)
        else:
            db.add(CredencialRedeSocial(
                loja_id=loja_id, rede=rede,
                access_token_cifrado=token_cifrado,
                token_expira_em=expira,
                page_id=page_id,
                instagram_account_id=ig_id,
                ativo=True,
            ))
    await db.commit()
    return {"status": "sucesso"}


# ══════════════════════════════════════════════════════════════
# PUBLICAÇÃO IMEDIATA
# ══════════════════════════════════════════════════════════════

class PublicarRequest(BaseModel):
    texto: str
    hashtags: list[str] = []
    redes: list[str]
    veiculo_id: Optional[str] = None


class PublicarResponse(BaseModel):
    resultados: list[dict]


async def _publicar_na_rede(rede: str, texto_completo: str, midia_url: Optional[str], cred: CredencialRedeSocial) -> dict:
    """Tenta publicar em uma rede. Retorna { rede, sucesso, erro? }."""
    if rede == "instagram" and not midia_url:
        return {"rede": rede, "sucesso": False, "erro": "Instagram exige ao menos uma foto no veículo."}

    try:
        token = _decifrar(cred.access_token_cifrado)
        async with httpx.AsyncClient(timeout=30.0) as client:
            if rede == "facebook" and cred.page_id:
                r = await client.post(
                    f"https://graph.facebook.com/v19.0/{cred.page_id}/feed",
                    json={"message": texto_completo, "access_token": token},
                )
                r.raise_for_status()
                return {"rede": rede, "sucesso": True}

            if rede == "instagram" and cred.instagram_account_id and midia_url:
                # Cria container de mídia
                r1 = await client.post(
                    f"https://graph.facebook.com/v19.0/{cred.instagram_account_id}/media",
                    json={"image_url": midia_url, "caption": texto_completo, "access_token": token},
                )
                r1.raise_for_status()
                container_id = r1.json().get("id")
                # Publica o container
                r2 = await client.post(
                    f"https://graph.facebook.com/v19.0/{cred.instagram_account_id}/media_publish",
                    json={"creation_id": container_id, "access_token": token},
                )
                r2.raise_for_status()
                return {"rede": rede, "sucesso": True}

            return {"rede": rede, "sucesso": False, "erro": "Configuração incompleta para esta rede."}
    except Exception as e:
        return {"rede": rede, "sucesso": False, "erro": str(e)}


@router.post(
    "/marketing/publicar",
    response_model=PublicarResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def publicar_post(
    data: PublicarRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    texto_completo = data.texto
    if data.hashtags:
        texto_completo += "\n\n" + " ".join(f"#{h}" for h in data.hashtags)

    midia_url = None
    if data.veiculo_id:
        from sqlalchemy.orm import selectinload
        stmt_v = select(Veiculo).options(selectinload(Veiculo.midias)).where(
            Veiculo.id == data.veiculo_id, Veiculo.loja_id == ctx.loja_id
        )
        v = (await db.execute(stmt_v)).scalar_one_or_none()
        if v and v.midias:
            midia_url = next((m.url for m in v.midias if m.url), None)

    resultados = []
    for rede in data.redes:
        stmt = select(CredencialRedeSocial).where(
            CredencialRedeSocial.loja_id == ctx.loja_id,
            CredencialRedeSocial.rede == rede,
            CredencialRedeSocial.ativo == True,
        )
        cred = (await db.execute(stmt)).scalar_one_or_none()
        if not cred:
            resultados.append({"rede": rede, "sucesso": False, "erro": "Rede não conectada."})
            continue
        resultado = await _publicar_na_rede(rede, texto_completo, midia_url, cred)
        resultados.append(resultado)

    return PublicarResponse(resultados=resultados)


# ══════════════════════════════════════════════════════════════
# AGENDAMENTO
# ══════════════════════════════════════════════════════════════

class AgendarRequest(BaseModel):
    texto: str
    hashtags: list[str] = []
    redes: list[str]
    publicar_em: datetime
    veiculo_id: Optional[str] = None


class PostAgendadoResponse(BaseModel):
    id: str
    redes: list[str]
    texto: str
    hashtags: list[str]
    status: str
    publicar_em: str
    publicado_em: Optional[str] = None
    erro: Optional[str] = None
    criado_em: str


@router.post(
    "/marketing/agendar",
    response_model=PostAgendadoResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def agendar_post(
    data: AgendarRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    if data.publicar_em.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(400, "publicar_em deve ser no futuro.")

    midia_urls = None
    has_midia = False
    if data.veiculo_id:
        from sqlalchemy.orm import selectinload
        stmt_v = select(Veiculo).options(selectinload(Veiculo.midias)).where(
            Veiculo.id == data.veiculo_id, Veiculo.loja_id == ctx.loja_id
        )
        v = (await db.execute(stmt_v)).scalar_one_or_none()
        if v and v.midias:
            urls = [m.url for m in v.midias if m.url]
            if urls:
                midia_urls = json.dumps(urls)
                has_midia = True

    if "instagram" in data.redes and not has_midia:
        raise HTTPException(400, "Instagram exige ao menos uma foto no veículo.")

    post = PostAgendado(
        loja_id=ctx.loja_id,
        veiculo_id=data.veiculo_id,
        redes=json.dumps(data.redes),
        texto=data.texto,
        hashtags=json.dumps(data.hashtags),
        midia_urls=midia_urls,
        status="agendado",
        publicar_em=data.publicar_em.replace(tzinfo=None),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _post_response(post)


@router.get(
    "/marketing/historico",
    response_model=list[PostAgendadoResponse],
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def historico_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PostAgendado)
        .where(PostAgendado.loja_id == ctx.loja_id)
        .order_by(PostAgendado.criado_em.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    posts = result.scalars().all()
    return [_post_response(p) for p in posts]


@router.delete(
    "/marketing/posts/{post_id}",
    status_code=204,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def cancelar_post(
    post_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PostAgendado).where(PostAgendado.id == post_id, PostAgendado.loja_id == ctx.loja_id)
    post = (await db.execute(stmt)).scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post não encontrado.")
    if post.status != "agendado":
        raise HTTPException(400, "Apenas posts agendados podem ser cancelados.")
    post.status = "cancelado"
    await db.commit()


def _post_response(p: PostAgendado) -> PostAgendadoResponse:
    return PostAgendadoResponse(
        id=p.id,
        redes=json.loads(p.redes) if p.redes else [],
        texto=p.texto,
        hashtags=json.loads(p.hashtags) if p.hashtags else [],
        status=p.status,
        publicar_em=p.publicar_em.isoformat() if p.publicar_em else "",
        publicado_em=p.publicado_em.isoformat() if p.publicado_em else None,
        erro=p.erro,
        criado_em=p.criado_em.isoformat() if p.criado_em else "",
    )
