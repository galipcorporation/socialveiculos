"""
Social Veículos — Serviços de Criptografia e Tokens JWT
"""

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from config import settings

# ── Senhas (Bcrypt) ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Gera o hash Bcrypt de uma senha em formato string."""
    # Bcrypt exige bytes
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifica se a senha coincide com o hash gravado."""
    try:
        pwd_bytes = password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


# ── Tokens JWT ──────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Gera um token de acesso JWT com expiração de curto prazo."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
        
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.jwt_secret, 
        algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decodifica e valida um token JWT. Retorna o payload se válido ou None."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except jwt.PyJWTError:
        return None


# ── SSO — Token de Troca Curto (entre módulos premium) ──────────

def create_sso_exchange_token(usuario_id: str, loja_id: str, modulo: str) -> str:
    """
    Gera um token de troca de vida muito curta (60s) para SSO entre módulos.
    O módulo de destino o resgata uma vez e emite sua própria sessão — sem
    refazer login. `typ=sso` impede que seja usado como access token normal.
    """
    return create_access_token(
        {"sub": usuario_id, "loja_id": loja_id, "modulo": modulo, "typ": "sso"},
        expires_delta=timedelta(seconds=60),
    )


def decode_sso_exchange_token(token: str) -> Optional[dict]:
    """Decodifica um token SSO. Retorna o payload só se `typ=sso`, senão None."""
    payload = decode_access_token(token)
    if not payload or payload.get("typ") != "sso":
        return None
    return payload
