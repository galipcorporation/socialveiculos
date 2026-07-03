FROM node:20-slim

# ffmpeg do sistema como garantia (além do ffmpeg-static empacotado).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps a partir do package.json local (sem workspace pnpm no container).
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY server.js ./

# Sessões do Baileys persistem aqui — no Fly montar um volume neste caminho.
RUN mkdir -p /app/sessions
ENV PORT=8090
EXPOSE 8090

CMD ["node", "server.js"]
