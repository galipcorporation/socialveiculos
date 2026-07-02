import asyncio
import logging
import time
from typing import Dict, List

from config import settings
from .banks.base_motor import SimulationInput, SimulationOutput
from .banks.motor_bv import MotorBV
from .banks.motor_pan import MotorPAN
from .banks.motor_creditas import MotorCreditas

logger = logging.getLogger(__name__)

class OrquestradorV2:
    def __init__(self):
        self.logger = logging.getLogger("simulador.orquestrador")
        
        self.AVAILABLE_MOTORS = {
            "bv": MotorBV,
            "pan": MotorPAN,
            "creditas": MotorCreditas,
        }

    async def executar_simulacao_paralela(
        self,
        bancos_solicitados: List[str],
        input_data: SimulationInput,
        credentials_map: Dict[str, dict],
    ) -> Dict[str, SimulationOutput]:
        """
        Executa simulações em todos os bancos solicitados em paralelo.
        credentials_map: { bank_code: dict_with_credentials }
        """
        start = time.time()
        
        bank_codes = [b for b in set(bancos_solicitados) if b in self.AVAILABLE_MOTORS]
        
        motors = {}
        for code in bank_codes:
            creds = credentials_map.get(code, {})
            motors[code] = self.AVAILABLE_MOTORS[code](credentials=creds)

        async def _run_single(code: str, motor):
            try:
                # Usa api_debug global do app para forçar mock independente de credenciais
                if settings.api_debug:
                    self.logger.info(f"Orquestrador: Modo DEBUG ativo. Forçando mock para {code}")
                    motor.credentials = {} # apaga credenciais para forçar mock internamente
                
                result = await motor.simulate(input_data)
                return code, result
            except Exception as e:
                self.logger.error(f"Erro fatal no motor {code}: {e}")
                return code, SimulationOutput(
                    bank_code=code,
                    bank_name=code.upper(),
                    status="error",
                    error_message=f"Erro interno: {str(e)}"
                )
            finally:
                await motor.close()

        tasks = [_run_single(code, motor) for code, motor in motors.items()]
        results_list = await asyncio.gather(*tasks)

        results = {code: output for code, output in results_list}
        
        # Opcional: checa se precisamos delegar para fallback browser (ex: banco Itaú não mapeado na V2)
        # Se na task tivéssemos um "itau", enviaríamos um POST via httpx para WORKER_URL.
        
        return results

orquestrador_v2 = OrquestradorV2()
