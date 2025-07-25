import db from './index.js';

// Logging function that only logs in development
const logMigration = (message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Migration] ${message}`);
  }
};

export const runMigrations = () => {
  // Check if description columns exist
  const linksTable = db.prepare("PRAGMA table_info(links)").all();
  const hasDescription = linksTable.some(col => col.name === 'description');
  const hasShortDescription = linksTable.some(col => col.name === 'short_description');

  if (!hasDescription) {
    db.exec(`
      ALTER TABLE links ADD COLUMN description TEXT;
    `);
    logMigration('Added description column to links table');
  }

  if (!hasShortDescription) {
    db.exec(`
      ALTER TABLE links ADD COLUMN short_description TEXT;
    `);
    logMigration('Added short_description column to links table');
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
    logMigration('Created direct_messages table');
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
      logMigration('Added images_enabled column to workspaces table');
    }
    
    if (!hasImagesEnabledAt) {
      db.exec(`
        ALTER TABLE workspaces ADD COLUMN images_enabled_at INTEGER;
      `);
      logMigration('Added images_enabled_at column to workspaces table');
    }

    // Check if image_url column exists in messages
    const messagesTable = db.prepare("PRAGMA table_info(messages)").all();
    const hasImageUrl = messagesTable.some(col => col.name === 'image_url');
    
    if (!hasImageUrl) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN image_url TEXT;
      `);
      logMigration('Added image_url column to messages table');
    }
  } catch (e) {
    // Silent - migrations may have already run
  }

  // Add encryption fields
  try {
    // Check if encrypted columns exist in channels
    const channelsTable = db.prepare("PRAGMA table_info(channels)").all();
    const hasChannelsEncrypted = channelsTable.some(col => col.name === 'encrypted');
    const hasChannelsIsEncrypted = channelsTable.some(col => col.name === 'is_encrypted');
    const hasPasswordHint = channelsTable.some(col => col.name === 'password_hint');
    
    if (!hasChannelsEncrypted && !hasChannelsIsEncrypted) {
      db.exec(`
        ALTER TABLE channels ADD COLUMN is_encrypted INTEGER DEFAULT 0;
        ALTER TABLE channels ADD COLUMN encrypted_at INTEGER;
      `);
      logMigration('Added encryption columns to channels table');
    }
    
    if (!hasPasswordHint) {
      db.exec(`
        ALTER TABLE channels ADD COLUMN password_hint TEXT;
      `);
      console.log('Added password_hint column to channels table');
    }

    // Check if encryption columns exist in messages
    const messagesTable2 = db.prepare("PRAGMA table_info(messages)").all();
    const hasMessagesEncrypted = messagesTable2.some(col => col.name === 'encrypted');
    const hasEncryptionMetadata = messagesTable2.some(col => col.name === 'encryption_metadata');
    
    if (!hasMessagesEncrypted) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN encrypted INTEGER DEFAULT 0;
      `);
      logMigration('Added encrypted column to messages table');
    }
    
    if (!hasEncryptionMetadata) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN encryption_metadata TEXT;
      `);
      logMigration('Added encryption_metadata column to messages table');
    }

    // Check if encryption columns exist in direct_messages
    const dmTable = db.prepare("PRAGMA table_info(direct_messages)").all();
    const hasDMEncrypted = dmTable.some(col => col.name === 'encrypted');
    const hasDMEncryptionMetadata = dmTable.some(col => col.name === 'encryption_metadata');
    
    if (!hasDMEncrypted) {
      db.exec(`
        ALTER TABLE direct_messages ADD COLUMN encrypted INTEGER DEFAULT 0;
      `);
      logMigration('Added encrypted column to direct_messages table');
    }
    
    if (!hasDMEncryptionMetadata) {
      db.exec(`
        ALTER TABLE direct_messages ADD COLUMN encryption_metadata TEXT;
      `);
      logMigration('Added encryption_metadata column to direct_messages table');
    }
  } catch (e) {
    // Silent - migrations may have already run
  }

  // Add missing columns for messages
  try {
    const messagesTable = db.prepare("PRAGMA table_info(messages)").all();
    const hasQuotedMessageId = messagesTable.some(col => col.name === 'quoted_message_id');
    
    if (!hasQuotedMessageId) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN quoted_message_id TEXT;
      `);
      console.log('Added quoted_message_id column to messages table');
    }
  } catch (e) {
    console.error('Messages migration error:', e);
  }

  // Add missing columns for direct_messages
  try {
    const dmTable = db.prepare("PRAGMA table_info(direct_messages)").all();
    const hasReadAt = dmTable.some(col => col.name === 'read_at');
    
    if (!hasReadAt) {
      db.exec(`
        ALTER TABLE direct_messages ADD COLUMN read_at INTEGER;
      `);
      console.log('Added read_at column to direct_messages table');
    }
  } catch (e) {
    console.error('Direct messages migration error:', e);
  }

  // Add missing columns for voice_sessions
  try {
    const voiceTable = db.prepare("PRAGMA table_info(voice_sessions)").all();
    const hasStartedBy = voiceTable.some(col => col.name === 'started_by');
    
    if (!hasStartedBy) {
      db.exec(`
        ALTER TABLE voice_sessions ADD COLUMN started_by TEXT;
      `);
      console.log('Added started_by column to voice_sessions table');
    }
  } catch (e) {
    console.error('Voice sessions migration error:', e);
  }

  // Add missing columns for link_comments
  try {
    const linkCommentsTable = db.prepare("PRAGMA table_info(link_comments)").all();
    const hasParentId = linkCommentsTable.some(col => col.name === 'parent_id');
    
    if (!hasParentId) {
      db.exec(`
        ALTER TABLE link_comments ADD COLUMN parent_id TEXT;
      `);
      console.log('Added parent_id column to link_comments table');
    }
  } catch (e) {
    console.error('Link comments migration error:', e);
  }

  // Add link_votes table for voting system
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS link_votes (
        link_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        vote INTEGER NOT NULL CHECK (vote IN (-1, 0, 1)),
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (link_id, user_id),
        FOREIGN KEY (link_id) REFERENCES links(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_link_votes_link ON link_votes(link_id);
    `);
    console.log('Created link_votes table');
  } catch (e) {
    // Table might already exist
  }

  // Add workspace visibility and invitation system
  try {
    // Add visibility column to workspaces
    const workspacesTable = db.prepare("PRAGMA table_info(workspaces)").all();
    const hasVisibility = workspacesTable.some(col => col.name === 'visibility');
    const hasDescription = workspacesTable.some(col => col.name === 'description');
    
    if (!hasVisibility) {
      db.exec(`
        ALTER TABLE workspaces ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private'));
      `);
      logMigration('Added visibility column to workspaces table');
    }
    
    if (!hasDescription) {
      db.exec(`
        ALTER TABLE workspaces ADD COLUMN description TEXT;
      `);
      logMigration('Added description column to workspaces table');
    }

    // Create invitations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        created_by TEXT NOT NULL,
        uses_count INTEGER DEFAULT 0,
        max_uses INTEGER,
        expires_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_invitations_code ON workspace_invitations(code);
      CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
    `);
    logMigration('Created workspace_invitations table');

    // Create invitation uses tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS invitation_uses (
        invitation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        used_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (invitation_id, user_id),
        FOREIGN KEY (invitation_id) REFERENCES workspace_invitations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    logMigration('Created invitation_uses table');
  } catch (e) {
    console.error('Workspace visibility migration error:', e);
  }

  // Rename workspaces to servers and add encryption
  try {
    // Check if servers table already exists
    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'");
    const serversTableExists = tablesQuery.get();
    
    if (!serversTableExists) {
      // Create new servers table with encryption fields
      db.exec(`
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
        
        -- Copy data from workspaces to servers
        INSERT INTO servers (id, name, created_by, created_at, description, visibility, images_enabled, images_enabled_at)
        SELECT id, name, created_by, created_at, description, visibility, images_enabled, images_enabled_at
        FROM workspaces;
        
        -- Create server_members table
        CREATE TABLE IF NOT EXISTS server_members (
          server_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          joined_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (server_id, user_id),
          FOREIGN KEY (server_id) REFERENCES servers(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        -- Copy data from workspace_members
        INSERT INTO server_members (server_id, user_id, role, joined_at)
        SELECT workspace_id, user_id, role, joined_at
        FROM workspace_members;
        
        -- Create server_invitations table
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
        
        -- Copy data from workspace_invitations
        INSERT INTO server_invitations (id, server_id, code, created_by, uses_count, max_uses, expires_at, created_at)
        SELECT id, workspace_id, code, created_by, uses_count, max_uses, expires_at, created_at
        FROM workspace_invitations;
        
        -- Update channels table to reference servers
        ALTER TABLE channels RENAME COLUMN workspace_id TO server_id;
        
        -- Update links table to reference servers
        ALTER TABLE links RENAME COLUMN workspace_id TO server_id;
        
        -- Create invite_minting table for 6-month limit
        CREATE TABLE IF NOT EXISTS invite_minting (
          user_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          minted_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, server_id, minted_at),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (server_id) REFERENCES servers(id)
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_server_invitations_code ON server_invitations(code);
        CREATE INDEX IF NOT EXISTS idx_server_invitations_server ON server_invitations(server_id);
        CREATE INDEX IF NOT EXISTS idx_invite_minting_user ON invite_minting(user_id);
        CREATE INDEX IF NOT EXISTS idx_links_server ON links(server_id);
        
        -- Drop old tables
        DROP TABLE IF EXISTS workspace_invitations;
        DROP TABLE IF EXISTS workspace_members;
        DROP TABLE IF EXISTS workspaces;
        DROP INDEX IF EXISTS idx_workspace_members_user;
        DROP INDEX IF EXISTS idx_invitations_code;
        DROP INDEX IF EXISTS idx_invitations_workspace;
        DROP INDEX IF EXISTS idx_links_workspace;
      `);
      logMigration('Renamed workspaces to servers and added encryption support');
    }
  } catch (e) {
    console.error('Server rename migration error:', e);
  }
};