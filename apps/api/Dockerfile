FROM python:3.11-slim

# ffmpeg: usado pelo pipeline de áudio; libpq/build p/ deps nativas.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# Usuário non-root para rodar a aplicação (boas práticas de container).
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Instala deps primeiro (cache de camada) — ainda como root.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Código da API.
COPY . .

RUN chmod +x start.sh \
    && chown -R appuser:appuser /app

USER appuser

ENV API_PORT=8000
EXPOSE 8000

CMD ["./start.sh"]
