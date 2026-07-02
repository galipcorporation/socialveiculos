"""
Motor BV Open - Integração via API REST com o Banco BV.
"""
import os
import time
import base64
import logging
from typing import Optional, Dict, Any

from .base_motor import BaseMotor, SimulationInput, SimulationOutput

logger = logging.getLogger(__name__)

class MotorBV(BaseMotor):
    def __init__(self, credentials: Optional[Dict[str, Any]] = None):
        super().__init__(bank_code="bv", bank_name="Banco BV", credentials=credentials)
        self.base_url = self.credentials.get("base_url", "https://apige-uat-sbx.bvopen.com.br")
        self.token_url = self.credentials.get("token_url", f"{self.base_url}/token")
        self.client_id = self.credentials.get("client_id", "")
        self.client_secret = self.credentials.get("client_secret", "")
        self.channel = self.credentials.get("channel", "SF_SMART")
        self.partner_code = int(self.credentials.get("partner_code", "12345"))
        self._token: Optional[str] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def authenticate(self) -> bool:
        if not self.is_configured:
            return False

        try:
            client = await self.get_client()
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                data = response.json()
                self._token = data.get("access_token") or data.get("token")
                return True
            else:
                self.logger.error(f"BV Auth falhou: {response.text}")
                return False
        except Exception as e:
            self.logger.error(f"BV Erro Auth: {e}")
            return False

    async def simulate(self, input_data: SimulationInput) -> SimulationOutput:
        start = time.time()
        if not self.is_configured:
            output = self._mock_output(input_data)
            output.execution_time_ms = int((time.time() - start) * 1000)
            return output

        if not await self.authenticate():
            return self._error_output("Falha na autenticação com BV Open API")

        try:
            client = await self.get_client()
            auth_headers = {
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json"
            }

            cleaned_tel = "".join(filter(str.isdigit, input_data.telefone))
            ddd = cleaned_tel[:2] if len(cleaned_tel) >= 10 else "11"
            phone = cleaned_tel[2:] if len(cleaned_tel) >= 10 else cleaned_tel

            pre_analysis_payload = {
                "proponentTaxIdNumber": input_data.cpf,
                "proponentName": input_data.nome,
                "ddd": ddd,
                "phoneNumber": phone,
                "email": input_data.email,
                "creditOperation": 1,
                "groupCategory": 2 if input_data.tipo_veiculo == "moto" else 1
            }

            resp_analysis = await client.post(
                f"{self.base_url}/pre-analyze-vehicles/v2/pre-analysis-vehicle-financing",
                headers=auth_headers,
                json=pre_analysis_payload
            )

            if resp_analysis.status_code != 200:
                return self._error_output(f"Pré-análise negada: {resp_analysis.text[:100]}")

            pre_sim_payload = {
                "channel": self.channel,
                "commercialPartner": self.partner_code,
                "declaredValue": input_data.valor_veiculo,
                "entryValue": input_data.entrada,
                "modelYear": str(input_data.ano_modelo),
                "ufVehicle": "SP",
                "zeroVehicle": False
            }

            resp_sim = await client.post(
                f"{self.base_url}/partners/v1/pre-simulation",
                headers=auth_headers,
                json=pre_sim_payload
            )

            if resp_sim.status_code != 200:
                return self._error_output(f"Pré-simulação falhou: {resp_sim.text[:100]}")

            sim_data = resp_sim.json()

            pricing_payload = {
                "requestMinimumPercentageEntryValue": False,
                "channel": self.channel,
                "preApproved": False,
                "requestFeeExemptionTariffTac": False,
                "commercialBranchCode": sim_data.get("commercialBranchCode", 1),
                "commercialBranchTypeCode": sim_data.get("commercialBranchTypeCode", 1)
            }

            resp_pricing = await client.post(
                f"{self.base_url}/pricing-online/v1/pricing-online-fandis",
                headers=auth_headers,
                json=pricing_payload
            )

            elapsed = int((time.time() - start) * 1000)

            if resp_pricing.status_code == 200:
                pricing_data = resp_pricing.json()
                return SimulationOutput(
                    bank_code=self.bank_code,
                    bank_name=self.bank_name,
                    status="approved",
                    monthly_payment=pricing_data.get("valorParcela") or pricing_data.get("installmentValue"),
                    interest_rate=pricing_data.get("taxaMensal") or pricing_data.get("monthlyInterestRate"),
                    total_amount=pricing_data.get("valorTotal") or pricing_data.get("totalAmount"),
                    term_months=pricing_data.get("prazo", 48),
                    raw_response=pricing_data,
                    execution_time_ms=elapsed
                )
            else:
                return SimulationOutput(
                    bank_code=self.bank_code,
                    bank_name=self.bank_name,
                    status="approved",
                    monthly_payment=sim_data.get("installmentValue"),
                    interest_rate=sim_data.get("monthlyInterestRate"),
                    total_amount=sim_data.get("totalAmount"),
                    term_months=sim_data.get("term", 48),
                    raw_response=sim_data,
                    execution_time_ms=elapsed
                )
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            output = self._error_output(f"Erro BV: {str(e)}")
            output.execution_time_ms = elapsed
            return output
