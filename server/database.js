const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDB() {
  const dbDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(path.join(dbDir, 'nexus.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      bio TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      status TEXT DEFAULT 'Hey there! I am using Nexus Chat',
      last_seen INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      public_key TEXT DEFAULT NULL,
      two_factor_enabled INTEGER DEFAULT 0,
      two_factor_secret TEXT DEFAULT NULL,
      theme TEXT DEFAULT 'dark',
      language TEXT DEFAULT 'en',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Conversations (both 1:1 and groups)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('private','group','channel')) NOT NULL DEFAULT 'private',
      name TEXT DEFAULT NULL,
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT NULL,
      created_by TEXT REFERENCES users(id),
      is_archived INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      mute_until INTEGER DEFAULT 0,
      disappearing_timer INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Conversation participants
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT CHECK(role IN ('admin','moderator','member')) DEFAULT 'member',
      joined_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      last_read_message_id TEXT DEFAULT NULL,
      is_muted INTEGER DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    );
  `);

  // Messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id),
      type TEXT CHECK(type IN ('text','image','video','audio','file','voice','sticker','poll','system','note','scheduled')) DEFAULT 'text',
      content TEXT DEFAULT '',
      encrypted_content TEXT DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      media_thumbnail TEXT DEFAULT NULL,
      media_size INTEGER DEFAULT 0,
      media_duration REAL DEFAULT 0,
      media_dimensions TEXT DEFAULT NULL,
      reply_to TEXT DEFAULT NULL REFERENCES messages(id),
      forwarded_from TEXT DEFAULT NULL,
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      scheduled_at INTEGER DEFAULT NULL,
      expires_at INTEGER DEFAULT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  `);

  // Message read receipts
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (message_id, user_id)
    );
  `);

  // Message reactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(message_id, user_id, emoji)
    );
  `);

  // Stories
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('text','image','video')) DEFAULT 'text',
      content TEXT DEFAULT '',
      media_url TEXT DEFAULT NULL,
      background_color TEXT DEFAULT '#6366f1',
      font_style TEXT DEFAULT 'normal',
      views_count INTEGER DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Story views
  db.exec(`
    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      viewed_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (story_id, user_id)
    );
  `);

  // Story reactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS story_reactions (
      id TEXT PRIMARY KEY,
      story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Polls
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      is_multiple_choice INTEGER DEFAULT 0,
      is_anonymous INTEGER DEFAULT 0,
      closes_at INTEGER DEFAULT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id TEXT PRIMARY KEY,
      poll_id TEXT REFERENCES polls(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      position INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id TEXT REFERENCES polls(id) ON DELETE CASCADE,
      option_id TEXT REFERENCES poll_options(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      voted_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (poll_id, option_id, user_id)
    );
  `);

  // Message bookmarks
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      tags TEXT DEFAULT '[]',
      note TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(user_id, message_id)
    );
  `);

  // Collaborative notes
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Untitled Note',
      content TEXT DEFAULT '',
      created_by TEXT REFERENCES users(id),
      updated_by TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Scheduled messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      media_url TEXT DEFAULT NULL,
      scheduled_at INTEGER NOT NULL,
      recurring TEXT DEFAULT NULL,
      timezone TEXT DEFAULT 'UTC',
      is_sent INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Call logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id),
      caller_id TEXT REFERENCES users(id),
      type TEXT CHECK(type IN ('voice','video','group_voice','group_video')) NOT NULL,
      status TEXT CHECK(status IN ('missed','answered','declined','ongoing')) DEFAULT 'missed',
      duration INTEGER DEFAULT 0,
      started_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      ended_at INTEGER DEFAULT NULL
    );
  `);

  // Contacts / blocked users
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT DEFAULT NULL,
      is_blocked INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (user_id, contact_id)
    );
  `);

  return db;
}

module.exports = { initDB };
