import { afterEach } from 'vitest';
import db from '../server/db/index.js';

afterEach(() => {
  // Clean up database after each test
  try {
    // Disable foreign key constraints temporarily
    db.exec('PRAGMA foreign_keys = OFF');
    
    db.exec(`
      DELETE FROM link_comments;
      DELETE FROM link_ratings;
      DELETE FROM links;
      DELETE FROM voice_participants;
      DELETE FROM voice_sessions;
      DELETE FROM messages;
      DELETE FROM channels;
      DELETE FROM workspace_members;
      DELETE FROM workspaces;
      DELETE FROM users;
    `);
    
    // Re-enable foreign key constraints
    db.exec('PRAGMA foreign_keys = ON');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
});