"""
Módulo de automação para Banco BV.
Implementa interface BaseBankAutomation para simulações do Banco BV.
"""

import logging
import time
from typing import Dict, Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from simulador.automation.base import BaseBankAutomation

logger = logging.getLogger(__name__)


class BancoBVAutomation(BaseBankAutomation):
    """
    Automação específica para Banco BV.
    """

    def __init__(self, browser: webdriver.Chrome, mappings: dict):
        """
        Inicializa automação do Banco BV.

        Args:
            browser: Instância do WebDriver
            mappings: Mapeamentos carregados do JSON
        """
        # Extrair URL base do mapeamento
        base_url = mappings.get("login", {}).get("url", "")
        mappings["base_url"] = base_url
        mappings["bank_name"] = "Banco BV"

        super().__init__(browser, mappings)

    def login(self, username: str, password: str) -> bool:
        """
        Realiza login no Banco BV.

        Args:
            username: CPF ou login do parceiro
            password: Senha de acesso

        Returns:
            True se login bem-sucedido

        Raises:
            Exception: Se houver erro no login
        """
        try:
            logger.info("Iniciando login no Banco BV")

            # Navegar para página de login
            login_url = self.mappings.get("login", {}).get("url")
            self.browser.get(login_url)
            self.wait_for_page_load()

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

            # Marcar checkbox de aceite (se existir no mapeamento)
            checkbox = self.find_element_from_list("login", "checkbox", timeout=5, required=False)
            if checkbox:
                checkbox.click()
                logger.debug("Checkbox marcado")

            # Clicar no botão de login
            botao = self.find_element_from_list("login", "botao_submit")
            botao.click()
            logger.debug("Botão de login clicado")

            # Aguardar modal de termos (se aparecer)
            botao_modal = self.find_element_from_list("login", "modal_apos_login", timeout=10, required=False)
            if botao_modal:
                botao_modal.click()
                logger.debug("Modal de termos fechado")

            # Verificar se login foi bem-sucedido (URL mudou ou elemento do dashboard apareceu)
            time.sleep(3)
            dashboard_url = self.mappings.get("navegacao", {}).get("url_dashboard", "")

            if dashboard_url and dashboard_url in self.browser.current_url:
                logger.info("Login realizado com sucesso (URL do dashboard detectada)")
                return True

            # Verificar se ainda está na página de login (indica falha)
            if login_url in self.browser.current_url:
                logger.error("Login falhou - ainda na página de login")
                return False

            logger.info("Login aparentemente bem-sucedido")
            return True

        except Exception as exc:
            logger.error(f"Erro no login do Banco BV: {exc}", exc_info=True)
            self.take_screenshot("bv_login_error")
            raise

    def fill_simulation_form(self, person_data: dict, vehicle_data: dict) -> None:
        """
        Preenche formulário de simulação do Banco BV seguindo o fluxo correto.

        Args:
            person_data: Dados da pessoa (cpf, full_name, email, phone, birth_date)
            vehicle_data: Dados do veículo (year, make, model, value, plate)

        Raises:
            Exception: Se houver erro no preenchimento
        """
        try:
            logger.info("Preenchendo formulário de simulação no Banco BV")

            # Navegar para página de simulação ou clicar em Nova Proposta
            simulacao_url = self.mappings.get("navegacao", {}).get("url_simulacao")
            if simulacao_url:
                self.browser.get(simulacao_url)
                self.wait_for_page_load()
            else:
                # Clicar em "Nova Proposta"
                botao_nova_proposta = self.mappings["navegacao"]["botao_nova_proposta"]["valor"]
                botao = self.wait.until(
                    EC.element_to_be_clickable((By.XPATH, botao_nova_proposta))
                )
                botao.click()
                logger.debug("Botão Nova Proposta clicado")

            time.sleep(2)

            # ETAPA 1: Preencher CPF
            cpf_selector = self.mappings["formulario"]["cpf"]["valor"]
            campo_cpf = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, cpf_selector))
            )
            try:
                campo_cpf.clear()
            except Exception:
                self.browser.execute_script("arguments[0].value = '';", campo_cpf)
            campo_cpf.send_keys(person_data.get("cpf", ""))
            logger.debug("CPF preenchido")
            time.sleep(1)

            # ETAPA 2: Preencher Data de Nascimento
            if person_data.get("birth_date"):
                try:
                    data_nasc_selector = self.mappings["formulario"]["data_nascimento"]["valor"]
                    campo_data = self.wait.until(
                        EC.element_to_be_clickable((By.XPATH, data_nasc_selector))
                    )
                    try:
                        campo_data.clear()
                    except Exception:
                        self.browser.execute_script("arguments[0].value = '';", campo_data)
                    campo_data.send_keys(person_data.get("birth_date"))
                    logger.debug("Data de nascimento preenchida")
                    time.sleep(1)
                except TimeoutException:
                    logger.warning("Campo de data de nascimento não encontrado")

            # ETAPA 3: Clicar no checkbox de permissão
            try:
                checkbox_selector = self.mappings["formulario"]["checkbox_permissao"]["valor"]
                checkbox = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.XPATH, checkbox_selector))
                )
                checkbox.click()
                logger.debug("Checkbox de permissão marcado")
                time.sleep(1)
            except TimeoutException:
                logger.debug("Checkbox de permissão não encontrado")

            # ETAPA 4: Selecionar Pessoa Física (se houver opção)
            try:
                pf_selector = self.mappings["formulario"]["tipo_pessoa"]["pessoa_fisica"]["valor"]
                pf_radio = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.XPATH, pf_selector))
                )
                pf_radio.click()
                logger.debug("Selecionado Pessoa Física")
                time.sleep(1)
            except TimeoutException:
                logger.debug("Seleção de tipo de pessoa não encontrada")

            # ETAPA 5: Clicar em "Fazer nova simulação" para ir para próxima tela
            try:
                botao_fazer_sim = self.mappings["formulario"]["botao_fazer_nova_simulacao"]["valor"]
                botao = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.XPATH, botao_fazer_sim))
                )
                self.browser.execute_script("arguments[0].scrollIntoView(true);", botao)
                time.sleep(0.5)
                botao.click()
                logger.debug("Botão 'Fazer nova simulação' clicado")
                time.sleep(2)
            except TimeoutException:
                logger.debug("Botão 'Fazer nova simulação' não encontrado")

            # ETAPA 6: Preencher Placa do Veículo
            if vehicle_data.get("plate"):
                try:
                    placa_selector = self.mappings["formulario"]["placa"]["valor"]
                    campo_placa = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, placa_selector))
                    )
                    try:
                        campo_placa.clear()
                    except Exception:
                        self.browser.execute_script("arguments[0].value = '';", campo_placa)
                    campo_placa.send_keys(vehicle_data.get("plate"))
                    logger.debug("Placa preenchida")
                    time.sleep(2)  # Aguardar busca automática de dados
                except TimeoutException:
                    logger.warning("Campo de placa não encontrado")

            # ETAPA 7: Selecionar tipo de veículo (Usado)
            try:
                tipo_veiculo_selector = self.mappings["formulario"]["tipo_veiculo"]["valor"]
                tipo_radio = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.XPATH, tipo_veiculo_selector))
                )
                tipo_radio.click()
                logger.debug("Tipo de veículo selecionado (Usado)")
                time.sleep(1)
            except TimeoutException:
                logger.debug("Seleção de tipo de veículo não encontrada")

            # ETAPA 8: Preencher Valor do Veículo (se necessário, pode já vir preenchido)
            try:
                valor_selector = self.mappings["formulario"]["valor_veiculo"]["valor"]
                campo_valor = WebDriverWait(self.browser, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, valor_selector))
                )
                # Verificar se já está preenchido
                valor_atual = campo_valor.get_attribute("value")
                if not valor_atual or valor_atual == "":
                    try:
                        campo_valor.clear()
                    except Exception:
                        self.browser.execute_script("arguments[0].value = '';", campo_valor)
                    campo_valor.send_keys(str(vehicle_data.get("value", 0)))
                    logger.debug("Valor do veículo preenchido")
                else:
                    logger.debug(f"Valor do veículo já preenchido: {valor_atual}")
                time.sleep(1)
            except TimeoutException:
                logger.debug("Campo de valor do veículo não encontrado")

            # ETAPA 9: Clicar no botão Simular
            botao_simular_selector = self.mappings["formulario"]["botao_simular"]["valor"]
            botao_simular = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, botao_simular_selector))
            )
            self.browser.execute_script("arguments[0].scrollIntoView(true);", botao_simular)
            time.sleep(0.5)
            botao_simular.click()
            logger.info("Botão Simular clicado - aguardando resultados")
            time.sleep(5)  # Aguardar processamento

            # ETAPA 10: Preencher Valor de Entrada (aparece após simulação)
            try:
                entrada_selector = self.mappings["formulario"]["valor_entrada"]["valor"]
                campo_entrada = WebDriverWait(self.browser, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, entrada_selector))
                )
                try:
                    campo_entrada.clear()
                except Exception:
                    self.browser.execute_script("arguments[0].value = '';", campo_entrada)

                down_payment = vehicle_data.get("down_payment", 0)
                if down_payment > 0:
                    campo_entrada.send_keys(str(down_payment))
                    logger.debug(f"Valor de entrada preenchido: {down_payment}")
                    time.sleep(2)
            except TimeoutException:
                logger.debug("Campo de entrada não encontrado (pode ser opcional)")

            # ETAPA 11: Selecionar condição comercial (opcional, geralmente a primeira)
            try:
                condicao_selector = self.mappings["resultado"]["condicoes_comerciais"]["valor"]
                condicoes = self.browser.find_elements(By.XPATH, condicao_selector)
                if condicoes:
                    # Clicar na primeira condição disponível
                    condicoes[0].click()
                    logger.debug("Condição comercial selecionada")
                    time.sleep(1)
            except Exception:
                logger.debug("Seleção de condição comercial não necessária")

            logger.info("Formulário preenchido com sucesso")

        except Exception as exc:
            logger.error(f"Erro ao preencher formulário BV: {exc}", exc_info=True)
            self.take_screenshot("bv_form_error")
            raise

    def extract_results(self) -> Dict[str, Any]:
        """
        Extrai resultados da simulação do Banco BV.

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
            logger.info("Extraindo resultados da simulação BV")

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
            resultados["bank_code"] = "bv"
            resultados["bank_name"] = "Banco BV"
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
            logger.error(f"Erro ao extrair resultados BV: {exc}", exc_info=True)
            self.take_screenshot("bv_extract_error")
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
    Função principal para executar simulação no Banco BV.
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
    logger.info("Iniciando execução de simulação no Banco BV")

    # Extrair dados
    person_data = dados.get("person", {})
    vehicle_data = dados.get("vehicle", {})
    credentials = dados.get("credentials", {})
    mapeamento = dados.get("mapeamento", {})

    # Criar instância da automação
    automation = BancoBVAutomation(browser, mapeamento)

    # Executar simulação usando o método template da classe base
    resultado = automation.execute_simulation(
        credentials=credentials,
        person_data=person_data,
        vehicle_data=vehicle_data
    )

    logger.info("Simulação BV concluída com sucesso")
    return resultado
