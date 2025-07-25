import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import channelRoutes from '../server/api/channels.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';
import { generateServerKey, verifyServerKey, hashServerKey } from '../server/utils/serverEncryption.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);

describe('Server-Level Encryption', () => {
  let authToken;
  let userId;
  let encryptedServerId;
  let serverEncryptionKey;

  beforeAll(async () => {
    await initializeDatabase();
    runMigrations();
    
    // Clean up any existing data
    db.exec('PRAGMA foreign_keys = OFF');
    
    // Only delete from tables that exist after migrations
    const tables = [
      'invite_minting',
      'invitation_uses', 
      'server_invitations',
      'direct_messages',
      'link_comments',
      'link_ratings',
      'links',
      'voice_participants',
      'voice_sessions',
      'messages',
      'channels',
      'server_members',
      'servers',
      'users'
    ];
    
    for (const table of tables) {
      try {
        db.exec(`DELETE FROM ${table}`);
      } catch (err) {
        // Table might not exist yet
      }
    }
    
    db.exec('PRAGMA foreign_keys = ON');

    // Create test user
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'encryptiontest',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.token;
    userId = authResponse.body.user.id;
  });

  afterAll(() => {
    db.close();
  });

  describe('Server Creation', () => {
    it('should create an unencrypted server by default', async () => {
      const response = await request(app)
        .post('/api/channels/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'unencrypted-server'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.encrypted).toBeFalsy();
      expect(response.body.encryptionKey).toBeUndefined();
    });

    it('should create an encrypted server with generated key', async () => {
      const response = await request(app)
        .post('/api/channels/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'encrypted-server',
          encrypted: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.encrypted).toBe(true);
      expect(response.body).toHaveProperty('encryptionKey');
      expect(response.body.encryptionKey).toHaveLength(64); // 256-bit hex key

      encryptedServerId = response.body.id;
      serverEncryptionKey = response.body.encryptionKey;
    });

    it('should verify channels in encrypted server are unencrypted by default', async () => {
      const channelsResponse = await request(app)
        .get(`/api/channels/servers/${encryptedServerId}/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(channelsResponse.status).toBe(200);
      const generalChannel = channelsResponse.body.find(ch => ch.name === 'general');
      expect(generalChannel).toBeDefined();
      
      // Check that general channel is not encrypted
      const channelInfo = db.prepare('SELECT is_encrypted FROM channels WHERE id = ?').get(generalChannel.id);
      expect(channelInfo.is_encrypted).toBe(0);
    });
  });

  describe('Invite Minting System', () => {
    let inviteCode;

    it('should create invitation with 6-month limit', async () => {
      const response = await request(app)
        .post(`/api/channels/servers/${encryptedServerId}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          maxUses: 5,
          expiresIn: 24,
          encryptionKeyPassword: 'dummy-password'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('code');
      expect(response.body.requiresEncryptionKey).toBe(true);
      inviteCode = response.body.code;

      // Verify minting was recorded
      const mintRecord = db.prepare('SELECT * FROM invite_minting WHERE user_id = ? AND server_id = ?')
        .get(userId, encryptedServerId);
      expect(mintRecord).toBeDefined();
    });

    it('should reject second invitation within 6 months', async () => {
      const response = await request(app)
        .post(`/api/channels/servers/${encryptedServerId}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          maxUses: 5,
          expiresIn: 24,
          encryptionKeyPassword: 'dummy-password'
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('6 months');
      expect(response.body).toHaveProperty('nextAvailable');
    });
  });

  describe('Dual-Key Join Process', () => {
    let newUserToken;
    let newUserId;

    beforeEach(async () => {
      // Create a new user to test joining
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser' + Date.now(),
          password: 'testpassword123'
        });
      
      newUserToken = newUserResponse.body.token;
      newUserId = newUserResponse.body.user.id;
    });

    it('should reject join without encryption key', async () => {
      // Get the invite code from previous test
      const invitation = db.prepare('SELECT code FROM server_invitations WHERE server_id = ?')
        .get(encryptedServerId);

      const response = await request(app)
        .post('/api/channels/servers/join-by-code')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          code: invitation.code
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('encryption key');
    });

    it('should reject join with wrong encryption key', async () => {
      const invitation = db.prepare('SELECT code FROM server_invitations WHERE server_id = ?')
        .get(encryptedServerId);

      const response = await request(app)
        .post('/api/channels/servers/join-by-code')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          code: invitation.code,
          encryptionKey: 'wrongkey1234567890abcdef1234567890abcdef1234567890abcdef12345678'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid encryption key');
    });

    it('should successfully join with correct invite code and encryption key', async () => {
      const invitation = db.prepare('SELECT code FROM server_invitations WHERE server_id = ?')
        .get(encryptedServerId);

      const response = await request(app)
        .post('/api/channels/servers/join-by-code')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          code: invitation.code,
          encryptionKey: serverEncryptionKey
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.server.id).toBe(encryptedServerId);

      // Verify user was added as member
      const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?')
        .get(encryptedServerId, newUserId);
      expect(member).toBeDefined();
    });
  });

  describe('Server Encryption Utilities', () => {
    it('should generate valid encryption keys', () => {
      const key = generateServerKey();
      expect(key).toHaveLength(64); // 256-bit hex
      expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
    });

    it('should hash and verify server keys', async () => {
      const key = generateServerKey();
      const hash = await hashServerKey(key);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(key);
      
      const isValid = await verifyServerKey(key, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await verifyServerKey('wrongkey', hash);
      expect(isInvalid).toBe(false);
    });
  });
});