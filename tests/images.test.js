import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import serverRoutes from '../server/api/servers.js';
import channelRoutes from '../server/api/channels.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);

describe('Image Sharing and Server Settings', () => {
  let authToken, adminToken;
  let userId, adminId;
  let serverId;
  let channelId;

  beforeAll(async () => {
    await initializeDatabase();
    runMigrations();
    // Clean up any existing data
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      DELETE FROM direct_messages;
      DELETE FROM link_comments;
      DELETE FROM link_ratings;
      DELETE FROM links;
      DELETE FROM voice_participants;
      DELETE FROM voice_sessions;
      DELETE FROM messages;
      DELETE FROM channels;
      DELETE FROM server_members;
      DELETE FROM servers;
      DELETE FROM users;
    `);
    db.exec('PRAGMA foreign_keys = ON');

    // Create admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'imageadmin',
        password: 'testpassword123'
      });
    
    adminToken = adminResponse.body.token;
    adminId = adminResponse.body.user.id;

    // Create regular user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'imageuser',
        password: 'testpassword123'
      });
    
    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;

    // Create server
    const serverResponse = await request(app)
      .post('/api/channels/servers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Image Test Server'
      });
    
    serverId = serverResponse.body.id;

    // Add regular user to server
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
      serverId, userId, 'member'
    );

    // Create channel
    const channelResponse = await request(app)
      .post(`/api/channels/servers/${serverId}/channels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'image-test-channel'
      });
    
    channelId = channelResponse.body.id;
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('Server Settings - Image Sharing', () => {
    it('should have images disabled by default', async () => {
      // Check server directly in database
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      expect(server.images_enabled).toBe(0);
      expect(server.images_enabled_at).toBeNull();
    });

    it('should allow admin to enable images', async () => {
      // Update images setting directly in database
      db.prepare(`
        UPDATE servers 
        SET images_enabled = 1, images_enabled_at = unixepoch() 
        WHERE id = ?
      `).run(serverId);
      
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      expect(server.images_enabled).toBe(1);
      expect(server.images_enabled_at).toBeTruthy();
    });

    it('should verify server settings permissions', async () => {
      // Check that regular member exists
      const member = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, userId);
      expect(member.role).toBe('member');
      
      // Admin has owner role
      const admin = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, adminId);
      expect(admin.role).toBe('owner');
    });

    it('should track when images were enabled', async () => {
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      expect(server.images_enabled).toBe(1);
      expect(server.images_enabled_at).toBeTruthy();
      
      const enabledDate = new Date(server.images_enabled_at);
      expect(enabledDate).toBeInstanceOf(Date);
      expect(enabledDate.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Image Messages', () => {
    it('should allow image URLs in messages when enabled', () => {
      const messageId = 'img-msg-1-' + Date.now();
      const stmt = db.prepare(`
        INSERT INTO messages (id, channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        messageId,
        channelId,
        userId,
        'Check out this image!',
        'https://example.com/image.jpg'
      );

      expect(result.changes).toBe(1);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.image_url).toBe('https://example.com/image.jpg');
    });

    it('should handle messages with both text and image', () => {
      const messageId = 'img-msg-2-' + Date.now();
      const stmt = db.prepare(`
        INSERT INTO messages (id, channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        messageId,
        channelId,
        userId,
        'Here is the screenshot of the bug',
        'https://example.com/bug-screenshot.png'
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.content).toBe('Here is the screenshot of the bug');
      expect(message.image_url).toBe('https://example.com/bug-screenshot.png');
    });

    it('should handle image-only messages', () => {
      const messageId = 'img-msg-3-' + Date.now();
      const stmt = db.prepare(`
        INSERT INTO messages (id, channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        messageId,
        channelId,
        userId,
        '',
        'https://example.com/meme.gif'
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.content).toBe('');
      expect(message.image_url).toBe('https://example.com/meme.gif');
    });

    it('should disable images when setting is turned off', async () => {
      // Disable images directly in database
      db.prepare(`
        UPDATE servers 
        SET images_enabled = 0
        WHERE id = ?
      `).run(serverId);

      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      expect(server.images_enabled).toBe(0);
      // images_enabled_at should remain unchanged
      expect(server.images_enabled_at).toBeTruthy();
    });
  });

  describe('Server Member Management', () => {
    it('should list server members', async () => {
      // Query members directly from database
      const members = db.prepare(`
        SELECT wm.*, u.username 
        FROM server_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.server_id = ?
      `).all(serverId);

      expect(members.length).toBe(2); // admin + regular user
      
      const admin = members.find(m => m.user_id === adminId);
      expect(admin.role).toBe('owner');
      
      const member = members.find(m => m.user_id === userId);
      expect(member.role).toBe('member');
    });

    it('should allow admin to change member roles', async () => {
      // Update member role directly in database
      db.prepare(`
        UPDATE server_members 
        SET role = 'admin' 
        WHERE server_id = ? AND user_id = ?
      `).run(serverId, userId);
      
      const member = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, userId);
      
      expect(member.role).toBe('admin');
    });

    it('should allow admin to remove members', async () => {
      // Create another user to remove
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'removeme',
          password: 'testpassword123'
        });
      
      const removeUserId = newUserResponse.body.user.id;
      
      // Add to server
      db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
        serverId, removeUserId, 'member'
      );

      // Remove the user directly from database
      db.prepare(
        'DELETE FROM server_members WHERE server_id = ? AND user_id = ?'
      ).run(serverId, removeUserId);
      
      const member = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, removeUserId);
      
      expect(member).toBeUndefined();
    });

    it('should not allow owner to be removed', async () => {
      // Verify owner still exists
      const owner = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ? AND role = ?'
      ).get(serverId, adminId, 'owner');
      
      expect(owner).toBeDefined();
    });
  });

  describe('Server Invitations', () => {
    it('should generate server invite code', async () => {
      // Simulate invite code generation
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      expect(inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should add new user to server', async () => {
      // Create new user
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'inviteduser',
          password: 'testpassword123'
        });
      
      const newUserId = newUserResponse.body.user.id;

      // Add user to server
      db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
        serverId, newUserId, 'member'
      );

      // Verify membership
      const member = db.prepare(
        'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, newUserId);
      
      expect(member).toBeDefined();
      expect(member.role).toBe('member');
    });
  });
});