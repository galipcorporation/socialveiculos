"""
Classe base abstrata para automação de bancos.
Define interface padrão que todos os módulos bancários devem implementar.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import logging
import time

logger = logging.getLogger(__name__)


class BaseBankAutomation(ABC):
    """
    Classe base abstrata para automação de bancos.
    Todos os módulos de bancos (bv.py, c6.py, santander.py) devem herdar desta classe.
    """

    def __init__(self, browser: webdriver.Chrome, mappings: dict):
        """
        Inicializa automação do banco.

        Args:
            browser: Instância do WebDriver (do pool)
            mappings: Dicionário com mapeamentos de elementos (seletores CSS/XPath)
        """
        self.browser = browser
        self.mappings = mappings
        self.wait = WebDriverWait(browser, 30)  # Espera explícita de até 30s
        self.bank_name = mappings.get("bank_name", "Unknown Bank")
        self.base_url = mappings.get("base_url", "")

        logger.info(f"Automação iniciada para {self.bank_name}")

    # ========================================================================
    # Métodos Abstratos (devem ser implementados por cada banco)
    # ========================================================================

    @abstractmethod
    def login(self, username: str, password: str) -> bool:
        """
        Realiza login no banco.

        Args:
            username: Login/CPF
            password: Senha

        Returns:
            bool: True se login bem-sucedido, False caso contrário

        Raises:
            Exception: Se houver erro no login
        """
        pass

    @abstractmethod
    def fill_simulation_form(self, person_data: dict, vehicle_data: dict) -> None:
        """
        Preenche formulário de simulação.

        Args:
            person_data: Dados da pessoa (CPF, nome, etc.)
            vehicle_data: Dados do veículo (ano, marca, modelo, valor)

        Raises:
            Exception: Se houver erro no preenchimento
        """
        pass

    @abstractmethod
    def extract_results(self) -> Dict[str, Any]:
        """
        Extrai resultados da simulação da página.

        Returns:
            Dict contendo:
                - monthly_payment: float
                - interest_rate: float
                - total_amount: float
                - term_months: int
                - down_payment: float (opcional)
                - raw_result: str (HTML bruto opcional)
                - additional_data: dict (dados extras)
                - completion_url: str (URL para finalizar)

        Raises:
            Exception: Se houver erro na extração
        """
        pass

    # ========================================================================
    # Métodos Auxiliares (disponíveis para todas as implementações)
    # ========================================================================

    def find_element_from_list(
        self,
        section: str,
        field: str,
        timeout: int = 30,
        required: bool = True,
    ) -> Optional[webdriver.remote.webelement.WebElement]:
        """
        Resolve um campo de mapeamento no formato real usado pelos JSONs de
        `Financiadoras/mapeamentos/<banco>_mapeamento.json`: lista de seletores
        alternativos, tentados em ordem, cada um em um dos formatos:
          - CSS puro (ex.: "#username", "input[type='password']")
          - XPath (ex.: "//button[contains(., 'Entrar')]" ou prefixo "xpath/...")
          - "aria/<label>" — busca por aria-label/texto acessível
          - "text/<trecho>" — busca por texto visível do elemento

        Esses seletores foram desenhados para a extensão Chrome (JS) do
        SimuladorFacil; aqui viram fallbacks tentados em sequência via Selenium.

        Args:
            section: seção do mapeamento (ex.: "login", "formulario")
            field: campo dentro da seção (ex.: "campo_usuario")
            timeout: timeout por seletor tentado, em segundos
            required: se True, levanta exceção se nenhum seletor encontrar o elemento

        Returns:
            WebElement ou None
        """
        selectors = self.mappings.get(section, {}).get(field)
        if not selectors:
            if required:
                raise NoSuchElementException(
                    f"Campo '{section}.{field}' não encontrado nos mappings"
                )
            return None

        # Compat: formato antigo {"valor": "seletor"} usado por versões anteriores do código
        if isinstance(selectors, dict) and "valor" in selectors:
            selectors = [selectors["valor"]]
        if isinstance(selectors, str):
            selectors = [selectors]

        last_exc: Optional[Exception] = None
        for raw_selector in selectors:
            try:
                by, value = self._parse_selector(raw_selector)
                element = WebDriverWait(self.browser, timeout).until(
                    EC.element_to_be_clickable((by, value))
                )
                # SPAs (Angular/React) podem renderizar o elemento fora da viewport
                # ou animando entrada — scroll explícito evita "element not interactable".
                self.browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
                logger.debug(f"Campo '{section}.{field}' encontrado via '{raw_selector}'")
                return element
            except Exception as exc:
                last_exc = exc
                continue

        if required:
            raise NoSuchElementException(
                f"Nenhum seletor de '{section}.{field}' encontrou elemento "
                f"após tentar {len(selectors)} opção(ões): {last_exc}"
            )
        logger.debug(f"Campo opcional '{section}.{field}' não encontrado")
        return None

    def _parse_selector(self, raw_selector: str):
        """Converte um seletor no formato dos mapeamentos reais em (By, valor)."""
        if raw_selector.startswith("aria/"):
            label = raw_selector[len("aria/"):]
            return By.XPATH, f"//*[@aria-label={self._xpath_literal(label)}]"
        if raw_selector.startswith("text/"):
            texto = raw_selector[len("text/"):]
            return By.XPATH, f"//*[contains(text(), {self._xpath_literal(texto)})]"
        if raw_selector.startswith("xpath/"):
            return By.XPATH, raw_selector[len("xpath/"):]
        if raw_selector.startswith("//") or raw_selector.startswith("("):
            return By.XPATH, raw_selector
        return By.CSS_SELECTOR, raw_selector

    @staticmethod
    def _xpath_literal(text: str) -> str:
        """Escapa uma string para uso literal em XPath (lida com aspas simples/duplas)."""
        if "'" not in text:
            return f"'{text}'"
        if '"' not in text:
            return f'"{text}"'
        parts = text.split("'")
        return "concat('" + "', \"'\", '".join(parts) + "')"

    def find_element(
        self,
        selector_key: str,
        timeout: int = 30,
        required: bool = True
    ) -> Optional[webdriver.remote.webelement.WebElement]:
        """
        Encontra elemento usando mapeamento.

        Args:
            selector_key: Chave no dicionário de mappings
            timeout: Timeout em segundos
            required: Se True, levanta exceção se não encontrar

        Returns:
            WebElement ou None

        Raises:
            NoSuchElementException: Se required=True e elemento não encontrado
        """
        selector = self._get_selector(selector_key)
        if not selector:
            if required:
                raise NoSuchElementException(
                    f"Seletor '{selector_key}' não encontrado nos mappings"
                )
            return None

        try:
            # Detectar tipo de seletor (CSS ou XPath)
            by = By.XPATH if selector.startswith("//") or selector.startswith("(") else By.CSS_SELECTOR

            element = WebDriverWait(self.browser, timeout).until(
                EC.presence_of_element_located((by, selector))
            )
            logger.debug(f"Elemento '{selector_key}' encontrado: {selector}")
            return element

        except TimeoutException:
            if required:
                logger.error(f"Elemento '{selector_key}' não encontrado: {selector}")
                raise NoSuchElementException(
                    f"Elemento '{selector_key}' não encontrado após {timeout}s"
                )
            logger.warning(f"Elemento opcional '{selector_key}' não encontrado")
            return None

    def click_element(self, selector_key: str, timeout: int = 30) -> None:
        """
        Clica em elemento.

        Args:
            selector_key: Chave no dicionário de mappings
            timeout: Timeout em segundos
        """
        element = self.find_element(selector_key, timeout=timeout)

        # Scroll até o elemento
        self.browser.execute_script("arguments[0].scrollIntoView(true);", element)
        time.sleep(0.5)

        # Tentar clicar
        try:
            element.click()
        except Exception:
            # Se falhar, usar JavaScript
            self.browser.execute_script("arguments[0].click();", element)

        logger.debug(f"Clicou em '{selector_key}'")

    def fill_input(self, selector_key: str, value: str, clear: bool = True) -> None:
        """
        Preenche campo de input.

        Args:
            selector_key: Chave no dicionário de mappings
            value: Valor a preencher
            clear: Se True, limpa campo antes de preencher
        """
        element = self.find_element(selector_key)

        if clear:
            element.clear()

        element.send_keys(value)
        logger.debug(f"Preencheu '{selector_key}' com valor")

    def select_dropdown(self, selector_key: str, value: str) -> None:
        """
        Seleciona opção em dropdown/select.

        Args:
            selector_key: Chave no dicionário de mappings
            value: Valor a selecionar
        """
        from selenium.webdriver.support.ui import Select

        element = self.find_element(selector_key)
        select = Select(element)

        try:
            select.select_by_value(value)
        except Exception:
            try:
                select.select_by_visible_text(value)
            except Exception:
                select.select_by_index(int(value))

        logger.debug(f"Selecionou '{value}' em '{selector_key}'")

    def wait_for_page_load(self, timeout: int = 30) -> None:
        """
        Aguarda página carregar completamente.

        Args:
            timeout: Timeout em segundos
        """
        WebDriverWait(self.browser, timeout).until(
            lambda driver: driver.execute_script("return document.readyState") == "complete"
        )
        logger.debug("Página carregada")

    def take_screenshot(self, name: str = "screenshot") -> str:
        """
        Tira screenshot da página.

        Args:
            name: Nome base do arquivo

        Returns:
            str: Caminho do arquivo salvo
        """
        timestamp = int(time.time())
        filename = f"/tmp/{name}_{timestamp}.png"
        self.browser.save_screenshot(filename)
        logger.info(f"Screenshot salvo: {filename}")
        return filename

    def get_text(self, selector_key: str, required: bool = True) -> Optional[str]:
        """
        Obtém texto de um elemento.

        Args:
            selector_key: Chave no dicionário de mappings
            required: Se True, levanta exceção se não encontrar

        Returns:
            str ou None
        """
        element = self.find_element(selector_key, required=required)
        if element:
            text = element.text.strip()
            logger.debug(f"Texto obtido de '{selector_key}': {text[:50]}...")
            return text
        return None

    def wait_for_url_change(self, initial_url: str, timeout: int = 10) -> bool:
        """
        Aguarda URL mudar (útil para detectar redirecionamento após login).

        Args:
            initial_url: URL inicial
            timeout: Timeout em segundos

        Returns:
            bool: True se URL mudou, False se timeout
        """
        try:
            WebDriverWait(self.browser, timeout).until(
                lambda driver: driver.current_url != initial_url
            )
            logger.debug(f"URL mudou de {initial_url} para {self.browser.current_url}")
            return True
        except TimeoutException:
            logger.debug(f"URL não mudou após {timeout}s")
            return False

    def _get_selector(self, selector_key: str) -> Optional[str]:
        """
        Busca seletor nos mappings (suporta nested keys).

        Args:
            selector_key: Chave (pode ser "login.username" para nested)

        Returns:
            str ou None
        """
        keys = selector_key.split(".")
        value = self.mappings

        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None

        return value

    def validate_credentials(self, username: str, password: str) -> bool:
        """
        Valida credenciais testando login.

        Args:
            username: Login/CPF
            password: Senha

        Returns:
            bool: True se credenciais válidas, False caso contrário
        """
        try:
            initial_url = self.browser.current_url
            self.browser.get(self.base_url)
            self.wait_for_page_load()

            # Tentar login
            success = self.login(username, password)

            if success:
                # Verificar se URL mudou (indicando login bem-sucedido)
                return self.wait_for_url_change(initial_url, timeout=5)

            return False

        except Exception as exc:
            logger.error(f"Erro ao validar credenciais: {exc}")
            return False

    # ========================================================================
    # Método Principal (template method pattern)
    # ========================================================================

    def execute_simulation(
        self,
        credentials: dict,
        person_data: dict,
        vehicle_data: dict
    ) -> Dict[str, Any]:
        """
        Executa simulação completa (template method).

        Args:
            credentials: {username, password}
            person_data: Dados da pessoa
            vehicle_data: Dados do veículo

        Returns:
            Dict com resultados da simulação

        Raises:
            Exception: Se houver erro em qualquer etapa
        """
        try:
            logger.info(f"Iniciando simulação no {self.bank_name}")

            # 1. Navegar para página do banco
            self.browser.get(self.base_url)
            self.wait_for_page_load()
            logger.info(f"Navegou para {self.base_url}")

            # 2. Fazer login
            login_success = self.login(
                credentials.get("username"),
                credentials.get("password")
            )

            if not login_success:
                raise Exception("Falha no login")

            logger.info("Login realizado com sucesso")

            # 3. Preencher formulário de simulação
            self.fill_simulation_form(person_data, vehicle_data)
            logger.info("Formulário preenchido")

            # 4. Aguardar processamento
            time.sleep(3)

            # 5. Extrair resultados
            results = self.extract_results()
            logger.info(f"Resultados extraídos: {results.get('monthly_payment', 'N/A')}")

            return results

        except Exception as exc:
            logger.error(f"Erro ao executar simulação no {self.bank_name}: {exc}", exc_info=True)
            # Tirar screenshot para debugging
            self.take_screenshot(f"error_{self.bank_name}")
            raise
