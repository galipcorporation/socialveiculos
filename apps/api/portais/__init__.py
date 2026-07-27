"""
Registry de portais de anúncio (M079).

O router e o worker resolvem o adapter só por nome — nenhum dos dois importa um
portal concreto. Ligar um portal novo é uma linha aqui.
"""

import hashlib
import json
from typing import Optional

from .base import AdapterIndisponivel, PayloadAnuncio, PortalAdapter, PortalResultado
from .indisponiveis import ICarrosAdapter, OlxAdapter, WebmotorsAdapter
from .mercadolivre import MercadoLivreAdapter
from .meta import FacebookAdapter, InstagramAdapter

REGISTRY: dict[str, PortalAdapter] = {
    a.nome: a
    for a in (
        FacebookAdapter(),
        InstagramAdapter(),
        MercadoLivreAdapter(),
        OlxAdapter(),
        WebmotorsAdapter(),
        ICarrosAdapter(),
    )
}

# Portais cuja credencial vem de CredencialRedeSocial (M024), não de CredencialPortal.
PORTAIS_META = {"facebook", "instagram"}


def get_adapter(nome: str) -> Optional[PortalAdapter]:
    return REGISTRY.get(nome)


def montar_payload(veiculo) -> PayloadAnuncio:
    """Normaliza um Veiculo (com `midias` carregadas) para envio aos portais."""
    opcionais: list[str] = []
    if veiculo.opcionais:
        try:
            carregado = json.loads(veiculo.opcionais)
            if isinstance(carregado, list):
                opcionais = [str(o) for o in carregado]
        except (ValueError, TypeError):
            opcionais = []

    fotos = [
        m.url
        for m in sorted(getattr(veiculo, "midias", []) or [], key=lambda m: m.ordem or 0)
        if m.url and getattr(m.tipo, "value", m.tipo) == "foto"
    ]

    titulo = " ".join(
        p for p in (veiculo.marca, veiculo.modelo, veiculo.versao) if p
    )

    return PayloadAnuncio(
        veiculo_id=veiculo.id,
        titulo=f"{titulo} {veiculo.ano_fabricacao}/{veiculo.ano_modelo}".strip(),
        descricao=veiculo.descricao or "",
        preco=veiculo.preco_venda,
        marca=veiculo.marca,
        modelo=veiculo.modelo,
        versao=veiculo.versao,
        ano_fabricacao=veiculo.ano_fabricacao,
        ano_modelo=veiculo.ano_modelo,
        km=veiculo.km or 0,
        cor=veiculo.cor,
        cambio=getattr(veiculo.cambio, "value", veiculo.cambio),
        combustivel=getattr(veiculo.combustivel, "value", veiculo.combustivel),
        tipo=veiculo.tipo,
        carroceria=veiculo.carroceria,
        portas=veiculo.portas,
        placa=veiculo.placa,
        opcionais=opcionais,
        fotos=fotos,
    )


def hash_payload(payload: PayloadAnuncio) -> str:
    """sha256 estável do conteúdo — só reenvia ao portal o que mudou de verdade."""
    bruto = json.dumps(payload.__dict__, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(bruto.encode()).hexdigest()


__all__ = [
    "REGISTRY",
    "PORTAIS_META",
    "AdapterIndisponivel",
    "PayloadAnuncio",
    "PortalAdapter",
    "PortalResultado",
    "get_adapter",
    "hash_payload",
    "montar_payload",
]
