# Como Rodar com Docker 🐳

Este projeto está totalmente dockerizado, permitindo que você suba todo o ambiente (Backend FastAPI + WhatsApp Worker + Frontends Gestor, Vitrine e Admin) com apenas um comando, sem precisar de Node.js, Python ou pnpm instalados localmente.

---

## Requisitos

- **Docker** instalado.
- **Docker Compose** (integrado ao Docker Desktop moderno).

---

## Como Iniciar

1. Certifique-se de que o arquivo `.env` do backend existe em `apps/api/.env`. Se não existir, crie-o a partir do exemplo:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

2. Inicialize todos os serviços rodando o comando na raiz do projeto:
   ```bash
   docker compose up --build
   ```

3. Uma vez carregado, as seguintes portas estarão disponíveis na sua máquina:
   - **Vitrine Pública B2C**: [http://localhost:5174](http://localhost:5174)
   - **Painel B2B (Gestor)**: [http://localhost:5173](http://localhost:5173)
   - **Painel Admin (Owner)**: [http://localhost:5175](http://localhost:5175)
   - **Backend API (Docs)**: [http://localhost:8000/v1/docs](http://localhost:8000/v1/docs)
   - **WhatsApp Worker**: [http://localhost:8090](http://localhost:8090)

---

## Detalhes da Configuração Docker

- **Banco de Dados (SQLite)**: O banco `socialveiculos.db` é persistido a partir de um volume apontando para `apps/api/socialveiculos.db`.
- **Sessões do WhatsApp**: Os arquivos de conexão do Baileys ficam salvos e persistidos em `apps/whatsapp-worker/sessions`.
- **Roteamento SPA & API Proxy**: Cada frontend possui um contêiner Nginx ultraleve configurado para servir a aplicação React e encaminhar as chamadas `/v1` e `/static` de forma transparente para o contêiner do backend FastAPI (`api:8000`).
