import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import linksRoutes from '../server/api/links.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/links', linksRoutes);

describe('Link Aggregation and Voting', () => {
  let authToken1, authToken2;
  let userId1, userId2;
  let serverId;
  let linkId;

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

    // Create two test users
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'linkuser1',
        password: 'testpassword123'
      });
    
    authToken1 = user1Response.body.token;
    userId1 = user1Response.body.user.id;

    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'linkuser2',
        password: 'testpassword123'
      });
    
    authToken2 = user2Response.body.token;
    userId2 = user2Response.body.user.id;

    // Create a server and add both users
    db.prepare('INSERT INTO servers (id, name, created_by) VALUES (?, ?, ?)').run(
      'links-server-id', 'Links Test Server', userId1
    );
    serverId = 'links-server-id';

    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
      serverId, userId1, 'owner'
    );
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
      serverId, userId2, 'member'
    );
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('POST /api/links/servers/:serverId/links', () => {
    it('should create a new link', async () => {
      const response = await request(app)
        .post(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          url: 'https://example.com/article',
          title: 'Interesting Article',
          description: 'This is a very interesting article about testing',
          short_description: 'Interesting testing article'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.url).toBe('https://example.com/article');
      expect(response.body.title).toBe('Interesting Article');
      linkId = response.body.id;
    });

    it('should allow duplicate URLs in same server', async () => {
      // The current API doesn't prevent duplicate URLs
      const response = await request(app)
        .post(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          url: 'https://example.com/article',
          title: 'Duplicate Article'
        });

      expect(response.status).toBe(200);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/links/servers/${serverId}/links`)
        .send({
          url: 'https://example.com/another',
          title: 'No Auth'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/links/servers/:serverId/links', () => {
    it('should retrieve server links', async () => {
      const response = await request(app)
        .get(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const link = response.body[0];
      expect(link).toHaveProperty('url');
      expect(link).toHaveProperty('title');
      expect(link).toHaveProperty('avg_rating');
      expect(link).toHaveProperty('comment_count');
      expect(link).toHaveProperty('creator_username');
      expect(link).toHaveProperty('user_rating');
    });

    it('should sort links by creation date', async () => {
      // Create additional links
      await request(app)
        .post(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          url: 'https://example.com/newer',
          title: 'Newer Link'
        });

      const response = await request(app)
        .get(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`);

      // Verify links are sorted by created_at (descending)
      for (let i = 1; i < response.body.length; i++) {
        expect(response.body[i-1].created_at).toBeGreaterThanOrEqual(response.body[i].created_at);
      }
    });
  });

  describe('POST /api/links/:linkId/rate', () => {
    it('should rate a link', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/rate`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          rating: 8
        });

      expect(response.status).toBe(200);
      expect(response.body.rating).toBe(8);
      expect(response.body).toHaveProperty('avg_rating');
    });

    it('should update rating', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/rate`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          rating: 3
        });

      expect(response.status).toBe(200);
      expect(response.body.rating).toBe(3);
    });

    it('should allow rating of 0', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/rate`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          rating: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.rating).toBe(0);
    });

    it('should enforce rating range', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/rate`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ rating: 11 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 0 and 10');
    });
  });

  describe('Link Comments', () => {
    let commentId;

    it('should add a comment to a link', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/comments`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Great article! Very informative.'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Great article! Very informative.');
      expect(response.body.username).toBe('linkuser1');
      commentId = response.body.id;
    });

    it('should retrieve link comments', async () => {
      const response = await request(app)
        .get(`/api/links/links/${linkId}/comments`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const comment = response.body[0];
      expect(comment).toHaveProperty('content');
      expect(comment).toHaveProperty('username');
      expect(comment).toHaveProperty('created_at');
    });

    it('should add another comment', async () => {
      const response = await request(app)
        .post(`/api/links/links/${linkId}/comments`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          content: 'I agree! Thanks for sharing.'
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('I agree! Thanks for sharing.');
    });

    it('should update comment count', async () => {
      const response = await request(app)
        .get(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`);

      const link = response.body.find(l => l.id === linkId);
      expect(link.comment_count).toBe(2); // Two comments
    });
  });

  describe('Link Permissions', () => {
    it('should only allow server members to view links', async () => {
      // Create a third user not in server
      const user3Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'linkuser3',
          password: 'testpassword123'
        });
      
      const authToken3 = user3Response.body.token;

      const response = await request(app)
        .get(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken3}`);

      expect(response.status).toBe(403);
    });

    it('should allow link operations for server members', async () => {
      // Verify both users can create links
      const createResponse = await request(app)
        .post(`/api/links/servers/${serverId}/links`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          url: 'https://example.com/test-permissions',
          title: 'Test Permissions'
        });

      expect(createResponse.status).toBe(200);
    });
  });
});