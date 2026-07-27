"""
Adapter Mercado Livre — M079, Fase 5.

O ML é o único grande portal com API pública e OAuth aberto, mas depende de uma
aplicação criada no dev center (TDD §10.1): ML_CLIENT_ID / ML_CLIENT_SECRET.
Enquanto elas não existirem, `disponivel` é False e o portal aparece na grade
desligado — mesmo tratamento honesto dos demais.

A implementação real (criar/atualizar/pausar item em MLB1743) entra na Fase 5,
junto do mapa de atributos obrigatórios (BRAND/MODEL/VEHICLE_YEAR/KILOMETERS),
que é o custo escondido apontado no TDD §8.2. Não há como escrever e validar
isso sem credencial.
"""

import os

from .base import AdapterIndisponivel

ML_CLIENT_ID = os.getenv("ML_CLIENT_ID", "")
ML_CLIENT_SECRET = os.getenv("ML_CLIENT_SECRET", "")


class MercadoLivreAdapter(AdapterIndisponivel):
    nome = "mercadolivre"
    rotulo = "Mercado Livre"
    tipo_auth = "oauth"
    # Vira True na Fase 5, quando o app existir e o adapter for implementado.
    disponivel = False
    motivo = (
        "Integração com o Mercado Livre ainda não liberada — falta criar a aplicação "
        "no dev center do ML. Publique manualmente enquanto isso."
    )


def credenciais_configuradas() -> bool:
    """True quando o app do ML existir nas env vars (painel do Fly)."""
    return bool(ML_CLIENT_ID and ML_CLIENT_SECRET)
