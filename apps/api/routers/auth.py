"""
Social Veículos — Rotas de Autenticação e Sessão
"""

import base64
import secrets
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Optional, Union

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field, model_validator, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from database import get_db
from deps import get_current_user, credentials_exception, registrar_auditoria
from models import Usuario, Loja, MembroLoja, Sessao, PapelUsuario
from config import settings
from limiter import rate_limit
from storage import storage_provider
from email_service import enviar_email, render_reset_senha
import oauth_google

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 15 * 1024 * 1024  # 15MB

router = APIRouter(prefix="/v1/auth", tags=["Autenticação"])

# ── Schemas Pydantic ───────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    nome: str
    email: EmailStr
    papel: PapelUsuario
    ativo: bool
    mfa_ativo: bool = False
    avatar_url: Optional[str] = None
    modulos: Optional[str] = None  # JSON array de módulos liberados (vendedor)
    loja_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MfaChallengeResponse(BaseModel):
    mfa_challenge_token: str
    mfa_required: bool = True


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_code_base64: str


class MfaEnrollRequest(BaseModel):
    senha: Optional[str] = None


class MfaConfirmRequest(BaseModel):
    codigo: str = Field(..., min_length=6, max_length=6)


class MfaDisableRequest(BaseModel):
    senha: str


class MfaVerifyLoginRequest(BaseModel):
    mfa_challenge_token: str
    codigo: str = Field(..., min_length=6, max_length=6)


class RegisterB2BRequest(BaseModel):
    # Dados da Loja
    loja_nome: str = Field(..., min_length=2, max_length=200)
    loja_cnpj: Optional[str] = Field(None, max_length=18)
    loja_telefone: Optional[str] = Field(None, max_length=20)
    loja_whatsapp: Optional[str] = Field(None, max_length=20)

    # Dados do Gestor
    nome: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    senha: str = Field(..., min_length=6)

    @model_validator(mode='before')
    @classmethod
    def fallback_nome_loja(cls, data: dict) -> dict:
        if isinstance(data, dict):
            if "nome_loja" in data and ("loja_nome" not in data or data["loja_nome"] is None):
                data["loja_nome"] = data["nome_loja"]
            if "nome" not in data or not data["nome"]:
                data["nome"] = data.get("loja_nome") or data.get("nome_loja") or "Gestor"
        return data


class RegisterB2CRequest(BaseModel):
    nome: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    senha: str = Field(..., min_length=6)
    telefone: Optional[str] = Field(None, max_length=20)


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    nova_senha: str = Field(..., min_length=6)


# ── Helpers ────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Gera um slug simples a partir de um texto."""
    import unicodedata
    import re
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text).strip('-')
    return text


async def _emitir_sessao_login(
    db: AsyncSession,
    user: Usuario,
    request: Request,
    acao_auditoria: str = "auth.login",
) -> LoginResponse:
    """Cria Sessao + JWT para um usuário já autenticado (senha, Google ou pós-MFA)."""
    client_ip = request.client.host if request.client else None

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "papel": user.papel.value}
    )
    refresh_token = secrets.token_hex(32)
    user_agent = request.headers.get("user-agent")

    nova_sessao = Sessao(
        usuario_id=user.id,
        refresh_token=refresh_token,
        ip=client_ip,
        user_agent=user_agent,
        expira_em=datetime.now(timezone.utc) + timedelta(days=7),
        revogada=False
    )
    db.add(nova_sessao)

    loja_id = None
    modulos_membro = None
    if user.papel != PapelUsuario.CLIENTE:
        stmt = select(MembroLoja).where(MembroLoja.usuario_id == user.id, MembroLoja.ativo == True)
        membro_res = await db.execute(stmt)
        membro = membro_res.scalar_one_or_none()
        if membro:
            loja_id = membro.loja_id
            modulos_membro = membro.modulos

    await registrar_auditoria(
        db=db,
        loja_id=loja_id,
        ator_id=user.id,
        ator_nome=user.nome,
        acao=acao_auditoria,
        entidade="usuario",
        entidade_id=user.id,
        detalhes=f"Login bem-sucedido. Papel: {user.papel.value}",
        ip=client_ip
    )

    user_resp = UserResponse.model_validate(user)
    user_resp.modulos = modulos_membro
    user_resp.loja_id = loja_id

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_resp
    )


# ── Endpoints ──────────────────────────────────────────────────

@router.post("/register-b2b", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(5, 60))])
async def register_b2b(data: RegisterB2BRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Cadastra uma nova Loja (Tenant) e o Usuário Gestor inicial associado.
    """
    # 1. Verificar se o e-mail do usuário já existe
    res_user = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if res_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este endereço de e-mail já está sendo utilizado."
        )

    # 2. Criar Slug único para a Loja
    base_slug = slugify(data.loja_nome)
    slug = base_slug
    counter = 1
    while True:
        res_loja = await db.execute(select(Loja).where(Loja.slug == slug))
        if not res_loja.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # 3. Criar Loja
    nova_loja = Loja(
        nome=data.loja_nome,
        slug=slug,
        cnpj=data.loja_cnpj,
        telefone=data.loja_telefone,
        whatsapp=data.loja_whatsapp,
        ativa=True
    )
    db.add(nova_loja)
    await db.flush()  # Para obter o ID da loja

    # 4. Criar Usuário Gestor
    novo_usuario = Usuario(
        nome=data.nome,
        email=data.email,
        senha_hash=hash_password(data.senha),
        papel=PapelUsuario.GESTOR,
        ativo=True
    )
    db.add(novo_usuario)
    await db.flush()  # Para obter o ID do usuário

    # 5. Criar Vínculo MembroLoja
    membro = MembroLoja(
        usuario_id=novo_usuario.id,
        loja_id=nova_loja.id,
        papel=PapelUsuario.GESTOR,
        ativo=True
    )
    db.add(membro)

    # Registrar Auditoria
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=nova_loja.id,
        ator_id=novo_usuario.id,
        ator_nome=novo_usuario.nome,
        acao="auth.register_b2b",
        entidade="usuario",
        entidade_id=novo_usuario.id,
        detalhes=f"Novo cadastro de Loja: {nova_loja.nome} por {novo_usuario.nome}",
        ip=client_ip
    )

    # Dar commit e refresh para popular os defaults no objeto Python (ex: mfa_ativo, id)
    await db.commit()
    await db.refresh(novo_usuario)

    user_resp = UserResponse.model_validate(novo_usuario)
    user_resp.loja_id = nova_loja.id
    return user_resp


@router.post("/login", response_model=Union[LoginResponse, MfaChallengeResponse], dependencies=[Depends(rate_limit(10, 60))])
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica usuário B2B/B2C, cria sessão no banco e retorna Tokens.
    """
    res = await db.execute(select(Usuario).where(Usuario.email == data.email))
    user = res.scalar_one_or_none()

    client_ip = request.client.host if request.client else None

    if not user or not verify_password(data.senha, user.senha_hash):
        await registrar_auditoria(
            db=db,
            loja_id=None,
            ator_id=None,
            ator_nome=data.email,
            acao="auth.login_failed",
            entidade="usuario",
            entidade_id=None,
            detalhes="Tentativa de login falhou: e-mail ou senha incorretos",
            ip=client_ip
        )
        await db.commit()  # Garante persistência do log mesmo lançando erro
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos."
        )

    if not user.ativo:
        await registrar_auditoria(
            db=db,
            loja_id=None,
            ator_id=user.id,
            ator_nome=user.nome,
            acao="auth.login_failed",
            entidade="usuario",
            entidade_id=user.id,
            detalhes="Tentativa de login falhou: conta inativa",
            ip=client_ip
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta conta está inativa."
        )
    if user.mfa_ativo:
        challenge_token = create_access_token(
            data={"sub": user.id, "scope": "mfa_pending"},
            expires_delta=timedelta(minutes=5),
        )
        return MfaChallengeResponse(mfa_challenge_token=challenge_token)

    return await _emitir_sessao_login(db, user, request)


# ── Login social (Google) ───────────────────────────────────────

@router.get("/google/login")
async def google_login():
    """Redireciona ao consent screen do Google (Authorization Code flow)."""
    try:
        state = oauth_google.gerar_state()
        url = oauth_google.montar_authorize_url(state)
    except oauth_google.GoogleOAuthError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login com Google indisponível no momento.",
        )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    error: Optional[str] = None,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Troca o code pelo id_token, cria/vincula o Usuario e emite os tokens da plataforma."""
    # Usuário negou o consentimento (ou Google devolveu erro): sem `code`.
    # Sem este tratamento o FastAPI responderia 422 (query param obrigatório ausente).
    if error or not code:
        return RedirectResponse(
            f"{settings.vitrine_base_url}/auth/google/callback#erro=google_consentimento_negado"
        )

    # B030: state emitido em /google/login precisa bater aqui (login-CSRF do OAuth 2.0 §10.12).
    if not oauth_google.validar_state(state):
        return RedirectResponse(
            f"{settings.vitrine_base_url}/auth/google/callback#erro=state_invalido"
        )
    try:
        dados = await oauth_google.obter_dados_usuario_google(code)
    except oauth_google.GoogleOAuthError:
        return RedirectResponse(f"{settings.vitrine_base_url}/auth/google/callback#erro=google_oauth_falhou")

    res = await db.execute(select(Usuario).where(Usuario.google_sub == dados["sub"]))
    user = res.scalar_one_or_none()

    if not user:
        res_email = await db.execute(select(Usuario).where(Usuario.email == dados["email"]))
        user = res_email.scalar_one_or_none()

        if user:
            user.google_sub = dados["sub"]
        else:
            user = Usuario(
                nome=dados["nome"],
                email=dados["email"],
                senha_hash=None,
                avatar_url=dados.get("avatar_url"),
                papel=PapelUsuario.CLIENTE,
                google_sub=dados["sub"],
            )
            db.add(user)
            await db.flush()

    callback_base = f"{settings.vitrine_base_url}/auth/google/callback"

    if not user.ativo:
        return RedirectResponse(f"{callback_base}#erro=conta_inativa")

    if user.mfa_ativo:
        challenge_token = create_access_token(
            data={"sub": user.id, "scope": "mfa_pending"},
            expires_delta=timedelta(minutes=5),
        )
        return RedirectResponse(f"{callback_base}#mfa_challenge_token={challenge_token}")

    sessao = await _emitir_sessao_login(db, user, request, acao_auditoria="auth.login_google")
    return RedirectResponse(
        f"{callback_base}#access_token={sessao.access_token}&refresh_token={sessao.refresh_token}"
    )


# ── MFA (TOTP) ───────────────────────────────────────────────────

@router.post("/mfa/enroll", response_model=MfaEnrollResponse, dependencies=[Depends(rate_limit(10, 60))])
async def mfa_enroll(
    data: MfaEnrollRequest = MfaEnrollRequest(),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Gera um novo secret TOTP pendente (só /mfa/confirm o promove a ativo).
    B031: se o MFA já está ativo, exige a senha atual antes de reiniciar o enroll —
    caso contrário uma sessão roubada (sem senha/TOTP) poderia reiniciar o MFA à vontade.
    """
    if current_user.mfa_ativo:
        if not current_user.senha_hash or not data.senha or not verify_password(data.senha, current_user.senha_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta.")

    secret = pyotp.random_base32()
    current_user.mfa_secret_pendente = secret
    await db.commit()

    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email, issuer_name="Social Veículos"
    )

    img = qrcode.make(otpauth_url)
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return MfaEnrollResponse(secret=secret, otpauth_url=otpauth_url, qr_code_base64=qr_base64)


@router.post("/mfa/confirm", dependencies=[Depends(rate_limit(5, 60))])
async def mfa_confirm(
    data: MfaConfirmRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirma o enroll: valida o primeiro código gerado pelo app autenticador e ativa o MFA."""
    if not current_user.mfa_secret_pendente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum enroll de MFA pendente.")

    totp = pyotp.TOTP(current_user.mfa_secret_pendente)
    if not totp.verify(data.codigo, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido.")

    current_user.mfa_secret = current_user.mfa_secret_pendente
    current_user.mfa_secret_pendente = None
    current_user.mfa_ativo = True
    await db.commit()
    return {"mfa_ativo": True}


@router.post("/mfa/disable", dependencies=[Depends(rate_limit(10, 60))])
async def mfa_disable(
    data: MfaDisableRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Desativa o MFA — exige a senha atual (contas Google-only não podem usar esta rota sem senha)."""
    if not current_user.senha_hash or not verify_password(data.senha, current_user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta.")

    current_user.mfa_secret = None
    current_user.mfa_secret_pendente = None
    current_user.mfa_ativo = False
    await db.commit()
    return {"mfa_ativo": False}


@router.post("/mfa/verify-login", response_model=LoginResponse, dependencies=[Depends(rate_limit(5, 60))])
async def mfa_verify_login(
    data: MfaVerifyLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Segunda etapa do login quando MFA está ativo: troca o challenge + código TOTP pelos tokens finais."""
    payload = decode_access_token(data.mfa_challenge_token)
    if not payload or payload.get("scope") != "mfa_pending":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Challenge de MFA inválido ou expirado.")

    res = await db.execute(select(Usuario).where(Usuario.id == payload["sub"]))
    user = res.scalar_one_or_none()
    if not user or not user.mfa_ativo or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MFA não está ativo para este usuário.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(data.codigo, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido.")

    return await _emitir_sessao_login(db, user, request)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    data: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Renova o access_token utilizando um refresh_token válido (rotação).
    """
    # 1. Buscar a sessão correspondente
    stmt = (
        select(Sessao)
        .options(selectinload(Sessao.usuario))
        .where(Sessao.refresh_token == data.refresh_token)
    )
    res = await db.execute(stmt)
    sessao = res.scalar_one_or_none()

    # Validar a sessão
    if not sessao or sessao.revogada or sessao.expira_em.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada ou inválida."
        )

    user = sessao.usuario
    if not user or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inválido ou inativo."
        )

    # 2. Rotacionar tokens: invalidar sessão atual
    sessao.revogada = True

    new_access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "papel": user.papel.value}
    )
    new_refresh_token = secrets.token_hex(32)

    # Salvar nova sessão
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    nova_sessao = Sessao(
        usuario_id=user.id,
        refresh_token=new_refresh_token,
        ip=client_ip,
        user_agent=user_agent,
        expira_em=datetime.now(timezone.utc) + timedelta(days=7),
        revogada=False
    )
    db.add(nova_sessao)

    return RefreshResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    data: LogoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Revoga o refresh token informado, invalidando a sessão.
    """
    res = await db.execute(
        select(Sessao).where(
            Sessao.refresh_token == data.refresh_token,
            Sessao.usuario_id == current_user.id
        )
    )
    sessao = res.scalar_one_or_none()
    
    if sessao:
        sessao.revogada = True
        
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=current_user.id,
        ator_nome=current_user.nome,
        acao="auth.logout",
        entidade="usuario",
        entidade_id=current_user.id,
        detalhes="Sessão finalizada (logout).",
        ip=client_ip
    )
    
    await db.commit()
    return {"message": "Sessão revogada com sucesso."}


@router.post("/register-b2c", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(10, 60))])
async def register_b2c(data: RegisterB2CRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Cadastra um novo Cliente (B2C) simplificado para acesso à Vitrine.
    """
    res_user = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if res_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este endereço de e-mail já está sendo utilizado."
        )

    novo_cliente = Usuario(
        nome=data.nome,
        email=data.email,
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        papel=PapelUsuario.CLIENTE,
        ativo=True
    )
    db.add(novo_cliente)
    await db.flush()

    # Registrar Auditoria
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=novo_cliente.id,
        ator_nome=novo_cliente.nome,
        acao="auth.register_b2c",
        entidade="usuario",
        entidade_id=novo_cliente.id,
        detalhes=f"Novo cadastro de cliente B2C: {novo_cliente.nome}",
        ip=client_ip
    )

    # Dar commit e refresh para popular os defaults no objeto Python (ex: mfa_ativo, id)
    await db.commit()
    await db.refresh(novo_cliente)

    return novo_cliente


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retorna o usuário autenticado (inclui avatar_url)."""
    user_resp = UserResponse.model_validate(current_user)
    if current_user.papel != PapelUsuario.CLIENTE:
        stmt = select(MembroLoja).where(MembroLoja.usuario_id == current_user.id, MembroLoja.ativo == True)
        membro_res = await db.execute(stmt)
        membro = membro_res.scalar_one_or_none()
        if membro:
            user_resp.loja_id = membro.loja_id
            user_resp.modulos = membro.modulos
    return user_resp


@router.post("/me/avatar", response_model=UserResponse, dependencies=[Depends(rate_limit(10, 60))])
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Faz upload da foto de perfil (avatar) do usuário autenticado.
    Disponível para qualquer usuário logado (inclui clientes B2C da Vitrine).
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Use JPEG, PNG ou WEBP.",
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Imagem muito grande. Limite máximo: {MAX_AVATAR_SIZE // (1024*1024)}MB.",
        )

    try:
        url = await storage_provider.upload_file(content, file.filename or "avatar", content_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao enviar imagem ao storage: {str(e)}",
        )

    current_user.avatar_url = url
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=current_user.id,
        ator_nome=current_user.nome,
        acao="auth.update_avatar",
        entidade="usuario",
        entidade_id=current_user.id,
        detalhes="Foto de perfil (avatar) atualizada.",
        ip=client_ip,
    )
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_200_OK, dependencies=[Depends(rate_limit(5, 60))])
async def forgot_password(data: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Gera um token temporário assinado via JWT e simula o envio do e-mail de recuperação de senha.
    """
    res = await db.execute(select(Usuario).where(Usuario.email == data.email))
    user = res.scalar_one_or_none()

    # Sempre retornar mensagem de sucesso genérica para evitar User Enumeration
    msg = "Se o e-mail existir no nosso sistema, as instruções de recuperação foram enviadas."
    
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=user.id if user else None,
        ator_nome=user.nome if user else data.email,
        acao="auth.forgot_password",
        entidade="usuario",
        entidade_id=user.id if user else None,
        detalhes=f"Solicitação de recuperação de senha para {data.email} (Encontrado: {user is not None})",
        ip=client_ip
    )
    await db.commit()

    if not user:
        return {"message": msg}

    # Gerar token JWT temporário de 15 minutos com payload específico para reset
    reset_token = create_access_token(
        data={"sub": user.id, "purpose": "reset_password"},
        expires_delta=timedelta(minutes=15)
    )

    # Enviar o e-mail de recuperação. Em dev (sem RESEND_API_KEY) o email_service
    # imprime o link no console; em prod envia via Resend. Falha de envio não
    # altera a resposta genérica (anti user-enumeration).
    reset_link = f"{settings.gestor_base_url}/reset-password?token={reset_token}"
    await enviar_email(
        to=user.email,
        subject="Recuperação de senha — Social Veículos",
        html=render_reset_senha(nome=user.nome, link=reset_link),
    )

    return {"message": msg}


@router.post("/reset-password", status_code=status.HTTP_200_OK, dependencies=[Depends(rate_limit(5, 60))])
async def reset_password(data: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Reseta a senha do usuário caso o token temporário seja válido.
    """
    payload = decode_access_token(data.token)
    if not payload or payload.get("purpose") != "reset_password":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de recuperação inválido ou expirado."
        )

    user_id = payload.get("sub")
    res = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = res.scalar_one_or_none()

    if not user or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inválido ou inativo."
        )

    # Atualizar senha
    user.senha_hash = hash_password(data.nova_senha)

    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=user.id,
        ator_nome=user.nome,
        acao="auth.reset_password",
        entidade="usuario",
        entidade_id=user.id,
        detalhes="Senha redefinida com sucesso via token de recuperação.",
        ip=client_ip
    )

    await db.commit()
    return {"message": "Senha atualizada com sucesso."}
