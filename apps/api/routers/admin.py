"""
Social Veículos — Rotas de Administração Global da Plataforma (/v1/admin/*)
Acesso exclusivo para usuários com papel admin_plataforma.
"""

import csv
import html as html_lib
import io
import json
import unicodedata
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

from database import get_db
from deps import get_current_active_user, registrar_auditoria
from models import (
    Usuario, Loja, Veiculo, LogAuditoria, PapelUsuario, MembroLoja, Lead, ModuloHabilitado,
    Plano, Assinatura, Pagamento, StatusAssinatura, StatusPagamento, ContratoAssinaturaVersao, utcnow,
    DestaquePagamento, MarketingUsage,
)
from schemas import (
    LojaResponse, LogAuditoriaResponse,
    AssinaturaResponse, PagamentoResponse, PlanoResponse,
    AdminAtivarAssinaturaRequest, AdminRenovarAssinaturaRequest, AdminSuspenderAssinaturaRequest,
    AdminReativarAssinaturaRequest, AdminTrocarPlanoRequest, AdminCortesiasRequest,
    AdminDiffModulosResponse, AdminModuloStatusItem,
    AdminAssinaturaDetalheResponse, AdminVencimentoItem,
    AdminCriarPlanoRequest, AdminEditarPlanoRequest,
    ContratoVersaoResponse, ContratoVersaoCreateRequest,
    ContratoAssinaturaVariaveisResponse, ContratoAssinaturaVariavelItem,
    ContratoAssinaturaPreviewRequest, ContratoAssinaturaPreviewResponse,
    ContratoAssinaturaEnviarRequest, ContratoAssinaturaEnviarResponse,
    DestaquePagamentoResponse, AdminAtivarDestaqueRequest, AdminDesativarDestaqueRequest,
    AdminDestaqueDetalheResponse,
    AdminUsuarioItem, AdminResetSenhaRequest, AdminUsuarioVinculo,
    AdminUsuarioUpdateRequest, AdminVinculoCreateRequest, AdminVinculoUpdateRequest,
    AdminLogAuditoriaItem, AdminAuditoriaPageResponse,
    AdminFacetaItem, AdminAuditoriaFacetasResponse,
)
from auth import hash_password, create_access_token
from config import settings
from email_service import enviar_email, render_contrato_para_assinatura
from contrato_modelos_padrao import semear_modelos_padrao
from lib_formatacao import formatar_moeda
from pdf_service import html_para_pdf
from storage import storage_provider
from modulos import Modulo, assinatura_em_dia
from plano_acesso import (
    STATUS_RECUPERAVEIS,
    acesso_liberado,
    definir_cortesias,
    modulos_do_plano,
    prever_troca_plano,
    proximo_vencimento_apos,
    reativar_loja,
    sincronizar_modulos,
)

router = APIRouter(prefix="/v1/admin", tags=["Administração Global"])

# Imagens aceitas para logo da loja (mesma whitelist do storage)
_LOGO_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_LOGO_MAX_BYTES = 2 * 1024 * 1024  # 2 MB


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
    assinatura_em_dia: bool = False


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
    whatsapp: Optional[str] = None
    cnpj: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    modulos_ativos: Optional[List[str]] = None


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

    modulos_ativos_db = (await db.execute(
        select(ModuloHabilitado.nome_modulo)
        .where(ModuloHabilitado.loja_id == loja_id, ModuloHabilitado.ativo == True)
    )).scalars().all()

    em_dia = await assinatura_em_dia(db, loja_id)

    return LojaDetalheResponse(
        id=loja.id,
        nome=loja.nome,
        slug=loja.slug,
        cnpj=loja.cnpj,
        logo_url=loja.logo_url,
        telefone=loja.telefone,
        whatsapp=loja.whatsapp,
        email=loja.email,
        endereco=loja.endereco,
        cidade=loja.cidade,
        estado=loja.estado,
        cep=loja.cep,
        verificada=loja.verificada,
        ativa=loja.ativa,
        destaque=loja.destaque,
        destaque_ate=loja.destaque_ate,
        created_at=loja.created_at,
        total_veiculos=total_veiculos,
        total_leads=total_leads,
        total_usuarios=total_usuarios,
        modulos_ativos=list(modulos_ativos_db),
        assinatura_em_dia=em_dia,
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
    """Cria nova loja com gestor inicial. Se o e-mail já existir e a pessoa não
    tiver vínculo ativo com nenhuma loja (ex: ex-vendedor removido da equipe),
    reaproveita o usuário existente como gestor da nova loja."""
    # Verificar se e-mail já existe
    res_email = await db.execute(select(Usuario).where(Usuario.email == data.gestor_email))
    usuario_existente = res_email.scalar_one_or_none()

    reaproveitar_usuario = False
    if usuario_existente:
        if usuario_existente.papel == PapelUsuario.ADMIN_PLATAFORMA:
            raise HTTPException(
                status_code=400,
                detail="Este e-mail pertence a um admin da plataforma e não pode virar gestor de loja.",
            )
        res_vinc_ativo = await db.execute(
            select(MembroLoja).where(
                MembroLoja.usuario_id == usuario_existente.id,
                MembroLoja.ativo.is_(True),
            )
        )
        if res_vinc_ativo.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="E-mail do gestor já cadastrado e vinculado ativamente a outra loja.",
            )
        reaproveitar_usuario = True

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

    # Loja nova já nasce com os modelos de contrato prontos para uso
    await semear_modelos_padrao(db, nova_loja.id)

    # Criar ou reaproveitar gestor
    if reaproveitar_usuario:
        gestor = usuario_existente
        gestor.nome = data.gestor_nome
        gestor.senha_hash = hash_password(data.gestor_senha)
        gestor.papel = PapelUsuario.GESTOR
        gestor.ativo = True
    else:
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
    """Edita campos da loja e gerencia os módulos habilitados."""
    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    if data.nome is not None:
        loja.nome = data.nome.strip() if data.nome else ""
    if data.cidade is not None:
        loja.cidade = data.cidade.strip() or None
    if data.estado is not None:
        loja.estado = data.estado.strip() or None
    if data.telefone is not None:
        loja.telefone = data.telefone.strip() or None
    if data.whatsapp is not None:
        loja.whatsapp = data.whatsapp.strip() or None
    if data.cnpj is not None:
        loja.cnpj = data.cnpj.strip() or None
    if data.endereco is not None:
        loja.endereco = data.endereco.strip() or None
    if data.cep is not None:
        loja.cep = data.cep.strip() or None

    if data.modulos_ativos is not None:
        # Os módulos do PLANO não se editam aqui — quem manda neles é o plano
        # contratado (ver plano_acesso.sincronizar_modulos). Antes este bloco
        # apagava tudo e recriava do zero, desfazendo o que a ativação do plano
        # tinha habilitado. O que sobra é a liberação de cortesia.
        assinatura = await _assinatura_mais_recente(db, loja_id)
        plano = None
        if assinatura and assinatura.status in STATUS_RECUPERAVEIS:
            plano = (await db.execute(
                select(Plano).where(Plano.id == assinatura.plano_id)
            )).scalar_one_or_none()
        await definir_cortesias(db, loja_id, plano, data.modulos_ativos)

    await db.commit()
    await db.refresh(loja)
    return loja


@router.post(
    "/lojas/{loja_id}/logo",
    response_model=LojaResponse,
)
async def upload_logo_loja(
    loja_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: Usuario = Depends(exige_admin_plataforma),
):
    """Sobe a logo da loja (usada em contratos, vitrine e marca-d'água padrão)."""
    if file.content_type not in _LOGO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem PNG, JPG ou WEBP.")
    content = await file.read()
    if len(content) > _LOGO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Imagem muito grande. Máximo 2MB.")

    res = await db.execute(select(Loja).where(Loja.id == loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    url = await storage_provider.upload_file(
        content, file.filename or "logo.png", file.content_type,
        prefixo=f"lojas/{loja_id}/identidade",
    )
    loja.logo_url = url
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


# ── Usuários — busca e reset de senha ────────────────────────────

@router.get(
    "/usuarios",
    response_model=List[AdminUsuarioItem],
)
async def buscar_usuarios(
    busca: str = "",
    db: AsyncSession = Depends(get_db),
    _admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Lista usuários da plataforma (admin, gestores, vendedores, clientes)
    para administração de contas — ex.: redefinir senha de quem esqueceu.
    """
    stmt = select(Usuario).order_by(Usuario.nome).limit(30)
    termo = busca.strip().lower()
    if termo:
        like = f"%{termo}%"
        stmt = stmt.where(func.lower(Usuario.email).like(like) | func.lower(Usuario.nome).like(like))
    usuarios = (await db.execute(stmt)).scalars().all()

    lojas_por_usuario: Dict[str, List[str]] = {}
    vinculos_por_usuario: Dict[str, List[AdminUsuarioVinculo]] = {}
    ids = [u.id for u in usuarios]
    if ids:
        # LEFT JOIN de propósito: vínculo apontando para loja removida não pode
        # sumir com o usuário da lista — é justamente o registro a ser corrigido aqui.
        res_lojas = await db.execute(
            select(MembroLoja, Loja.nome)
            .outerjoin(Loja, Loja.id == MembroLoja.loja_id)
            .where(MembroLoja.usuario_id.in_(ids))
            .order_by(MembroLoja.created_at)
        )
        for membro, loja_nome in res_lojas.all():
            loja_nome = loja_nome or "(loja removida)"
            lojas_por_usuario.setdefault(membro.usuario_id, []).append(loja_nome)
            vinculos_por_usuario.setdefault(membro.usuario_id, []).append(
                AdminUsuarioVinculo(
                    membro_id=membro.id,
                    loja_id=membro.loja_id,
                    loja_nome=loja_nome,
                    papel=membro.papel.value,
                    ativo=bool(membro.ativo),
                )
            )

    return [
        AdminUsuarioItem(
            id=u.id,
            nome=u.nome,
            email=u.email,
            telefone=u.telefone,
            papel=u.papel.value,
            ativo=bool(u.ativo),
            lojas=lojas_por_usuario.get(u.id, []),
            vinculos=vinculos_por_usuario.get(u.id, []),
        )
        for u in usuarios
    ]


@router.post(
    "/usuarios/{usuario_id}/reset-senha",
)
async def resetar_senha_usuario(
    usuario_id: str,
    data: AdminResetSenhaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Define nova senha para o usuário (fluxo "esqueci a senha" resolvido
    pelo admin da plataforma). Ação registrada na auditoria.
    """
    res = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    usuario = res.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    usuario.senha_hash = hash_password(data.nova_senha)
    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="usuario.reset_senha", entidade="usuario", entidade_id=usuario.id,
        detalhes=json.dumps({"email": usuario.email}),
    )
    await db.commit()
    return {"ok": True, "mensagem": f"Senha de {usuario.email} redefinida com sucesso."}


def _papel_valido(valor: str) -> PapelUsuario:
    """Converte o papel vindo do painel no enum, recusando valor desconhecido."""
    try:
        return PapelUsuario(valor)
    except ValueError:
        validos = ", ".join(p.value for p in PapelUsuario)
        raise HTTPException(status_code=422, detail=f"Papel inválido. Use um destes: {validos}.")


@router.patch(
    "/usuarios/{usuario_id}",
)
async def editar_usuario(
    usuario_id: str,
    data: AdminUsuarioUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Corrige os dados da conta pelo painel (nome, e-mail, telefone, papel, ativo).
    Só altera os campos enviados. Ação registrada na auditoria.
    """
    res = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    usuario = res.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    alteracoes: Dict[str, Dict[str, Optional[str]]] = {}

    if data.email is not None:
        novo_email = data.email.strip().lower()
        if novo_email != usuario.email:
            # email é UNIQUE e é a chave de login: recusa duplicata com 409 legível
            dup = (await db.execute(
                select(Usuario.id).where(Usuario.email == novo_email, Usuario.id != usuario_id)
            )).scalar_one_or_none()
            if dup:
                raise HTTPException(status_code=409, detail=f"Já existe outro usuário com o e-mail {novo_email}.")
            alteracoes["email"] = {"de": usuario.email, "para": novo_email}
            usuario.email = novo_email

    if data.nome is not None and data.nome.strip() != usuario.nome:
        alteracoes["nome"] = {"de": usuario.nome, "para": data.nome.strip()}
        usuario.nome = data.nome.strip()

    if data.telefone is not None and (data.telefone or None) != usuario.telefone:
        alteracoes["telefone"] = {"de": usuario.telefone, "para": data.telefone or None}
        usuario.telefone = data.telefone or None

    if data.papel is not None:
        novo_papel = _papel_valido(data.papel)
        if novo_papel != usuario.papel:
            if usuario.id == admin.id and novo_papel != PapelUsuario.ADMIN_PLATAFORMA:
                raise HTTPException(status_code=409, detail="Você não pode rebaixar o seu próprio acesso de admin.")
            alteracoes["papel"] = {"de": usuario.papel.value, "para": novo_papel.value}
            usuario.papel = novo_papel

    if data.ativo is not None and bool(data.ativo) != bool(usuario.ativo):
        if usuario.id == admin.id and not data.ativo:
            raise HTTPException(status_code=409, detail="Você não pode desativar a sua própria conta.")
        alteracoes["ativo"] = {"de": str(bool(usuario.ativo)), "para": str(bool(data.ativo))}
        usuario.ativo = bool(data.ativo)

    if not alteracoes:
        return {"ok": True, "mensagem": "Nenhuma alteração a aplicar."}

    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="usuario.editar", entidade="usuario", entidade_id=usuario.id,
        detalhes=json.dumps({"email": usuario.email, "alteracoes": alteracoes}),
    )
    await db.commit()
    return {"ok": True, "mensagem": "Dados atualizados com sucesso."}


@router.post(
    "/usuarios/{usuario_id}/vinculos",
)
async def vincular_usuario_loja(
    usuario_id: str,
    data: AdminVinculoCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Vincula o usuário a uma loja com o papel informado (ex.: mover vendedor de loja)."""
    usuario = (await db.execute(select(Usuario).where(Usuario.id == usuario_id))).scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    loja = (await db.execute(select(Loja).where(Loja.id == data.loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    papel = _papel_valido(data.papel)

    existente = (await db.execute(
        select(MembroLoja).where(
            MembroLoja.usuario_id == usuario_id,
            MembroLoja.loja_id == data.loja_id,
        )
    )).scalar_one_or_none()
    if existente:
        # UniqueConstraint (usuario_id, loja_id): reativa em vez de estourar erro de integridade
        if existente.ativo and existente.papel == papel:
            raise HTTPException(status_code=409, detail=f"{usuario.nome} já está vinculado a {loja.nome}.")
        existente.ativo = True
        existente.papel = papel
        membro_id = existente.id
    else:
        novo = MembroLoja(usuario_id=usuario_id, loja_id=data.loja_id, papel=papel, ativo=True)
        db.add(novo)
        await db.flush()
        membro_id = novo.id

    await registrar_auditoria(
        db=db, loja_id=data.loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="usuario.vincular_loja", entidade="membro_loja", entidade_id=membro_id,
        detalhes=json.dumps({"usuario": usuario.email, "loja": loja.nome, "papel": papel.value}),
    )
    await db.commit()
    return {"ok": True, "mensagem": f"{usuario.nome} vinculado a {loja.nome} como {papel.value}."}


@router.patch(
    "/usuarios/{usuario_id}/vinculos/{membro_id}",
)
async def editar_vinculo_usuario(
    usuario_id: str,
    membro_id: str,
    data: AdminVinculoUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Muda o papel do usuário naquela loja ou ativa/desativa o vínculo."""
    res = await db.execute(
        select(MembroLoja, Loja.nome)
        .outerjoin(Loja, Loja.id == MembroLoja.loja_id)
        .where(MembroLoja.id == membro_id, MembroLoja.usuario_id == usuario_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado para este usuário.")
    membro, loja_nome = row
    loja_nome = loja_nome or "(loja removida)"

    alteracoes: Dict[str, Dict[str, str]] = {}
    if data.papel is not None:
        novo_papel = _papel_valido(data.papel)
        if novo_papel != membro.papel:
            alteracoes["papel"] = {"de": membro.papel.value, "para": novo_papel.value}
            membro.papel = novo_papel
    if data.ativo is not None and bool(data.ativo) != bool(membro.ativo):
        alteracoes["ativo"] = {"de": str(bool(membro.ativo)), "para": str(bool(data.ativo))}
        membro.ativo = bool(data.ativo)

    if not alteracoes:
        return {"ok": True, "mensagem": "Nenhuma alteração a aplicar."}

    await registrar_auditoria(
        db=db, loja_id=membro.loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="usuario.editar_vinculo", entidade="membro_loja", entidade_id=membro.id,
        detalhes=json.dumps({"usuario_id": usuario_id, "loja": loja_nome, "alteracoes": alteracoes}),
    )
    await db.commit()
    return {"ok": True, "mensagem": f"Vínculo com {loja_nome} atualizado."}


@router.delete(
    "/usuarios/{usuario_id}/vinculos/{membro_id}",
)
async def remover_vinculo_usuario(
    usuario_id: str,
    membro_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Remove o usuário de uma loja (ex.: vendedor cadastrado na loja errada)."""
    res = await db.execute(
        select(MembroLoja, Loja.nome)
        .outerjoin(Loja, Loja.id == MembroLoja.loja_id)
        .where(MembroLoja.id == membro_id, MembroLoja.usuario_id == usuario_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado para este usuário.")
    membro, loja_nome = row
    loja_nome = loja_nome or "(loja removida)"

    # Gestor/vendedor sem nenhum vínculo não consegue mais logar: avisa antes de deixar órfão
    restantes = (await db.execute(
        select(func.count()).select_from(MembroLoja).where(
            MembroLoja.usuario_id == usuario_id,
            MembroLoja.id != membro_id,
            MembroLoja.ativo == True,
        )
    )).scalar() or 0

    await db.delete(membro)
    await registrar_auditoria(
        db=db, loja_id=membro.loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="usuario.remover_vinculo", entidade="membro_loja", entidade_id=membro_id,
        detalhes=json.dumps({"usuario_id": usuario_id, "loja": loja_nome}),
    )
    await db.commit()

    aviso = "" if restantes else " Atenção: o usuário ficou sem loja e não conseguirá entrar no sistema."
    return {"ok": True, "mensagem": f"Vínculo com {loja_nome} removido.{aviso}"}


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


def _filtros_auditoria(
    busca: Optional[str],
    acao: Optional[str],
    entidade: Optional[str],
    ator: Optional[str],
    loja_id: Optional[str],
    data_de: Optional[str],
    data_ate: Optional[str],
):
    """Monta a lista de condições WHERE compartilhada entre listagem, contagem e export."""
    cond = [LogAuditoria.acao != "erro.servidor"]

    if acao:
        # "veiculo" casa com veiculo.criar, veiculo.editar… ; "veiculo.criar" casa exato.
        cond.append(LogAuditoria.acao.like(f"{acao}.%") if "." not in acao else LogAuditoria.acao == acao)
    if entidade:
        cond.append(LogAuditoria.entidade == entidade)
    if ator:
        # Casa pelo nome (ver facetas): o mesmo usuário pode ter vários ator_id.
        cond.append(LogAuditoria.ator_nome == ator)
    if loja_id:
        cond.append(LogAuditoria.loja_id == loja_id)

    if data_de:
        try:
            cond.append(LogAuditoria.created_at >= datetime.fromisoformat(data_de))
        except ValueError:
            raise HTTPException(status_code=422, detail="data_de inválida (use AAAA-MM-DD).")
    if data_ate:
        try:
            fim = datetime.fromisoformat(data_ate)
            # Data sem hora = dia inteiro.
            if fim.hour == 0 and fim.minute == 0 and fim.second == 0:
                fim = fim + timedelta(days=1)
            cond.append(LogAuditoria.created_at < fim)
        except ValueError:
            raise HTTPException(status_code=422, detail="data_ate inválida (use AAAA-MM-DD).")

    if busca:
        termo = f"%{busca.strip()}%"
        cond.append(
            or_(
                LogAuditoria.acao.ilike(termo),
                LogAuditoria.entidade.ilike(termo),
                LogAuditoria.entidade_id.ilike(termo),
                LogAuditoria.ator_nome.ilike(termo),
                LogAuditoria.detalhes.ilike(termo),
                LogAuditoria.ip.ilike(termo),
            )
        )

    return cond


@router.get(
    "/auditoria",
    response_model=AdminAuditoriaPageResponse,
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_logs_auditoria_globais(
    busca: Optional[str] = None,
    acao: Optional[str] = None,
    entidade: Optional[str] = None,
    ator: Optional[str] = None,
    loja_id: Optional[str] = None,
    data_de: Optional[str] = None,
    data_ate: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Logs de auditoria globais da plataforma, com filtros e paginação server-side.

    Erros de servidor (`erro.servidor`) ficam de fora — têm aba própria.
    """
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    cond = _filtros_auditoria(busca, acao, entidade, ator, loja_id, data_de, data_ate)

    total = (await db.execute(
        select(func.count()).select_from(LogAuditoria).where(*cond)
    )).scalar() or 0

    res = await db.execute(
        select(LogAuditoria)
        .where(*cond)
        .order_by(LogAuditoria.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = res.scalars().all()

    # Resolve nome da loja num único SELECT (evita N+1 por linha).
    ids_lojas = {log.loja_id for log in logs if log.loja_id}
    nomes_lojas: Dict[str, str] = {}
    if ids_lojas:
        res_lojas = await db.execute(select(Loja.id, Loja.nome).where(Loja.id.in_(ids_lojas)))
        nomes_lojas = {lid: nome for lid, nome in res_lojas.all()}

    itens = []
    for log in logs:
        item = LogAuditoriaResponse.model_validate(log)
        itens.append(AdminLogAuditoriaItem(
            **item.model_dump(),
            loja_nome=nomes_lojas.get(log.loja_id or ""),
        ))

    return AdminAuditoriaPageResponse(itens=itens, total=total, limit=limit, offset=offset)


@router.get(
    "/auditoria/facetas",
    response_model=AdminAuditoriaFacetasResponse,
    dependencies=[Depends(exige_admin_plataforma)]
)
async def get_facetas_auditoria(db: AsyncSession = Depends(get_db)):
    """
    Valores existentes para popular os selects de filtro (ações, entidades, atores, lojas).
    """
    base = LogAuditoria.acao != "erro.servidor"

    res_acoes = await db.execute(
        select(LogAuditoria.acao, func.count().label("qtd"))
        .where(base)
        .group_by(LogAuditoria.acao)
        .order_by(func.count().desc())
    )
    acoes = [AdminFacetaItem(valor=a, label=a, total=q) for a, q in res_acoes.all() if a]

    # Prefixos ("veiculo", "lead"…) agregam todas as sub-ações num filtro só.
    modulos: Dict[str, int] = {}
    for f in acoes:
        prefixo = f.valor.split(".")[0]
        modulos[prefixo] = modulos.get(prefixo, 0) + (f.total or 0)

    res_ent = await db.execute(
        select(LogAuditoria.entidade, func.count())
        .where(base, LogAuditoria.entidade.isnot(None))
        .group_by(LogAuditoria.entidade)
        .order_by(func.count().desc())
    )
    entidades = [AdminFacetaItem(valor=e, label=e, total=q) for e, q in res_ent.all() if e]

    # Agrupa por NOME, não por ator_id: reseeds de banco geram vários ids para a
    # mesma pessoa, e o admin filtra pensando em "quem", não no uuid.
    res_atores = await db.execute(
        select(LogAuditoria.ator_nome, func.count())
        .where(base, LogAuditoria.ator_nome.isnot(None), LogAuditoria.ator_nome != "")
        .group_by(LogAuditoria.ator_nome)
        .order_by(func.count().desc())
    )
    atores = [
        AdminFacetaItem(valor=nome, label=nome, total=q)
        for nome, q in res_atores.all() if nome
    ]

    res_lojas_ids = await db.execute(
        select(LogAuditoria.loja_id, func.count())
        .where(base, LogAuditoria.loja_id.isnot(None))
        .group_by(LogAuditoria.loja_id)
        .order_by(func.count().desc())
    )
    linhas_lojas = res_lojas_ids.all()
    nomes: Dict[str, str] = {}
    if linhas_lojas:
        res_nomes = await db.execute(
            select(Loja.id, Loja.nome).where(Loja.id.in_([lid for lid, _ in linhas_lojas]))
        )
        nomes = {lid: nome for lid, nome in res_nomes.all()}
    # Só lojas que ainda existem — ids órfãos de bases antigas virariam uuid cru no select.
    lojas = [
        AdminFacetaItem(valor=lid, label=nomes[lid], total=q)
        for lid, q in linhas_lojas if lid and lid in nomes
    ]

    return AdminAuditoriaFacetasResponse(
        acoes=acoes,
        modulos=[
            AdminFacetaItem(valor=m, label=m, total=q)
            for m, q in sorted(modulos.items(), key=lambda kv: -kv[1])
        ],
        entidades=entidades,
        atores=atores,
        lojas=lojas,
    )


@router.get(
    "/auditoria/export",
    dependencies=[Depends(exige_admin_plataforma)]
)
async def exportar_auditoria_csv(
    busca: Optional[str] = None,
    acao: Optional[str] = None,
    entidade: Optional[str] = None,
    ator: Optional[str] = None,
    loja_id: Optional[str] = None,
    data_de: Optional[str] = None,
    data_ate: Optional[str] = None,
    limit: int = 5000,
    db: AsyncSession = Depends(get_db),
):
    """
    Exporta em CSV os logs que casam com os filtros atuais (teto de 5.000 linhas).
    """
    limit = max(1, min(limit, 5000))
    cond = _filtros_auditoria(busca, acao, entidade, ator, loja_id, data_de, data_ate)

    res = await db.execute(
        select(LogAuditoria).where(*cond).order_by(LogAuditoria.created_at.desc()).limit(limit)
    )
    logs = res.scalars().all()

    ids_lojas = {log.loja_id for log in logs if log.loja_id}
    nomes_lojas: Dict[str, str] = {}
    if ids_lojas:
        res_lojas = await db.execute(select(Loja.id, Loja.nome).where(Loja.id.in_(ids_lojas)))
        nomes_lojas = {lid: nome for lid, nome in res_lojas.all()}

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["Data", "Ação", "Entidade", "ID entidade", "Usuário", "Loja", "IP", "Detalhes"])
    for log in logs:
        writer.writerow([
            log.created_at.strftime("%d/%m/%Y %H:%M:%S") if log.created_at else "",
            log.acao,
            log.entidade or "",
            log.entidade_id or "",
            log.ator_nome or "",
            nomes_lojas.get(log.loja_id or "", ""),
            log.ip or "",
            (log.detalhes or "").replace("\n", " "),
        ])

    # BOM para o Excel abrir acentuação corretamente.
    conteudo = "﻿" + buffer.getvalue()
    nome = f"auditoria-{datetime.now().strftime('%Y%m%d-%H%M')}.csv"
    return Response(
        content=conteudo,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


# ── Erros reportados pelo front-end ─────────────────────────────

class ReportarErroRequest(BaseModel):
    path: str
    status: int
    timestamp: str
    request_id: Optional[str] = None
    origem: Optional[str] = None  # "gestor" | "vitrine"
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    mensagem: Optional[str] = None


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
    if data.mensagem:
        detalhes_dict["mensagem"] = data.mensagem

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


class ConsumoIAPorLoja(BaseModel):
    loja_id: str
    loja_nome: str
    chamadas: int
    tokens_input: int
    tokens_output: int
    tokens_total: int


class ConsumoIAResponse(BaseModel):
    dias: int
    desde: datetime
    total_chamadas: int
    total_tokens: int
    por_funcionalidade: Dict[str, int]
    lojas: List[ConsumoIAPorLoja]


@router.get(
    "/consumo-ia",
    response_model=ConsumoIAResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_consumo_ia(
    dias: int = 30,
    funcionalidade: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Consumo de IA (Groq) agregado por loja — quem mais gasta token.

    O consumo é sempre atribuído à loja DONA do recurso (veículo/conversa),
    não a quem operou, então o ranking não distorce quando o suporte age
    dentro de uma loja. `funcionalidade` filtra "marketing" | "triagem".
    """
    dias = max(1, min(dias, 365))
    desde = utcnow() - timedelta(days=dias)

    filtros = [MarketingUsage.created_at >= desde]
    if funcionalidade:
        filtros.append(MarketingUsage.funcionalidade == funcionalidade)

    tokens_in = func.coalesce(func.sum(MarketingUsage.tokens_input), 0)
    tokens_out = func.coalesce(func.sum(MarketingUsage.tokens_output), 0)

    stmt = (
        select(
            MarketingUsage.loja_id,
            Loja.nome,
            func.count(MarketingUsage.id),
            tokens_in,
            tokens_out,
        )
        .join(Loja, Loja.id == MarketingUsage.loja_id)
        .where(*filtros)
        .group_by(MarketingUsage.loja_id, Loja.nome)
        .order_by((tokens_in + tokens_out).desc())
    )
    linhas = (await db.execute(stmt)).all()

    lojas = [
        ConsumoIAPorLoja(
            loja_id=loja_id,
            loja_nome=nome,
            chamadas=chamadas,
            tokens_input=t_in,
            tokens_output=t_out,
            tokens_total=t_in + t_out,
        )
        for loja_id, nome, chamadas, t_in, t_out in linhas
    ]

    func_stmt = (
        select(
            MarketingUsage.funcionalidade,
            func.coalesce(func.sum(MarketingUsage.tokens_input + MarketingUsage.tokens_output), 0),
        )
        .where(*filtros)
        .group_by(MarketingUsage.funcionalidade)
    )
    por_funcionalidade = {f: total for f, total in (await db.execute(func_stmt)).all()}

    return ConsumoIAResponse(
        dias=dias,
        desde=desde,
        total_chamadas=sum(item.chamadas for item in lojas),
        total_tokens=sum(item.tokens_total for item in lojas),
        por_funcionalidade=por_funcionalidade,
        lojas=lojas,
    )


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


# ═══════════════════════════════════════════════════════════════
# Assinaturas — ativação manual (Pix) enquanto não há gateway
# ═══════════════════════════════════════════════════════════════

# Grava e compara sempre naive UTC — colunas são TIMESTAMP WITHOUT TIME ZONE
# (Postgres rejeita datetime aware nessas colunas; ver ARMADILHAS-PRODUCAO.md #1).
_now = utcnow


async def _assinatura_mais_recente(db: AsyncSession, loja_id: str) -> Optional[Assinatura]:
    stmt = (
        select(Assinatura)
        .where(Assinatura.loja_id == loja_id)
        .order_by(Assinatura.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def _dias_para_vencer(venc: Optional[datetime]) -> Optional[int]:
    if not venc:
        return None
    return (venc - _now()).days


async def _plano_ativo_ou_404(db: AsyncSession, plano_id: str) -> Plano:
    plano = (await db.execute(
        select(Plano).where(Plano.id == plano_id, Plano.ativo == True)
    )).scalar_one_or_none()
    if not plano:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plano não encontrado ou inativo.")
    return plano


async def _loja_ou_404(db: AsyncSession, loja_id: str) -> Loja:
    loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")
    return loja


async def _montar_detalhe_assinatura(db: AsyncSession, loja_id: str) -> AdminAssinaturaDetalheResponse:
    """
    Estado consolidado de Plano & Acesso da loja: assinatura, plano, pagamentos
    e a lista completa de módulos com origem (plano vs. cortesia) e se está
    valendo agora. A UI monta a tela inteira com esta única chamada.
    """
    loja = await _loja_ou_404(db, loja_id)
    assinatura = await _assinatura_mais_recente(db, loja_id)

    plano = None
    pagamentos: List[Pagamento] = []
    if assinatura:
        plano = (await db.execute(
            select(Plano).where(Plano.id == assinatura.plano_id)
        )).scalar_one_or_none()
        pagamentos = list((await db.execute(
            select(Pagamento)
            .where(Pagamento.assinatura_id == assinatura.id)
            .order_by(Pagamento.created_at.desc())
        )).scalars().all())

    liberado = acesso_liberado(assinatura)
    do_plano = set(modulos_do_plano(plano)) if assinatura and assinatura.status in STATUS_RECUPERAVEIS else set()
    habilitados = {
        m.nome_modulo: m
        for m in (await db.execute(
            select(ModuloHabilitado).where(ModuloHabilitado.loja_id == loja_id)
        )).scalars().all()
    }

    modulos: List[AdminModuloStatusItem] = []
    for modulo in Modulo:
        registro = habilitados.get(modulo.value)
        ativo = bool(registro and registro.ativo)
        modulos.append(AdminModuloStatusItem(
            modulo=modulo.value,
            ativo=ativo,
            cortesia=bool(registro and registro.ativo and registro.cortesia),
            do_plano=modulo.value in do_plano,
            liberado=ativo and liberado,
        ))

    venc = assinatura.proximo_vencimento if assinatura else None
    return AdminAssinaturaDetalheResponse(
        assinatura=AssinaturaResponse.model_validate(assinatura) if assinatura else None,
        plano=PlanoResponse.model_validate(plano) if plano else None,
        pagamentos=[PagamentoResponse.model_validate(p) for p in pagamentos],
        dias_para_vencer=_dias_para_vencer(venc) if assinatura else None,
        acesso_liberado=liberado,
        loja_ativa=loja.ativa,
        vencida=bool(venc and venc < _now()),
        modulos=modulos,
    )


@router.post(
    "/lojas/{loja_id}/assinatura/ativar",
    response_model=AssinaturaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ativar_assinatura_manual(
    loja_id: str,
    data: AdminAtivarAssinaturaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Ativa (ou substitui) a assinatura de uma loja via cobrança manual (Pix),
    sem depender de gateway. Exige aceite de contrato explícito — é o registro
    jurídico de que o cliente concordou com os termos antes de virar pagante.
    """
    loja = await _loja_ou_404(db, loja_id)
    if not loja.ativa:
        loja.ativa = True  # reverte a desativação automática por vencimento (assinatura_worker)

    if not data.contrato_aceito:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="É obrigatório confirmar que o cliente aceitou o contrato de assinatura antes de ativar.",
        )

    plano = await _plano_ativo_ou_404(db, data.plano_id)

    atual = await _assinatura_mais_recente(db, loja_id)
    if atual and atual.status != StatusAssinatura.CANCELADA:
        # Encerra qualquer assinatura anterior ainda viva (ativa, suspensa ou
        # expirada) — senão ficavam duas concorrendo e a busca "mais recente"
        # passava a decidir o acesso por acidente.
        atual.status = StatusAssinatura.CANCELADA
        atual.fim = _now()

    agora = _now()
    assinatura = Assinatura(
        loja_id=loja_id,
        plano_id=plano.id,
        status=StatusAssinatura.ATIVA,
        inicio=agora,
        valor_mensal=data.valor_mensal,
        proximo_vencimento=agora + timedelta(days=30 * data.meses),
        contrato_aceito_em=agora,
        contrato_versao=data.contrato_versao,
        observacoes=data.observacoes,
        criado_por_admin=True,
    )
    db.add(assinatura)
    await db.flush()

    diff = await sincronizar_modulos(db, loja_id, plano)
    modulos_incluidos = modulos_do_plano(plano)

    pagamento = Pagamento(
        assinatura_id=assinatura.id,
        valor=data.valor_mensal * data.meses,
        status=StatusPagamento.PAGO,
        referencia=data.referencia_pagamento or f"admin-manual-{assinatura.id}",
        metodo=data.forma_pagamento,
        data_pagamento=agora,
    )
    db.add(pagamento)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.ativar_manual", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "plano_id": plano.id, "valor_mensal": data.valor_mensal, "meses": data.meses,
            "forma_pagamento": data.forma_pagamento, "contrato_versao": data.contrato_versao,
            "modulos": modulos_incluidos,
            "modulos_liberados": diff.liberados,
            "modulos_removidos": diff.removidos,
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.post(
    "/lojas/{loja_id}/assinatura/renovar",
    response_model=AssinaturaResponse,
)
async def renovar_assinatura_manual(
    loja_id: str,
    data: AdminRenovarAssinaturaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Registra novo pagamento manual e estende o vencimento da assinatura existente."""
    assinatura = await _assinatura_mais_recente(db, loja_id)
    if not assinatura:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Loja ainda não tem assinatura. Use /assinatura/ativar para a primeira contratação.",
        )
    if assinatura.status == StatusAssinatura.CANCELADA:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Assinatura cancelada — use /assinatura/ativar para iniciar uma nova.",
        )

    plano_trocado_de = None
    plano_vigente = (await db.execute(
        select(Plano).where(Plano.id == assinatura.plano_id)
    )).scalar_one_or_none()

    if data.plano_id is not None and data.plano_id != assinatura.plano_id:
        novo_plano = await _plano_ativo_ou_404(db, data.plano_id)
        plano_trocado_de = assinatura.plano_id
        assinatura.plano_id = novo_plano.id
        plano_vigente = novo_plano

    # Reaplica os módulos do plano SEMPRE — inclusive quando não houve troca,
    # para corrigir lojas que ficaram dessincronizadas. Sem esta chamada, subir
    # de plano não liberava os módulos novos e descer não removia os antigos.
    diff = await sincronizar_modulos(db, loja_id, plano_vigente)

    agora = _now()
    assinatura.status = StatusAssinatura.ATIVA
    assinatura.fim = None
    # Não acumula atraso: soma a partir de hoje se o vencimento já passou.
    assinatura.proximo_vencimento = proximo_vencimento_apos(
        assinatura.proximo_vencimento, data.meses, agora,
    )

    await reativar_loja(db, loja_id)
    if data.valor_mensal is not None:
        assinatura.valor_mensal = data.valor_mensal
    if data.observacoes:
        assinatura.observacoes = data.observacoes

    valor_pago = (data.valor_mensal if data.valor_mensal is not None else (assinatura.valor_mensal or 0)) * data.meses
    pagamento = Pagamento(
        assinatura_id=assinatura.id,
        valor=valor_pago,
        status=StatusPagamento.PAGO,
        referencia=data.referencia_pagamento or f"admin-manual-{assinatura.id}-{int(agora.timestamp())}",
        metodo=data.forma_pagamento,
        data_pagamento=agora,
    )
    db.add(pagamento)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.renovar_manual", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "meses": data.meses, "valor_pago": valor_pago, "forma_pagamento": data.forma_pagamento,
            "novo_vencimento": assinatura.proximo_vencimento.isoformat(),
            **({"modulos_liberados": diff.liberados} if diff.liberados else {}),
            **({"modulos_removidos": diff.removidos} if diff.removidos else {}),
            **({"plano_id_anterior": plano_trocado_de, "plano_id_novo": assinatura.plano_id} if plano_trocado_de is not None else {}),
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.post(
    "/lojas/{loja_id}/assinatura/suspender",
    response_model=AssinaturaResponse,
)
async def suspender_assinatura_manual(
    loja_id: str,
    data: AdminSuspenderAssinaturaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Suspende a assinatura (inadimplência/cancelamento manual) — bloqueia módulos premium na hora."""
    assinatura = await _assinatura_mais_recente(db, loja_id)
    if not assinatura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não tem assinatura.")
    if assinatura.status == StatusAssinatura.SUSPENSA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Assinatura já está suspensa.")
    if assinatura.status == StatusAssinatura.CANCELADA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Assinatura cancelada não pode ser suspensa.")

    status_anterior = assinatura.status.value
    assinatura.status = StatusAssinatura.SUSPENSA
    if data.bloquear_login:
        loja = await _loja_ou_404(db, loja_id)
        loja.ativa = False

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.suspender_manual", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "motivo": data.motivo,
            "status_anterior": status_anterior,
            "bloqueou_login": data.bloquear_login,
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.post(
    "/lojas/{loja_id}/assinatura/reativar",
    response_model=AssinaturaResponse,
)
async def reativar_assinatura_manual(
    loja_id: str,
    data: AdminReativarAssinaturaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Volta uma assinatura SUSPENSA/EXPIRADA para ATIVA sem exigir pagamento.

    Era o buraco da tela: depois de suspender, o único caminho de volta passava
    por registrar uma cobrança, obrigando o admin a forjar um pagamento para
    desfazer uma suspensão feita por engano. Religa o login e ressincroniza os
    módulos do plano.
    """
    assinatura = await _assinatura_mais_recente(db, loja_id)
    if not assinatura:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Loja ainda não tem assinatura. Use /assinatura/ativar para a primeira contratação.",
        )
    if assinatura.status == StatusAssinatura.ATIVA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Assinatura já está ativa.")
    if assinatura.status == StatusAssinatura.CANCELADA:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Assinatura cancelada — use /assinatura/ativar para iniciar uma nova.",
        )

    status_anterior = assinatura.status.value
    plano = (await db.execute(
        select(Plano).where(Plano.id == assinatura.plano_id)
    )).scalar_one_or_none()

    assinatura.status = StatusAssinatura.ATIVA
    assinatura.fim = None

    # Reativar sem novo pagamento com a data já vencida deixaria a loja ATIVA e
    # ao mesmo tempo bloqueada por vencimento (acesso_liberado checa a data), e
    # o worker a expiraria de novo no dia seguinte. Concede o prazo pedido.
    agora = _now()
    if assinatura.proximo_vencimento is None or assinatura.proximo_vencimento < agora:
        assinatura.proximo_vencimento = agora + timedelta(days=data.dias_cortesia)

    diff = await sincronizar_modulos(db, loja_id, plano)
    await reativar_loja(db, loja_id)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.reativar_manual", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "motivo": data.motivo,
            "status_anterior": status_anterior,
            "dias_cortesia": data.dias_cortesia,
            "novo_vencimento": assinatura.proximo_vencimento.isoformat() if assinatura.proximo_vencimento else None,
            "modulos_liberados": diff.liberados,
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.post(
    "/lojas/{loja_id}/assinatura/cancelar",
    response_model=AssinaturaResponse,
)
async def cancelar_assinatura_manual(
    loja_id: str,
    data: AdminSuspenderAssinaturaRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Encerra a assinatura em definitivo (churn). Desliga os módulos do plano e,
    opcionalmente, o login. Estado terminal: voltar exige nova ativação.
    """
    assinatura = await _assinatura_mais_recente(db, loja_id)
    if not assinatura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não tem assinatura.")
    if assinatura.status == StatusAssinatura.CANCELADA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Assinatura já está cancelada.")

    status_anterior = assinatura.status.value
    assinatura.status = StatusAssinatura.CANCELADA
    assinatura.fim = _now()

    # Sem plano vigente, todos os módulos do plano caem (cortesias sobrevivem).
    diff = await sincronizar_modulos(db, loja_id, None)
    if data.bloquear_login:
        loja = await _loja_ou_404(db, loja_id)
        loja.ativa = False

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.cancelar_manual", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "motivo": data.motivo,
            "status_anterior": status_anterior,
            "modulos_removidos": diff.removidos,
            "bloqueou_login": data.bloquear_login,
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.post(
    "/lojas/{loja_id}/assinatura/trocar-plano",
    response_model=AssinaturaResponse,
)
async def trocar_plano_assinatura(
    loja_id: str,
    data: AdminTrocarPlanoRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Troca o plano sem registrar cobrança (upgrade/downgrade acertado à parte).
    Sincroniza os módulos na hora — é a operação que a UI usa ao salvar a tela
    de Plano & Acesso.
    """
    assinatura = await _assinatura_mais_recente(db, loja_id)
    if not assinatura:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Loja ainda não tem assinatura. Use /assinatura/ativar para a primeira contratação.",
        )
    if assinatura.status not in STATUS_RECUPERAVEIS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Assinatura cancelada — use /assinatura/ativar para iniciar uma nova.",
        )

    novo_plano = await _plano_ativo_ou_404(db, data.plano_id)
    plano_anterior = assinatura.plano_id
    assinatura.plano_id = novo_plano.id
    if data.valor_mensal is not None:
        assinatura.valor_mensal = data.valor_mensal
    if data.observacoes is not None:
        assinatura.observacoes = data.observacoes

    diff = await sincronizar_modulos(db, loja_id, novo_plano)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.trocar_plano", entidade="assinatura", entidade_id=assinatura.id,
        detalhes=json.dumps({
            "plano_id_anterior": plano_anterior,
            "plano_id_novo": novo_plano.id,
            "valor_mensal": assinatura.valor_mensal,
            "modulos_liberados": diff.liberados,
            "modulos_removidos": diff.removidos,
        }),
    )
    await db.commit()
    await db.refresh(assinatura)
    return assinatura


@router.get(
    "/lojas/{loja_id}/assinatura/previa-troca/{plano_id}",
    response_model=AdminDiffModulosResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def previa_troca_plano(
    loja_id: str,
    plano_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Diff dos módulos que uma troca de plano causaria — sem aplicar nada."""
    plano = await _plano_ativo_ou_404(db, plano_id)
    diff = await prever_troca_plano(db, loja_id, plano)
    return AdminDiffModulosResponse(
        liberados=diff.liberados,
        removidos=diff.removidos,
        mantidos_cortesia=diff.mantidos_cortesia,
    )


@router.patch(
    "/lojas/{loja_id}/modulos-cortesia",
    response_model=AdminAssinaturaDetalheResponse,
)
async def definir_modulos_cortesia(
    loja_id: str,
    data: AdminCortesiasRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Define os módulos liberados por cortesia (fora do plano).

    Substitui a edição solta de módulos no cadastro da loja, que apagava tudo e
    recriava ignorando o plano — os dois se sobrescreviam. Aqui o plano continua
    mandando nos módulos dele; só o que está fora entra como cortesia.
    """
    await _loja_ou_404(db, loja_id)
    assinatura = await _assinatura_mais_recente(db, loja_id)
    plano = None
    if assinatura and assinatura.status in STATUS_RECUPERAVEIS:
        plano = (await db.execute(
            select(Plano).where(Plano.id == assinatura.plano_id)
        )).scalar_one_or_none()

    aplicadas = await definir_cortesias(db, loja_id, plano, data.modulos)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="assinatura.definir_cortesias", entidade="loja", entidade_id=loja_id,
        detalhes=json.dumps({"cortesias": aplicadas}),
    )
    await db.commit()
    return await _montar_detalhe_assinatura(db, loja_id)


@router.get(
    "/lojas/{loja_id}/assinatura",
    response_model=AdminAssinaturaDetalheResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_assinatura_loja(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Estado da assinatura da loja + histórico de pagamentos, para a tela de gestão do admin."""
    return await _montar_detalhe_assinatura(db, loja_id)


# ═══════════════════════════════════════════════════════════════
# Destaque pago (patrocínio na vitrine) — cobrança manual (Pix)
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/lojas/{loja_id}/destaque/ativar",
    response_model=DestaquePagamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ativar_destaque_loja(
    loja_id: str,
    data: AdminAtivarDestaqueRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """
    Ativa (ou estende) o destaque pago de uma loja via cobrança manual (Pix).
    Soma `meses` a partir do vencimento atual do destaque se ainda não expirou,
    ou a partir de agora se nunca teve destaque ou já expirou — mesma regra de
    não acumular atraso usada em /assinatura/renovar.
    """
    loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    agora = _now()
    base = loja.destaque_ate if (loja.destaque and loja.destaque_ate and loja.destaque_ate > agora) else agora
    novo_vencimento = base + timedelta(days=30 * data.meses)

    loja.destaque = True
    loja.destaque_ate = novo_vencimento

    pagamento = DestaquePagamento(
        loja_id=loja_id,
        valor=data.valor,
        meses=data.meses,
        status=StatusPagamento.PAGO,
        referencia=data.referencia_pagamento or f"admin-manual-destaque-{loja_id}-{int(agora.timestamp())}",
        metodo=data.forma_pagamento,
        data_pagamento=agora,
        destaque_ate_resultante=novo_vencimento,
        observacoes=data.observacoes,
        criado_por_admin_id=admin.id,
    )
    db.add(pagamento)

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="destaque.ativar_manual", entidade="loja", entidade_id=loja_id,
        detalhes=json.dumps({
            "valor": data.valor, "meses": data.meses, "forma_pagamento": data.forma_pagamento,
            "destaque_ate": novo_vencimento.isoformat(),
        }),
    )
    await db.commit()
    await db.refresh(pagamento)
    return pagamento


@router.post(
    "/lojas/{loja_id}/destaque/desativar",
    response_model=LojaResponse,
)
async def desativar_destaque_loja(
    loja_id: str,
    data: AdminDesativarDestaqueRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Remove o destaque pago da loja (cancelamento manual, antes do vencimento)."""
    loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")
    if not loja.destaque:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Loja não tem destaque ativo.")

    loja.destaque = False
    loja.destaque_ate = None

    await registrar_auditoria(
        db=db, loja_id=loja_id, ator_id=admin.id, ator_nome=admin.nome,
        acao="destaque.desativar_manual", entidade="loja", entidade_id=loja_id,
        detalhes=json.dumps({"motivo": data.motivo}),
    )
    await db.commit()
    await db.refresh(loja)
    return loja


@router.get(
    "/lojas/{loja_id}/destaque",
    response_model=AdminDestaqueDetalheResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_destaque_loja(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Estado do destaque da loja + histórico de pagamentos, para a tela de gestão do admin."""
    loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    pagamentos = (await db.execute(
        select(DestaquePagamento)
        .where(DestaquePagamento.loja_id == loja_id)
        .order_by(DestaquePagamento.created_at.desc())
    )).scalars().all()

    return AdminDestaqueDetalheResponse(
        destaque=loja.destaque,
        destaque_ate=loja.destaque_ate,
        dias_para_vencer=_dias_para_vencer(loja.destaque_ate) if loja.destaque else None,
        pagamentos=[DestaquePagamentoResponse.model_validate(p) for p in pagamentos],
    )


@router.get(
    "/assinaturas/vencendo",
    response_model=List[AdminVencimentoItem],
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_assinaturas_vencendo(
    dias: int = 7,
    db: AsyncSession = Depends(get_db),
):
    """
    Lojas com assinatura ativa vencendo nos próximos `dias` (padrão 7) ou já vencidas.
    Alimenta a revisão semanal de cobrança manual — sem isso, atraso de Pix passa batido.
    """
    limite = _now() + timedelta(days=dias)
    stmt = (
        select(Assinatura, Loja.nome, Plano.nome)
        .join(Loja, Loja.id == Assinatura.loja_id)
        .join(Plano, Plano.id == Assinatura.plano_id)
        .where(
            Assinatura.status == StatusAssinatura.ATIVA,
            Assinatura.proximo_vencimento.isnot(None),
            Assinatura.proximo_vencimento <= limite,
        )
        .order_by(Assinatura.proximo_vencimento.asc())
    )
    rows = (await db.execute(stmt)).all()

    return [
        AdminVencimentoItem(
            loja_id=assinatura.loja_id,
            loja_nome=loja_nome,
            assinatura_id=assinatura.id,
            plano_nome=plano_nome,
            status=assinatura.status,
            valor_mensal=assinatura.valor_mensal,
            proximo_vencimento=assinatura.proximo_vencimento,
            dias_para_vencer=_dias_para_vencer(assinatura.proximo_vencimento),
        )
        for assinatura, loja_nome, plano_nome in rows
    ]


# ═══════════════════════════════════════════════════════════════
# Planos — catálogo de assinatura (CRUD)
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/planos",
    response_model=List[PlanoResponse],
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_todos_planos(db: AsyncSession = Depends(get_db)):
    """Lista todos os planos, inclusive inativos — só a plataforma gerencia o catálogo."""
    stmt = select(Plano).order_by(Plano.preco_mensal)
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "/planos",
    response_model=PlanoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_plano(
    data: AdminCriarPlanoRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    plano = Plano(
        nome=data.nome.strip(),
        descricao=data.descricao,
        preco_mensal=data.preco_mensal,
        modulos_incluidos=json.dumps(data.modulos_incluidos),
        ativo=data.ativo,
    )
    db.add(plano)
    await db.flush()

    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="plano.criar", entidade="plano", entidade_id=plano.id,
        detalhes=json.dumps({
            "nome": plano.nome, "preco_mensal": plano.preco_mensal, "modulos": data.modulos_incluidos,
        }),
    )
    await db.commit()
    await db.refresh(plano)
    return plano


@router.patch(
    "/planos/{plano_id}",
    response_model=PlanoResponse,
)
async def editar_plano(
    plano_id: str,
    data: AdminEditarPlanoRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    plano = (await db.execute(select(Plano).where(Plano.id == plano_id))).scalar_one_or_none()
    if not plano:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plano não encontrado.")

    if data.nome is not None:
        plano.nome = data.nome.strip()
    if data.descricao is not None:
        plano.descricao = data.descricao
    if data.preco_mensal is not None:
        plano.preco_mensal = data.preco_mensal
    if data.modulos_incluidos is not None:
        plano.modulos_incluidos = json.dumps(data.modulos_incluidos)
    if data.ativo is not None:
        plano.ativo = data.ativo

    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="plano.editar", entidade="plano", entidade_id=plano.id,
        detalhes=json.dumps(data.model_dump(exclude_unset=True)),
    )
    await db.commit()
    await db.refresh(plano)
    return plano


@router.delete(
    "/planos/{plano_id}",
    status_code=status.HTTP_200_OK,
)
async def excluir_plano(
    plano_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Exclui de vez um plano sem histórico. Se já tem assinatura vinculada, use desativar (PATCH ativo=false)."""
    plano = (await db.execute(select(Plano).where(Plano.id == plano_id))).scalar_one_or_none()
    if not plano:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plano não encontrado.")

    em_uso = (await db.execute(
        select(func.count()).select_from(Assinatura).where(Assinatura.plano_id == plano_id)
    )).scalar() or 0
    if em_uso > 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Este plano tem {em_uso} assinatura(s) vinculada(s) — desative em vez de excluir.",
        )

    nome = plano.nome
    await db.delete(plano)
    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="plano.excluir", entidade="plano", entidade_id=plano_id,
        detalhes=json.dumps({"nome": nome}),
    )
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# Contrato de assinatura — versões (texto editável, TipTap no front)
# ═══════════════════════════════════════════════════════════════

# Catálogo das variáveis do contrato B2B (Social Veículos ↔ Loja).
# Deve espelhar apps/admin/src/lib/variaveisContratoAssinatura.ts.
VARIAVEIS_CONTRATO_ASSINATURA: List[tuple] = [
    ("loja.nome", "Razão social"),
    ("loja.cnpj", "CNPJ"),
    ("loja.endereco", "Endereço"),
    ("loja.cidade", "Cidade"),
    ("loja.estado", "Estado"),
    ("loja.cep", "CEP"),
    ("loja.telefone", "Telefone"),
    ("loja.email", "E-mail"),
    ("responsavel.nome", "Nome"),
    ("responsavel.email", "E-mail"),
    ("responsavel.telefone", "Telefone"),
    ("plano.nome", "Nome do plano"),
    ("plano.descricao", "Descrição"),
    ("plano.modulos", "Módulos inclusos"),
    ("assinatura.valor_mensal", "Valor mensal contratado"),
    ("assinatura.inicio", "Início da vigência"),
    ("assinatura.proximo_vencimento", "Próximo vencimento"),
    ("assinatura.dia_vencimento", "Dia do vencimento"),
    ("assinatura.observacoes", "Observações"),
    ("plataforma.nome", "Razão social"),
    ("plataforma.cnpj", "CNPJ"),
    ("plataforma.endereco", "Endereço"),
    ("plataforma.email", "E-mail"),
    ("contrato.versao", "Versão"),
    ("contrato.data", "Data de hoje"),
    ("contrato.data_aceite", "Data do aceite"),
]

# Placeholder usado quando o dado ainda não existe no cadastro — mantém o
# contrato legível em vez de deixar "{{loja.cnpj}}" cru no texto impresso.
_VAZIO = "____________"

_MODULO_LABEL = {
    "contratos": "Contratos",
    "simulador": "Simulador",
    "marketing": "Marketing",
    "assistente_ia": "Assistente de IA",
    "fiscal": "Fiscal (NF-e)",
    "site": "Site próprio",
}


def _data_br(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%d/%m/%Y") if dt else None


async def resolver_variaveis_contrato_assinatura(
    db: AsyncSession,
    loja_id: Optional[str] = None,
    plano_id: Optional[str] = None,
    versao: Optional[str] = None,
) -> Dict[str, str]:
    """Resolve as variáveis do contrato B2B com os dados reais do lojista.

    Sem loja_id devolve só o que não depende dela (plataforma/data), para o
    admin escrever o modelo. Campos ausentes viram placeholder, nunca a chave crua.
    """
    loja: Optional[Loja] = None
    assinatura: Optional[Assinatura] = None
    plano: Optional[Plano] = None
    gestor: Optional[Usuario] = None

    if loja_id:
        loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
        if not loja:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

        assinatura = (await db.execute(
            select(Assinatura)
            .where(Assinatura.loja_id == loja_id)
            .order_by(Assinatura.created_at.desc())
        )).scalars().first()

        # Responsável legal = gestor ativo mais antigo da loja.
        gestor = (await db.execute(
            select(Usuario)
            .join(MembroLoja, MembroLoja.usuario_id == Usuario.id)
            .where(
                MembroLoja.loja_id == loja_id,
                MembroLoja.papel == PapelUsuario.GESTOR,
                MembroLoja.ativo == True,  # noqa: E712
            )
            .order_by(MembroLoja.created_at.asc())
        )).scalars().first()

    # Plano: o explicitamente pedido (prévia de troca) ou o da assinatura vigente.
    alvo_plano_id = plano_id or (assinatura.plano_id if assinatura else None)
    if alvo_plano_id:
        plano = (await db.execute(select(Plano).where(Plano.id == alvo_plano_id))).scalar_one_or_none()

    modulos = [_MODULO_LABEL.get(m, m) for m in modulos_do_plano(plano)]
    valor_mensal = (assinatura.valor_mensal if assinatura and assinatura.valor_mensal is not None
                    else (plano.preco_mensal if plano else None))
    venc = assinatura.proximo_vencimento if assinatura else None

    bruto: Dict[str, Optional[str]] = {
        "loja.nome": loja.nome if loja else None,
        "loja.cnpj": loja.cnpj if loja else None,
        "loja.endereco": loja.endereco if loja else None,
        "loja.cidade": loja.cidade if loja else None,
        "loja.estado": loja.estado if loja else None,
        "loja.cep": loja.cep if loja else None,
        "loja.telefone": (loja.telefone or loja.whatsapp) if loja else None,
        "loja.email": loja.email if loja else None,

        "responsavel.nome": gestor.nome if gestor else None,
        "responsavel.email": gestor.email if gestor else None,
        "responsavel.telefone": gestor.telefone if gestor else None,

        "plano.nome": plano.nome if plano else None,
        "plano.descricao": plano.descricao if plano else None,
        # Fora do catálogo de variáveis (o contrato mostra só o valor cobrado, em
        # assinatura.valor_mensal — dois preços no mesmo documento confundem o
        # lojista). Mantido aqui para não quebrar modelos antigos que já usam a tag.
        "plano.preco_mensal": formatar_moeda(plano.preco_mensal) if plano else None,
        "plano.modulos": ", ".join(modulos) if modulos else None,

        "assinatura.valor_mensal": formatar_moeda(valor_mensal) if valor_mensal is not None else None,
        "assinatura.inicio": _data_br(assinatura.inicio) if assinatura else None,
        "assinatura.proximo_vencimento": _data_br(venc),
        "assinatura.dia_vencimento": str(venc.day) if venc else None,
        "assinatura.observacoes": assinatura.observacoes if assinatura else None,

        "plataforma.nome": settings.plataforma_razao_social,
        "plataforma.cnpj": settings.plataforma_cnpj,
        "plataforma.endereco": settings.plataforma_endereco,
        "plataforma.email": settings.plataforma_email,

        "contrato.versao": versao or (assinatura.contrato_versao if assinatura else None),
        "contrato.data": _data_br(utcnow()),
        "contrato.data_aceite": _data_br(assinatura.contrato_aceito_em) if assinatura else None,
    }
    return {k: (v.strip() if isinstance(v, str) and v.strip() else _VAZIO) or _VAZIO
            for k, v in bruto.items()}


# Aceita {{chave}} e {{ chave }}; a chave é sempre pontuada (grupo.campo).
_RE_VARIAVEL = re.compile(r"\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}")


def aplicar_variaveis_contrato(conteudo_html: str, valores: Dict[str, str]) -> tuple:
    """Troca {{chave}} pelos valores. Devolve (html, chaves_desconhecidas)."""
    nao_resolvidas: List[str] = []

    def _sub(m: re.Match) -> str:
        chave = m.group(1)
        if chave in valores:
            return html_lib.escape(valores[chave])
        nao_resolvidas.append(chave)
        return m.group(0)

    return _RE_VARIAVEL.sub(_sub, conteudo_html), sorted(set(nao_resolvidas))


@router.get(
    "/contrato-assinatura/variaveis",
    response_model=ContratoAssinaturaVariaveisResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def listar_variaveis_contrato_assinatura(
    loja_id: Optional[str] = None,
    plano_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Catálogo de variáveis do contrato B2B, já resolvido com os dados da loja
    quando `loja_id` é informado (é o que alimenta o popover do editor)."""
    valores = await resolver_variaveis_contrato_assinatura(db, loja_id, plano_id)
    loja_nome = valores.get("loja.nome") if loja_id else None
    return ContratoAssinaturaVariaveisResponse(
        loja_id=loja_id,
        loja_nome=loja_nome if loja_nome != _VAZIO else None,
        variaveis=[
            ContratoAssinaturaVariavelItem(chave=chave, label=label, valor=valores.get(chave, _VAZIO))
            for chave, label in VARIAVEIS_CONTRATO_ASSINATURA
        ],
    )


@router.post(
    "/contrato-assinatura/preview",
    response_model=ContratoAssinaturaPreviewResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def preview_contrato_assinatura(
    data: ContratoAssinaturaPreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Renderiza o texto do contrato com as variáveis já substituídas."""
    valores = await resolver_variaveis_contrato_assinatura(db, data.loja_id, data.plano_id)
    conteudo, nao_resolvidas = aplicar_variaveis_contrato(data.conteudo_html, valores)
    return ContratoAssinaturaPreviewResponse(conteudo_html=conteudo, nao_resolvidas=nao_resolvidas)


async def _montar_contrato_resolvido(
    db: AsyncSession, loja_id: Optional[str], versao_id: Optional[str] = None
) -> tuple:
    """Carrega a versão pedida (ou a vigente) e resolve as variáveis da loja.
    Devolve (html_resolvido, versao)."""
    if versao_id:
        stmt = select(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.id == versao_id)
    else:
        stmt = select(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.vigente == True)  # noqa: E712
    versao = (await db.execute(stmt)).scalar_one_or_none()
    if not versao:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Nenhuma versão vigente do contrato foi cadastrada ainda." if not versao_id
            else "Versão do contrato não encontrada.",
        )

    valores = await resolver_variaveis_contrato_assinatura(db, loja_id, versao=versao.versao)
    conteudo, _ = aplicar_variaveis_contrato(versao.conteudo_html, valores)
    return conteudo, versao


@router.get(
    "/contrato-assinatura/documento",
    dependencies=[Depends(exige_admin_plataforma)],
)
async def baixar_contrato_assinatura(
    loja_id: Optional[str] = None,
    versao_id: Optional[str] = None,
    formato: str = "pdf",
    db: AsyncSession = Depends(get_db),
):
    """Contrato com as variáveis resolvidas, em PDF (download/impressão).

    `formato=html` — ou PDF indisponível no ambiente — devolve o HTML, que o
    navegador imprime com o mesmo layout A4.
    """
    conteudo, versao = await _montar_contrato_resolvido(db, loja_id, versao_id)
    nome_base = f"contrato-{versao.versao}".replace("/", "-").replace(" ", "-")

    if formato == "pdf":
        pdf = html_para_pdf(conteudo)
        if pdf:
            return Response(
                content=pdf,
                media_type="application/pdf",
                headers={"Content-Disposition": f'inline; filename="{nome_base}.pdf"'},
            )
        # Sem a lib de PDF: não falha, entrega o HTML para o navegador imprimir.

    return Response(
        content=conteudo,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'inline; filename="{nome_base}.html"'},
    )


@router.post(
    "/contrato-assinatura/enviar",
    response_model=ContratoAssinaturaEnviarResponse,
)
async def enviar_contrato_assinatura(
    data: ContratoAssinaturaEnviarRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    """Envia o contrato em PDF ao lojista para assinatura digital.

    O destinatário assina fora da plataforma (ICP-Brasil//plataforma de assinatura)
    e devolve o arquivo assinado respondendo ao e-mail.
    """
    loja = (await db.execute(select(Loja).where(Loja.id == data.loja_id))).scalar_one_or_none()
    if not loja:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    destino = (data.email or "").strip() or loja.email
    if not destino:
        # Cai no gestor da loja quando a loja não tem e-mail cadastrado.
        gestor = (await db.execute(
            select(Usuario)
            .join(MembroLoja, MembroLoja.usuario_id == Usuario.id)
            .where(
                MembroLoja.loja_id == loja.id,
                MembroLoja.papel == PapelUsuario.GESTOR,
                MembroLoja.ativo == True,  # noqa: E712
            )
            .order_by(MembroLoja.created_at.asc())
        )).scalars().first()
        destino = gestor.email if gestor else None
    if not destino:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="A loja não tem e-mail cadastrado e não há gestor ativo. Informe um destinatário.",
        )

    conteudo, versao = await _montar_contrato_resolvido(db, loja.id, data.versao_id)

    pdf = html_para_pdf(conteudo)
    if not pdf:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível gerar o PDF do contrato neste ambiente. Baixe o documento e envie manualmente.",
        )

    nome_arquivo = f"contrato-{loja.nome}-{versao.versao}.pdf".replace("/", "-").replace(" ", "-")
    enviado = await enviar_email(
        to=destino,
        subject=f"Contrato de prestação de serviço — Social Veículos ({versao.versao})",
        html=render_contrato_para_assinatura(
            loja_nome=loja.nome, versao=versao.versao, mensagem=data.mensagem,
        ),
        anexos=[(nome_arquivo, pdf)],
        reply_to=admin.email,
    )
    if not enviado:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="O provedor de e-mail recusou o envio. Tente novamente em instantes.",
        )

    await registrar_auditoria(
        db=db, loja_id=loja.id, ator_id=admin.id, ator_nome=admin.nome,
        acao="contrato_assinatura.enviar", entidade="loja", entidade_id=loja.id,
        detalhes=json.dumps({"email": destino, "versao": versao.versao}),
    )
    await db.commit()

    return ContratoAssinaturaEnviarResponse(enviado=True, email=destino, versao=versao.versao)


@router.get(
    "/contrato-assinatura/versoes",
    response_model=List[ContratoVersaoResponse],
    dependencies=[Depends(exige_admin_plataforma)],
)
async def listar_versoes_contrato_assinatura(db: AsyncSession = Depends(get_db)):
    stmt = select(ContratoAssinaturaVersao).order_by(ContratoAssinaturaVersao.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.get(
    "/contrato-assinatura/vigente",
    response_model=ContratoVersaoResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_versao_vigente_contrato_assinatura(db: AsyncSession = Depends(get_db)):
    stmt = select(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.vigente == True)
    versao = (await db.execute(stmt)).scalar_one_or_none()
    if not versao:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nenhuma versão do contrato foi cadastrada ainda.")
    return versao


@router.post(
    "/contrato-assinatura/versoes",
    response_model=ContratoVersaoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_versao_contrato_assinatura(
    data: ContratoVersaoCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    existente = (await db.execute(
        select(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.versao == data.versao)
    )).scalar_one_or_none()
    if existente:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Já existe uma versão de contrato com esse identificador.")

    if data.tornar_vigente:
        await db.execute(
            ContratoAssinaturaVersao.__table__.update()
            .where(ContratoAssinaturaVersao.vigente == True)
            .values(vigente=False)
        )

    versao = ContratoAssinaturaVersao(
        versao=data.versao.strip(),
        conteudo_html=data.conteudo_html,
        vigente=data.tornar_vigente,
        criado_por_admin_id=admin.id,
    )
    db.add(versao)
    await db.flush()

    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="contrato_assinatura.criar_versao", entidade="contrato_assinatura_versao", entidade_id=versao.id,
        detalhes=json.dumps({"versao": versao.versao, "vigente": versao.vigente}),
    )
    await db.commit()
    await db.refresh(versao)
    return versao


@router.patch(
    "/contrato-assinatura/versoes/{versao_id}/tornar-vigente",
    response_model=ContratoVersaoResponse,
)
async def tornar_vigente_versao_contrato_assinatura(
    versao_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    versao = (await db.execute(
        select(ContratoAssinaturaVersao).where(ContratoAssinaturaVersao.id == versao_id)
    )).scalar_one_or_none()
    if not versao:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Versão do contrato não encontrada.")

    await db.execute(
        ContratoAssinaturaVersao.__table__.update()
        .where(ContratoAssinaturaVersao.vigente == True)
        .values(vigente=False)
    )
    versao.vigente = True

    await registrar_auditoria(
        db=db, loja_id=None, ator_id=admin.id, ator_nome=admin.nome,
        acao="contrato_assinatura.tornar_vigente", entidade="contrato_assinatura_versao", entidade_id=versao.id,
        detalhes=json.dumps({"versao": versao.versao}),
    )
    await db.commit()
    await db.refresh(versao)
    return versao

