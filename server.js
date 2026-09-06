const express = require('express');
const QRCode = require('qrcode');
const { isReady, getCurrentQr } = require('./whatsapp');
const { loadHistory } = require('./database');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// 1. Health check & Home page (For UptimeRobot ping)
app.get('/', (req, res) => {
  const ready = isReady();
  const history = loadHistory();

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Exam WhatsApp Bot | Active</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
        .card { background: #1e293b; border-radius: 16px; padding: 2rem; max-width: 500px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        .status { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: bold; font-size: 0.9rem; margin-bottom: 1rem; }
        .online { background: #059669; color: #ecfdf5; }
        .waiting { background: #d97706; color: #fffbeb; }
        h1 { margin-top: 0; font-size: 1.5rem; color: #38bdf8; }
        .meta { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
        .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 500; margin-top: 1.2rem; transition: background 0.2s; }
        .btn:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="status ${ready ? 'online' : 'waiting'}">
          ${ready ? '● BOT IS LIVE & RUNNING' : '⏳ Awaiting WhatsApp Login'}
        </span>
        <h1>Exam Updates WhatsApp Bot</h1>
        <div class="meta">
          <p><strong>UptimeRobot Ping:</strong> OK (200)</p>
          <p><strong>Monitored Channels:</strong> ${config.channels.map(c => c.category).join(', ')}</p>
          <p><strong>Baseline Updates Cached:</strong> ${history.seen_ids.length}</p>
          <p><strong>Check Interval:</strong> Every ${config.check_interval_minutes} minutes</p>
        </div>
        ${!ready ? '<a href="/qr" class="btn">👉 Scan WhatsApp QR Code</a>' : ''}
      </div>
    </body>
    </html>
  `);
});

// 2. Visual QR Code page (So user can scan easily from their phone)
app.get('/qr', async (req, res) => {
  if (isReady()) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif; background:#0f172a; color:#10b981; display:flex; justify-content:center; align-items:center; height:90vh; text-align:center;">
        <div>
          <h2>✅ WhatsApp is already connected and active!</h2>
          <p style="color:#94a3b8;">No need to scan. Updates are actively broadcasting.</p>
          <a href="/" style="color:#38bdf8;">Return to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  }

  const qrText = getCurrentQr();
  if (!qrText) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta http-equiv="refresh" content="3"></head>
      <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; justify-content:center; align-items:center; height:90vh; text-align:center;">
        <div>
          <h2>⏳ Generating QR Code...</h2>
          <p style="color:#94a3b8;">Please wait a few seconds. This page refreshes automatically.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(qrText, { width: 320, margin: 2 });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp QR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="15">
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; }
          .box { background: #1e293b; padding: 2rem; border-radius: 16px; text-align: center; border: 1px solid #334155; }
          img { border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin: 1.5rem 0; }
          p { color: #94a3b8; font-size: 0.95rem; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2 style="color:#38bdf8; margin-top:0;">Scan with WhatsApp</h2>
          <p>WhatsApp > Linked Devices > Link a Device</p>
          <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
          <p><em>(This QR code refreshes automatically)</em></p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error generating QR code image');
  }
});

// 3. Health check route for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

function startServer() {
  app.listen(PORT, () => {
    console.log(`[Web Server] HTTP server listening on port ${PORT}`);
    console.log(`[Web Server] Web Dashboard: http://localhost:${PORT}`);
    console.log(`[Web Server] Web QR Code:  http://localhost:${PORT}/qr`);
  });
}

module.exports = {
  startServer
};
