const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { /* read-only fs */ }
}

// Where the SQLite file lives.
// - Render + paid disk (Starter+) → DB_PATH=/var/data/bdjob.db (persistent).
// - Render FREE plan → there is NO disk and /var/data cannot be created, so a
//   DB_PATH pointing there is ignored with a warning and we fall back to the
//   project's data/ folder, then to the OS temp dir. On Free the database is
//   ephemeral (reset on redeploy) — upgrade to Starter for persistence.
function tryOpen(candidate) {
  try {
    const dir = path.dirname(candidate);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { db: new Database(candidate), used: candidate };
  } catch (err) {
    console.warn(`[db] Cannot use ${candidate} → ${err.message}`);
    return null;
  }
}

let opened = null;
if (process.env.DB_PATH) opened = tryOpen(process.env.DB_PATH);
if (!opened) opened = tryOpen(path.join(dataDir, 'bdjob.db'));
if (!opened) opened = tryOpen(path.join(os.tmpdir(), 'bd-job-prep', 'bdjob.db'));
if (!opened) {
  console.error('[db] FATAL: no writable database location found.');
  process.exit(1);
}
const db = opened.db;
const dbPath = opened.used;
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
console.log(`[db] SQLite database → ${dbPath}`);

function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📘',
    color TEXT DEFAULT '#2563eb',
    description TEXT DEFAULT '',
    meta_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    qtype TEXT NOT NULL DEFAULT 'mcq',
    title TEXT NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT DEFAULT '[]',
    correct_answer TEXT DEFAULT '',
    answer_text TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium',
    tags TEXT DEFAULT '[]',
    exam TEXT DEFAULT '',
    source TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    published INTEGER DEFAULT 0,
    featured INTEGER DEFAULT 0,
    seo_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    keywords TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT DEFAULT 'Administrator',
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS keyword_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    search_volume INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 0,
    cpc REAL DEFAULT 0,
    competition TEXT DEFAULT 'Low',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
  `);
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

/** Production-aware base URL used for canonical/sitemap links.
 *  Render automatically provides RENDER_EXTERNAL_URL = your public URL. */
function siteBaseUrl() {
  return process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || getSetting('base_url') || 'http://localhost:3000';
}

function setSetting(key, value) {
  db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

function count(table, where = '') {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get().c;
}

module.exports = { db, migrate, getSetting, setSetting, count, siteBaseUrl, dbPath };