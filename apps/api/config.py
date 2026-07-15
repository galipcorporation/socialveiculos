"""
Social Veículos — Configuração de ambiente.
Carrega e valida variáveis obrigatórias; falha no boot se faltar algo.
"""

from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field, model_validator



class Settings(BaseSettings):
    # Servidor
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    api_debug: bool = Field(default=False)
    app_env: str = Field(default="development")
    sentry_dsn: Optional[str] = Field(default=None)

    # CORS
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:5174,http://localhost:8081")

    # Vitrine pública — URL base usada no sitemap.xml e canonical/OG
    vitrine_base_url: str = Field(default="http://localhost:5174")

    # Gestor — URL base do front B2B (usada em links de e-mail: reset de senha etc.)
    gestor_base_url: str = Field(default="http://localhost:5173")

    # API — URL pública desta própria API (usada no Sitemap: do robots.txt por site white-label)
    api_base_url: str = Field(default="http://localhost:8000")

    # E-mail transacional (Resend). Sem chave → cai no modo log (dev): imprime o link no console.
    resend_api_key: Optional[str] = Field(default=None)
    email_from: str = Field(default="Social Veículos <onboarding@resend.dev>")

    # Banco
    database_url: str = Field(default="sqlite:///./socialveiculos.db")

    # JWT
    jwt_secret: str = Field(...)
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)

    # Pagamentos — segredo compartilhado para validar webhooks do gateway
    webhook_secret: str = Field(default="troque-webhook-secret-em-producao")

    # SSO — URLs base dos módulos premium (destino do token de troca)
    modulo_contratos_url: str = Field(default="http://localhost:5180")
    modulo_simulador_url: str = Field(default="http://localhost:5181")
    modulo_marketing_url: str = Field(default="http://localhost:5182")

    # Storage (S3 / Local)
    s3_endpoint_url: Optional[str] = Field(default=None)
    s3_access_key: Optional[str] = Field(default=None)
    s3_secret_key: Optional[str] = Field(default=None)
    s3_bucket_name: Optional[str] = Field(default=None)
    s3_region: Optional[str] = Field(default="us-east-1")
    s3_public_url: Optional[str] = Field(default=None)

    # IA — Assistente do Vendedor (Groq: Llama 3.3 70B + Whisper) e voz (ElevenLabs)
    groq_api_key: Optional[str] = Field(default=None)
    elevenlabs_api_key: Optional[str] = Field(default=None)

    # Fiscal — token da conta mestre da plataforma no gateway Focus NFe (M039)
    focus_nfe_master_token: Optional[str] = Field(default=None)
    focus_nfe_webhook_secret: Optional[str] = Field(default=None)

    # Domínio próprio / SSL dos sites white-label (M038, Cloudflare for SaaS)
    # Criar em https://dash.cloudflare.com → adicionar a zona socialveiculos.com.br,
    # ativar "SSL for SaaS" e gerar um API Token com permissões:
    #   Zone > SSL and Certificates > Edit  +  Zone > Custom Hostnames > Edit (na zona da plataforma).
    cloudflare_api_token: Optional[str] = Field(default=None)
    cloudflare_zone_id: Optional[str] = Field(default=None)
    # Hostname de fallback para onde os domínios dos clientes apontam (CNAME alvo).
    # Normalmente o próprio host do app público (apps/site) atrás do Cloudflare.
    cloudflare_fallback_origin: str = Field(default="sites.socialveiculos.com.br")

    # Login social Google (M029) — criar em https://console.cloud.google.com/apis/credentials
    google_client_id: Optional[str] = Field(default=None)
    google_client_secret: Optional[str] = Field(default=None)
    google_redirect_uri: str = Field(default="http://localhost:8000/v1/auth/google/callback")

    @property
    def modulo_urls(self) -> dict[str, str]:
        return {
            "contratos": self.modulo_contratos_url,
            "simulador": self.modulo_simulador_url,
            "marketing": self.modulo_marketing_url,
        }

    @model_validator(mode="after")
    def validate_secure_jwt_secret(self) -> 'Settings':
        if not self.api_debug and (not self.jwt_secret or self.jwt_secret == "troque-esta-chave-em-producao"):
            raise ValueError("JWT_SECRET é obrigatório e deve ser alterado em produção (quando api_debug=False).")
        # RFC 7518 §3.2 exige chave >= tamanho do hash para HMAC (HS256 = 32 bytes).
        if not self.api_debug and len(self.jwt_secret.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET deve ter no mínimo 32 bytes em produção (quando api_debug=False).")
        if not self.api_debug and (not self.webhook_secret or self.webhook_secret == "troque-webhook-secret-em-producao"):
            raise ValueError("WEBHOOK_SECRET é obrigatório e deve ser alterado em produção (quando api_debug=False).")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
