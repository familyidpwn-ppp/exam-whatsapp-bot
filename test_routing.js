const { fetchExamUpdates } = require('./scraper');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

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
    const isMatch = channel.name_keywords.some(kw => isKeywordMatch(text, kw));
    if (isMatch) {
      matchedChannels.push(channel);
    }
  }

  return matchedChannels;
}

async function run() {
  const updates = await fetchExamUpdates(config.website_url);
  console.log(`\nTesting Exact-Word Keyword Routing for ${updates.length} updates...\n`);

  const categoryDistribution = {};
  config.channels.forEach(c => categoryDistribution[c.category] = []);

  updates.forEach(u => {
    const matched = routeUpdateToChannels(u, config.channels);
    matched.forEach(ch => {
      categoryDistribution[ch.category].push(u);
    });
  });

  for (const [cat, list] of Object.entries(categoryDistribution)) {
    console.log(`========================================`);
    console.log(`Channel: [${cat}] -> Found ${list.length} Matching Updates`);
    console.log(`========================================`);
    list.slice(0, 4).forEach(x => {
      console.log(` • [${x.category}] ${x.title}`);
    });
    console.log('');
  }
}

run();
