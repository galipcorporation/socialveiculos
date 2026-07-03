#!/usr/bin/env sh
set -e

# Aplica migrations no banco de produção (Postgres/Supabase) antes de subir.
# NUNCA usa create_all em prod — main.py já gateia isso por api_debug.
echo "[start] Rodando migrations (alembic upgrade head)..."
python -m alembic upgrade head

echo "[start] Iniciando Uvicorn na porta ${API_PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${API_PORT:-8000}"
