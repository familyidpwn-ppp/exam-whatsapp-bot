const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const channels = [
  {
    category: 'RPSC & RSSB',
    id: '120363425195090352@newsletter',
    name: 'RPSC And Rssb News And Updates'
  },
  {
    category: 'Railway',
    id: '120363407801728926@newsletter',
    name: 'Railway Daily Updates'
  },
  {
    category: 'SSC',
    id: '120363424493976619@newsletter',
    name: 'SSC Update'
  },
  {
    category: 'Banking',
    id: '120363425132526828@newsletter',
    name: 'Bank daily Updates'
  }
];

client.on('ready', async () => {
  console.log('✅ Client is ready! Sending test alerts to all 4 channels now...');

  for (const ch of channels) {
    const msg = 
      `📢 *EXAM BOT LIVE ALERT!* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ यह चैनल *${ch.category}* ऑटोमेशन के लिए कनेक्ट हो गया है!\n` +
      `📌 अब से सभी ताज़ा *${ch.category}* के एडमिट कार्ड, रिजल्ट और नोटिस यहाँ ऑटोमैटिक पोस्ट होंगे।\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ _Time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}_\n` +
      `🤖 _Status: 24/7 Monitoring Active_`;

    try {
      console.log(`Sending to "${ch.name}" (${ch.id})...`);
      await client.sendMessage(ch.id, msg);
      console.log(`✅ Sent successfully to ${ch.name}!`);
      // 3 sec pause
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error(`❌ Failed to send to ${ch.name}:`, e.message);
    }
  }

  console.log('\n🎉 ALL DONE! Check your WhatsApp Channels!');
  process.exit(0);
});

client.initialize();
