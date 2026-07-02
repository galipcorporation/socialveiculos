"""
Módulo de automação para C6 Bank.
Implementa interface BaseBankAutomation para simulações do C6 Bank.
"""

import logging
import time
from typing import Dict, Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from simulador.automation.base import BaseBankAutomation

logger = logging.getLogger(__name__)


class C6BankAutomation(BaseBankAutomation):
    """
    Automação específica para C6 Bank.
    """

    def __init__(self, browser: webdriver.Chrome, mappings: dict):
        """
        Inicializa automação do C6 Bank.

        Args:
            browser: Instância do WebDriver
            mappings: Mapeamentos carregados do JSON
        """
        # Extrair URL base do mapeamento
        base_url = mappings.get("login", {}).get("url", "")
        mappings["base_url"] = base_url
        mappings["bank_name"] = "C6 Bank"

        super().__init__(browser, mappings)

    def login(self, username: str, password: str) -> bool:
        """
        Realiza login no C6 Bank.

        Args:
            username: CPF ou login do parceiro
            password: Senha de acesso

        Returns:
            True se login bem-sucedido

        Raises:
            Exception: Se houver erro no login
        """
        try:
            logger.info("Iniciando login no C6 Bank")

            # Navegar para página de login
            login_url = self.mappings.get("login", {}).get("url")
            self.browser.get(login_url)
            self.wait_for_page_load()

            # Clicar no botão "Iniciar Login" (se houver no mapeamento)
            botao_iniciar = self.find_element_from_list("login", "botao_iniciar_login", timeout=5, required=False)
            if botao_iniciar:
                botao_iniciar.click()
                logger.debug("Botão 'Iniciar Login' clicado")
                time.sleep(1)

            # Preencher campo de usuário
            campo_usuario = self.find_element_from_list("login", "campo_usuario")
            try:
                campo_usuario.clear()
            except Exception as e:
                logger.warning(f"Não foi possível limpar campo de usuário com .clear(): {e}")
                self.browser.execute_script("arguments[0].value = '';", campo_usuario)
            campo_usuario.send_keys(username)
            logger.debug("Campo de usuário preenchido")

            # Preencher campo de senha
            campo_senha = self.find_element_from_list("login", "campo_senha")
            try:
                campo_senha.clear()
            except Exception as e:
                logger.warning(f"Não foi possível limpar campo de senha com .clear(): {e}")
                self.browser.execute_script("arguments[0].value = '';", campo_senha)
            campo_senha.send_keys(password)
            logger.debug("Campo de senha preenchido")

            # Clicar no botão de login
            botao = self.find_element_from_list("login", "botao_submit")
            botao.click()
            logger.debug("Botão de login clicado")

            # Verificar se login foi bem-sucedido
            time.sleep(5)  # Aguardar mais tempo para processar

            # 1. Verificar se há mensagem de erro
            try:
                # Procurar por mensagens de erro comuns
                error_selectors = [
                    "div[class*='error']",
                    "span[class*='error']",
                    "div[class*='alert']",
                    "div[class*='danger']",
                    "p[class*='error']"
                ]

                for selector in error_selectors:
                    try:
                        error_element = self.browser.find_element(By.CSS_SELECTOR, selector)
                        if error_element.is_displayed() and error_element.text:
                            logger.error(f"Mensagem de erro encontrada: {error_element.text}")
                            return False
                    except Exception:
                        continue
            except Exception as e:
                logger.debug(f"Erro ao verificar mensagens de erro: {e}")

            # 2. Verificar se ainda está na página de login (indica falha)
            if login_url and login_url in self.browser.current_url:
                logger.error("Login falhou - ainda na página de login")
                return False

            # 3. Verificar se chegou na URL do dashboard
            dashboard_url = self.mappings.get("navegacao", {}).get("url_dashboard", "")
            if dashboard_url and dashboard_url in self.browser.current_url:
                logger.info("Login realizado com sucesso (URL do dashboard detectada)")
                return True

            # 4. Verificar se há elementos do dashboard
            try:
                # Procurar por elementos que indicam dashboard
                dashboard_indicators = [
                    "div[class*='dashboard']",
                    "nav[class*='menu']",
                    "div[class*='welcome']",
                    "button[class*='logout']",
                    "a[class*='sair']"
                ]

                for selector in dashboard_indicators:
                    try:
                        element = WebDriverWait(self.browser, 3).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        if element:
                            logger.info(f"Elemento do dashboard encontrado: {selector}")
                            return True
                    except TimeoutException:
                        continue
            except Exception as e:
                logger.debug(f"Erro ao verificar elementos do dashboard: {e}")

            # 5. Se não conseguiu validar, considerar como falha
            logger.warning(f"Não foi possível validar o login. URL atual: {self.browser.current_url}")
            logger.warning("Assumindo que o login falhou por segurança")
            return False

        except Exception as exc:
            logger.error(f"Erro no login do C6 Bank: {exc}", exc_info=True)
            self.take_screenshot("c6_login_error")
            raise

    def fill_simulation_form(self, person_data: dict, vehicle_data: dict) -> None:
        """
        Preenche formulário de simulação do C6 Bank.

        Args:
            person_data: Dados da pessoa (cpf, full_name, email, phone, birth_date)
            vehicle_data: Dados do veículo (year, make, model, value, plate)

        Raises:
            Exception: Se houver erro no preenchimento
        """
        try:
            logger.info("Preenchendo formulário de simulação no C6 Bank")

            # Navegar para página de simulação
            simulacao_url = self.mappings.get("navegacao", {}).get("url_simulacao")
            if simulacao_url:
                self.browser.get(simulacao_url)
                self.wait_for_page_load()
            else:
                # Clicar em "Criar uma nova"
                botao_nova_proposta = self.mappings["navegacao"]["botao_criar_nova"]["valor"]
                botao = self.wait.until(
                    EC.element_to_be_clickable((By.XPATH, botao_nova_proposta))
                )
                botao.click()

            time.sleep(2)

            # Preencher CPF
            cpf_selector = self.mappings["formulario"]["cpf"]["valor"]
            campo_cpf = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, cpf_selector))
            )
            campo_cpf.clear()
            campo_cpf.send_keys(person_data.get("cpf", ""))
            logger.debug("CPF preenchido")

            # Preencher Nome
            nome_selector = self.mappings["formulario"]["nome"]["valor"]
            campo_nome = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, nome_selector))
            )
            campo_nome.clear()
            campo_nome.send_keys(person_data.get("full_name", ""))
            logger.debug("Nome preenchido")

            # Preencher Telefone
            telefone_selector = self.mappings["formulario"]["telefone"]["valor"]
            campo_telefone = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, telefone_selector))
            )
            campo_telefone.clear()
            campo_telefone.send_keys(person_data.get("phone", ""))
            logger.debug("Telefone preenchido")

            # Preencher Email
            email_selector = self.mappings["formulario"]["email"]["valor"]
            campo_email = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, email_selector))
            )
            campo_email.clear()
            campo_email.send_keys(person_data.get("email", ""))
            logger.debug("Email preenchido")

            # Preencher Data de Nascimento (se disponível)
            if person_data.get("birth_date"):
                try:
                    data_nasc_selector = self.mappings["formulario"]["data_nascimento"]["valor"]
                    campo_data = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, data_nasc_selector))
                    )
                    campo_data.clear()
                    campo_data.send_keys(person_data.get("birth_date"))
                    logger.debug("Data de nascimento preenchida")
                except TimeoutException:
                    logger.debug("Campo de data de nascimento não encontrado")

            # Preencher Placa (se disponível)
            if vehicle_data.get("plate"):
                try:
                    placa_selector = self.mappings["formulario"]["placa"]["valor"]
                    campo_placa = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, placa_selector))
                    )
                    campo_placa.clear()
                    campo_placa.send_keys(vehicle_data.get("plate"))
                    logger.debug("Placa preenchida")
                except TimeoutException:
                    logger.debug("Campo de placa não encontrado")

            # Preencher Marca, Modelo, Ano (dependem da interface do banco)
            # Aqui pode ser select ou input, o mapeamento deve indicar
            time.sleep(1)

            # Preencher Valor do Veículo
            valor_selector = self.mappings["formulario"]["valor_veiculo"]["valor"]
            campo_valor = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, valor_selector))
            )
            campo_valor.clear()
            campo_valor.send_keys(str(vehicle_data.get("value", 0)))
            logger.debug("Valor do veículo preenchido")

            # Preencher Valor de Entrada (se houver)
            try:
                entrada_selector = self.mappings["formulario"]["valor_entrada"]["valor"]
                campo_entrada = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, entrada_selector))
                )
                campo_entrada.clear()
                campo_entrada.send_keys(str(vehicle_data.get("down_payment", 0)))
                logger.debug("Valor de entrada preenchido")
            except TimeoutException:
                logger.debug("Campo de entrada não encontrado")

            # Preencher Prazo (se houver)
            try:
                prazo_selector = self.mappings["formulario"]["prazo"]["valor"]
                campo_prazo = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, prazo_selector))
                )
                campo_prazo.clear()
                campo_prazo.send_keys(str(vehicle_data.get("term_months", 48)))
                logger.debug("Prazo preenchido")
            except TimeoutException:
                logger.debug("Campo de prazo não encontrado")

            # Clicar no botão Simular
            botao_simular_selector = self.mappings["formulario"]["botao_simular"]["valor"]
            botao_simular = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, botao_simular_selector))
            )
            self.browser.execute_script("arguments[0].scrollIntoView(true);", botao_simular)
            time.sleep(0.5)
            botao_simular.click()
            logger.info("Botão Simular clicado - aguardando resultados")

            # Aguardar processamento
            time.sleep(5)

        except Exception as exc:
            logger.error(f"Erro ao preencher formulário C6: {exc}", exc_info=True)
            self.take_screenshot("c6_form_error")
            raise

    def extract_results(self) -> Dict[str, Any]:
        """
        Extrai resultados da simulação do C6 Bank.

        Returns:
            Dict com resultados:
                - monthly_payment: Valor da parcela
                - interest_rate: Taxa de juros
                - total_amount: Valor total
                - term_months: Prazo em meses
                - raw_result: HTML bruto (opcional)
                - additional_data: Dados extras
                - completion_url: URL para finalizar

        Raises:
            Exception: Se houver erro na extração
        """
        try:
            logger.info("Extraindo resultados da simulação C6")

            # Aguardar resultados aparecerem
            time.sleep(3)

            resultados = {}

            # Extrair valor da parcela
            try:
                parcela_selector = self.mappings["resultado"]["valor_parcela"]["valor"]
                elemento_parcela = self.wait.until(
                    EC.presence_of_element_located((By.XPATH, parcela_selector))
                )
                texto_parcela = elemento_parcela.text
                # Limpar e converter (ex: "R$ 1.234,56" -> 1234.56)
                valor_parcela = self._limpar_valor_monetario(texto_parcela)
                resultados["monthly_payment"] = valor_parcela
                logger.debug(f"Valor da parcela extraído: {valor_parcela}")
            except TimeoutException:
                logger.warning("Valor da parcela não encontrado")
                resultados["monthly_payment"] = None

            # Extrair taxa de juros
            try:
                taxa_selector = self.mappings["resultado"]["taxa_juros"]["valor"]
                elemento_taxa = WebDriverWait(self.browser, 5).until(
                    EC.presence_of_element_located((By.XPATH, taxa_selector))
                )
                texto_taxa = elemento_taxa.text
                # Limpar e converter (ex: "2,5% a.m." -> 2.5)
                taxa_juros = self._limpar_percentual(texto_taxa)
                resultados["interest_rate"] = taxa_juros
                logger.debug(f"Taxa de juros extraída: {taxa_juros}")
            except TimeoutException:
                logger.warning("Taxa de juros não encontrada")
                resultados["interest_rate"] = None

            # Extrair valor total
            try:
                total_selector = self.mappings["resultado"]["valor_total"]["valor"]
                elemento_total = WebDriverWait(self.browser, 5).until(
                    EC.presence_of_element_located((By.XPATH, total_selector))
                )
                texto_total = elemento_total.text
                valor_total = self._limpar_valor_monetario(texto_total)
                resultados["total_amount"] = valor_total
                logger.debug(f"Valor total extraído: {valor_total}")
            except TimeoutException:
                logger.warning("Valor total não encontrado")
                resultados["total_amount"] = None

            # Extrair CET (Custo Efetivo Total)
            try:
                cet_selector = self.mappings["resultado"]["cet"]["valor"]
                elemento_cet = WebDriverWait(self.browser, 5).until(
                    EC.presence_of_element_located((By.XPATH, cet_selector))
                )
                texto_cet = elemento_cet.text
                cet = self._limpar_percentual(texto_cet)
                resultados["cet"] = cet
                logger.debug(f"CET extraído: {cet}")
            except TimeoutException:
                logger.warning("CET não encontrado")
                resultados["cet"] = None

            # Adicionar dados extras
            resultados["bank_code"] = "c6"
            resultados["bank_name"] = "C6 Bank"
            resultados["completion_url"] = self.browser.current_url
            resultados["raw_result"] = self.browser.page_source[:5000]  # Primeiros 5000 chars

            # Dados adicionais
            resultados["additional_data"] = {
                "extracted_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "page_title": self.browser.title
            }

            logger.info("Resultados extraídos com sucesso")
            return resultados

        except Exception as exc:
            logger.error(f"Erro ao extrair resultados C6: {exc}", exc_info=True)
            self.take_screenshot("c6_extract_error")
            raise

    def _limpar_valor_monetario(self, texto: str) -> float:
        """
        Limpa e converte valor monetário para float.

        Args:
            texto: Texto com valor (ex: "R$ 1.234,56")

        Returns:
            Valor float (ex: 1234.56)
        """
        try:
            # Remover símbolos e espaços
            texto_limpo = texto.replace("R$", "").replace(".", "").replace(",", ".").strip()
            # Extrair apenas números e ponto decimal
            import re
            match = re.search(r"[\d.]+", texto_limpo)
            if match:
                return float(match.group())
            return 0.0
        except Exception:
            return 0.0

    def _limpar_percentual(self, texto: str) -> float:
        """
        Limpa e converte percentual para float.

        Args:
            texto: Texto com percentual (ex: "2,5% a.m.")

        Returns:
            Valor float (ex: 2.5)
        """
        try:
            import re
            # Extrair número com vírgula ou ponto
            match = re.search(r"([\d,\.]+)", texto)
            if match:
                valor = match.group(1).replace(",", ".")
                return float(valor)
            return 0.0
        except Exception:
            return 0.0


# ============================================================================
# Função de execução (chamada pelo Celery)
# ============================================================================

def executar(dados: Dict[str, Any], browser: webdriver.Chrome) -> Dict[str, Any]:
    """
    Função principal para executar simulação no C6 Bank.
    Chamada pelo sistema de filas (Celery).

    Args:
        dados: Dicionário com:
            - person: Dados da pessoa
            - vehicle: Dados do veículo
            - credentials: Credenciais do banco
            - mapeamento: Mapeamentos JSON

        browser: Instância do navegador do pool

    Returns:
        Dict com resultados da simulação

    Raises:
        Exception: Se houver erro na execução
    """
    logger.info("Iniciando execução de simulação no C6 Bank")

    # Extrair dados
    person_data = dados.get("person", {})
    vehicle_data = dados.get("vehicle", {})
    credentials = dados.get("credentials", {})
    mapeamento = dados.get("mapeamento", {})

    # Criar instância da automação
    automation = C6BankAutomation(browser, mapeamento)

    # Executar simulação usando o método template da classe base
    resultado = automation.execute_simulation(
        credentials=credentials,
        person_data=person_data,
        vehicle_data=vehicle_data
    )

    logger.info("Simulação C6 concluída com sucesso")
    return resultado
