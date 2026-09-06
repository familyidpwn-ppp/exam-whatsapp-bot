const fs = require('fs');
const path = require('path');
const { initWhatsApp, sendToDestination, formatMessage, resolveNewsletterInvite, isReady } = require('./whatsapp');
const { fetchExamUpdates, extractOfficialGovLink } = require('./scraper');
const { isUpdateNew, markUpdateAsSeen, loadHistory } = require('./database');
const { startServer } = require('./server');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading config.json:', err.message);
    process.exit(1);
  }
}

function isKeywordMatch(text, keyword) {
  const cleanKw = keyword.trim().toLowerCase();
  const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
  return regex.test(text);
}

function routeUpdateToChannels(update, channels) {
  const text = (update.title + ' ' + (update.link || '')).toLowerCase();
  const matchedChannels = [];

  for (const channel of channels) {
    if (channel.all_updates === true || (channel.name_keywords && channel.name_keywords.includes('*'))) {
      matchedChannels.push(channel);
      continue;
    }
    const isMatch = channel.name_keywords && channel.name_keywords.some(kw => isKeywordMatch(text, kw));
    if (isMatch) {
      matchedChannels.push(channel);
    }
  }

  return matchedChannels;
}

/**
 * Main Check & Alert Cycle
 */
async function runCheckCycle() {
  const config = loadConfig();
  console.log(`\n-----------------------------------------------------`);
  console.log(`[Monitor] Starting check cycle at ${new Date().toLocaleString('en-IN')}`);
  console.log(`[Monitor] Checking Website: ${config.website_url}`);

  try {
    const updates = await fetchExamUpdates(config.website_url);

    if (!updates || updates.length === 0) {
      console.log('[Monitor] No updates fetched during this cycle.');
      return;
    }

    const history = loadHistory();
    const isFirstRun = history.seen_ids.length === 0;

    // Filter only new updates
    const newUpdates = updates.filter(u => isUpdateNew(u.id));
    console.log(`[Monitor] Fetched ${updates.length} total updates (${newUpdates.length} are brand new).`);

    // First run baseline: record all existing updates so we don't spam 100 historical items
    if (isFirstRun) {
      console.log('[Monitor] First-time setup: Storing current updates baseline into history database...');
      for (const u of updates) {
        markUpdateAsSeen(u.id, { title: u.title });
      }
      console.log('[Monitor] Baseline saved! From now on, whenever a new exam update appears on the website, it will be posted to the matching channel automatically.');
      return;
    }

    // Process new updates
    for (const update of newUpdates) {
      const matchedChannels = routeUpdateToChannels(update, config.channels);

      if (matchedChannels.length === 0) {
        markUpdateAsSeen(update.id, { title: update.title });
        continue;
      }

      console.log(`\n[Monitor] 🚨 New alert found: "${update.title}"`);

      for (const channel of matchedChannels) {
        console.log(`[Monitor] ➔ Routing to channel: [${channel.category}]`);

        if (isReady()) {
          let destinationJid = channel.channel_id;
          if (destinationJid && !destinationJid.includes('@')) {
            try {
              const meta = await resolveNewsletterInvite(destinationJid);
              if (meta && meta.id) {
                destinationJid = meta.id;
                channel.channel_id = meta.id;
              }
            } catch (e) {
              console.error('[Monitor] Error resolving channel invite:', e.message);
            }
          }

          if (destinationJid) {
            const govLink = await extractOfficialGovLink(update.detailUrl || update.link, channel.category);
            const cleanUpdate = { ...update, link: govLink };
            const message = formatMessage(cleanUpdate, channel.category);
            await sendToDestination(destinationJid, message);
            // 3-second natural pause between posts
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.warn(`[Monitor] No channel_id configured for "${channel.category}".`);
          }
        } else {
          console.warn('[Monitor] WhatsApp client not ready yet. Post skipped for this cycle.');
        }
      }

      markUpdateAsSeen(update.id, { title: update.title });
    }
  } catch (err) {
    console.error('[Monitor] Error during check cycle:', err.message);
  }
}

/**
 * Continuous Daemon Runner
 */
async function startDaemon() {
  const config = loadConfig();
  console.log('======================================================');
  console.log('🚀 MULTI-CHANNEL EXAM UPDATES AUTOMATION BOT ACTIVE');
  console.log('======================================================');
  // Start HTTP Web Server for Render and UptimeRobot
  startServer();

  initWhatsApp(async () => {
    console.log('[Orchestrator] WhatsApp connected! Running baseline check...');
    await runCheckCycle();

    const intervalMinutes = config.check_interval_minutes || 10;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`[Orchestrator] Scheduler active. Will monitor for fresh updates every ${intervalMinutes} minutes.`);

    setInterval(async () => {
      try {
        await runCheckCycle();
      } catch (err) {
        console.error('[Orchestrator] Interval error shielded:', err.message);
      }
    }, intervalMs);
  });
}

// Global Crash Shields
process.on('uncaughtException', (err) => {
  console.error('[CRASH SHIELD] Uncaught Exception caught:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH SHIELD] Unhandled Rejection caught:', reason);
});

startDaemon();
