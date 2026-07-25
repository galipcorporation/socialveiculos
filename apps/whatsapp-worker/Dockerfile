FROM node:20-slim

# ffmpeg do sistema como garantia (além do ffmpeg-static empacotado).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Usuário non-root para rodar a aplicação (boas práticas de container).
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Redirecionar dependências do GitHub que usam SSH para HTTPS pública (sem necessidade de chaves SSH)
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

# Instala deps a partir do package.json local (sem workspace pnpm no container) — ainda como root.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY server.js ./

# Sessões do Baileys persistem aqui — no Fly montar um volume neste caminho.
RUN mkdir -p /app/sessions \
    && chown -R appuser:appuser /app

# Volumes do Fly montam como root:root na primeira vez (mesmo com o chown acima
# em build-time, o mount em runtime sobrepõe o dono do diretório). O entrypoint
# roda como root só para corrigir a permissão do volume montado, depois derruba
# para appuser antes de exec'ar o Node — sem isso o Baileys não consegue
# persistir a sessão e o pareamento do WhatsApp quebra a cada restart.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=8090
EXPOSE 8090

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
