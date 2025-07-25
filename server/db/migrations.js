import db from './index.js';

export const runMigrations = () => {
  // Check if description columns exist
  const linksTable = db.prepare("PRAGMA table_info(links)").all();
  const hasDescription = linksTable.some(col => col.name === 'description');
  const hasShortDescription = linksTable.some(col => col.name === 'short_description');

  if (!hasDescription) {
    db.exec(`
      ALTER TABLE links ADD COLUMN description TEXT;
    `);
    console.log('Added description column to links table');
  }

  if (!hasShortDescription) {
    db.exec(`
      ALTER TABLE links ADD COLUMN short_description TEXT;
    `);
    console.log('Added short_description column to links table');
  }

  // Add DMs tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        edited_at INTEGER,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);
    `);
    console.log('Created direct_messages table');
  } catch (e) {
    // Table might already exist
  }

  // Add workspace settings
  try {
    // Check if images_enabled column exists
    const workspacesTable = db.prepare("PRAGMA table_info(workspaces)").all();
    const hasImagesEnabled = workspacesTable.some(col => col.name === 'images_enabled');
    const hasImagesEnabledAt = workspacesTable.some(col => col.name === 'images_enabled_at');
    
    if (!hasImagesEnabled) {
      db.exec(`
        ALTER TABLE workspaces ADD COLUMN images_enabled INTEGER DEFAULT 0;
      `);
      console.log('Added images_enabled column to workspaces table');
    }
    
    if (!hasImagesEnabledAt) {
      db.exec(`
        ALTER TABLE workspaces ADD COLUMN images_enabled_at INTEGER;
      `);
      console.log('Added images_enabled_at column to workspaces table');
    }

    // Check if image_url column exists in messages
    const messagesTable = db.prepare("PRAGMA table_info(messages)").all();
    const hasImageUrl = messagesTable.some(col => col.name === 'image_url');
    
    if (!hasImageUrl) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN image_url TEXT;
      `);
      console.log('Added image_url column to messages table');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }

  // Add encryption fields
  try {
    // Check if encrypted columns exist in channels
    const channelsTable = db.prepare("PRAGMA table_info(channels)").all();
    const hasChannelsEncrypted = channelsTable.some(col => col.name === 'encrypted');
    
    if (!hasChannelsEncrypted) {
      db.exec(`
        ALTER TABLE channels ADD COLUMN encrypted INTEGER DEFAULT 0;
        ALTER TABLE channels ADD COLUMN encrypted_at INTEGER;
      `);
      console.log('Added encryption columns to channels table');
    }

    // Check if encryption columns exist in messages
    const messagesTable2 = db.prepare("PRAGMA table_info(messages)").all();
    const hasMessagesEncrypted = messagesTable2.some(col => col.name === 'encrypted');
    const hasEncryptionMetadata = messagesTable2.some(col => col.name === 'encryption_metadata');
    
    if (!hasMessagesEncrypted) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN encrypted INTEGER DEFAULT 0;
      `);
      console.log('Added encrypted column to messages table');
    }
    
    if (!hasEncryptionMetadata) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN encryption_metadata TEXT;
      `);
      console.log('Added encryption_metadata column to messages table');
    }

    // Check if encryption columns exist in direct_messages
    const dmTable = db.prepare("PRAGMA table_info(direct_messages)").all();
    const hasDMEncrypted = dmTable.some(col => col.name === 'encrypted');
    const hasDMEncryptionMetadata = dmTable.some(col => col.name === 'encryption_metadata');
    
    if (!hasDMEncrypted) {
      db.exec(`
        ALTER TABLE direct_messages ADD COLUMN encrypted INTEGER DEFAULT 0;
      `);
      console.log('Added encrypted column to direct_messages table');
    }
    
    if (!hasDMEncryptionMetadata) {
      db.exec(`
        ALTER TABLE direct_messages ADD COLUMN encryption_metadata TEXT;
      `);
      console.log('Added encryption_metadata column to direct_messages table');
    }
  } catch (e) {
    console.error('Encryption migration error:', e);
  }
};