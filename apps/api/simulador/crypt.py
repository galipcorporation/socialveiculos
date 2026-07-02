"""
Utilitário de criptografia para credenciais bancárias do Simulador V2.
"""
import os
from cryptography.fernet import Fernet
import base64
import hashlib

def get_fernet_key() -> bytes:
    """
    Gera uma chave 32-bytes baseada no JWT_SECRET para uso com Fernet.
    Em produção, deve ser forte. Se não houver, usa um padrão (inseguro).
    """
    secret = os.getenv("JWT_SECRET", "super-secret-key-simulador")
    # Garante que seja 32 url-safe base64 bytes
    digest = hashlib.sha256(secret.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_credentials(payload: str) -> str:
    """Cifra o payload."""
    f = Fernet(get_fernet_key())
    return f.encrypt(payload.encode('utf-8')).decode('utf-8')

def decrypt_credentials(token: str) -> str:
    """Decifra o token."""
    f = Fernet(get_fernet_key())
    return f.decrypt(token.encode('utf-8')).decode('utf-8')
