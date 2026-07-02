"""
Social Veículos — Rotas de Administração Global da Plataforma (/v1/admin/*)
Acesso exclusivo para usuários com papel admin_plataforma.
"""

import unicodedata
import re
from datetime import timedelta
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from database import get_db
from deps import get_current_active_user
from models import Usuario, Loja, Veiculo, LogAuditoria, PapelUsuario, MembroLoja, Lead
from schemas import LojaResponse, LogAuditoriaResponse
from auth import hash_password, create_access_token

router = APIRouter(prefix="/v1/admin", tags=["Administração Global"])


async def exige_admin_plataforma(current_user: Usuario = Depends(get_current_active_user)) -> Usuario:
    """
    Garante que o usuário logado possui papel de admin_plataforma.
    """
    if current_user.papel != PapelUsuario.ADMIN_PLATAFORMA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Rota exclusiva para administradores da plataforma."
        )
    return current_user


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


# ── Schemas locais ──────────────────────────────────────────────

class LojaDetalheResponse(LojaResponse):
    total_veiculos: int = 0
    total_leads: int = 0
    total_usuarios: int = 0
    modulos_ativos: List[str] = []


class CriarLojaRequest(BaseModel):
    nome: str
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    gestor_nome: str
    gestor_email: str
    gestor_senha: str


class EditarLojaRequest(BaseModel):
    nome: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    telefone: Optional[str] = None


class StatusLojaRequest(BaseModel):
    ativa: bool


class ImpersonarResponse(BaseModel):
    access_token: str
    loja_nome: str


class ResultadoTestesResponse(BaseModel):
    ok: bool
    passou: int
    falhou: int
    erros: int
    duracao_s: float
    resumo: str          # linha final do pytest (ex.: "10 passed in 5.44s")
    saida: str           # saída completa (para inspeção quando algo falha)


# ── Endpoints ───────────────────────────────────────────────────

@router.get(
    "/lojas",
    response_model=List[LojaResponse],
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_todas_lojas(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a lista de todas as lojas cadastradas na plataforma.
    """
    stmt = select(Loja).order_by(Loja.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/lojas/{loja_id}",
    response_model=LojaDetalheResponse,
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_loja_detalhe(
    loja_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retorna detalhe de uma loja com contagens."""
    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    total_veiculos = (await db.execute(
        select(func.count()).select_from(Veiculo).where(Veiculo.loja_id == loja_id)
    )).scalar() or 0

    total_leads = (await db.execute(
        select(func.count()).select_from(Lead).where(Lead.loja_id == loja_id)
    )).scalar() or 0

    total_usuarios = (await db.execute(
        select(func.count()).select_from(MembroLoja).where(MembroLoja.loja_id == loja_id)
    )).scalar() or 0

    return LojaDetalheResponse(
        id=loja.id,
        nome=loja.nome,
        slug=loja.slug,
        cnpj=loja.cnpj,
        telefone=loja.telefone,
        whatsapp=loja.whatsapp,
        email=loja.email,
        endereco=loja.endereco,
        cidade=loja.cidade,
        estado=loja.estado,
        cep=loja.cep,
        verificada=loja.verificada,
        ativa=loja.ativa,
        created_at=loja.created_at,
        total_veiculos=total_veiculos,
        total_leads=total_leads,
        total_usuarios=total_usuarios,
        modulos_ativos=[],
    )


@router.post(
    "/lojas",
    response_model=LojaDetalheResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_loja(
    data: CriarLojaRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Usuario = Depends(exige_admin_plataforma),
):
    """Cria nova loja com gestor inicial."""
    # Verificar se e-mail já existe
    res_email = await db.execute(select(Usuario).where(Usuario.email == data.gestor_email))
    if res_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-mail do gestor já cadastrado.")

    # Gerar slug único
    base_slug = _slugify(data.nome)
    slug = base_slug
    counter = 1
    while True:
        res_slug = await db.execute(select(Loja).where(Loja.slug == slug))
        if not res_slug.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Criar loja
    from uuid import uuid4
    def _uuid(): return str(uuid4())

    nova_loja = Loja(
        id=_uuid(),
        nome=data.nome,
        slug=slug,
        cnpj=data.cnpj,
        cidade=data.cidade,
        estado=data.estado,
    )
    db.add(nova_loja)
    await db.flush()

    # Criar gestor
    gestor = Usuario(
        id=_uuid(),
        nome=data.gestor_nome,
        email=data.gestor_email,
        senha_hash=hash_password(data.gestor_senha),
        papel=PapelUsuario.GESTOR,
        ativo=True,
    )
    db.add(gestor)
    await db.flush()

    # Vincular gestor à loja
    membro = MembroLoja(
        id=_uuid(),
        usuario_id=gestor.id,
        loja_id=nova_loja.id,
        papel=PapelUsuario.GESTOR,
        ativo=True,
    )
    db.add(membro)
    await db.commit()
    await db.refresh(nova_loja)

    return LojaDetalheResponse(
        id=nova_loja.id,
        nome=nova_loja.nome,
        slug=nova_loja.slug,
        cnpj=nova_loja.cnpj,
        telefone=nova_loja.telefone,
        whatsapp=nova_loja.whatsapp,
        email=nova_loja.email,
        endereco=nova_loja.endereco,
        cidade=nova_loja.cidade,
        estado=nova_loja.estado,
        cep=nova_loja.cep,
        verificada=nova_loja.verificada,
        ativa=nova_loja.ativa,
        created_at=nova_loja.created_at,
        total_veiculos=0,
        total_leads=0,
        total_usuarios=1,
        modulos_ativos=[],
    )


@router.patch(
    "/lojas/{loja_id}",
    response_model=LojaResponse,
)
async def editar_loja(
    loja_id: str,
    data: EditarLojaRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Usuario = Depends(exige_admin_plataforma),
):
    """Edita campos da loja."""
    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    if data.nome is not None:
        loja.nome = data.nome
    if data.cidade is not None:
        loja.cidade = data.cidade
    if data.estado is not None:
        loja.estado = data.estado
    if data.telefone is not None:
        loja.telefone = data.telefone

    await db.commit()
    await db.refresh(loja)
    return loja


@router.patch(
    "/lojas/{loja_id}/status",
    response_model=LojaResponse,
)
async def toggle_status_loja(
    loja_id: str,
    data: StatusLojaRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Usuario = Depends(exige_admin_plataforma),
):
    """Ativa ou desativa uma loja."""
    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    loja.ativa = data.ativa
    await db.commit()
    await db.refresh(loja)
    return loja


@router.post(
    "/lojas/{loja_id}/impersonar",
    response_model=ImpersonarResponse,
)
async def impersonar_loja(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Gera token temporário (15 min) para observar a loja como gestor."""
    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    # Buscar o primeiro gestor da loja para usar como sub
    res_membro = await db.execute(
        select(MembroLoja).where(
            MembroLoja.loja_id == loja_id,
            MembroLoja.papel == PapelUsuario.GESTOR,
            MembroLoja.ativo == True,
        ).limit(1)
    )
    membro = res_membro.scalar_one_or_none()
    gestor_id = membro.usuario_id if membro else admin.id

    token = create_access_token(
        data={
            "sub": gestor_id,
            "loja_id": loja_id,
            "papel": "GESTOR",
            "impersonado_por": admin.id,
            "typ": "impersonar",
        },
        expires_delta=timedelta(minutes=15),
    )

    return ImpersonarResponse(access_token=token, loja_nome=loja.nome)


@router.get(
    "/stats",
    response_model=Dict[str, int],
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_stats_globais(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna estatísticas globais de uso e entidades da plataforma.
    """
    stmt_lojas = select(func.count()).select_from(Loja)
    res_lojas = await db.execute(stmt_lojas)
    total_lojas = res_lojas.scalar() or 0

    stmt_lojas_ativas = select(func.count()).select_from(Loja).where(Loja.ativa == True)
    res_lojas_ativas = await db.execute(stmt_lojas_ativas)
    lojas_ativas = res_lojas_ativas.scalar() or 0

    stmt_usuarios = select(func.count()).select_from(Usuario)
    res_usuarios = await db.execute(stmt_usuarios)
    total_usuarios = res_usuarios.scalar() or 0

    stmt_veiculos = select(func.count()).select_from(Veiculo)
    res_veiculos = await db.execute(stmt_veiculos)
    total_veiculos = res_veiculos.scalar() or 0

    stmt_audits = select(func.count()).select_from(LogAuditoria)
    res_audits = await db.execute(stmt_audits)
    total_audits = res_audits.scalar() or 0

    return {
        "total_lojas": total_lojas,
        "lojas_ativas": lojas_ativas,
        "total_usuarios": total_usuarios,
        "total_veiculos": total_veiculos,
        "total_logs_auditoria": total_audits,
    }


@router.get(
    "/auditoria",
    response_model=List[LogAuditoriaResponse],
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_logs_auditoria_globais(
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os logs de auditoria globais de toda a plataforma (histórico de ações).
    """
    stmt = select(LogAuditoria).order_by(LogAuditoria.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Erros reportados pelo front-end ─────────────────────────────

class ReportarErroRequest(BaseModel):
    path: str
    status: int
    timestamp: str
    request_id: Optional[str] = None
    origem: Optional[str] = None  # "gestor" | "vitrine"
    user_name: Optional[str] = None
    user_email: Optional[str] = None


@router.post(
    "/erros",
    status_code=status.HTTP_201_CREATED,
)
async def reportar_erro_servidor(
    data: ReportarErroRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe reporte de erros HTTP 5xx disparados pelo front-end.
    Endpoint público (sem auth) para capturar mesmo quando sessão está inválida.
    """
    import json
    from uuid import uuid4

    detalhes_dict = {
        "path": data.path,
        "status": data.status,
        "timestamp": data.timestamp,
    }
    if data.user_name:
        detalhes_dict["user_name"] = data.user_name
    if data.user_email:
        detalhes_dict["user_email"] = data.user_email

    log = LogAuditoria(
        id=str(uuid4()),
        acao="erro.servidor",
        entidade=data.origem or "frontend",
        entidade_id=data.request_id,
        detalhes=json.dumps(detalhes_dict),
        ator_nome=data.user_name,
    )
    db.add(log)
    await db.commit()
    return {"ok": True}


@router.get(
    "/erros",
    response_model=List[LogAuditoriaResponse],
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_erros_servidor(
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna erros de servidor ativos (visíveis) reportados pelo front-end.
    """
    stmt = (
        select(LogAuditoria)
        .where(LogAuditoria.acao == "erro.servidor", LogAuditoria.visivel == True)
        .order_by(LogAuditoria.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


class AtualizarVisibilidadeRequest(BaseModel):
    visivel: bool


class AtualizarAjusteIARequest(BaseModel):
    ajusteia: bool


@router.get(
    "/erros/ocultados",
    response_model=List[LogAuditoriaResponse],
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_erros_ocultados(
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna erros de servidor ocultados.
    """
    stmt = (
        select(LogAuditoria)
        .where(LogAuditoria.acao == "erro.servidor", LogAuditoria.visivel == False)
        .order_by(LogAuditoria.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch(
    "/erros/{log_id}/visibilidade",
    dependencies=[Depends(exige_admin_plataforma)]
)
async def atualizar_visibilidade_erro(
    log_id: str,
    data: AtualizarVisibilidadeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Altera a visibilidade de um erro de servidor específico.
    """
    res = await db.execute(select(LogAuditoria).where(LogAuditoria.id == log_id, LogAuditoria.acao == "erro.servidor"))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log de erro não encontrado.")
    
    log.visivel = data.visivel
    await db.commit()
    return {"ok": True}


@router.post(
    "/erros/ocultar-todos",
    dependencies=[Depends(exige_admin_plataforma)]
)
async def ocultar_todos_erros(
    db: AsyncSession = Depends(get_db)
):
    """
    Define todos os erros de servidor visíveis como invisíveis (visivel = False).
    """
    from sqlalchemy import update
    stmt = (
        update(LogAuditoria)
        .where(LogAuditoria.acao == "erro.servidor", LogAuditoria.visivel == True)
        .values(visivel=False)
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.post(
    "/erros/restaurar-todos",
    dependencies=[Depends(exige_admin_plataforma)]
)
async def restaurar_todos_erros(
    db: AsyncSession = Depends(get_db)
):
    """
    Define todos os erros de servidor invisíveis como visíveis (visivel = True).
    """
    from sqlalchemy import update
    stmt = (
        update(LogAuditoria)
        .where(LogAuditoria.acao == "erro.servidor", LogAuditoria.visivel == False)
        .values(visivel=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}



@router.patch(
    "/erros/{log_id}/ajusteia",
    dependencies=[Depends(exige_admin_plataforma)]
)
async def atualizar_ajusteia_erro(
    log_id: str,
    data: AtualizarAjusteIARequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Marca ou desmarca se um erro foi resolvido pela IA.
    """
    res = await db.execute(select(LogAuditoria).where(LogAuditoria.id == log_id, LogAuditoria.acao == "erro.servidor"))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log de erro não encontrado.")
    
    log.ajusteia = data.ajusteia
    await db.commit()
    return {"ok": True}


@router.post(
    "/testes/rodar",
    response_model=ResultadoTestesResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def rodar_testes():
    """
    Executa a suíte pytest da API e devolve o resultado.

    Roda em subprocess (isolado do event loop do servidor) com timeout, para o
    suporte poder validar ao vivo, pelo painel admin, que os fluxos críticos
    (auth multi-loja, boot, credenciais) continuam passando.
    """
    import asyncio
    import os
    import re
    import sys
    import time

    api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    inicio = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider",
            cwd=api_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
        returncode = proc.returncode
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        raise HTTPException(status_code=504, detail="A execução dos testes excedeu o tempo limite (180s).")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pytest não está disponível no ambiente da API.")

    duracao = round(time.monotonic() - inicio, 2)
    saida = stdout.decode("utf-8", errors="replace") if stdout else ""

    def _n(pat: str) -> int:
        m = re.search(pat, saida)
        return int(m.group(1)) if m else 0

    passou = _n(r"(\d+) passed")
    falhou = _n(r"(\d+) failed")
    erros = _n(r"(\d+) error")

    resumo_match = re.findall(
        r"^=*\s*\d+\s+(?:passed|failed|error).*$", saida, re.MULTILINE
    )
    resumo = resumo_match[-1].strip("= ").strip() if resumo_match else "sem resumo"

    return ResultadoTestesResponse(
        ok=(returncode == 0),
        passou=passou,
        falhou=falhou,
        erros=erros,
        duracao_s=duracao,
        resumo=resumo,
        saida=saida[-8000:],  # limita para não estourar a resposta
    )

