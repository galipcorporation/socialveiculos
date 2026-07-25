"""
Social Veículos — Envio de e-mail transacional.

Um único ponto de saída para e-mails. Usa Resend via HTTP (httpx, já nas deps)
quando `RESEND_API_KEY` está setado; sem a chave, cai no modo log (dev): imprime
o conteúdo no console em vez de enviar. Assim o fluxo de reset funciona em dev
sem provedor e em prod com o Resend, sem código condicional espalhado.
"""
import base64
import logging
from datetime import datetime
from typing import Optional, Sequence, Tuple

import httpx

from config import settings

logger = logging.getLogger("email")

RESEND_ENDPOINT = "https://api.resend.com/emails"

# (nome_do_arquivo, conteúdo) — o Resend recebe o conteúdo em base64.
Anexo = Tuple[str, bytes]


async def enviar_email(
    *,
    to: str,
    subject: str,
    html: str,
    anexos: Optional[Sequence[Anexo]] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Envia um e-mail. Retorna True se entregue ao provedor (ou logado em dev).
    Nunca levanta exceção para o chamador — falha de e-mail não deve derrubar
    o fluxo de negócio (ex.: forgot-password responde sucesso genérico de qualquer jeito).
    """
    if not settings.resend_api_key:
        nomes = ", ".join(n for n, _ in anexos) if anexos else "nenhum"
        logger.warning(
            "[EMAIL] RESEND_API_KEY ausente — modo log (dev). "
            "Para: %s | Assunto: %s | Anexos: %s\n%s",
            to, subject, nomes, html,
        )
        return True

    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    if anexos:
        payload["attachments"] = [
            {"filename": nome, "content": base64.b64encode(conteudo).decode("ascii")}
            for nome, conteudo in anexos
        ]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json=payload,
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


def render_contrato_para_assinatura(
    *, loja_nome: str, versao: str, mensagem: Optional[str] = None
) -> str:
    """HTML do e-mail que leva o contrato B2B em anexo para o lojista assinar."""
    extra = (
        f'<p style="background:#f6f7f9;border-left:3px solid #111;padding:12px 14px;margin:20px 0">{mensagem}</p>'
        if mensagem else ""
    )
    return f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:0 0 16px">Contrato de prestação de serviço</h2>
  <p>Olá, {loja_nome}.</p>
  <p>Segue em anexo o contrato de prestação de serviço da <strong>Social Veículos</strong>
     (versão {versao}), em PDF.</p>
  {extra}
  <p>Para concluir, assine o documento digitalmente (certificado ICP-Brasil ou a plataforma
     de assinatura de sua preferência) e responda a este e-mail anexando o arquivo assinado.</p>
  <p style="color:#666;font-size:13px">Qualquer dúvida sobre as cláusulas, é só responder este e-mail.</p>
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
