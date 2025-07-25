import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

describe('Channels API', () => {
  let authToken;
  let userId;
  let workspaceId;

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
        username: 'channeltest',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.token;
    userId = authResponse.body.user.id;
  });

  afterAll(() => {
    // Don't close db as it's shared
  });

  describe('POST /api/channels/workspaces', () => {
    it('should create a new workspace', async () => {
      const response = await request(app)
        .post('/api/channels/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Workspace'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Workspace');
      workspaceId = response.body.id;
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/channels/workspaces')
        .send({
          name: 'Another Workspace'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/channels/workspaces', () => {
    it('should list user workspaces', async () => {
      const response = await request(app)
        .get('/api/channels/workspaces')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toBe('Test Workspace');
    });
  });

  describe('POST /api/channels/workspaces/:workspaceId/channels', () => {
    it('should create a new channel', async () => {
      const response = await request(app)
        .post(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test-channel'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-channel');
    });

    it('should reject duplicate channel names', async () => {
      const response = await request(app)
        .post(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test-channel'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Channel name already exists');
    });
  });

  describe('GET /api/channels/workspaces/:workspaceId/channels', () => {
    it('should list workspace channels', async () => {
      const response = await request(app)
        .get(`/api/channels/workspaces/${workspaceId}/channels`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});