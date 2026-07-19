"""
Motor Banco PAN - Integração via API REST.
"""
import time
import logging
from typing import Optional, Dict, Any

from .base_motor import BaseMotor, SimulationInput, SimulationOutput

logger = logging.getLogger(__name__)

class MotorPAN(BaseMotor):
    def __init__(self, credentials: Optional[Dict[str, Any]] = None):
        super().__init__(bank_code="pan", bank_name="Banco PAN", credentials=credentials)
        self.base_url = self.credentials.get("base_url", "https://developers.bancopan.com.br")
        self.api_key = self.credentials.get("api_key", "")
        self.api_secret = self.credentials.get("api_secret", "")
        self._token: Optional[str] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret)

    async def authenticate(self) -> bool:
        if not self.is_configured:
            return False

        try:
            client = await self.get_client()
            response = await client.post(
                f"{self.base_url}/veiculos/v0/tokens",
                data={
                    "username": self.api_key,
                    "password": self.api_secret,
                    "grant_type": "client_credentials"
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                data = response.json()
                self._token = data.get("access_token")
                return True
            else:
                self.logger.error(f"PAN Auth falhou: {response.text}")
                return False
        except Exception as e:
            self.logger.error(f"PAN Erro Auth: {e}")
            return False

    async def simulate(self, input_data: SimulationInput) -> SimulationOutput:
        start = time.time()
        if not self.is_configured:
            output = self._error_output("Credenciais não configuradas para PAN.")
            output.execution_time_ms = int((time.time() - start) * 1000)
            return output

        if not await self.authenticate():
            return self._error_output("Falha na autenticação com Banco PAN API")

        try:
            client = await self.get_client()
            auth_headers = {
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json"
            }

            pre_analysis_payload = {
                "cpf": input_data.cpf,
                "nome": input_data.nome,
                "dataNascimento": input_data.nascimento,
                "telefone": input_data.telefone
            }

            resp_pre = await client.post(
                f"{self.base_url}/veiculos/v2/pre-analise",
                headers=auth_headers,
                json=pre_analysis_payload
            )

            if resp_pre.status_code != 200:
                return self._error_output(f"PAN Pré-análise falhou: {resp_pre.text[:100]}")

            pre_data = resp_pre.json()
            if pre_data.get("status") in ["negado", "denied", "rejected"]:
                elapsed = int((time.time() - start) * 1000)
                return SimulationOutput(
                    bank_code=self.bank_code,
                    bank_name=self.bank_name,
                    status="denied",
                    error_message=pre_data.get("motivo", "Crédito negado"),
                    raw_response=pre_data,
                    execution_time_ms=elapsed
                )

            sim_payload = {
                "cpf": input_data.cpf,
                "placa": input_data.placa,
                "valorVeiculo": input_data.valor_veiculo,
                "anoModelo": input_data.ano_modelo,
                "valorEntrada": input_data.entrada,
                "prazo": 48
            }

            resp_sim = await client.post(
                f"{self.base_url}/veiculos/v2/simulacao",
                headers=auth_headers,
                json=sim_payload
            )

            elapsed = int((time.time() - start) * 1000)

            if resp_sim.status_code == 200:
                sim_data = resp_sim.json()
                return SimulationOutput(
                    bank_code=self.bank_code,
                    bank_name=self.bank_name,
                    status="approved",
                    monthly_payment=sim_data.get("valorParcela"),
                    interest_rate=sim_data.get("taxaMensal"),
                    total_amount=sim_data.get("valorTotal"),
                    term_months=sim_data.get("prazo", 48),
                    raw_response=sim_data,
                    execution_time_ms=elapsed
                )
            else:
                return self._error_output(f"PAN Simulação falhou: {resp_sim.text[:100]}")

        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            output = self._error_output(f"Erro PAN: {str(e)}")
            output.execution_time_ms = elapsed
            return output
