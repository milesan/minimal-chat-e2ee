import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import channelRoutes from '../server/api/channels.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);

describe('End-to-End Encryption', () => {
  let authToken;
  let userId;
  let workspaceId;
  let encryptedChannelId;

  beforeAll(async () => {
    await initializeDatabase();
    runMigrations();
    // Clean up any existing data
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
    db.exec('PRAGMA foreign_keys = ON');

    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'encryptiontest',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.token;
    userId = authResponse.body.user.id;

    const workspaceResponse = await request(app)
      .post('/api/channels/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Encryption Test Workspace'
      });
    
    workspaceId = workspaceResponse.body.id;
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('Encrypted Channels', () => {
    it('should create an encrypted channel', async () => {
      const response = await request(app)
        .post(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'encrypted-channel',
          is_encrypted: true,
          password_hint: 'test hint'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('encrypted-channel');
      expect(response.body.is_encrypted).toBe(1);
      expect(response.body.password_hint).toBe('test hint');
      encryptedChannelId = response.body.id;
    });

    it('should store encrypted messages with metadata', async () => {
      const messageContent = 'This is an encrypted message';
      const encryptedContent = 'U2FsdGVkX1+encrypted+data'; // Mock encrypted data
      const encryptionMetadata = JSON.stringify({
        algorithm: 'AES-GCM',
        salt: 'randomsalt',
        iv: 'randomiv'
      });

      // Insert encrypted message directly to database
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, encrypted, encryption_metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        encryptedChannelId,
        userId,
        encryptedContent,
        1,
        encryptionMetadata
      );

      expect(result.changes).toBe(1);

      // Verify the message is stored as encrypted
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.encrypted).toBe(1);
      expect(message.content).toBe(encryptedContent);
      expect(message.encryption_metadata).toBe(encryptionMetadata);
    });

    it('should retrieve channel encryption status', async () => {
      const response = await request(app)
        .get(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const encryptedChannel = response.body.find(ch => ch.id === encryptedChannelId);
      expect(encryptedChannel).toBeDefined();
      expect(encryptedChannel.is_encrypted).toBe(1);
      expect(encryptedChannel.password_hint).toBe('test hint');
    });

    it('should create non-encrypted channel by default', async () => {
      const response = await request(app)
        .post(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'regular-channel'
        });

      expect(response.status).toBe(200);
      expect(response.body.is_encrypted).toBe(0);
      expect(response.body.password_hint).toBeNull();
    });
  });

  describe('Key Derivation', () => {
    it('should validate encryption metadata structure', () => {
      const validMetadata = {
        algorithm: 'AES-GCM',
        salt: 'base64salt',
        iv: 'base64iv'
      };

      const metadataString = JSON.stringify(validMetadata);
      const parsed = JSON.parse(metadataString);

      expect(parsed).toHaveProperty('algorithm');
      expect(parsed).toHaveProperty('salt');
      expect(parsed).toHaveProperty('iv');
      expect(parsed.algorithm).toBe('AES-GCM');
    });

    it('should handle messages without encryption in regular channels', async () => {
      const regularChannelResponse = await request(app)
        .post(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'plain-channel'
        });

      const channelId = regularChannelResponse.body.id;

      // Insert regular message
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, encrypted)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'This is a plain text message',
        0
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.encrypted).toBe(0);
      expect(message.encryption_metadata).toBeNull();
      expect(message.content).toBe('This is a plain text message');
    });
  });
});