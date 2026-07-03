# Social Veículos — Áudio com voz do vendedor + Deploy no ar

**Data:** 2026-07-03
**Objetivo:** (1) Fazer a IA responder o lead no WhatsApp por **áudio com a voz clonada do vendedor** (modo Copiloto — vendedor aprova antes de enviar). (2) Colocar a plataforma **no ar** (Fly.io + Vercel + Supabase + R2).

---

## Estado atual (o que já existe)

- **Motor** (`apps/api/assistente/motor.py`): já tem `transcrever_audio_vendedor` (Whisper), `clonar_voz_vendedor` (ElevenLabs `/voices/add`), `sintetizar_voz_resposta` (ElevenLabs TTS → MP3), `gerar_resposta_ia` (Claude) e `processar_mensagem_recebida`.
- **Router** (`apps/api/routers/assistente.py`): sessão/QR, config (tom + consentimento LGPD + `voz_id`), upload de áudio de treino, conversas, mensagens (texto), autonomia, webhook.
- **Worker** (`apps/whatsapp-worker/server.js`): Baileys real + mock. Envia **só texto** (`/messages/send`).
- **Front gestor** (`apps/gestor/src/pages/AssistenteIA.tsx`): chat, QR, painel de sugestão da IA (Copiloto), modal de config com upload de áudio e consentimento. `Mensagem` já tem `midia_url`/`midia_tipo`.
- **Storage** (`apps/api/storage.py`): provider S3/R2 ou local; whitelist de content-type **só imagem/vídeo/pdf** (falta áudio).
- **Git**: repo com remote `github.com/galipcorporation/socialveiculos`. **Deploy: 0%** — sem Dockerfile, fly.toml, vercel.json.

## Lacuna (o que falta para o áudio funcionar ponta-a-ponta)

1. Ninguém chama `sintetizar_voz_resposta` → resposta da IA nunca vira áudio.
2. Worker não sabe enviar áudio como nota de voz (PTT) pelo Baileys.
3. Não há rota que: pegar texto → sintetizar voz → subir no storage → mandar pro worker → salvar mensagem com mídia.
4. Front não tem botão "Enviar como áudio" nem player na timeline.

---

## Frente 1 — Áudio com voz clonada (Copiloto)

### A. Worker Node — `POST /messages/send-audio`
- Body: `{ usuario_id, contato_jid, audio_base64, mimetype? }`.
- Baileys exige **OGG/Opus** para virar nota de voz. ElevenLabs entrega MP3 → converter com **ffmpeg** (`-c:a libopus -f ogg`) antes de enviar.
- Envio real: `sock.sendMessage(jid, { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' })`.
- Mock: devolve sucesso + ecoa webhook `fromMe:true` (igual `/messages/send`).
- ffmpeg via `fluent-ffmpeg` + `ffmpeg-static` (binário empacotado, sem depender do SO em dev). Em prod o Dockerfile também instala ffmpeg do sistema como garantia.

### B. Backend — `POST /v1/assistente/conversas/{id}/mensagens/audio`
- Body: `{ conteudo }` (texto a ser falado — a sugestão da IA, possivelmente editada).
- Carrega `AssistenteConfig` do vendedor. Se **sem `voz_id`** ou **sem `ELEVENLABS_API_KEY`** → HTTP 422 com mensagem clara ("Configure e treine sua voz nas Configurações da IA antes de enviar áudios."). Não quebra.
- `sintetizar_voz_resposta(conteudo, voz_id)` → bytes MP3. Se vazio → 422.
- Sobe MP3 via `storage_provider.upload_file(bytes, "resposta.mp3", "audio/mpeg")` → `midia_url`. (Requer adicionar `audio/mpeg`/`audio/ogg` na whitelist do storage.)
- Chama worker `/messages/send-audio` com o MP3 em base64.
- Salva `MensagemWhatsapp(autor_tipo="vendedor", conteudo=<texto>, midia_url, midia_tipo="audio", enviada_ia=False)`.
- Limpa `sugestao_ia` da última mensagem do lead (igual envio de texto).
- Mesma validação de propriedade da conversa (loja_id + usuario_id) das rotas existentes.

### C. Front gestor — botão "Enviar como áudio" + player
- No painel de sugestão da IA (Copiloto), adicionar botão **"🎙️ Enviar como áudio"** ao lado de "Enviar direto".
  - Chama `POST /conversas/{id}/mensagens/audio { conteudo: sugestao }`.
  - Em 422 → toast orientando treinar a voz + abrir modal de config.
- Na timeline, quando `midia_tipo === 'audio'` → renderizar `<audio controls src={midia_url}>` além do texto (transcrição do que foi falado).
- URL da mídia: local (`/static/...`) resolve via base da API; R2 já é absoluta.

### Fallback para a demo
- Sem chave ElevenLabs → 422 explicativo (não erro genérico). Com voz treinada e chave → funciona de verdade.

---

## Frente 2 — Deploy no ar

**Contas externas (usuário cria, Claude guia):** Supabase (Postgres), Cloudflare R2, Resend, ElevenLabs, OpenAI, Anthropic, Fly.io, Vercel.

1. **Dockerfile `apps/api`**: Python + deps + **ffmpeg** (não estritamente necessário na API, mas útil) + `alembic upgrade head` no start.
2. **Dockerfile `apps/whatsapp-worker`**: Node + **ffmpeg** + volume `/app/sessions` (Baileys).
3. **fly.toml** para os dois apps; volume Fly montado em `sessions/` do worker.
4. **Migrations**: `alembic upgrade head` no Postgres (nunca `create_all` em prod — `main.py` já gateia por `api_debug`). Rodar `seed.py` uma vez.
5. **Vercel**: build dos fronts (gestor, vitrine) + `vercel.json` com rewrites `/v1/*` e `/static/*` → backend Fly.
6. **Secrets**: no Fly (`fly secrets set`) todas as chaves + `JWT_SECRET` (openssl rand -hex 32) + `WEBHOOK_SECRET` + `CORS_ORIGINS`/`VITRINE_BASE_URL`/`GESTOR_BASE_URL` com domínios reais + `DATABASE_URL` Supabase + R2 + `WHATSAPP_WORKER_URL` (URL interna Fly). No worker: `FASTAPI_WEBHOOK_URL`, `SERVICE_TOKEN`, `MOCK_WHATSAPP=false`.

---

## Ordem de execução
1. Frente 1 completa (worker → backend → front) e validada local.
2. Frente 2 (arquivos de deploy + guia de contas + secrets + subir).

## Não-objetivos (hoje)
- Modo Automático enviando áudio sozinho (fica só texto no automático; áudio é Copiloto).
- App mobile.
- Fila/retry robusto de síntese (chamada síncrona é suficiente para o volume de 1 cidade).
