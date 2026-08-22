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
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from sqlalchemy.orm import selectinload

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    set_auth_cookies,
    clear_auth_cookies,
    COOKIE_REFRESH,
)
from database import get_db
from deps import get_current_user, registrar_auditoria
from models import Usuario, Loja, MembroLoja, Sessao, PapelUsuario, utcnow
from modulos import modulos_padrao_json
from config import settings
from limiter import rate_limit, conta_bloqueada_por_falhas, registrar_falha_login, limpar_falhas_login
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
    telefone: Optional[str] = None
    modulos: Optional[str] = None  # JSON array de módulos liberados (vendedor)
    loja_id: Optional[str] = None
    # Preferências do app — o mobile decide por aqui se desenha o botão
    # flutuante e se ainda deve perguntar sobre ele no primeiro acesso.
    botao_flutuante: bool = True
    botao_flutuante_perguntar: bool = True

    model_config = ConfigDict(from_attributes=True)


class _EmailNormalizadoMixin(BaseModel):
    """Minúsculo e sem espaços em todo e-mail que entra.

    `EmailStr` valida o formato mas preserva a caixa, e a busca é `Usuario.email
    == data.email` (case-sensitive no Postgres): sem isto, quem cadastra com Caps
    Lock nunca mais loga digitando normal, e a checagem de duplicidade — que usa
    a mesma comparação — deixa passar duas contas para o mesmo e-mail, furando o
    unique da coluna. Herdado por todo schema de entrada com e-mail. (ver B107)
    """

    @field_validator("email", mode="before", check_fields=False)
    @classmethod
    def _v_email(cls, v):
        return v.strip().lower() if isinstance(v, str) else v


class UpdateMeRequest(BaseModel):
    """Edição do próprio perfil. E-mail e papel não mudam por aqui."""
    nome: Optional[str] = Field(None, min_length=2, max_length=200)
    telefone: Optional[str] = Field(None, max_length=20)


class ChangePasswordMeRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(..., min_length=6, max_length=100)


class PreferenciasMeRequest(BaseModel):
    """
    Preferências de interface do próprio usuário. Campo omitido = não mexe.

    Fica fora do PATCH /me porque perfil gera auditoria: gravar "perfil
    atualizado" toda vez que alguém liga/desliga um botão polui o log.
    """
    botao_flutuante: Optional[bool] = None
    botao_flutuante_perguntar: Optional[bool] = None


class LoginRequest(_EmailNormalizadoMixin):
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


class RegisterB2BRequest(_EmailNormalizadoMixin):
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


class RegisterB2CRequest(_EmailNormalizadoMixin):
    nome: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    senha: str = Field(..., min_length=6)
    telefone: Optional[str] = Field(None, max_length=20)


class RefreshRequest(BaseModel):
    # Opcional: o front web (cookie httpOnly) não manda isto no body — o
    # endpoint lê do cookie sv_refresh quando ausente. Mobile continua
    # mandando sempre, porque não tem cookie jar de browser.
    refresh_token: Optional[str] = None


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None  # ausente no front web (cookie httpOnly)


class ForgotPasswordRequest(_EmailNormalizadoMixin):
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


# Cookies httpOnly (M6, 2026-08-21): mecanismo ADICIONAL ao token no body,
# não substituição — o mobile (Expo/React Native) não é origem HTTP com
# cookie jar de browser e continua lendo access_token/refresh_token do body,
# via AsyncStorage próprio. Os fronts web (gestor/vitrine/admin/site) devem
# migrar para consumir só o cookie: um XSS que rouba o body da resposta de
# /login também rouba o token de um localStorage, mas não lê um cookie
# httpOnly — daí a defesa real.
#
# samesite="lax", não "none": os 4 vercel.json já reescrevem /v1/* para a API
# do Fly (`{ "src": "/v1/(.*)", "dest": "https://socialveiculos-api.fly.dev/v1/$1" }`),
# então do ponto de vista do browser a API É a mesma origem do front em
# produção — não existe cenário cross-site real aqui. "lax" é estritamente
# mais seguro (mitiga CSRF em navegação cross-site) e evita as
# inconsistências de "none" em navegadores com bloqueio agressivo de
# third-party cookies (Safari ITP) — que aqui nem se aplicariam, mas não há
# motivo para pagar o risco de "none" sem precisar dele.
# `secure=True` sempre: os 4 fronts e a API rodam em HTTPS (Vercel + Fly), não
# há cenário de dev-sobre-HTTP em produção; localhost em dev http não
# seta/envia o cookie (aceitável — dev local continua no fluxo de Bearer
# token puro, sem proxy do Vercel).
#
# Implementação em auth.py (módulo raiz, não este router): routers/admin.py
# também precisa setar o cookie no fluxo de impersonação de admin, e
# importar de um router pro outro criaria ciclo.
_set_auth_cookies = set_auth_cookies
_clear_auth_cookies = clear_auth_cookies
_COOKIE_REFRESH = COOKIE_REFRESH


async def _emitir_sessao_login(
    db: AsyncSession,
    user: Usuario,
    request: Request,
    response: Optional[Response] = None,
    acao_auditoria: str = "auth.login",
) -> LoginResponse:
    """Cria Sessao + JWT para um usuário já autenticado (senha, Google ou pós-MFA)."""
    await limpar_falhas_login(user.email)
    client_ip = request.client.host if request.client else None

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "papel": user.papel.value, "typ": "access"}
    )
    refresh_token = secrets.token_hex(32)
    user_agent = request.headers.get("user-agent")

    nova_sessao = Sessao(
        usuario_id=user.id,
        refresh_token=refresh_token,
        ip=client_ip,
        user_agent=user_agent,
        expira_em=utcnow() + timedelta(days=7),
        revogada=False
    )
    db.add(nova_sessao)

    loja_id = None
    modulos_membro = None
    if user.papel != PapelUsuario.CLIENTE:
        # Usuário pode ter vínculo com várias lojas: entra na mais antiga e troca
        # depois pelo seletor de loja. scalar_one_or_none() aqui estourava 500.
        stmt = (
            select(MembroLoja)
            .where(MembroLoja.usuario_id == user.id, MembroLoja.ativo == True)
            .order_by(MembroLoja.created_at)
            .limit(1)
        )
        membro_res = await db.execute(stmt)
        membro = membro_res.scalars().first()
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

    if response is not None:
        _set_auth_cookies(response, access_token, refresh_token)

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
    # `modulos` preenchido mesmo para gestor (que enxerga tudo por bypass): NULL
    # é o estado que deixa um vendedor sem nenhuma aba no mobile, e o vínculo
    # pode ser rebaixado depois.
    membro = MembroLoja(
        usuario_id=novo_usuario.id,
        loja_id=nova_loja.id,
        papel=PapelUsuario.GESTOR,
        modulos=modulos_padrao_json(),
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
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica usuário B2B/B2C, cria sessão no banco e retorna Tokens.
    """
    client_ip = request.client.host if request.client else None

    # Trava por CONTA (independente de IP): o rate_limit(10, 60) da rota é por
    # IP e não barra credential stuffing distribuído (um IP por tentativa,
    # mesmo e-mail alvo). Checar antes de tocar no banco.
    if await conta_bloqueada_por_falhas(data.email):
        await registrar_auditoria(
            db=db,
            loja_id=None,
            ator_id=None,
            ator_nome=data.email,
            acao="auth.login_failed",
            entidade="usuario",
            entidade_id=None,
            detalhes="Tentativa de login bloqueada: muitas falhas recentes para esta conta",
            ip=client_ip,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas para esta conta. Tente novamente em alguns minutos.",
        )

    res = await db.execute(select(Usuario).where(Usuario.email == data.email))
    user = res.scalar_one_or_none()

    if not user or not verify_password(data.senha, user.senha_hash):
        await registrar_falha_login(data.email)
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

    # Gestor/Vendedor precisa de um vínculo de loja ATIVO para entrar. Se o membro
    # foi desativado na Equipe, bloqueia já no login (Usuario.ativo pode ser True).
    if user.papel not in (PapelUsuario.CLIENTE, PapelUsuario.ADMIN_PLATAFORMA):
        membro_res = await db.execute(
            select(MembroLoja)
            .where(MembroLoja.usuario_id == user.id, MembroLoja.ativo == True)
            .limit(1)
        )
        if not membro_res.scalars().first():
            await registrar_auditoria(
                db=db, loja_id=None, ator_id=user.id, ator_nome=user.nome,
                acao="auth.login_failed", entidade="usuario", entidade_id=user.id,
                detalhes="Tentativa de login falhou: sem vínculo de loja ativo", ip=client_ip,
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Seu acesso a esta loja foi desativado. Contate o gestor.",
            )

    if user.mfa_ativo:
        challenge_token = create_access_token(
            data={"sub": user.id, "scope": "mfa_pending"},
            expires_delta=timedelta(minutes=5),
        )
        return MfaChallengeResponse(mfa_challenge_token=challenge_token)

    return await _emitir_sessao_login(db, user, request, response)


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
    redirect = RedirectResponse(
        f"{callback_base}#access_token={sessao.access_token}&refresh_token={sessao.refresh_token}"
    )
    _set_auth_cookies(redirect, sessao.access_token, sessao.refresh_token)
    return redirect


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
    img.save(buf, format="PNG")  # type: ignore
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
    response: Response,
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

    return await _emitir_sessao_login(db, user, request, response)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    data: RefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Renova o access_token utilizando um refresh_token válido (rotação).
    """
    refresh_token_recebido = data.refresh_token or request.cookies.get(_COOKIE_REFRESH)
    if not refresh_token_recebido:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token ausente.")

    # 1. Buscar a sessão correspondente
    stmt = (
        select(Sessao)
        .options(selectinload(Sessao.usuario))
        .where(Sessao.refresh_token == refresh_token_recebido)
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
        data={"sub": user.id, "email": user.email, "papel": user.papel.value, "typ": "access"}
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
        expira_em=utcnow() + timedelta(days=7),
        revogada=False
    )
    db.add(nova_sessao)

    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return RefreshResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    data: LogoutRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Revoga o refresh token informado, invalidando a sessão.
    """
    refresh_token_recebido = data.refresh_token or request.cookies.get(_COOKIE_REFRESH)
    res = await db.execute(
        select(Sessao).where(
            Sessao.refresh_token == refresh_token_recebido,
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
    _clear_auth_cookies(response)
    return {"message": "Sessão revogada com sucesso."}


class AdotarCookieRequest(BaseModel):
    access_token: str
    refresh_token: str


class WsTokenResponse(BaseModel):
    ws_token: str


@router.post("/ws-token", response_model=WsTokenResponse, dependencies=[Depends(rate_limit(30, 60))])
async def gerar_ws_token(current_user: Usuario = Depends(get_current_user)):
    """
    Token de vida curta (60s) só para abrir o handshake do WebSocket.

    O WS conecta DIRETO no host do Fly em produção (VITE_WS_URL), não pelo
    proxy do Vercel como as chamadas HTTP normais — é cross-origin de
    verdade, e o cookie httpOnly (SameSite=Lax) não vai nesse handshake. Sem
    isso o front precisaria voltar a guardar o access_token de sessão
    inteira em algum lugar acessível ao JS só para o WS: este token dura
    60s e não serve para mais nada (`typ=ws`, get_current_user o rejeita).
    """
    token = create_access_token(
        {"sub": current_user.id, "typ": "ws"},
        expires_delta=timedelta(seconds=60),
    )
    return WsTokenResponse(ws_token=token)


@router.post("/adotar-cookie", status_code=status.HTTP_200_OK)
async def adotar_cookie(data: AdotarCookieRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Transforma um par access_token/refresh_token recebido via fragmento de
    URL (nunca vai a log — ver GoogleCallback do front) em cookie httpOnly
    NESTA origem. Usado pelas telas de callback (Google OAuth, SSO
    Gestor→Vitrine): a API só redireciona com tokens no fragmento, quem
    "adota" como cookie é sempre o front que efetivamente recebeu a URL —
    cookie é por origem, então só o domínio de destino pode setar o seu.
    Não cria sessão nova: só valida que o access_token é um `typ=access`
    genuíno (assinado por nós) e que a Sessao do refresh_token existe e não
    está revogada, e ecoa os dois como cookie.
    """
    payload = decode_access_token(data.access_token)
    if not payload or payload.get("typ") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    res = await db.execute(select(Sessao).where(Sessao.refresh_token == data.refresh_token))
    sessao = res.scalar_one_or_none()
    if not sessao or sessao.revogada:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida.")

    _set_auth_cookies(response, data.access_token, data.refresh_token)
    return {"message": "Cookie definido."}


# ── SSO Gestor → Vitrine (M6) ───────────────────────────────────
# O botão "Ver na Vitrine" do gestor abre a vitrine (outro domínio) já
# logada. Antes do M6 isso pegava access_token/refresh_token direto do
# JS e colava na URL; com cookie httpOnly o JS não tem mais esse valor —
# e mesmo que tivesse, não deveria: o token de sessão do gestor não tem
# porque vazar para a URL de outra origem. Em vez disso, o gestor pede um
# token de troca de 60s (mesmo padrão de create_sso_exchange_token, mas
# com `typ` próprio — não é módulo B2B) e a vitrine o resgata uma vez.

class SSOVitrineResponse(BaseModel):
    exchange_token: str


@router.post("/sso/vitrine", response_model=SSOVitrineResponse, dependencies=[Depends(rate_limit(10, 60))])
async def gerar_sso_vitrine(current_user: Usuario = Depends(get_current_user)):
    """Gera um token de troca de 60s para abrir a Vitrine já logada como este usuário."""
    token = create_access_token(
        {"sub": current_user.id, "typ": "sso_vitrine"},
        expires_delta=timedelta(seconds=60),
    )
    return SSOVitrineResponse(exchange_token=token)


@router.get("/sso/vitrine/resgatar")
async def resgatar_sso_vitrine(token: str, db: AsyncSession = Depends(get_db)):
    """
    Resgata o token de troca (uso único, 60s) e redireciona para a Vitrine já
    autenticada — reaproveita a mesma tela `GoogleCallback` que a Vitrine já
    tem para receber tokens via fragmento de URL (nunca vai a log de acesso).
    """
    callback_base = f"{settings.vitrine_base_url}/auth/google/callback"
    payload = decode_access_token(token)
    if not payload or payload.get("typ") != "sso_vitrine":
        return RedirectResponse(f"{callback_base}#erro=sso_invalido")

    user_id = payload.get("sub")
    res = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = res.scalar_one_or_none()
    if not user or not user.ativo:
        return RedirectResponse(f"{callback_base}#erro=sso_invalido")

    new_access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "papel": user.papel.value, "typ": "access"}
    )
    new_refresh_token = secrets.token_hex(32)
    nova_sessao = Sessao(
        usuario_id=user.id,
        refresh_token=new_refresh_token,
        expira_em=utcnow() + timedelta(days=7),
        revogada=False,
    )
    db.add(nova_sessao)
    await db.commit()

    return RedirectResponse(
        f"{callback_base}#access_token={new_access_token}&refresh_token={new_refresh_token}"
    )


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


async def montar_user_response(current_user: Usuario, db: AsyncSession) -> UserResponse:
    """
    Monta o UserResponse do usuário autenticado com o vínculo de loja resolvido.

    `loja_id`/`modulos` não moram em Usuario (vêm de MembroLoja), então qualquer
    rota que devolva o usuário logado precisa passar por aqui. Retornar o ORM cru
    manda `loja_id: null` para o front, que troca o usuário inteiro no store e
    perde o vínculo — foi assim que o "Sou lojista" sumia no mobile depois de
    editar o perfil.
    """
    user_resp = UserResponse.model_validate(current_user)
    if current_user.papel in (PapelUsuario.CLIENTE, PapelUsuario.ADMIN_PLATAFORMA):
        return user_resp

    # Gestor/Vendedor: o acesso depende de um vínculo de loja ATIVO e da
    # própria loja estar ATIVA. Se o membro foi desativado (Equipe) ou o
    # admin de plataforma inativou a loja (Admin > Lojas), não há acesso
    # válido — a sessão está morta ainda que o Usuario.ativo continue True.
    # Devolve 401 para o front expulsar ao login em vez de deixar entrar e
    # só falhar depois, com os cards do dashboard quebrados.
    stmt = (
        select(MembroLoja, Loja)
        .join(Loja, MembroLoja.loja_id == Loja.id)
        .where(MembroLoja.usuario_id == current_user.id, MembroLoja.ativo == True)
    )
    membro_res = await db.execute(stmt)
    row = membro_res.first()
    if not row or not row[1].ativa:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Seu acesso a esta loja foi desativado.",
        )
    membro, _loja = row
    user_resp.loja_id = membro.loja_id
    user_resp.modulos = membro.modulos
    return user_resp


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retorna o usuário autenticado (inclui avatar_url)."""
    return await montar_user_response(current_user, db)


@router.patch("/me", response_model=UserResponse, dependencies=[Depends(rate_limit(20, 60))])
async def atualizar_me(
    data: UpdateMeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Edita o próprio perfil (nome e telefone). Disponível para qualquer usuário
    logado, inclusive o cliente B2C da Vitrine. E-mail e papel não mudam aqui.
    """
    alterados = []
    if data.nome is not None and data.nome.strip() != current_user.nome:
        current_user.nome = data.nome.strip()
        alterados.append("nome")
    if data.telefone is not None:
        novo_tel = data.telefone.strip() or None
        if novo_tel != current_user.telefone:
            current_user.telefone = novo_tel
            alterados.append("telefone")

    if alterados:
        client_ip = request.client.host if request.client else None
        await registrar_auditoria(
            db=db,
            loja_id=None,
            ator_id=current_user.id,
            ator_nome=current_user.nome,
            acao="auth.update_me",
            entidade="usuario",
            entidade_id=current_user.id,
            detalhes=f"Perfil atualizado: {', '.join(alterados)}.",
            ip=client_ip,
        )
        await db.commit()
        await db.refresh(current_user)
    return await montar_user_response(current_user, db)


@router.patch("/me/preferencias", response_model=UserResponse, dependencies=[Depends(rate_limit(30, 60))])
async def atualizar_preferencias_me(
    data: PreferenciasMeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Salva as preferências de interface do usuário logado.

    Hoje: o botão flutuante de ações rápidas do app (mostrar ou não) e se o
    modal de primeiro acesso deve continuar perguntando. A preferência é do
    usuário, não da loja — o mesmo aparelho pode ser usado por dois vendedores
    com contas diferentes, e cada um vê a sua escolha.
    """
    if data.botao_flutuante is not None:
        current_user.botao_flutuante = data.botao_flutuante
    if data.botao_flutuante_perguntar is not None:
        current_user.botao_flutuante_perguntar = data.botao_flutuante_perguntar

    await db.commit()
    await db.refresh(current_user)
    return await montar_user_response(current_user, db)


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
        url = await storage_provider.upload_file(
            content, file.filename or "avatar", content_type,
            prefixo=f"usuarios/{current_user.id}/avatar",
        )
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
    return await montar_user_response(current_user, db)


@router.delete("/me/avatar", response_model=UserResponse, dependencies=[Depends(rate_limit(10, 60))])
async def remover_avatar(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Remove a foto de perfil (avatar) do usuário autenticado.
    """
    current_user.avatar_url = None
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=current_user.id,
        ator_nome=current_user.nome,
        acao="auth.remove_avatar",
        entidade="usuario",
        entidade_id=current_user.id,
        detalhes="Foto de perfil (avatar) removida.",
        ip=client_ip,
    )
    await db.commit()
    await db.refresh(current_user)
    return await montar_user_response(current_user, db)


@router.post("/me/senha", status_code=status.HTTP_200_OK, dependencies=[Depends(rate_limit(5, 60))])
async def alterar_senha_me(
    data: ChangePasswordMeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Permite ao usuário autenticado alterar sua própria senha mediante confirmação da senha atual.
    """
    if not verify_password(data.senha_atual, current_user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha atual informada está incorreta."
        )

    current_user.senha_hash = hash_password(data.nova_senha)
    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=current_user.id,
        ator_nome=current_user.nome,
        acao="auth.change_password",
        entidade="usuario",
        entidade_id=current_user.id,
        detalhes="Senha do usuário alterada com sucesso.",
        ip=client_ip,
    )
    await db.commit()
    return {"message": "Senha alterada com sucesso."}


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

    # Revoga todas as sessões ativas: sem isso, quem já estava logado (o
    # possível invasor que motivou o reset) continua com acesso válido pelos
    # até 7 dias restantes do refresh token, mesmo com a senha trocada.
    await db.execute(
        update(Sessao)
        .where(Sessao.usuario_id == user.id, Sessao.revogada == False)
        .values(revogada=True)
    )

    client_ip = request.client.host if request.client else None
    await registrar_auditoria(
        db=db,
        loja_id=None,
        ator_id=user.id,
        ator_nome=user.nome,
        acao="auth.reset_password",
        entidade="usuario",
        entidade_id=user.id,
        detalhes="Senha redefinida com sucesso via token de recuperação. Sessões ativas revogadas.",
        ip=client_ip
    )

    await db.commit()
    return {"message": "Senha atualizada com sucesso."}
