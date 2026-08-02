import time
import asyncio
from collections import defaultdict
from fastapi import Request, HTTPException, status

from config import settings


def obter_ip_cliente(request: Request) -> str:
    """
    IP real do cliente para chave de rate limit.

    `X-Forwarded-For` é escrito pelo CLIENTE e só passa a valer alguma coisa
    depois que um proxy confiável acrescenta a própria observação no fim da
    lista. Confiar no primeiro item (o que estava aqui) deixava qualquer um
    girar o header e zerar o rate limit — brute force de login sem limite.

    Ordem de confiança:
    1. `Fly-Client-IP` — o proxy da Fly SOBRESCREVE este header na borda, então
       o valor que chega aqui nunca é o que o cliente mandou.
    2. `X-Forwarded-For` lido de trás para frente, e só se
       `trusted_proxy_hops > 0` disser quantos saltos confiáveis existem.
    3. `request.client.host` (conexão direta).
    """
    fly = request.headers.get("fly-client-ip")
    if fly and fly.strip():
        return fly.strip()

    hops = settings.trusted_proxy_hops
    if hops > 0:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            partes = [p.strip() for p in fwd.split(",") if p.strip()]
            if partes:
                # Os `hops` últimos itens foram escritos pelos proxies confiáveis;
                # o cliente real é o item imediatamente anterior a eles.
                return partes[max(0, len(partes) - hops)]

    return request.client.host if request.client else "unknown"


class InMemoryLimiter:
    def __init__(self):
        # Mapeia chave -> lista de timestamps das requisições
        self.requests = defaultdict(list)
        self.lock = asyncio.Lock()

    async def is_allowed(self, key: str, limit: int, period: int) -> bool:
        async with self.lock:
            now = time.time()
            cutoff = now - period
            # Filtra apenas os timestamps recentes dentro do período/janela
            self.requests[key] = [t for t in self.requests[key] if t > cutoff]
            
            if len(self.requests[key]) >= limit:
                return False
                
            self.requests[key].append(now)
            return True

limiter_instance = InMemoryLimiter()

def rate_limit(limit: int, period: int = 60):
    """
    Dependência do FastAPI para controle de taxa (rate limiting).
    - limit: Número máximo de requisições permitidas na janela.
    - period: Janela de tempo em segundos (padrão 60s).
    """
    async def dependency(request: Request):
        ip = obter_ip_cliente(request)
        path = request.url.path
        key = f"limit:{path}:{ip}"
        
        allowed = await limiter_instance.is_allowed(key, limit, period)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas requisições. Tente novamente mais tarde."
            )
    return dependency
