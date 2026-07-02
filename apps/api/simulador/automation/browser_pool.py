"""
Gerenciador de pool de navegadores para otimizar performance.
Evita overhead de criar/destruir navegadores a cada simulação.
"""

import logging
import threading
import time
from queue import Queue, Empty
from typing import Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import os

logger = logging.getLogger(__name__)


class BrowserPool:
    """
    Pool de navegadores Chrome para automação web.
    Gerencia criação, reutilização e limpeza de navegadores.
    """

    def __init__(self, max_browsers: int = 5, headless: bool = True):
        """
        Inicializa o pool de navegadores.

        Args:
            max_browsers: Número máximo de navegadores simultâneos
            headless: Se True, executaquadros navegadores em modo headless (sem UI)
        """
        self.max_browsers = max_browsers
        self.headless = headless
        self.available: Queue = Queue()
        self.in_use = set()
        self.lock = threading.Lock()
        self.created_count = 0
        self.destroyed_count = 0

        logger.info(
            f"BrowserPool iniciado: max_browsers={max_browsers}, "
            f"headless={headless}"
        )

    def acquire(self, timeout: int = 60) -> webdriver.Chrome:
        """
        Pega um navegador do pool (ou cria novo se necessário).

        Args:
            timeout: Tempo máximo de espera em segundos

        Returns:
            WebDriver: Instância do navegador Chrome

        Raises:
            TimeoutError: Se timeout for excedido
        """
        start_time = time.time()

        while True:
            with self.lock:
                # Tentar pegar navegador disponível
                try:
                    browser = self.available.get_nowait()
                    self.in_use.add(browser)
                    logger.debug(f"Navegador reutilizado do pool. Em uso: {len(self.in_use)}")
                    return browser
                except Empty:
                    pass

                # Se pode criar novo navegador
                if len(self.in_use) < self.max_browsers:
                    browser = self._create_browser()
                    self.in_use.add(browser)
                    logger.info(
                        f"Novo navegador criado. "
                        f"Total em uso: {len(self.in_use)}/{self.max_browsers}"
                    )
                    return browser

            # Pool cheio - verificar timeout
            if time.time() - start_time > timeout:
                raise TimeoutError(
                    f"Timeout aguardando navegador disponível após {timeout}s"
                )

            # Aguardar um pouco antes de tentar novamente
            time.sleep(0.5)

    def release(self, browser: webdriver.Chrome) -> None:
        """
        Devolve navegador ao pool após uso.
        Limpa cache, cookies e sessões antes de devolver.

        Args:
            browser: Instância do navegador a devolver
        """
        with self.lock:
            if browser not in self.in_use:
                logger.warning("Tentativa de devolver navegador que não está em uso")
                return

            try:
                # Limpar estado do navegador
                self._clear_browser_state(browser)

                # Remover de in_use e adicionar a available
                self.in_use.remove(browser)
                self.available.put(browser)

                logger.debug(
                    f"Navegador devolvido ao pool. "
                    f"Disponíveis: {self.available.qsize()}, Em uso: {len(self.in_use)}"
                )

            except Exception as exc:
                logger.error(f"Erro ao devolver navegador: {exc}", exc_info=True)
                # Se deu erro, destruir o navegador
                self.in_use.discard(browser)
                self._destroy_browser(browser)

    def _create_browser(self) -> webdriver.Chrome:
        """
        Cria uma nova instância do navegador Chrome.

        Returns:
            WebDriver: Nova instância do Chrome
        """
        try:
            options = self._get_chrome_options()

            # Usar webdriver_manager para gerenciar ChromeDriver automaticamente
            service = Service(ChromeDriverManager().install())

            browser = webdriver.Chrome(service=service, options=options)
            browser.set_page_load_timeout(30)  # Timeout de 30 segundos para carregamento
            browser.implicitly_wait(10)  # Espera implícita de 10 segundos

            self.created_count += 1
            logger.info(f"Navegador criado. Total criado: {self.created_count}")

            return browser

        except Exception as exc:
            logger.error(f"Erro ao criar navegador: {exc}", exc_info=True)
            raise

    def _get_chrome_options(self) -> ChromeOptions:
        """
        Configura opções do Chrome para automação.

        Returns:
            ChromeOptions: Opções configuradas
        """
        options = ChromeOptions()

        if self.headless:
            options.add_argument("--headless=new")  # Novo modo headless
            options.add_argument("--disable-gpu")

        # Opções de performance e estabilidade
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # User agent para parecer um navegador normal
        options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        )

        # Desabilitar imagens para economizar banda (opcional)
        # prefs = {"profile.managed_default_content_settings.images": 2}
        # options.add_experimental_option("prefs", prefs)

        # Tamanho da janela
        options.add_argument("--window-size=1920,1080")

        # Aceitar certificados SSL inseguros
        options.add_argument("--ignore-certificate-errors")

        return options

    def _clear_browser_state(self, browser: webdriver.Chrome) -> None:
        """
        Limpa estado do navegador (cookies, cache, localStorage, sessionStorage).

        Args:
            browser: Instância do navegador
        """
        try:
            # Deletar todos os cookies
            browser.delete_all_cookies()

            # Limpar localStorage e sessionStorage
            try:
                browser.execute_script("window.localStorage.clear();")
                browser.execute_script("window.sessionStorage.clear();")
            except:
                pass  # Pode falhar se não houver página carregada

            # Navegar para página em branco
            browser.get("about:blank")

            logger.debug("Estado do navegador limpo")

        except Exception as exc:
            logger.warning(f"Erro ao limpar estado do navegador: {exc}")
            raise

    def _destroy_browser(self, browser: webdriver.Chrome) -> None:
        """
        Destrói instância do navegador.

        Args:
            browser: Instância do navegador
        """
        try:
            browser.quit()
            self.destroyed_count += 1
            logger.debug(f"Navegador destruído. Total destruído: {self.destroyed_count}")
        except Exception as exc:
            logger.error(f"Erro ao destruir navegador: {exc}")

    def shutdown(self) -> None:
        """
        Desliga o pool, destruindo todos os navegadores.
        """
        logger.info("Desligando pool de navegadores...")

        with self.lock:
            # Destruir navegadores em uso
            for browser in list(self.in_use):
                self._destroy_browser(browser)
            self.in_use.clear()

            # Destruir navegadores disponíveis
            while not self.available.empty():
                try:
                    browser = self.available.get_nowait()
                    self._destroy_browser(browser)
                except Empty:
                    break

        logger.info(
            f"Pool desligado. "
            f"Total criado: {self.created_count}, "
            f"Total destruído: {self.destroyed_count}"
        )

    def get_metrics(self) -> dict:
        """
        Retorna métricas do pool.

        Returns:
            dict: Métricas do pool
        """
        with self.lock:
            return {
                "total_browsers": len(self.in_use) + self.available.qsize(),
                "available_browsers": self.available.qsize(),
                "in_use_browsers": len(self.in_use),
                "max_browsers": self.max_browsers,
                "created_count": self.created_count,
                "destroyed_count": self.destroyed_count,
            }


# Instância global do pool (singleton)
# Default conservador (1): "Testar conexão" é ação pontual do usuário, não simulação em lote.
# Aumentar exige medir consumo de memória real da VM Fly.io antes (ver TDD, seção 7).
MAX_BROWSERS = int(os.getenv("MAX_BROWSERS", "1"))
BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"

browser_pool = BrowserPool(max_browsers=MAX_BROWSERS, headless=BROWSER_HEADLESS)

# Registrar shutdown do pool ao sair
import atexit
atexit.register(browser_pool.shutdown)
