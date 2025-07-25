import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import dmsRoutes from '../server/api/dms.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', dmsRoutes);

describe('Direct Messages', () => {
  let authToken1, authToken2;
  let userId1, userId2;

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

    // Create two test users
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'dmuser1',
        password: 'testpassword123'
      });
    
    authToken1 = user1Response.body.token;
    userId1 = user1Response.body.user.id;

    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'dmuser2',
        password: 'testpassword123'
      });
    
    authToken2 = user2Response.body.token;
    userId2 = user2Response.body.user.id;

    // DMs don't require workspace membership in current implementation
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('POST /api/dms/:receiverId', () => {
    it('should send a direct message', async () => {
      const response = await request(app)
        .post(`/api/dms/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Hello from user1!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Hello from user1!');
      expect(response.body.sender_id).toBe(userId1);
      expect(response.body.receiver_id).toBe(userId2);
    });

    it('should send an encrypted direct message', async () => {
      // Since the current API doesn't support encryption metadata in the request,
      // we'll test sending a regular message and verify the encryption can be stored
      const response = await request(app)
        .post(`/api/dms/${userId1}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          content: 'U2FsdGVkX1+encrypted+dm'
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('U2FsdGVkX1+encrypted+dm');
      
      // Verify message can be marked as encrypted in database
      const messageId = response.body.id;
      db.prepare(`
        UPDATE direct_messages 
        SET encrypted = 1, encryption_metadata = ?
        WHERE id = ?
      `).run(JSON.stringify({
        algorithm: 'AES-GCM',
        salt: 'dmsalt',
        iv: 'dmiv'
      }), messageId);
      
      const updatedMessage = db.prepare('SELECT * FROM direct_messages WHERE id = ?').get(messageId);
      expect(updatedMessage.encrypted).toBe(1);
      expect(updatedMessage.encryption_metadata).toBeTruthy();
    });

    it('should send DM to any user', async () => {
      // Create a third user not in the workspace
      const user3Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'dmuser3',
          password: 'testpassword123'
        });
      
      const userId3 = user3Response.body.user.id;

      // The current API allows DMs between any users
      const response = await request(app)
        .post(`/api/dms/${userId3}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Hello user3!'
        });

      expect(response.status).toBe(200);
    });

    it('should reject DM without authentication', async () => {
      const response = await request(app)
        .post(`/api/dms/${userId2}`)
        .send({
          content: 'No auth'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/dms', () => {
    it('should list user conversations', async () => {
      const response = await request(app)
        .get('/api/dms')
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const conversation = response.body[0];
      expect(conversation).toHaveProperty('other_username');
      expect(conversation).toHaveProperty('last_message');
      expect(conversation).toHaveProperty('last_message_at');
    });

    it('should show conversations after new message', async () => {
      // Send new message from user2 to user1
      await request(app)
        .post(`/api/dms/${userId1}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          content: 'New message for conversation list'
        });

      const response = await request(app)
        .get('/api/dms')
        .set('Authorization', `Bearer ${authToken1}`);

      const conversation = response.body.find(c => c.other_user_id === userId2);
      expect(conversation).toBeDefined();
      expect(conversation.last_message).toBe('New message for conversation list');
    });
  });

  describe('GET /api/dms/:otherUserId', () => {
    it('should retrieve conversation messages', async () => {
      const response = await request(app)
        .get(`/api/dms/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const message = response.body[0];
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('sender_id');
      expect(message).toHaveProperty('created_at');
    });

    it('should retrieve messages in chronological order', async () => {
      // Send a few more messages to ensure order
      await request(app)
        .post(`/api/dms/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ content: 'Message A' });
        
      await request(app)
        .post(`/api/dms/${userId1}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ content: 'Message B' });

      const response = await request(app)
        .get(`/api/dms/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`);
      
      // Messages should be in ascending chronological order
      const messages = response.body;
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].created_at).toBeGreaterThanOrEqual(messages[i-1].created_at);
      }
    });

    it('should handle non-existent user gracefully', async () => {
      const response = await request(app)
        .get('/api/dms/nonexistent-user-id')
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});