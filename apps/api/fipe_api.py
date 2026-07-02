"""
Integração com a API FIPE pública (parallelum.com.br/fipe/api/v1).
Fluxo correto: frontend seleciona marca/modelo/ano pelos códigos da FIPE,
backend busca o preço pelo código exato.
Cache em memória com TTL de 6h para listas estáticas.
"""

import time
from typing import Optional

import httpx

BASE = "https://parallelum.com.br/fipe/api/v1"
TIMEOUT = 10.0

_cache: dict[str, tuple] = {}
CACHE_TTL = 3600 * 6  # 6 horas


def _cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry[1] < CACHE_TTL:
        return entry[0]
    return None


def _store(key: str, value):
    _cache[key] = (value, time.time())
    return value


def _tipo_path(tipo: str) -> str:
    t = tipo.lower().strip()
    if t in ("moto", "motocicleta"):
        return "motos"
    if t in ("caminhao", "caminhão", "onibus", "ônibus"):
        return "caminhoes"
    return "carros"


async def _get(client: httpx.AsyncClient, path: str):
    cached = _cached(path)
    if cached is not None:
        return cached
    r = await client.get(f"{BASE}{path}", timeout=TIMEOUT)
    r.raise_for_status()
    return _store(path, r.json())


async def listar_marcas(tipo: str = "carro") -> list:
    async with httpx.AsyncClient() as client:
        return await _get(client, f"/{_tipo_path(tipo)}/marcas")


async def listar_modelos(marca_codigo: str, tipo: str = "carro") -> list:
    async with httpx.AsyncClient() as client:
        data = await _get(client, f"/{_tipo_path(tipo)}/marcas/{marca_codigo}/modelos")
        return data.get("modelos", data) if isinstance(data, dict) else data


async def listar_anos(marca_codigo: str, modelo_codigo: str, tipo: str = "carro") -> list:
    async with httpx.AsyncClient() as client:
        return await _get(client, f"/{_tipo_path(tipo)}/marcas/{marca_codigo}/modelos/{modelo_codigo}/anos")


async def consultar_preco(
    marca_codigo: str,
    modelo_codigo: str,
    ano_codigo: str,
    tipo: str = "carro",
) -> Optional[float]:
    """Retorna o valor FIPE em BRL dado os códigos exatos, ou None em caso de falha."""
    path = f"/{_tipo_path(tipo)}/marcas/{marca_codigo}/modelos/{modelo_codigo}/anos/{ano_codigo}"
    async with httpx.AsyncClient() as client:
        data = await _get(client, path)
    valor_str: str = data.get("Valor", "")
    try:
        return float(valor_str.replace("R$", "").replace(".", "").replace(",", ".").strip())
    except (ValueError, AttributeError):
        return None
