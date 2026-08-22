"""
Utilitário de criptografia para credenciais em repouso (bancárias, fiscais,
OAuth, IA, DETRAN) — cifradas com Fernet.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from config import settings


def get_fernet_key() -> bytes:
    """Chave Fernet própria (`FERNET_KEY`), nunca derivada do JWT_SECRET."""
    return settings.fernet_key.encode("utf-8")


def _get_legacy_fernet_key() -> bytes:
    """
    Esquema anterior (B128/C2): chave derivada do JWT_SECRET, com fallback
    para uma string literal quando JWT_SECRET não chegava ao processo via
    os.getenv (caso do .env local, que o pydantic-settings não exporta para
    o ambiente). Mantido só para DECIFRAR dado gravado antes da migração —
    ver script de recifra em scripts/migrar_fernet_key.py.
    """
    import os
    secret = os.getenv("JWT_SECRET", "super-secret-key-simulador")
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_credentials(payload: str) -> str:
    """Cifra o payload com a chave Fernet atual."""
    f = Fernet(get_fernet_key())
    return f.encrypt(payload.encode("utf-8")).decode("utf-8")


def decrypt_credentials(token: str) -> str:
    """
    Decifra o token com a chave atual. Se falhar, tenta o esquema legado
    (pré-migração) — ver aviso em `_get_legacy_fernet_key`. Isso cobre o
    período de transição até o script de recifra rodar contra o banco.
    """
    try:
        f = Fernet(get_fernet_key())
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        f_legacy = Fernet(_get_legacy_fernet_key())
        return f_legacy.decrypt(token.encode("utf-8")).decode("utf-8")
