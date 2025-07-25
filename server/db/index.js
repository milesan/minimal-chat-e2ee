import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use in-memory database for tests
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;
const db = isTest 
  ? new Database(':memory:')
  : new Database(path.join(__dirname, '../../data.db'));

export const initializeDatabase = async () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      last_seen INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      description TEXT,
      visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
      images_enabled INTEGER DEFAULT 0,
      images_enabled_at INTEGER,
      encrypted INTEGER DEFAULT 0,
      encryption_key_hash TEXT,
      encryption_salt TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS server_members (
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (server_id, user_id),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(server_id, name)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      thread_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      edited_at INTEGER,
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (thread_id) REFERENCES messages(id)
    );

    CREATE TABLE IF NOT EXISTS voice_sessions (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      started_at INTEGER DEFAULT (unixepoch()),
      ended_at INTEGER,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS voice_participants (
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER DEFAULT (unixepoch()),
      left_at INTEGER,
      PRIMARY KEY (session_id, user_id, joined_at),
      FOREIGN KEY (session_id) REFERENCES voice_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      topic TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS link_ratings (
      link_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 10),
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (link_id, user_id),
      FOREIGN KEY (link_id) REFERENCES links(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS link_comments (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (link_id) REFERENCES links(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      edited_at INTEGER,
      read_at INTEGER,
      encrypted INTEGER DEFAULT 0,
      encryption_metadata TEXT,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS server_invitations (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      uses_count INTEGER DEFAULT 0,
      max_uses INTEGER,
      expires_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS invitation_uses (
      invitation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      used_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (invitation_id, user_id),
      FOREIGN KEY (invitation_id) REFERENCES server_invitations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invite_minting (
      user_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      minted_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, server_id, minted_at),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_links_server ON links(server_id);
    CREATE INDEX IF NOT EXISTS idx_link_comments_link ON link_comments(link_id);
    CREATE INDEX IF NOT EXISTS idx_invite_minting_user ON invite_minting(user_id);
    CREATE INDEX IF NOT EXISTS idx_server_invitations_code ON server_invitations(code);
    CREATE INDEX IF NOT EXISTS idx_server_invitations_server ON server_invitations(server_id);
    CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);
  `);
};

export default db;