const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'bot.db');
const SNAPSHOT_PATH = path.join(__dirname, '..', '..', 'data', 'guild_config.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function initDb() {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  ensureDir(dataDir);
  const db = new Database(DB_PATH);

  db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT,
    ticket_category_id TEXT,
    verification_role_id TEXT,
    admin_role_id TEXT,
    transcript_channel_id TEXT,
    staff_role_id TEXT
  )`).run();

  // Migrations: add transcript_channel_id and staff_role_id if missing
  try { db.prepare('ALTER TABLE guild_config ADD COLUMN transcript_channel_id TEXT').run(); } catch (_) {}
  try { db.prepare('ALTER TABLE guild_config ADD COLUMN staff_role_id TEXT').run(); } catch (_) {}

  db.prepare(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS ticket_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    panel_title TEXT,
    panel_description TEXT,
    panel_color TEXT,
    button_label TEXT,
    welcome_title TEXT,
    welcome_description TEXT,
    welcome_color TEXT,
    close_label TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji_key TEXT NOT NULL,
    role_id TEXT NOT NULL
  )`).run();

  return db;
}

function getGuildConfig(db, guildId) {
  return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
}

function upsertGuildConfig(db, guildId, patch) {
  const current = getGuildConfig(db, guildId) || { guild_id: guildId };
  const next = {
    log_channel_id: current.log_channel_id,
    ticket_category_id: current.ticket_category_id,
    verification_role_id: current.verification_role_id,
    admin_role_id: current.admin_role_id,
    transcript_channel_id: current.transcript_channel_id,
    staff_role_id: current.staff_role_id,
    ...patch
  };
  db.prepare(`INSERT INTO guild_config (guild_id, log_channel_id, ticket_category_id, verification_role_id, admin_role_id, transcript_channel_id, staff_role_id)
              VALUES (@guild_id, @log_channel_id, @ticket_category_id, @verification_role_id, @admin_role_id, @transcript_channel_id, @staff_role_id)
              ON CONFLICT(guild_id) DO UPDATE SET
                log_channel_id = excluded.log_channel_id,
                ticket_category_id = excluded.ticket_category_id,
                verification_role_id = excluded.verification_role_id,
                admin_role_id = excluded.admin_role_id,
                transcript_channel_id = excluded.transcript_channel_id,
                staff_role_id = excluded.staff_role_id`).run({ guild_id: guildId, ...next });
  try { exportGuildConfigs(db); } catch (_) {}
  return getGuildConfig(db, guildId);
}

function setTranscriptChannel(db, guildId, channelId) {
  const current = getGuildConfig(db, guildId) || { guild_id: guildId };
  const patch = { transcript_channel_id: channelId };
  const next = {
    log_channel_id: current.log_channel_id,
    ticket_category_id: current.ticket_category_id,
    verification_role_id: current.verification_role_id,
    admin_role_id: current.admin_role_id,
    transcript_channel_id: channelId,
    staff_role_id: current.staff_role_id
  };
  db.prepare(`INSERT INTO guild_config (guild_id, log_channel_id, ticket_category_id, verification_role_id, admin_role_id, transcript_channel_id, staff_role_id)
              VALUES (@guild_id, @log_channel_id, @ticket_category_id, @verification_role_id, @admin_role_id, @transcript_channel_id, @staff_role_id)
              ON CONFLICT(guild_id) DO UPDATE SET
                log_channel_id = excluded.log_channel_id,
                ticket_category_id = excluded.ticket_category_id,
                verification_role_id = excluded.verification_role_id,
                admin_role_id = excluded.admin_role_id,
                transcript_channel_id = excluded.transcript_channel_id,
                staff_role_id = excluded.staff_role_id`).run({ guild_id: guildId, ...next });
  try { exportGuildConfigs(db); } catch (_) {}
  return getGuildConfig(db, guildId);
}

function createTicketPanel(db, panel) {
  const stmt = db.prepare(`INSERT INTO ticket_panels (
    guild_id, channel_id, token, panel_title, panel_description, panel_color,
    button_label, welcome_title, welcome_description, welcome_color, close_label
  ) VALUES (@guild_id, @channel_id, @token, @panel_title, @panel_description, @panel_color,
    @button_label, @welcome_title, @welcome_description, @welcome_color, @close_label)`);
  const info = stmt.run(panel);
  return { id: info.lastInsertRowid, ...panel };
}

function getTicketPanelByToken(db, token) {
  return db.prepare('SELECT * FROM ticket_panels WHERE token = ?').get(token);
}

function insertTicket(db, { guild_id, channel_id, user_id, status = 'open' }) {
  return db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, status) VALUES (?, ?, ?, ?)')
    .run(guild_id, channel_id, user_id, status);
}

function closeTicket(db, channelId) {
  return db.prepare('UPDATE tickets SET status = \"closed\" WHERE channel_id = ?').run(channelId);
}

function addWarning(db, { guild_id, user_id, moderator_id, reason }) {
  return db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(guild_id, user_id, moderator_id, reason || '', Date.now());
}

function listWarnings(db, guildId, userId) {
  return db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC').all(guildId, userId);
}

function removeWarning(db, id, guildId) {
  return db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ?').run(id, guildId);
}

function getNextTicketNumber(db, guildId) {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM tickets WHERE guild_id = ?').get(guildId);
  return row?.next || 1;
}

function getAllGuildConfigs(db) {
  return db.prepare('SELECT * FROM guild_config').all();
}

function exportGuildConfigs(db) {
  const rows = getAllGuildConfigs(db);
  try {
    ensureDir(path.dirname(SNAPSHOT_PATH));
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(rows, null, 2), 'utf8');
  } catch (_) {}
}

function importGuildConfigs(db) {
  if (!fs.existsSync(SNAPSHOT_PATH)) return 0;
  try {
    const text = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return 0;
    let n = 0;
    for (const row of arr) {
      if (!row.guild_id) continue;
      upsertGuildConfig(db, row.guild_id, {
        log_channel_id: row.log_channel_id || null,
        ticket_category_id: row.ticket_category_id || null,
        verification_role_id: row.verification_role_id || null,
        admin_role_id: row.admin_role_id || null,
        transcript_channel_id: row.transcript_channel_id || null,
        staff_role_id: row.staff_role_id || null
      });
      n++;
    }
    return n;
  } catch (_) { return 0; }
}

function maybeRestoreGuildConfigs(db) {
  try {
    const count = db.prepare('SELECT COUNT(1) as c FROM guild_config').get().c;
    if (count > 0) return 0;
    return importGuildConfigs(db);
  } catch (_) { return 0; }
}

function addReactionRole(db, mapping) {
  const stmt = db.prepare(`INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji_key, role_id)
    VALUES (@guild_id, @channel_id, @message_id, @emoji_key, @role_id)`);
  return stmt.run(mapping);
}

function deleteReactionRole(db, { guild_id, message_id, emoji_key }) {
  return db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji_key = ?')
    .run(guild_id, message_id, emoji_key);
}

function getReactionRolesByMessage(db, guildId, messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?').all(guildId, messageId);
}

function getReactionRole(db, guildId, messageId, emojiKey) {
  return db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji_key = ?')
    .get(guildId, messageId, emojiKey);
}

module.exports = { initDb, getGuildConfig, upsertGuildConfig, setTranscriptChannel, createTicketPanel, getTicketPanelByToken, insertTicket, closeTicket, addWarning, listWarnings, removeWarning, addReactionRole, deleteReactionRole, getReactionRolesByMessage, getReactionRole, exportGuildConfigs, importGuildConfigs, maybeRestoreGuildConfigs, getNextTicketNumber };
