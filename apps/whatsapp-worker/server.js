import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import qrcode from 'qrcode';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8090;
const FASTAPI_WEBHOOK_URL = process.env.FASTAPI_WEBHOOK_URL || 'http://localhost:8000/v1/assistente/webhook';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'whatsapp-worker-secret-token';
const MOCK_WHATSAPP = process.env.MOCK_WHATSAPP !== 'false'; // default true em dev

// Memória das sessões ativas
const sessions = new Map();

// Middleware de autenticação
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Nao autorizado. Token invalido.' });
  }
  next();
}

console.log(`[INFO] WhatsApp Worker iniciado. Modo Mock: ${MOCK_WHATSAPP}`);

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
    // Para simplificar a inicialização rápida em dev, o Baileys seria instanciado aqui.
    // Em produção o fluxo usará o pacote @whiskeysockets/baileys.
    // Definimos um stub de conexão que simula caso o Baileys não esteja instalado, mas usando Baileys se disponível.
    try {
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
      const { state, saveCreds } = await useMultiFileAuthState(`./sessions/auth_info_${usuario_id}`);
      
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
      });

      session.sock = sock;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          session.qr = await qrcode.toDataURL(qr);
          session.status = 'connecting';
        }
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log(`[BAILEY] Conexao fechada para ${usuario_id}. Motivo: ${lastDisconnect?.error}. Reconectando: ${shouldReconnect}`);
          session.status = 'disconnected';
          session.qr = null;
          await notifyWebhook({ event: 'connection', usuario_id, status: 'disconnected' });
          
          if (shouldReconnect) {
            sessions.delete(usuario_id);
            // Auto reconectar
          } else {
            sessions.delete(usuario_id);
          }
        } else if (connection === 'open') {
          console.log(`[BAILEY] Conexao aberta com sucesso para ${usuario_id}`);
          session.status = 'connected';
          session.qr = null;
          await notifyWebhook({ event: 'connection', usuario_id, status: 'connected' });
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

    } catch (err) {
      console.error('[BAILEY ERROR] Falha ao instanciar Baileys. Alternando para modo simulador local.', err);
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
    try { s.sock.end(); } catch (e) {}
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

  console.log(`[SEND] Enviando mensagem de ${usuario_id} para ${contato_jid}: ${conteudo}`);

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

app.listen(PORT, () => {
  console.log(`[INFO] Servidor WhatsApp Worker ouvindo na porta ${PORT}`);
});
