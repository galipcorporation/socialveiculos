FROM python:3.11-slim

# ffmpeg: usado pelo pipeline de áudio; libpq/build p/ deps nativas.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps primeiro (cache de camada).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Código da API.
COPY . .

RUN chmod +x start.sh

ENV API_PORT=8000
EXPOSE 8000

CMD ["./start.sh"]
