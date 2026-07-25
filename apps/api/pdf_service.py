"""
Social Veículos — Conversão de HTML para PDF.

Um único ponto de saída para gerar PDF. Usa xhtml2pdf (puro Python, sem libs
nativas — roda igual no Windows do dev e no container do Fly). O import é lazy
para que a ausência da lib nunca derrube o boot da API: quem chama decide se
cai no HTML de impressão do navegador.

Limite conhecido do xhtml2pdf: suporta um subconjunto de CSS (sem flex/grid).
Os HTMLs de contrato usam tabela e blocos simples, que é o que ele renderiza bem.
"""
import io
import logging
import re
from typing import Optional

logger = logging.getLogger("pdf")

# Fontes com acentuação garantida; o padrão do reportlab (Helvetica) já cobre
# latin-1, que basta para pt-BR.
_CSS_IMPRESSAO = """
@page { size: A4 portrait; margin: 2cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
h1 { font-size: 15pt; text-align: center; }
h2 { font-size: 13pt; border-bottom: 1px solid #cccccc; padding-bottom: 3pt; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 4pt 6pt; vertical-align: top; }
img { max-width: 100%; }
"""


def pdf_disponivel() -> bool:
    """True se a conversão para PDF pode ser feita neste ambiente."""
    try:
        import xhtml2pdf  # noqa: F401
    except ImportError:
        return False
    return True


def _preparar_html(html: str) -> str:
    """Garante charset e injeta o CSS de impressão (A4, margens, fonte)."""
    estilo = f"<style>{_CSS_IMPRESSAO}</style>"
    meta = '<meta charset="utf-8">'

    if "<head" in html.lower():
        # Injeta logo após o <head ...> existente, preservando o CSS do documento.
        return re.sub(r"(<head[^>]*>)", r"\1" + meta + estilo, html, count=1, flags=re.IGNORECASE)
    if "<html" in html.lower():
        return re.sub(r"(<html[^>]*>)", r"\1<head>" + meta + estilo + "</head>", html, count=1, flags=re.IGNORECASE)
    return f"<html><head>{meta}{estilo}</head><body>{html}</body></html>"


def html_para_pdf(html: str) -> Optional[bytes]:
    """Converte HTML em PDF. Devolve None se a lib não estiver disponível ou
    a renderização falhar — o chamador cai no HTML para impressão do navegador."""
    try:
        from xhtml2pdf import pisa
    except ImportError:
        logger.warning("[PDF] xhtml2pdf não instalado — caindo no HTML de impressão.")
        return None

    buffer = io.BytesIO()
    try:
        status = pisa.CreatePDF(io.StringIO(_preparar_html(html)), dest=buffer, encoding="utf-8")
    except Exception:  # noqa: BLE001 — nunca derrubar o fluxo por causa do PDF
        logger.exception("[PDF] Erro ao renderizar o PDF.")
        return None

    if status.err:
        logger.error("[PDF] xhtml2pdf terminou com %s erro(s).", status.err)
        return None

    dados = buffer.getvalue()
    return dados or None
