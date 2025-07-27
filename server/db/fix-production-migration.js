import db from './index.js';

// Safe production migration to handle inconsistent state
export const fixProductionMigration = () => {
  console.log('Running production migration fix...');
  
  try {
    // Check current database state
    const hasWorkspacesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'").get();
    const hasServersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'").get();
    
    console.log('Database state:', {
      hasWorkspacesTable: !!hasWorkspacesTable,
      hasServersTable: !!hasServersTable
    });
    
    // If we have workspaces but no servers, we need to do the migration
    if (hasWorkspacesTable && !hasServersTable) {
      console.log('Migrating from workspaces to servers...');
      
      db.exec(`
        -- Create servers table with all necessary columns
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
      `);
      
      // Check what columns exist in workspaces
      const workspaceCols = db.prepare("PRAGMA table_info(workspaces)").all();
      const colNames = workspaceCols.map(col => col.name);
      
      // Build dynamic INSERT based on existing columns
      let insertCols = ['id', 'name', 'created_by', 'created_at'];
      if (colNames.includes('description')) insertCols.push('description');
      if (colNames.includes('visibility')) insertCols.push('visibility');
      if (colNames.includes('images_enabled')) insertCols.push('images_enabled');
      if (colNames.includes('images_enabled_at')) insertCols.push('images_enabled_at');
      
      const insertSQL = `
        INSERT INTO servers (${insertCols.join(', ')})
        SELECT ${insertCols.join(', ')} FROM workspaces
      `;
      
      db.exec(insertSQL);
      console.log('Migrated workspace data to servers table');
      
      // Create server_members table
      db.exec(`
        CREATE TABLE IF NOT EXISTS server_members (
          server_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          joined_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (server_id, user_id),
          FOREIGN KEY (server_id) REFERENCES servers(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
      
      // Check if workspace_members exists
      const hasWorkspaceMembers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_members'").get();
      if (hasWorkspaceMembers) {
        db.exec(`
          INSERT INTO server_members (server_id, user_id, role, joined_at)
          SELECT workspace_id, user_id, role, joined_at FROM workspace_members
        `);
        console.log('Migrated workspace_members to server_members');
      }
      
      // Update foreign keys in other tables
      try {
        // For channels table
        const channelsCols = db.prepare("PRAGMA table_info(channels)").all();
        const hasWorkspaceId = channelsCols.some(col => col.name === 'workspace_id');
        if (hasWorkspaceId) {
          // SQLite doesn't support RENAME COLUMN in older versions, so we need to recreate
          db.exec(`
            -- Create new channels table
            CREATE TABLE channels_new (
              id TEXT PRIMARY KEY,
              server_id TEXT NOT NULL,
              name TEXT NOT NULL,
              created_by TEXT NOT NULL,
              created_at INTEGER DEFAULT (unixepoch()),
              is_encrypted INTEGER DEFAULT 0,
              encrypted_at INTEGER,
              password_hint TEXT,
              FOREIGN KEY (server_id) REFERENCES servers(id),
              FOREIGN KEY (created_by) REFERENCES users(id),
              UNIQUE(server_id, name)
            );
            
            -- Copy data
            INSERT INTO channels_new (id, server_id, name, created_by, created_at)
            SELECT id, workspace_id, name, created_by, created_at FROM channels;
            
            -- Drop old table and rename
            DROP TABLE channels;
            ALTER TABLE channels_new RENAME TO channels;
            
            -- Recreate indexes
            CREATE INDEX idx_channels_server ON channels(server_id);
          `);
          console.log('Updated channels table');
        }
      } catch (e) {
        console.error('Error updating channels:', e);
      }
      
      // Handle invitations
      try {
        const hasWorkspaceInvitations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_invitations'").get();
        if (hasWorkspaceInvitations) {
          db.exec(`
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
            
            INSERT INTO server_invitations 
            SELECT id, workspace_id, code, created_by, uses_count, max_uses, expires_at, created_at 
            FROM workspace_invitations;
          `);
          console.log('Migrated invitations');
        }
      } catch (e) {
        console.error('Error migrating invitations:', e);
      }
      
      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_server_invitations_code ON server_invitations(code);
        CREATE INDEX IF NOT EXISTS idx_server_invitations_server ON server_invitations(server_id);
      `);
      
      console.log('Migration complete');
    } else if (!hasServersTable) {
      // No workspaces or servers table - create fresh
      console.log('Creating fresh servers table...');
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
        
        CREATE TABLE IF NOT EXISTS server_members (
          server_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          joined_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (server_id, user_id),
          FOREIGN KEY (server_id) REFERENCES servers(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
      `);
    }
    
    // Ensure channels table has server_id column
    const channelsCols = db.prepare("PRAGMA table_info(channels)").all();
    const hasServerId = channelsCols.some(col => col.name === 'server_id');
    if (!hasServerId) {
      console.error('CRITICAL: Channels table missing server_id column');
    }
    
  } catch (error) {
    console.error('Production migration error:', error);
    throw error;
  }
};