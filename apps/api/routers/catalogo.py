"""
Social Veículos — Rotas de Catálogo Canônico (alimentado pela FIPE)
Endpoints de marcas e modelos para autocomplete no cadastro de veículos.
Os dados vêm diretamente da API FIPE (parallelum.com.br) para tipos
suportados (carro, moto, caminhão). Tipos sem cobertura FIPE (barco,
jet, aeronave, reboque, outro) retornam lista vazia e o frontend
permite digitação livre.
"""

from typing import Optional
from fastapi import APIRouter, Query

from fipe_api import listar_marcas as fipe_listar_marcas, listar_modelos as fipe_listar_modelos

router = APIRouter(prefix="/v1/catalogo", tags=["Catálogo"])

# Tipos cobertos pela tabela FIPE (parallelum.com.br)
TIPOS_COM_FIPE = {"carro", "moto", "motocicleta", "caminhao", "caminhão", "onibus", "ônibus"}


# ═══════════════════════════════════════════════════════════════
# ── MARCAS  (alimentado pela FIPE quando o tipo suporta)
# ═══════════════════════════════════════════════════════════════

@router.get("/marcas")
async def listar_marcas(
    q: Optional[str] = Query(None, min_length=1, description="Filtro de autocomplete por nome"),
    tipo: str = Query("carro", description="Tipo de veículo (carro, moto, caminhao, barco, jet…)"),
):
    """
    Lista marcas da tabela FIPE (para tipos suportados).
    Para barco, jet, aeronave etc. retorna lista vazia — o frontend
    deve permitir digitação livre nesses casos.
    Retorna no formato { id, nome, logo_url, ativa }.
    """
    if tipo.lower().strip() not in TIPOS_COM_FIPE:
        return []

    try:
        fipe_marcas = await fipe_listar_marcas(tipo)
    except Exception:
        return []

    result = []
    for m in fipe_marcas:
        nome = m.get("nome", "")
        codigo = m.get("codigo", "")

        if q and q.lower() not in nome.lower():
            continue

        try:
            id_int = int(codigo)
        except (ValueError, TypeError):
            continue

        result.append({
            "id": id_int,
            "nome": nome,
            "logo_url": None,
            "ativa": True,
        })

    result.sort(key=lambda x: x["nome"])
    return result


# ═══════════════════════════════════════════════════════════════
# ── MODELOS  (alimentado pela FIPE quando o tipo suporta)
# ═══════════════════════════════════════════════════════════════

@router.get("/marcas/{marca_id}/modelos")
async def listar_modelos(
    marca_id: int,
    q: Optional[str] = Query(None, min_length=1, description="Filtro de autocomplete por nome"),
    tipo: str = Query("carro", description="Tipo de veículo (carro, moto, caminhao, barco, jet…)"),
):
    """
    Lista modelos de uma marca da tabela FIPE (para tipos suportados).
    Para tipos sem cobertura FIPE retorna lista vazia.
    Retorna no formato { id, marca_id, nome, ativo }.
    """
    if tipo.lower().strip() not in TIPOS_COM_FIPE:
        return []

    try:
        fipe_modelos = await fipe_listar_modelos(str(marca_id), tipo)
    except Exception:
        return []

    result = []
    for m in fipe_modelos:
        nome = m.get("nome", "")
        codigo = m.get("codigo", "")

        if q and q.lower() not in nome.lower():
            continue

        try:
            id_int = int(codigo)
        except (ValueError, TypeError):
            continue

        result.append({
            "id": id_int,
            "marca_id": marca_id,
            "nome": nome,
            "ativo": True,
        })

    result.sort(key=lambda x: x["nome"])
    return result
