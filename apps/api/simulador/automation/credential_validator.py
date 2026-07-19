"""
Validador de credenciais bancárias.
Testa se login/senha estão corretos antes de processar simulação completa.
"""

import logging
import json
import os
from typing import Dict, Any

from simulador.automation.browser_pool import browser_pool

logger = logging.getLogger(__name__)


def load_bank_mappings(bank_code: str) -> dict:
    """
    Carrega mapeamentos de elementos do banco.

    Args:
        bank_code: Código do banco (bv, c6, santander)

    Returns:
        dict: Mapeamentos de elementos

    Raises:
        FileNotFoundError: Se arquivo de mapeamento não existir
    """
    mappings_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "bancos_login",
        "mappings",
        f"{bank_code}.json"
    )

    if not os.path.exists(mappings_path):
        logger.warning(f"Mapeamento não encontrado para {bank_code}, usando padrão")
        return {
            "bank_name": bank_code.upper(),
            "base_url": f"https://www.{bank_code}.com.br",
            "login": {},
            "simulation_form": {},
            "results": {}
        }

    with open(mappings_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_credentials_sync(
    bank_code: str,
    username: str,
    password: str
) -> bool:
    """
    Valida credenciais bancárias de forma síncrona.
    Usado pelas tasks Celery.

    Args:
        bank_code: Código do banco (bv, c6, santander)
        username: Login/CPF
        password: Senha

    Returns:
        bool: True se credenciais válidas, False caso contrário
    """
    browser = None

    try:
        logger.info(f"Validando credenciais para banco {bank_code}")

        # Carregar mapeamentos
        mappings = load_bank_mappings(bank_code)

        # Importar módulo do banco
        bank_module = _import_bank_module(bank_code)
        automation_cls = _get_automation_class(bank_module)

        # Pegar navegador do pool
        browser = browser_pool.acquire()

        # Criar instância da automação
        automation = automation_cls(browser, mappings)

        # Validar credenciais
        is_valid = automation.validate_credentials(username, password)

        logger.info(
            f"Credenciais para {bank_code}: "
            f"{'VÁLIDAS' if is_valid else 'INVÁLIDAS'}"
        )

        return is_valid

    except Exception as exc:
        logger.error(
            f"Erro ao validar credenciais para {bank_code}: {exc}",
            exc_info=True
        )
        return False

    finally:
        # Devolver navegador ao pool
        if browser:
            browser_pool.release(browser)


def validate_credentials_batch(
    credentials_list: list[Dict[str, str]]
) -> Dict[str, bool]:
    """
    Valida múltiplas credenciais em lote.

    Args:
        credentials_list: Lista de dicts com {bank_code, username, password}

    Returns:
        Dict: {bank_code: is_valid}
    """
    results = {}

    for cred in credentials_list:
        bank_code = cred.get("bank_code")
        username = cred.get("username")
        password = cred.get("password")

        if not all([bank_code, username, password]):
            logger.warning(f"Credencial incompleta: {cred}")
            results[bank_code] = False
            continue

        is_valid = validate_credentials_sync(bank_code, username, password)
        results[bank_code] = is_valid

    logger.info(f"Validação em lote completa: {results}")
    return results


def _import_bank_module(bank_code: str):
    """
    Importa módulo do banco dinamicamente.

    Args:
        bank_code: Código do banco

    Returns:
        Módulo do banco

    Raises:
        ValueError: Se banco não suportado
    """
    if bank_code == "bv":
        from simulador.bancos_login import bv
        return bv
    elif bank_code == "c6":
        from simulador.bancos_login import c6
        return c6
    elif bank_code == "itau":
        from simulador.bancos_login import itau
        return itau
    elif bank_code == "santander":
        from simulador.bancos_login import santander
        return santander
    else:
        raise ValueError(f"Banco {bank_code} não suportado")


# Cada módulo de banco expõe uma subclasse de BaseBankAutomation com nome próprio
# (não "BankAutomation" genérico) — mapeamento explícito em vez de convenção de nome.
_AUTOMATION_CLASS_NAMES = {
    "bv": "BancoBVAutomation",
    "c6": "C6BankAutomation",
    "itau": "ItauAutomation",
    "santander": "SantanderAutomation",
}


def _get_automation_class(bank_module):
    """Resolve a classe de automação (subclasse de BaseBankAutomation) do módulo do banco."""
    bank_code = bank_module.__name__.rsplit(".", 1)[-1]
    class_name = _AUTOMATION_CLASS_NAMES[bank_code]
    return getattr(bank_module, class_name)


# ============================================================================
# Função auxiliar para validação rápida (usado pela API)
# ============================================================================

async def validate_credentials_async(
    bank_code: str,
    username: str,
    password: str
) -> Dict[str, Any]:
    """
    Valida credenciais de forma assíncrona (roda a validação síncrona/Selenium
    em threadpool para não bloquear o event loop). Usado pelos endpoints da API.

    Args:
        bank_code: Código do banco
        username: Login/CPF
        password: Senha

    Returns:
        Dict com resultado da validação
    """
    import asyncio

    loop = asyncio.get_running_loop()
    try:
        is_valid = await loop.run_in_executor(
            None, validate_credentials_sync, bank_code, username, password
        )
        return {
            "valid": is_valid,
            "bank_code": bank_code,
            "message": "Credenciais válidas." if is_valid else "Credenciais inválidas ou falha ao validar.",
        }
    except Exception as exc:
        logger.error(f"Erro ao validar credenciais async: {exc}")
        return {
            "valid": False,
            "bank_code": bank_code,
            "message": f"Erro ao validar: {str(exc)}"
        }
