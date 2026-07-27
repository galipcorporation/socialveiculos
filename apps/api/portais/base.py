"""
Contrato dos adapters de portal de anúncios (M079).

Toda a extensibilidade do integrador vive aqui: o worker e o router só conhecem
`PortalAdapter`, nunca um portal concreto. Adicionar portal = criar um módulo
novo e registrar em `portais/__init__.py`.
"""

from dataclasses import dataclass, field
from typing import Optional, Protocol, runtime_checkable


@dataclass
class PortalResultado:
    """Resultado de uma operação num portal."""
    sucesso: bool
    anuncio_externo_id: Optional[str] = None
    url_externa: Optional[str] = None
    erro: Optional[str] = None


@dataclass
class PayloadAnuncio:
    """Dados do veículo já normalizados para envio ao portal.

    Montado uma vez por veículo (`montar_payload`) e reaproveitado por todos os
    adapters — o hash dele é o que decide se vale reenviar ao portal.
    """
    veiculo_id: str
    titulo: str
    descricao: str
    preco: Optional[float]
    marca: str
    modelo: str
    versao: Optional[str]
    ano_fabricacao: int
    ano_modelo: int
    km: int
    cor: Optional[str]
    cambio: Optional[str]
    combustivel: Optional[str]
    tipo: Optional[str]
    carroceria: Optional[str]
    portas: Optional[int]
    placa: Optional[str]
    opcionais: list[str] = field(default_factory=list)
    fotos: list[str] = field(default_factory=list)


@runtime_checkable
class PortalAdapter(Protocol):
    """Interface que todo portal implementa.

    `disponivel=False` → não há API (Webmotors/iCarros): o adapter existe só
    para o portal aparecer na grade e gerar baixa manual na venda.
    `requer_parceria=True` → a API existe, mas depende de contrato comercial
    (OLX) ou de app criado no dev center (Mercado Livre).
    """

    nome: str
    rotulo: str
    disponivel: bool
    requer_parceria: bool
    tipo_auth: str  # "oauth" | "api_key" | "nenhum"

    async def testar_conexao(self, cred) -> PortalResultado: ...

    async def publicar(self, payload: PayloadAnuncio, cred) -> PortalResultado: ...

    async def atualizar(self, payload: PayloadAnuncio, cred, anuncio_externo_id: str) -> PortalResultado: ...

    async def despublicar(self, cred, anuncio_externo_id: str) -> PortalResultado: ...


class AdapterIndisponivel:
    """Base dos portais sem API utilizável hoje.

    Nunca simula publicação: toda operação falha com uma explicação honesta.
    Quem despublica um veículo destes é uma pessoa — daí o `baixa_pendente`
    do worker (TDD §3.4.1).
    """

    disponivel = False
    requer_parceria = True
    tipo_auth = "nenhum"
    motivo = "Portal ainda não integrado."

    async def testar_conexao(self, cred) -> PortalResultado:
        return PortalResultado(sucesso=False, erro=self.motivo)

    async def publicar(self, payload: PayloadAnuncio, cred) -> PortalResultado:
        return PortalResultado(sucesso=False, erro=self.motivo)

    async def atualizar(self, payload: PayloadAnuncio, cred, anuncio_externo_id: str) -> PortalResultado:
        return PortalResultado(sucesso=False, erro=self.motivo)

    async def despublicar(self, cred, anuncio_externo_id: str) -> PortalResultado:
        return PortalResultado(sucesso=False, erro=self.motivo)
