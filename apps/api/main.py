"""
Social Veículos — API Principal (FastAPI)
Roteamento /v1, CORS, error handling, auto-create tabelas.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from config import settings
from database import create_all_tables, engine
import models  # noqa: F401 — registra todos os modelos no metadata
import logging
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

if settings.app_env in ["production", "staging"]:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
else:
    logging.basicConfig(level=logging.INFO)

if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastAPIIntegration
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            integrations=[FastAPIIntegration()],
            traces_sample_rate=1.0 if settings.app_env != "production" else 0.1,
        )
        print(f"[OK] Sentry inicializado no ambiente {settings.app_env}")
    except ImportError:
        print("[AVISO] SDK do Sentry nao instalado. Pulando inicializacao.")

# ── Lifespan (startup/shutdown) ────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cria tabelas no startup (dev). Em prod usar Alembic."""
    if settings.api_debug:          # só em dev local (SQLite)
        await create_all_tables()
        print("[OK] Tabelas do banco criadas/verificadas")

    from marketing_worker import worker_loop
    from esteira_worker import worker_loop as esteira_worker_loop
    from assinatura_worker import worker_loop as assinatura_worker_loop
    worker_task = asyncio.create_task(worker_loop())
    esteira_task = asyncio.create_task(esteira_worker_loop())
    assinatura_task = asyncio.create_task(assinatura_worker_loop())

    yield

    worker_task.cancel()
    esteira_task.cancel()
    assinatura_task.cancel()
    await engine.dispose()


# ── App ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Social Veículos API",
    description="API REST para o ecossistema Social Veículos — Gestor B2B + Vitrine B2C",
    version="0.1.0",
    docs_url="/v1/docs",
    redoc_url="/v1/redoc",
    openapi_url="/v1/openapi.json",
    lifespan=lifespan,
)

import os
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

from starlette.middleware.base import BaseHTTPMiddleware

class SafeBodyDecodeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body_bytes = await request.body()
                    try:
                        body_bytes.decode('utf-8')
                    except UnicodeDecodeError:
                        decoded = body_bytes.decode('latin-1')
                        body_utf8 = decoded.encode('utf-8')
                        async def receive():
                            return {"type": "http.request", "body": body_utf8, "more_body": False}
                        request._receive = receive
                except Exception:
                    pass
        return await call_next(request)

app.add_middleware(SafeBodyDecodeMiddleware)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware de Segurança OWASP ──────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── Error Handler Global ───────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Retorna erro padronizado JSON { error, code }."""
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc) if settings.api_debug else "Erro interno do servidor",
            "code": "INTERNAL_ERROR",
        },
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Recurso não encontrado", "code": "NOT_FOUND"},
    )


@app.exception_handler(422)
async def validation_handler(request: Request, exc):
    return JSONResponse(
        status_code=422,
        content={"error": "Dados inválidos", "code": "VALIDATION_ERROR", "details": str(exc)},
    )


# ── Health Check ────────────────────────────────────────────────
@app.get("/v1/health")
async def health():
    """Health check — confirma que a API está funcionando."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": app.version,
    }


# ── Stats — contagem de entidades no banco ─────────────────────
@app.get("/v1/stats")
async def stats():
    """Retorna contagem das principais entidades do banco."""
    from database import async_session
    async with async_session() as session:
        tables = ["loja", "usuario", "veiculo", "cliente_pf", "lead", "plano", "assinatura"]
        counts = {}
        for table in tables:
            try:
                result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                counts[table] = result.scalar()
            except Exception:
                counts[table] = 0
    return {"counts": counts}


# ── Roteadores ──────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.veiculos import router as veiculos_router
from routers.aprovacoes import router as aprovacoes_router
from routers.admin import router as admin_router
from routers.catalogo import router as catalogo_router
from routers.clientes import router as clientes_router
from routers.leads import router as leads_router
from routers.assinaturas import router as assinaturas_router
from routers.financeiro import router as financeiro_router
from routers.b2b import router as b2b_router
from routers.equipe import router as equipe_router
from routers.configuracoes import router as configuracoes_router
from routers.vitrine_interativo import router as vitrine_interativo_router
from routers.marketplace import router as marketplace_router
from routers.midias import router as midias_router
from routers.lgpd import router as lgpd_router
from routers.simulador_router import router as simulador_router
from routers.assistente import router as assistente_router
import deps
from routers.contratos import router as contratos_router
from routers.marketing import router as marketing_router
from routers.credenciais_ia import router as credenciais_ia_router
from routers.credenciais_detran import router as credenciais_detran_router
from routers.fiscal import router as fiscal_router
from routers.site import router as site_router, public_router as site_public_router
from routers.marketing_social import router as marketing_social_router
from routers.stories import router as stories_router
from routers.triagem import router as triagem_router
from routers.notificacoes import router as notificacoes_router
from routers.esteira import router as esteira_router
from fastapi import Depends

# Incluir roteadores
app.include_router(simulador_router)
app.include_router(assistente_router)
app.include_router(auth_router)
app.include_router(veiculos_router)
app.include_router(aprovacoes_router)
app.include_router(admin_router)
app.include_router(catalogo_router)
app.include_router(clientes_router)
app.include_router(leads_router)
app.include_router(assinaturas_router)
app.include_router(financeiro_router)
app.include_router(b2b_router)
app.include_router(equipe_router)
app.include_router(configuracoes_router)
app.include_router(vitrine_interativo_router)
app.include_router(marketplace_router)
app.include_router(midias_router)
app.include_router(lgpd_router)
app.include_router(contratos_router)
app.include_router(marketing_router)
app.include_router(credenciais_ia_router)
app.include_router(credenciais_detran_router)
app.include_router(fiscal_router)
app.include_router(site_router)
app.include_router(site_public_router)
app.include_router(marketing_social_router)
app.include_router(stories_router)
app.include_router(triagem_router)
app.include_router(notificacoes_router)
app.include_router(esteira_router)




# ── Perfil do Usuário Logado (Me) ──────────────────────────────
@app.get("/v1/me")
async def get_me(current_user: models.Usuario = Depends(deps.get_current_user)):
    """Retorna os dados do usuário autenticado atual."""
    return {
        "id": current_user.id,
        "nome": current_user.nome,
        "email": current_user.email,
        "papel": current_user.papel,
        "ativo": current_user.ativo,
        "mfa_ativo": current_user.mfa_ativo,
    }


@app.get("/v1/me/loja")
async def get_me_loja(context: deps.B2BContext = Depends(deps.get_current_b2b_user)):
    """Retorna as informações da loja (B2B) associada ao usuário autenticado."""
    return {
        "loja": {
            "id": context.loja.id if context.loja else None,
            "nome": context.loja.nome if context.loja else None,
            "slug": context.loja.slug if context.loja else None,
        } if context.loja else None,
        "papel": context.membro.papel if context.membro else context.usuario.papel,
    }


# ── Root redirect ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "Social Veículos API", "docs": "/v1/docs"}


# ── Startup ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_debug,
    )
