"""
Motor Creditas - Integração via API REST.
"""
import os
import time
import asyncio
import logging
from typing import Optional, Dict, Any

from .base_motor import BaseMotor, SimulationInput, SimulationOutput

logger = logging.getLogger(__name__)

class MotorCreditas(BaseMotor):
    def __init__(self, credentials: Optional[Dict[str, Any]] = None):
        super().__init__(bank_code="creditas", bank_name="Creditas", credentials=credentials)
        self.base_url = self.credentials.get("base_url", "https://developers.creditas.com.br")
        self.api_key = self.credentials.get("api_key", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def authenticate(self) -> bool:
        if not self.is_configured:
            return False
        try:
            client = await self.get_client()
            response = await client.get(
                f"{self.base_url}/api/health",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            return response.status_code in [200, 401, 403]
        except Exception:
            return True

    async def simulate(self, input_data: SimulationInput) -> SimulationOutput:
        start = time.time()
        if not self.is_configured:
            output = self._mock_output(input_data)
            output.interest_rate = 1.49
            output.execution_time_ms = int((time.time() - start) * 1000)
            return output

        try:
            client = await self.get_client()
            auth_headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            proposal_payload = {
                "type": "auto_equity",
                "client": {
                    "cpf": input_data.cpf,
                    "name": input_data.nome,
                    "birthDate": input_data.nascimento,
                    "phone": input_data.telefone
                },
                "vehicle": {
                    "plate": input_data.placa,
                    "value": input_data.valor_veiculo,
                    "year": input_data.ano_modelo,
                    "brand": input_data.marca,
                    "model": input_data.modelo
                },
                "desiredAmount": input_data.valor_veiculo - input_data.entrada,
                "downPayment": input_data.entrada
            }

            resp_create = await client.post(
                f"{self.base_url}/api/proposals",
                headers=auth_headers,
                json=proposal_payload
            )

            if resp_create.status_code not in [200, 201]:
                return self._error_output(f"Creditas proposta falhou: {resp_create.text[:100]}")

            create_data = resp_create.json()
            proposal_id = create_data.get("id") or create_data.get("proposalId")
            if not proposal_id:
                return self._error_output("Creditas: ID da proposta não retornado")

            max_attempts = 10
            for _ in range(max_attempts):
                await asyncio.sleep(2)
                resp_status = await client.get(
                    f"{self.base_url}/api/proposals/{proposal_id}",
                    headers=auth_headers
                )

                if resp_status.status_code != 200:
                    continue

                status_data = resp_status.json()
                proposal_status = status_data.get("status", "").lower()

                if proposal_status in ["approved", "aprovado", "completed"]:
                    elapsed = int((time.time() - start) * 1000)
                    return SimulationOutput(
                        bank_code=self.bank_code,
                        bank_name=self.bank_name,
                        status="approved",
                        monthly_payment=status_data.get("monthlyPayment") or status_data.get("valorParcela"),
                        interest_rate=status_data.get("interestRate") or status_data.get("taxa"),
                        total_amount=status_data.get("totalAmount") or status_data.get("valorTotal"),
                        term_months=status_data.get("termMonths") or status_data.get("prazo", 48),
                        raw_response=status_data,
                        execution_time_ms=elapsed
                    )
                elif proposal_status in ["denied", "negado", "rejected"]:
                    elapsed = int((time.time() - start) * 1000)
                    return SimulationOutput(
                        bank_code=self.bank_code,
                        bank_name=self.bank_name,
                        status="denied",
                        error_message=status_data.get("reason", "Proposta negada"),
                        raw_response=status_data,
                        execution_time_ms=elapsed
                    )

            elapsed = int((time.time() - start) * 1000)
            return self._error_output(f"Creditas timeout após {elapsed}ms")

        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            output = self._error_output(f"Erro Creditas: {str(e)}")
            output.execution_time_ms = elapsed
            return output
