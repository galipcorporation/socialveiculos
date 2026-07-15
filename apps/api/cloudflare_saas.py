"""
Social Veículos — Cliente Cloudflare for SaaS (M038, domínio próprio + SSL).

Cada loja pode apontar um domínio próprio (ex.: www.autopremium.com.br) para o
site white-label. A Cloudflare provisiona o certificado SSL automaticamente via
"Custom Hostnames" (SSL for SaaS). Este módulo encapsula as 3 chamadas que
usamos: criar, consultar status e remover um custom hostname.

Sem `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` configurados, as funções levantam
RuntimeError com mensagem clara — a feature fica inerte (o subdomínio automático
continua funcionando normalmente sem Cloudflare).

Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

_BASE = "https://api.cloudflare.com/client/v4"


def _cfg() -> tuple[str, str]:
    """Retorna (api_token, zone_id) ou levanta se não configurado."""
    if not settings.cloudflare_api_token or not settings.cloudflare_zone_id:
        raise RuntimeError(
            "Domínio próprio indisponível: configure CLOUDFLARE_API_TOKEN e "
            "CLOUDFLARE_ZONE_ID na plataforma para habilitar SSL for SaaS."
        )
    return settings.cloudflare_api_token, settings.cloudflare_zone_id


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _map_status(cf_status: Optional[str], ssl_status: Optional[str]) -> str:
    """Traduz o status da Cloudflare para o vocabulário do SiteLoja.dominio_status
    (pendente|verificando|ativo|erro)."""
    if cf_status == "active" and ssl_status in ("active", "validated"):
        return "ativo"
    if cf_status in ("blocked", "moved", "deleted") or ssl_status in ("expired", "deleted"):
        return "erro"
    return "verificando"


async def criar_custom_hostname(dominio: str) -> dict:
    """Registra o domínio como custom hostname na zona da plataforma.

    Retorna: {id, status, ssl_status, dns_target, txt_name, txt_value}
    onde dns_target é o CNAME que o cliente deve criar apontando o domínio dele.
    """
    token, zone_id = _cfg()
    url = f"{_BASE}/zones/{zone_id}/custom_hostnames"
    payload = {
        "hostname": dominio,
        "ssl": {
            "method": "txt",          # validação por registro TXT (mais confiável que http)
            "type": "dv",             # domain validation
            "settings": {"min_tls_version": "1.2"},
        },
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(url, headers=_headers(token), json=payload)
        r.raise_for_status()
        data = r.json()["result"]

    return _extrair(data)


async def status_custom_hostname(custom_hostname_id: str) -> dict:
    """Consulta o status de validação/SSL de um custom hostname já criado."""
    token, zone_id = _cfg()
    url = f"{_BASE}/zones/{zone_id}/custom_hostnames/{custom_hostname_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=_headers(token))
        r.raise_for_status()
        data = r.json()["result"]
    return _extrair(data)


async def remover_custom_hostname(custom_hostname_id: str) -> None:
    """Remove o custom hostname (ao desconectar o domínio próprio)."""
    token, zone_id = _cfg()
    url = f"{_BASE}/zones/{zone_id}/custom_hostnames/{custom_hostname_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.delete(url, headers=_headers(token))
        # 404 = já não existe; tratamos como sucesso idempotente.
        if r.status_code not in (200, 404):
            r.raise_for_status()


def _extrair(data: dict) -> dict:
    """Normaliza o payload da Cloudflare para o que o resto do sistema consome."""
    ssl = data.get("ssl") or {}
    # A validação DNS (TXT) fica em ssl["validation_records"] enquanto pendente.
    txt_name = txt_value = None
    for rec in ssl.get("validation_records") or []:
        if rec.get("txt_name"):
            txt_name = rec["txt_name"]
            txt_value = rec.get("txt_value")
            break
    return {
        "id": data.get("id"),
        "status": _map_status(data.get("status"), ssl.get("status")),
        "cf_status": data.get("status"),
        "ssl_status": ssl.get("status"),
        "dns_target": settings.cloudflare_fallback_origin,
        "txt_name": txt_name,
        "txt_value": txt_value,
    }
