#!/bin/sh
set -e

# Roda como root (padrão do container antes deste script). O volume do Fly
# (wa_sessions -> /app/sessions) monta root:root na primeira vez, então
# corrige a permissão aqui antes de derrubar para o usuário non-root.
chown -R appuser:appuser /app/sessions 2>/dev/null || true

exec su -s /bin/sh appuser -c "exec $*"
