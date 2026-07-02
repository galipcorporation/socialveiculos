import time
import asyncio
from collections import defaultdict
from fastapi import Request, HTTPException, status

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
        # Identificar por IP do cliente
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"limit:{path}:{ip}"
        
        allowed = await limiter_instance.is_allowed(key, limit, period)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas requisições. Tente novamente mais tarde."
            )
    return dependency
