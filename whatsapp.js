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

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Rich, High-Visibility WhatsApp Message Formatter for all exam categories
 */
function formatMessage(update, channelCategory, inviteUrl) {
  const cat = update.category || 'Exam Notice';
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const joinFooter = inviteUrl ? (
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📢 *हमारे WhatsApp चैनल से जुड़ें:*\n` +
    `👉 ${inviteUrl}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_📢 अपने दोस्तों और ग्रुप्स में तुरंत शेयर करें!_`
  ) : (
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_📢 सबसे पहले अपडेट के लिए चैनल से जुड़े रहें!_`
  );

  // 1. Admit Card & Exam City Slip
  if (cat.includes('Admit Card') || cat.includes('City')) {
    return (
      `🎫 *ADMIT CARD OUT: एडमिट कार्ड जारी!* 🎫\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *परीक्षा:* *${update.title}*\n\n` +
      `🗓️ *अपडेट स्थिति:* \n` +
      `  ├ 📍 *Status:* एडमिट कार्ड / एग्जाम सिटी लिंक एक्टिव\n` +
      `  └ ⏰ *समय:* ${timeStr}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डाउनलोड लिंक्स:* \n` +
      `  👉 *डायरेक्ट डाउनलोड करें:* ${update.link}\n` +
      `_⚠️ परीक्षा केंद्र पर समय से पहुँचना और ऑरिजिनल ID ले जाना अनिवार्य है!_` +
      joinFooter
    );
  }

  // 2. Exam Result & Cutoff
  if (cat.includes('Result') || cat.includes('Cutoff') || cat.includes('Merit')) {
    return (
      `🏆 *RESULT DECLARED: परीक्षा परिणाम जारी!* 🏆\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *परीक्षा:* *${update.title}*\n\n` +
      `📊 *अपडेट विवरण:*\n` +
      `  ├ 🟢 *Status:* परिणाम / कट-ऑफ मार्क्स जारी\n` +
      `  └ ⏰ *घोषित समय:* ${timeStr}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *चेक करने के लिए लिंक्स:* \n` +
      `  👉 *अपना रिजल्ट / मेरिट लिस्ट देखें:* ${update.link}\n` +
      `_🎉 सभी सफल अभ्यर्थियों को हार्दिक बधाई एवं शुभकामनाएँ!_` +
      joinFooter
    );
  }

  // 3. Answer Key & Objections
  if (cat.includes('Answer Key') || cat.includes('Objection')) {
    return (
      `🔑 *ANSWER KEY: उत्तर कुंजी जारी!* 🔑\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *परीक्षा:* *${update.title}*\n\n` +
      `📝 *विवरण:*\n` +
      `  ├ 🟢 *Status:* आंसर की और रिस्पॉन्स शीट लाइव\n` +
      `  └ ⏰ *जारी समय:* ${timeStr}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डायरेक्ट लिंक्स:* \n` +
      `  👉 *आंसर की देखें और आपत्ति दर्ज करें:* ${update.link}\n` +
      `_⚠️ समय रहते अपनी रिस्पॉन्स शीट डाउनलोड कर लें!_` +
      joinFooter
    );
  }

  // 4. Syllabus & Exam Pattern
  if (cat.includes('Syllabus')) {
    return (
      `📚 *NEW SYLLABUS: नया सिलेबस जारी!* 📚\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *परीक्षा:* *${update.title}*\n\n` +
      `📖 *विवरण:* नया विस्तृत सिलेबस और एग्जाम पैटर्न\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डाउनलोड लिंक:* \n` +
      `  📥 *पूरा सिलेबस PDF डाउनलोड करें:* ${update.link}\n` +
      `_💡 परीक्षा की तैयारी नए सिलेबस के अनुसार ही शुरू करें!_` +
      joinFooter
    );
  }

  // 5. Skill / Typing Test / Physical Test
  if (cat.includes('Typing') || cat.includes('Physical') || cat.includes('Skill')) {
    return (
      `🏃‍♂️ *SKILL / TYPING TEST: टेस्ट एडमिट कार्ड!* 🏃‍♂️\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *इवेंट:* *${update.title}*\n\n` +
      `🎯 *विवरण:* दक्षता परीक्षा / टाइपिंग टेस्ट शेड्यूल व एडमिट कार्ड\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डाउनलोड लिंक:* \n` +
      `  👉 *अपना स्किल टेस्ट एडमिट कार्ड देखें:* ${update.link}\n` +
      `_📢 सेंटर पर समय से 1 घंटा पहले पहुँचना आवश्यक है!_` +
      joinFooter
    );
  }

  // 6. Date Extended / Correction Window
  if (cat.includes('Date Extended') || cat.includes('Correction') || cat.includes('Reopen')) {
    return (
      `⏳ *IMPORTANT ALERT: तारीख बढ़ी / करेक्शन शुरू!* ⏳\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *सूचना:* *${update.title}*\n\n` +
      `📢 *विवरण:* फॉर्म भरने की तारीख बढ़ाई गई अथवा सुधार विंडो ओपन\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डायरेक्ट लिंक:* \n` +
      `  👉 *ऑनलाइन फॉर्म / करेक्शन यहाँ करें:* ${update.link}\n` +
      `_💡 जिन्होंने फॉर्म नहीं भरा या सुधार करना है, तुरंत पूरा करें!_` +
      joinFooter
    );
  }

  // 7. Exam Date Notice / Postponed
  if (cat.includes('Exam Date') || cat.includes('Notice')) {
    return (
      `🚨 *EXAM DATE NOTICE: परीक्षा कार्यक्रम जारी!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *कैटेगरी:* *${channelCategory}*\n` +
      `📌 *परीक्षा:* *${update.title}*\n\n` +
      `📅 *अपडेट:* परीक्षा तिथि घोषित अथवा नया संशोधित कार्यक्रम\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *डायरेक्ट लिंक:* \n` +
      `  📄 *ऑफिशियल परीक्षा नोटिस देखें:* ${update.link}\n` +
      `_📢 यह सूचना तुरंत अपने सभी साथी छात्रों तक पहुँचाएँ!_` +
      joinFooter
    );
  }

  // 8. Default: New Vacancy / Online Form
  return (
    `🔥 *NEW VACANCY: नई सरकारी भर्ती जारी!* 🔥\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 *कैटेगरी:* *${channelCategory}*\n` +
    `📌 *पद / भर्ती:* *${update.title}*\n\n` +
    `📋 *सेक्शन:* *${update.category || 'Latest Online Form'}*\n` +
    `⏰ *समय:* ${timeStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ *डायरेक्ट लिंक्स:* \n` +
    `  👉 *विस्तृत नोटिफिकेशन और ऑनलाइन अप्लाई:* ${update.link}\n` +
    joinFooter
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

/**
 * Resolves a WhatsApp channel invite link or code to its JID
 */
async function resolveNewsletterInvite(codeOrUrl) {
  if (!sock) return null;
  let code = (codeOrUrl || '').trim();
  if (code.includes('whatsapp.com/channel/')) {
    code = code.split('whatsapp.com/channel/')[1].replace('/', '').trim();
  }
  try {
    const meta = await sock.newsletterMetadata('invite', code);
    return meta;
  } catch (err) {
    console.error('[WhatsApp] Failed to resolve newsletter:', err.message);
    return null;
  }
}

module.exports = {
  initWhatsApp,
  sendToDestination,
  formatMessage,
  resolveNewsletterInvite,
  isReady: () => isClientReady,
  getCurrentQr: () => currentQrCode
};

