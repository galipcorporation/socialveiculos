import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import qrcode from 'qrcode';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { PassThrough, Readable } from 'stream';

dotenv.config();

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

// Converte um Buffer de áudio (MP3/qualquer) para OGG/Opus, formato que o
// WhatsApp reconhece como nota de voz (PTT). Resolve com o Buffer convertido.
function convertToOpus(inputBuffer) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks = [];
    output.on('data', (c) => chunks.push(c));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);

    ffmpeg(Readable.from(inputBuffer))
      .audioCodec('libopus')
      .audioChannels(1)
      .audioBitrate('48k')
      .format('ogg')
      .on('error', reject)
      .pipe(output, { end: true });
  });
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8090;
const FASTAPI_WEBHOOK_URL = process.env.FASTAPI_WEBHOOK_URL || 'http://localhost:8000/v1/assistente/webhook';
const NODE_ENV = process.env.NODE_ENV || 'development';
const MOCK_WHATSAPP = process.env.MOCK_WHATSAPP !== 'false'; // default true em dev

// SERVICE_TOKEN: sem default hardcoded. Em produção (ou fora de mock) a env
// var é obrigatória — sem ela, qualquer um que conheça o valor previsível
// antigo autenticaria no worker. Em dev/mock seguimos rodando com um token
// gerado localmente (não previsível de fora) e um aviso bem visível, pra não
// travar quem está só testando localmente sem configurar nada.
let SERVICE_TOKEN = process.env.SERVICE_TOKEN;
if (!SERVICE_TOKEN) {
  if (NODE_ENV === 'production' || !MOCK_WHATSAPP) {
    console.error('[ERRO FATAL] SERVICE_TOKEN nao definido - defina a env var antes de subir em producao (fly secrets set SERVICE_TOKEN=...).');
  } else {
    SERVICE_TOKEN = `dev-only-${Math.random().toString(36).slice(2)}${Date.now()}`;
    console.warn('=============================================================');
    console.warn('[AVISO] SERVICE_TOKEN nao definido. Usando token temporario de DEV.');
    console.warn('        NUNCA use este modo em producao. Defina SERVICE_TOKEN.');
    console.warn('=============================================================');
  }
}

// Memória das sessões ativas
const sessions = new Map();

// Controle de reconexão (backoff por usuario_id)
const RECONNECT_DELAYS = [3000, 10000, 30000, 60000]; // cap em 60s
const reconnectAttempts = new Map();

function mascararTelefone(jidOuNumero) {
  if (!jidOuNumero) return '(sem numero)';
  const digitos = String(jidOuNumero).replace(/\D/g, '');
  if (digitos.length <= 4) return '****';
  return `****${digitos.slice(-4)}`;
}

function previewMensagem(texto) {
  if (!texto) return '(vazio)';
  const t = String(texto);
  return t.length > 20 ? `${t.slice(0, 20)}... (${t.length} chars)` : `${t} (${t.length} chars)`;
}

// Middleware de autenticação
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Nao autorizado. Token invalido.' });
  }
  next();
}

console.log(`[INFO] WhatsApp Worker iniciado. Modo Mock: ${MOCK_WHATSAPP}`);

// Inicia (ou reconecta) a sessão real via Baileys para um usuario_id.
// Extraída para função própria para que a reconexão automática (após queda
// de conexão) possa rechamar exatamente a mesma lógica de criação de sessão,
// em vez de só apagar a sessão do Map e nunca mais tentar de novo.
async function iniciarSessaoBaileys(usuario_id, session) {
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/auth_info_${usuario_id}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  session.sock = sock;

  // Aguarda o primeiro QR (ou conexão via credenciais salvas) antes de responder,
  // pra evitar que o front receba qr:null no primeiro request e precise esperar o próximo poll.
  const primeiroEvento = new Promise((resolve) => {
    session._resolvePrimeiroEvento = resolve;
    setTimeout(resolve, 8000); // não trava a request indefinidamente
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      session.qr = await qrcode.toDataURL(qr);
      session.status = 'connecting';
      if (session._resolvePrimeiroEvento) { session._resolvePrimeiroEvento(); session._resolvePrimeiroEvento = null; }
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[BAILEY] Conexao fechada para ${usuario_id}. Motivo: ${lastDisconnect?.error?.message || lastDisconnect?.error}. Reconectando: ${shouldReconnect}`);
      session.status = 'disconnected';
      session.qr = null;
      await notifyWebhook({ event: 'connection', usuario_id, status: 'disconnected' });

      if (shouldReconnect) {
        agendarReconexao(usuario_id);
      } else {
        // loggedOut de verdade (usuário desconectou pelo celular) — não adianta retentar.
        reconnectAttempts.delete(usuario_id);
        sessions.delete(usuario_id);
      }
    } else if (connection === 'open') {
      console.log(`[BAILEY] Conexao aberta com sucesso para ${usuario_id}`);
      session.status = 'connected';
      session.qr = null;
      reconnectAttempts.delete(usuario_id); // reseta o contador de backoff ao conectar
      if (session._resolvePrimeiroEvento) { session._resolvePrimeiroEvento(); session._resolvePrimeiroEvento = null; }
      const numeroPareado = sock.user?.id ? sock.user.id.split(':')[0] : null;
      await notifyWebhook({ event: 'connection', usuario_id, status: 'connected', numero_pareado: numeroPareado });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && msg.message) {
          const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
          if (body) {
            await notifyWebhook({
              event: 'message',
              usuario_id,
              message: {
                id: msg.key.id,
                from: msg.key.remoteJid,
                fromMe: false,
                body: body,
                timestamp: msg.messageTimestamp,
                authorName: msg.pushName || 'Contato WhatsApp'
              }
            });
          }
        }
      }
    }
  });

  await primeiroEvento;
}

// Reconexão real com backoff (3s, 10s, 30s, 60s cap), contador por usuario_id.
// Evita loop infinito sem delay: cada tentativa espera mais que a anterior,
// e o contador só reseta quando a conexão abre de verdade (connection === 'open').
function agendarReconexao(usuario_id) {
  sessions.delete(usuario_id);

  const tentativa = reconnectAttempts.get(usuario_id) || 0;
  const delay = RECONNECT_DELAYS[Math.min(tentativa, RECONNECT_DELAYS.length - 1)];
  reconnectAttempts.set(usuario_id, tentativa + 1);

  console.log(`[BAILEY] Reagendando reconexao para ${usuario_id} em ${delay}ms (tentativa ${tentativa + 1}).`);

  setTimeout(async () => {
    // Se alguém já iniciou uma sessão nova manualmente (ex.: /session/start) nesse meio tempo, não duplica.
    if (sessions.has(usuario_id)) return;

    const session = {
      usuario_id,
      status: 'connecting',
      qr: null,
      mockInterval: null
    };
    sessions.set(usuario_id, session);

    try {
      await iniciarSessaoBaileys(usuario_id, session);
    } catch (err) {
      console.error(`[BAILEY ERROR] Falha ao reconectar sessao de ${usuario_id}.`, err);
      session.status = 'disconnected';
      agendarReconexao(usuario_id);
    }
  }, delay);
}

// Inicia sessão
app.post('/session/start', authenticate, async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) {
    return res.status(400).json({ error: 'usuario_id obrigatorio' });
  }

  console.log(`[SESSION] Iniciando conexao para o usuario ${usuario_id}`);

  if (sessions.has(usuario_id)) {
    const s = sessions.get(usuario_id);
    return res.json({ status: s.status, qr: s.qr });
  }

  // Nova tentativa manual: zera o backoff de reconexão automática.
  reconnectAttempts.delete(usuario_id);

  // Criar estado da sessão
  const session = {
    usuario_id,
    status: 'connecting',
    qr: null,
    mockInterval: null
  };
  sessions.set(usuario_id, session);

  if (MOCK_WHATSAPP) {
    // Modo Simulado (Mock)
    console.log(`[MOCK] Gerando QR Code simulado para o usuario ${usuario_id}`);

    // Gerar um QR code mockup
    const mockQrContent = `https://wa.me/qr/mock-socialveiculos-${usuario_id}-${Date.now()}`;
    const qrDataUrl = await qrcode.toDataURL(mockQrContent);
    session.qr = qrDataUrl;

    // Simula a escaneada do QR Code após 12 segundos e muda status para conectado
    setTimeout(async () => {
      if (sessions.has(usuario_id) && sessions.get(usuario_id).status === 'connecting') {
        const s = sessions.get(usuario_id);
        s.status = 'connected';
        s.qr = null;
        console.log(`[MOCK] Sessao ${usuario_id} CONECTADA com sucesso!`);

        // Notificar webhook de status
        await notifyWebhook({
          event: 'connection',
          usuario_id,
          status: 'connected'
        });

        // Simular o recebimento de uma mensagem de lead teste após 8 segundos
        setTimeout(async () => {
          if (s.status === 'connected') {
            await notifyWebhook({
              event: 'message',
              usuario_id,
              message: {
                id: `mock-msg-${Date.now()}`,
                from: '5511999998888@c.us',
                fromMe: false,
                body: 'Olá! Vi o Corolla XEI 2024 na vitrine de vocês e gostaria de saber se aceitam proposta.',
                timestamp: Math.floor(Date.now() / 1000),
                authorName: 'Thiago Souza'
              }
            });
          }
        }, 8000);
      }
    }, 12000);

  } else {
    // Lógica real do Baileys
    try {
      await iniciarSessaoBaileys(usuario_id, session);
    } catch (err) {
      console.error('[BAILEY ERROR] Falha ao instanciar sessao Baileys.', err);
      session.status = 'disconnected';
    }
  }

  res.json({ status: session.status, qr: session.qr });
});

// Desconecta sessão
app.post('/session/stop', authenticate, (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id || !sessions.has(usuario_id)) {
    return res.status(404).json({ error: 'Sessao nao encontrada' });
  }

  console.log(`[SESSION] Encerrando conexao do usuario ${usuario_id}`);
  const s = sessions.get(usuario_id);
  s.status = 'disconnected';
  if (s.sock) {
    try { s.sock.end(); } catch { /* ignora */ }
  }
  sessions.delete(usuario_id);

  res.json({ status: 'disconnected' });
});

// Retorna status
app.get('/session/status/:usuario_id', authenticate, (req, res) => {
  const { usuario_id } = req.params;
  if (!sessions.has(usuario_id)) {
    return res.json({ status: 'disconnected', qr: null });
  }
  const s = sessions.get(usuario_id);
  res.json({ status: s.status, qr: s.qr });
});

// Envia mensagem
app.post('/messages/send', authenticate, async (req, res) => {
  const { usuario_id, contato_jid, conteudo } = req.body;
  if (!usuario_id || !contato_jid || !conteudo) {
    return res.status(400).json({ error: 'usuario_id, contato_jid e conteudo sao obrigatorios' });
  }

  console.log(`[SEND] Enviando mensagem de ${usuario_id} para ${mascararTelefone(contato_jid)}: ${previewMensagem(conteudo)}`);

  if (MOCK_WHATSAPP) {
    // Modo mock: apenas devolve sucesso e simula o eco no webhook após 1 segundo
    setTimeout(async () => {
      // Notifica o backend de que o próprio vendedor enviou a mensagem (para atualizar a conversa na UI)
      await notifyWebhook({
        event: 'message',
        usuario_id,
        message: {
          id: `mock-send-${Date.now()}`,
          from: contato_jid,
          fromMe: true,
          body: conteudo,
          timestamp: Math.floor(Date.now() / 1000),
          authorName: 'Vendedor'
        }
      });

      // Se o lead receber uma resposta, simular uma tréplica após 6 segundos para testar o bot de IA
      if (!conteudo.includes('[BOT]')) {
        setTimeout(async () => {
          await notifyWebhook({
            event: 'message',
            usuario_id,
            message: {
              id: `mock-reply-${Date.now()}`,
              from: contato_jid,
              fromMe: false,
              body: 'Entendido. E em relação à taxa de financiamento?',
              timestamp: Math.floor(Date.now() / 1000),
              authorName: 'Thiago Souza'
            }
          });
        }, 6000);
      }

    }, 1000);

    return res.json({ success: true, messageId: `mock-send-${Date.now()}` });
  }

  // Caso real Baileys
  if (!sessions.has(usuario_id)) {
    return res.status(400).json({ error: 'Sessao desconectada' });
  }

  const s = sessions.get(usuario_id);
  if (s.status !== 'connected' || !s.sock) {
    return res.status(400).json({ error: 'WhatsApp nao conectado' });
  }

  try {
    const sent = await s.sock.sendMessage(contato_jid, { text: conteudo });
    res.json({ success: true, messageId: sent.key.id });
  } catch (err) {
    console.error('[BAILEY SEND ERROR]', err);
    res.status(500).json({ error: 'Falha ao enviar mensagem pelo WhatsApp' });
  }
});

// Envia áudio como nota de voz (PTT)
app.post('/messages/send-audio', authenticate, async (req, res) => {
  const { usuario_id, contato_jid, audio_base64, transcricao } = req.body;
  if (!usuario_id || !contato_jid || !audio_base64) {
    return res.status(400).json({ error: 'usuario_id, contato_jid e audio_base64 sao obrigatorios' });
  }

  console.log(`[SEND-AUDIO] Enviando audio de ${usuario_id} para ${mascararTelefone(contato_jid)}`);

  if (MOCK_WHATSAPP) {
    setTimeout(async () => {
      await notifyWebhook({
        event: 'message',
        usuario_id,
        message: {
          id: `mock-audio-${Date.now()}`,
          from: contato_jid,
          fromMe: true,
          body: transcricao || '[audio]',
          timestamp: Math.floor(Date.now() / 1000),
          authorName: 'Vendedor'
        }
      });
    }, 1000);
    return res.json({ success: true, messageId: `mock-audio-${Date.now()}` });
  }

  // Caso real Baileys
  if (!sessions.has(usuario_id)) {
    return res.status(400).json({ error: 'Sessao desconectada' });
  }
  const s = sessions.get(usuario_id);
  if (s.status !== 'connected' || !s.sock) {
    return res.status(400).json({ error: 'WhatsApp nao conectado' });
  }

  try {
    const inputBuffer = Buffer.from(audio_base64, 'base64');
    const oggBuffer = await convertToOpus(inputBuffer);
    const sent = await s.sock.sendMessage(contato_jid, {
      audio: oggBuffer,
      ptt: true,
      mimetype: 'audio/ogg; codecs=opus'
    });
    res.json({ success: true, messageId: sent.key.id });
  } catch (err) {
    console.error('[BAILEY SEND-AUDIO ERROR]', err);
    res.status(500).json({ error: 'Falha ao enviar audio pelo WhatsApp' });
  }
});

// Envia Webhook de volta para o FastAPI
async function notifyWebhook(payload) {
  try {
    const response = await fetch(FASTAPI_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error(`[WEBHOOK ERROR] FastAPI retornou status ${response.status}`);
    }
  } catch (err) {
    console.error('[WEBHOOK ERROR] Nao foi possivel conectar ao FastAPI', err.message);
  }
}

const server = app.listen(PORT, () => {
  console.log(`[INFO] Servidor WhatsApp Worker ouvindo na porta ${PORT}`);
});

// Graceful shutdown: o Fly.io manda SIGTERM antes de matar o processo em todo
// deploy/restart. Sem tratar o sinal, o Node morre na hora — conexões Baileys
// abertas ficam penduradas (o WhatsApp só percebe a queda depois de um timeout
// próprio) e uma requisição em voo (ex.: messages/send demorado) é cortada no
// meio. SIGINT também é tratado para permitir Ctrl+C limpo em dev.
const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[SHUTDOWN] Sinal ${signal} recebido. Iniciando desligamento gracioso (timeout ${SHUTDOWN_TIMEOUT_MS}ms)...`);

  // Força o exit se o shutdown gracioso demorar demais — não pode travar o
  // restart do Fly indefinidamente.
  const forceTimer = setTimeout(() => {
    console.error('[SHUTDOWN] Timeout excedido. Forcando encerramento do processo.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  // Para de aceitar novas conexões HTTP; requisições em curso continuam até terminar.
  await new Promise((resolve) => {
    server.close((err) => {
      if (err) console.error('[SHUTDOWN] Erro ao fechar servidor HTTP.', err);
      else console.log('[SHUTDOWN] Servidor HTTP fechado (novas conexoes recusadas).');
      resolve();
    });
  });

  // Encerra todas as sessoes Baileys ativas, uma a uma.
  for (const [usuario_id, session] of sessions.entries()) {
    if (session?.sock) {
      try {
        console.log(`[SHUTDOWN] Encerrando sessao Baileys de ${usuario_id}...`);
        session.sock.end(new Error('Worker desligando (SIGTERM/SIGINT)'));
      } catch (err) {
        console.error(`[SHUTDOWN] Erro ao encerrar sessao de ${usuario_id}.`, err);
      }
    }
  }
  sessions.clear();

  clearTimeout(forceTimer);
  console.log('[SHUTDOWN] Desligamento gracioso concluido.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
