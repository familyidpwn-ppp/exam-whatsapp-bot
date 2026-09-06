const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

let clientInstance = null;
let isClientReady = false;
let currentQrCode = null;

function getBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        console.log(`[WhatsApp] Using Linux browser: ${p}`);
        return p;
      }
    }
    return undefined;
  }

  const windowsPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of windowsPaths) {
    if (fs.existsSync(p)) {
      console.log(`[WhatsApp] Using Windows browser: ${p}`);
      return p;
    }
  }
  return undefined;
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
 * Initializes and maintains the WhatsApp Web Client with LocalAuth session persistence
 */
function initWhatsApp(onReadyCallback) {
  if (clientInstance) {
    return clientInstance;
  }

  console.log('[WhatsApp] Initializing WhatsApp Web Client...');
  const browserPath = getBrowserExecutablePath();

  clientInstance = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
      executablePath: browserPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  });

  clientInstance.on('qr', (qr) => {
    currentQrCode = qr;
    console.log('\n======================================================');
    console.log('👉 SCAN THIS QR CODE WITH YOUR WHATSAPP TO LOG IN:');
    console.log('   (WhatsApp > Settings > Linked Devices > Link a Device)');
    console.log('   (Or open /qr on your Render website to scan via browser)');
    console.log('======================================================\n');
    qrcodeTerminal.generate(qr, { small: true });
  });

  clientInstance.on('ready', async () => {
    isClientReady = true;
    currentQrCode = null;
    console.log('\n======================================================');
    console.log('✅ WhatsApp Client is READY and CONNECTED!');
    console.log('======================================================\n');
    if (onReadyCallback) onReadyCallback();
  });

  clientInstance.on('authenticated', () => {
    console.log('[WhatsApp] Authentication successful! Session loaded.');
    currentQrCode = null;
  });

  clientInstance.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authentication failed:', msg);
  });

  clientInstance.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Client was disconnected:', reason);
    isClientReady = false;
    setTimeout(() => {
      console.log('[WhatsApp] Attempting auto-reconnect...');
      clientInstance.initialize();
    }, 10000);
  });

  clientInstance.initialize();
  return clientInstance;
}

/**
 * Sends a message directly to a WhatsApp Channel or Group ID
 */
async function sendToDestination(destinationId, messageText) {
  if (!isClientReady || !clientInstance) {
    console.warn('[WhatsApp] Cannot send: WhatsApp Client is not ready yet.');
    return false;
  }

  try {
    await clientInstance.sendMessage(destinationId, messageText);
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
