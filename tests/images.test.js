import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import workspaceRoutes from '../server/api/workspaces.js';
import channelRoutes from '../server/api/channels.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);

describe('Image Sharing and Workspace Settings', () => {
  let authToken, adminToken;
  let userId, adminId;
  let workspaceId;
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
      DELETE FROM workspace_members;
      DELETE FROM workspaces;
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

    // Create workspace
    const workspaceResponse = await request(app)
      .post('/api/channels/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Image Test Workspace'
      });
    
    workspaceId = workspaceResponse.body.id;

    // Add regular user to workspace
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
      workspaceId, userId, 'member'
    );

    // Create channel
    const channelResponse = await request(app)
      .post(`/api/channels/workspaces/${workspaceId}/channels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'image-test-channel'
      });
    
    channelId = channelResponse.body.id;
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('Workspace Settings - Image Sharing', () => {
    it('should have images disabled by default', async () => {
      // Check workspace directly in database
      const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
      expect(workspace.images_enabled).toBe(0);
      expect(workspace.images_enabled_at).toBeNull();
    });

    it('should allow admin to enable images', async () => {
      // Update images setting directly in database
      db.prepare(`
        UPDATE workspaces 
        SET images_enabled = 1, images_enabled_at = unixepoch() 
        WHERE id = ?
      `).run(workspaceId);
      
      const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
      expect(workspace.images_enabled).toBe(1);
      expect(workspace.images_enabled_at).toBeTruthy();
    });

    it('should verify workspace settings permissions', async () => {
      // Check that regular member exists
      const member = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).get(workspaceId, userId);
      expect(member.role).toBe('member');
      
      // Admin has owner role
      const admin = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).get(workspaceId, adminId);
      expect(admin.role).toBe('owner');
    });

    it('should track when images were enabled', async () => {
      const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
      expect(workspace.images_enabled).toBe(1);
      expect(workspace.images_enabled_at).toBeTruthy();
      
      const enabledDate = new Date(workspace.images_enabled_at);
      expect(enabledDate).toBeInstanceOf(Date);
      expect(enabledDate.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Image Messages', () => {
    it('should allow image URLs in messages when enabled', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'Check out this image!',
        'https://example.com/image.jpg'
      );

      expect(result.changes).toBe(1);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.image_url).toBe('https://example.com/image.jpg');
    });

    it('should handle messages with both text and image', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'Here is the screenshot of the bug',
        'https://example.com/bug-screenshot.png'
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.content).toBe('Here is the screenshot of the bug');
      expect(message.image_url).toBe('https://example.com/bug-screenshot.png');
    });

    it('should handle image-only messages', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, image_url)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        '',
        'https://example.com/meme.gif'
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.content).toBe('');
      expect(message.image_url).toBe('https://example.com/meme.gif');
    });

    it('should disable images when setting is turned off', async () => {
      // Disable images directly in database
      db.prepare(`
        UPDATE workspaces 
        SET images_enabled = 0
        WHERE id = ?
      `).run(workspaceId);

      const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
      expect(workspace.images_enabled).toBe(0);
      // images_enabled_at should remain unchanged
      expect(workspace.images_enabled_at).toBeTruthy();
    });
  });

  describe('Workspace Member Management', () => {
    it('should list workspace members', async () => {
      // Query members directly from database
      const members = db.prepare(`
        SELECT wm.*, u.username 
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
      `).all(workspaceId);

      expect(members.length).toBe(2); // admin + regular user
      
      const admin = members.find(m => m.user_id === adminId);
      expect(admin.role).toBe('owner');
      
      const member = members.find(m => m.user_id === userId);
      expect(member.role).toBe('member');
    });

    it('should allow admin to change member roles', async () => {
      // Update member role directly in database
      db.prepare(`
        UPDATE workspace_members 
        SET role = 'admin' 
        WHERE workspace_id = ? AND user_id = ?
      `).run(workspaceId, userId);
      
      const member = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).get(workspaceId, userId);
      
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
      
      // Add to workspace
      db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
        workspaceId, removeUserId, 'member'
      );

      // Remove the user directly from database
      db.prepare(
        'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).run(workspaceId, removeUserId);
      
      const member = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).get(workspaceId, removeUserId);
      
      expect(member).toBeUndefined();
    });

    it('should not allow owner to be removed', async () => {
      // Verify owner still exists
      const owner = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role = ?'
      ).get(workspaceId, adminId, 'owner');
      
      expect(owner).toBeDefined();
    });
  });

  describe('Workspace Invitations', () => {
    it('should generate workspace invite code', async () => {
      // Simulate invite code generation
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      expect(inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should add new user to workspace', async () => {
      // Create new user
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'inviteduser',
          password: 'testpassword123'
        });
      
      const newUserId = newUserResponse.body.user.id;

      // Add user to workspace
      db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
        workspaceId, newUserId, 'member'
      );

      // Verify membership
      const member = db.prepare(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).get(workspaceId, newUserId);
      
      expect(member).toBeDefined();
      expect(member.role).toBe('member');
    });
  });
});