const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'history.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load history cache
function loadHistory() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ seen_ids: [], last_updated: null }, null, 2), 'utf8');
      return { seen_ids: [], last_updated: null };
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading history file:', err.message);
    return { seen_ids: [], last_updated: null };
  }
}

// Save history cache
function saveHistory(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving history file:', err.message);
  }
}

// Check if update is already processed
function isUpdateNew(id) {
  const history = loadHistory();
  return !history.seen_ids.includes(id);
}

// Mark update as processed
function markUpdateAsSeen(id, meta = {}) {
  const history = loadHistory();
  if (!history.seen_ids.includes(id)) {
    history.seen_ids.push(id);
    // Keep max 2000 items in history to prevent file growing indefinitely
    if (history.seen_ids.length > 2000) {
      history.seen_ids = history.seen_ids.slice(-2000);
    }
    history.last_updated = new Date().toISOString();
    saveHistory(history);
  }
}

module.exports = {
  isUpdateNew,
  markUpdateAsSeen,
  loadHistory
};
