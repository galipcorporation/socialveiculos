"""
Social Veículos — Login social com Google (OAuth 2.0 Authorization Code).

Fluxo: /v1/auth/google/login redireciona ao consent screen; o Google volta em
/v1/auth/google/callback com um `code`, que trocamos por tokens e validamos o
`id_token` (JWT RS256 assinado pelo Google) contra o JWKS público deles.
"""
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient

from auth import create_access_token, decode_access_token
from config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

_jwks_client = PyJWKClient(GOOGLE_JWKS_URL)


class GoogleOAuthError(Exception):
    pass


def montar_authorize_url(state: str) -> str:
    if not settings.google_client_id:
        raise GoogleOAuthError("GOOGLE_CLIENT_ID não configurado.")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def gerar_state() -> str:
    """JWT curto (scope=oauth_state) — evita CSRF sem exigir storage server-side."""
    return create_access_token(data={"scope": "oauth_state"}, expires_delta=timedelta(minutes=10))


def validar_state(state: Optional[str]) -> bool:
    if not state:
        return False
    payload = decode_access_token(state)
    return bool(payload and payload.get("scope") == "oauth_state")


async def trocar_code_por_id_token(code: str) -> str:
    """Troca o authorization code pelo id_token (JWT) do Google."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise GoogleOAuthError("Credenciais do Google não configuradas.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise GoogleOAuthError(f"Falha ao trocar code por token: {resp.text}")

    id_token = resp.json().get("id_token")
    if not id_token:
        raise GoogleOAuthError("Resposta do Google não trouxe id_token.")
    return id_token


def validar_id_token(id_token: str) -> dict:
    """Valida assinatura, issuer, audience e expiração do id_token do Google."""
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=GOOGLE_ISSUERS,
        )
    except jwt.PyJWTError as exc:
        raise GoogleOAuthError(f"id_token inválido: {exc}") from exc

    if not payload.get("email_verified"):
        raise GoogleOAuthError("E-mail da conta Google não verificado.")

    return payload


async def obter_dados_usuario_google(code: str) -> dict:
    """Ponta-a-ponta: code -> id_token validado -> dados do usuário (sub/email/nome)."""
    id_token = await trocar_code_por_id_token(code)
    payload = validar_id_token(id_token)
    return {
        "sub": payload["sub"],
        "email": payload["email"],
        "nome": payload.get("name") or payload["email"].split("@")[0],
        "avatar_url": payload.get("picture"),
    }
