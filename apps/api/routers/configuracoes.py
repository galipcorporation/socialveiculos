"""
Social Veículos — Rotas de Configurações da Loja (Perfil) — Tarefa 8.5
Permite ao Gestor visualizar e editar o perfil da própria loja.
Escopado por tenant (loja do contexto) e protegido por RBAC (Recurso.CONFIGURACOES).
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import Loja
from rbac import exige_permissao, Acao, Recurso
from storage import storage_provider

_IMG_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_IMG_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
from schemas import (
    LojaResponse, LojaUpdateRequest,
    SimuladorBancoCredencialResponse, SimuladorBancoCredencialRequest,
    SimuladorTestarConexaoRequest, SimuladorTestarConexaoResponse,
)

router = APIRouter(prefix="/v1/configuracoes", tags=["Configurações da Loja"])


@router.get(
    "/bancos",
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))],
)
async def listar_bancos_suportados():
    """Catálogo único dos bancos suportados na tela de Credenciais Bancárias."""
    from simulador.bancos_catalogo import BANCOS_SUPORTADOS
    return BANCOS_SUPORTADOS


@router.get(
    "/loja",
    response_model=LojaResponse,
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))],
)
async def get_minha_loja(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Retorna o perfil completo da loja do usuário autenticado.
    🔒 Isolamento por Tenant: sempre a loja do contexto.
    """
    res = await db.execute(select(Loja).where(Loja.id == context.loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja não encontrada.",
        )
    return loja


@router.patch(
    "/loja",
    response_model=LojaResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))],
)
async def atualizar_minha_loja(
    data: LojaUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Atualiza os dados de perfil/configuração da própria loja.
    Campos sensíveis (slug, verificação, ativação) não são editáveis aqui — só pela plataforma.
    🔒 Isolamento por Tenant: só altera a loja do contexto.
    """
    res = await db.execute(select(Loja).where(Loja.id == context.loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja não encontrada.",
        )

    body = data.model_dump(exclude_unset=True)
    for key, value in body.items():
        setattr(loja, key, value)

    await db.commit()
    await db.refresh(loja)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="loja.editar",
        entidade="loja",
        entidade_id=loja.id,
        detalhes=json.dumps(body, ensure_ascii=False),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return loja


@router.post(
    "/loja/marca-dagua",
    response_model=LojaResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))],
)
async def upload_marca_dagua(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Sobe uma imagem específica de marca-d'água para os contratos da loja."""
    if file.content_type not in _IMG_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem PNG, JPG ou WEBP.")
    content = await file.read()
    if len(content) > _IMG_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Imagem muito grande. Máximo 2MB.")

    res = await db.execute(select(Loja).where(Loja.id == context.loja_id))
    loja = res.scalar_one_or_none()
    if not loja:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loja não encontrada.")

    url = await storage_provider.upload_file(
        content, file.filename or "marca-dagua.png", file.content_type,
        prefixo=f"lojas/{context.loja_id}/identidade",
    )
    loja.contrato_marca_dagua_url = url
    loja.contrato_marca_dagua_ativa = True
    await db.commit()
    await db.refresh(loja)
    return loja


SENHA_MASCARADA = "••••••••"


def _mascarar_usuario(u: str) -> str:
    """Mascara o usuário: primeiros 2 chars + *** + últimos 2 chars."""
    if len(u) <= 4:
        return u[0] + "***"
    return u[:2] + "***" + u[-2:]


def _credencial_to_response(c, decrypt_fn) -> dict:
    """Converte CredencialBanco em dict compatível com SimuladorBancoCredencialResponse."""
    usuario_mascarado = None
    try:
        raw = json.loads(decrypt_fn(c.credenciais_cifradas))
        u = raw.get("usuario") or raw.get("login") or raw.get("client_id", "")
        if u:
            usuario_mascarado = _mascarar_usuario(u)
    except Exception:
        pass
    return {
        "id": c.id,
        "loja_id": c.loja_id,
        "usuario_id": c.usuario_id,
        "banco": c.banco,
        "escopo": "vendedor" if c.usuario_id else "loja",
        "usuario_configurado": usuario_mascarado,
        "ativo": c.ativo,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get(
    "/credenciais_banco",
    response_model=list[SimuladorBancoCredencialResponse],
    dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))],
)
async def listar_credenciais_banco(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Lista credenciais da loja + credencial pessoal do usuário logado."""
    from models import CredencialBanco
    from simulador.crypt import decrypt_credentials
    from sqlalchemy import or_
    res = await db.execute(
        select(CredencialBanco).where(
            CredencialBanco.loja_id == context.loja_id,
            or_(CredencialBanco.usuario_id.is_(None), CredencialBanco.usuario_id == context.usuario.id)
        )
    )
    credenciais = res.scalars().all()
    return [_credencial_to_response(c, decrypt_credentials) for c in credenciais]


@router.post(
    "/credenciais_banco",
    response_model=SimuladorBancoCredencialResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))],
)
async def salvar_credenciais_banco(
    data: SimuladorBancoCredencialRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Salva ou atualiza credenciais (usuário+senha) de um banco.

    escopo="loja" → grava usuario_id=NULL (gestor/admin only).
    escopo="vendedor" → grava usuario_id=<usuário logado> (qualquer papel).
    """
    from models import CredencialBanco, PapelUsuario
    from simulador.crypt import encrypt_credentials, decrypt_credentials

    usuario_id_alvo: str | None = None
    if data.escopo == "vendedor":
        usuario_id_alvo = context.usuario.id
    else:
        # Somente gestor/admin pode configurar credencial da loja
        if context.usuario.papel not in (PapelUsuario.GESTOR, PapelUsuario.ADMIN_PLATAFORMA):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Somente gestores podem configurar credenciais da loja.")

    res = await db.execute(
        select(CredencialBanco).where(
            CredencialBanco.loja_id == context.loja_id,
            CredencialBanco.banco == data.banco,
            CredencialBanco.usuario_id == usuario_id_alvo,
        )
    )
    cred = res.scalar_one_or_none()

    # Usuário/senha mascarados reenviados pelo front (edição sem trocar o campo) → mantém o valor cifrado existente
    usuario = data.usuario
    senha = data.senha
    if cred:
        raw_atual = json.loads(decrypt_credentials(cred.credenciais_cifradas))
        if senha == SENHA_MASCARADA:
            senha = raw_atual.get("senha", "")
        if usuario == _mascarar_usuario(raw_atual.get("usuario", "")):
            usuario = raw_atual.get("usuario", usuario)

    payload_cifrado = encrypt_credentials(json.dumps({"usuario": usuario, "senha": senha}))

    if cred:
        cred.credenciais_cifradas = payload_cifrado
        cred.ativo = True
    else:
        cred = CredencialBanco(
            loja_id=context.loja_id,
            usuario_id=usuario_id_alvo,
            banco=data.banco,
            credenciais_cifradas=payload_cifrado,
            ativo=True,
        )
        db.add(cred)

    await db.commit()
    await db.refresh(cred)

    await registrar_auditoria(
        db=db,
        loja_id=context.loja_id,
        ator_id=context.usuario.id,
        ator_nome=context.usuario.nome,
        acao="configuracoes.credencial_banco.salvar",
        entidade="credencial_banco",
        entidade_id=cred.id,
        detalhes=json.dumps({"banco": str(data.banco), "escopo": data.escopo}, ensure_ascii=False),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return _credencial_to_response(cred, decrypt_credentials)


@router.post(
    "/credenciais_banco/testar",
    response_model=SimuladorTestarConexaoResponse,
    dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))],
)
async def testar_credencial_banco(
    data: SimuladorTestarConexaoRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Testa login real no site do banco via Selenium antes de salvar a credencial.

    Se a senha vier mascarada (edição de credencial já salva), decifra a senha
    real armazenada para o par (loja, banco, escopo do usuário atual) e testa com ela.
    """
    from models import CredencialBanco
    from simulador.crypt import decrypt_credentials
    from simulador.automation.credential_validator import validate_credentials_async
    from sqlalchemy import or_

    senha = data.senha
    if senha == SENHA_MASCARADA:
        res = await db.execute(
            select(CredencialBanco).where(
                CredencialBanco.loja_id == context.loja_id,
                CredencialBanco.banco == data.banco,
                or_(CredencialBanco.usuario_id == context.usuario.id, CredencialBanco.usuario_id.is_(None)),
            )
        )
        cred = res.scalars().first()
        if not cred:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Nenhuma credencial salva para testar.")
        raw_atual = json.loads(decrypt_credentials(cred.credenciais_cifradas))
        senha = raw_atual.get("senha", "")

    resultado = await validate_credentials_async(data.banco.value, data.usuario, senha)
    return {"valido": bool(resultado.get("valid")), "mensagem": resultado.get("message", "")}
