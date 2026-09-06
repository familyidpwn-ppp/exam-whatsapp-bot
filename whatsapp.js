const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

let sock = null;
let isClientReady = false;
let currentQrCode = null;

const AUTH_DIR = path.join(__dirname, 'baileys_auth');

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Formats a clean, high-visibility WhatsApp update message
 */
function formatMessage(update, channelCategory) {
  const categoryIcon = {
    'Admit Card': '🎫',
    'Result': '🏆',
    'Latest Job': '💼',
    'Answer Key': '🔑',
    'Syllabus': '📚',
    'Exam Notice': '📢'
  }[update.category] || '📢';

  return (
    `*${categoryIcon} NEW ${channelCategory.toUpperCase()} UPDATE!* \n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *Topic:* ${update.title}\n` +
    `🏷️ *Section:* ${update.category || 'General'}\n` +
    `🔗 *Direct Link:* ${update.link}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_⏰ Received at: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}_\n` +
    `_🤖 Auto-alert via Exam Bot_`
  );
}

/**
 * Initializes ultra-lightweight Baileys WhatsApp Client (ZERO Chromium, ~40MB RAM)
 */
async function initWhatsApp(onReadyCallback) {
  if (sock) return sock;

  console.log('[WhatsApp] Initializing ultra-lightweight Baileys Engine (No Browser, <50MB RAM)...');

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v && v.version) version = v.version;
    } catch (e) {
      // Use fallback version if network fetch fails
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Exam Alert Bot', 'Chrome', '124.0.0.0'],
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrCode = qr;
        console.log('\n[WhatsApp] >>> NEW QR CODE READY (SCAN VIA /qr OR TERMINAL) <<<');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        isClientReady = false;
        currentQrCode = null;
        sock = null;

        if (shouldReconnect) {
          setTimeout(() => initWhatsApp(onReadyCallback), 5000);
        }
      } else if (connection === 'open') {
        console.log('\n======================================================');
        console.log('✅ WhatsApp Baileys Client is READY and CONNECTED!');
        console.log('======================================================\n');
        isClientReady = true;
        currentQrCode = null;
        if (onReadyCallback) onReadyCallback();
      }
    });

    return sock;
  } catch (err) {
    console.error('[WhatsApp] Baileys Initialization error:', err.message);
    sock = null;
    setTimeout(() => initWhatsApp(onReadyCallback), 5000);
  }
}

/**
 * Sends a message directly to a WhatsApp Channel or Group ID
 */
async function sendToDestination(destinationId, messageText) {
  if (!isClientReady || !sock) {
    console.warn('[WhatsApp] Cannot send: Client is not ready yet.');
    return false;
  }

  try {
    await sock.sendMessage(destinationId, { text: messageText });
    console.log(`[WhatsApp] 🚀 Successfully dispatched alert to: ${destinationId}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Error sending to ${destinationId}:`, err.message);
    return false;
  }
}

module.exports = {
  initWhatsApp,
  sendToDestination,
  formatMessage,
  isReady: () => isClientReady,
  getCurrentQr: () => currentQrCode
};
