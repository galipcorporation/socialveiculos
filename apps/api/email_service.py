"""
Social Veículos — Envio de e-mail transacional.

Um único ponto de saída para e-mails. Usa Resend via HTTP (httpx, já nas deps)
quando `RESEND_API_KEY` está setado; sem a chave, cai no modo log (dev): imprime
o conteúdo no console em vez de enviar. Assim o fluxo de reset funciona em dev
sem provedor e em prod com o Resend, sem código condicional espalhado.
"""
import logging
from datetime import datetime

import httpx

from config import settings

logger = logging.getLogger("email")

RESEND_ENDPOINT = "https://api.resend.com/emails"


async def enviar_email(*, to: str, subject: str, html: str) -> bool:
    """
    Envia um e-mail. Retorna True se entregue ao provedor (ou logado em dev).
    Nunca levanta exceção para o chamador — falha de e-mail não deve derrubar
    o fluxo de negócio (ex.: forgot-password responde sucesso genérico de qualquer jeito).
    """
    if not settings.resend_api_key:
        logger.warning(
            "[EMAIL] RESEND_API_KEY ausente — modo log (dev). "
            "Para: %s | Assunto: %s\n%s",
            to, subject, html,
        )
        return True

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
        if resp.status_code >= 400:
            logger.error("[EMAIL] Resend falhou (%s): %s", resp.status_code, resp.text)
            return False
        return True
    except Exception:  # noqa: BLE001 — e-mail nunca deve quebrar o fluxo do caller
        logger.exception("[EMAIL] Erro ao enviar via Resend para %s", to)
        return False


def render_reset_senha(*, nome: str, link: str) -> str:
    """HTML simples e sóbrio do e-mail de recuperação de senha."""
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:0 0 16px">Recuperação de senha</h2>
  <p>Olá, {nome}.</p>
  <p>Recebemos um pedido para redefinir a senha da sua conta na <strong>Social Veículos</strong>.
     Clique no botão abaixo para escolher uma nova senha. O link vale por 15 minutos.</p>
  <p style="margin:24px 0">
    <a href="{link}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">
      Redefinir senha
    </a>
  </p>
  <p style="color:#666;font-size:13px">Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
  <p style="color:#999;font-size:12px;word-break:break-all">Ou copie e cole este endereço no navegador:<br>{link}</p>
</div>
"""


def render_aviso_vencimento_assinatura(
    *, loja_nome: str, vencimento: datetime, dias: int, vencida: bool = False
) -> str:
    """HTML do aviso de vencimento de assinatura (D-7 ou já vencida)."""
    data_fmt = vencimento.strftime("%d/%m/%Y")
    if vencida:
        titulo = "Assinatura vencida — acesso suspenso"
        corpo = (
            f"A assinatura da <strong>{loja_nome}</strong> venceu em {data_fmt} e não foi renovada. "
            "O acesso ao sistema foi suspenso até a regularização do pagamento."
        )
    else:
        titulo = f"Assinatura vence em {dias} dia(s)"
        corpo = (
            f"A assinatura da <strong>{loja_nome}</strong> vence em {data_fmt}. "
            "Regularize o pagamento para não perder o acesso ao sistema."
        )
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:0 0 16px">{titulo}</h2>
  <p>{corpo}</p>
  <p style="color:#666;font-size:13px">Em caso de dúvidas sobre o pagamento, entre em contato com o suporte da Social Veículos.</p>
</div>
"""
