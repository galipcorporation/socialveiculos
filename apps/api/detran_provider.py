"""
Provedor plugável de consultas ao DETRAN para a esteira pós-venda
(ESTEIRA-POS-VENDA.md §11 Fase 3): débitos (IPVA/licenciamento/multas),
situação da ATPV-e e vistoria.

Mesma filosofia da busca por placa e do StorageProvider: plugável e
**sem inventar dado**. Enquanto não houver provedor real configurado,
`disponivel=False` e a UI mostra "consulta indisponível" — nunca um valor fake
(regra do dado real, social.md §6).

Para plugar um provedor real: implemente `_ConsultaReal` chamando a API
(ex.: SINESP/despachante) e ative via settings (DETRAN_API_KEY etc.).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

try:
    from config import settings
except Exception:  # pragma: no cover - defensivo p/ testes isolados
    settings = None


@dataclass
class ConsultaDebitos:
    disponivel: bool = False
    total: Optional[float] = None
    ipva: Optional[float] = None
    licenciamento: Optional[float] = None
    multas: Optional[float] = None
    fonte: Optional[str] = None
    mensagem: str = "Consulta de débitos indisponível — nenhum provedor configurado."


@dataclass
class ConsultaSituacao:
    disponivel: bool = False
    atpve_emitida: Optional[bool] = None
    transferencia_concluida: Optional[bool] = None
    proprietario_atual: Optional[str] = None
    fonte: Optional[str] = None
    mensagem: str = "Consulta de situação indisponível — nenhum provedor configurado."


class DetranProvider:
    def __init__(self) -> None:
        # ativa provedor real só quando as credenciais existirem
        self.ativo = bool(
            settings
            and getattr(settings, "detran_api_key", None)
            and getattr(settings, "detran_api_url", None)
        )
        if self.ativo:
            print("[DETRAN] Provedor real configurado.")
        else:
            print("[DETRAN] Sem provedor — consultas retornam indisponível (sem inventar dado).")

    async def consultar_debitos(self, placa: str, renavam: Optional[str] = None) -> ConsultaDebitos:
        if not self.ativo:
            return ConsultaDebitos()
        return await self._consultar_debitos_real(placa, renavam)

    async def consultar_situacao(self, placa: str, renavam: Optional[str] = None) -> ConsultaSituacao:
        if not self.ativo:
            return ConsultaSituacao()
        return await self._consultar_situacao_real(placa, renavam)

    # ── ganchos para o provedor real (implementar ao contratar) ──
    async def _consultar_debitos_real(self, placa: str, renavam: Optional[str]) -> ConsultaDebitos:
        raise NotImplementedError("Integração DETRAN real ainda não implementada.")

    async def _consultar_situacao_real(self, placa: str, renavam: Optional[str]) -> ConsultaSituacao:
        raise NotImplementedError("Integração DETRAN real ainda não implementada.")


detran_provider = DetranProvider()
