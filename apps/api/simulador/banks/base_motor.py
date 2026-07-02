"""
Motor Base - Classe abstrata para todos os motores bancários V2.
"""
import logging
import httpx
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SimulationInput:
    """Dados de entrada padronizados para simulação."""
    cpf: str
    nome: str
    nascimento: str  # DD/MM/YYYY
    telefone: str
    email: str
    placa: str
    valor_veiculo: float
    ano_modelo: int
    marca: str
    modelo: str
    tipo_veiculo: str = "carro"  # "carro" ou "moto"
    entrada: float = 0.0


@dataclass
class SimulationOutput:
    """Resultado padronizado de simulação."""
    bank_code: str
    bank_name: str
    status: str  # "approved", "denied", "error", "mock", "browser"
    monthly_payment: Optional[float] = None
    interest_rate: Optional[float] = None
    total_amount: Optional[float] = None
    term_months: Optional[int] = None
    error_message: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None
    execution_time_ms: int = 0


class BaseMotor(ABC):
    """Classe base para motores de simulação bancária via API."""

    def __init__(self, bank_code: str, bank_name: str, credentials: Optional[Dict[str, Any]] = None):
        self.bank_code = bank_code
        self.bank_name = bank_name
        self.credentials = credentials or {}
        self.logger = logging.getLogger(f"v2_motors.{bank_code}")
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Determina se o motor tem as credenciais mínimas."""
        return False

    async def get_client(self) -> httpx.AsyncClient:
        """Retorna HTTP client reutilizável."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=10.0),
                follow_redirects=True,
                headers={"User-Agent": "SocialVeiculos-Simulador/1.0"}
            )
        return self._client

    async def close(self):
        """Fecha o HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @abstractmethod
    async def authenticate(self) -> bool:
        """Autentica com a API do banco. Retorna True se sucesso."""
        pass

    @abstractmethod
    async def simulate(self, input_data: SimulationInput) -> SimulationOutput:
        """Executa a simulação completa no banco."""
        pass

    def _error_output(self, message: str) -> SimulationOutput:
        """Helper para criar output de erro."""
        return SimulationOutput(
            bank_code=self.bank_code,
            bank_name=self.bank_name,
            status="error",
            error_message=message
        )

    def _mock_output(self, input_data: SimulationInput) -> SimulationOutput:
        """Helper para criar output mock (quando não há credenciais)."""
        valor = input_data.valor_veiculo or 50000
        entrada = input_data.entrada or 0
        financiado = valor - entrada
        taxa_mensal = 0.0189  # ~1.89% a.m.
        prazo = 48
        
        if financiado <= 0:
            return self._error_output("Valor financiado inválido ou menor que zero.")

        parcela = (financiado * taxa_mensal * (1 + taxa_mensal) ** prazo) / ((1 + taxa_mensal) ** prazo - 1)

        return SimulationOutput(
            bank_code=self.bank_code,
            bank_name=self.bank_name,
            status="mock",
            monthly_payment=round(parcela, 2),
            interest_rate=round(taxa_mensal * 100, 2),
            total_amount=round(parcela * prazo, 2),
            term_months=prazo,
            error_message="[MOCK] Credenciais não configuradas.",
            raw_response={"mock": True, "financiado": financiado}
        )
